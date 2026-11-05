"""
Unit Tests untuk Modul Smart Pricing & Metadata Harga Acuan (Task FS-BE-04)
Zero-dependency test runner menggunakan Python unittest bawaan.
"""

import unittest
from server.services.pricing_service import (
    calculate_economic_projection,
    get_commodity_pricing,
    list_supported_commodities,
    normalize_commodity_key,
)


class TestPricingService(unittest.TestCase):
    def test_normalize_commodity_key(self):
        self.assertEqual(normalize_commodity_key("  tomat  "), "tomat")
        self.assertEqual(normalize_commodity_key("Cabai   Rawit   Hijau"), "cabai rawit hijau")
        self.assertEqual(normalize_commodity_key(""), "")
        self.assertEqual(normalize_commodity_key(None), "")

    def test_get_commodity_pricing_known(self):
        pricing = get_commodity_pricing("Tomat")
        self.assertTrue(pricing["is_known"])
        self.assertEqual(pricing["canonical_name"], "Tomat")
        self.assertEqual(pricing["price_per_kg"], 12000)
        self.assertEqual(pricing["currency"], "IDR")
        self.assertEqual(pricing["region"], "Sumatera Barat")
        self.assertEqual(pricing["data_status"], "simulasi")
        self.assertIn("Simulasi", pricing["price_source"])
        self.assertNotIn("Live BAPANAS API", pricing["price_source"])
        self.assertEqual(len(pricing["price_history"]), 4)

    def test_get_commodity_pricing_case_and_whitespace_tolerant(self):
        variations = ["tomat", "TOMAT", "  tOmAt  ", "Tomat\t"]
        for var in variations:
            pricing = get_commodity_pricing(var)
            self.assertTrue(pricing["is_known"], f"Gagal pada variasi: '{var}'")
            self.assertEqual(pricing["price_per_kg"], 12000)

    def test_get_commodity_pricing_all_five_commodities(self):
        expected = {
            "tomat": 12000,
            "cabai rawit hijau": 30000,
            "cabai merah keriting": 45000,
            "cabai rawit merah": 42000,
            "terung": 10000,
        }
        for name, price in expected.items():
            pricing = get_commodity_pricing(name)
            self.assertTrue(pricing["is_known"])
            self.assertEqual(pricing["price_per_kg"], price)

    def test_get_commodity_pricing_unknown_fallback(self):
        pricing = get_commodity_pricing("Bawang Merah")
        self.assertFalse(pricing["is_known"])
        self.assertEqual(pricing["price_per_kg"], 0)
        self.assertEqual(pricing["data_status"], "tidak_ditemukan")
        self.assertIn("belum memiliki tabel harga", pricing["notes"])

    def test_list_supported_commodities(self):
        commodities = list_supported_commodities()
        self.assertEqual(len(commodities), 5)
        names = [c["canonical_name"] for c in commodities]
        self.assertIn("Tomat", names)
        self.assertIn("Cabai Merah Keriting", names)
        self.assertIn("Cabai Rawit Merah", names)
        self.assertIn("Cabai Rawit Hijau", names)
        self.assertIn("Terung", names)

    def test_calculate_economic_projection_standard(self):
        # 50 kg Tomat, harga 12.000/kg, rasio segar 90% (fresh=9, rotten=1)
        result = calculate_economic_projection(
            commodity_name="Tomat",
            weight_kg=50.0,
            fresh_ratio_percent=90.0,
            rotten_count=1,
            fresh_count=9,
        )

        self.assertEqual(result["commodity"], "Tomat")
        self.assertEqual(result["reference_price_per_kg"], 12000)
        self.assertEqual(result["max_potential_value"], 600000)  # 50 * 12.000
        self.assertEqual(result["estimated_economic_value"], 540000)  # 600.000 * 0.9
        self.assertEqual(result["potential_loss_value"], 60000)  # 600.000 * 0.1
        self.assertIn("Mutu Baik", result["recommendation_note"])
        self.assertIn("pisahkan 1 butir tomat rusak", result["recommendation_note"].lower())

    def test_calculate_economic_projection_no_weight(self):
        # Scan tanpa bobot fisik dari timbangan
        result = calculate_economic_projection(
            commodity_name="Tomat",
            weight_kg=None,
            fresh_ratio_percent=85.0,
            rotten_count=2,
            fresh_count=10,
        )
        self.assertIsNone(result["estimated_economic_value"])
        self.assertIsNone(result["potential_loss_value"])
        self.assertIsNone(result["max_potential_value"])
        self.assertIn("Mutu Baik", result["recommendation_note"])

    def test_calculate_economic_projection_zero_objects(self):
        result = calculate_economic_projection(
            commodity_name="Tomat",
            weight_kg=40.0,
            fresh_ratio_percent=0.0,
            rotten_count=0,
            fresh_count=0,
        )
        self.assertIn("Tidak ada objek sampel", result["recommendation_note"])

    def test_calculate_economic_projection_all_rotten(self):
        result = calculate_economic_projection(
            commodity_name="Tomat",
            weight_kg=25.0,
            fresh_ratio_percent=0.0,
            rotten_count=12,
            fresh_count=0,
        )
        self.assertEqual(result["estimated_economic_value"], 0)
        self.assertEqual(result["potential_loss_value"], 300000)  # 25 * 12000
        self.assertIn("Peringatan Mutu Kritis", result["recommendation_note"])

    def test_calculate_economic_projection_all_fresh(self):
        result = calculate_economic_projection(
            commodity_name="Tomat",
            weight_kg=30.0,
            fresh_ratio_percent=100.0,
            rotten_count=0,
            fresh_count=15,
        )
        self.assertEqual(result["estimated_economic_value"], 360000)  # 30 * 12000
        self.assertEqual(result["potential_loss_value"], 0)
        self.assertIn("Mutu Prima", result["recommendation_note"])

    def test_calculate_economic_projection_ratio_clamping(self):
        # Rasio di luar rentang normal harus diclamp aman antara 0 dan 100
        res_over = calculate_economic_projection(
            commodity_name="Tomat",
            weight_kg=10.0,
            fresh_ratio_percent=150.0,
            rotten_count=0,
            fresh_count=5,
        )
        self.assertEqual(res_over["estimated_economic_value"], 120000)  # max 100%

        res_under = calculate_economic_projection(
            commodity_name="Tomat",
            weight_kg=10.0,
            fresh_ratio_percent=-50.0,
            rotten_count=5,
            fresh_count=0,
        )
        self.assertEqual(res_under["estimated_economic_value"], 0)  # min 0%


    def test_calculate_economic_projection_nan_and_inf_resilience(self):
        # NaN dan Inf tidak boleh menyebabkan crash ValueError / unhandled error
        res_nan = calculate_economic_projection(
            commodity_name="Tomat",
            weight_kg=float("nan"),
            fresh_ratio_percent=float("nan"),
            rotten_count=0,
            fresh_count=0,
        )
        self.assertIsNone(res_nan["estimated_economic_value"])

        res_inf = calculate_economic_projection(
            commodity_name="Tomat",
            weight_kg=float("inf"),
            fresh_ratio_percent=float("inf"),
            rotten_count=0,
            fresh_count=0,
        )
        self.assertIsNone(res_inf["estimated_economic_value"])


if __name__ == "__main__":
    unittest.main()
