# Three-Grade Model Integrity and Evaluation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make each automatic commodity model conform to Grade A / Grade B / Reject and establish reproducible full-scan metrics plus validation-only confidence thresholds, with no unsupported accuracy claims.

**Architecture:** Add a canonical artifact registry/manifest validation path consumed by the production AI engine, plus an offline evaluator that calls the same inference and image-quality functions as the scan route. Audit local dataset splits, calibrate on validation only, then measure frozen settings on untouched test sets and store evidence linked to model/dataset hashes. Dataset labels must satisfy a per-commodity rubric before a model is marked validated; otherwise the commodity remains manual/unverified.

**Tech Stack:** Python 3.14, FastAPI service modules, ONNX Runtime, NumPy, Pillow, OpenCV, PyYAML, unittest; existing Node/Vite tests/build.

## Global Constraints

- Canonical class IDs are exactly `0: Grade A`, `1: Grade B`, `2: Reject`.
- Each commodity may have its own explicit annotation rubric, but incompatible labels may not be renamed into grades without qualified relabeling.
- Confidence thresholds are selected only using each commodity's validation split; test data must not influence calibration.
- Evaluate end-to-end ML scan behavior (decode/EXIF, image quality, configured enhancement, tiled inference, NMS, disambiguation, counts/review statuses), separately from raw model metrics.
- Model/data/rubric/postprocessing changes require new versioned evidence; never claim accuracy without measured, held-out evidence.
- Missing, invalid, or mismatched artifacts fail closed; no silent substitution of weights, class orders, or mock results.
- Do not copy private/out-of-repository datasets or credentials into git; evaluation outputs must contain hashes and aggregate/per-image metrics without raw image bytes.

---

## File Map

- Create `server/models/{terung,tomat,cabai}/model-metadata.json` canonical manifests with class order, artifact path/hash, dataset provenance, thresholds, and validation status.
- Modify `server/services/ai_engine.py` to load a commodity's ONNX artifact/manifest, validate hash and embedded classes, and use only manifest class order.
- Create `server/services/model_registry.py` for manifest loading, schema/class validation, artifact hashing, ONNX metadata checks, and explicit validation errors.
- Create `server/services/model_evaluation.py` for dataset parsing, validation threshold grid, object-detection metrics, full production inference evaluation, and JSON evidence.
- Create `server/scripts/evaluate_models.py` CLI taking commodity, dataset root, split(s), and output path; never infer paths from filenames or mutate weights.
- Create `server/tests/test_model_registry.py`, `server/tests/test_model_evaluation.py`, and extend AI-engine/pipeline tests for fail-closed behavior and parity.
- Create a per-commodity rubric document in `docs/model-evaluation/grade-rubrics.md` that states current accepted criteria and unresolved expert decisions; do not invent normative grading rules.
- Create measured aggregate report in `docs/model-evaluation/` only for datasets that pass the data gate; keep raw per-image evidence under ignored `server/data/model-evaluations/` or caller-selected external path.
- Update `docs/detail-model.md`, `docs/p0-ml-safety-remediation.md` only where needed to replace stale model/metric claims with verified results and explicit `needs_data`/`candidate` status.

## Task 1: Verify the candidate data contract and implement tests for model manifests

**Files:**
- Create: `server/tests/test_model_registry.py`
- Create: `server/services/model_registry.py`
- Modify: `server/models/terung/model-metadata.json`
- Modify: `server/models/tomat/model-metadata.json`
- Modify: `server/models/cabai/model-metadata.json`

**Interfaces:**
- `load_model_manifest(commodity: str, base_dir: str) -> dict` loads JSON and rejects missing/invalid manifests.
- `sha256_file(path: str) -> str` computes a streaming SHA-256.
- `validate_model_artifact(manifest: dict, artifact_path: str, session_metadata: dict | None = None) -> None` verifies 3 classes in canonical order, configured digest, and embedded ONNX class names when provided; raises `ModelContractError` on mismatch.

