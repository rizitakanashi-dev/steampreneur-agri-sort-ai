"""
Tests #43 — freshness per sumber, single-flight, negative cache, cron endpoint.

Kunci acceptance:
  * expired TIDAK disajikan sebagai current; stale hanya berlabel cached + timestamp.
  * concurrent refresh => satu fetch / satu ingest idempoten, bukan duplikat.
  * kegagalan provider TIDAK di-cache sebagai data sukses (negative cache saja).
  * /tmp bukan sumber kebenaran (semua state lewat repository).
"""

import os
import unittest
from datetime import datetime, timedelta, timezone

from fastapi.testclient import TestClient

from server.config.price_config import PriceIntegrationConfig
from server.integrations.base import (
    AccessUnconfirmed,
    PriceFetchResult,
    PriceQuery,
    ProviderObservation,  # noqa: F401 — dipakai via fixture provider
    SourceRegistry,
)
from server.main import app
from server.repositories.price_repository import InMemoryPriceRepository
from server.services.price_freshness import (
    SourceFreshnessPolicy,
    compute_freshness,
    may_serve_as_current,
    policy_for,
)
from server.services.price_ingestion_service import PriceIngestionService
from server.services.price_query_service import PriceQueryService
from server.services.price_single_flight import InMemorySingleFlight


NOW = datetime(2026, 11, 27, 9, 0, 0, tzinfo=timezone.utc)


def _ts(**kwargs) -> datetime:
    return NOW - timedelta(**kwargs)


class TestFreshnessComputation(unittest.TestCase):
    def test_within_cadence_plus_grace_is_fresh(self):
        state, age, max_age = compute_freshness(_ts(hours=20), "sp2kp", now=NOW)
        self.assertEqual(state, "fresh")
        self.assertEqual(max_age, 86400 + 21600 + 86400)  # + ekstensi akhir pekan terdokumentasi

    def test_stale_between_fresh_window_and_max_stale(self):
        # 60 jam: lewat fresh window (2.25 hari = 194400s) tapi < 3 hari max_stale.
        state, age, max_age = compute_freshness(_ts(hours=60), "sp2kp", now=NOW)
        self.assertEqual(state, "stale")
        self.assertEqual(max_age, 259200)

    def test_expired_beyond_max_stale(self):
        state, _, _ = compute_freshness(_ts(days=4), "sp2kp", now=NOW)
        self.assertEqual(state, "expired")

    def test_default_policy_boundary(self):
        # Policy default (tanpa ekstensi): fresh window 1.25 hari, max stale 2 hari.
        state_40h, _, _ = compute_freshness(_ts(hours=40), "sipashorti", now=NOW)
        self.assertEqual(state_40h, "stale")
        state_73h, _, _ = compute_freshness(_ts(hours=73), "sipashorti", now=NOW)
        self.assertEqual(state_73h, "expired")

    def test_missing_timestamp_is_unknown(self):
        state, age, _ = compute_freshness(None, "sp2kp", now=NOW)
        self.assertEqual(state, "unknown")

    def test_failed_fetch_never_fresh(self):
        state, _, _ = compute_freshness(_ts(hours=1), "sp2kp", now=NOW, last_fetch_succeeded=False)
        self.assertEqual(state, "unknown")

    def test_holiday_extension_does_not_make_old_data_fresh(self):
        # Ekstensi memperpanjang jendela fresh (dokumentasi), TAPI policy tanpa
        # ekstensi tetap menganggap umur 3 hari = expired.
        policy = SourceFreshnessPolicy(documented_extension_seconds=86400)
        self.assertLess(policy.fresh_window(), policy.max_stale_age_seconds + 86400)
        state_default, _, _ = compute_freshness(_ts(days=3), "sipashorti", now=NOW)
        self.assertEqual(state_default, "expired")

    def test_policy_validation(self):
        with self.assertRaises(ValueError):
            SourceFreshnessPolicy(max_stale_age_seconds=100, grace_period_seconds=500)

    def test_serve_policy(self):
        self.assertTrue(may_serve_as_current("fresh", "actual"))
        self.assertTrue(may_serve_as_current("stale", "cached"))
        self.assertFalse(may_serve_as_current("stale", "actual"))  # harus dilabel cached dulu
        self.assertFalse(may_serve_as_current("expired", "actual"))


