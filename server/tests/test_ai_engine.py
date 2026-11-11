"""
Unit Test Suite untuk Modul Inferensi AI YOLO11 — Agri-Sort AI Backend
Tanggung Jawab: ML Engineer & QA Automation
"""

import os
import unittest
from unittest.mock import MagicMock, patch
from io import BytesIO
from PIL import Image

from server.services.ai_engine import YOLOInferenceEngine, ai_engine


class TestYOLOInferenceEngine(unittest.TestCase):
    """Pengujian untuk kelas singleton YOLOInferenceEngine dan pemrosesan inferensi."""

    def setUp(self):
        self.engine = YOLOInferenceEngine()

    def test_singleton_instance(self):
        """Memastikan YOLOInferenceEngine bertindak sebagai singleton sejati."""
        another_engine = YOLOInferenceEngine()
        self.assertIs(self.engine, another_engine)
        self.assertIs(self.engine, ai_engine)

    def test_model_configs_integrity(self):
        """Memverifikasi integritas konfigurasi path dan kelas model Terung dan Tomat."""
        configs = self.engine.model_configs

        # Verifikasi konfigurasi Terung
        self.assertIn("terung", configs)
        terung_cfg = configs["terung"]
        self.assertEqual(terung_cfg["name"], "Agri-Sort Eggplant Quality Detection")
        self.assertIn(terung_cfg["version"], ["1.0.0", "2.0.0"])
        self.assertTrue(
            terung_cfg["expected_classes"] == ["Grade A", "Grade B", "Reject"]
            or terung_cfg["expected_classes"] == ["Class I", "Class II", "Extra Class", "Reject"]
        )
        self.assertTrue(
            os.path.exists(terung_cfg["path"]),
            f"Berkas model Terung best.pt tidak ditemukan di: {terung_cfg['path']}",
        )

        # Verifikasi konfigurasi Tomat
        self.assertIn("tomat", configs)
        tomat_cfg = configs["tomat"]
        self.assertEqual(tomat_cfg["expected_classes"], ["fresh-tomato", "rotten-tomato"])
        self.assertTrue(
            os.path.exists(tomat_cfg["path"]),
            f"Berkas model Tomat best.pt tidak ditemukan di: {tomat_cfg['path']}",
        )

        # Verifikasi konfigurasi Cabai
        self.assertIn("cabai", configs)
        cabai_cfg = configs["cabai"]
        self.assertEqual(cabai_cfg["expected_classes"], ["Grade A", "Grade B", "Reject"])
        self.assertTrue(
            os.path.exists(cabai_cfg["path"]),
            f"Berkas model Cabai best.pt tidak ditemukan di: {cabai_cfg['path']}",
        )

    def test_class_slug_normalization(self):
        """Memverifikasi pemetaan nama kelas asli model Terung dan Tomat ke format slug frontend."""
        test_cases = [
            ("Grade A", "grade-a"),
            ("Grade B", "grade-b"),
            ("Class I", "class-1"),
            ("Class II", "class-2"),
            ("Extra Class", "extra-class"),
            ("Reject", "reject"),
            ("fresh-tomato", "fresh-tomato"),
            ("rotten-tomato", "rotten-tomato"),
            ("UNKNOWN QUALITY", "unknown-quality"),
        ]
        for raw, expected in test_cases:
            normalized = self.engine._normalize_class_slug(raw)
            self.assertEqual(normalized, expected, f"Gagal normalisasi: {raw} -> {expected}")

    def test_unsupported_commodity_error(self):
        """Memastikan komoditas yang belum didukung model AI melempar ValueError."""
        with self.assertRaises(ValueError) as ctx:
            self.engine.get_model("apel")
        self.assertIn("tidak didukung", str(ctx.exception).lower())

    def test_invalid_image_bytes_handling(self):
        """Memastikan input byte yang bukan gambar valid melempar ValueError informatif."""
        corrupt_bytes = b"ini_bukan_citra_yang_valid_12345"
        with self.assertRaises(ValueError) as ctx:
            self.engine.predict(image_bytes=corrupt_bytes, commodity="Terung")
        self.assertIn("gagal memproses byte citra", str(ctx.exception).lower())

    @patch("server.services.ai_engine.is_onnx_available", return_value=False)
    @patch("server.services.ai_engine.ULTRALYTICS_AVAILABLE", False)
    def test_ultralytics_unavailable_graceful_error(self, mock_onnx_avail):
        """Memastikan runtime error yang ramah dilempar saat kedua runtime belum terpasang."""
        dummy_img = Image.new("RGB", (200, 200), color="purple")
        buf = BytesIO()
        dummy_img.save(buf, format="JPEG")
        image_bytes = buf.getvalue()

        # Engine get_model harus melempar RuntimeError
        with self.assertRaises(RuntimeError) as ctx:
            self.engine.get_model("Terung")
        self.assertIn("tidak ada runtime", str(ctx.exception).lower())

    def test_predict_real_model_slicing_and_contract(self):
        """Memverifikasi pemanggilan predict() nyata menghasilkan kontrak 1.2.0 dan metadata slicing/disambiguasi."""
        if not self.engine.is_available():
            self.skipTest("Runtime AI tidak terpasang di lingkungan uji")

        # Buat gambar sintetis beresolusi 640x480
        test_img = Image.new("RGB", (640, 480), color=(100, 40, 120))
        buf = BytesIO()
        test_img.save(buf, format="JPEG")
        raw_bytes = buf.getvalue()

        res = self.engine.predict(
            image_bytes=raw_bytes,
            commodity="Terung",
            confidence_threshold=0.25,
            enable_slicing=True,
            disambiguate_grades=True,
        )

        self.assertEqual(res["contract_version"], "1.2.0")
        self.assertEqual(res["model_name"], "Agri-Sort Eggplant Quality Detection")
        self.assertIn("runtime_engine", res)
        self.assertIn("slicing_applied", res["detection_summary"])
        self.assertIn("dense_box_suppressed", res["detection_summary"])
        self.assertIn("disambiguated_count", res["detection_summary"])
        self.assertIsInstance(res["detections"], list)

    def test_onnx_runtime_parity_and_execution(self):
        """Memverifikasi engine ONNX Runtime mengeksekusi inferensi dengan mulus dan cepat."""
        from server.services.onnx_engine import is_onnx_available
        if not is_onnx_available():
            self.skipTest("onnxruntime tidak terpasang")

        test_img = Image.new("RGB", (640, 640), color=(80, 20, 100))
        buf = BytesIO()
        test_img.save(buf, format="JPEG")

        res = self.engine.predict(
            image_bytes=buf.getvalue(),
            commodity="Terung",
            runtime="onnx",
            enable_slicing=False,
        )
        self.assertEqual(res["runtime_engine"], "onnx_runtime")
        self.assertLess(res["inference_time_ms"], 500.0)


if __name__ == "__main__":
    unittest.main()
