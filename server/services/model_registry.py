"""Load and validate model manifests against deployable model artifacts."""

from __future__ import annotations

import ast
import hashlib
import json
import re
from pathlib import Path
from typing import Any


CANONICAL_CLASSES = {"0": "Grade A", "1": "Grade B", "2": "Reject"}
_SHA256_RE = re.compile(r"^[0-9a-f]{64}$")


class ModelContractError(ValueError):
    """Raised when a manifest or model artifact violates the deployment contract."""


def _require_fields(value: dict, fields: tuple[str, ...], section: str) -> None:
    for field in fields:
        if field not in value:
            raise ModelContractError(f"Model manifest is missing required field '{section}.{field}'")


def _require_nonempty_string(value: Any, field: str) -> None:
    if not isinstance(value, str) or not value.strip():
        raise ModelContractError(f"Model manifest field '{field}' must be a non-empty string")


def _validate_manifest_structure(manifest: dict) -> None:
    _require_fields(
        manifest,
        ("model", "artifacts", "dataset", "grading", "inference", "deployment"),
        "manifest",
    )

    model = manifest["model"]
    if not isinstance(model, dict):
        raise ModelContractError("Model manifest field 'model' must be an object")
    _require_fields(
        model,
        (
            "name",
            "version",
            "architecture",
            "task",
            "framework",
            "framework_version",
            "input_size",
            "files",
        ),
        "model",
    )
    for field in ("name", "version", "architecture", "task", "framework", "framework_version"):
        _require_nonempty_string(model[field], f"model.{field}")
    if (
        isinstance(model["input_size"], bool)
        or not isinstance(model["input_size"], int)
        or model["input_size"] <= 0
    ):
        raise ModelContractError("Model manifest field 'model.input_size' must be a positive integer")
    files = model["files"]
    if not isinstance(files, dict):
        raise ModelContractError("Model manifest field 'model.files' must be an object")
    _require_fields(files, ("pytorch", "onnx", "dataset_config"), "model.files")
    for field in ("pytorch", "onnx", "dataset_config"):
        _require_nonempty_string(files[field], f"model.files.{field}")

    artifacts = manifest["artifacts"]
    if not isinstance(artifacts, dict) or not artifacts:
        raise ModelContractError("Model manifest field 'artifacts' must be a non-empty object")
    for filename, digest in artifacts.items():
        _require_nonempty_string(filename, "artifacts filename")
        if not isinstance(digest, str) or not _SHA256_RE.fullmatch(digest):
            raise ModelContractError(f"Model manifest artifact '{filename}' must have a valid SHA-256 digest")

    dataset = manifest["dataset"]
    if not isinstance(dataset, dict):
        raise ModelContractError("Model manifest field 'dataset' must be an object")
    _require_fields(dataset, ("name", "source", "classes"), "dataset")
    for field in ("name", "source"):
        _require_nonempty_string(dataset[field], f"dataset.{field}")
    _ordered_classes(dataset["classes"], "Manifest")

    grading = manifest["grading"]
    if not isinstance(grading, dict):
        raise ModelContractError("Model manifest field 'grading' must be an object")
    _require_fields(grading, ("mapping",), "grading")
    status_field = "mapping_status" if "mapping_status" in grading else "system"
    if status_field not in grading:
        raise ModelContractError(
            "Model manifest is missing required field 'grading.mapping_status' or 'grading.system'"
        )
    _require_nonempty_string(grading[status_field], f"grading.{status_field}")
    if not isinstance(grading["mapping"], dict):
        raise ModelContractError("Model manifest field 'grading.mapping' must be an object")

    inference = manifest["inference"]
    if not isinstance(inference, dict):
        raise ModelContractError("Model manifest field 'inference' must be an object")
    _require_fields(
        inference,
        ("default_confidence_threshold", "recommended_input_size"),
        "inference",
    )
    threshold = inference["default_confidence_threshold"]
    if (
        isinstance(threshold, bool)
        or not isinstance(threshold, (int, float))
        or not 0 <= threshold <= 1
    ):
        raise ModelContractError("Model manifest field 'inference.default_confidence_threshold' must be between 0 and 1")
    if (
        isinstance(inference["recommended_input_size"], bool)
        or not isinstance(inference["recommended_input_size"], int)
        or inference["recommended_input_size"] <= 0
    ):
        raise ModelContractError(
            "Model manifest field 'inference.recommended_input_size' must be a positive integer"
        )

    deployment = manifest["deployment"]
    if not isinstance(deployment, dict):
        raise ModelContractError("Model manifest field 'deployment' must be an object")
    _require_fields(deployment, ("status", "recommended_backend"), "deployment")
    for field in ("status", "recommended_backend"):
        _require_nonempty_string(deployment[field], f"deployment.{field}")


