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
        region_code="1375",
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

    def test_source_metadata_access_unconfirmed(self):
        registry = SourceRegistry(config=PriceIntegrationConfig())
        for meta in registry.all_meta():
            self.assertEqual(meta.access_status, "unconfirmed")
        self.assertEqual(
            registry.meta("sp2kp").url, "https://sp2kp.kemendag.go.id/"
        )
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

    def test_flag_on_but_access_still_unconfirmed(self):
        # Flag ON saja TIDAK cukup: tanpa bukti akses resmi, adapter tetap menolak.
        config = PriceIntegrationConfig(sp2kp_enabled=True)
        provider = Sp2kpPriceProvider(config)
        self.assertTrue(provider.enabled)
        result = provider.fetch(_query())
        self.assertEqual(result.observations, [])
        self.assertIsNotNone(result.access)


if __name__ == "__main__":
    unittest.main()
