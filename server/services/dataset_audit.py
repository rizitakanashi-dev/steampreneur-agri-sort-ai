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


def _class_order(config_path: Path) -> bool:
    if not config_path.is_file():
        return False
    try:
        text = config_path.read_text(encoding="utf-8")
        nc = re.search(r"(?m)^\s*nc\s*:\s*(\d+)\s*$", text)
        names = re.search(r"(?m)^\s*names\s*:\s*(\[[^\n]*\])\s*$", text)
        return bool(nc and names and int(nc.group(1)) == 3 and ast.literal_eval(names.group(1)) == list(CLASS_NAMES.values()))
    except (OSError, UnicodeError, SyntaxError, ValueError):
        return False


def audit_yolo_dataset(dataset_root: str, yaml_path: str | None = None) -> dict[str, Any]:
    """Summarize structure, label validity and exact image duplicates, never image contents."""
    root = Path(dataset_root).expanduser().resolve()
    config_path = Path(yaml_path).expanduser().resolve() if yaml_path else root / "data.yaml"
    class_order_compatible = _class_order(config_path)
    missing_split_directories: list[str] = []
    splits: dict[str, Any] = {}
    hashes_by_split: dict[str, dict[str, list[str]]] = {}
    any_invalid = False
    any_unpaired = False

    for split in SPLITS:
        image_dir, label_dir = root / split / "images", root / split / "labels"
        if not image_dir.is_dir() or not label_dir.is_dir():
            missing_split_directories.append(split)
        images = {p.stem: p for p in image_dir.iterdir() if p.is_file() and p.suffix.lower() in IMAGE_SUFFIXES} if image_dir.is_dir() else {}
        labels = {p.stem: p for p in label_dir.iterdir() if p.is_file() and p.suffix.lower() == ".txt"} if label_dir.is_dir() else {}
        unpaired_image_count = len(images.keys() - labels.keys())
        unpaired_label_count = len(labels.keys() - images.keys())
        any_unpaired |= bool(unpaired_image_count or unpaired_label_count)
        counts = {name: 0 for name in CLASS_NAMES.values()}
        invalid_rows = 0
        object_count = 0
        empty_labels = 0
        corrupt_images = []
        for stem, image_path in images.items():
            try:
                with Image.open(image_path) as image:
                    image.verify()
            except Exception:
                corrupt_images.append(stem)
        for stem, label_path in labels.items():
            try:
                lines = label_path.read_text(encoding="utf-8").splitlines()
            except (OSError, UnicodeError):
                invalid_rows += 1
                continue
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
                try:
                    if len(fields) != 5:
                        raise ValueError
                    class_value = float(fields[0])
                    values = [float(value) for value in fields[1:]]
                    if not class_value.is_integer() or int(class_value) not in CLASS_NAMES:
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
                    continue
                counts[CLASS_NAMES[class_id]] += 1
                object_count += 1
        any_invalid |= invalid_rows > 0 or bool(corrupt_images)
        split_hashes: dict[str, list[str]] = {}
        for stem, image_path in images.items():
            try:
                digest = hashlib.sha256(image_path.read_bytes()).hexdigest()
            except OSError:
                continue
            split_hashes.setdefault(digest, []).append(f"{split}/{image_path.name}")
        hashes_by_split[split] = split_hashes
        splits[split] = {
            "image_count": len(images), "label_count": len(labels),
            "unpaired_image_count": unpaired_image_count, "unpaired_label_count": unpaired_label_count,
            "corrupt_image_count": len(corrupt_images), "invalid_label_rows": invalid_rows,
            "empty_labels": empty_labels, "object_count": object_count,
            "class_object_counts": counts,
        }

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
        "class_order_compatible": class_order_compatible,
        "missing_split_directories": missing_split_directories,
        "splits": splits,
        "duplicate_image_hashes": {"within_split_groups": within_split_groups, "cross_split_groups": cross_split_groups},
        "structural_format_compatible": class_order_compatible and not missing_split_directories and not any_unpaired and not any_invalid and cross_split_groups == 0,
        "rubric_status": "unverified",
        "data_eligible_for_commercial_grading": False,
    }
