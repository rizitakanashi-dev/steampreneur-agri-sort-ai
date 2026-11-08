"""
Unit Tests untuk Layanan Panel Harga BAPANAS (Badan Pangan Nasional RI)
Tanggung Jawab: Fullstack Developer (Backend Testing)
Dokumen Acuan: Proposal STEAMPreneur SMK 2026 (Bab 3.2 & 5.2) & PRD-AGRI-SORT-AI (FR-06)
Zero-dependency test runner menggunakan Python unittest bawaan.
"""

import os
import unittest
from server.services.bapanas_service import BapanasPricingService, bapanas_service


class TestBapanasService(unittest.TestCase):
    def setUp(self):
        self.service = bapanas_service

    def test_get_all_prices_structure(self):
        data = self.service.get_all_prices()
        self.assertIn("source", data)
        self.assertIn("agency", data)
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

    def test_commodity_price_fields(self):
        cmk = self.service.get_commodity_price("cabai merah keriting")
        self.assertIsNotNone(cmk)
        self.assertEqual(cmk["commodity_name"], "Cabai Merah Keriting")
        self.assertEqual(cmk["price_per_kg"], 45000)
        self.assertEqual(cmk["market"], "Pasar Ibuh Payakumbuh")
        self.assertEqual(cmk["region"], "Sumatera Barat")
        self.assertTrue(cmk["is_official"])
        self.assertEqual(cmk["agency"], "Badan Pangan Nasional Republik Indonesia (NFA)")
        self.assertIn("weekly_history", cmk)
        self.assertEqual(len(cmk["weekly_history"]), 4)

    def test_commodity_price_aliases(self):
        # Terung variations
        for alias in ["terung", "Terong", "EGGPLANT", "terung ungu"]:
            res = self.service.get_commodity_price(alias)
            self.assertIsNotNone(res, f"Gagal pada alias terung: {alias}")
            self.assertEqual(res["commodity_name"], "Terung")
            self.assertEqual(res["price_per_kg"], 10000)

        # Tomat variations
        for alias in ["tomat", "TOMAT", "tomato"]:
            res = self.service.get_commodity_price(alias)
            self.assertIsNotNone(res, f"Gagal pada alias tomat: {alias}")
            self.assertEqual(res["commodity_name"], "Tomat")
            self.assertEqual(res["price_per_kg"], 12000)

        # Cabai variations
        cmk_res = self.service.get_commodity_price("Cabai Merah")
        self.assertIsNotNone(cmk_res)
        self.assertEqual(cmk_res["commodity_name"], "Cabai Merah Keriting")

        cr_res = self.service.get_commodity_price("rawit")
        self.assertIsNotNone(cr_res)
        self.assertEqual(cr_res["commodity_name"], "Cabai Rawit Hijau")

    def test_sync_feed(self):
        fresh = self.service.sync_feed(force=True)
        self.assertIsNotNone(fresh)
        self.assertEqual(fresh["sync_status"], "live")
        self.assertIn("commodities", fresh)
        self.assertEqual(fresh["market_center"], "Pasar Ibuh Payakumbuh")

    def test_unknown_commodity_returns_none(self):
        res = self.service.get_commodity_price("buah naga supernova")
        self.assertIsNone(res)
        res_empty = self.service.get_commodity_price("")
        self.assertIsNone(res_empty)
        res_none = self.service.get_commodity_price(None)
        self.assertIsNone(res_none)


if __name__ == "__main__":
    unittest.main()