def load_model_manifest(commodity: str, base_dir: str) -> dict:
    """Load a commodity's JSON model manifest, rejecting invalid inputs clearly."""
    if not isinstance(commodity, str) or not commodity.strip():
        raise ModelContractError("Commodity must be a non-empty directory name")
    if Path(commodity).name != commodity or commodity in {".", ".."}:
        raise ModelContractError(f"Invalid commodity directory: {commodity!r}")

    manifest_path = Path(base_dir) / commodity / "model-metadata.json"
    try:
        with manifest_path.open("r", encoding="utf-8") as manifest_file:
            manifest = json.load(manifest_file)
    except FileNotFoundError as exc:
        raise ModelContractError(f"Model manifest not found: {manifest_path}") from exc
    except (OSError, json.JSONDecodeError) as exc:
        raise ModelContractError(f"Could not read model manifest {manifest_path}: {exc}") from exc

    if not isinstance(manifest, dict):
        raise ModelContractError(f"Model manifest must contain a JSON object: {manifest_path}")
    _validate_manifest_structure(manifest)
    return manifest


def sha256_file(path: str) -> str:
    """Return the SHA-256 digest of a file, reading it in bounded-size chunks."""
    digest = hashlib.sha256()
    try:
        with open(path, "rb") as artifact:
            for chunk in iter(lambda: artifact.read(1024 * 1024), b""):
                digest.update(chunk)
    except OSError as exc:
        raise ModelContractError(f"Could not read model artifact {path}: {exc}") from exc
    return digest.hexdigest()


def _ordered_classes(classes: Any, source: str) -> list[str]:
    if not isinstance(classes, dict):
        raise ModelContractError(f"{source} must define class IDs and names")
    try:
        ordered = [classes[key] for key in ("0", "1", "2")]
    except KeyError as exc:
        raise ModelContractError(f"{source} must define class IDs 0, 1, and 2") from exc
    if len(classes) != 3 or ordered != list(CANONICAL_CLASSES.values()):
        raise ModelContractError(
            f"{source} class order must be exactly Grade A, Grade B, Reject at IDs 0, 1, 2"
        )
    return ordered


def _metadata_classes(session_metadata: dict) -> list[str]:
    raw_names = session_metadata.get("names")
    if raw_names is None:
        raise ModelContractError("ONNX session metadata is missing embedded 'names'")
    if isinstance(raw_names, str):
        try:
            raw_names = ast.literal_eval(raw_names)
        except (SyntaxError, ValueError) as exc:
            raise ModelContractError("ONNX embedded class names are not valid literal metadata") from exc
    if not isinstance(raw_names, dict):
        raise ModelContractError("ONNX embedded class names must be a mapping")

    normalized: dict[str, Any] = {}
    for key, value in raw_names.items():
        if isinstance(key, bool) or not isinstance(key, (str, int)):
            raise ModelContractError("ONNX embedded class IDs must be integers or numeric strings")
        normalized[str(key)] = value
    return _ordered_classes(normalized, "ONNX embedded")


def validate_model_artifact(
    manifest: dict,
    artifact_path: str,
    session_metadata: dict | None = None,
) -> None:
    """Verify canonical class order, deployable artifact digest, and optional ONNX names."""
    if not isinstance(manifest, dict):
        raise ModelContractError("Model manifest must be a JSON object")

    dataset = manifest.get("dataset")
    if not isinstance(dataset, dict):
        raise ModelContractError("Model manifest must define dataset classes")
    expected_classes = _ordered_classes(dataset.get("classes"), "Manifest")

    artifact = Path(artifact_path)
    if not artifact.is_file():
        raise ModelContractError(f"Model artifact not found: {artifact_path}")

    artifacts = manifest.get("artifacts")
    if not isinstance(artifacts, dict):
        raise ModelContractError("Model manifest must define artifact SHA-256 digests")
    configured_digest = artifacts.get(artifact.name)
    if not isinstance(configured_digest, str) or not _SHA256_RE.fullmatch(configured_digest):
        raise ModelContractError(f"Manifest has no valid SHA-256 for artifact {artifact.name}")

    actual_digest = sha256_file(str(artifact))
    if actual_digest != configured_digest:
        raise ModelContractError(
            f"SHA-256 mismatch for {artifact.name}: expected {configured_digest}, got {actual_digest}"
        )

    if session_metadata is not None:
        if not isinstance(session_metadata, dict):
            raise ModelContractError("ONNX session metadata must be a mapping")
        embedded_classes = _metadata_classes(session_metadata)
        if embedded_classes != expected_classes:
            raise ModelContractError("ONNX embedded class order does not match the manifest")
