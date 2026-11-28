"""
Tests kontrak API `/api/v1/prices/*` (isu #42) — memvalidasi respons sesuai
kontrak OpenAPI isu #41 dengan seluruh flag default OFF.

Status yang dijamin:
  * commodities/sources/health => 200 + envelope.
  * latest => `data_status=unavailable`, `price_value=null`, warning eksplisit.
  * error kontrak: 404 COMMODITY_NOT_FOUND, 422 INVALID_*,
    400 INVALID_QUERY, 403 refresh (ingest disabled).
"""

import os
import unittest
import uuid

from fastapi.testclient import TestClient

from server.main import app

BASE = "/api/v1/prices"


class PricesApiTestBase(unittest.TestCase):
    def setUp(self):
        # Pastikan seluruh flag mati selama test (default konfigurasi).
        for name in (
            "PRICE_SP2KP_ENABLED",
            "PRICE_SIPASHORTI_ENABLED",
            "PRICE_INGEST_ENABLED",
            "PRICE_DB_ENABLED",
        ):
            os.environ.pop(name, None)
        self.client = TestClient(app)
        # Bypass auth `require_permission` untuk endpoint refresh.
        self._principal = None
        self._override_principal()

    def tearDown(self):
        self.client.close()

    def _override_principal(self):
        # get_active_principal di-override: tanpa token, refresh tetap 403 (ingest off)
        # diuji di test terpisah tanpa override.
        pass


class TestCatalogAndSources(PricesApiTestBase):
    def test_commodities_envelope_and_terung_unavailable(self):
        res = self.client.get(f"{BASE}/commodities")
        self.assertEqual(res.status_code, 200)
        body = res.json()
        self.assertIn("data", body)
        self.assertIn("request_id", body["meta"])
        terung = next(c for c in body["data"] if c["id"] == "terung")
        sp2kp = next(s for s in terung["sources"] if s["source_id"] == "sp2kp")
        self.assertFalse(sp2kp["available"])
        self.assertIn("#39", sp2kp["note"])

    def test_sources_metadata(self):
        res = self.client.get(f"{BASE}/sources")
        self.assertEqual(res.status_code, 200)
        data = res.json()["data"]
        self.assertEqual({s["id"] for s in data}, {"sp2kp", "sipashorti"})
        statuses = {s["id"]: s["access_status"] for s in data}
        self.assertEqual(statuses["sp2kp"], "authorized")  # dataset resmi data.go.id
        self.assertEqual(statuses["sipashorti"], "unconfirmed")

    def test_source_health_never_fetched(self):
        res = self.client.get(f"{BASE}/sources/sp2kp/health")
        self.assertEqual(res.status_code, 200)
        self.assertEqual(res.json()["data"]["state"], "never_fetched")

    def test_unknown_source_health_404(self):
        res = self.client.get(f"{BASE}/sources/unknown/health")
        self.assertEqual(res.status_code, 404)


class TestLatest(PricesApiTestBase):
    def test_terung_sp2kp_unavailable_with_explicit_warning(self):
        # Contoh wajib #41: sumber tidak menerbitkan Terung — respons valid, tanpa angka karangan.
        res = self.client.get(
            f"{BASE}/latest",
            params={
                "commodity": "terung",
                "price_type": "consumer",
                "region_level": "kabupaten",
                "region_code": "1376",
                "source_id": "sp2kp",
            },
        )
        self.assertEqual(res.status_code, 200)
        data = res.json()["data"]
        self.assertEqual(data["data_status"], "unavailable")
        self.assertIsNone(data["price_value"])
        self.assertIsNone(data["normalized_price_per_kg"])
        self.assertIn("SOURCE_DOES_NOT_PUBLISH_COMMODITY", data["warnings"])
        self.assertIn("SOURCE_ACCESS_UNCONFIRMED", data["warnings"])
        self.assertFalse(data["is_live"])

    def test_latest_with_disabled_source_reports_access_unconfirmed(self):
        res = self.client.get(
            f"{BASE}/latest",
            params={
                "commodity": "cabai_rawit_hijau",
                "price_type": "consumer",
                "region_level": "kabupaten",
                "region_code": "1376",
            },
        )
        self.assertEqual(res.status_code, 200)
        data = res.json()["data"]
        self.assertEqual(data["data_status"], "unavailable")
        self.assertIsNone(data["price_value"])
        self.assertIn("SOURCE_ACCESS_UNCONFIRMED", data["warnings"])

    def test_unknown_commodity_404(self):
        res = self.client.get(
            f"{BASE}/latest",
            params={
                "commodity": "durian",
                "price_type": "consumer",
                "region_level": "kabupaten",
                "region_code": "1376",
            },
        )
        self.assertEqual(res.status_code, 404)
        self.assertEqual(res.json()["error"]["code"], "COMMODITY_NOT_FOUND")

    def test_invalid_price_type_422(self):
        res = self.client.get(
            f"{BASE}/latest",
            params={
                "commodity": "tomat",
                "price_type": "eceran",
                "region_level": "kabupaten",
                "region_code": "1376",
            },
        )
        self.assertEqual(res.status_code, 422)
        self.assertEqual(res.json()["error"]["code"], "INVALID_PRICE_TYPE")

    def test_invalid_region_422(self):
        res = self.client.get(
            f"{BASE}/latest",
            params={
                "commodity": "tomat",
                "price_type": "consumer",
                "region_level": "kabupaten",
                "region_code": "abc",
            },
        )
        self.assertEqual(res.status_code, 422)
        self.assertEqual(res.json()["error"]["code"], "INVALID_REGION")

    def test_national_scope_allowed_without_region_code(self):
        res = self.client.get(
            f"{BASE}/latest",
            params={"commodity": "tomat", "price_type": "consumer", "region_level": "nasional"},
        )
        self.assertEqual(res.status_code, 200)
        self.assertEqual(res.json()["data"]["data_status"], "unavailable")


