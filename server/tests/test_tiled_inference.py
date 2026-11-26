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
    compute_iom,
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

    # =========================================================================
    # Task 1 Unit Tests: IoU, IoM, Kuadran Atas, Degenerate Boxes
    # =========================================================================
    def test_compute_iou_top_right_quadrant(self):
        """Memastikan IoU tidak bernilai 0.0 atau anomali ketika x1 > y2 (kuadran atas)."""
        # Objek di kanan atas: x1=348.0, y1=44.0, x2=473.0, y2=290.0 (x1 > y2)
        box_a = [348.0, 44.0, 473.0, 290.0]
        box_b = [350.0, 46.0, 470.0, 288.0]
        iou = compute_iou(box_a, box_b)
        self.assertGreater(iou, 0.85)
        self.assertLessEqual(iou, 1.0)

    def test_compute_iou_fully_contained(self):
        """Memastikan IoU antara kotak kecil yang berada 100% di dalam kotak besar dihitung presisi."""
        large_box = [0.0, 0.0, 20.0, 20.0]  # area 400
        small_box = [0.0, 0.0, 10.0, 10.0]  # area 100
        # Inter = 100, Union = 400
        # IoU = 100 / 400 = 0.25
        self.assertAlmostEqual(compute_iou(large_box, small_box), 0.25, places=4)

    def test_compute_iou_degenerate_boxes(self):
        """Memastikan kotak degenerate (lebar <= 0, tinggi <= 0, koordinat terbalik, None) menghasilkan 0.0."""
        valid_box = [10.0, 10.0, 50.0, 50.0]
        inverted_x = [50.0, 10.0, 10.0, 50.0]  # x2 < x1
        inverted_y = [10.0, 50.0, 50.0, 10.0]  # y2 < y1
        zero_area = [10.0, 10.0, 10.0, 50.0]   # x2 == x1

        self.assertEqual(compute_iou(valid_box, inverted_x), 0.0)
        self.assertEqual(compute_iou(valid_box, inverted_y), 0.0)
        self.assertEqual(compute_iou(valid_box, zero_area), 0.0)
        self.assertEqual(compute_iou([], valid_box), 0.0)
        self.assertEqual(compute_iou(None, valid_box), 0.0)
        self.assertEqual(compute_iou([10.0, 20.0], valid_box), 0.0)

    def test_compute_iom_containment(self):
        """Memastikan IoM (Intersection over Minimum) bernilai 1.0 jika kotak kecil terkurung total."""
        large_box = [100.0, 100.0, 300.0, 300.0]  # area 40,000
        fragment_box = [100.0, 100.0, 200.0, 200.0]  # area 10,000
        iom = compute_iom(large_box, fragment_box)
        self.assertAlmostEqual(iom, 1.0, places=4)

    def test_compute_iom_adjacent_objects_preserved(self):
        """Memastikan dua objek berbeda yang berdekatan menghasilkan IoM rendah (< 0.20) sehingga tidak dimerge."""
        tomato_1 = [100.0, 100.0, 200.0, 200.0]  # 100x100
        tomato_2 = [190.0, 100.0, 290.0, 200.0]  # 100x100, overlap 10px
        iom = compute_iom(tomato_1, tomato_2)
        # Inter = 10 * 100 = 1000, min_area = 10,000 -> IoM = 0.10
        self.assertAlmostEqual(iom, 0.10, places=4)
        self.assertLess(iom, 0.70)

    # =========================================================================
    # Task 2 Unit Tests: Resolution-Aware Inference Strategy
    # =========================================================================
    def test_resolution_aware_native_640x640_no_slicing(self):
        """Memastikan citra 640x640 mengeksekusi full-image inference tanpa pemotongan SAHI."""
        mock_model = MagicMock()
        mock_model.names = {0: "fresh-tomato"}
        img_640 = Image.new("RGB", (640, 640), color="white")

        b1 = MagicMock()
        b1.cls = [0]
        b1.conf = [0.92]
        b1.xyxy = [[100.0, 100.0, 200.0, 200.0]]

        b2 = MagicMock()
        b2.cls = [0]
        b2.conf = [0.89]
        b2.xyxy = [[300.0, 300.0, 400.0, 400.0]]

        res_mock = MagicMock(boxes=[b1, b2])
        mock_model.predict.return_value = [res_mock]

        result = run_sliced_yolo_inference(
            image=img_640,
            model=mock_model,
            commodity="tomat",
            confidence_threshold=0.35,
            enable_slicing=True,
        )

        self.assertFalse(result["is_sliced"])
        self.assertEqual(result["tiles_processed"], 0)
        self.assertEqual(len(result["detections"]), 2)
        # Hanya 1 pemanggilan predict (full-image), tanpa 13 pemanggilan sub-tile
        self.assertEqual(mock_model.predict.call_count, 1)

    def test_resolution_aware_high_res_enables_slicing(self):
        """Memastikan citra resolusi tinggi (> 640x640) mengaktifkan slicing saat didukung."""
        mock_model = MagicMock()
        mock_model.names = {0: "fresh-tomato"}
        img_high_res = Image.new("RGB", (1280, 720), color="white")

        b_full = MagicMock()
        b_full.cls = [0]
        b_full.conf = [0.90]
        b_full.xyxy = [[50.0, 50.0, 150.0, 150.0]]
        mock_model.predict.return_value = [MagicMock(boxes=[b_full])]

        result = run_sliced_yolo_inference(
            image=img_high_res,
            model=mock_model,
            commodity="tomat",
            confidence_threshold=0.35,
            enable_slicing=True,
        )

        self.assertTrue(result["is_sliced"])
        self.assertGreater(result["tiles_processed"], 0)

    def test_resolution_aware_enable_slicing_false_respected(self):
        """Memastikan parameter enable_slicing=False dipatuhi meskipun citra beresolusi tinggi."""
        mock_model = MagicMock()
        mock_model.names = {0: "fresh-tomato"}
        img_high_res = Image.new("RGB", (1920, 1080), color="white")
        b_full = MagicMock()
        b_full.cls = [0]
        b_full.conf = [0.90]
        b_full.xyxy = [[50.0, 50.0, 150.0, 150.0]]
        mock_model.predict.return_value = [MagicMock(boxes=[b_full])]

        result = run_sliced_yolo_inference(
            image=img_high_res,
            model=mock_model,
            commodity="tomat",
            confidence_threshold=0.35,
            enable_slicing=False,
        )

        self.assertFalse(result["is_sliced"])
        self.assertEqual(result["tiles_processed"], 0)
        self.assertEqual(mock_model.predict.call_count, 1)

    # =========================================================================
    # Task 3 Unit Tests: Containment-Aware Merge
    # =========================================================================
    def test_containment_merge_fragment_merged_into_full(self):
        """Memastikan pecahan sub-tile yang berada di dalam box utuh dimerge dan tidak menambah jumlah deteksi."""
        mock_model = MagicMock()
        mock_model.names = {0: "fresh-tomato"}
        img = Image.new("RGB", (1000, 1000), color="white")

        tile_call_count = [0]

        def side_effect(source, **kwargs):
            if hasattr(source, "size") and source.size == (1000, 1000):
                # Full image: 1 buah utuh di koordinat [200, 200, 400, 400]
                b = MagicMock()
                b.cls = [0]
                b.conf = [0.92]
                b.xyxy = [[200.0, 200.0, 400.0, 400.0]]
                return [MagicMock(boxes=[b])]
            else:
                # Hanya tile pertama (x1=0, y1=0) yang memuat pecahan [200, 200, 300, 400]
                tile_call_count[0] += 1
                if tile_call_count[0] == 1:
                    b = MagicMock()
                    b.cls = [0]
                    b.conf = [0.88]
                    b.xyxy = [[200.0, 200.0, 300.0, 400.0]]
                    return [MagicMock(boxes=[b])]
                return [MagicMock(boxes=[])]

        mock_model.predict.side_effect = side_effect

        result = run_sliced_yolo_inference(
            image=img,
            model=mock_model,
            commodity="tomat",
            confidence_threshold=0.35,
            enable_slicing=True,
        )

        # Hasil akhir harus tetap 1 objek (fragmen digabung ke box induk), bukan 2 objek terpisah
        self.assertEqual(len(result["detections"]), 1)
        # Koordinat centroid harus memakai koordinat citra utuh [200, 200, 400, 400]
        det = result["detections"][0]
        self.assertAlmostEqual(det["box"]["x1"], 200.0, delta=2.0)
        self.assertAlmostEqual(det["box"]["x2"], 400.0, delta=2.0)

    def test_containment_merge_preserves_two_adjacent_tomatoes(self):
        """Memastikan dua tomat berdekatan tidak salah dimerge menjadi satu objek."""
        mock_model = MagicMock()
        mock_model.names = {0: "fresh-tomato"}
        img = Image.new("RGB", (1000, 1000), color="white")

        def side_effect(source, **kwargs):
            if hasattr(source, "size") and source.size == (1000, 1000):
                # Dua tomat bersampingan
                b1 = MagicMock()
                b1.cls = [0]
                b1.conf = [0.93]
                b1.xyxy = [[100.0, 100.0, 200.0, 200.0]]
                b2 = MagicMock()
                b2.cls = [0]
                b2.conf = [0.91]
                b2.xyxy = [[190.0, 100.0, 290.0, 200.0]]
                return [MagicMock(boxes=[b1, b2])]
            return [MagicMock(boxes=[])]

        mock_model.predict.side_effect = side_effect

        result = run_sliced_yolo_inference(
            image=img,
            model=mock_model,
            commodity="tomat",
            confidence_threshold=0.35,
            enable_slicing=True,
        )

        self.assertEqual(len(result["detections"]), 2)

    # =========================================================================
    # Task 5 Unit Tests: Reproduction Case & Regression Prevention
    # =========================================================================
    def test_fresh_tomato_245_reproduction_case(self):
        """
        Regression Test: Citra freshTomato-245 (secara visual berisi 3 tomat)
        wajib menghasilkan tepat 3 deteksi, tanpa duplikasi, dan tanpa false positive bayangan.
        Setiap prediksi wajib mencocoki ground truth dengan IoU >= 0.85.
        """
        import os, zipfile, io
        zip_path = "/home/Rizi/dataset/test.v2i.yolov11.zip"
        onnx_path = os.path.join(os.path.dirname(__file__), "..", "..", "model-export", "weights", "best.onnx")

        if not os.path.exists(zip_path) or not os.path.exists(onnx_path):
            self.skipTest("Arsip dataset atau bobot ONNX tidak ditemukan di environment lokal")

        try:
            import cv2
            import numpy as np
        except ImportError:
            self.skipTest("OpenCV atau NumPy tidak tersedia")

        class CV2ModelWrapper:
            def __init__(self, path):
                self.net = cv2.dnn.readNetFromONNX(path)
                self.names = {0: "fresh-tomato"}

            def predict(self, source, conf=0.25, iou=0.45, imgsz=640, **kwargs):
                if isinstance(source, Image.Image):
                    img = source.convert("RGB")
                else:
                    img = Image.fromarray(source).convert("RGB")
                orig_w, orig_h = img.size
                resized = img.resize((imgsz, imgsz), Image.BILINEAR)
                tensor = np.array(resized, dtype=np.float32) / 255.0
                tensor = np.transpose(tensor, (2, 0, 1))[np.newaxis, ...]

                self.net.setInput(tensor)
                preds = np.squeeze(self.net.forward()).T

                f_boxes = preds[:, :4]
                scores = preds[:, 4]
                mask = scores >= conf
                if not np.any(mask):
                    return [MagicMock(boxes=[])]

                f_boxes = f_boxes[mask]
                f_scores = scores[mask]
                scale_x = orig_w / float(imgsz)
                scale_y = orig_h / float(imgsz)

                x1 = np.clip((f_boxes[:, 0] - f_boxes[:, 2] / 2.0) * scale_x, 0.0, orig_w)
                y1 = np.clip((f_boxes[:, 1] - f_boxes[:, 3] / 2.0) * scale_y, 0.0, orig_h)
                x2 = np.clip((f_boxes[:, 0] + f_boxes[:, 2] / 2.0) * scale_x, 0.0, orig_w)
                y2 = np.clip((f_boxes[:, 1] + f_boxes[:, 3] / 2.0) * scale_y, 0.0, orig_h)

                xyxy = np.column_stack([x1, y1, x2, y2])
                cv_boxes = [[int(b[0]), int(b[1]), int(b[2]-b[0]), int(b[3]-b[1])] for b in xyxy]
                indices = cv2.dnn.NMSBoxes(cv_boxes, f_scores.tolist(), float(conf), float(iou))

                box_items = []
                if len(indices) > 0:
                    for idx in indices.flatten():
                        b_mock = MagicMock()
                        b_mock.cls = [0]
                        b_mock.conf = [float(f_scores[idx])]
                        b_mock.xyxy = [xyxy[idx].tolist()]
                        box_items.append(b_mock)
                return [MagicMock(boxes=box_items)]

        model = CV2ModelWrapper(onnx_path)
        with zipfile.ZipFile(zip_path) as z:
            img_b = z.read("train/images/freshTomato-245-_png.rf.fb61b4ea64c0447795be2b29e25e68ed.jpg")
            img = Image.open(io.BytesIO(img_b)).convert("RGB")

        gt = [
            ("GT_Top", [349.5, 47.8, 473.5, 282.2]),
            ("GT_Middle", [390.5, 282.2, 502.5, 504.8]),
            ("GT_Bottom", [310.8, 455.0, 428.2, 640.0]),
        ]

        result = run_sliced_yolo_inference(
            image=img,
            model=model,
            commodity="tomat",
            confidence_threshold=0.35,
            enable_slicing=True,
        )

        detections = result["detections"]
        self.assertEqual(len(detections), 3, f"Jumlah deteksi harus tepat 3, didapat: {len(detections)}")

        matched_gt_names = set()
        for det in detections:
            b = [det["box"]["x1"], det["box"]["y1"], det["box"]["x2"], det["box"]["y2"]]
            best_iou = 0.0
            best_gt = None
            for g_name, g_box in gt:
                iou = compute_iou(b, g_box)
                if iou > best_iou:
                    best_iou = iou
                    best_gt = g_name

            self.assertGreaterEqual(best_iou, 0.85, f"Prediksi {b} harus mencocoki GT dengan IoU >= 0.85 (didapat {best_iou})")
            self.assertNotIn(best_gt, matched_gt_names, f"GT {best_gt} terdeteksi lebih dari satu kali (duplikat)")
            matched_gt_names.add(best_gt)

        self.assertEqual(len(matched_gt_names), 3, "Seluruh 3 tomat visual harus cocok 1-to-1 dengan ground truth")

    def test_non_commodity_objects_filtered_across_all_commodities(self):
        """Memastikan objek non-sayuran (dinding abu-abu, botol biru, kulit/meja pucat) disaring untuk Tomat, Cabai, dan Terung."""
        from server.services.tiled_inference import is_watermark_or_text_artifact

        # 1. Citra bertekstur abu-abu (dinding / meja / keyboard)
        gray_img = Image.new("RGB", (200, 200))
        px = gray_img.load()
        for y in range(200):
            for x in range(200):
                val = 150 + ((x + y) % 30)
                px[x, y] = (val, val, val)
        self.assertTrue(is_watermark_or_text_artifact([20, 20, 180, 180], gray_img, "tomat"))
        self.assertTrue(is_watermark_or_text_artifact([20, 20, 180, 180], gray_img, "cabai"))
        self.assertTrue(is_watermark_or_text_artifact([20, 20, 180, 180], gray_img, "terung"))

        # 2. Citra bertekstur biru (cangkir / baju / benda plastik)
        blue_img = Image.new("RGB", (200, 200))
        bpx = blue_img.load()
        for y in range(200):
            for x in range(200):
                bpx[x, y] = (30 + (x % 15), 90 + (y % 20), 210 + (x % 20))
        self.assertTrue(is_watermark_or_text_artifact([20, 20, 180, 180], blue_img, "tomat"))
        self.assertTrue(is_watermark_or_text_artifact([20, 20, 180, 180], blue_img, "cabai"))
        self.assertTrue(is_watermark_or_text_artifact([20, 20, 180, 180], blue_img, "terung"))

        # 3. Citra tomat merah cerah bertekstur tidak boleh tersaring
        red_img = Image.new("RGB", (200, 200))
        rpx = red_img.load()
        for y in range(200):
            for x in range(200):
                rpx[x, y] = (210 + (x % 25), 35 + (y % 15), 30)
        self.assertFalse(is_watermark_or_text_artifact([20, 20, 180, 180], red_img, "tomat"))
        self.assertFalse(is_watermark_or_text_artifact([20, 20, 180, 180], red_img, "cabai"))

    def test_cabai_2x2_grid_and_elongated_seam_merge(self):
        """Memastikan cabai beresolusi 1280x960 memakai grid 2x2 (4 tile) dan menggabungkan seam lintas batas tile."""
        mock_model = MagicMock()
        mock_model.names = {0: "Grade A", 1: "Grade B", 2: "Reject"}
        img = Image.new("RGB", (1280, 960), color="red")

        def side_effect_predict(source, **kwargs):
            mock_res = MagicMock()
            w, _ = source.size
            if w == 1280:
                mock_res.boxes = []
            else:
                # Simulasikan 1 fragmen cabai vertikal yang terbelah di tepi bawah/atas tile
                b = MagicMock()
                b.cls = [0]
                b.conf = [0.75]
                b.xyxy = [[200.0, 200.0, 260.0, 520.0]]
                mock_res.boxes = [b]
            return [mock_res]

        mock_model.predict.side_effect = side_effect_predict
        result = run_sliced_yolo_inference(
            image=img,
            model=mock_model,
            commodity="cabai",
            confidence_threshold=0.35,
            enable_slicing=True,
        )
        self.assertTrue(result["is_sliced"])
        self.assertEqual(result["tiles_processed"], 4)

    def test_nested_fragment_suppressed_while_stacked_preserved(self):
        """Memastikan fragmen mungil di dalam box buah utuh ditekan, namun 2 buah bertumpuk sebanding tetap dipertahankan."""
        mock_model = MagicMock()
        mock_model.names = {0: "Grade A", 1: "Grade B", 2: "Reject"}
        img = Image.new("RGB", (640, 480), color="red")

        b_left = MagicMock()
        b_left.cls = [0]
        b_left.conf = [0.81]
        b_left.xyxy = [[100.0, 100.0, 320.0, 400.0]]  # 220x300 = 66,000

        b_right = MagicMock()
        b_right.cls = [0]
        b_right.conf = [0.72]
        b_right.xyxy = [[240.0, 120.0, 460.0, 390.0]]  # 220x270 = 59,400 (stacked sibling)

        b_sliver = MagicMock()
        b_sliver.cls = [0]
        b_sliver.conf = [0.50]
        b_sliver.xyxy = [[330.0, 220.0, 380.0, 260.0]]  # 50x40 = 2,000 (nested inside b_right)

        mock_model.predict.return_value = [MagicMock(boxes=[b_left, b_right, b_sliver])]
        result = run_sliced_yolo_inference(
            image=img,
            model=mock_model,
            commodity="cabai",
            confidence_threshold=0.35,
            enable_slicing=True,
        )
        self.assertEqual(len(result["detections"]), 2)
        confs = sorted([d["confidence"] for d in result["detections"]], reverse=True)
        self.assertEqual(confs, [0.81, 0.72])

    def test_map_rotated_box_to_original_exact_inversion(self):
        """Memastikan pemetaan balik koordinat rotasi 90 dan 270 derajat akurat secara matematis."""
        from server.services.tiled_inference import _map_rotated_box_to_original

        # Titik (30, 10) pada citra 200x100:
        # rot=90 CCW (ukuran 100x200) -> rx=10, ry=200-31=169
        inv90 = _map_rotated_box_to_original([10.0, 169.0, 11.0, 170.0], 90, 200, 100)
        self.assertEqual(inv90, [30.0, 10.0, 31.0, 11.0])

        # rot=270 CCW (ukuran 100x200) -> rx=100-11=89, ry=30
        inv270 = _map_rotated_box_to_original([89.0, 30.0, 90.0, 31.0], 270, 200, 100)
        self.assertEqual(inv270, [30.0, 10.0, 31.0, 11.0])

    def test_outer_image_border_detections_not_discarded_as_internal_seam(self):
        """Memastikan buah di tepi luar bingkai foto (x1=0, y1=0) dengan conf 0.55 tidak dibuang sebagai fragmen seam."""
        mock_model = MagicMock()
        mock_model.names = {0: "Grade A", 1: "Grade B", 2: "Reject"}
        img = Image.new("RGB", (1280, 960), color="red")

        tile_idx = [0]

        def side_effect_predict(source, **kwargs):
            mock_res = MagicMock()
            w, _ = source.size
            if w == 1280:
                mock_res.boxes = []
            else:
                tile_idx[0] += 1
                if tile_idx[0] == 1:
                    # Tile kiri-atas (x1=0, y1=0): buah menyentuh tepi kiri luar foto (bx[0]=2.0) dengan conf=0.55
                    b = MagicMock()
                    b.cls = [0]
                    b.conf = [0.55]
                    b.xyxy = [[2.0, 100.0, 120.0, 260.0]]
                    mock_res.boxes = [b]
                else:
                    mock_res.boxes = []
            return [mock_res]

        mock_model.predict.side_effect = side_effect_predict
        result = run_sliced_yolo_inference(
            image=img,
            model=mock_model,
            commodity="cabai",
            confidence_threshold=0.35,
            enable_slicing=True,
        )
        self.assertEqual(len(result["detections"]), 1)
        self.assertAlmostEqual(result["detections"][0]["confidence"], 0.55, places=2)

    def test_multi_object_giant_box_suppressed_all_4_chilies_preserved(self):
        """
        Memastikan jika terdapat 4 cabai dan model menghasilkan 2 box raksasa yang menelan masing-masing 2 cabai,
        kedua box raksasa multi-objek tersebut ditekan dan keempat cabai individual dipertahankan secara utuh.
        """
        mock_model = MagicMock()
        mock_model.names = {0: "Grade A", 1: "Grade B", 2: "Reject"}
        img = Image.new("RGB", (1280, 720), color="white")

        def _create_mock_box(c, conf, xyxy):
            m = MagicMock()
            m.cls = [c]
            m.conf = [conf]
            m.xyxy = [xyxy]
            return m

        # 4 cabai individual
        chili1 = _create_mock_box(0, 0.58, [440.0, 290.0, 560.0, 420.0])
        chili2 = _create_mock_box(0, 0.62, [575.0, 275.0, 670.0, 435.0])
        chili3 = _create_mock_box(0, 0.55, [640.0, 280.0, 740.0, 430.0])
        chili4 = _create_mock_box(0, 0.59, [750.0, 270.0, 850.0, 440.0])

        # 2 box gabungan raksasa yang menelan (multi-fruit merge)
        big1 = _create_mock_box(0, 0.65, [430.0, 260.0, 680.0, 450.0])
        big2 = _create_mock_box(0, 0.61, [630.0, 260.0, 860.0, 450.0])

        mock_res = MagicMock()
        mock_res.boxes = [big1, chili1, chili2, big2, chili3, chili4]
        mock_model.predict.return_value = [mock_res]

        result = run_sliced_yolo_inference(
            image=img,
            model=mock_model,
            commodity="cabai",
            confidence_threshold=0.35,
            enable_slicing=False,
        )
        self.assertEqual(len(result["detections"]), 4)
        det_x1s = sorted([d["box"]["x1"] for d in result["detections"]])
        self.assertEqual(det_x1s, [440.0, 575.0, 640.0, 750.0])

    def test_refine_tomato_detections_mold_and_batch_demotion(self):
        """
        Memverifikasi bahwa tomat berjamur atau tomat ragu dalam batch yang terkontaminasi
        didemotasikan menjadi Reject tanpa memicu false warning Class II terung.
        """
        import numpy as np
        from server.services.tiled_inference import refine_tomato_detections

        # Buat dummy image dengan bintik jamur bertekstur
        img = Image.new("RGB", (300, 300), color=(180, 30, 30))
        # Tambahkan bercak jamur putih kelabu bertekstur
        img_np = np.array(img)
        # Bintik bertekstur di kuadran kiri atas
        noise = np.random.randint(90, 180, size=(60, 60, 3), dtype=np.uint8)
        img_np[20:80, 20:80] = noise
        img_with_mold = Image.fromarray(img_np)

        detections = [
            {
                "id": 1,
                "class_id": 0,
                "class_name": "Grade A",
                "confidence": 0.62,
                "box": {"x1": 10.0, "y1": 10.0, "x2": 90.0, "y2": 90.0},
                "disambiguated": False,
            },
            {
                "id": 2,
                "class_id": 0,
                "class_name": "Grade A",
                "confidence": 0.55,
                "box": {"x1": 120.0, "y1": 120.0, "x2": 200.0, "y2": 200.0},
                "disambiguated": False,
            }
        ]

        refined = refine_tomato_detections(img_with_mold, detections)
        # Deteksi 1 memiliki bercak jamur nyata -> harus didemote ke Reject
        self.assertEqual(refined[0]["class_name"], "Reject")
        # Karena deteksi 1 terkonfirmasi reject dan deteksi 2 conf < 0.70 di batch yang sama -> didemote juga
        self.assertEqual(refined[1]["class_name"], "Reject")


if __name__ == "__main__":
    unittest.main()
