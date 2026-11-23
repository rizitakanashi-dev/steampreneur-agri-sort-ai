import tempfile
import unittest
from pathlib import Path

from PIL import Image

from server.services.dataset_audit import audit_yolo_dataset


class TestDatasetAudit(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.addCleanup(self.temp.cleanup)
        self.root = Path(self.temp.name)
        (self.root / "data.yaml").write_text("nc: 3\nnames: ['Grade A', 'Grade B', 'Reject']\n")
        for split in ("train", "valid", "test"):
            (self.root / split / "images").mkdir(parents=True)
            (self.root / split / "labels").mkdir(parents=True)
        Image.new("RGB", (32, 24), "green").save(self.root / "train/images/a.jpg")
        (self.root / "valid/images/dup.jpg").write_bytes((self.root / "train/images/a.jpg").read_bytes())
        (self.root / "train/labels/a.txt").write_text("0 0.5 0.5 0.25 0.25\n")
        (self.root / "valid/labels/dup.txt").write_text("2 0.5 0.5 0.25 0.25\n")

    def test_reports_counts_pairing_invalid_boxes_and_cross_split_duplicate(self):
        (self.root / "test/images/orphan.jpg").write_bytes((self.root / "train/images/a.jpg").read_bytes())
        (self.root / "test/labels/malformed.txt").write_text("4 0.5 0.5 0.2 0.2\n")
        report = audit_yolo_dataset(str(self.root))
        self.assertNotIn("dataset_root", report)
        self.assertNotIn("dataset_config", report)
        self.assertEqual(report["splits"]["train"]["image_count"], 1)
        self.assertEqual(report["splits"]["train"]["class_object_counts"]["Grade A"], 1)
        self.assertEqual(report["splits"]["test"]["invalid_label_rows"], 1)
        self.assertEqual(report["splits"]["test"]["unpaired_image_count"], 1)
        self.assertEqual(report["duplicate_image_hashes"]["cross_split_groups"], 1)
        encoded = str(report)
        self.assertNotIn("a.jpg", encoded)
        self.assertNotIn("orphan.jpg", encoded)
        self.assertFalse(report["structural_format_compatible"])

    def test_reports_missing_split_directories_and_class_order(self):
        (self.root / "data.yaml").write_text("nc: 3\nnames: ['Grade B', 'Grade A', 'Reject']\n")
        (self.root / "test/images").rmdir()
        report = audit_yolo_dataset(str(self.root))
        self.assertFalse(report["class_order_compatible"])
        self.assertIn("test", report["missing_split_directories"])
        self.assertFalse(report["structural_format_compatible"])

    def test_reports_within_split_duplicate_images(self):
        Image.new("RGB", (32, 24), "green").save(self.root / "train/images/copy.jpg")
        (self.root / "train/labels/copy.txt").write_text("")
        report = audit_yolo_dataset(str(self.root))
        self.assertEqual(report["duplicate_image_hashes"]["within_split_groups"], 1)


if __name__ == "__main__":
    unittest.main()
