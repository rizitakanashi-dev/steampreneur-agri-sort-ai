# Dataset integrity audit — Terung, Tomat, Cabai

**Audit date:** 27 November 2026
**Tool:** `server/scripts/audit_yolo_dataset.py` → `server.services.dataset_audit.audit_yolo_dataset`
**Scope:** all locally available exports and their declared training relationship.
**Result:** no dataset is eligible for commercial grading validation yet. Terung is the closest structurally; Tomat has a provenance conflict; Cabai's local export has no valid boxes.

## Method and limits

The audit is read-only. It parses `data.yaml`, pairs image and label stems, validates normalized five-field YOLO detection boxes, checks class IDs, verifies image readability, hashes exact files, and computes deterministic export and label manifest hashes. It never exposes local roots or per-image filenames in the generated report.

A **valid box** requires exactly five fields, an integer class ID in the declared range, finite normalized values, positive width/height, and a box fully inside the image. Polygon/segmentation rows are counted as invalid for this detector evaluator, even if they might be valid for a segmentation task.

Exact duplicate images are detected by SHA-256. **Near-duplicate images, repeated specimens, and capture-session leakage are not measured** by this tool. Absence of exact cross-split duplicates is not proof that the split is group-safe.

## Split summary

| Dataset | Split | Images | Labels | Valid boxes | Invalid rows | Empty labels | Unpaired image / label | Corrupt images | Exact dup groups (within / cross) |
|---|---|---:|---:|---:|---:|---:|---:|---:|---:|
| Terung `Eggplant-Quality-Grades-2` v2 | train | 16,168 | 16,168 | 47,490 | 4 | 37 | 0 / 0 | 0 | 1 / 0 |
| Terung | valid | 1,028 | 1,028 | 1,842 | 0 | 0 | 0 / 0 | 0 | 0 / 0 |
| Terung | test | 1,022 | 1,022 | 1,597 | 0 | 0 | 0 / 0 | 0 | 0 / 0 |
| Tomat `tomato-freshness.v1-tomat.yolov11` | train | 2,100 | 2,100 | 2,418 | 0 | 0 | 0 / 0 | 0 | 2 / 0 |
| Tomat | valid | 425 | 425 | 445 | 0 | 0 | 0 / 0 | 0 | 0 / 0 |
| Tomat | test | 280 | 280 | 305 | 0 | 0 | 0 / 0 | 0 | 0 / 0 |
| Cabai `Smart Conveyor Cabai Rawit` v1 | train | 1,266 | 1,266 | 0 | 1,280 | 0 | 0 / 0 | 0 | 0 / 0 |
| Cabai | valid | 353 | 353 | 0 | 354 | 0 | 0 / 0 | 0 | 0 / 0 |
| Cabai | test | 181 | 181 | 0 | 184 | 0 | 0 / 0 | 0 | 0 / 0 |

## Class distribution

Counts below are **valid five-field boxes**, not raw label rows. Cabai's raw row counts are shown separately because they are not valid boxes.

| Dataset | Grade A | Grade B | Reject | Total valid boxes |
|---|---:|---:|---:|---:|
| Terung | 16,646 | 11,771 | 22,512 | 50,929 |
| Tomat external export | 1,028 | 666 | 1,474 | 3,168 |
| Cabai external export | 0 | 0 | 0 | 0 |

Cabai raw label rows still carry class IDs: 797 rows with ID 0, 345 with ID 1, and 676 with ID 2. Every one is a non-five-field row, so none is a valid detection box. Copying those raw counts into `instances` would materially overstate the dataset.

## Annotation-format findings

| Dataset | Observed row shapes | Interpretation |
|---|---|---|
| Terung | 50,929 rows with 5 fields; 4 rows with 21, 23, 41, and 59 fields | Four training rows are polygon/segmentation-like, not detection boxes. They must be reviewed and corrected or intentionally excluded; they were not modified. |
| Tomat | 3,168 rows with 5 fields | Structurally valid detection boxes; commercial class meaning remains unverified. |
| Cabai | 1,818 rows with lengths from 13 to 375 fields; **zero** rows with 5 fields | The export does not contain usable detection boxes. The intended task may be segmentation, but that is not documented and cannot be assumed for this detector. |

