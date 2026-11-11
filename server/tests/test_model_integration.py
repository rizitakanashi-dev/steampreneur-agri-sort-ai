"""
Unit Tests untuk Integrasi Model Terung 4-Kelas & Business Grading (Task FS-02 & FS-04)
Zero-dependency test runner menggunakan Python unittest bawaan.
"""

import json
import math
import os
import unittest

from server.services.pricing_service import calculate_business_grading


class TestModelIntegrationAndBusinessGrading(unittest.TestCase):
    def test_model_artifacts_presence(self):
        """Memverifikasi artefak model Terung 4-kelas lengkap di server/models/terung/ (Task FS-02)"""
        base_dir = os.path.join(os.path.dirname(__file__), "..", "models", "terung")
        self.assertTrue(os.path.isdir(base_dir), "Direktori server/models/terung harus ada")

        onnx_file = os.path.join(base_dir, "best.onnx")
        self.assertTrue(os.path.isfile(onnx_file), "best.onnx harus ada")
        self.assertGreater(os.path.getsize(onnx_file), 1_000_000, "best.onnx harus > 1MB")

        pt_file = os.path.join(base_dir, "best.pt")
        self.assertTrue(os.path.isfile(pt_file), "best.pt harus ada")
        self.assertGreater(os.path.getsize(pt_file), 1_000_000, "best.pt harus > 1MB")

        yaml_file = os.path.join(base_dir, "data.yaml")
        self.assertTrue(os.path.isfile(yaml_file), "data.yaml harus ada")
        with open(yaml_file, "r") as f:
            content = f.read()
            self.assertIn("Reject", content)
            has_3grade = "Grade A" in content and "Grade B" in content
            has_4class = "Class I" in content and "Class II" in content
            self.assertTrue(has_3grade or has_4class, "data.yaml harus memuat kelas mutu terung yang valid")

        meta_file = os.path.join(base_dir, "model-metadata.json")
        self.assertTrue(os.path.isfile(meta_file), "model-metadata.json harus ada")
        with open(meta_file, "r") as f:
            meta = json.load(f)
            self.assertEqual(meta["model"]["name"], "Agri-Sort Eggplant Quality Detection")
            classes_vals = list(meta["dataset"]["classes"].values())
            if "Grade A" in classes_vals:
                self.assertIn("Grade A", classes_vals)
                self.assertIn("Grade B", classes_vals)
                self.assertIn("Reject", classes_vals)
            else:
                self.assertEqual(meta["dataset"]["classes"]["0"], "Class I")
                self.assertEqual(meta["dataset"]["classes"]["1"], "Class II")
                self.assertEqual(meta["dataset"]["classes"]["2"], "Extra Class")
                self.assertEqual(meta["dataset"]["classes"]["3"], "Reject")

    def test_calculate_business_grading_terung(self):
        """Memverifikasi formula pemetaan grade Terung Faris (Task FS-04 & Bab 3.2)"""
        ratios = {
            "extra_class_percent": 41.67,
            "class_1_percent": 33.33,
            "class_2_percent": 16.67,
            "reject_percent": 8.33,
        }
        res = calculate_business_grading(commodity="Terung", weight_kg=45.0, ratios=ratios)

        self.assertEqual(
            res["preliminary_mapping_rule"],
            "Extra Class & Class I -> Grade A, Class II -> Grade B, Reject -> Reject",
        )
        gb = res["grade_breakdown"]
        self.assertEqual(gb["grade_a_percent"], 75.0)  # 41.67 + 33.33
        self.assertEqual(gb["grade_b_percent"], 16.67)
        self.assertEqual(gb["reject_percent"], 8.33)

        ew = res["estimated_weights_kg"]
        self.assertEqual(ew["grade_a_kg"], 33.75)  # 45.0 * 0.75
        self.assertEqual(ew["grade_b_kg"], 7.5)   # 45.0 * 0.1667 -> 7.50
        self.assertEqual(ew["reject_kg"], 3.75)   # 45.0 * 0.0833 -> 3.75

    def test_calculate_business_grading_terung_3grade(self):
        """Memverifikasi formula pemetaan 3-Grade langsung Terung v2"""
        ratios = {
            "grade_a_percent": 65.0,
            "grade_b_percent": 25.0,
            "reject_percent": 10.0,
        }
        res = calculate_business_grading(commodity="Terung", weight_kg=50.0, ratios=ratios)

        self.assertEqual(
            res["preliminary_mapping_rule"],
            "Grade A -> Grade A, Grade B -> Grade B, Reject -> Reject",
        )
        self.assertEqual(res["grade_breakdown"]["grade_a_percent"], 65.0)
        self.assertEqual(res["grade_breakdown"]["grade_b_percent"], 25.0)
        self.assertEqual(res["grade_breakdown"]["reject_percent"], 10.0)
        self.assertEqual(res["estimated_weights_kg"]["grade_a_kg"], 32.5)
        self.assertEqual(res["estimated_weights_kg"]["grade_b_kg"], 12.5)
        self.assertEqual(res["estimated_weights_kg"]["reject_kg"], 5.0)

    def test_calculate_business_grading_tomat(self):
        """Memverifikasi formula pemetaan grade Tomat 2-Class"""
        ratios = {
            "fresh_ratio_percent": 80.0,
            "rotten_ratio_percent": 20.0,
        }
        res = calculate_business_grading(commodity="Tomat", weight_kg=100.0, ratios=ratios)

        self.assertEqual(
            res["preliminary_mapping_rule"],
            "Fresh Tomato -> Grade A, Rotten Tomato -> Reject",
        )
        gb = res["grade_breakdown"]
        self.assertEqual(gb["grade_a_percent"], 80.0)
        self.assertEqual(gb["grade_b_percent"], 0.0)
        self.assertEqual(gb["reject_percent"], 20.0)

        ew = res["estimated_weights_kg"]
        self.assertEqual(ew["grade_a_kg"], 80.0)
        self.assertEqual(ew["grade_b_kg"], 0.0)
        self.assertEqual(ew["reject_kg"], 20.0)

    def test_calculate_business_grading_edge_cases(self):
        """Memverifikasi ketahanan matematis terhadap None/invalid weight dan empty ratios"""
        # Bobot None
        res_none_weight = calculate_business_grading(commodity="Terung", weight_kg=None, ratios={})
        self.assertIsNone(res_none_weight["estimated_weights_kg"]["grade_a_kg"])
        self.assertEqual(res_none_weight["grade_breakdown"]["grade_a_percent"], 0.0)

        # Bobot negatif / NaN
        res_nan = calculate_business_grading(commodity="Terung", weight_kg=float("nan"), ratios={})
        self.assertIsNone(res_nan["estimated_weights_kg"]["grade_a_kg"])


if __name__ == "__main__":
    unittest.main()

