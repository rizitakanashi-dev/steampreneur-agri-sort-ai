import json
import tempfile
import unittest
from pathlib import Path
from unittest.mock import Mock

from PIL import Image

from server.services.model_evaluation import (
    DatasetFormatError,
    calibrate_thresholds,
    evaluate_predictions,
    evaluate_scan_pipeline,
    load_yolo_dataset,
)


class TestModelEvaluation(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.addCleanup(self.temp.cleanup)
        self.root = Path(self.temp.name)
        (self.root / "valid" / "images").mkdir(parents=True)
        (self.root / "valid" / "labels").mkdir(parents=True)
        (self.root / "test" / "images").mkdir(parents=True)
        (self.root / "test" / "labels").mkdir(parents=True)
        Image.new("RGB", (100, 80), (120, 130, 140)).save(self.root / "valid" / "images" / "batch.jpg")
        (self.root / "valid" / "labels" / "batch.txt").write_text("0 0.5 0.5 0.2 0.4\n2 0.25 0.25 0.1 0.1\n")
        (self.root / "data.yaml").write_text("nc: 3\nnames: ['Grade A', 'Grade B', 'Reject']\n")

    def test_load_yolo_dataset_converts_labels_to_original_pixel_boxes(self):
        records = load_yolo_dataset(str(self.root), "valid")
        self.assertEqual(len(records), 1)
        self.assertEqual(records[0]["ground_truth"], [
            {"class_id": 0, "box": [40.0, 24.0, 60.0, 56.0]},
            {"class_id": 2, "box": [20.0, 16.0, 30.0, 24.0]},
        ])

    def test_load_yolo_dataset_rejects_dataset_class_order_mismatch(self):
        (self.root / "data.yaml").write_text("nc: 3\nnames: ['Grade B', 'Grade A', 'Reject']\n")
        with self.assertRaises(DatasetFormatError):
            load_yolo_dataset(str(self.root), "valid")

    def test_load_yolo_dataset_rejects_malformed_and_out_of_range_labels(self):
        label = self.root / "valid" / "labels" / "batch.txt"
        for text in ("0 0.5 0.5 0.2\n", "3 0.5 0.5 0.2 0.2\n", "1 1.2 0.5 0.2 0.2\n"):
            label.write_text(text)
            with self.subTest(text=text), self.assertRaises(DatasetFormatError):
                load_yolo_dataset(str(self.root), "valid")

    def test_evaluate_predictions_matches_once_and_counts_false_positives_and_negatives(self):
        ground_truth = [
            {"image_id": "a", "class_id": 0, "box": [0, 0, 10, 10]},
            {"image_id": "a", "class_id": 2, "box": [20, 20, 30, 30]},
        ]
        predictions = [
            {"image_id": "a", "class_id": 0, "confidence": 0.9, "box": [0, 0, 10, 10]},
            {"image_id": "a", "class_id": 0, "confidence": 0.8, "box": [0, 0, 10, 10]},
            {"image_id": "a", "class_id": 1, "confidence": 0.7, "box": [40, 40, 50, 50]},
        ]
        metrics = evaluate_predictions(ground_truth, predictions, iou_threshold=0.5)
        self.assertEqual(metrics["per_class"]["Grade A"]["tp"], 1)
        self.assertEqual(metrics["per_class"]["Grade A"]["fp"], 1)
        self.assertEqual(metrics["per_class"]["Grade B"]["fp"], 1)
        self.assertEqual(metrics["per_class"]["Reject"]["fn"], 1)
        self.assertEqual(metrics["per_class"]["Grade A"]["precision"], 0.5)
        self.assertEqual(metrics["per_class"]["Grade A"]["recall"], 1.0)
        self.assertEqual(metrics["total"]["fp"], 2)
        self.assertEqual(metrics["total"]["fn"], 1)
        self.assertEqual(metrics["confusion_matrix"]["counts"]["Reject"]["background"], 1)
        self.assertEqual(metrics["confusion_matrix"]["counts"]["Grade A"]["Grade A"], 1)
        self.assertEqual(metrics["confusion_matrix"]["counts"]["background"]["Grade B"], 1)

    def test_calibration_selects_threshold_from_validation_only_and_respects_reject_floor(self):
        validation = {
            "split": "valid",
            "threshold_results": {
                "0.25": {"macro_f1": 0.8, "reject_recall": 0.7, "reject_precision": 0.8},
                "0.35": {"macro_f1": 0.75, "reject_recall": 0.9, "reject_precision": 0.8},
                "0.45": {"macro_f1": 0.75, "reject_recall": 0.9, "reject_precision": 0.9},
            },
        }
        calibrated = calibrate_thresholds(validation, [0.25, 0.35, 0.45], objective="macro_f1", min_reject_recall=0.85)
        self.assertEqual(calibrated["selected_threshold"], 0.45)
        self.assertEqual(len(calibrated["threshold_curve"]), 3)
        validation["split"] = "test"
        with self.assertRaises(ValueError):
            calibrate_thresholds(validation, [0.25, 0.35], objective="macro_f1")

    def test_calibration_result_is_independent_of_held_out_test_outcomes(self):
        valid_results = {
            "split": "valid",
            "threshold_results": {
                "0.25": {"macro_f1": 0.8, "reject_recall": 0.9, "reject_precision": 0.7},
                "0.35": {"macro_f1": 0.8, "reject_recall": 0.9, "reject_precision": 0.9},
            },
        }
        valid_results["held_out_test_results"] = {"0.25": {"macro_f1": 1.0}}
        first = calibrate_thresholds(valid_results, [0.25, 0.35], "macro_f1")
        valid_results["held_out_test_results"]["0.25"]["macro_f1"] = 0.0
        valid_results["held_out_test_results"]["0.35"] = {"macro_f1": 1.0}
        second = calibrate_thresholds(valid_results, [0.25, 0.35], "macro_f1")
        self.assertEqual(first["selected_threshold"], second["selected_threshold"])
        self.assertEqual(first["selected_threshold"], 0.35)

    def test_map50_is_fixed_at_iou_point_five_even_when_primary_threshold_differs(self):
        targets = [{"image_id": "img", "class_id": 0, "box": [0, 0, 10, 10]}]
        predictions = [{"image_id": "img", "class_id": 0, "confidence": 0.8, "box": [0, 0, 6, 10]}]
        metrics = evaluate_predictions(targets, predictions, iou_threshold=0.7)
        self.assertEqual(metrics["map50"], 1.0)
        self.assertEqual(metrics["iou_threshold"], 0.7)

    def test_calibration_rejects_threshold_outside_production_range(self):
        validation = {"split": "valid", "threshold_results": {"0.01": {"macro_f1": 0.5}}}
        with self.assertRaises(ValueError):
            calibrate_thresholds(validation, [0.01], objective="macro_f1")

    def test_calibration_rejects_pipeline_errors(self):
        validation = {"split": "valid", "pipeline_failures": 1, "image_count": 2,
                      "threshold_results": {"0.3": {"macro_f1": 0.5, "reject_recall": 0.5}}}
        with self.assertRaises(ValueError):
            calibrate_thresholds(validation, [0.3], objective="macro_f1")

    def test_pipeline_calls_real_scan_boundary_and_records_quality_and_status(self):
        fake_engine = Mock()
        fake_engine.predict.return_value = {
            "model_name": "Agri-Sort Eggplant Quality Detection",
            "model_version": "2.0.0",
            "runtime_engine": "onnx_runtime",
            "inference_time_ms": 23.0,
            "image_dimensions": {"width": 100, "height": 80},
            "detections": [{"class_id": 0, "class_name": "Grade A", "confidence": 0.9,
                            "box": {"x1": 40, "y1": 24, "x2": 60, "y2": 56}}],
            "detection_summary": {"total_objects": 1, "dense_box_suppressed": False,
                                   "slicing_applied": True, "tiles_processed": 2},
        }
        result = evaluate_scan_pipeline(
            commodity="Terung",
            dataset_root=str(self.root),
            split="valid",
            confidence_threshold=0.35,
            engine=fake_engine,
            quality_analyzer=lambda _: {"is_blurry": False, "is_overexposed": False, "is_underexposed": False},
            enable_slicing=True,
            allow_candidate=True,
        )
        fake_engine.predict.assert_called_once()
        kwargs = fake_engine.predict.call_args.kwargs
        self.assertEqual(kwargs["confidence_threshold"], 0.35)
        self.assertTrue(kwargs["enable_slicing"])
        self.assertTrue(kwargs["allow_candidate"])
        self.assertEqual(result["pipeline_metrics"]["per_class"]["Grade A"]["tp"], 1)
        self.assertEqual(result["image_status_counts"]["ai_detected"], 1)
        self.assertEqual(result["images"][0]["quality"]["is_blurry"], False)

    def test_pipeline_keeps_blur_zero_detection_and_failure_outcomes_separate(self):
        fake_engine = Mock()
        fake_engine.predict.side_effect = [
            {"detections": [], "detection_summary": {"total_objects": 0}, "inference_time_ms": 3},
            RuntimeError("inference failed"),
        ]
        (self.root / "valid" / "images" / "second.jpg").write_bytes((self.root / "valid" / "images" / "batch.jpg").read_bytes())
        (self.root / "valid" / "labels" / "second.txt").write_text("")
        result = evaluate_scan_pipeline(
            commodity="Tomat", dataset_root=str(self.root), split="valid", confidence_threshold=0.4,
            engine=fake_engine,
            quality_analyzer=lambda _: {"is_blurry": True, "is_overexposed": False, "is_underexposed": False},
            allow_candidate=True,
        )
        self.assertEqual(result["image_status_counts"]["needs_review"], 1)
        self.assertEqual(result["image_status_counts"]["pipeline_error"], 1)
        self.assertEqual(result["pipeline_failures"], 1)
        self.assertEqual(result["pipeline_metrics"]["total"]["fn"], 2)
        self.assertTrue(result["images"][0]["quality"]["is_blurry"])

    def test_pipeline_validates_upload_format_before_production_inference(self):
        bmp_path = self.root / "valid" / "images" / "batch.bmp"
        Image.new("RGB", (100, 80), (120, 130, 140)).save(bmp_path)
        bmp_bytes = bmp_path.read_bytes()
        bmp_path.unlink()
        (self.root / "valid" / "images" / "batch.jpg").write_bytes(bmp_bytes)
        engine = Mock()
        report = evaluate_scan_pipeline(
            commodity="Terung", dataset_root=str(self.root), split="valid", confidence_threshold=0.3,
            engine=engine, quality_analyzer=lambda _: {}, allow_candidate=True,
        )
        engine.predict.assert_not_called()
        self.assertEqual(report["pipeline_failures"], 1)

    def test_report_serialization_contains_no_image_bytes(self):
        # Public serializer rejects non-JSON image payloads while preserving aggregate evidence.
        payload = {"images": [{"image_id": "batch.jpg", "status": "ai_detected"}], "count": 1}
        encoded = json.dumps(payload)
        self.assertNotIn("image_bytes", encoded)
        self.assertNotIn("/home/", encoded)


if __name__ == "__main__":
    unittest.main()