- [ ] Write tests for canonical order acceptance; wrong/missing classes and missing digest rejection; digest mismatch; ONNX metadata mismatch; correct file hash; and clean failure for missing manifest/artifact.
- [ ] Run `./.venv/bin/python -m unittest server.tests.test_model_registry -v`; verify expected failures because registry is not implemented.
- [ ] Audit current weights from `server/models/*/best.onnx`: get embedded classes/input-output dimensions, compute SHA-256, and record which model release is actually present. Do not choose another weight based only on file size/name.
- [ ] Audit dataset provenance/config/class order and annotation counts for `/home/Rizi/agri-sort-ai/Eggplant-Quality-Grades-2`, `/home/Rizi/dataset/tomato-freshness.v1-tomat.yolov11`, and `/home/Rizi/dataset/Smart Conveyor Cabai Rawit.v1i.yolov11`; record them as external source paths only, with hashes/counts in evidence.
- [ ] Implement manifest parser and artifact validators with explicit errors and no automatic class remapping.
- [ ] Populate canonical manifests for current 3-class weights; set status `candidate` until the rubric/data gate and held-out evaluation pass. Include exact source dataset and hashes; leave a commodity `needs_data` if its label semantics cannot be verified.
- [ ] Run registry tests and current model metadata checks. Verify hash changes or class order mutation fail.
- [ ] Commit registry, tests, and manifests.

## Task 2: Enforce the manifest in production model loading

**Files:**
- Modify: `server/services/ai_engine.py`
- Modify: `server/tests/test_ai_engine.py`
- Modify: `server/tests/test_model_integration.py`

**Interfaces:**
- AI engine model configs use a manifest-validated artifact and the manifest's exact classes and version.
- `get_model()` raises a contract/configuration error if the commodity manifest or ONNX embedded class order does not match; it does not fall back to an incompatible Tomat/Terung/Cabai artifact.

- [ ] Write failing tests that patch a bad manifest/hash/classes and assert the model is rejected before inference; also assert all supported configs have exactly the canonical ordered three classes.
- [ ] Run focused tests to verify they fail on current loader behavior.
- [ ] Modify loader to resolve one declared ONNX artifact per commodity, validate the file hash and model metadata, and cache only after successful validation.
- [ ] Ensure unavailable/unvalidated status does not become a mock inference; preserve the explicit simulation-only path.
- [ ] Run focused engine, integration, ONNX smoke, and ML-safety tests.
- [ ] Commit the production contract enforcement.

## Task 3: Add reproducible full-pipeline evaluator and metrics tests

**Files:**
- Create: `server/tests/test_model_evaluation.py`
- Create: `server/services/model_evaluation.py`
- Modify: `server/services/ai_engine.py` only if a minimal injectable inference boundary is needed.

**Interfaces:**
- `load_yolo_dataset(dataset_root: str, split: str) -> list[dict]` returns validated image path and normalized ground-truth boxes/classes in original-pixel coordinates.
- `evaluate_predictions(ground_truth: list, predictions: list, iou_threshold: float = 0.5) -> dict` returns per-class TP/FP/FN, precision/recall/F1/AP, and matching details.
- `evaluate_scan_pipeline(commodity: str, dataset_root: str, split: str, confidence_threshold: float, engine=ai_engine, ...) -> dict` uses the production image decode/EXIF and quality functions, production `ai_engine.predict()` including tiled inference, plus QC review status rules; records per-image outcomes and aggregate metrics.
- `calibrate_thresholds(validation_results: dict, thresholds: list[float], objective: str) -> dict` selects a threshold using validation results only and returns the full threshold curve plus selection rationale.

- [ ] Write tests first for normalized YOLO labels, malformed/missing annotation behavior, 1:1 IoU object matching, unmatched detections as false positives, unmatched ground truth as false negatives, empty predictions, per-class metrics, and threshold calibration tie-breaking.
- [ ] Write a data-split test proving held-out test data is never an argument to the calibrator and mutating test outcomes does not change a chosen threshold.
- [ ] Write pipeline tests proving the evaluator calls production AI inference with selected confidence and slicing enabled, applies image-quality/review status, records zero-object and blur outcomes, and reports pipeline failures separately from detection false negatives.
- [ ] Run focused evaluation tests and confirm they fail because the evaluator is absent.
- [ ] Implement dataset loader, deterministic matching/AP metrics, threshold curve, full-pipeline evaluator and JSON serialization. Use model outputs and production code; synthetic fixtures are test coverage only, not reported as accuracy.
- [ ] Add CLI `server/scripts/evaluate_models.py` with required `--commodity`, `--dataset-root`, `--split`, `--confidence-threshold` (or `--calibrate` for validation only), `--output`, and reproducibility metadata. Refuse calibrate mode on `test` split.
- [ ] Run tests using synthetic fixture plus one real image smoke evaluation; inspect emitted report schema and ensure no private image pixels/bytes are serialized.
- [ ] Commit evaluator and tests.

