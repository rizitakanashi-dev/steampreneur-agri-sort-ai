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
from server.services.model_registry import CANONICAL_CLASSES, ModelContractError, load_model_manifest


class TestYOLOInferenceEngine(unittest.TestCase):
    """Pengujian untuk kelas singleton YOLOInferenceEngine dan pemrosesan inferensi."""

    def setUp(self):
        self.engine = YOLOInferenceEngine()

    def test_singleton_instance(self):
        """Memastikan YOLOInferenceEngine bertindak sebagai singleton sejati."""
        another_engine = YOLOInferenceEngine()
        self.assertIs(self.engine, another_engine)
        self.assertIs(self.engine, ai_engine)

    def test_model_configs_use_exact_canonical_class_order(self):
        """Semua komoditas yang didukung memakai tepat tiga kelas kanonis."""
        expected_classes = list(CANONICAL_CLASSES.values())
        self.assertEqual(set(self.engine.model_configs), {"terung", "tomat", "cabai"})
        for config in self.engine.model_configs.values():
            self.assertEqual(config["expected_classes"], expected_classes)

    def test_predict_blocks_candidate_models_unless_explicitly_allowed(self):
        engine = YOLOInferenceEngine()
        engine._models = {}
        with patch("server.services.ai_engine.ONNXYOLOModel") as model_factory:
            with self.assertRaises(ModelContractError):
                engine.get_model("terung", runtime="onnx")
            model_factory.assert_not_called()
            self.assertNotIn("terung_onnx", engine._models)

        model, commodity, runtime = engine.get_model("terung", runtime="onnx", allow_candidate=True)
        self.assertEqual(commodity, "terung")
        self.assertEqual(runtime, "onnx_runtime")
        self.assertIsNotNone(model)

    def test_predict_rejects_candidate_without_explicit_evaluation_access(self):
        engine = YOLOInferenceEngine()
        image_buffer = BytesIO()
        Image.new("RGB", (32, 32), color="purple").save(image_buffer, format="JPEG")
        with patch("server.services.ai_engine.ONNXYOLOModel") as model_factory:
            with self.assertRaises(ModelContractError):
                engine.predict(image_buffer.getvalue(), "terung", runtime="onnx")
            model_factory.assert_not_called()

    def test_get_model_rejects_manifest_hash_mismatch_before_construction_or_cache(self):
        manifest = load_model_manifest("tomat", os.path.join(self.engine.base_dir, "server", "models"))
        manifest["artifacts"]["best.onnx"] = "0" * 64
        engine = YOLOInferenceEngine()
        engine._models = {}

        with patch("server.services.ai_engine.load_model_manifest", return_value=manifest), patch(
            "server.services.ai_engine.ONNXYOLOModel"
        ) as model_factory, patch("server.services.ai_engine.run_sliced_yolo_inference") as infer:
            image = Image.new("RGB", (8, 8))
            image_buffer = BytesIO()
            image.save(image_buffer, format="JPEG")
            with self.assertRaises(ModelContractError):
                engine.predict(image_buffer.getvalue(), "tomat", runtime="onnx", allow_candidate=True)

        model_factory.assert_not_called()
        infer.assert_not_called()
        self.assertNotIn("tomat_onnx", engine._models)

    def test_get_model_rejects_noncanonical_manifest_classes_before_inference(self):
        manifest = load_model_manifest("terung", os.path.join(self.engine.base_dir, "server", "models"))
        manifest["dataset"]["classes"] = {"0": "Grade B", "1": "Grade A", "2": "Reject"}
        engine = YOLOInferenceEngine()
        engine._models = {}

        with patch("server.services.ai_engine.load_model_manifest", return_value=manifest), patch(
            "server.services.ai_engine.ONNXYOLOModel"
        ) as model_factory:
            with self.assertRaises(ModelContractError):
                engine.get_model("terung", runtime="onnx", allow_candidate=True)

        model_factory.assert_not_called()
        self.assertNotIn("terung_onnx", engine._models)

    def test_get_model_rejects_mismatched_embedded_classes_before_cache(self):
        manifest = load_model_manifest("cabai", os.path.join(self.engine.base_dir, "server", "models"))
        fake_model = MagicMock()
        fake_model.session.get_modelmeta.return_value.custom_metadata_map = {
            "names": "{0: 'Grade B', 1: 'Grade A', 2: 'Reject'}"
        }
        engine = YOLOInferenceEngine()
        engine._models = {}

        with patch("server.services.ai_engine.load_model_manifest", return_value=manifest), patch(
            "server.services.ai_engine.ONNXYOLOModel", return_value=fake_model
        ):
            with self.assertRaises(ModelContractError):
                engine.get_model("cabai", runtime="onnx", allow_candidate=True)

        self.assertNotIn("cabai_onnx", engine._models)

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
            self.engine.get_model("Terung", allow_candidate=True)
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
            allow_candidate=True,
        )

        self.assertEqual(res["contract_version"], "1.2.0")
        self.assertEqual(res["model_name"], "Agri-Sort Eggplant Quality Detection")
        self.assertEqual(res["model_deployment_status"], "candidate")
        self.assertEqual(res["model_semantics_status"], "needs_data")
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
            allow_candidate=True,
        )
        self.assertEqual(res["runtime_engine"], "onnx_runtime")
        self.assertLess(res["inference_time_ms"], 500.0)


if __name__ == "__main__":
    unittest.main()
