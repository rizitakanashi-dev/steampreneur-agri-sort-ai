# Three-Grade Model Integrity and End-to-End Evaluation — Design

## Goal

Make `Grade A`, `Grade B`, and `Reject` the sole output taxonomy for every commodity model intended for automatic quality grading, and establish evidence that the deployed scan pipeline performs reliably. Calibrate a separate confidence threshold for each commodity using validation data, then report final metrics only on a held-out test set. The system must not claim that a model or scan is accurate when artifacts, labels, or representative evaluation data do not support that claim.

## Scope

- Canonical three-class model contract for Eggplant, Tomato, and Chili models.
- Artifact and class-order integrity checks at load time.
- Dataset provenance, annotation, split-integrity, and per-commodity label-rubric checks.
- Validation-set threshold selection and independent test-set evaluation.
- End-to-end evaluation through the same image preprocessing, quality checks/enhancement, tiled inference, NMS, postprocessing, grading and review-status logic used by the scan API.
- Evaluation reports that distinguish model-only metrics from scan-pipeline metrics and disclose unsupported or unverified commodities.
- Tests for the evaluation harness and fail-closed artifact handling.

Out of scope: frontend redesign, pricing changes, auth/storage redesign, automatic data scraping, and claiming agronomic certification. Training or replacing weights is conditional on finding eligible, licensed, correctly annotated datasets for each commodity; incompatible labels must not be relabeled by guesswork.

## Canonical model contract

Create one machine-readable manifest per commodity, using the fixed class order and IDs:

| ID | Canonical class |
|---:|---|
| 0 | `Grade A` |
| 1 | `Grade B` |
| 2 | `Reject` |

Each manifest records at least:

- commodity and model name;
- semantic version and immutable artifact paths for PyTorch/ONNX where supplied;
- SHA-256 for every deployable weight file;
- task, framework/exporter versions, input dimensions, and expected tensor dimensions;
- exact class names and ID order;
- dataset identity, source/version/license, label-rubric document, and train/validation/test image and object counts;
- split-generation method and duplicate/group leakage check result;
- training/evaluation provenance and metric artifact locations;
- confidence threshold and its validation selection objective, per commodity;
- validation/test dataset fingerprints and timestamp;
- status such as `candidate`, `validated`, or `needs_data`.

Load-time integrity checks compare file hashes, ONNX embedded class names/output dimensions, manifest class IDs, and inference mapping. A mismatch is an explicit model-unavailable/configuration error; the application must not remap classes by order, fall back to an unrelated model, or present predictions as valid grades. Test fixtures may construct temporary manifests and weights, but production weights are never regenerated or edited by tests.

## Per-commodity label semantics and data gate

The shared grade names and general meaning remain consistent, while detailed observable criteria may differ by commodity. Each commodity therefore needs an explicit, reviewable annotation rubric mapping its visual evidence to A/B/Reject, with examples and borderline/review cases. Dataset labels are eligible only when their meaning agrees with that rubric; freshness-only, ripeness-only, disease-only, or unrelated labels cannot be converted to commercial grades without a documented relabeling protocol and qualified annotation.

Before training or validation, audit licensing/provenance, image/label counts, malformed boxes, class distribution, image duplicates and near-duplicates across splits, and specimen/session leakage. Keep groups (same specimen, capture burst, or source batch) within one split. If any commodity lacks eligible data, mark it `needs_data` and keep its scan manual/unsupported; do not fabricate metrics, rename incompatible outputs, or claim all three commodity models are validated.

## Evaluation architecture

Use a reproducible offline evaluation command/library that invokes the actual production scan preprocessing and inference path, with dependency injection only at external boundaries. For each labeled image, retain ground-truth boxes/classes, final postprocessed detections, scan status, quality flags, selected threshold, and pipeline configuration. Save machine-readable per-image outcomes and a concise aggregate report tied to model/data hashes.

Run two clearly separated evaluations:

