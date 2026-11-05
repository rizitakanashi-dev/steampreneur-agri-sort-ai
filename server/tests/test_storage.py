"""
Unit Tests untuk Lapisan Persistensi Riwayat Scan (Task FS-BE-05)
Zero-dependency test runner menggunakan Python unittest bawaan dan temporary files.
"""

from pathlib import Path
import shutil
import tempfile
import unittest

from server.services.storage_service import LocalScanStorage, get_supabase_ddl


class TestStorageService(unittest.TestCase):
    def setUp(self):
        # Buat temporary directory untuk isolasi file storage setiap test run
        self.test_dir = tempfile.mkdtemp()
        self.storage_file = Path(self.test_dir) / "test_scans.json"
        self.storage = LocalScanStorage(file_path=self.storage_file)

    def tearDown(self):
        # Bersihkan direktori temporary
        shutil.rmtree(self.test_dir, ignore_errors=True)

    def test_save_and_retrieve_scan(self):
        payload = {
            "scan_id": "scan_test_001",
            "commodity": "Tomat",
            "actual_weight_kg": 50.0,
            "inference_result": {
                "model_version": "2026.11.02",
                "object_counts": {"total": 12, "fresh_tomato": 10, "rotten_tomato": 2},
                "condition_ratios": {"fresh_ratio_percent": 83.33, "rotten_ratio_percent": 16.67},
            },
            "smart_pricing": {
                "reference_price_per_kg": 12000,
                "estimated_economic_value": 500000,
                "potential_loss_value": 100000,
                "recommendation_note": "Mutu Baik",
            },
        }

        saved = self.storage.save_scan(payload)
        self.assertEqual(saved["scan_id"], "scan_test_001")
        self.assertEqual(saved["commodity"], "Tomat")
        self.assertEqual(saved["total_objects"], 12)
        self.assertEqual(saved["fresh_count"], 10)
        self.assertEqual(saved["rotten_count"], 2)
        self.assertEqual(saved["estimated_economic_value"], 500000)

        # Ambil kembali dari storage
        fetched = self.storage.get_scan_by_id("scan_test_001")
        self.assertIsNotNone(fetched)
        self.assertEqual(fetched["scan_id"], "scan_test_001")

    def test_get_scans_pagination_and_summary(self):
        for i in range(5):
            self.storage.save_scan(
                {
                    "scan_id": f"scan_{i}",
                    "commodity": "Tomat",
                    "actual_weight_kg": 10.0,
                    "estimated_economic_value": 120000,
                }
            )

        # Test limit
        paged = self.storage.get_scans(limit=2, offset=0)
        self.assertEqual(paged["total_count"], 5)
        self.assertEqual(len(paged["records"]), 2)
        self.assertEqual(paged["summary"]["total_weight_kg"], 50.0)
        self.assertEqual(paged["summary"]["total_economic_value_idr"], 600000)

        # Test offset
        paged_offset = self.storage.get_scans(limit=2, offset=4)
        self.assertEqual(len(paged_offset["records"]), 1)

    def test_commodity_filter(self):
        self.storage.save_scan({"scan_id": "s1", "commodity": "Tomat"})
        self.storage.save_scan({"scan_id": "s2", "commodity": "Cabai Rawit Hijau"})
        self.storage.save_scan({"scan_id": "s3", "commodity": "Tomat"})

        filtered = self.storage.get_scans(commodity="Tomat")
        self.assertEqual(filtered["total_count"], 2)
        for r in filtered["records"]:
            self.assertEqual(r["commodity"], "Tomat")

    def test_delete_scan(self):
        self.storage.save_scan({"scan_id": "to_delete", "commodity": "Tomat"})
        self.assertIsNotNone(self.storage.get_scan_by_id("to_delete"))

        # Hapus
        deleted = self.storage.delete_scan("to_delete")
        self.assertTrue(deleted)
        self.assertIsNone(self.storage.get_scan_by_id("to_delete"))

        # Hapus yang tidak ada
        self.assertFalse(self.storage.delete_scan("non_existent"))

    def test_clear_all_scans(self):
        self.storage.save_scan({"scan_id": "s1", "commodity": "Tomat"})
        self.storage.save_scan({"scan_id": "s2", "commodity": "Terung"})

        count = self.storage.clear_scans()
        self.assertEqual(count, 2)
        self.assertEqual(self.storage.get_scans()["total_count"], 0)

    def test_corrupted_json_resilience(self):
        # Tulis data korup ke file storage
        self.storage_file.parent.mkdir(parents=True, exist_ok=True)
        with open(self.storage_file, "w", encoding="utf-8") as f:
            f.write("{!!CORRUPTED JSON CONTENT NOT AN ARRAY##")

        # Harus mengembalikan list kosong tanpa crash
        scans = self.storage.get_scans()
        self.assertEqual(scans["total_count"], 0)
        self.assertEqual(scans["records"], [])

    def test_supabase_ddl_structure(self):
        ddl = get_supabase_ddl()
        self.assertIn("CREATE TABLE IF NOT EXISTS public.scans", ddl)
        self.assertIn("ENABLE ROW LEVEL SECURITY", ddl)
        self.assertIn("idx_scans_commodity", ddl)
        self.assertIn("idx_scans_created_at", ddl)


    def test_save_scan_numerical_sanitization(self):
        # NaN dan Inf bobot serta rasio harus dinormalisasi aman
        payload = {
            "scan_id": "scan_nan_test",
            "commodity": "Tomat",
            "actual_weight_kg": float("nan"),
            "fresh_ratio_percent": float("nan"),
        }
        saved = self.storage.save_scan(payload)
        self.assertIsNone(saved["actual_weight_kg"])
        self.assertEqual(saved["fresh_ratio_percent"], 0.0)
        self.assertEqual(saved["rotten_ratio_percent"], 100.0)


if __name__ == "__main__":
    unittest.main()
