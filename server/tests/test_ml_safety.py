"""
ML Safety Remediation Test Suite — Agri-Sort AI Backend
Memverifikasi kepatuhan terhadap P0 ML Safety & Grading Rubric Validation:
1. Terung inference sukses -> status 'ai_detected'
2. Terung low confidence / blur / anomaly -> status 'needs_review'
3. Tomat inference sukses -> status 'ai_detected'
4. Tomat model unavailable -> status 'model_unavailable' (tanpa fallback mock diam-diam)
5. Cabai Rawit Hijau -> status 'unsupported' (ai_supported=False, inference_result=None)
6. Explicit simulation -> status 'simulated' (mode="mock")
7. Exception saat inference -> error ditangani elegan, status 'model_unavailable' (bukan mock)
10. Multi-angle scan status combinations
"""

from io import BytesIO
import unittest
from unittest.mock import patch
from fastapi.testclient import TestClient
from PIL import Image

from server.main import app


def _create_test_image_bytes(color=(120, 180, 70), size=(640, 640)) -> bytes:
    buf = BytesIO()
    img = Image.new("RGB", size, color=color)
    img.save(buf, format="JPEG")
    return buf.getvalue()


def _mock_terung_inference_result(confidence=0.88):
    return {
        "contract_version": "1.2.0",
        "model_name": "agri-sort-terung-yolo11n",
        "model_version": "1.0.0",
        "runtime_engine": "onnxruntime",
        "commodity": "terung",
        "inference_time_ms": 42.0,
        "image_dimensions": {"width": 640, "height": 640},
        "detections": [
            {
                "id": 1,
                "class_id": 0,
                "class_name": "extra-class",
                "class_slug": "extra_class",
                "confidence": confidence,
                "box": {"x1": 50, "y1": 50, "x2": 200, "y2": 200},
            },
            {
                "id": 2,
                "class_id": 1,
                "class_name": "class-1",
                "class_slug": "class_1",
                "confidence": confidence - 0.05,
                "box": {"x1": 220, "y1": 50, "x2": 400, "y2": 200},
            },
        ],
        "detection_summary": {
            "total_objects": 2,
            "class_counts": {
                "extra-class": 1,
                "extra_class": 1,
                "class-1": 1,
                "class_1": 1,
                "class-2": 0,
                "class_2": 0,
                "reject": 0,
            },
            "runtime_engine": "onnxruntime",
            "slicing_applied": False,
            "dense_box_suppressed": False,
            "tiles_processed": 1,
            "disambiguated_count": 0,
        },
    }


def _mock_tomat_inference_result(confidence=0.91):
    return {
        "contract_version": "1.2.0",
        "model_name": "agri-sort-tomat-yolo11n",
        "model_version": "1.0.0",
        "runtime_engine": "onnxruntime",
        "commodity": "tomat",
        "inference_time_ms": 38.0,
        "image_dimensions": {"width": 640, "height": 640},
        "detections": [
            {
                "id": 1,
                "class_id": 0,
                "class_name": "fresh_tomato",
                "class_slug": "fresh_tomato",
                "confidence": confidence,
                "box": {"x1": 60, "y1": 60, "x2": 180, "y2": 180},
            },
            {
                "id": 2,
                "class_id": 1,
                "class_name": "rotten_tomato",
                "class_slug": "rotten_tomato",
                "confidence": confidence - 0.04,
                "box": {"x1": 200, "y1": 60, "x2": 320, "y2": 180},
            },
        ],
        "detection_summary": {
            "total_objects": 2,
            "class_counts": {
                "fresh_tomato": 1,
                "rotten_tomato": 1,
            },
            "runtime_engine": "onnxruntime",
            "slicing_applied": False,
            "dense_box_suppressed": False,
            "tiles_processed": 1,
            "disambiguated_count": 0,
        },
    }


