"""
Unit Tests untuk Layanan Panel Harga SP2KP Kemendag RI (Kementerian Perdagangan)
Tanggung Jawab: Fullstack Developer (Backend Testing)
Dokumen Acuan: Proposal STEAMPreneur SMK 2026 (Bab 3.2 & 5.2) & SP2KP Kemendag RI (https://sp2kp.kemendag.go.id/)
Zero-dependency test runner menggunakan Python unittest bawaan.
"""

import os
import unittest
from server.services.sp2kp_service import Sp2kpPricingService, sp2kp_service


class TestSp2kpService(unittest.TestCase):
    def setUp(self):
        self.service = sp2kp_service

    def test_get_all_prices_structure(self):
        data = self.service.get_all_prices()
        self.assertIn("source", data)
        self.assertIn("agency", data)
        self.assertEqual(data["agency"], "Kementerian Perdagangan Republik Indonesia (Kemendag RI)")
        self.assertIn("portal_url", data)
        self.assertEqual(data["portal_url"], "https://sp2kp.kemendag.go.id/")
        self.assertIn("region", data)
        self.assertEqual(data["region"], "Sumatera Barat")
        self.assertIn("market_center", data)
        self.assertEqual(data["market_center"], "Pasar Ibuh Payakumbuh")
        self.assertIn("commodities", data)

        commodities = data["commodities"]
        self.assertIn("cabai merah keriting", commodities)
        self.assertIn("cabai rawit merah", commodities)
        self.assertIn("cabai rawit hijau", commodities)
        self.assertIn("tomat", commodities)
        self.assertIn("terung", commodities)
        self.assertIn("bawang merah", commodities)

    def test_commodity_price_fields(self):
        cmk = self.service.get_commodity_price("cabai merah keriting")
        self.assertIsNotNone(cmk)
        self.assertEqual(cmk["commodity_name"], "Cabai Merah Keriting")
        self.assertEqual(cmk["price_per_kg"], 44800)
        self.assertEqual(cmk["market"], "Pasar Ibuh Payakumbuh")
        self.assertEqual(cmk["region"], "Sumatera Barat")
        self.assertEqual(cmk["data_status"], "official_sp2kp")
        self.assertIn("weekly_history", cmk)
        self.assertEqual(len(cmk["weekly_history"]), 4)

    def test_commodity_alias_normalization(self):
        # Alias Terung / Terong
        terung = self.service.get_commodity_price("Terong Ungu")
        self.assertIsNotNone(terung)
        self.assertEqual(terung["commodity_name"], "Terung")

        # Alias Tomat
        tomat = self.service.get_commodity_price("tomat merah segar")
        self.assertIsNotNone(tomat)
        self.assertEqual(tomat["commodity_name"], "Tomat")

        # Alias Bawang
        bawang = self.service.get_commodity_price("Bawang Merah Brebes")
        self.assertIsNotNone(bawang)
        self.assertEqual(bawang["commodity_name"], "Bawang Merah")

        # Unknown commodity
        unknown = self.service.get_commodity_price("durian")
        self.assertIsNone(unknown)

    def test_sync_feed(self):
        synced = self.service.sync_feed(force=True)
        self.assertIn("last_synced", synced)
        self.assertIn("sync_status", synced)
        self.assertEqual(synced["sync_status"], "live")

    def test_government_comparison_triangulation(self):
        comp = self.service.get_government_comparison()
        self.assertIn("title", comp)
        self.assertIn("institutions", comp)
        self.assertIn("bapanas", comp["institutions"])
        self.assertIn("kemendag", comp["institutions"])
        self.assertIn("comparison", comp)
        self.assertGreater(len(comp["comparison"]), 0)

        # Periksa salah satu komoditas dalam perbandingan
        first_item = comp["comparison"][0]
        self.assertIn("commodity_name", first_item)
        self.assertIn("composite_fair_price", first_item)
        self.assertIn("disparity_rp", first_item)
        self.assertIn("convergence_index_percent", first_item)
        self.assertGreater(first_item["composite_fair_price"], 0)


if __name__ == "__main__":
    unittest.main()

