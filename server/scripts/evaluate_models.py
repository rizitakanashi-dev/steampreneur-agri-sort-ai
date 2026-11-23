#!/usr/bin/env python3
"""Run an exploratory, reproducible full-pipeline YOLO evaluation."""

from __future__ import annotations

import argparse
import hashlib
import json
import platform
import sys
from datetime import datetime, timezone
from pathlib import Path

# Support both `python -m server.scripts.evaluate_models` and direct execution.
REPOSITORY_ROOT = Path(__file__).resolve().parents[2]
if str(REPOSITORY_ROOT) not in sys.path:
    sys.path.insert(0, str(REPOSITORY_ROOT))

from server.services.model_evaluation import (  # noqa: E402
    calibrate_thresholds,
    evaluate_scan_pipeline,
    load_yolo_dataset,
)
from server.services.ai_engine import ai_engine  # noqa: E402


def _sha256(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as handle:
        for chunk in iter(lambda: handle.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()


def _metadata(dataset_root: Path, split: str, commodity: str) -> dict:
    normalized = commodity.strip().lower()
    if any(alias in normalized for alias in ("terung", "terong", "eggplant")):
        model_key = "terung"
    elif any(alias in normalized for alias in ("tomat", "tomato")):
        model_key = "tomat"
    elif any(alias in normalized for alias in ("cabai", "cabe", "chili", "chilli")):
        model_key = "cabai"
    else:
        model_key = normalized
    manifest = REPOSITORY_ROOT / "server" / "models" / model_key / "model-metadata.json"
    config = dataset_root / "data.yaml"
    return {
        "created_at_utc": datetime.now(timezone.utc).isoformat(),
        "python_version": platform.python_version(),
        "platform": platform.platform(),
        "split": split,
        "dataset_root": str(dataset_root.resolve()),
        "dataset_config_sha256": _sha256(config) if config.is_file() else None,
        "model_manifest_sha256": _sha256(manifest) if manifest.is_file() else None,
        "runtime_preference": getattr(ai_engine, "preferred_runtime", None),
        "reproducibility_note": "Hashes identify configuration/manifest; inference may vary by runtime and hardware.",
    }


def _write_report(path: Path, report: dict) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(report, indent=2, sort_keys=True, allow_nan=False) + "\n", encoding="utf-8")


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--commodity", required=True)
    parser.add_argument("--dataset-root", required=True, type=Path)
    parser.add_argument("--split", required=True, choices=("train", "valid", "test"))
    parser.add_argument("--confidence-threshold", type=float)
    parser.add_argument("--calibrate", action="store_true", help="calibrate on valid split only")
    parser.add_argument("--thresholds", default="0.15,0.20,0.25,0.30,0.35,0.40,0.45,0.50")
    parser.add_argument("--objective", default="macro_f1")
    parser.add_argument("--min-reject-recall", type=float, default=0.0)
    parser.add_argument("--output", required=True, type=Path)
    parser.add_argument("--no-slicing", action="store_true")
    parser.add_argument("--allow-candidate", action="store_true", help="explicitly permit candidate model evaluation")
    parser.add_argument("--runtime", choices=("onnx", "ultralytics", "pytorch"))
    args = parser.parse_args(argv)

    if args.calibrate and args.split != "valid":
        parser.error("--calibrate is validation-only; use --split valid")
    if not args.calibrate and args.confidence_threshold is None:
        parser.error("--confidence-threshold is required unless --calibrate is used")
    if args.confidence_threshold is not None and not 0 <= args.confidence_threshold <= 1:
        parser.error("--confidence-threshold must be between 0 and 1")

    report: dict
    if args.calibrate:
        try:
            thresholds = [float(value) for value in args.thresholds.split(",") if value.strip()]
            rows = {}
            for threshold in thresholds:
                result = evaluate_scan_pipeline(
                    commodity=args.commodity,
                    dataset_root=str(args.dataset_root),
                    split="valid",
                    confidence_threshold=threshold,
                    enable_slicing=not args.no_slicing,
                    allow_candidate=args.allow_candidate,
                    runtime=args.runtime,
                )
                metrics = result["pipeline_metrics"]
                reject_metrics = metrics["per_class"]["Reject"]
                rows[f"{threshold:.2f}".rstrip("0").rstrip(".")] = {
                    "macro_f1": metrics["macro_f1"],
                    "reject_recall": reject_metrics["recall"],
                    "reject_precision": reject_metrics["precision"],
                    "pipeline_failures": result["pipeline_failures"],
                }
            calibration = calibrate_thresholds(
                {"split": "valid", "threshold_results": rows},
                thresholds,
                args.objective,
                min_reject_recall=args.min_reject_recall,
            )
            report = {
                "report_type": "exploratory_threshold_calibration",
                "rubric_status": "unverified",
                "commodity": args.commodity,
                "calibration": calibration,
                "metadata": _metadata(args.dataset_root, "valid", args.commodity),
            }
        except (ValueError, OSError) as exc:
            parser.error(str(exc))
    else:
        try:
            report = evaluate_scan_pipeline(
                commodity=args.commodity,
                dataset_root=str(args.dataset_root),
                split=args.split,
                confidence_threshold=args.confidence_threshold,
                enable_slicing=not args.no_slicing,
                allow_candidate=args.allow_candidate,
                runtime=args.runtime,
            )
            report["metadata"] = _metadata(args.dataset_root, args.split, args.commodity)
        except (ValueError, OSError) as exc:
            parser.error(str(exc))

    _write_report(args.output, report)
    print(json.dumps({"output": str(args.output), "report_type": report["report_type"], "image_count": report.get("image_count")}, sort_keys=True))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
