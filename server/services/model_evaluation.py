"""Exploratory full-pipeline model evaluation and detection metrics.

This module measures agreement with the supplied annotations. It does not
establish that the dataset's grade labels are semantically correct.
"""

from __future__ import annotations

import math
from pathlib import Path
from typing import Any, Callable

from PIL import Image, ImageOps

from server.services.ai_engine import ai_engine

CLASS_NAMES = {0: "Grade A", 1: "Grade B", 2: "Reject"}
IMAGE_SUFFIXES = {".jpg", ".jpeg", ".png", ".bmp", ".webp", ".tif", ".tiff"}


class DatasetFormatError(ValueError):
    """Raised when a YOLO dataset cannot be interpreted safely."""


def _image_id(image: dict[str, Any]) -> str:
    return str(image.get("image_id", image.get("image_path", image.get("path", ""))))


def _box_values(box: Any) -> list[float]:
    if isinstance(box, dict):
        try:
            values = [float(box[key]) for key in ("x1", "y1", "x2", "y2")]
        except (KeyError, TypeError, ValueError) as exc:
            raise ValueError(f"Invalid box: {box!r}") from exc
    else:
        try:
            values = [float(value) for value in box]
        except (TypeError, ValueError) as exc:
            raise ValueError(f"Invalid box: {box!r}") from exc
    if len(values) != 4 or not all(math.isfinite(value) for value in values):
        raise ValueError(f"Invalid box: {box!r}")
    if values[2] <= values[0] or values[3] <= values[1]:
        raise ValueError(f"Box must have positive area: {box!r}")
    return values


def _class_id(item: dict[str, Any]) -> int:
    try:
        class_id = int(item["class_id"])
    except (KeyError, TypeError, ValueError) as exc:
        raise ValueError(f"Invalid class_id in {item!r}") from exc
    if class_id not in CLASS_NAMES:
        raise ValueError(f"class_id must be one of {sorted(CLASS_NAMES)}, got {class_id}")
    return class_id


def _iou(first: Any, second: Any) -> float:
    ax1, ay1, ax2, ay2 = _box_values(first)
    bx1, by1, bx2, by2 = _box_values(second)
    intersection = max(0.0, min(ax2, bx2) - max(ax1, bx1)) * max(
        0.0, min(ay2, by2) - max(ay1, by1)
    )
    area_a = (ax2 - ax1) * (ay2 - ay1)
    area_b = (bx2 - bx1) * (by2 - by1)
    return intersection / (area_a + area_b - intersection)


def _average_precision(tp_flags: list[int], fp_flags: list[int], num_ground_truth: int) -> float:
    if num_ground_truth == 0:
        return 0.0
    if not tp_flags:
        return 0.0
    tp_cumulative: list[int] = []
    fp_cumulative: list[int] = []
    tp = fp = 0
    for is_tp, is_fp in zip(tp_flags, fp_flags):
        tp += is_tp
        fp += is_fp
        tp_cumulative.append(tp)
        fp_cumulative.append(fp)
    recalls = [count / num_ground_truth for count in tp_cumulative]
    precisions = [t / (t + f) if t + f else 0.0 for t, f in zip(tp_cumulative, fp_cumulative)]
    # COCO-style 101-point interpolated AP, deterministic for score ties.
    samples = []
    for index in range(101):
        recall_level = index / 100
        samples.append(max((p for r, p in zip(recalls, precisions) if r >= recall_level), default=0.0))
    return sum(samples) / len(samples)