class _FakeProvider:
    """Provider fixture — memungkinkan mensimulasikan sukses/gagal/malformed."""

    source_id = "sp2kp"

    def __init__(self, mode="success", observations=None):
        self.mode = mode
        self.fetch_calls = 0
        self._observations = observations or []

    @property
    def enabled(self):
        return True

    def fetch(self, query: PriceQuery) -> PriceFetchResult:
        self.fetch_calls += 1
        if self.mode == "timeout":
            from server.services.price_ingestion_service import ProviderFetchError

            raise ProviderFetchError("timeout", "connection timed out")
        if self.mode == "server_error":
            from server.services.price_ingestion_service import ProviderFetchError

            raise ProviderFetchError("server_error", "HTTP 500")
        if self.mode == "malformed":
            # payload 'rusak' => observasi di luar pemetaan (akan ditolak per rekaman)
            return PriceFetchResult(
                source_id=self.source_id,
                observations=[
                    ProviderObservation(
                        source_record_id="BAD-1",
                        commodity_raw="Durian",  # di luar pemetaan => ditolak
                        commodity_id="",
                        price_type="consumer",
                        price_value=1,
                        unit_raw="kg",
                        normalized_price_per_kg=None,
                        region_level="kabupaten",
                        region_code="1375",
                        region_raw="x",
                        observed_at="2026-11-27T08:00:00+07:00",
                        published_at=None,
                        data_status="actual",
                    )
                ],
            )
        return PriceFetchResult(source_id=self.source_id, observations=self._observations)


class _Harness(unittest.TestCase):
    def setUp(self):
        self.repo = InMemoryPriceRepository()
        self.flight = InMemorySingleFlight()
        self.config = PriceIntegrationConfig(sp2kp_enabled=True, ingest_enabled=True)
        self.registry = SourceRegistry(config=self.config)
        self.provider = _FakeProvider()
        self.registry.providers = {"sp2kp": self.provider}  # injeksi fixture

    def _service(self, cooldown=300) -> PriceIngestionService:
        return PriceIngestionService(
            registry=self.registry,
            repository=self.repo,
            ingest_enabled=True,
            single_flight=self.flight,
            failure_cooldown_seconds=cooldown,
        )

    def _query_service(self) -> PriceQueryService:
        return PriceQueryService(registry=self.registry, repository=self.repo)


class TestSingleFlightAndNegativeCache(_Harness):
    def test_concurrent_refresh_single_flight(self):
        service = self._service()
        run_a = service.run_ingest("sp2kp")
        self.assertIn(run_a["status"], ("success", "skipped"))
        # Pegang lock manual (simulasi run pertama masih berjalan), lalu pemanggil kedua:
        self.flight.acquire("sp2kp")
        run_b = service.run_ingest("sp2kp")
        self.assertEqual(run_b["status"], "single_flight_skipped")
        self.assertIsNone(run_b["run_id"])

    def test_provider_failure_not_cached_as_success(self):
        self.provider.mode = "timeout"
        service = self._service()
        result = service.run_ingest("sp2kp")
        self.assertEqual(result["status"], "failed")
        self.assertEqual(result["error_category"], "timeout")
        self.assertIsNone(self.repo.last_success("sp2kp"))
        self.assertIsNotNone(self.repo.last_failure("sp2kp"))

    def test_failure_cooldown_suppresses_retry(self):
        self.provider.mode = "server_error"
        service = self._service(cooldown=300)
        service.run_ingest("sp2kp")
        calls_after_failure = self.provider.fetch_calls
        second = service.run_ingest("sp2kp")
        self.assertEqual(second["status"], "skipped")
        self.assertEqual(self.provider.fetch_calls, calls_after_failure)  # tidak rembes provider
        self.assertIn("FAILURE_COOLDOWN", str(self.repo._runs[-1]["notes"]))

    def test_malformed_payload_rejected_no_partial_ingest(self):
        self.provider.mode = "malformed"
        service = self._service()
        result = service.run_ingest("sp2kp")
        self.assertEqual(result["status"], "success")
        self.assertEqual(result["inserted"], 0)  # rekaman di luar pemetaan ditolak, tanpa duplikat
        self.assertIsNone(self.repo.latest("tomat", "consumer", "kabupaten", "1375", "sp2kp"))


