# Provenance reconciliation report

**Audit date:** 27 November 2026
**Scope:** Terung, Tomat, Cabai model manifests and the three locally available dataset exports.
**Result:** training/evaluation roles were corrected without changing model weights, class order, thresholds, deployment status, or dataset files. All models remain `candidate` / `BLOCKED`.

## Before and after

| Commodity | Before | Evidence found | Decision | After |
|---|---|---|---|---|
| Terung | Manifest named `Eggplant-Quality-Grades-2` v2; older notes assumed a four-class `Extra/Class I/Class II/Reject` taxonomy; counts included four invalid rows | Checkpoint and ONNX record `/tmp/terung_calib/data.yaml`; local v2 export and model data.yaml declare **three** classes: `Grade A`, `Grade B`, `Reject`; audit finds 4 polygon rows, 37 empty train labels, 1 train-internal duplicate group | Keep the export as the probable training source but mark exact byte identity unproven; do not invent a fourth class; correct counts to valid boxes only | `dataset.role=training`; `PARTIALLY_VERIFIED`; valid class B count 11,771 (not 11,775); `BLOCKED` |
| Tomat | Manifest named `tomato-freshness.v1-tomat.yolov11` as the training dataset | Checkpoint and ONNX record `/kaggle/working/tomato-thesis-e4-1/data.yaml`; model data.yaml identifies `tomato-thesis-e4-89vr8` v1; `tomato-freshness` is a different Roboflow project | Make `tomato-thesis-e4` the training dataset; move `tomato-freshness` to an external-domain evaluation dataset; do not report its 2,805 images as training counts | `dataset.role=training`; counts `UNVERIFIED`; evaluation role `external_domain_evaluation`; `PARTIALLY_VERIFIED`; `BLOCKED` |
| Cabai | Manifest named `Smart Conveyor Cabai Rawit.v1i.yolov11` as the training dataset and reported 797/345/676 class instances | Checkpoint and ONNX record `/content/Chili-Data-set-v4-2/data.yaml`; model data.yaml identifies `chili-data-set-v4-r9wwe` v2; the local Smart Conveyor export has **zero** valid boxes and 1,818 non-five-field rows | Make `Chili-Data-set-v4` the training dataset; record Smart Conveyor as an invalid external dataset; remove the false instance counts | `dataset.role=training`; counts `UNVERIFIED`; external `valid_instances=0`; `PARTIALLY_VERIFIED`; `BLOCKED` |

## Manifest changes

### All three

- Added explicit `dataset.role: "training"` and `dataset.provenance_status`.
- Added `access_status`, `training_input_path`, and `training_run`.
- Added reproducible `export_manifest_sha256` and documented hash algorithm fields where the export is available.
- Added `annotation_counts_status`; counts are no longer presented without a verification status.
- Added `evaluation_datasets` so external/evaluation data cannot be confused with training data.
- Added `deployment.readiness` and `readiness_reasons`; status remains `candidate`.
- Added `grading.mapping_evidence` and `semantics_review: pending_agronomist`.
- Added `model.artifact_license` = AGPL-3.0 (embedded Ultralytics metadata) and a legal-review marker. This is separate from the dataset licence.

### Terung

- Corrected valid box count from 50,933 to 50,929; class B from 11,775 to 11,771; four polygon rows are now recorded as `invalid_label_rows` instead of boxes.
- Recorded 37 empty training labels, 1 train-internal exact duplicate group, and zero cross-split exact duplicates.
- Added the available export manifest hash and label manifest hash.
- Kept the class order exactly as the artifact declares: three classes, not four.

### Tomat

- Replaced the training dataset reference `tomato-freshness` with `tomato-thesis-e4` v1.
- Removed the external export's 2,100/425/280 image counts from the training field; those counts now belong only to `evaluation_datasets`.
- Added the external export audited counts: 2,418 / 445 / 305 valid boxes, 2 train-internal duplicate groups, zero exact cross-split duplicates.
- Marked the external export `usable_as_primary_held_out_test: false`.

### Cabai

- Replaced the training dataset reference `Smart Conveyor Cabai Rawit` with `Chili-Data-set-v4` v2.
- Removed the false `instances` 797/345/676 claim. Those numbers were raw class IDs on polygon rows, not valid boxes.
- Added the external export audit: 1,818 invalid rows, zero valid boxes, zero exact duplicates, and audit status `FAILED_INVALID_LABELS`.
- Marked the external export unusable as both training and evaluation ground truth.

## What was deliberately not changed

- Model weights, ONNX graphs, class IDs, class names, input size, and confidence thresholds.
- `deployment.status` remains `candidate`; no model was promoted.
- Dataset files and original exports were not edited, renamed, relabelled, or deleted.
- No training was run, and no performance metric was invented.
- No existing audit report was overwritten; this report supplements it.

## Residual conflicts and unknowns

| Item | Status | Required action |
|---|---|---|
| Exact Terung training export (`/tmp/terung_calib`) | Unavailable | Dataset owner must provide the export or a hash + training log proving it is the same v2 export. |
| Tomat training export (`/kaggle/working/tomato-thesis-e4-1`) | Unavailable | Provide export, labels, splits, counts, licence, and training log. |
| Cabai training export (`/content/Chili-Data-set-v4-2`) | Unavailable | Provide export and independently audit its box validity before any metric. |
| Terung 4 invalid rows and 37 empty labels | Unresolved | Review and repair or document as intentional; do not silently delete. |
| Duplicate groups | Exact only | Review Terung 1 and Tomat 2 groups; perform near-duplicate/session-leakage audit. |
| Class semantics | Unverified for all | Agronomist-approved Grade A/B/Reject rubric and label-semantic audit. |
| Licence | Declared CC BY 4.0, not independently confirmed | Retrieve publisher licence evidence; complete AGPL-3.0 artifact licence review. |
| Evaluation | No frozen threshold or held-out report | Approve gates, calibrate on validation, freeze, run one-time held-out test. |

## Audit conclusion

The previous manifests mixed a convenient local export with the dataset recorded by the trained artifact. That is now separated explicitly. The correction is deliberately conservative: it improves traceability and removes false counts, but it does not manufacture the missing training data or claim that any model is validated.
