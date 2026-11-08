"""
Unit Test Suite untuk Multi-Angle / Multi-Shot Inference Aggregation — Agri-Sort AI Backend
Tanggung Jawab: ML Engineer (Faris Al Farizi) & QA Automation
Dokumen Acuan: docs/rencana-kerja-ml-engineer.md (Bab 8B Poin 1)
"""

from io import BytesIO
import unittest
from fastapi.testclient import TestClient
from PIL import Image

from server.main import app
from server.services.multi_angle_service import aggregate_multi_view_qc


class TestMultiAngleQCAggregation(unittest.TestCase):
    """Pengujian kalkulasi agregasi multi-sudut, weighted defect ratio, dan deteksi oklusi."""

    def test_aggregate_terung_honest_batch(self):
        """Memverifikasi agregasi pada panen seragam (tidak ada bias oklusi tersembunyi)."""
        front_raw = {
            "detection_summary": {
                "total_objects": 10,
                "class_counts": {"extra-class": 4, "class-1": 4, "class-2": 2, "reject": 0},
            }
        }
        back_raw = {
            "detection_summary": {
                "total_objects": 10,
                "class_counts": {"extra-class": 4, "class-1": 3, "class-2": 3, "reject": 0},
            }
        }
        res = aggregate_multi_view_qc(
            front_raw=front_raw,
            back_raw=back_raw,
            commodity="Terung",
            weight_kg=20.0,
            weight_front=0.5,
            weight_back=0.5,
        )

        ratios = res["weighted_condition_ratios"]
        self.assertEqual(ratios["reject_percent"], 0.0)
        self.assertEqual(ratios["extra_class_percent"], 40.0)
        self.assertFalse(res["occlusion_analysis"]["occlusion_bias_detected"])
        self.assertEqual(res["occlusion_analysis"]["occlusion_severity"], "NONE")
        self.assertGreaterEqual(res["occlusion_analysis"]["consistency_index_percent"], 90.0)

    def test_aggregate_terung_hidden_rot_occlusion_bias(self):
        """
        Memverifikasi deteksi Single-View Occlusion Bias saat sisi depan tampak 100% mulus
        namun sisi belakang menyembunyikan 40% buah busuk/reject.
        """
        front_raw = {
            "detection_summary": {
                "total_objects": 10,
                "class_counts": {"extra-class": 6, "class-1": 4, "class-2": 0, "reject": 0},
            }
        }
        back_raw = {
            "detection_summary": {
                "total_objects": 10,
                "class_counts": {"extra-class": 2, "class-1": 2, "class-2": 2, "reject": 4},
            }
        }
        res = aggregate_multi_view_qc(
            front_raw=front_raw,
            back_raw=back_raw,
            commodity="Terung",
            weight_kg=30.0,
            weight_front=0.5,
            weight_back=0.5,
        )

        # Rasio reject rata-rata tertimbang harus (0 + 40) / 2 = 20%
        ratios = res["weighted_condition_ratios"]
        self.assertEqual(ratios["reject_percent"], 20.0)

        # Analisis oklusi harus memicu peringatan bias
        occlusion = res["occlusion_analysis"]
        self.assertTrue(occlusion["occlusion_bias_detected"])
        self.assertIn(occlusion["occlusion_severity"], ["MODERATE", "HIGH"])
        self.assertIsNotNone(occlusion["warning_message"])
        self.assertGreater(occlusion["defect_delta_percent"], 15.0)

    def test_aggregate_custom_view_weights(self):
        """Memverifikasi penerapan bobot kustom sudut pandang (misal 0.70 depan, 0.30 belakang)."""
        front_raw = {
            "detection_summary": {
                "total_objects": 10,
                "class_counts": {"fresh-tomato": 10, "rotten-tomato": 0},
            }
        }
        back_raw = {
            "detection_summary": {
                "total_objects": 10,
                "class_counts": {"fresh-tomato": 0, "rotten-tomato": 10},
            }
        }
        res = aggregate_multi_view_qc(
            front_raw=front_raw,
            back_raw=back_raw,
            commodity="Tomat",
            weight_kg=10.0,
            weight_front=0.70,
            weight_back=0.30,
        )

        ratios = res["weighted_condition_ratios"]
        self.assertAlmostEqual(ratios["fresh_ratio_percent"], 70.0, places=1)
        self.assertAlmostEqual(ratios["rotten_ratio_percent"], 30.0, places=1)


class TestMultiAngleEndpointAPI(unittest.TestCase):
    """Pengujian integrasi endpoint FastAPI POST /api/v1/qc/scan-multi."""

    def setUp(self):
        self.client = TestClient(app)

        # Siapkan 2 gambar dummy JPEG valid
        img_f = Image.new("RGB", (320, 240), color="purple")
        buf_f = BytesIO()
        img_f.save(buf_f, format="JPEG")
        self.front_bytes = buf_f.getvalue()

        img_b = Image.new("RGB", (320, 240), color="darkviolet")
        buf_b = BytesIO()
        img_b.save(buf_b, format="JPEG")
        self.back_bytes = buf_b.getvalue()

    def test_scan_multi_endpoint_success_mock(self):
        """Memverifikasi pemanggilan sukses endpoint /api/v1/qc/scan-multi (mode mock)."""
        response = self.client.post(
            "/api/v1/qc/scan-multi",
            files={
                "image_front": ("front.jpg", self.front_bytes, "image/jpeg"),
                "image_back": ("back.jpg", self.back_bytes, "image/jpeg"),
            },
            data={
                "commodity": "Terung",
                "weight_kg": "25.0",
                "confidence_threshold": "0.30",
                "weight_front": "0.50",
                "weight_back": "0.50",
                "mode": "mock",
            },
        )
        self.assertEqual(response.status_code, 200)
        data = response.json().get("data", {})
        self.assertTrue(data["scan_id"].startswith("scan_multi_"))
        self.assertEqual(data["inspection_mode"], "multi_angle_dual_shot")
        self.assertIn("front_view", data)
        self.assertIn("back_view", data)
        self.assertIn("multi_angle_aggregation", data)
        self.assertIn("business_grading", data)
        self.assertIn("smart_pricing", data)

    def test_scan_multi_missing_second_image_fails(self):
        """Memastikan request tanpa foto kedua ditolak oleh skema FastAPI."""
        response = self.client.post(
            "/api/v1/qc/scan-multi",
            files={
                "image_front": ("front.jpg", self.front_bytes, "image/jpeg"),
            },
            data={"commodity": "Terung"},
        )
        self.assertEqual(response.status_code, 422)

    def test_scan_multi_invalid_weight_parameter(self):
        """Memastikan bobot negatif memicu respons HTTP 400."""
        response = self.client.post(
            "/api/v1/qc/scan-multi",
            files={
                "image_front": ("front.jpg", self.front_bytes, "image/jpeg"),
                "image_back": ("back.jpg", self.back_bytes, "image/jpeg"),
            },
            data={"commodity": "Terung", "weight_kg": "-10.0"},
        )
        self.assertEqual(response.status_code, 400)
        body = response.json()
        self.assertEqual(body["error"]["code"], "INVALID_WEIGHT_VALUE")


if __name__ == "__main__":
    unittest.main()
