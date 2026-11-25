"""Exact scan-snapshot and multi-connection race tests on disposable PostgreSQL.

These tests run the real forward migration against a temporary local cluster.
They never connect to Supabase or staging. PostgreSQL server tools are required;
when absent the tests are skipped rather than replaced with mocks.
"""

import hashlib
import json
import os
from pathlib import Path
import select
import shutil
import socket
import subprocess
import tempfile
import time
import unittest


REPO_ROOT = Path(__file__).resolve().parents[2]
BASE_MIGRATION = REPO_ROOT / "supabase/migrations/20261124000100_org_rbac.sql"
RETENTION_MIGRATION = REPO_ROOT / "supabase/migrations/20261124000200_org_rbac_retention.sql"
SNAPSHOT_MIGRATION = REPO_ROOT / "supabase/migrations/20261124000300_org_rbac_scan_snapshot.sql"
POSTGRES_TOOLS = ("initdb", "pg_ctl", "psql")

OWNER = "00000000-0000-0000-0000-0000000000a1"
OTHER = "00000000-0000-0000-0000-0000000000a2"
ORG = "10000000-0000-0000-0000-0000000000a1"
EXPORT = "20000000-0000-0000-0000-0000000000a1"

SCANS_DDL = """
CREATE TABLE public.scans (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES auth.users(id) ON DELETE RESTRICT,
    scan_id VARCHAR(64) NOT NULL,
    commodity VARCHAR(100) NOT NULL,
    ai_supported BOOLEAN NOT NULL DEFAULT true,
    actual_weight_kg NUMERIC(8, 2),
    total_objects INTEGER NOT NULL DEFAULT 0,
    fresh_count INTEGER NOT NULL DEFAULT 0,
    rotten_count INTEGER NOT NULL DEFAULT 0,
    fresh_ratio_percent NUMERIC(5, 2) NOT NULL DEFAULT 0.0,
    rotten_ratio_percent NUMERIC(5, 2) NOT NULL DEFAULT 0.0,
    reference_price_per_kg INTEGER NOT NULL DEFAULT 0,
    estimated_economic_value BIGINT,
    potential_loss_value BIGINT,
    recommendation_note TEXT,
    is_simulated BOOLEAN NOT NULL DEFAULT false,
    model_version VARCHAR(50),
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    CONSTRAINT scans_user_id_scan_id_key UNIQUE (user_id, scan_id)
);
ALTER TABLE public.scans ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users read own scan history" ON public.scans FOR SELECT TO authenticated
    USING (auth.uid() = user_id);
CREATE POLICY "Users insert own scan history" ON public.scans FOR INSERT TO authenticated
    WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users update own scan history" ON public.scans FOR UPDATE TO authenticated
    USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users delete own scan history" ON public.scans FOR DELETE TO authenticated
    USING (auth.uid() = user_id);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.scans TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.scans TO service_role;
"""

SEED_SQL = f"""
INSERT INTO auth.users(id, email) VALUES
  ('{OWNER}', 'owner@example.test'),
  ('{OTHER}', 'other@example.test');
UPDATE public.user_profiles SET status = 'active' WHERE user_id IN ('{OWNER}', '{OTHER}');
INSERT INTO public.scans
  (id, user_id, scan_id, commodity, ai_supported, actual_weight_kg, total_objects,
   fresh_count, rotten_count, fresh_ratio_percent, rotten_ratio_percent,
   reference_price_per_kg, estimated_economic_value, potential_loss_value,
   recommendation_note, is_simulated, model_version, created_at, updated_at)
VALUES
  ('30000000-0000-0000-0000-0000000000a1', '{OWNER}', 'scan-1', 'Tomat', true,
   1.25, 10, 7, 3, 70.00, 30.00, 12000, 50000, 10000, 'Ripe', false, 'v1',
   '2026-01-01 00:00:00+00', '2026-01-01 00:00:00+00'),
  ('30000000-0000-0000-0000-0000000000a2', '{OWNER}', 'scan-2', 'Cabai', false,
   NULL, 4, 4, 0, 100.00, 0.00, 0, NULL, NULL, NULL, true, NULL,
   '2026-01-02 03:04:05.123456+00', '2026-01-02 03:04:05.123456+00'),
  ('30000000-0000-0000-0000-0000000000a3', '{OTHER}', 'other-1', 'Tomat', true,
   2.00, 5, 5, 0, 100.00, 0.00, 10000, 20000, 0, NULL, false, 'v1',
   '2026-01-03 00:00:00+00', '2026-01-03 00:00:00+00');
"""