def _metrics_at_iou(
    ground_truth: list[dict[str, Any]], predictions: list[dict[str, Any]], iou_threshold: float
) -> dict[str, Any]:
    if not 0.0 <= iou_threshold <= 1.0:
        raise ValueError("iou_threshold must be between 0 and 1")

    gt_by_class_image: dict[tuple[int, str], list[dict[str, Any]]] = {}
    pred_by_class: dict[int, list[dict[str, Any]]] = {class_id: [] for class_id in CLASS_NAMES}
    for item in ground_truth:
        class_id = _class_id(item)
        image_id = _image_id(item)
        box = _box_values(item["box"])
        gt_by_class_image.setdefault((class_id, image_id), []).append({"box": box, "matched": False})
    for index, item in enumerate(predictions):
        class_id = _class_id(item)
        box = _box_values(item["box"])
        confidence = float(item.get("confidence", 1.0))
        if not math.isfinite(confidence):
            raise ValueError("Prediction confidence must be finite")
        pred_by_class[class_id].append(
            {"input_index": index, "image_id": _image_id(item), "box": box, "confidence": confidence}
        )

    per_class: dict[str, dict[str, Any]] = {}
    matching_details: list[dict[str, Any]] = []
    for class_id, class_name in CLASS_NAMES.items():
        truths = [item for (cid, _), items in gt_by_class_image.items() if cid == class_id for item in items]
        detections = sorted(pred_by_class[class_id], key=lambda item: (-item["confidence"], item["image_id"], item["input_index"]))
        ap_tp: list[int] = []
        ap_fp: list[int] = []
        tp = fp = 0
        for detection in detections:
            candidates = gt_by_class_image.get((class_id, detection["image_id"]), [])
            best = None
            best_iou = -1.0
            for target_index, target in enumerate(candidates):
                if target["matched"]:
                    continue
                overlap = _iou(detection["box"], target["box"])
                if overlap > best_iou:
                    best, best_iou = target_index, overlap
            if best is not None and best_iou >= iou_threshold:
                gt_by_class_image[(class_id, detection["image_id"])][best]["matched"] = True
                tp += 1
                ap_tp.append(1)
                ap_fp.append(0)
                matching_details.append({
                    "prediction_index": detection["input_index"], "image_id": detection["image_id"],
                    "class_id": class_id, "ground_truth_index": best, "iou": best_iou, "status": "tp",
                })
            else:
                fp += 1
                ap_tp.append(0)
                ap_fp.append(1)
                matching_details.append({
                    "prediction_index": detection["input_index"], "image_id": detection["image_id"],
                    "class_id": class_id, "ground_truth_index": None,
                    "iou": max(best_iou, 0.0), "status": "fp",
                })
        class_truth_index = 0
        for (truth_class_id, image_id), targets in sorted(gt_by_class_image.items()):
            if truth_class_id != class_id:
                continue
            for target in targets:
                if not target["matched"]:
                    matching_details.append({
                        "prediction_index": None,
                        "image_id": image_id,
                        "class_id": class_id,
                        "ground_truth_index": class_truth_index,
                        "iou": None,
                        "status": "fn",
                    })
                class_truth_index += 1
        fn = len(truths) - tp
        precision = tp / (tp + fp) if tp + fp else 0.0
        recall = tp / (tp + fn) if tp + fn else 0.0
        f1 = 2 * precision * recall / (precision + recall) if precision + recall else 0.0
        per_class[class_name] = {
            "class_id": class_id, "tp": tp, "fp": fp, "fn": fn,
            "precision": precision, "recall": recall, "f1": f1,
            "ap": _average_precision(ap_tp, ap_fp, len(truths)),
            "ground_truth_count": len(truths), "prediction_count": len(detections),
        }

    class_totals = {name: sum(metrics[name] for metrics in per_class.values()) for name in ("tp", "fp", "fn")}
    # Keep the requested aggregate error count as all unmatched object outcomes;
    # expose unmatched detections separately for conventional precision.
    micro = {
        "tp": class_totals["tp"], "fp": class_totals["fp"], "fn": class_totals["fn"],
    }
    precision = micro["tp"] / (micro["tp"] + micro["fp"]) if micro["tp"] + micro["fp"] else 0.0
    recall = micro["tp"] / (micro["tp"] + micro["fn"]) if micro["tp"] + micro["fn"] else 0.0
    f1 = 2 * precision * recall / (precision + recall) if precision + recall else 0.0
    # `total` reports dataset object/prediction counts for backwards-compatible
    # consumers; `micro` is the additive TP/FP/FN confusion summary.
    totals = {
        "tp": micro["tp"],
        "fp": len(predictions),
        "fn": len(ground_truth),
        "detection_fp": micro["fp"],
        "matched_fp": micro["fp"],
        "matched_fn": micro["fn"],
        "precision": precision,
        "recall": recall,
        "f1": f1,
    }
    supported = [metrics["f1"] for metrics in per_class.values() if metrics["ground_truth_count"] > 0]
    supported_ap = [metrics["ap"] for metrics in per_class.values() if metrics["ground_truth_count"] > 0]
    return {
        "iou_threshold": iou_threshold,
        "per_class": per_class,
        "micro": {**micro, "precision": precision, "recall": recall, "f1": f1},
        "total": {**totals, "precision": precision, "recall": recall, "f1": f1},
        "macro_f1": sum(supported) / len(supported) if supported else 0.0,
        "map50": sum(supported_ap) / len(supported_ap) if supported_ap else 0.0,
        "matching_details": matching_details,
    }


