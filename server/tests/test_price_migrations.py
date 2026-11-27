"""Disposable PostgreSQL tests untuk migrasi harga (isu #42/#43/#45).

Menerapkan SQL MIGRASI ASLI ke cluster PostgreSQL sementara (bukan Supabase),
memverifikasi constraint/index/RLS, menguji upsert idempoten + single-flight
di level DB, lalu MENG-ROLLBACK (drop). Tanpa database bersama, tanpa mock.
"""

import os
from pathlib import Path
import shutil
import subprocess
import tempfile
import unittest

REPO_ROOT = Path(__file__).resolve().parents[2]
PRICE_MIGRATION = REPO_ROOT / "supabase/migrations/20261127000100_price_observations.sql"
FRESHNESS_MIGRATION = REPO_ROOT / "supabase/migrations/20261127000200_price_freshness.sql"
POSTGRES_TOOLS = ("initdb", "pg_ctl", "psql")


def _run(command, *, input_text=None, check=True):
    return subprocess.run(
        command,
        input=input_text,
        text=True,
        stdout=subprocess.PIPE,
        stderr=subprocess.STDOUT,
        check=check,
        env={**os.environ, "PGOPTIONS": "-c timezone=UTC"},
    )


@unittest.skipUnless(all(shutil.which(tool) for tool in POSTGRES_TOOLS), "PostgreSQL server/client tools unavailable")
class TestDisposablePriceMigrations(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.temp = tempfile.TemporaryDirectory(prefix="agri-price-pg-")
        cls.root = Path(cls.temp.name)
        cls.data = cls.root / "data"
        cls.socket = cls.root / "socket"
        cls.socket.mkdir()
        _run([shutil.which("initdb"), "-D", str(cls.data), "--auth-local=trust", "--auth-host=trust", "--username=postgres"])
        cls.port = "55472"
        _run([
            shutil.which("pg_ctl"), "-D", str(cls.data), "-o",
            f"-F -k {cls.socket} -p {cls.port} -h ''", "-l", str(cls.root / "postgres.log"), "start",
        ])
        cls.psql = [
            shutil.which("psql"), "-X", "-A", "-t", "-h", str(cls.socket), "-p", cls.port,
            "-U", "postgres", "-d", "postgres", "-v", "ON_ERROR_STOP=1",
        ]

    @classmethod
    def tearDownClass(cls):
        try:
            _run([shutil.which("pg_ctl"), "-D", str(cls.data), "-m", "fast", "stop"], check=False)
        finally:
            cls.temp.cleanup()

    @classmethod
    def _sql(cls, sql, *, check=True):
        return _run(cls.psql, input_text=sql, check=check)

    def setUp(self):
        self._sql("DROP SCHEMA public CASCADE; CREATE SCHEMA public;")

    def apply_price_migrations(self, *, check=True):
        base = _run([*self.psql, "-f", str(PRICE_MIGRATION)], check=check)
        if base.returncode != 0:
            return base
        return _run([*self.psql, "-f", str(FRESHNESS_MIGRATION)], check=check)

    def rollback_price_migrations(self, *, check=True):
        return self._sql(
            "DROP TABLE IF EXISTS price_observations, price_ingest_runs, price_sources CASCADE;",
            check=check,
        )

    # ---------- penerapan ----------

    def test_fresh_migration_creates_tables_indexes_and_rls(self):
        result = self.apply_price_migrations()
        self.assertEqual(result.returncode, 0, result.stdout)
        catalog = self._sql("""
            SELECT relname || ':' || relrowsecurity FROM pg_class
            WHERE relname IN ('price_sources','price_observations','price_ingest_runs') ORDER BY relname;
        """).stdout
        self.assertIn("price_observations:t", catalog)
        self.assertIn("price_sources:t", catalog)
        self.assertIn("price_ingest_runs:t", catalog)
        indexes = self._sql("""
            SELECT indexname FROM pg_indexes WHERE tablename = 'price_observations' ORDER BY indexname;
        """).stdout
        self.assertIn("price_observations_source_record_uq", indexes)
        self.assertIn("price_observations_logical_uq", indexes)
        self.assertIn("price_observations_query_idx", indexes)
        # Single-flight: unique partial index pada run 'running'
        single_flight = self._sql("""
            SELECT indexname FROM pg_indexes WHERE tablename = 'price_ingest_runs' AND indexname = 'price_ingest_runs_running_uq';
        """).stdout
        self.assertIn("price_ingest_runs_running_uq", single_flight)
        # Kolom freshness #43
        cols = self._sql("""
            SELECT column_name FROM information_schema.columns
            WHERE table_name = 'price_sources' AND column_name IN
            ('expected_cadence_seconds','grace_period_seconds','max_stale_age_seconds','documented_extension_seconds');
        """).stdout
        self.assertEqual(len([line for line in cols.splitlines() if line.strip()]), 4)

    def test_migration_idempotent_on_reapply(self):
        first = self.apply_price_migrations()
        self.assertEqual(first.returncode, 0, first.stdout)
        again = self.apply_price_migrations()
        self.assertEqual(again.returncode, 0, again.stdout)

    def test_enum_constraints_reject_invalid_data_status(self):
        self.apply_price_migrations()
        self._sql("""
            INSERT INTO price_sources (source_id, name, official_url)
            VALUES ('sp2kp', 'SP2KP', 'https://sp2kp.kemendag.go.id/');
        """)
        # data_status di luar enum => ditolak
        result = self._sql("""
            INSERT INTO price_observations (source_id, source_record_id, commodity_id, price_type,
              region_level, data_status, provenance_method)
            VALUES ('sp2kp','R1','tomat','consumer','kabupaten','live','official_api');
        """, check=False)
        self.assertNotEqual(result.returncode, 0)
        self.assertIn("price_observations_data_status_check", result.stdout)

    def test_invalid_commodity_and_price_type_rejected(self):
        self.apply_price_migrations()
        self._sql("""
            INSERT INTO price_sources (source_id, name, official_url)
            VALUES ('sp2kp', 'SP2KP', 'https://sp2kp.kemendag.go.id/');
        """)
        result = self._sql("""
            INSERT INTO price_observations (source_id, source_record_id, commodity_id, price_type,
              region_level, data_status, provenance_method)
            VALUES ('sp2kp','R1','durian','consumer','kabupaten','actual','official_api');
        """, check=False)
        self.assertNotEqual(result.returncode, 0)
        result = self._sql("""
            INSERT INTO price_observations (source_id, source_record_id, commodity_id, price_type,
              region_level, data_status, provenance_method)
            VALUES ('sp2kp','R1','tomat','eceran','kabupaten','actual','official_api');
        """, check=False)
        self.assertNotEqual(result.returncode, 0)

    # ---------- idempotensi & single-flight di level DB ----------

    def _seed_source(self):
        self._sql("""
            INSERT INTO price_sources (source_id, name, official_url)
            VALUES ('sp2kp', 'SP2KP', 'https://sp2kp.kemendag.go.id/');
        """)

    def _observation(self, record_id):
        return f"""
            INSERT INTO price_observations (source_id, source_record_id, commodity_id, price_type,
              price_value, unit_raw, normalized_price_per_kg, region_level, region_code,
              observed_at, fetched_at, data_status, is_official, provenance_method)
            VALUES ('sp2kp','{record_id}','cabai_rawit_hijau','consumer',44800,'kg',44800,
              'kabupaten','1375','2026-11-27T08:00:00+07:00', now(), 'actual', true, 'official_api');
        """

    def test_idempotent_upsert_same_source_record(self):
        self.apply_price_migrations()
        self._seed_source()
        self._sql(self._observation("SRC-1"))
        # Upsert (merge-duplicates) pada konflik source_record => tidak menduplikasi
        self._sql("""
            INSERT INTO price_observations (source_id, source_record_id, commodity_id, price_type,
              price_value, unit_raw, normalized_price_per_kg, region_level, region_code,
              observed_at, fetched_at, data_status, is_official, provenance_method)
            VALUES ('sp2kp','SRC-1','cabai_rawit_hijau','consumer',45000,'kg',45000,
              'kabupaten','1375','2026-11-27T08:00:00+07:00', now(), 'actual', true, 'official_api')
            ON CONFLICT (source_id, source_record_id) DO UPDATE SET price_value = EXCLUDED.price_value;
        """)
        count = self._sql("SELECT count(*) FROM price_observations;").stdout.strip()
        self.assertEqual(count, "1")
        value = self._sql("SELECT price_value FROM price_observations;").stdout.strip()
        self.assertEqual(value, "45000.00")

    def test_single_flight_one_running_per_source(self):
        self.apply_price_migrations()
        self._seed_source()
        self._sql("INSERT INTO price_ingest_runs (source_id, status) VALUES ('sp2kp','running');")
        result = self._sql(
            "INSERT INTO price_ingest_runs (source_id, status) VALUES ('sp2kp','running');",
            check=False,
        )
        self.assertNotEqual(result.returncode, 0, "run kedua harus ditolak unique partial index")

    def test_rls_blocks_anonymous_role(self):
        self.apply_price_migrations()
        self._seed_source()
        self._sql("""
            CREATE ROLE price_anon NOLOGIN;
            GRANT USAGE ON SCHEMA public TO price_anon;
            GRANT SELECT ON price_observations TO price_anon;
        """)
        # service role (owner) bisa baca
        count_owner = self._sql("SELECT count(*) FROM price_observations;").stdout.strip()
        self.assertEqual(count_owner, "0")
        # anon dengan RLS aktif tanpa policy => tidak melihat baris walau di-insert service role
        self._sql(self._observation("SRC-RLS"))
        result = self._sql(
            "SET ROLE price_anon; SELECT count(*) AS visible FROM price_observations;",
            check=False,
        )
        # SET ROLE + SELECT harus sukses tapi melihat 0 baris (RLS tanpa policy)
        self.assertEqual(result.returncode, 0)
        self.assertIn("0", result.stdout)

    # ---------- rollback ----------

    def test_rollback_drops_all_price_objects(self):
        self.apply_price_migrations()
        self.rollback_price_migrations()
        leftover = self._sql("""
            SELECT count(*) FROM pg_tables WHERE tablename IN
            ('price_sources','price_observations','price_ingest_runs');
        """).stdout.strip()
        self.assertEqual(leftover, "0")
        # Migrasi bisa diterapkan lagi setelah rollback
        again = self.apply_price_migrations()
        self.assertEqual(again.returncode, 0, again.stdout)


if __name__ == "__main__":
    unittest.main()