def _run(command, *, input_text=None, check=True):
    return subprocess.run(
        command, input=input_text, text=True, stdout=subprocess.PIPE,
        stderr=subprocess.STDOUT, check=check,
        env={**os.environ, "PGOPTIONS": "-c timezone=UTC"},
    )


class PsqlSession:
    """Persistent psql session used to hold real transactions open."""

    NL = chr(10)
    BACKSLASH = chr(92)

    def __init__(self, psql, application_name):
        self.marker_counter = 0
        self.application_name = application_name
        self.proc = subprocess.Popen(
            [*psql, "-q"],
            stdin=subprocess.PIPE, stdout=subprocess.PIPE,
            stderr=subprocess.STDOUT, text=True, bufsize=1,
            env={**os.environ, "PGOPTIONS": "-c timezone=UTC"},
        )
        self.run("SET application_name = '" + application_name + "';")

    def _send(self, text):
        self.proc.stdin.write(text)
        self.proc.stdin.flush()

    def start(self, sql):
        self.marker_counter += 1
        marker = "__PSQL_DONE_" + self.application_name + "_" + str(self.marker_counter) + "__"
        self._send(sql + self.NL + self.BACKSLASH + "echo " + marker + self.NL)
        return marker

    def finish(self, marker, timeout=20):
        deadline = time.monotonic() + timeout
        lines = []
        while time.monotonic() < deadline:
            remaining = max(0.05, deadline - time.monotonic())
            ready, _, _ = select.select([self.proc.stdout], [], [], remaining)
            if not ready:
                continue
            line = self.proc.stdout.readline()
            if line == "":
                break
            if line.strip() == marker:
                return "".join(lines), 0
            lines.append(line)
        self.proc.kill()
        return "".join(lines), self.proc.poll()

    def run(self, sql, timeout=20):
        return self.finish(self.start(sql), timeout=timeout)

    def close(self):
        if self.proc.poll() is None:
            try:
                self._send(self.BACKSLASH + "q" + self.NL)
                self.proc.wait(timeout=2)
            except Exception:
                self.proc.kill()
        for stream in (self.proc.stdin, self.proc.stdout):
            try:
                stream.close()
            except Exception:
                pass


@unittest.skipUnless(all(shutil.which(tool) for tool in POSTGRES_TOOLS),
                     "PostgreSQL server/client tools unavailable")
class SnapshotIntegrityPostgresTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.temp = tempfile.TemporaryDirectory(prefix="agri-snapshot-pg-")
        cls.root = Path(cls.temp.name)
        cls.data = cls.root / "data"
        cls.socket_dir = cls.root / "socket"
        cls.socket_dir.mkdir()
        _run([shutil.which("initdb"), "-D", str(cls.data), "--auth-local=trust",
              "--auth-host=trust", "--username=postgres"])
        probe = socket.socket()
        probe.bind(("127.0.0.1", 0))
        cls.port = str(probe.getsockname()[1])
        probe.close()
        _run([shutil.which("pg_ctl"), "-D", str(cls.data), "-o",
              "-F -k " + str(cls.socket_dir) + " -p " + cls.port + " -h ''",
              "-l", str(cls.root / "postgres.log"), "start"])
        cls.psql = [
            shutil.which("psql"), "-X", "-A", "-t", "-h", str(cls.socket_dir),
            "-p", cls.port, "-U", "postgres", "-d", "postgres",
            "-v", "ON_ERROR_STOP=1",
        ]
        cls._sql("""
            CREATE ROLE anon NOLOGIN;
            CREATE ROLE authenticated NOLOGIN;
            CREATE ROLE service_role NOLOGIN BYPASSRLS;
            CREATE SCHEMA auth;
            CREATE TABLE auth.users (id uuid PRIMARY KEY, email text);
            CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS $$
                SELECT nullif(current_setting('request.jwt.claim.sub', true), '')::uuid
            $$;
            GRANT USAGE ON SCHEMA auth TO anon, authenticated;
            GRANT EXECUTE ON FUNCTION auth.uid() TO anon, authenticated;
        """)

    @classmethod
    def tearDownClass(cls):
        try:
            _run([shutil.which("pg_ctl"), "-D", str(cls.data), "-m", "fast", "stop"])
        finally:
            cls.temp.cleanup()

    @classmethod
    def _sql(cls, sql, *, check=True):
        return _run(cls.psql, input_text=sql, check=check)

    @classmethod
    def _migration(cls, path, *, check=True):
        return _run([*cls.psql, "-f", str(path)], check=check)

    def setUp(self):
        self._sql("DROP SCHEMA public CASCADE; CREATE SCHEMA public; GRANT ALL ON SCHEMA public TO PUBLIC;")
        self._sql("""
            DROP SCHEMA auth CASCADE;
            CREATE SCHEMA auth;
            CREATE TABLE auth.users (id uuid PRIMARY KEY, email text);
            CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS $$
                SELECT nullif(current_setting('request.jwt.claim.sub', true), '')::uuid
            $$;
            GRANT USAGE ON SCHEMA auth TO anon, authenticated;
            GRANT EXECUTE ON FUNCTION auth.uid() TO anon, authenticated;
            GRANT USAGE ON SCHEMA public TO anon, authenticated;
        """)
        self._migration(BASE_MIGRATION)
        self._migration(RETENTION_MIGRATION)
        self._sql(SCANS_DDL)
        self._migration(SNAPSHOT_MIGRATION)
        self._sql(SEED_SQL)

    def test_snapshot_migration_fails_closed_without_scans_table(self):
        self._sql("""
            ALTER TABLE public.account_exports
              DROP COLUMN IF EXISTS snapshot_schema_version,
              DROP COLUMN IF EXISTS snapshot_sha256;
            DROP TABLE public.scans CASCADE;
        """)
        proc = self._migration(SNAPSHOT_MIGRATION, check=False)
        self.assertNotEqual(proc.returncode, 0)
        self.assertIn("public.scans must exist", proc.stdout)
        added = self._sql("""
            SELECT count(*) FROM information_schema.columns
            WHERE table_schema='public' AND table_name='account_exports'
              AND column_name IN ('snapshot_schema_version','snapshot_sha256');
        """).stdout.strip()
        self.assertEqual(added, "0")

    def test_snapshot_is_deterministic_canonical_and_self_verifying(self):
        first = self._snapshot()
        second = self._snapshot()
        self.assertEqual(first, second)
        self.assertEqual(first["owner_id"], OWNER)
        self.assertEqual(first["scan_count"], 2)
        self.assertEqual([row["scan_id"] for row in first["scans"]], ["scan-1", "scan-2"])
        self.assertRegex(first["snapshot_sha256"], r"^[0-9a-f]{64}$")
        computed = self._sql("""
            SELECT encode(sha256(convert_to(
                (public.rbac_scan_snapshot('%s') - 'snapshot_sha256' - 'snapshot_json')::text,
                'UTF8')), 'hex');
        """ % OWNER).stdout.strip()
        self.assertEqual(computed, first["snapshot_sha256"])
        self.assertEqual(hashlib.sha256(first["snapshot_json"].encode("utf-8")).hexdigest(),
                         first["snapshot_sha256"])
        self.assertNotIn(OTHER, json.dumps(first["scans"]))

    def test_snapshot_is_stable_across_database_timezones(self):
        self._sql("SET TIME ZONE 'Asia/Jakarta';")
        jakarta = self._snapshot()
        self._sql("SET TIME ZONE 'America/New_York';")
        new_york = self._snapshot()
        self.assertEqual(jakarta, new_york)
        self.assertTrue(jakarta["scans"][1]["created_at"].endswith("Z"))
        self.assertIn("03:04:05.123456Z", jakarta["scans"][1]["created_at"])

    def test_export_snapshot_and_deletion_volatility_contract(self):
        rows = self._sql("""
            SELECT proname || '=' || provolatile::text FROM pg_proc
            WHERE pronamespace = 'public'::regnamespace
              AND proname IN ('rbac_scan_snapshot','rbac_delete_account')
            ORDER BY proname;
        """).stdout.split()
        self.assertEqual(rows, ["rbac_delete_account=v", "rbac_scan_snapshot=s"])

    def test_export_snapshot_rpc_has_one_consistent_committed_view(self):
        mutator = PsqlSession(self.psql, "snapshot-mutator")
        try:
            mutation_output, mutation_code = mutator.run("""
                BEGIN;
                SELECT pg_advisory_xact_lock(hashtextextended('agri_sort_scan_owner:%s', 0));
                UPDATE public.scans SET commodity='Uncommitted update'
                WHERE id='30000000-0000-0000-0000-0000000000a1';
            """ % OWNER)
            self.assertEqual(mutation_code, 0, mutation_output)
            before_first = self._api_snapshot()
            before_second = self._api_snapshot()
            self.assertEqual(before_first, before_second)
            self.assertEqual(before_first["scan_count"], 2)
            self.assertEqual(before_first["scans"][0]["commodity"], "Tomat")
            self.assertEqual(
                hashlib.sha256(before_first["snapshot_json"].encode("utf-8")).hexdigest(),
                before_first["snapshot_sha256"],
            )
            mutator.run("COMMIT;")
            after = self._api_snapshot()
            self.assertEqual(after["scan_count"], 2)
            self.assertEqual(after["scans"][0]["commodity"], "Uncommitted update")
            self.assertNotEqual(after["snapshot_sha256"], before_first["snapshot_sha256"])
            self.assertEqual(
                hashlib.sha256(after["snapshot_json"].encode("utf-8")).hexdigest(),
                after["snapshot_sha256"],
            )
        finally:
            mutator.close()

    def test_owner_snapshot_wrapper_returns_only_authenticated_owner(self):
        owner = self._sql("""
            SET ROLE authenticated;
            SELECT set_config('request.jwt.claim.sub','%s',false);
            SELECT public.rbac_api_scan_snapshot()::text;
        """ % OWNER).stdout
        self.assertIn(OWNER, owner)
        self.assertIn("scan-1", owner)
        self.assertNotIn(OTHER, owner)
        other = self._sql("""
            SET ROLE authenticated;
            SELECT set_config('request.jwt.claim.sub','%s',false);
            SELECT public.rbac_api_scan_snapshot()::text;
        """ % OTHER).stdout
        self.assertIn(OTHER, other)
        self.assertNotIn(OWNER, other)
        denied = self._sql("""
            SET ROLE authenticated;
            SELECT public.rbac_scan_snapshot('%s');
        """ % OTHER, check=False)
        self.assertNotEqual(denied.returncode, 0)
        self.assertIn("permission denied", denied.stdout)

    def test_authenticated_owner_mutation_still_invokes_guard_trigger(self):
        inserted = self._sql("""
            SET ROLE authenticated;
            SELECT set_config('request.jwt.claim.sub','%s',false);
            INSERT INTO public.scans(user_id,scan_id,commodity)
            VALUES ('%s','auth-insert','Tomat');
            RESET ROLE;
        """ % (OWNER, OWNER), check=False)
        self.assertEqual(inserted.returncode, 0, inserted.stdout)
        count = self._sql("SELECT count(*) FROM public.scans WHERE scan_id='auth-insert';").stdout.strip()
        self.assertEqual(count, "1")

    def test_valid_exact_snapshot_deletes_scans_and_consumes_export_atomically(self):
        snapshot = self._snapshot()
        self._create_export(snapshot)
        self._mark_downloaded()
        result = self._delete()
        self.assertEqual(result["scan_count"], 2)
        state = self._state()
        self.assertEqual(state["users"], 0)
        self.assertEqual(state["scans"], 0)
        self.assertEqual(state["export_state"], "consumed")
        self.assertEqual(state["deleted_audit"], 1)
        self.assertEqual(state["metadata_count"], "2")
        self.assertEqual(state["metadata_verified"], "true")

    def test_same_count_update_is_rejected_and_rolls_back(self):
        snapshot = self._snapshot()
        self._create_export(snapshot)
        self._mark_downloaded()
        self._sql("UPDATE public.scans SET commodity='Changed' WHERE id='30000000-0000-0000-0000-0000000000a1';")
        rejected = self._delete(check=False)
        self.assertNotEqual(rejected.returncode, 0)
        self.assertIn("exact scan snapshot", rejected.stdout)
        state = self._state()
        self.assertEqual(state["users"], 1)
        self.assertEqual(state["scans"], 2)
        self.assertEqual(state["export_state"], "downloaded")

    def test_one_scan_deleted_after_export_is_rejected(self):
        snapshot = self._snapshot()
        self._create_export(snapshot)
        self._mark_downloaded()
        self._sql("DELETE FROM public.scans WHERE id='30000000-0000-0000-0000-0000000000a2';")
        rejected = self._delete(check=False)
        self.assertNotEqual(rejected.returncode, 0)
        self.assertIn("exact scan snapshot", rejected.stdout)
        self.assertEqual(self._state()["scans"], 1)

    def test_new_scan_inserted_after_export_is_rejected(self):
        snapshot = self._snapshot()
        self._create_export(snapshot)
        self._mark_downloaded()
        self._sql("""
            INSERT INTO public.scans(user_id,scan_id,commodity)
            VALUES ('%s','scan-3','Baru');
        """ % OWNER)
        rejected = self._delete(check=False)
        self.assertNotEqual(rejected.returncode, 0)
        self.assertIn("exact scan snapshot", rejected.stdout)
        self.assertEqual(self._state()["scans"], 3)

    def test_replacement_with_same_count_is_rejected(self):
        snapshot = self._snapshot()
        self._create_export(snapshot)
        self._mark_downloaded()
        self._sql("""
            DELETE FROM public.scans WHERE id='30000000-0000-0000-0000-0000000000a2';
            INSERT INTO public.scans(user_id,scan_id,commodity)
            VALUES ('%s','replacement','Tomat');
        """ % OWNER)
        rejected = self._delete(check=False)
        self.assertNotEqual(rejected.returncode, 0)
        self.assertIn("exact scan snapshot", rejected.stdout)
        self.assertEqual(self._state()["scans"], 2)

    def test_repeatable_read_deletion_is_rejected_before_verification(self):
        self._create_export(self._snapshot())
        proc = self._sql("""
            BEGIN ISOLATION LEVEL REPEATABLE READ;
            SET ROLE service_role;
            SELECT set_config('request.jwt.claim.role','service_role',false);
            SELECT public.rbac_delete_account('%s','%s',false,'user_choice');
        """ % (OWNER, EXPORT), check=False)
        self.assertNotEqual(proc.returncode, 0)
        self.assertIn("requires read committed isolation", proc.stdout)
        self.assertEqual(self._state()["scans"], 2)

    def test_manifest_or_column_fingerprint_tampering_is_rejected(self):
        snapshot = self._snapshot()
        self._create_export(snapshot)
        self._mark_downloaded()
        self._sql("UPDATE public.account_exports SET snapshot_sha256=repeat('0',64) WHERE id='%s';" % EXPORT)
        rejected = self._delete(check=False)
        self.assertNotEqual(rejected.returncode, 0)
        self.assertIn("inconsistent", rejected.stdout.lower())
        self._sql("""
            UPDATE public.account_exports SET snapshot_sha256='%s',
              manifest=jsonb_set(manifest,'{snapshot,sha256}',to_jsonb(repeat('0',64)))
            WHERE id='%s';
        """ % (snapshot["snapshot_sha256"], EXPORT))
        rejected = self._delete(check=False)
        self.assertNotEqual(rejected.returncode, 0)
        self.assertIn("inconsistent", rejected.stdout.lower())
        self.assertEqual(self._state()["users"], 1)

    def test_expired_export_is_rejected(self):
        snapshot = self._snapshot()
        self._create_export(snapshot)
        self._mark_downloaded()
        self._sql("UPDATE public.account_exports SET expires_at=now() - interval '1 minute' WHERE id='%s';" % EXPORT)
        rejected = self._delete(check=False)
        self.assertNotEqual(rejected.returncode, 0)
        self.assertIn("expired", rejected.stdout.lower())
        self.assertEqual(self._state()["users"], 1)

    def test_waiver_requires_failed_export_when_scans_exist(self):
        snapshot = self._snapshot()
        self._create_export(snapshot)
        self._sql("UPDATE public.account_exports SET state='failed' WHERE id='%s';" % EXPORT)
        waived = self._delete(waiver=True)
        self.assertTrue(waived["without_export"])
        self.assertEqual(self._state()["users"], 0)

    def test_waiver_with_live_scans_but_no_failed_export_is_rejected(self):
        rejected = self._delete(waiver=True, check=False)
        self.assertNotEqual(rejected.returncode, 0)
        self.assertIn("waiver requires no scans or a failed export", rejected.stdout)
        self.assertEqual(self._state()["users"], 1)

    def test_scan_truncate_is_rejected(self):
        rejected = self._sql("TRUNCATE public.scans;", check=False)
        self.assertNotEqual(rejected.returncode, 0)
        self.assertIn("TRUNCATE", rejected.stdout)
        self.assertEqual(self._state()["scans"], 2)

    def test_owner_transfer_locks_both_owners_and_export_scope_is_preserved(self):
        self._sql("UPDATE public.scans SET user_id='%s' WHERE id='30000000-0000-0000-0000-0000000000a1';" % OTHER)
        self.assertEqual(self._snapshot()["scan_count"], 1)
        other = self._snapshot(OTHER)
        self.assertEqual(other["scan_count"], 2)
        self.assertNotIn(OWNER, json.dumps(other["scans"]))

    def _assert_reverse_lock_wait_rejects(self, mutation_sql, *,
                                          expected_scans,
                                          expected_scan_id=None,
                                          expected_commodity=None):
        """A mutates while holding the owner lock; B waits, then must recheck.

        The exporter is deliberately created before A's mutation, so B's export
        is stale.  A commits while B is blocked on the owner advisory lock.  If
        B's verification reused the outer statement snapshot taken before the
        wait, it would accept the stale export and delete the new row.
        """
        snapshot = self._snapshot()
        self._create_export(snapshot)
        self._mark_downloaded()
        mutator = PsqlSession(self.psql, "reverse-mutator")
        deleter = PsqlSession(self.psql, "reverse-deleter")
        try:
            mutation_output, mutation_code = mutator.run("""
                BEGIN;
                SELECT pg_advisory_xact_lock(hashtextextended('agri_sort_scan_owner:%s', 0));
            """ % OWNER + mutation_sql)
            self.assertEqual(mutation_code, 0, mutation_output)
            marker = deleter.start("""
                SET ROLE service_role;
                SELECT set_config('request.jwt.claim.role','service_role',false);
                SELECT public.rbac_delete_account('%s','%s',false);
            """ % (OWNER, EXPORT))
            self.assertTrue(self._wait_for_advisory_lock("reverse-deleter"))
            mutator.run("COMMIT;")
            output, code = deleter.finish(marker)
            self.assertNotEqual(code, 0, output)
            self.assertIn("exact scan snapshot", output)
        finally:
            mutator.close()
            deleter.close()
        state = self._state()
        self.assertEqual(state["users"], 1)
        self.assertEqual(state["scans"], expected_scans)
        if expected_scan_id is not None:
            found = self._sql(
                "SELECT count(*) FROM public.scans WHERE id='%s';" % expected_scan_id
            ).stdout.strip()
            self.assertEqual(found, "1")
        if expected_commodity is not None:
            commodity = self._sql(
                "SELECT commodity FROM public.scans WHERE id='30000000-0000-0000-0000-0000000000a1';"
            ).stdout.strip()
            self.assertEqual(commodity, expected_commodity)

    def test_reverse_lock_wait_insert_is_rechecked_after_commit(self):
        self._assert_reverse_lock_wait_rejects("""
            INSERT INTO public.scans(user_id,scan_id,commodity)
            VALUES ('%s','blocked-insert','Baru');
        """ % OWNER, expected_scans=3)

    def test_reverse_lock_wait_update_is_rechecked_after_commit(self):
        self._assert_reverse_lock_wait_rejects("""
            UPDATE public.scans SET commodity='Committed update'
            WHERE id='30000000-0000-0000-0000-0000000000a1';
        """, expected_scans=2,
             expected_scan_id="30000000-0000-0000-0000-0000000000a1",
             expected_commodity="Committed update")

    def test_reverse_lock_wait_delete_is_rechecked_after_commit(self):
        self._assert_reverse_lock_wait_rejects("""
            DELETE FROM public.scans WHERE id='30000000-0000-0000-0000-0000000000a2';
        """, expected_scans=1)
        deleted = self._sql(
            "SELECT count(*) FROM public.scans WHERE id='30000000-0000-0000-0000-0000000000a2';"
        ).stdout.strip()
        self.assertEqual(deleted, "0")

    def test_reverse_lock_wait_same_count_replacement_is_rechecked_after_commit(self):
        self._assert_reverse_lock_wait_rejects("""
            DELETE FROM public.scans WHERE id='30000000-0000-0000-0000-0000000000a2';
            INSERT INTO public.scans(id,user_id,scan_id,commodity)
            VALUES ('30000000-0000-0000-0000-0000000000a4','%s','replacement','Tomat');
        """ % OWNER, expected_scans=2,
             expected_scan_id="30000000-0000-0000-0000-0000000000a4")
        deleted = self._sql(
            "SELECT count(*) FROM public.scans WHERE id='30000000-0000-0000-0000-0000000000a2';"
        ).stdout.strip()
        self.assertEqual(deleted, "0")

    def test_insert_during_verified_deletion_waits_then_fails_without_partial_state(self):
        snapshot = self._snapshot()
        self._create_export(snapshot)
        self._mark_downloaded()
        self._sql("""
            CREATE SEQUENCE public.test_delete_started;
            CREATE FUNCTION public.test_slow_scan_delete() RETURNS trigger
            LANGUAGE plpgsql AS $$
            BEGIN
                IF current_setting('agri.test_delete_delay', true) = '1' THEN
                    PERFORM nextval('public.test_delete_started');
                    PERFORM pg_sleep(2);
                END IF;
                RETURN OLD;
            END;
            $$;
            CREATE TRIGGER test_slow_scan_delete BEFORE DELETE ON public.scans
            FOR EACH ROW EXECUTE FUNCTION public.test_slow_scan_delete();
        """)
        mutator = PsqlSession(self.psql, "slow-mutator")
        deleter = PsqlSession(self.psql, "slow-deleter")
        try:
            marker = deleter.start("""
                BEGIN;
                SET LOCAL agri.test_delete_delay='1';
                SET ROLE service_role;
                SELECT set_config('request.jwt.claim.role','service_role',false);
                SELECT public.rbac_delete_account('%s','%s',false);
                COMMIT;
            """ % (OWNER, EXPORT))
            self.assertTrue(self._wait_for_sequence())
            late_marker = mutator.start("""
                INSERT INTO public.scans(user_id,scan_id,commodity)
                VALUES ('%s','late-insert','Baru');
            """ % OWNER)
            self.assertTrue(self._wait_for_lock("slow-mutator"))
            output, code = deleter.finish(marker)
            self.assertEqual(code, 0, output)
            late_output, late_code = mutator.finish(late_marker, timeout=5)
            self.assertNotEqual(late_code, 0, late_output)
        finally:
            mutator.close()
            deleter.close()
        state = self._state()
        self.assertEqual(state["users"], 0)
        self.assertEqual(state["scans"], 0)

    def test_last_organization_admin_race_serializes_and_rejects_loser(self):
        self._sql("""
            INSERT INTO public.organizations(id,name,slug) VALUES ('%s','Org','org');
            INSERT INTO public.organization_memberships(organization_id,user_id,role,status)
            VALUES ('%s','%s','admin','active'), ('%s','%s','admin','active');
        """ % (ORG, ORG, OWNER, ORG, OTHER))
        first = PsqlSession(self.psql, "admin-first")
        second = PsqlSession(self.psql, "admin-second")
        try:
            first.run("BEGIN; DELETE FROM public.organization_memberships WHERE organization_id='%s' AND user_id='%s';" % (ORG, OWNER))
            marker = second.start("""
                BEGIN;
                DELETE FROM public.organization_memberships
                WHERE organization_id='%s' AND user_id='%s';
                COMMIT;
            """ % (ORG, OTHER))
            self.assertTrue(self._wait_for_lock("admin-second"))
            first.run("COMMIT;")
            output, code = second.finish(marker)
            self.assertNotEqual(code, 0, output)
            self.assertIn("at least one active admin", output)
        finally:
            first.close()
            second.close()
        remaining = self._sql("SELECT count(*) FROM public.organization_memberships WHERE organization_id='%s';" % ORG).stdout.strip()
        self.assertEqual(remaining, "1")

    def test_last_super_admin_race_serializes_and_rejects_loser(self):
        self._sql("""
            INSERT INTO public.platform_roles(user_id,role) VALUES ('%s','super_admin'), ('%s','super_admin');
        """ % (OWNER, OTHER))
        first = PsqlSession(self.psql, "super-first")
        second = PsqlSession(self.psql, "super-second")
        try:
            first.run("BEGIN; DELETE FROM public.platform_roles WHERE user_id='%s';" % OWNER)
            marker = second.start("""
                BEGIN;
                DELETE FROM public.platform_roles WHERE user_id='%s';
                COMMIT;
            """ % OTHER)
            self.assertTrue(self._wait_for_lock("super-second"))
            first.run("COMMIT;")
            output, code = second.finish(marker)
            self.assertNotEqual(code, 0, output)
            self.assertIn("last active Super Admin", output)
        finally:
            first.close()
            second.close()
        remaining = self._sql("SELECT count(*) FROM public.platform_roles WHERE role='super_admin';").stdout.strip()
        self.assertEqual(remaining, "1")

    def _snapshot(self, user=OWNER):
        raw = self._sql("SELECT public.rbac_scan_snapshot('%s')::text;" % user).stdout.strip()
        return json.loads(raw.splitlines()[-1])

    def _api_snapshot(self):
        raw = self._sql("""
            SET ROLE authenticated;
            SELECT set_config('request.jwt.claim.sub','%s',false);
            SELECT public.rbac_api_scan_snapshot()::text;
        """ % OWNER).stdout.strip()
        return json.loads(raw.splitlines()[-1])

    def _create_export(self, snapshot):
        manifest = {
            "schema_version": "scan-export-v1",
            "user_id": OWNER,
            "scan_count": snapshot["scan_count"],
            "snapshot": {
                "algorithm": "sha256",
                "schema_version": snapshot["schema_version"],
                "owner_id": snapshot["owner_id"],
                "scan_count": snapshot["scan_count"],
                "sha256": snapshot["snapshot_sha256"],
            },
        }
        manifest_sql = json.dumps(manifest).replace("'", "''")
        self._sql("""
            INSERT INTO public.account_exports
              (id,user_id,state,scan_count,sha256,manifest,storage_path,attempt_count,
               created_at,expires_at,ready_at,snapshot_schema_version,snapshot_sha256)
            VALUES
              ('%s','%s','ready',%s,repeat('a',64),'%s'::jsonb,'memory',1,now(),
               now() + interval '1 hour',now(),'%s','%s');
        """ % (EXPORT, OWNER, snapshot["scan_count"], manifest_sql,
               snapshot["schema_version"], snapshot["snapshot_sha256"]))

    def _mark_downloaded(self):
        self._sql("""
            SET ROLE authenticated;
            SELECT set_config('request.jwt.claim.sub','%s',false);
            SELECT public.rbac_mark_export_downloaded('%s');
        """ % (OWNER, EXPORT))

    def _delete(self, *, waiver=False, check=True):
        proc = self._sql("""
            SET ROLE service_role;
            SELECT set_config('request.jwt.claim.role','service_role',false);
            SELECT public.rbac_delete_account('%s',%s,%s,'user_choice');
        """ % (OWNER, "NULL" if waiver else "'%s'" % EXPORT, "true" if waiver else "false"), check=check)
        if not check and proc.returncode != 0:
            return proc
        return json.loads([line for line in proc.stdout.splitlines() if line.strip()][-1])

    def _state(self):
        raw = self._sql("""
            SELECT count(*) FROM auth.users WHERE id='%s';
            SELECT count(*) FROM public.scans WHERE user_id='%s';
            SELECT COALESCE((SELECT state FROM public.account_exports WHERE id='%s'),'missing');
            SELECT count(*) FROM public.audit_events WHERE action='account.deleted' AND actor_user_id='%s';
            SELECT COALESCE((SELECT metadata->>'scan_count' FROM public.audit_events WHERE action='account.deleted' AND actor_user_id='%s'),'');
            SELECT COALESCE((SELECT metadata->>'export_verified' FROM public.audit_events WHERE action='account.deleted' AND actor_user_id='%s'),'');
        """ % (OWNER, OWNER, EXPORT, OWNER, OWNER, OWNER)).stdout.splitlines()
        rows = [line for line in raw if line.strip()]
        return {
            "users": int(rows[0]), "scans": int(rows[1]), "export_state": rows[2],
            "deleted_audit": int(rows[3]), "metadata_count": rows[4] if len(rows) > 4 else "",
            "metadata_verified": rows[5] if len(rows) > 5 else "",
        }

    def _wait_for_advisory_lock(self, application_name, timeout=10):
        deadline = time.monotonic() + timeout
        while time.monotonic() < deadline:
            row = self._sql("""
                SELECT COALESCE(wait_event_type,'') || ':' || COALESCE(wait_event,'')
                FROM pg_stat_activity WHERE application_name='%s';
            """ % application_name).stdout.strip()
            if row == "Lock:advisory":
                return True
            time.sleep(0.05)
        return False

    def _wait_for_lock(self, application_name, timeout=10):
        deadline = time.monotonic() + timeout
        while time.monotonic() < deadline:
            row = self._sql("""
                SELECT COALESCE(wait_event_type,'') || ':' || COALESCE(wait_event,'')
                FROM pg_stat_activity WHERE application_name='%s';
            """ % application_name).stdout.strip()
            if "Lock" in row or "advisory" in row or "transactionid" in row:
                return True
            time.sleep(0.05)
        return False

    def _wait_for_sequence(self, timeout=10):
        deadline = time.monotonic() + timeout
        while time.monotonic() < deadline:
            row = self._sql("SELECT is_called FROM public.test_delete_started;").stdout.strip()
            if row == "t":
                return True
            time.sleep(0.05)
        return False


if __name__ == "__main__":
    unittest.main()
