import hashlib
import json
import tempfile
import unittest
from pathlib import Path

from server.services.model_registry import ModelContractError, load_model_manifest


REPO_ROOT = Path(__file__).resolve().parents[2]
MODELS = REPO_ROOT / "server" / "models"
EVIDENCE = REPO_ROOT / "docs" / "model-evaluation" / "evidence"


def sha256_file(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as handle:
        for chunk in iter(lambda: handle.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()


class TestModelProvenanceContract(unittest.TestCase):
    def load(self, commodity: str) -> dict:
        return load_model_manifest(commodity, str(MODELS))

    def test_every_manifest_separates_training_and_evaluation_datasets(self):
        for commodity in ("terung", "tomat", "cabai"):
            with self.subTest(commodity=commodity):
                manifest = self.load(commodity)
                self.assertEqual(manifest["dataset"]["role"], "training")
                self.assertIn(manifest["dataset"]["provenance_status"], {"VERIFIED", "PARTIALLY_VERIFIED", "UNVERIFIED", "CONFLICTED"})
                self.assertTrue(manifest["evaluation_datasets"])
                self.assertTrue(all(item["role"] for item in manifest["evaluation_datasets"]))
                self.assertNotEqual(manifest["deployment"]["status"], "validated")
                self.assertEqual(manifest["deployment"]["readiness"], "BLOCKED")

    def test_valid_instance_totals_match_class_totals(self):
        for commodity in ("terung", "tomat", "cabai"):
            with self.subTest(commodity=commodity):
                manifest = self.load(commodity)
                for item in manifest["evaluation_datasets"]:
                    counts = item["annotation_counts"]
                    self.assertEqual(
                        sum(counts["valid_instances"].values()),
                        sum(counts["class_instances"].values()),
                    )

    def test_tomat_and_cabai_training_dataset_is_not_the_local_external_export(self):
        tomat = self.load("tomat")
        cabai = self.load("cabai")
        self.assertEqual(tomat["dataset"]["name"], "tomato-thesis-e4")
        self.assertEqual(cabai["dataset"]["name"], "Chili-Data-set-v4")
        self.assertEqual(tomat["evaluation_datasets"][0]["name"], "tomato-freshness.v1-tomat.yolov11")
        self.assertEqual(cabai["evaluation_datasets"][0]["name"], "Smart Conveyor Cabai Rawit.v1i.yolov11")
        self.assertNotEqual(tomat["dataset"]["name"], tomat["evaluation_datasets"][0]["name"])
        self.assertNotEqual(cabai["dataset"]["name"], cabai["evaluation_datasets"][0]["name"])

    def test_cabai_external_export_does_not_claim_any_valid_boxes(self):
        cabai = self.load("cabai")
        external = cabai["evaluation_datasets"][0]
        counts = external["annotation_counts"]
        self.assertEqual(external["audit_status"], "FAILED_INVALID_LABELS")
        self.assertEqual(sum(counts["valid_instances"].values()), 0)
        self.assertEqual(sum(counts["invalid_label_rows"].values()), 1818)
        self.assertEqual(sum(counts["class_instances"].values()), 0)
        self.assertFalse(external["usable_as_primary_held_out_test"])

    def test_manifest_hashes_match_available_files_and_audit_evidence(self):
        cases = {
            "terung": "terung-eggplant-quality-grades-v2.audit.json",
            "tomat": "tomat-tomato-freshness-v1.audit.json",
            "cabai": "cabai-smart-conveyor-v1.audit.json",
        }
        for commodity, audit_name in cases.items():
            with self.subTest(commodity=commodity):
                manifest = self.load(commodity)
                audit = json.loads((EVIDENCE / audit_name).read_text(encoding="utf-8"))
                external = manifest["evaluation_datasets"][0]
                self.assertEqual(external["export_manifest_sha256"], audit["export_manifest"]["sha256"])
                self.assertEqual(external["annotation_tree_sha256"], audit["export_manifest"]["label_manifest_sha256"])
                self.assertEqual(external["annotation_counts"]["label_files"], {
                    split: item["label_count"] for split, item in audit["splits"].items()
                })
                self.assertEqual(external["annotation_counts"]["valid_instances"], {
                    split: item["object_count"] for split, item in audit["splits"].items()
                })
                for name, digest in manifest["artifacts"].items():
                    self.assertEqual(sha256_file(MODELS / commodity / name), digest)

    def test_terung_config_hash_matches_local_export(self):
        manifest = self.load("terung")
        dataset_root = Path(manifest["dataset"]["source_path"])
        self.assertEqual(sha256_file(dataset_root / "data.yaml"), manifest["dataset"]["data_config_sha256"])

    def test_manifest_rejects_unknown_provenance_status(self):
        manifest = self.load("terung")
        manifest["dataset"]["provenance_status"] = "MAYBE"
        with tempfile.TemporaryDirectory() as temp:
            target = Path(temp) / "terung"
            target.mkdir()
            (target / "model-metadata.json").write_text(json.dumps(manifest), encoding="utf-8")
            with self.assertRaisesRegex(ModelContractError, "provenance_status"):
                load_model_manifest("terung", temp)

    def test_validation_gate_rejects_candidate_manifest_relabelled_as_validated(self):
        manifest = self.load("terung")
        manifest["deployment"]["status"] = "validated"
        with tempfile.TemporaryDirectory() as temp:
            target = Path(temp) / "terung"
            target.mkdir()
            (target / "model-metadata.json").write_text(json.dumps(manifest), encoding="utf-8")
            with self.assertRaisesRegex(ModelContractError, "provenance_status == VERIFIED"):
                load_model_manifest("terung", temp)

    def test_validation_gate_rejects_validated_status_with_blocked_readiness(self):
        manifest = self.load("terung")
        manifest["deployment"]["status"] = "validated"
        manifest["dataset"]["provenance_status"] = "VERIFIED"
        manifest["dataset"]["license_status"] = "VERIFIED"
        manifest["dataset"]["annotation_counts_status"] = "VERIFIED"
        manifest["dataset"]["semantics_status"] = "verified"
        manifest["grading"]["mapping_status"] = "verified"
        manifest["evaluation"] = {
            "status": "PASSED",
            "threshold_frozen": True,
            "held_out_test": True,
            "acceptance_criteria_approved": True,
            "metrics_report": "docs/model-evaluation/example-report.md",
        }
        with tempfile.TemporaryDirectory() as temp:
            target = Path(temp) / "terung"
            target.mkdir()
            (target / "model-metadata.json").write_text(json.dumps(manifest), encoding="utf-8")
            with self.assertRaisesRegex(ModelContractError, "readiness == VALIDATED"):
                load_model_manifest("terung", temp)

    def test_validation_gate_accepts_only_complete_explicit_evidence(self):
        manifest = self.load("terung")
        manifest["deployment"]["status"] = "validated"
        manifest["deployment"]["readiness"] = "VALIDATED"
        manifest["dataset"]["provenance_status"] = "VERIFIED"
        manifest["dataset"]["license_status"] = "VERIFIED"
        manifest["dataset"]["annotation_counts_status"] = "VERIFIED"
        manifest["dataset"]["semantics_status"] = "verified"
        manifest["grading"]["mapping_status"] = "verified"
        manifest["evaluation"] = {
            "status": "PASSED",
            "threshold_frozen": True,
            "held_out_test": True,
            "acceptance_criteria_approved": True,
            "metrics_report": "docs/model-evaluation/example-report.md",
        }
        with tempfile.TemporaryDirectory() as temp:
            target = Path(temp) / "terung"
            target.mkdir()
            (target / "model-metadata.json").write_text(json.dumps(manifest), encoding="utf-8")
            loaded = load_model_manifest("terung", temp)
            self.assertEqual(loaded["deployment"]["status"], "validated")


if __name__ == "__main__":
    unittest.main()