1. **Validation/calibration:** evaluate a predeclared threshold grid per commodity (including the current default and practical operating range). Select the threshold by a documented objective that balances per-class precision/recall and the cost of missing `Reject`; report the chosen threshold and the full trade-off curve. No test-set results may affect threshold selection.
2. **Held-out test:** freeze weights, class order, preprocessing, postprocessing, and thresholds first. Evaluate once on the untouched test set. Report per-class precision, recall, F1, AP@50 and mAP@50-95; confusion matrix; false-accept rate for actual Reject objects; missed-object rate; image-level empty/needs-review/model-failure rates; and confidence intervals where sample size supports them. Explain that detection mAP is not ordinary classification accuracy.

The end-to-end metric includes all production steps: upload decode/EXIF correction and image validation; quality analysis and optional CLAHE; full-frame and tile inference; cross-tile duplicate suppression; grade disambiguation; output serialization; and review/safety status. Report model-only and end-to-end results side by side so postprocessing regressions are visible. Measure p50/p95 latency and failure rates separately from quality metrics.

Threshold and processing choices are not tuned on the test set. Any later change to weights, threshold, rubric, or postprocessing requires a new version and fresh held-out evaluation. Confidence values are not presented as probabilities or scan accuracy unless calibration has been separately measured.

## Safety and behavior

- Unsupported, unvalidated, mismatched, or missing model artifacts fail closed to manual review/unsupported status with clear reason.
- An inference result is not a business-grade certificate until the commodity's grade rubric is reviewed and the model passes the declared acceptance criteria.
- `needs_review` remains available for poor image quality, zero detections, low confidence, or safety checks.
- Never silently substitute simulation/mock output for real inference.
- Reports and UI-facing metadata must state class taxonomy, model version/hash, selected threshold, evaluation-set identity/date, and limitations.

## Testing and acceptance

- Unit tests verify manifest schema, exact 3-class order, artifact hash checking, ONNX class/tensor consistency, unsupported fail-closed behavior, and per-commodity threshold resolution.
- Pipeline tests use labeled fixtures to prove evaluation invokes the same preprocessing/postprocessing path as production, counts unmatched ground truth as false negatives, counts unmatched detections as false positives, and handles empty/invalid/review scans correctly.
- Dataset audit tests cover duplicate/group split leakage and label/box validity.
- Threshold tests prove selection uses validation data only; changing test labels must not alter the chosen threshold.
- Regression tests compare model-only and full-pipeline results on fixed fixtures without treating synthetic fixtures as accuracy evidence.
- Full verification includes JavaScript tests, Python backend tests, model-contract/evaluation tests, production build, ONNX inference smoke tests, and reproducible validation/test evaluation commands.
- A commodity can be marked `validated` only when its label rubric and data audit pass, thresholds are frozen from validation, held-out test results are recorded for the exact deployed artifact, and agreed acceptance limits are met. If data or limits are insufficient, preserve `candidate`/`needs_data` status and clearly report the blocker rather than claiming trustworthy accuracy.

## Implementation sequence

1. Inventory the currently deployed three-class weights, embedded metadata, labels, datasets, and model-selection paths; choose one weight file per eligible commodity and calculate hashes.
2. Add rubrics and data audit outputs, confirming whether each local dataset actually represents A/B/Reject before accepting it.
3. Add canonical manifests and integrity checks, then correct runtime selection to agree with manifests.
4. Implement the shared full-pipeline evaluation harness and verify parity with the production scan route.
5. Calibrate per-commodity thresholds on validation data and freeze them.
6. Evaluate once on held-out tests, record per-class results and limitations, and only retrain commodities whose eligible training data exists.
7. Run all tests/build/inference verification and update model documentation to match measured evidence.

## Risks and explicit limits

- Current repository artifacts and documentation disagree on class count and class meanings; integrity checks may initially mark existing models unusable until verified manifests/data are available.
- Tomato/chili datasets may not encode the agreed commercial grades; this cannot be solved by renaming output labels.
- A small or non-representative test set cannot establish reliable field performance. Metrics must include sample counts and uncertainty and remain scoped to the sampled data.
- Detection accuracy in controlled images does not guarantee performance in farmers' baskets, lighting, cameras, varieties, or occlusion conditions. Field data collection and independent agronomic review may remain necessary before production claims.
- This work improves measurement, integrity, and model quality where data permits; it cannot promise a target accuracy before data inspection, training, and independent evaluation.