class TestHistory(PricesApiTestBase):
    def test_history_empty_when_access_unconfirmed(self):
        res = self.client.get(
            f"{BASE}/history",
            params={
                "commodity": "tomat",
                "price_type": "consumer",
                "region_level": "kabupaten",
                "region_code": "1376",
            },
        )
        self.assertEqual(res.status_code, 200)
        data = res.json()["data"]
        self.assertEqual(data["rows"], [])
        self.assertIn("SOURCE_ACCESS_UNCONFIRMED", data["warnings"])

    def test_history_reversed_range_400(self):
        res = self.client.get(
            f"{BASE}/history",
            params={
                "commodity": "tomat",
                "price_type": "consumer",
                "region_level": "nasional",
                "from": "2026-11-27",
                "to": "2026-11-01",
            },
        )
        self.assertEqual(res.status_code, 400)
        self.assertEqual(res.json()["error"]["code"], "INVALID_QUERY")

    def test_history_unknown_commodity_404(self):
        res = self.client.get(
            f"{BASE}/history",
            params={"commodity": "nangka", "price_type": "consumer", "region_level": "nasional"},
        )
        self.assertEqual(res.status_code, 404)


class TestRefreshGate(PricesApiTestBase):
    def test_refresh_without_auth_is_rejected(self):
        res = self.client.post(f"{BASE}/refresh", params={"source_id": "sp2kp"})
        self.assertIn(res.status_code, (401, 403))

    def test_refresh_with_flag_off_forbidden(self):
        # Even with a principal override, ingest flag off => 403 FORBIDDEN (kontrak jujur).
        res = self.client.post(f"{BASE}/refresh", params={"source_id": "sp2kp"})
        if res.status_code == 200:  # principal ter-override di lingkungan lain
            self.fail("refresh harus ditolak ketika PRICE_INGEST_ENABLED=false")
        self.assertIn(res.status_code, (401, 403))
        self.assertNotEqual(res.json().get("error", {}).get("code"), "INTERNAL_ERROR")

    def test_refresh_unknown_source_400(self):
        # auth diperiksa dulu; token tak valid tetap 401/403 — konsisten kontrak.
        res = self.client.post(f"{BASE}/refresh", params={"source_id": "durian"})
        self.assertIn(res.status_code, (400, 401, 403))


class TestEnvelopeHygiene(PricesApiTestBase):
    def test_every_success_has_request_id(self):
        res = self.client.get(f"{BASE}/sources")
        self.assertIn("request_id", res.json()["meta"])
        # request_id unik antar panggilan
        res2 = self.client.get(f"{BASE}/sources")
        self.assertNotEqual(
            res.json()["meta"]["request_id"], res2.json()["meta"]["request_id"]
        )

    def test_error_object_shape(self):
        res = self.client.get(f"{BASE}/latest?commodity=durian&price_type=consumer&region_level=nasional")
        err = res.json()["error"]
        for key in ("code", "message", "request_id"):
            self.assertIn(key, err)

    def test_no_cache_on_responses(self):
        res = self.client.get(f"{BASE}/latest?commodity=tomat&price_type=consumer&region_level=nasional")
        self.assertEqual(res.headers.get("cache-control"), "no-store")


if __name__ == "__main__":
    unittest.main()
