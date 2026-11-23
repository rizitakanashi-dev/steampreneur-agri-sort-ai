"""
Unit Test Suite untuk Pure ONNX Runtime Inference Engine — Agri-Sort AI Backend
Tanggung Jawab: ML Engineer (Faris Al Farizi) & QA Automation
Dokumen Acuan: ml_engineer_next_steps_plan.md (Milestone 4)
"""

import os
import unittest
try:
    import numpy as np
    HAS_NUMPY = True
except ImportError:
    np = None
    HAS_NUMPY = False

from PIL import Image

from server.services.onnx_engine import (
    ONNXYOLOModel,
    compute_vectorized_nms,
    is_onnx_available,
)


@unittest.skipUnless(HAS_NUMPY, "NumPy tidak terpasang di environment ini")
class TestONNXEngine(unittest.TestCase):
    """Pengujian untuk runner model ONNX Runtime, NMS berbasis NumPy, dan deteksi objek."""

    def test_onnx_available(self):
        """Memeriksa ketersediaan onnxruntime di sistem."""
        status = is_onnx_available()
        self.assertIsInstance(status, bool)

    def test_vectorized_nms_disjoint(self):
        """Memverifikasi NMS mempertahankan semua box yang tidak saling bertumpukan."""
        boxes = np.array([
            [10.0, 10.0, 50.0, 50.0],
            [100.0, 100.0, 150.0, 150.0],
        ])
        scores = np.array([0.90, 0.85])
        keep = compute_vectorized_nms(boxes, scores, iou_threshold=0.45)
        self.assertEqual(len(keep), 2)
        self.assertEqual(keep, [0, 1])

    def test_vectorized_nms_overlap_suppression(self):
        """Memverifikasi box dengan IoU tinggi dieliminasi dan hanya box skor tertinggi dipertahankan."""
        boxes = np.array([
            [10.0, 10.0, 50.0, 50.0],
            [12.0, 12.0, 50.0, 50.0],  # Sangat tumpang tindih dengan box 0
        ])
        scores = np.array([0.80, 0.95])  # Box 1 memiliki skor lebih tinggi
        keep = compute_vectorized_nms(boxes, scores, iou_threshold=0.45)
        self.assertEqual(len(keep), 1)
        self.assertEqual(keep[0], 1)

    def test_vectorized_nms_occlusion_aware_cross_class(self):
        """Memverifikasi buah bertumpuk beda kelas dengan IoU menengah (~0.56) tidak saling menghapus."""
        boxes = np.array([
            [0.0, 0.0, 100.0, 100.0],
            [25.0, 0.0, 125.0, 100.0],  # Intersection=75x100=7500, Union=12500 -> IoU=0.60
        ])
        scores = np.array([0.90, 0.85])
        # Kelas sama -> ditekan pada iou_threshold=0.45
        keep_same = compute_vectorized_nms(boxes, scores, iou_threshold=0.45, classes=np.array([0, 0]))
        self.assertEqual(keep_same, [0])
        # Kelas berbeda -> dipertahankan karena IoU=0.60 <= cross_class_iou_threshold=0.75
        keep_diff = compute_vectorized_nms(boxes, scores, iou_threshold=0.45, classes=np.array([0, 1]))
        self.assertEqual(keep_diff, [0, 1])

    def test_onnx_model_predict_real_weights(self):
        """Memverifikasi ONNXYOLOModel dapat memuat server/models/terung/best.onnx dan mengeksekusi inferensi."""
        if not is_onnx_available():
            self.skipTest("onnxruntime belum terpasang di sistem")

        base_dir = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
        onnx_file = os.path.join(base_dir, "server", "models", "terung", "best.onnx")

        if not os.path.exists(onnx_file):
            self.skipTest(f"Berkas {onnx_file} tidak ditemukan")

        model = ONNXYOLOModel(model_path=onnx_file)
        self.assertIn(0, model.names)
        self.assertIn(model.names[0], ["Grade A", "Class I"])

        # Test inferensi pada gambar sintetis
        dummy_img = Image.new("RGB", (640, 640), color="purple")
        results = model.predict(dummy_img, conf=0.10)
        self.assertEqual(len(results), 1)
        self.assertIsInstance(results[0].boxes, list)

    def test_onnx_model_missing_file_error(self):
        """Memastikan FileNotFoundError dilempar jika berkas onnx tidak ada."""
        if not is_onnx_available():
            self.skipTest("onnxruntime belum terpasang di sistem")

        with self.assertRaises(FileNotFoundError):
            ONNXYOLOModel(model_path="/jalur/tidak/ada/model.onnx")


if __name__ == "__main__":
    unittest.main()
