import hashlib
import json
import tempfile
import unittest
from pathlib import Path

from server.services.model_registry import (
    ModelContractError,
    load_model_manifest,
    sha256_file,
    validate_model_artifact,
)


CANONICAL_CLASSES = {"0": "Grade A", "1": "Grade B", "2": "Reject"}


class TestModelRegistry(unittest.TestCase):
    def setUp(self):
        self.temp_dir = tempfile.TemporaryDirectory()
        self.addCleanup(self.temp_dir.cleanup)
        self.root = Path(self.temp_dir.name)
        self.artifact = self.root / "best.onnx"
        self.artifact.write_bytes(b"deployable model bytes")
        self.digest = hashlib.sha256(b"deployable model bytes").hexdigest()
        self.manifest = {
            "model": {
                "name": "Test model",
                "version": "1.0",
                "architecture": "YOLO11n",
                "task": "object-detection",
                "framework": "Ultralytics",
                "framework_version": "8.4.208",
                "input_size": 640,
                "files": {
                    "pytorch": "best.pt",
                    "onnx": "best.onnx",
                    "dataset_config": "data.yaml",
                },
            },
            "dataset": {"name": "Test dataset", "source": "test fixture", "classes": CANONICAL_CLASSES},
            "artifacts": {"best.onnx": self.digest},
            "grading": {
                "mapping_status": "candidate",
                "mapping": CANONICAL_CLASSES,
            },
            "inference": {
                "default_confidence_threshold": 0.25,
                "recommended_input_size": 640,
            },
            "deployment": {"status": "candidate", "recommended_backend": "ONNX Runtime"},
        }

    def test_accepts_canonical_order_and_matching_artifact(self):
        validate_model_artifact(self.manifest, str(self.artifact))

    def test_rejects_wrong_or_missing_classes(self):
        for classes in (
            {"0": "Grade B", "1": "Grade A", "2": "Reject"},
            {"0": "Grade A", "1": "Reject", "2": "Grade B"},
            {"0": "Grade A", "1": "Grade B"},
            {"0": "Grade A", "1": "Grade B", "2": "Other"},
        ):
            with self.subTest(classes=classes):
                manifest = {**self.manifest, "dataset": {"classes": classes}}
                with self.assertRaises(ModelContractError):
                    validate_model_artifact(manifest, str(self.artifact))

    def test_rejects_missing_or_invalid_configured_digest(self):
        for artifacts in ({}, {"best.onnx": "not-a-digest"}):
            with self.subTest(artifacts=artifacts):
                manifest = {**self.manifest, "artifacts": artifacts}
                with self.assertRaises(ModelContractError):
                    validate_model_artifact(manifest, str(self.artifact))

    def test_rejects_digest_mismatch(self):
        manifest = {
            **self.manifest,
            "artifacts": {"best.onnx": "0" * 64},
        }
        with self.assertRaises(ModelContractError):
            validate_model_artifact(manifest, str(self.artifact))

    def test_rejects_mismatched_embedded_onnx_names(self):
        metadata = {"names": "{0: 'Grade B', 1: 'Grade A', 2: 'Reject'}"}
        with self.assertRaises(ModelContractError):
            validate_model_artifact(self.manifest, str(self.artifact), metadata)

    def test_hashes_exact_file_bytes(self):
        self.assertEqual(
            sha256_file(str(self.artifact)),
            "df84df4997da45ea3efd7ae26fccd7b1e1ec3edf0da74a72add9e365af3ba744",
        )

    def test_loads_manifest_and_fails_cleanly_when_manifest_missing_or_invalid(self):
        manifest_path = self.root / "tomat" / "model-metadata.json"
        manifest_path.parent.mkdir()
        manifest_path.write_text(json.dumps(self.manifest), encoding="utf-8")
        self.assertEqual(load_model_manifest("tomat", str(self.root)), self.manifest)

        with self.assertRaises(ModelContractError):
            load_model_manifest("missing", str(self.root))

        manifest_path.write_text("{invalid", encoding="utf-8")
        with self.assertRaises(ModelContractError):
            load_model_manifest("tomat", str(self.root))

    def test_rejects_structurally_incomplete_json_manifest(self):
        manifest_path = self.root / "tomat" / "model-metadata.json"
        manifest_path.parent.mkdir()
        manifest_path.write_text("{}", encoding="utf-8")

        with self.assertRaisesRegex(ModelContractError, "missing required field 'manifest.model'"):
            load_model_manifest("tomat", str(self.root))

    def test_fails_cleanly_when_artifact_is_missing(self):
        with self.assertRaises(ModelContractError):
            validate_model_artifact(self.manifest, str(self.root / "missing.onnx"))

    def test_current_model_manifests_match_deployable_artifact_bytes(self):
        repo_root = Path(__file__).resolve().parents[2]
        for commodity in ("terung", "tomat", "cabai"):
            with self.subTest(commodity=commodity):
                model_dir = repo_root / "server" / "models" / commodity
                manifest = load_model_manifest(commodity, str(model_dir.parent))
                self.assertEqual(manifest["grading"]["mapping_status"], "candidate")
                self.assertEqual(manifest["dataset"]["semantics_status"], "needs_data")
                for filename in ("best.onnx", "best.pt"):
                    validate_model_artifact(manifest, str(model_dir / filename))

    def test_current_onnx_embedded_names_match_manifest_when_runtime_is_available(self):
        try:
            import onnxruntime
        except ImportError:
            self.skipTest("onnxruntime is not installed")

        repo_root = Path(__file__).resolve().parents[2]
        for commodity in ("terung", "tomat", "cabai"):
            with self.subTest(commodity=commodity):
                model_dir = repo_root / "server" / "models" / commodity
                manifest = load_model_manifest(commodity, str(model_dir.parent))
                metadata = onnxruntime.InferenceSession(
                    str(model_dir / "best.onnx"), providers=["CPUExecutionProvider"]
                ).get_modelmeta().custom_metadata_map
                validate_model_artifact(manifest, str(model_dir / "best.onnx"), metadata)


if __name__ == "__main__":
    unittest.main()
