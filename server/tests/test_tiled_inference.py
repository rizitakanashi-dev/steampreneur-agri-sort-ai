"""
Unit Test Suite untuk Tiled Inference (SAHI) & Grade Disambiguation — Agri-Sort AI Backend
Tanggung Jawab: ML Engineer & QA Automation
Dokumen Acuan: ml_engineer_next_steps_plan.md (Milestone 1 & Milestone 3)
"""

import unittest
from unittest.mock import MagicMock
from PIL import Image

from server.services.tiled_inference import (
    compute_iou,
    generate_slice_tiles,
    disambiguate_eggplant_classes,
    run_sliced_yolo_inference,
)


class TestTiledInferenceAndDisambiguation(unittest.TestCase):
    """Pengujian untuk algoritma kalkulasi IoU, pembagian grid, supresi monolitik, dan disambiguasi mutu."""

    def test_compute_iou_identical_boxes(self):
        """Memastikan IoU antara dua box yang identik bernilai 1.0."""
        box = [10.0, 10.0, 50.0, 50.0]
        self.assertAlmostEqual(compute_iou(box, box), 1.0, places=4)

    def test_compute_iou_disjoint_boxes(self):
        """Memastikan IoU antara dua box yang tidak bersinggungan bernilai 0.0."""
        box_a = [0.0, 0.0, 10.0, 10.0]
        box_b = [20.0, 20.0, 30.0, 30.0]
        self.assertEqual(compute_iou(box_a, box_b), 0.0)

    def test_compute_iou_partial_overlap(self):
        """Memastikan IoU parsial dihitung sesuai formula matematis inter / union."""
        # Box A: area 100 (0 to 10)
        # Box B: area 100 (5 to 15)
        # Inter: 5x10 = 50
        # Union: 100 + 100 - 50 = 150
        # IoU = 50 / 150 = 0.3333...
        box_a = [0.0, 0.0, 10.0, 10.0]
        box_b = [5.0, 0.0, 15.0, 10.0]
        self.assertAlmostEqual(compute_iou(box_a, box_b), 50.0 / 150.0, places=4)

    def test_generate_slice_tiles_dimensions(self):
        """Memastikan pembagian grid menghasilkan tile yang mencakup seluruh citra dengan koordinat valid."""
        width, height = 640, 480
        tiles = generate_slice_tiles(width=width, height=height, grid_x=2, grid_y=2, overlap=0.25)
        self.assertEqual(len(tiles), 4)

        for x1, y1, x2, y2 in tiles:
            self.assertGreaterEqual(x1, 0)
            self.assertGreaterEqual(y1, 0)
            self.assertLessEqual(x2, width)
            self.assertLessEqual(y2, height)
            self.assertGreater(x2, x1)
            self.assertGreater(y2, y1)

    def test_disambiguation_margin_calibrated_to_class2(self):
        """
        P1: Memverifikasi jika Reject bersaing ketat dengan Class II (selisih < 0.20),
        sistem mengalokasikan ke Class II (Toleransi Mutu Komersial UNECE FFV-05; SNI Terung: NOT VERIFIED).
        """
        cluster = [
            {"class_name": "Reject", "conf": 0.44, "cls_id": 3},
            {"class_name": "Class II", "conf": 0.38, "cls_id": 1},
        ]
        chosen_cls, conf, cls_id, disambiguated, reason = disambiguate_eggplant_classes(
            cluster_items=cluster,
            confidence_threshold=0.25,
            is_dense_scan=True,
        )
        self.assertEqual(chosen_cls, "Class II")
        self.assertEqual(cls_id, 1)
        self.assertTrue(disambiguated)
        self.assertEqual(reason, "margin_calibrated_class2")

    def test_disambiguation_severe_reject_preserved(self):
        """Memverifikasi bahwa buah reject parah (skor tinggi >= 0.55) tetap diklasifikasikan sebagai Reject."""
        cluster = [
            {"class_name": "Reject", "conf": 0.78, "cls_id": 3},
            {"class_name": "Class II", "conf": 0.22, "cls_id": 1},
        ]
        chosen_cls, conf, cls_id, disambiguated, reason = disambiguate_eggplant_classes(
            cluster_items=cluster,
            confidence_threshold=0.25,
            is_dense_scan=True,
        )
        self.assertEqual(chosen_cls, "Reject")
        self.assertEqual(cls_id, 3)
        self.assertFalse(disambiguated)
        self.assertIsNone(reason)

    def test_disambiguation_marginal_solitary_reject(self):
        """Memverifikasi Reject soliter dengan confidence marginal (< 0.38) di keranjang padat dialihkan ke Class II."""
        cluster = [
            {"class_name": "Reject", "conf": 0.29, "cls_id": 3},
        ]
        chosen_cls, conf, cls_id, disambiguated, reason = disambiguate_eggplant_classes(
            cluster_items=cluster,
            confidence_threshold=0.25,
            is_dense_scan=True,
        )
        self.assertEqual(chosen_cls, "Class II")
        self.assertTrue(disambiguated)
        self.assertEqual(reason, "marginal_solitary_calibrated_class2")

    def test_run_sliced_yolo_inference_monolithic_suppression(self):
        """
        P0: Memastikan box monolitik halusinasi keranjang dihapus ketika potongan tile
        menemukan objek-objek individual di dalamnya.
        """
        # Mock model YOLO
        mock_model = MagicMock()
        mock_model.names = {0: "Class I", 1: "Class II", 2: "Extra Class", 3: "Reject"}

        # Buat dummy citra 800x600
        dummy_img = Image.new("RGB", (800, 600), color="purple")

        def side_effect_predict(source, **kwargs):
            mock_res = MagicMock()
            mock_box = MagicMock()

            # Periksa apakah ini pemanggilan citra penuh atau potongan tile
            if hasattr(source, "size") and source.size == (800, 600):
                # Citra penuh: hasilkan 1 box monolitik mencakup 90% layar (halusinasi keranjang)
                b = MagicMock()
                b.cls = [MagicMock(item=lambda: 3)]  # Reject
                b.conf = [MagicMock(item=lambda: 0.65)]
                b.xyxy = [[10.0, 10.0, 790.0, 590.0]]
                mock_res.boxes = [b]
            else:
                # Potongan tile: hasilkan 1 objek individual lokal
                b = MagicMock()
                b.cls = [MagicMock(item=lambda: 1)]  # Class II
                b.conf = [MagicMock(item=lambda: 0.50)]
                b.xyxy = [[20.0, 20.0, 120.0, 120.0]]
                mock_res.boxes = [b]

            return [mock_res]

        mock_model.predict.side_effect = side_effect_predict

        result = run_sliced_yolo_inference(
            image=dummy_img,
            model=mock_model,
            commodity="terung",
            confidence_threshold=0.25,
            enable_slicing=True,
            disambiguate_grades=True,
        )

        self.assertTrue(result["is_sliced"])
        self.assertTrue(result["dense_box_suppressed"])
        self.assertGreaterEqual(len(result["detections"]), 1)

        # Pastikan tidak ada box yang mencakup 90% layar di hasil akhir
        for det in result["detections"]:
            bx = det["box"]
            width = bx["x2"] - bx["x1"]
            height = bx["y2"] - bx["y1"]
            area = width * height
            self.assertLess(area, 0.50 * 800 * 600)


if __name__ == "__main__":
    unittest.main()