class TestMLSafetyRemediation(unittest.TestCase):
    def setUp(self):
        self.client = TestClient(app)
        self.img_bytes = _create_test_image_bytes()

    # Skenario 1: Terung dengan inference sukses -> 'ai_detected'
    @patch("server.routers.qc.ai_engine")
    @patch("server.routers.qc.analyze_image_quality")
    def test_scenario_1_terung_inference_success(self, mock_quality, mock_engine):
        mock_quality.return_value = {"is_blurry": False, "is_overexposed": False, "is_underexposed": False, "is_acceptable": True}
        mock_engine.is_available.return_value = True
        mock_engine.predict.return_value = _mock_terung_inference_result(confidence=0.88)

        response = self.client.post(
            "/api/v1/qc/scan",
            files={"image": ("test.jpg", self.img_bytes, "image/jpeg")},
            data={"commodity": "Terung", "confidence_threshold": "0.30"},
        )
        self.assertEqual(response.status_code, 200)
        data = response.json()["data"]
        self.assertEqual(data["execution_status"], "ai_detected")
        self.assertEqual(data["status_details"]["code"], "AI_INFERENCE_OPTIMAL")
        self.assertTrue(data["status_details"]["is_ai_generated"])
        self.assertFalse(data["status_details"]["requires_human_confirmation"])
        self.assertIsNotNone(data["inference_result"])

    # Skenario 2: Terung dengan low confidence / blur -> 'needs_review'
    @patch("server.routers.qc.ai_engine")
    @patch("server.routers.qc.analyze_image_quality")
    def test_scenario_2_terung_low_confidence_or_blur(self, mock_quality, mock_engine):
        # Case A: Gambar buram
        mock_quality.return_value = {"is_blurry": True, "is_overexposed": False, "is_underexposed": False, "is_acceptable": False}
        mock_engine.is_available.return_value = True
        mock_engine.predict.return_value = _mock_terung_inference_result(confidence=0.85)

        resp = self.client.post(
            "/api/v1/qc/scan",
            files={"image": ("test.jpg", self.img_bytes, "image/jpeg")},
            data={"commodity": "Terung"},
        )
        self.assertEqual(resp.status_code, 200)
        data = resp.json()["data"]
        self.assertEqual(data["execution_status"], "needs_review")
        self.assertEqual(data["status_details"]["code"], "IMAGE_BLURRY")
        self.assertTrue(data["status_details"]["requires_human_confirmation"])

        # Case B: Confidence rendah (< 0.45)
        mock_quality.return_value = {"is_blurry": False, "is_overexposed": False, "is_underexposed": False, "is_acceptable": True}
        mock_engine.predict.return_value = _mock_terung_inference_result(confidence=0.38)

        resp = self.client.post(
            "/api/v1/qc/scan",
            files={"image": ("test.jpg", self.img_bytes, "image/jpeg")},
            data={"commodity": "Terung"},
        )
        self.assertEqual(resp.status_code, 200)
        data = resp.json()["data"]
        self.assertEqual(data["execution_status"], "needs_review")
        self.assertEqual(data["status_details"]["code"], "LOW_CONFIDENCE_SCORE")

    # Skenario 3: Tomat dengan inference sukses -> 'ai_detected'
    @patch("server.routers.qc.ai_engine")
    @patch("server.routers.qc.analyze_image_quality")
    def test_scenario_3_tomat_inference_success(self, mock_quality, mock_engine):
        mock_quality.return_value = {"is_blurry": False, "is_overexposed": False, "is_underexposed": False, "is_acceptable": True}
        mock_engine.is_available.return_value = True
        mock_engine.predict.return_value = _mock_tomat_inference_result(confidence=0.91)

        resp = self.client.post(
            "/api/v1/qc/scan",
            files={"image": ("test.jpg", self.img_bytes, "image/jpeg")},
            data={"commodity": "Tomat", "confidence_threshold": "0.35"},
        )
        self.assertEqual(resp.status_code, 200)
        data = resp.json()["data"]
        self.assertEqual(data["execution_status"], "ai_detected")
        self.assertEqual(data["status_details"]["code"], "AI_INFERENCE_OPTIMAL")
        self.assertTrue(data["status_details"]["is_ai_generated"])
        self.assertIsNotNone(data["inference_result"])

    # Skenario 4: Tomat dengan model unavailable -> 'model_unavailable' (tanpa fallback mock)
    @patch("server.routers.qc.ai_engine")
    def test_scenario_4_tomat_model_unavailable_no_silent_mock(self, mock_engine):
        mock_engine.is_available.return_value = False

        resp = self.client.post(
            "/api/v1/qc/scan",
            files={"image": ("test.jpg", self.img_bytes, "image/jpeg")},
            data={"commodity": "Tomat"},
        )
        self.assertEqual(resp.status_code, 200)
        data = resp.json()["data"]
        self.assertEqual(data["execution_status"], "model_unavailable")
        self.assertEqual(data["status_details"]["code"], "RUNTIME_UNAVAILABLE")
        self.assertFalse(data["status_details"]["is_ai_generated"])
        self.assertTrue(data["status_details"]["requires_human_confirmation"])
        # Verifikasi MUTLAK: inference_result harus None, TIDAK boleh ada 12 mock boxes!
        self.assertIsNone(data["inference_result"])

    # Skenario 5: Cabai Rawit Hijau -> 'unsupported' (ai_supported=False, inference_result=None)
    def test_scenario_5_cabai_rawit_hijau_unsupported(self):
        resp = self.client.post(
            "/api/v1/qc/scan",
            files={"image": ("test.jpg", self.img_bytes, "image/jpeg")},
            data={"commodity": "Cabai Rawit Hijau"},
        )
        self.assertEqual(resp.status_code, 200)
        data = resp.json()["data"]
        self.assertEqual(data["execution_status"], "unsupported")
        self.assertEqual(data["status_details"]["code"], "COMMODITY_UNSUPPORTED")
        self.assertFalse(data["status_details"]["is_ai_generated"])
        self.assertTrue(data["status_details"]["requires_human_confirmation"])
        self.assertFalse(data["ai_supported"])
        self.assertIsNone(data["inference_result"])

    # Skenario 6: Explicit simulation -> 'simulated' (mode="mock")
    def test_scenario_6_explicit_simulation(self):
        resp = self.client.post(
            "/api/v1/qc/scan",
            files={"image": ("test.jpg", self.img_bytes, "image/jpeg")},
            data={"commodity": "Terung", "mode": "mock"},
        )
        self.assertEqual(resp.status_code, 200)
        data = resp.json()["data"]
        self.assertEqual(data["execution_status"], "simulated")
        self.assertEqual(data["status_details"]["code"], "EXPLICIT_SIMULATION")
        self.assertFalse(data["status_details"]["is_ai_generated"])
        self.assertTrue(data["status_details"]["requires_human_confirmation"])
        self.assertTrue(data["is_simulated"])

    # Skenario 7: Exception saat inference -> logged, tidak crash, status 'model_unavailable'
    @patch("server.routers.qc.ai_engine")
    @patch("server.routers.qc.analyze_image_quality")
    def test_scenario_7_inference_exception_handled_safely(self, mock_quality, mock_engine):
        mock_quality.return_value = {"is_blurry": False, "is_overexposed": False, "is_underexposed": False, "is_acceptable": True}
        mock_engine.is_available.return_value = True
        mock_engine.predict.side_effect = RuntimeError("CUDA/ONNX engine crash simulation")

        resp = self.client.post(
            "/api/v1/qc/scan",
            files={"image": ("test.jpg", self.img_bytes, "image/jpeg")},
            data={"commodity": "Terung"},
        )
        self.assertEqual(resp.status_code, 200)
        data = resp.json()["data"]
        self.assertEqual(data["execution_status"], "model_unavailable")
        self.assertEqual(data["status_details"]["code"], "INFERENCE_EXECUTION_FAILED")
        self.assertFalse(data["status_details"]["is_ai_generated"])
        # Tidak crash dan tidak membuat prediksi sintetis
        self.assertIsNone(data["inference_result"])

    # Skenario 10: Multi-angle scan status combinations
    def test_scenario_10_multi_angle_unsupported(self):
        """Cabai Rawit Hijau pada multi-scan -> 'unsupported'."""
        resp = self.client.post(
            "/api/v1/qc/scan-multi",
            files={
                "image_front": ("f.jpg", self.img_bytes, "image/jpeg"),
                "image_back": ("b.jpg", self.img_bytes, "image/jpeg"),
            },
            data={"commodity": "Cabai Rawit Hijau"},
        )
        self.assertEqual(resp.status_code, 200)
        data = resp.json()["data"]
        self.assertEqual(data["execution_status"], "unsupported")
        self.assertFalse(data["status_details"]["is_ai_generated"])

    @patch("server.routers.qc.ai_engine")
    def test_scenario_10_multi_angle_model_unavailable(self, mock_engine):
        """Model tidak tersedia pada multi-scan -> 'model_unavailable'."""
        mock_engine.is_available.return_value = False
        resp = self.client.post(
            "/api/v1/qc/scan-multi",
            files={
                "image_front": ("f.jpg", self.img_bytes, "image/jpeg"),
                "image_back": ("b.jpg", self.img_bytes, "image/jpeg"),
            },
            data={"commodity": "Terung"},
        )
        self.assertEqual(resp.status_code, 200)
        data = resp.json()["data"]
        self.assertEqual(data["execution_status"], "model_unavailable")

    def test_scenario_10_multi_angle_explicit_simulation(self):
        """Mode simulasi eksplisit -> 'simulated'."""
        resp = self.client.post(
            "/api/v1/qc/scan-multi",
            files={
                "image_front": ("f.jpg", self.img_bytes, "image/jpeg"),
                "image_back": ("b.jpg", self.img_bytes, "image/jpeg"),
            },
            data={"commodity": "Terung", "mode": "mock"},
        )
        self.assertEqual(resp.status_code, 200)
        data = resp.json()["data"]
        self.assertEqual(data["execution_status"], "simulated")

    @patch("server.routers.qc.ai_engine")
    @patch("server.routers.qc.analyze_image_quality")
    def test_scenario_10_multi_angle_partial_failure_degrades_to_needs_review(self, mock_quality, mock_engine):
        """Satu sudut berhasil dan satu sudut gagal -> degrades to 'needs_review' (bukan model_unavailable)."""
        mock_quality.return_value = {"is_blurry": False, "is_overexposed": False, "is_underexposed": False, "is_acceptable": True}
        mock_engine.is_available.return_value = True

        # Sisi depan sukses, sisi belakang crash
        mock_engine.predict.side_effect = [
            _mock_terung_inference_result(confidence=0.85),
            RuntimeError("Back angle camera decode failed"),
        ]

        resp = self.client.post(
            "/api/v1/qc/scan-multi",
            files={
                "image_front": ("f.jpg", self.img_bytes, "image/jpeg"),
                "image_back": ("b.jpg", self.img_bytes, "image/jpeg"),
            },
            data={"commodity": "Terung"},
        )
        self.assertEqual(resp.status_code, 200)
        data = resp.json()["data"]
        self.assertEqual(data["execution_status"], "needs_review")
        self.assertEqual(data["status_details"]["code"], "PARTIAL_ANGLE_INFERENCE")
        self.assertTrue(data["status_details"]["requires_human_confirmation"])
        # Sisi depan tetap memiliki data deteksi
        self.assertGreater(len(data["front_view"]["detections"]), 0)

    @patch("server.routers.qc.ai_engine")
    @patch("server.routers.qc.analyze_image_quality")
    def test_scenario_10_multi_angle_one_angle_blurry(self, mock_quality, mock_engine):
        """Salah satu foto sudut buram -> 'needs_review'."""
        # Depan jernih, belakang buram
        mock_quality.side_effect = [
            {"is_blurry": False, "is_overexposed": False, "is_underexposed": False, "is_acceptable": True},
            {"is_blurry": True, "is_overexposed": False, "is_underexposed": False, "is_acceptable": False},
        ]
        mock_engine.is_available.return_value = True
        mock_engine.predict.side_effect = [
            _mock_terung_inference_result(confidence=0.88),
            _mock_terung_inference_result(confidence=0.82),
        ]

        resp = self.client.post(
            "/api/v1/qc/scan-multi",
            files={
                "image_front": ("f.jpg", self.img_bytes, "image/jpeg"),
                "image_back": ("b.jpg", self.img_bytes, "image/jpeg"),
            },
            data={"commodity": "Terung"},
        )
        self.assertEqual(resp.status_code, 200)
        data = resp.json()["data"]
        self.assertEqual(data["execution_status"], "needs_review")
        self.assertEqual(data["status_details"]["code"], "IMAGE_BLURRY")

    @patch("server.routers.qc.ai_engine")
    @patch("server.routers.qc.analyze_image_quality")
    def test_scenario_10_multi_angle_both_optimal(self, mock_quality, mock_engine):
        """Kedua sudut berhasil dan konsisten -> 'ai_detected'."""
        mock_quality.return_value = {"is_blurry": False, "is_overexposed": False, "is_underexposed": False, "is_acceptable": True}
        mock_engine.is_available.return_value = True
        mock_engine.predict.side_effect = [
            _mock_terung_inference_result(confidence=0.88),
            _mock_terung_inference_result(confidence=0.86),
        ]

        resp = self.client.post(
            "/api/v1/qc/scan-multi",
            files={
                "image_front": ("f.jpg", self.img_bytes, "image/jpeg"),
                "image_back": ("b.jpg", self.img_bytes, "image/jpeg"),
            },
            data={"commodity": "Terung"},
        )
        self.assertEqual(resp.status_code, 200)
        data = resp.json()["data"]
        self.assertEqual(data["execution_status"], "ai_detected")
        self.assertFalse(data["status_details"]["requires_human_confirmation"])


if __name__ == "__main__":
    unittest.main()