The field-length distribution for invalid rows is recorded in each audit JSON under `splits.<split>.invalid_label_field_counts`, so the claims above can be reproduced without exposing image or label filenames. Terung also has 37 empty training label files. Empty files can be valid negative examples, but they need owner confirmation before they are treated as intentional negatives. Tomat and Cabai have no empty label files.

## Exact duplicate and leakage findings

- Terung: one exact duplicate-image group inside `train`; no exact cross-split group. The group is small but must be resolved or justified before a held-out claim.
- Tomat external export: two exact duplicate-image groups inside `train`; no exact cross-split group.
- Cabai external export: no exact duplicate group observed.
- No exact image appears in more than one split in any audited export.
- This does **not** rule out near-duplicates, sequential video frames, the same fruit photographed repeatedly, or source-session leakage. Those require perceptual/group metadata that is not present in the exports.

## Image characteristics

| Dataset | Resolution summary |
|---|---|
| Terung | All 18,218 audited images are 640×640 after export preprocessing. |
| Tomat external export | All 2,805 audited images are 640×640 after export preprocessing. |
| Cabai external export | Mixed source resolutions. Train is dominated by 4,000×2,252 (723) and 4,624×3,468 (542); test ranges from 348×136 to 4,624×3,468; validation also contains one 6,000×4,000 image. |

## Dataset identity and hashes

| Dataset | Export manifest SHA-256 | Label manifest SHA-256 | Evidence |
|---|---|---|---|
| Terung `Eggplant-Quality-Grades-2` v2 | `0beffe50676d433ea5751def52029607e032e13465f1e46cfe626291a6c3cbfb` | `50a2c542fd0ea70df820cc32175010bf98ceaa05044fafc703ef711793e13a5a` | `docs/model-evaluation/evidence/terung-eggplant-quality-grades-v2.audit.json` |
| Tomat `tomato-freshness.v1-tomat.yolov11` | `7edbc2d4c7c1443c43d5af8b1a68a50e0a5cd1c17a8f364535ed5e9cf3cc6076` | `4ec63ee5ec67c6a85fa8e3387ac621012fc83c3c0713b492a6c8da63eadf0a52` | `docs/model-evaluation/evidence/tomat-tomato-freshness-v1.audit.json` |
| Cabai `Smart Conveyor Cabai Rawit` v1 | `ec67b176c58ff95f1e88d8579168c456aaf5c4d54a517438591d065e683d49d1` | `dd147b7ab40b1f548e0cf4a45324908da5b92c7ff6346eb8d7d1f1d6218a9ff4` | `docs/model-evaluation/evidence/cabai-smart-conveyor-v1.audit.json` |

The export hash algorithm is documented in [evidence-inventory.md](evidence-inventory.md). It covers configuration, README, images, and labels; cache files are excluded.

## Provenance relationship of each audited export

| Export | Training source recorded by checkpoint? | Role in this audit |
|---|---|---|
| Terung `Eggplant-Quality-Grades-2` v2 | Project/version agree, but training input was `/tmp/terung_calib` which is unavailable | Probable training export; exact byte identity unproven |
| Tomat `tomato-freshness` v1 | **No.** Training input was `/kaggle/working/tomato-thesis-e4-1` | External-domain dataset only; not primary validation ground truth |
| Cabai `Smart Conveyor Cabai Rawit` v1 | **No.** Training input was `/content/Chili-Data-set-v4-2` | Invalid external dataset; not training and not usable evaluation ground truth |

This distinction is the core provenance correction. A locally present export is not automatically the training dataset.

## Eligibility decision

| Dataset | Structural result | Eligible for validation ground truth? | Reason |
|---|---|---|---|
| Terung | Not fully compatible | No, not yet | 4 invalid training rows, 37 unconfirmed empty labels, one train-internal duplicate group, exact training export unavailable, rubric unverified. |
| Tomat external export | Structurally compatible | No, not as primary held-out set | It is a different project/domain from training; no held-out membership or rubric evidence. |
| Cabai external export | Not compatible | No | 1,818 non-box rows and zero valid boxes; it also is not the training source. |

No original export was modified. All reports are aggregate evidence and remain separate from the datasets.
