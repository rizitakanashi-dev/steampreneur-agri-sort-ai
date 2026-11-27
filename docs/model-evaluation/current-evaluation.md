# Current three-grade model evaluation status

**Audit date:** 23 November 2026
**Overall result:** exploratory; no commodity has passed semantic or deployment validation.

The canonical output order is ID 0 `Grade A`, ID 1 `Grade B`, ID 2 `Reject`. This taxonomy is a technical interface contract. It does not verify that source annotations follow a commercial grading rubric. All manifests remain `candidate`, with label semantics `needs_data`. See [grade-rubrics.md](grade-rubrics.md).

> **Provenance follow-up (27 November 2026):** the rows below describe *local exports*, not necessarily training data. Terung is the probable training export but its exact training bytes are unavailable. The Tomat and Cabai rows are **external-domain** exports, not the datasets recorded by their checkpoints. See [provenance-matrix.md](provenance-matrix.md), [provenance-reconciliation-report.md](provenance-reconciliation-report.md), and [dataset-integrity-audit.md](dataset-integrity-audit.md). This note supplements, and does not rewrite, the 23 November audit.

## Structural audit of local external datasets

Audits were run in place by `server/scripts/audit_yolo_dataset.py`. Only aggregate structure/counts and exact image hashes are reported here. Dataset files and per-image inventory remain outside the repository. The tool output omits local roots, config paths, and per-image filenames.

| Commodity | Train images / objects | Valid images / objects | Test images / objects | Pairing | Exact duplicate images | Structural result |
|---|---:|---:|---:|---|---|---|
| Terung | 16,168 / 47,490 box rows (plus 4 non-box rows) | 1,028 / 1,842 | 1,022 / 1,597 | image-label stems pair | 1 train-internal duplicate group; 0 cross-split groups | Not compatible: 4 training annotation rows are polygons/segmentation, not five-field YOLO boxes. |
| Tomat | 2,100 / 2,418 | 425 / 445 | 280 / 305 | image-label stems pair | 2 train-internal duplicate groups; 0 cross-split groups | Structurally parseable, but semantic grading labels unverified. |
| Cabai | 1,266 / 0 valid box rows | 353 / 0 | 181 / 0 | image-label stems pair | 0 groups observed | Not compatible: 1,818 annotation rows across splits are not five-field YOLO boxes; source/release also needs reconciliation. |

For Terung, the audit found 37 empty training label files; these are valid negative examples if confirmed as intentional. Exact hash checking does not detect near-duplicate images, repeated specimens/capture sessions, or source-group leakage. The dataset audit is structural only; `data.yaml` class ordering does not establish label semantics.

## Full-scan smoke check

One local Terung validation image was copied to a temporary location outside the repository and run with the evaluator through ONNX Runtime, with candidate access explicitly enabled. The pipeline completed without a pipeline exception and reported `needs_review` / `zero_objects_detected`. This single-image smoke check verifies only that one evaluator/runtime path can execute. It is not a performance estimate and must not be treated as accuracy evidence.

## Thresholds and held-out results

No confidence thresholds are frozen from validation, and no held-out test evaluation is reported. Calibration should not proceed as a deployment choice until the dataset/label semantics and annotation-format gates are resolved. The evaluator enforces validation-only calibration and rejects pipeline failures; any future test run must use thresholds frozen without test outcomes. Calibration reports include validation image coverage, processed-image count, scored ground-truth object count, and unscored object count for interpreting the selected threshold.

## Deployment and claims

- Production model loading fails closed for all current candidate manifests unless explicitly opted into evaluation.
- The evaluator writes `rubric_status: unverified` and identifies explicit candidate access.
- No claim of model accuracy, agronomic correctness, or commercial grading reliability is supported by this audit.
- To advance, obtain agronomist-approved commodity rubrics, repair/verify annotation formats and provenance, assess specimen/session split leakage, then calibrate on validation and run a separately frozen held-out test evaluation.
