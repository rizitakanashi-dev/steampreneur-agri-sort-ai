"""
Tests repository harga (isu #42) — idempotensi upsert & kueri baca.

Menggunakan InMemoryPriceRepository dengan semantik identik versi DB:
unik pada (source_id, source_record_id); re-run batch sama tidak menduplikasi.
"""

import unittest

from server.repositories.price_repository import (
    InMemoryPriceRepository,
    payload_hash_of,
)


def _obs(record_id: str, commodity: str = "cabai_rawit_hijau", observed: str = "2026-11-26T08:00:00+07:00", value: float = 44800.0):
    return {
        "source_id": "sp2kp",
        "source_record_id": record_id,
        "commodity_id": commodity,
        "commodity_raw": "C Rawit Hijau",
        "price_type": "consumer",
        "price_value": value,
        "currency": "IDR",
        "unit_raw": "kg",
        "normalized_price_per_kg": value,
        "normalization_method": "unit_factor",
        "region_level": "kabupaten",
        "region_code": "1375",
        "region_name": "Kota Payakumbuh",
        "market_name": None,
        "observed_at": observed,
        "published_at": None,
        "fetched_at": "2026-11-27T02:00:00Z",
        "data_status": "actual",
        "is_live": True,
        "is_official": True,
        "provenance_method": "official_api",
        "provenance_reference": None,
        "license": None,
        "payload_hash": None,
    }


class TestIdempotentUpsert(unittest.TestCase):
    def test_same_batch_twice_inserts_once(self):
        repo = InMemoryPriceRepository()
        run1 = repo.record_ingest_run("sp2kp", "running")
        inserted1 = repo.upsert_observations([_obs("SRC-1")], run1)
        run2 = repo.record_ingest_run("sp2kp", "running")
        inserted2 = repo.upsert_observations([_obs("SRC-1")], run2)
        self.assertEqual(inserted1, 1)
        self.assertEqual(inserted2, 0)  # idempoten: tidak menduplikasi
        self.assertEqual(len({(o["source_id"], o["source_record_id"]) for o in repo._by_source_record.values()}), 1)

    def test_distinct_records_both_stored(self):
        repo = InMemoryPriceRepository()
        run = repo.record_ingest_run("sp2kp", "running")
        inserted = repo.upsert_observations([_obs("SRC-1"), _obs("SRC-2")], run)
        self.assertEqual(inserted, 2)


class TestReadQueries(unittest.TestCase):
    def setUp(self):
        self.repo = InMemoryPriceRepository()
        run = self.repo.record_ingest_run("sp2kp", "running")
        self.repo.upsert_observations(
            [
                _obs("SRC-1", observed="2026-11-26T08:00:00+07:00", value=44800.0),
                _obs("SRC-2", observed="2026-11-27T08:00:00+07:00", value=45000.0),
                _obs(
                    "SRC-3",
                    commodity="terung",
                    observed="2026-11-27T08:00:00+07:00",
                    value=10000.0,
                ),
            ],
            run,
        )

    def test_latest_picks_newest_observation(self):
        row = self.repo.latest("cabai_rawit_hijau", "consumer", "kabupaten", "1375", "sp2kp")
        self.assertEqual(row["source_record_id"], "SRC-2")
        self.assertEqual(row["price_value"], 45000.0)

    def test_latest_missing_commodity_is_none(self):
        # Terung tersimpan hanya bila sumber menerbitkannya — bukan pengganti komoditas.
        row = self.repo.latest("cabai_merah_keriting", "consumer", "kabupaten", "1375", "sp2kp")
        self.assertIsNone(row)

    def test_history_range_and_cursor(self):
        page = self.repo.history("cabai_rawit_hijau", "consumer", "kabupaten", "1375", limit=1)
        self.assertEqual(len(page["rows"]), 1)
        self.assertIsNotNone(page["next_cursor"])
        page2 = self.repo.history(
            "cabai_rawit_hijau", "consumer", "kabupaten", "1375", limit=10, cursor=page["next_cursor"]
        )
        self.assertEqual(len(page2["rows"]), 1)

    def test_history_date_bounds(self):
        page = self.repo.history(
            "cabai_rawit_hijau", "consumer", "kabupaten", "1375",
            from_date="2026-11-27", to_date="2026-11-27",
        )
        self.assertEqual(len(page["rows"]), 1)
        self.assertEqual(page["rows"][0]["observed_at"], "2026-11-27T08:00:00+07:00")

    def test_ingest_run_recorded(self):
        run_id = self.repo.record_ingest_run("sp2kp", "skipped", notes="SOURCE_ACCESS_UNCONFIRMED")
        self.assertTrue(run_id)
        last = self.repo.last_success("sp2kp")
        self.assertIsNone(last)  # belum ada run success


class TestPayloadHash(unittest.TestCase):
    def test_hash_is_deterministic_and_secret_free(self):
        record = {"commodity_id": "tomat", "price_value": 12000}
        self.assertEqual(payload_hash_of(record), payload_hash_of(dict(reversed(list(record.items())))))


if __name__ == "__main__":
    unittest.main()
