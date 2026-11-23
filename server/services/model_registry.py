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
