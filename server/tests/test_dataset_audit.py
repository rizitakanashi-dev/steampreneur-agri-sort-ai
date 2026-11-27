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
        (self.root / "test/labels/polygon.txt").write_text("1 0.1 0.1 0.2 0.1 0.2 0.2\n")
        report = audit_yolo_dataset(str(self.root))
        self.assertNotIn("dataset_root", report)
        self.assertNotIn("dataset_config", report)
        self.assertEqual(report["splits"]["train"]["image_count"], 1)
        self.assertEqual(report["splits"]["train"]["class_object_counts"]["Grade A"], 1)
        self.assertEqual(report["splits"]["train"]["image_resolution_counts"], {"32x24": 1})
        self.assertEqual(report["splits"]["test"]["invalid_label_rows"], 2)
        self.assertEqual(report["splits"]["test"]["invalid_label_field_counts"], {5: 1, 7: 1})
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

    def test_audits_a_four_class_dataset_without_dropping_class_counts(self):
        (self.root / "data.yaml").write_text(
            "nc: 4\nnames: ['Extra Class', 'Class I', 'Class II', 'Reject']\n"
        )
        (self.root / "train/labels/a.txt").write_text("3 0.5 0.5 0.25 0.25\n")
        report = audit_yolo_dataset(str(self.root))
        self.assertEqual(len(report["dataset_class_names"]), 4)
        self.assertFalse(report["class_order_compatible"])
        self.assertEqual(report["splits"]["train"]["class_object_counts"]["Reject"], 1)
        self.assertEqual(report["splits"]["train"]["invalid_label_rows"], 0)

    def test_export_manifest_is_deterministic_and_changes_with_label_content(self):
        first = audit_yolo_dataset(str(self.root))
        second = audit_yolo_dataset(str(self.root))
        self.assertEqual(first["export_manifest"], second["export_manifest"])
        self.assertGreater(first["export_manifest"]["file_count"], 0)
        (self.root / "train/labels/a.txt").write_text("1 0.5 0.5 0.25 0.25\n")
        changed = audit_yolo_dataset(str(self.root))
        self.assertNotEqual(
            first["export_manifest"]["sha256"],
            changed["export_manifest"]["sha256"],
        )


if __name__ == "__main__":
    unittest.main()