## Task 4: Define rubrics and audit data readiness

**Files:**
- Create: `docs/model-evaluation/grade-rubrics.md`
- Create: `server/scripts/audit_yolo_dataset.py`
- Create: `server/tests/test_dataset_audit.py`

**Interfaces:**
- `audit_yolo_dataset(dataset_root: str, yaml_path: str) -> dict` returns split counts, class/object distribution, corrupt/missing images/labels, invalid boxes, image hash duplicates, and label-compatible flag; never copies dataset contents.

- [ ] Write tests for class mapping/order, invalid class IDs/boxes, missing labels, duplicate image content crossing splits, and missing split directories.
- [ ] Confirm test-first failures.
- [ ] Implement audit report and CLI with SHA-256 file inventory and duplicate split detection; report external dataset paths without embedding user data.
- [ ] Document three shared grade categories with commodity-specific rubric fields; explicitly label any disputed/uncertain criteria `requires agronomist review`, not as fact.
- [ ] Run audit on all three candidate local datasets; record counts, malformed/duplicate/leakage findings and label semantics, then set manifest status accordingly. If no independently defensible rubric or data is available, keep that model `needs_data` and do not train/evaluate it as trusted grades.
- [ ] Run audit tests and inspect reports for privacy and correctness.
- [ ] Commit rubric/audit tool and test results if suitable for the repository.

## Task 5: Calibrate on validation and evaluate held-out test data

**Files:**
- Modify: `server/scripts/evaluate_models.py` only for fixes discovered by the real run.
- Create: `docs/model-evaluation/current-evaluation.md` for aggregate metrics, configurations, limitations, and confidence interval methodology.
- Create: ignored `server/data/model-evaluations/<model-version>/` for per-image JSON evidence, dataset manifests and threshold curves.
- Modify: each canonical model manifest with frozen validation-selected threshold and evidence paths after successful evaluations.

- [ ] For each commodity whose data gate passes, run validation-only threshold sweeps over an explicit grid including current defaults and operating range 0.05 through 0.95; never include the test split in selection.
- [ ] Choose the per-commodity threshold using predeclared macro-F1 subject to minimum Reject recall and precision constraints; if no threshold meets constraints, report failure and keep model candidate. State constraints and trade-offs rather than optimizing against the test set.
- [ ] Freeze threshold, weights, preprocessing, tiling, NMS, disambiguation, rubric and code revision in manifest before test evaluation.
- [ ] Run held-out test evaluation once with model-only and full-scan metrics: per-class precision/recall/F1/AP50, mAP50-95 if supported by the evaluation implementation, confusion matrix, Reject false-accepts, missed objects, empty/needs-review/failure rates, sample counts, and p50/p95 latency.
- [ ] Compute uncertainty intervals where valid; do not label any metric “accuracy” without precise definition. Mark metrics as exploratory if dataset is not field-representative or label audit is limited.
- [ ] Verify recalibrating with changed test results cannot affect thresholds; verify changing model/data hashes invalidates prior evidence.
- [ ] Run end-to-end evaluation for all data-eligible models and smoke-test production inference through the real scan API path without persisting or exposing private images.
- [ ] Commit only aggregate report/manifest/evidence references; keep per-image rows and external dataset inventories ignored/private.

## Task 6: Update claims and full verification

**Files:**
- Modify: `docs/detail-model.md`
- Modify: `docs/p0-ml-safety-remediation.md`
- Modify: `README.md` only if current feature claims incorrectly state all commodity AI grades are available.

- [ ] Replace stale class counts, model versions, dataset provenance, thresholds, and accuracy claims with verified manifest/evaluation values. Explicitly list any `candidate`/`needs_data` commodity and maintain manual workflow for it.
- [ ] Add test coverage for documentation/manifest class consistency if practical without brittle prose snapshots.
- [ ] Run `npm test`, `npm run build`, `./.venv/bin/python -m unittest discover -s server/tests`, model registry/evaluator/audit tests, and real ONNX smoke/evaluation commands available in this environment.
- [ ] Inspect branch diff, artifact hashes, generated files, `.gitignore`, and confirm no datasets, secrets, or per-image private data were added.
- [ ] Commit final evidence/docs. Then create a pull request targeting the current base branch and report the PR link, validation status, and any data/accuracy limitations.