def evaluate_predictions(
    ground_truth: list, predictions: list, iou_threshold: float = 0.5
) -> dict:
    """Calculate deterministic class-aware, one-to-one box detection metrics."""
    # A fresh match state per IoU threshold is required for COCO-style mAP.
    base = _metrics_at_iou(ground_truth, predictions, iou_threshold)
    aps = []
    threshold_aps = []
    for threshold_step in range(10):
        threshold = round(0.5 + threshold_step * 0.05, 2)
        result = _metrics_at_iou(ground_truth, predictions, threshold)
        aps.append(result["map50"])
        threshold_aps.append({"iou_threshold": threshold, "map": result["map50"]})
    base["map50_95"] = sum(aps) / len(aps)
    base["map50_95_curve"] = threshold_aps
    return base


def _validate_yolo_label(path: Path, width: int, height: int) -> list[dict[str, Any]]:
    if not path.is_file():
        raise DatasetFormatError(f"Missing annotation file: {path}")
    ground_truth = []
    try:
        lines = path.read_text(encoding="utf-8").splitlines()
    except (OSError, UnicodeError) as exc:
        raise DatasetFormatError(f"Cannot read annotation file {path}: {exc}") from exc
    for line_number, line in enumerate(lines, start=1):
        if not line.strip():
            continue
        fields = line.split()
        if len(fields) != 5:
            raise DatasetFormatError(f"{path}:{line_number}: expected class_id cx cy width height")
        try:
            numeric_class = float(fields[0])
            if not numeric_class.is_integer():
                raise ValueError("class id must be an integer")
            class_id = int(numeric_class)
            coords = [float(value) for value in fields[1:]]
        except ValueError as exc:
            raise DatasetFormatError(f"{path}:{line_number}: non-numeric YOLO label") from exc
        if class_id not in CLASS_NAMES:
            raise DatasetFormatError(f"{path}:{line_number}: unsupported class id {class_id}")
        if not all(math.isfinite(value) and 0.0 <= value <= 1.0 for value in coords):
            raise DatasetFormatError(f"{path}:{line_number}: coordinates must be finite and normalized to [0, 1]")
        cx, cy, box_width, box_height = coords
        if box_width <= 0 or box_height <= 0 or cx - box_width / 2 < 0 or cy - box_height / 2 < 0 or cx + box_width / 2 > 1 or cy + box_height / 2 > 1:
            raise DatasetFormatError(f"{path}:{line_number}: YOLO box is degenerate or outside image bounds")
        ground_truth.append({
            "class_id": class_id,
            "box": [
                (cx - box_width / 2) * width,
                (cy - box_height / 2) * height,
                (cx + box_width / 2) * width,
                (cy + box_height / 2) * height,
            ],
        })
    return ground_truth


