"""
Unit Tests untuk Mock Inference Engine (Task FS-BE-03)
Zero-dependency test runner menggunakan Python unittest bawaan.
"""

import asyncio
import unittest
from server.services.mock_engine import generate_mock_detections, predict_harvest_image_mock


class TestMockInferenceEngine(unittest.TestCase):
    def test_mock_detections_bounding_box_within_bounds(self):
        width, height = 1280, 720
        detections = generate_mock_detections(width, height, confidence_threshold=0.35)

        self.assertGreater(len(detections), 0)
        for det in detections:
            box = det["box"]
            self.assertGreaterEqual(box["x1"], 0.0)
            self.assertGreaterEqual(box["y1"], 0.0)
            self.assertLessEqual(box["x2"], float(width))
            self.assertLessEqual(box["y2"], float(height))
            self.assertLessEqual(box["x1"], box["x2"])
            self.assertLessEqual(box["y1"], box["y2"])
            self.assertIn(det["class_name"], ["fresh-tomato", "rotten-tomato"])
            self.assertGreaterEqual(det["confidence"], 0.35)

    def test_confidence_threshold_filtering(self):
        width, height = 640, 640
        # Normal threshold: 12 candidates
        det_normal = generate_mock_detections(width, height, confidence_threshold=0.35)
        self.assertEqual(len(det_normal), 12)

        # Strict threshold 0.90: should filter out lower confidence ones
        det_strict = generate_mock_detections(width, height, confidence_threshold=0.90)
        self.assertLess(len(det_strict), len(det_normal))
        for d in det_strict:
            self.assertGreaterEqual(d["confidence"], 0.90)

    def test_predict_mock_contract_structure(self):
        width, height = 1920, 1080
        result = asyncio.run(
            predict_harvest_image_mock(
                image_bytes=b"fake_bytes",
                width=width,
                height=height,
                confidence_threshold=0.35,
                simulate_delay=False,
            )
        )

        self.assertEqual(result["contract_version"], "1.0.0")
        self.assertEqual(result["model_name"], "yolo11n-agrisort")
        self.assertEqual(result["image_dimensions"], {"width": width, "height": height})
        self.assertIn("inference_time_ms", result)

        summary = result["detection_summary"]
        self.assertEqual(
            summary["total_objects"],
            summary["class_counts"]["fresh-tomato"] + summary["class_counts"]["rotten-tomato"],
        )
        self.assertEqual(summary["total_objects"], len(result["detections"]))

    def test_zero_objects_threshold_edge_case(self):
        # Threshold 0.99 should yield 0 objects without crash
        width, height = 800, 600
        result = asyncio.run(
            predict_harvest_image_mock(
                image_bytes=b"fake_bytes",
                width=width,
                height=height,
                confidence_threshold=0.99,
                simulate_delay=False,
            )
        )
        self.assertEqual(result["detection_summary"]["total_objects"], 0)
        self.assertEqual(result["detection_summary"]["class_counts"]["fresh-tomato"], 0)
        self.assertEqual(result["detection_summary"]["class_counts"]["rotten-tomato"], 0)


    def test_invalid_dimensions_rejection(self):
        with self.assertRaises(ValueError):
            generate_mock_detections(0, 720)
        with self.assertRaises(ValueError):
            generate_mock_detections(1280, -10)

    def test_invalid_confidence_threshold_rejection(self):
        with self.assertRaises(ValueError):
            generate_mock_detections(640, 480, confidence_threshold=-0.1)
        with self.assertRaises(ValueError):
            generate_mock_detections(640, 480, confidence_threshold=1.5)


if __name__ == "__main__":
    unittest.main()
