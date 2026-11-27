# Model evaluation protocol — object detection grading

**Status:** proposed methodology; no acceptance threshold is approved.
**Applies to:** Terung, Tomat, Cabai YOLO11n detection models in this repository.
**Current execution state:** no held-out performance metrics have been computed. The audit is structural only.

## 1. Purpose

This protocol defines how a model may move from `candidate` to an evidence-backed deployment decision. It separates four datasets that the previous metadata conflated: training, validation, held-out test, and external-domain evaluation. It also separates a model's class IDs from commercial grading semantics.

## 2. Dataset roles

| Role | Allowed use | Prohibited use |
|---|---|---|
| `training` | Fit model parameters. | Cannot be used to claim held-out performance. |
| `validation` | Threshold calibration, early stopping, error analysis before freeze. | Cannot be reported as the final held-out score. |
| `held_out_test` | One-time final evaluation after threshold and gates are frozen. | No repeated tuning, no threshold selection, no model selection. |
| `external_domain` | Separate robustness/transportability report. | Cannot replace the primary held-out set or be mixed into training. |

Every dataset must have an exact project, version, export hash, class list, licence status, and split membership. A name alone is not identity.

## 3. Preconditions before any held-out run

1. Training export is available and byte-identified (export manifest hash).
2. Validation and test splits are proven disjoint at image level and, where possible, specimen/session level.
3. Annotation task is confirmed as five-field detection boxes, or a documented and reviewed conversion exists.
4. Invalid rows, empty labels, and duplicate groups are resolved or explicitly accepted.
5. Licence permits the intended use; attribution and artifact-licence obligations are reviewed.
6. An agronomist has approved the commodity rubric and the label-to-class mapping.
7. Confidence and IoU policies are fixed in advance.
8. The test export is frozen and hashed; no test image was used for calibration or debugging.
9. A baseline and failure-handling plan are recorded.

If any precondition fails, the result may be reported as **exploratory** only and cannot support `VALIDATED`.

## 4. Class mapping

The model contract is exactly three IDs:

| ID | Output | Meaning |
|---:|---|---|
| 0 | Grade A | Top acceptable grade under the approved commodity rubric. |
| 1 | Grade B | Lower acceptable grade under the same rubric. |
| 2 | Reject | Excluded from acceptable grades under the same rubric. |

This is a technical interface contract, not a claim that the annotations mean this. The mapping is provisional until the rubric and label audit are approved. Do not rename freshness, ripeness, disease, or segmentation classes into commercial grades.

## 5. Evaluation design

- Task: single-class-set object detection; match predictions to ground truth by class.
- Primary IoU: `0.50` for the operational pass/fail table; also report `mAP@50:95`.
- Confidence: calibrate on validation only. Freeze one threshold before the test run. Do not choose a threshold from test outcomes.
- NMS: record the inference/NMS configuration; keep it identical between validation and test.
- Preprocessing: record image size, letterboxing, normalization, and any tiling; use the production path.
- Empty labels: score as negatives only when confirmed intentional; otherwise exclude the image with a documented reason.
- Pipeline failures: count separately from false negatives. A failed decode/inference is not a correct rejection.
- Per-class reporting: Grade A, Grade B, Reject.
- Report counts, not only percentages: ground-truth objects, predicted objects, matched boxes, FP, FN, images, and failures.

## 6. Required metrics

Only computed values may be reported. The minimum report contains:

| Metric | Level |
|---|---|
| Precision, recall, F1 | per class and macro |
| mAP@50 | overall and per class |
| mAP@50:95 | overall and per class |
| Confusion matrix | class-level |
| False positives / false negatives | count and representative examples |
| Pipeline failure rate | overall and by failure type |
| Coverage | processed images ÷ selected images, and scored GT boxes ÷ GT boxes |

Reject recall is reported separately because a missed reject is a food-safety/business risk. It must not be hidden inside macro averages.

## 7. Freeze and one-time test rule

1. Calibrate on validation and write a calibration report with the validation export hash.
2. Freeze: model artifact hash, class order, confidence threshold, IoU, NMS, input size, code commit, and evaluation command.
3. Record the frozen values in the evaluation manifest before touching the test set.
4. Run the held-out test once. Store the metrics report and its hash.
5. If the test fails, do not tune on it. Retrain or revise the validation design, then use a new held-out version.

Any test run that occurs before freeze is exploratory and cannot be promoted to the final evidence.

## 8. Acceptance criteria

**No threshold below is approved.** They are proposals for product/agronomist sign-off.

| Proposed gate | Proposed value | Approval |
|---|---:|---|
| Reject recall | ≥ 0.90 | Pending |
| Macro F1 | ≥ 0.75 | Pending |
| Per-class recall | Report all; no class may be omitted | Pending |
| Pipeline failure rate | ≤ 5% | Pending |
| Exact cross-split duplicates | 0 | Pending |
| Annotation validity | 100% of scored rows valid | Pending |
| Held-out test | One-time, frozen threshold | Pending |
| Staging/canary + rollback | Demonstrated | Pending |

The values are not to be silently applied or lowered to make a model pass. If the product owner has not approved them, the correct status is `BLOCKED` or `NEEDS_REVIEW`, not `VALIDATED`.

## 9. Reporting template

Every evaluation report must state:

- Model artifact path and SHA-256.
- Training, validation, and test export identities and hashes.
- Dataset roles and whether the test was truly held out.
- Class order and rubric version/approval.
- Confidence, IoU, NMS, input size, and code version.
- Evaluation date, runtime, and command.
- Counts and metrics, including failures and unscored ground truth.
- Known limitations and any domain shift.
- Decision: `BLOCKED`, `NEEDS_REVIEW`, `READY_FOR_EVALUATION`, `VALIDATED`, or `REJECTED`.

## 10. Current applicability

| Commodity | Training export | Validation/test status | Can run final evaluation now? |
|---|---|---|---|
| Terung | Probable `Eggplant-Quality-Grades-2` v2; exact `/tmp` export unavailable | Test split exists but held-out use unproven; 4 invalid rows, 37 empty labels, 1 duplicate group | **No** |
| Tomat | `tomato-thesis-e4` v1; export unavailable | No verified in-distribution validation/test export; local `tomato-freshness` is external domain | **No** |
| Cabai | `Chili-Data-set-v4` v2; export unavailable | No verified training/eval labels; local Smart Conveyor has zero valid boxes | **No** |

## 11. Tooling reference

The evaluator is `server/scripts/evaluate_models.py`; candidate access must be explicit (`--allow-candidate`). It enforces validation-only calibration and rejects pipeline failures. The structural auditor is `server/scripts/audit_yolo_dataset.py`. Neither tool changes model weights or deployment status.

```bash
cd /home/Rizi/agri-sort-ai
# Structural audit only (read-only):
PYTHONPATH=. .venv/bin/python server/scripts/audit_yolo_dataset.py \
  --dataset-root <export-root> --output <report.json>
# Evaluation is intentionally not run until the gates above are satisfied.
```

## 12. Non-negotiable rules

- A model is not validated because inference succeeds.
- A model is not validated because its artifact hash matches its manifest.
- A model is not validated because a local dataset exists.
- A test set is not held out merely because its folder is named `test`.
- No metric or dataset count may be fabricated, back-filled, or copied from a different export.
