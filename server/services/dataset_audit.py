"""Privacy-conscious structural audit for external YOLO datasets."""

from __future__ import annotations

import ast
import hashlib
import math
import re
from pathlib import Path
from typing import Any

from PIL import Image

from server.services.model_evaluation import CLASS_NAMES

IMAGE_SUFFIXES = {".jpg", ".jpeg", ".png", ".webp"}
SPLITS = ("train", "valid", "test")


def _read_class_names(config_path: Path) -> list[str]:
    """Read the declared YOLO class order without assuming three classes."""
    if not config_path.is_file():
        return []
    try:
        text = config_path.read_text(encoding="utf-8")
        nc = re.search(r"(?m)^\s*nc\s*:\s*(\d+)\s*$", text)
        names = re.search(r"(?m)^\s*names\s*:\s*(\[[^\n]*\])\s*$", text)
        if not nc or not names:
            return []
        parsed = ast.literal_eval(names.group(1))
        if (
            not isinstance(parsed, list)
            or len(parsed) != int(nc.group(1))
            or not all(isinstance(item, str) and item.strip() for item in parsed)
        ):
            return []
        return parsed
    except (OSError, UnicodeError, SyntaxError, ValueError):
        return []


def _class_order(config_path: Path) -> bool:
    """Return whether the dataset matches the production three-class contract."""
    names = _read_class_names(config_path)
    return names == list(CLASS_NAMES.values())