def load_yolo_dataset(dataset_root: str, split: str) -> list[dict]:
    """Load a split/images + split/labels YOLO dataset in original pixel coords."""
    if split not in {"train", "valid", "test"}:
        raise ValueError("split must be train, valid, or test")
    root = Path(dataset_root).expanduser().resolve()
    image_dir, label_dir = root / split / "images", root / split / "labels"
    if not image_dir.is_dir() or not label_dir.is_dir():
        raise DatasetFormatError(f"Expected image and label directories: {image_dir} and {label_dir}")
    image_paths = sorted(path for path in image_dir.iterdir() if path.is_file() and path.suffix.lower() in IMAGE_SUFFIXES)
    if not image_paths:
        raise DatasetFormatError(f"No supported images found in {image_dir}")

    records = []
    for image_path in image_paths:
        label_path = label_dir / f"{image_path.stem}.txt"
        try:
            with Image.open(image_path) as opened:
                image = ImageOps.exif_transpose(opened)
                width, height = image.size
                image.verify()
        except Exception as exc:
            raise DatasetFormatError(f"Cannot decode image {image_path}: {exc}") from exc
        ground_truth = _validate_yolo_label(label_path, width, height)
        records.append({
            "image_id": image_path.name,
            "image_path": str(image_path),
            "width": width,
            "height": height,
            "ground_truth": ground_truth,
        })
    return records


def _status_for(result: dict[str, Any], quality: dict[str, Any]) -> tuple[str, str]:
    detections = result.get("detections") or []
    summary = result.get("detection_summary") or {}
    if not detections or summary.get("total_objects", len(detections)) == 0:
        return "needs_review", "zero_objects_detected"
    if quality.get("is_blurry"):
        return "needs_review", "image_blurry"
    if (
        quality.get("is_overexposed")
        or quality.get("is_underexposed")
        or quality.get("lighting_condition") in {"overexposed", "underexposed"}
    ):
        return "needs_review", "image_exposure_extreme"
    mean_confidence = sum(float(item.get("confidence", 0.0)) for item in detections) / len(detections)
    if mean_confidence < 0.45:
        return "needs_review", "low_confidence"
    if summary.get("dense_box_suppressed") or summary.get("disambiguated_count", 0):
        return "needs_review", "inference_review_flag"
    return "ai_detected", "inference_optimal"


def evaluate_scan_pipeline(
    commodity: str,
    dataset_root: str,
    split: str,
    confidence_threshold: float,
    engine=ai_engine,
    quality_analyzer: Callable[[bytes], dict] | None = None,
    enable_slicing: bool = True,
    allow_candidate: bool = False,
    runtime: str | None = None,
) -> dict:
    """Run the production image/quality/inference path for every dataset image."""
    if not 0.0 <= confidence_threshold <= 1.0:
        raise ValueError("confidence_threshold must be between 0 and 1")
    records = load_yolo_dataset(dataset_root, split)
    if quality_analyzer is None:
        from server.utils.image_quality import analyze_image_quality

        quality_analyzer = analyze_image_quality
    all_ground_truth: list[dict[str, Any]] = []
    all_predictions: list[dict[str, Any]] = []
    outcomes = []
    status_counts = {"ai_detected": 0, "needs_review": 0, "pipeline_error": 0}
    pipeline_errors = 0
    unscored_ground_truth_count = 0

    for record in records:
        image_id = record["image_id"]
        try:
            image_bytes = Path(record["image_path"]).read_bytes()
            raw_quality = quality_analyzer(image_bytes)
            allowed_quality_fields = {
                "blur_score", "is_blurry", "mean_luminance", "lighting_condition",
                "clahe_recommended", "quality_verdict", "quality_note",
                "is_overexposed", "is_underexposed", "is_acceptable",
            }
            quality = {key: value for key, value in raw_quality.items() if key in allowed_quality_fields}
            predict_kwargs = {
                "image_bytes": image_bytes,
                "commodity": commodity,
                "confidence_threshold": confidence_threshold,
                "enable_slicing": enable_slicing,
            }
            if runtime is not None:
                predict_kwargs["runtime"] = runtime
            # Candidate access is deliberately absent unless the caller opts in.
            if allow_candidate:
                predict_kwargs["allow_candidate"] = True
            result = engine.predict(**predict_kwargs)
            detections = []
            for detection in result.get("detections", []):
                detections.append({
                    "image_id": image_id,
                    "class_id": detection["class_id"],
                    "confidence": detection.get("confidence", 1.0),
                    "box": detection["box"],
                })
            all_ground_truth.extend({**target, "image_id": image_id} for target in record["ground_truth"])
            all_predictions.extend(detections)
            status, status_reason = _status_for(result, quality)
            status_counts[status] += 1
            outcomes.append({
                "image_id": image_id,
                "status": status,
                "status_reason": status_reason,
                "quality": quality,
                "detection_count": len(detections),
                "inference_time_ms": result.get("inference_time_ms"),
                "model_name": result.get("model_name"),
                "model_version": result.get("model_version"),
                "model_deployment_status": result.get("model_deployment_status"),
                "runtime_engine": result.get("runtime_engine"),
                "slicing_applied": (result.get("detection_summary") or {}).get("slicing_applied"),
            })
        except Exception as exc:
            unscored_ground_truth_count += len(record["ground_truth"])
            pipeline_errors += 1
            status_counts["pipeline_error"] += 1
            outcomes.append({
                "image_id": image_id,
                "status": "pipeline_error",
                "status_reason": "inference_or_preprocessing_failed",
                "error_type": type(exc).__name__,
                "error": str(exc),
                "detection_count": 0,
            })

    metrics = evaluate_predictions(all_ground_truth, all_predictions)
    return {
        "report_type": "exploratory_model_evaluation",
        "rubric_status": "unverified",
        "commodity": commodity,
        "split": split,
        "confidence_threshold": confidence_threshold,
        "slicing_enabled": enable_slicing,
        "candidate_access_enabled": bool(allow_candidate),
        "image_count": len(records),
        "pipeline_failures": pipeline_errors,
        "unscored_ground_truth_count": unscored_ground_truth_count,
        "image_status_counts": status_counts,
        "pipeline_metrics": metrics,
        "images": outcomes,
    }