class TestColdWarmCache(_Harness):
    def _store_observation(self, age_hours: float, value: float = 44800.0):
        observed = NOW - timedelta(hours=age_hours)
        run = self.repo.record_ingest_run("sp2kp", "running")
        from server.integrations.base import ProviderObservation

        self.repo.upsert_observations(
            [
                {
                    "source_id": "sp2kp",
                    "source_record_id": "TEST-1",
                    "commodity_id": "cabai_rawit_hijau",
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
                    "observed_at": observed.isoformat(),
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
            ],
            run,
        )
        self.repo.record_ingest_run("sp2kp", "success")

    def test_cold_cache_returns_unavailable(self):
        qs = self._query_service()
        obs = qs.latest("cabai_rawit_hijau", "consumer", "kabupaten", "1375", None, "sp2kp")
        self.assertEqual(obs.data_status, "unavailable")
        self.assertIsNone(obs.price_value)

    def test_warm_fresh_observation(self):
        self._store_observation(age_hours=12)
        obs = self._query_service().latest("cabai_rawit_hijau", "consumer", "kabupaten", "1375", None, "sp2kp")
        self.assertEqual(obs.freshness.state, "fresh")
        self.assertEqual(obs.data_status, "actual")
        self.assertEqual(obs.price_value, 44800.0)

    def test_stale_served_only_labeled_cached(self):
        self._store_observation(age_hours=60)
        obs = self._query_service().latest("cabai_rawit_hijau", "consumer", "kabupaten", "1375", None, "sp2kp")
        self.assertEqual(obs.freshness.state, "stale")
        self.assertEqual(obs.data_status, "cached")  # BUKAN actual
        self.assertFalse(obs.is_live)
        self.assertIn("STALE_OBSERVATION", [w.value for w in obs.warnings])
        self.assertIsNotNone(obs.observed_at)  # timestamp asli tetap tampil

    def test_expired_not_served_as_current(self):
        self._store_observation(age_hours=96)
        obs = self._query_service().latest("cabai_rawit_hijau", "consumer", "kabupaten", "1375", None, "sp2kp")
        self.assertEqual(obs.data_status, "unavailable")
        self.assertIsNone(obs.price_value)
        self.assertIn("STALE_OBSERVATION", [w.value for w in obs.warnings])


class TestCronEndpoint(unittest.TestCase):
    def setUp(self):
        self.client = TestClient(app)
        os.environ.pop("PRICE_CRON_SECRET", None)
        os.environ.pop("PRICE_INGEST_ENABLED", None)

    def tearDown(self):
        self.client.close()
        os.environ.pop("PRICE_CRON_SECRET", None)

    def test_no_secret_configured_rejects_everyone(self):
        res = self.client.post("/api/v1/prices/cron/refresh")
        self.assertEqual(res.status_code, 401)

    def test_wrong_secret_401(self):
        os.environ["PRICE_CRON_SECRET"] = "s3cr3t"
        res = self.client.post("/api/v1/prices/cron/refresh", headers={"X-Price-Cron-Secret": "salah"})
        self.assertEqual(res.status_code, 401)

    def test_rate_limited_after_burst(self):
        os.environ["PRICE_CRON_SECRET"] = "s3cr3t"
        for _ in range(5):
            self.client.post(
                "/api/v1/prices/cron/refresh",
                headers={"X-Price-Cron-Secret": "s3cr3t"},
            )
        res = self.client.post("/api/v1/prices/cron/refresh", headers={"X-Price-Cron-Secret": "s3cr3t"})
        self.assertEqual(res.status_code, 429)

    def test_ingest_disabled_403_even_with_valid_secret(self):
        os.environ["PRICE_CRON_SECRET"] = "s3cr3t"
        res = self.client.post(
            "/api/v1/prices/cron/refresh",
            headers={"X-Price-Cron-Secret": "s3cr3t"},
        )
        self.assertEqual(res.status_code, 403)
        self.assertEqual(res.json()["error"]["code"], "FORBIDDEN")

if __name__ == "__main__":
    unittest.main()