def _sha256_file(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as handle:
        for chunk in iter(lambda: handle.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()


def _manifest_sha256(entries: list[tuple[str, int, str]]) -> str:
    """Hash a sorted path/size/content-digest manifest deterministically."""
    digest = hashlib.sha256()
    for relative_path, size, file_digest in sorted(entries, key=lambda item: item[0]):
        digest.update(relative_path.encode("utf-8"))
        digest.update(b"\0")
        digest.update(str(size).encode("ascii"))
        digest.update(b"\0")
        digest.update(file_digest.encode("ascii"))
        digest.update(b"\n")
    return digest.hexdigest()


def audit_yolo_dataset(dataset_root: str, yaml_path: str | None = None) -> dict[str, Any]:
    """Summarize structure, label validity and exact image duplicates, never image contents."""
    root = Path(dataset_root).expanduser().resolve()
    config_path = Path(yaml_path).expanduser().resolve() if yaml_path else root / "data.yaml"
    class_names = _read_class_names(config_path) or list(CLASS_NAMES.values())
    class_order_compatible = _class_order(config_path)
    missing_split_directories: list[str] = []
    splits: dict[str, Any] = {}
    hashes_by_split: dict[str, dict[str, list[str]]] = {}
    any_invalid = False
    any_unpaired = False
    file_entries: list[tuple[str, int, str]] = []
    label_entries: list[tuple[str, int, str]] = []

    for split in SPLITS:
        image_dir, label_dir = root / split / "images", root / split / "labels"
        if not image_dir.is_dir() or not label_dir.is_dir():
            missing_split_directories.append(split)
        images = {p.stem: p for p in image_dir.iterdir() if p.is_file() and p.suffix.lower() in IMAGE_SUFFIXES} if image_dir.is_dir() else {}
        labels = {p.stem: p for p in label_dir.iterdir() if p.is_file() and p.suffix.lower() == ".txt"} if label_dir.is_dir() else {}
        unpaired_image_count = len(images.keys() - labels.keys())
        unpaired_label_count = len(labels.keys() - images.keys())
        any_unpaired |= bool(unpaired_image_count or unpaired_label_count)
        counts = {name: 0 for name in class_names}
        invalid_rows = 0
        invalid_field_counts: dict[int, int] = {}
        unreadable_labels = 0
        object_count = 0
        empty_labels = 0
        corrupt_images = []
        resolutions: dict[str, int] = {}
        split_hashes: dict[str, list[str]] = {}

        for stem, image_path in images.items():
            try:
                with Image.open(image_path) as image:
                    image.verify()
                with Image.open(image_path) as image:
                    width, height = image.size
            except Exception:
                corrupt_images.append(stem)
                continue
            resolutions[f"{width}x{height}"] = resolutions.get(f"{width}x{height}", 0) + 1
            try:
                size = image_path.stat().st_size
                digest = _sha256_file(image_path)
            except OSError:
                corrupt_images.append(stem)
                continue
            relative_path = image_path.relative_to(root).as_posix()
            file_entries.append((relative_path, size, digest))
            split_hashes.setdefault(digest, []).append(relative_path)

        for stem, label_path in labels.items():
            try:
                data = label_path.read_bytes()
                lines = data.decode("utf-8").splitlines()
            except (OSError, UnicodeError):
                invalid_rows += 1
                unreadable_labels += 1
                continue
            label_size = label_path.stat().st_size
            label_digest = hashlib.sha256(data).hexdigest()
            label_relative = label_path.relative_to(root).as_posix()
            file_entries.append((label_relative, label_size, label_digest))
            label_entries.append((label_relative, label_size, label_digest))
            if not any(line.strip() for line in lines):
                empty_labels += 1
            image_path = images.get(stem)
            dimensions = None
            if image_path:
                try:
                    with Image.open(image_path) as image:
                        dimensions = image.size
                except Exception:
                    pass
            for line in lines:
                if not line.strip():
                    continue
                fields = line.split()
                field_count = len(fields)
                try:
                    if field_count != 5:
                        raise ValueError
                    class_value = float(fields[0])
                    values = [float(value) for value in fields[1:]]
                    if not class_value.is_integer() or not 0 <= int(class_value) < len(class_names):
                        raise ValueError
                    if not all(math.isfinite(v) and 0 <= v <= 1 for v in values):
                        raise ValueError
                    cx, cy, width, height = values
                    if width <= 0 or height <= 0 or cx-width/2 < 0 or cy-height/2 < 0 or cx+width/2 > 1 or cy+height/2 > 1:
                        raise ValueError
                    if dimensions is None:
                        raise ValueError
                    class_id = int(class_value)
                except (TypeError, ValueError):
                    invalid_rows += 1
                    invalid_field_counts[field_count] = invalid_field_counts.get(field_count, 0) + 1
                    continue
                counts[class_names[class_id]] += 1
                object_count += 1
        any_invalid |= invalid_rows > 0 or bool(corrupt_images)
        hashes_by_split[split] = split_hashes
        splits[split] = {
            "image_count": len(images), "label_count": len(labels),
            "unpaired_image_count": unpaired_image_count, "unpaired_label_count": unpaired_label_count,
            "corrupt_image_count": len(corrupt_images), "invalid_label_rows": invalid_rows,
            "invalid_label_field_counts": dict(sorted(invalid_field_counts.items())),
            "unreadable_label_files": unreadable_labels,
            "empty_labels": empty_labels, "object_count": object_count,
            "class_object_counts": counts,
            "image_resolution_counts": dict(sorted(resolutions.items())),
        }

    for extra in (config_path, root / "README.roboflow.txt"):
        if extra.is_file():
            try:
                file_entries.append((extra.relative_to(root).as_posix(), extra.stat().st_size, _sha256_file(extra)))
            except OSError:
                continue

    combined_hashes: dict[str, list[str]] = {}
    for split_hashes in hashes_by_split.values():
        for digest, members in split_hashes.items():
            combined_hashes.setdefault(digest, []).extend(members)
    duplicate_groups = {digest: members for digest, members in combined_hashes.items() if len(members) > 1}
    cross_split_groups = sum(1 for members in duplicate_groups.values() if len({item.split("/", 1)[0] for item in members}) > 1)
    within_split_groups = sum(
        1 for members in duplicate_groups.values()
        if any(sum(item.startswith(f"{split}/") for item in members) > 1 for split in SPLITS)
    )
    return {
        "dataset_class_names": class_names,
        "class_order_compatible": class_order_compatible,
        "missing_split_directories": missing_split_directories,
        "splits": splits,
        "duplicate_image_hashes": {"within_split_groups": within_split_groups, "cross_split_groups": cross_split_groups},
        "export_manifest": {
            "algorithm": "sha256(relative_path NUL size NUL file_sha256 LF), sorted by path",
            "file_count": len(file_entries),
            "sha256": _manifest_sha256(file_entries),
            "label_manifest_sha256": _manifest_sha256(label_entries),
        },
        "structural_format_compatible": class_order_compatible and not missing_split_directories and not any_unpaired and not any_invalid and cross_split_groups == 0,
        "rubric_status": "unverified",
        "data_eligible_for_commercial_grading": False,
    }
