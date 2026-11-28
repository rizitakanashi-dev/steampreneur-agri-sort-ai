"""
Tests adapter & gerbang akses (isu #42).

Kunci: saat akses unconfirmed (#38/#39), adapter TIDAK memanggil jaringan dan
TIDAK mengarang nilai — hanya `AccessUnconfirmed`.
"""

import unittest

from server.config.price_config import PriceIntegrationConfig
from server.integrations.base import SourceRegistry
from server.integrations.sipashorti import SipashortiPriceProvider
from server.integrations.sp2kp import Sp2kpPriceProvider
from server.integrations.base import PriceQuery


def _query() -> PriceQuery:
    return PriceQuery(
        commodity_id="cabai_rawit_hijau",
        price_type="consumer",
        region_level="kabupaten",
        region_code="1376",
    )


class TestDisabledByDefault(unittest.TestCase):
    def test_flags_default_off(self):
        config = PriceIntegrationConfig()
        self.assertFalse(config.sp2kp_enabled)
        self.assertFalse(config.sipashorti_enabled)
        self.assertFalse(config.ingest_enabled)

    def test_registry_disabled_without_flags(self):
        registry = SourceRegistry(config=PriceIntegrationConfig())
        self.assertFalse(registry.is_enabled("sp2kp"))
        self.assertFalse(registry.is_enabled("sipashorti"))

    def test_source_metadata_access_status(self):
        # SP2KP: akses RESMI terkonfirmasi via dataset "Tingkat Harga Daerah"
        # (data.go.id, resource XLSX harian publik). SIPASHORTI: tetap unconfirmed
        # (butuh kredensial operator, isu #38).
        registry = SourceRegistry(config=PriceIntegrationConfig())
        self.assertEqual(registry.meta("sp2kp").access_status, "authorized")
        self.assertEqual(registry.meta("sipashorti").access_status, "unconfirmed")
        self.assertIn("data.go.id", registry.meta("sp2kp").url)
        self.assertEqual(
            registry.meta("sipashorti").url,
            "https://11ap.pertanian.go.id/sipashorti/",
        )


class TestAdapterGate(unittest.TestCase):
    def test_sp2kp_disabled_fetch_is_access_unconfirmed(self):
        provider = Sp2kpPriceProvider(PriceIntegrationConfig())
        self.assertFalse(provider.enabled)
        result = provider.fetch(_query())
        self.assertEqual(result.observations, [])
        self.assertIsNotNone(result.access)
        self.assertEqual(result.access.source_id, "sp2kp")
        self.assertIn("belum terkonfirmasi", result.access.reason)

    def test_sp2kp_health_never_fetched(self):
        provider = Sp2kpPriceProvider(PriceIntegrationConfig())
        self.assertEqual(provider.health()["state"], "never_fetched")

    def test_sipashorti_disabled_fetch_is_access_unconfirmed(self):
        provider = SipashortiPriceProvider(PriceIntegrationConfig())
        self.assertFalse(provider.enabled)
        result = provider.fetch(_query())
        self.assertEqual(result.observations, [])
        self.assertIsNotNone(result.access)
        self.assertEqual(result.access.source_id, "sipashorti")

    def test_flag_on_delegates_to_authorized_dataset_importer(self):
        # Akses resmi terkonfirmasi (#39): flag ON => importer dataset resmi berjalan.
        # Test tetap tanpa jaringan lewat injeksi fetch_bytes di level importer.
        from server.integrations.sp2kp_dataset import parse_month_xlsx  # noqa: F401 — keberadaan modul
        config = PriceIntegrationConfig(sp2kp_enabled=True)
        provider = Sp2kpPriceProvider(config)
        self.assertTrue(provider.enabled)
        # Tanpa injeksi transport, provider asli TIDAK boleh dipanggil di test —
        # verifikasi delegasi via tipe health saja.
        self.assertEqual(provider.health()["state"], "enabled_dataset_importer")


if __name__ == "__main__":
    unittest.main()