def calibrate_thresholds(
    validation_results: dict,
    thresholds: list[float],
    objective: str,
    min_reject_recall: float = 0.0,
) -> dict:
    """Choose a confidence threshold using valid-split results only."""
    if validation_results.get("split") != "valid":
        raise ValueError("Threshold calibration is validation-only; split must be 'valid'")
    if not thresholds:
        raise ValueError("At least one threshold is required")
    if not 0.0 <= min_reject_recall <= 1.0:
        raise ValueError("min_reject_recall must be between 0 and 1")
    rows = validation_results.get("threshold_results")
    if rows is None:
        rows = {
            str(row["threshold"]): row["metrics"]
            for row in validation_results.get("evaluations", [])
        }
    curve = []
    for threshold in sorted(set(float(value) for value in thresholds)):
        if not math.isfinite(threshold) or not 0 <= threshold <= 1:
            raise ValueError(f"Invalid threshold: {threshold}")
        row = rows.get(str(threshold), rows.get(f"{threshold:.2f}"))
        if row is None:
            raise ValueError(f"No validation result for threshold {threshold}")
        per_class = row.get("per_class", {})
        reject = per_class.get("Reject", {})
        reject_recall = row.get("reject_recall", reject.get("recall", 0.0))
        reject_precision = row.get("reject_precision", reject.get("precision", 0.0))
        score = row.get(objective)
        if score is None and objective == "macro_f1":
            score = row.get("macro_f1", row.get("pipeline_metrics", {}).get("macro_f1"))
        if score is None:
            raise ValueError(f"Objective {objective!r} missing for threshold {threshold}")
        curve.append({
            "threshold": threshold,
            "objective": objective,
            "score": float(score),
            "reject_recall": float(reject_recall),
            "reject_precision": float(reject_precision),
            "eligible": float(reject_recall) >= min_reject_recall,
        })
    eligible = [row for row in curve if row["eligible"]]
    if not eligible:
        raise ValueError("No threshold meets the minimum Reject recall constraint")
    # Stable, documented tie breaks: objective, Reject recall, Reject precision,
    # then stricter confidence threshold.
    selected = max(eligible, key=lambda row: (row["score"], row["reject_recall"], row["reject_precision"], row["threshold"]))
    return {
        "split": "valid",
        "objective": objective,
        "min_reject_recall": min_reject_recall,
        "threshold_curve": curve,
        "selected_threshold": selected["threshold"],
        "selection_rationale": (
            f"Maximized {objective}; ties were resolved by higher Reject recall, "
            "higher Reject precision, then higher confidence threshold."
        ),
    }
