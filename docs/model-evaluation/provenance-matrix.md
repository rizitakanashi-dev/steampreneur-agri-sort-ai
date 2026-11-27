# Model provenance matrix — Terung, Tomat, Cabai

**Audit date:** 27 November 2026
**Authoritative for:** provenance status and dataset role. It does not override the model manifests or the deployment gate in code.
**Overall result:** all three models remain `candidate`; production inference remains disabled. No model is `VALIDATED`.

## Matrix

| Field | Terung | Tomat | Cabai |
|---|---|---|---|
| Model artifact | `server/models/terung/best.onnx` (also `best.pt`) | `server/models/tomat/best.onnx` (also `best.pt`) | `server/models/cabai/best.onnx` (also `best.pt`) |
| Artifact SHA-256 | ONNX `2275d05fafbb8d28f06b305c000e842c56ec2d716697217a56c6daff4e579b4b`; PT `336f21b9fa844a790856218cff59ee897db05680e972810c5ec4f99b0c6ff21f` | ONNX `6f10f34cf7022919012363f4497a42d0b9a642da947893067419e7292e6f7be2`; PT `a1021b12b44d77ff30a5b797e9ff878e9d6316ff592f99fb7f6568409a3a49c3` | ONNX `4ea442e1197de2f81e1791a9031ad99341f5e3e92e236d44237b01e4f2da3739`; PT `6365a711d59a98d128be5b623cb1c2926c86d12a4b1edffeb58bb10115ec977c` |
| Training framework | Ultralytics YOLO11n 8.4.208; ONNX export | Ultralytics YOLO11n 8.4.211; ONNX export | Ultralytics YOLO11n 8.4.210; ONNX export |
| Training run | `/tmp/terung_finetune/expr` (embedded in `best.pt`; logs unavailable) | `/kaggle/working/runs/tomato/expr` (embedded in `best.pt`; logs unavailable) | `/content/runs/detect/runs/cabai/yolo11n_chili_v2` (embedded in `best.pt`; logs unavailable) |
| Training dataset | `Eggplant-Quality-Grades-2` v2 — **probable**, not byte-verified | `tomato-thesis-e4` v1 — recorded by checkpoint and model data.yaml | `Chili-Data-set-v4` v2 — recorded by checkpoint and model data.yaml |
| Dataset project ID | `eggplant-quality-grades-hgdr1-oooww` | `tomato-thesis-e4-89vr8` | `chili-data-set-v4-r9wwe` |
| Dataset version | 2 | 1 | 2 |
| Export format | YOLOv11 detect (five-field boxes) | YOLOv11 detect (five-field boxes) | YOLOv11 detect (five-field boxes) |
| Dataset export hash | `0beffe50676d433ea5751def52029607e032e13465f1e46cfe626291a6c3cbfb` (local export) | **UNVERIFIED** — exact training export unavailable. Local external export: `7edbc2d4c7c1443c43d5af8b1a68a50e0a5cd1c17a8f364535ed5e9cf3cc6076` (not training) | **UNVERIFIED** — exact training export unavailable. Local external export: `ec67b176c58ff95f1e88d8579168c456aaf5c4d54a517438591d065e683d49d1` (not training) |
| Dataset license | `CC BY 4.0` declared in local `data.yaml`/README; **PARTIALLY_VERIFIED** | `CC BY 4.0` declared in model-local `data.yaml`; exact export/page unavailable; **PARTIALLY_VERIFIED** | `CC BY 4.0` declared in model-local `data.yaml`; exact export/page unavailable; **PARTIALLY_VERIFIED** |
| Train count | 16,168 images / 47,490 valid boxes; 4 invalid rows; 37 empty labels | **UNVERIFIED** for training. Local external export: 2,100 images / 2,418 boxes | **UNVERIFIED** for training. Local external export: 1,266 images / **0** valid boxes |
| Validation count | 1,028 images / 1,842 valid boxes | **UNVERIFIED** for training. Local external export: 425 images / 445 boxes | **UNVERIFIED** for training. Local external export: 353 images / **0** valid boxes |
| Test count | 1,022 images / 1,597 valid boxes | **UNVERIFIED** for training. Local external export: 280 images / 305 boxes | **UNVERIFIED** for training. Local external export: 181 images / **0** valid boxes |
| Class names | `0 Grade A`, `1 Grade B`, `2 Reject` | `0 Grade A`, `1 Grade B`, `2 Reject` | `0 Grade A`, `1 Grade B`, `2 Reject` |
| Annotation status | Structurally parseable except 4 polygon rows; 37 empty train labels; 1 train-internal exact duplicate group; **label semantics unverified** | Structurally parseable external export; 2 train-internal exact duplicate groups; **training labels unavailable; semantics unverified** | External export has 1,818 non-box rows and **zero valid boxes**; training labels unavailable; **semantics unverified** |
| Evaluation dataset | `Eggplant-Quality-Grades-2` test split (in-distribution). Held-out use **not proven** | `tomato-freshness.v1-tomat.yolov11` — **external domain**, not primary held-out set | `Smart Conveyor Cabai Rawit.v1i.yolov11` — **invalid external dataset**, not usable for evaluation |
| Evaluation report | **None.** No held-out metrics were computed. Only a structural audit exists | **None.** No held-out metrics were computed. Only an external-export structural audit exists | **None.** No metrics are possible from a zero-valid-box export. Only a structural audit exists |
| Provenance status | `PARTIALLY_VERIFIED` | `PARTIALLY_VERIFIED` | `PARTIALLY_VERIFIED` |
| Deployment readiness | `BLOCKED` | `BLOCKED` | `BLOCKED` |

## Why each provenance status is not `VERIFIED`

### Terung

The project/version agrees across three independent sources: the local export `data.yaml`, the model-local `data.yaml`, and the ONNX/checkpoint training string. The local export has the expected three class IDs and a complete image/label pairing. However, the checkpoint records `/tmp/terung_calib/data.yaml`, which is absent, so the exact training bytes cannot be matched to the local export. Four training rows are polygons, 37 empty labels need confirmation, and one train-internal duplicate group remains. These are real integrity issues, not metadata cosmetic issues.

### Tomat

The checkpoint and ONNX both record `/kaggle/working/tomato-thesis-e4-1/data.yaml`; the model-local `data.yaml` identifies `tomato-thesis-e4-89vr8` v1. The previously recorded `tomato-freshness` export is a different Roboflow project and is not the training source. That conflict is now corrected in the manifest by moving `tomato-freshness` to `evaluation_datasets` with role `external_domain_evaluation`. The exact thesis export, its labels, and its counts remain unavailable, so the training side is `PARTIALLY_VERIFIED`, not `VERIFIED`.

### Cabai

The checkpoint, ONNX, and model-local `data.yaml` agree on `chili-data-set-v4-r9wwe` v2. The previously recorded `Smart Conveyor` export is a different project. It is now recorded as an invalid external dataset, not as training data. The exact `Chili-Data-set-v4` export is unavailable, so the training labels cannot be audited. The local `Smart Conveyor` export is not a substitute: all 1,818 rows are non-five-field and there are zero valid boxes.

## Evidence references

| Evidence | Path / source |
|---|---|
| Artifact and dataset hashes | [evidence-inventory.md](evidence-inventory.md) |
| Terung audit | `docs/model-evaluation/evidence/terung-eggplant-quality-grades-v2.audit.json` |
| Tomat external audit | `docs/model-evaluation/evidence/tomat-tomato-freshness-v1.audit.json` |
| Cabai external audit | `docs/model-evaluation/evidence/cabai-smart-conveyor-v1.audit.json` |
| Structural findings | [dataset-integrity-audit.md](dataset-integrity-audit.md) |
| Before/after reconciliation | [provenance-reconciliation-report.md](provenance-reconciliation-report.md) |
| Model manifests | `server/models/{terung,tomat,cabai}/model-metadata.json` |
| Checkpoint/ONNX evidence | `best.pt` embedded `train_args`; ONNX custom metadata `description` and `names` |

## Non-negotiable rules

1. A model artifact hash proves file integrity, not label correctness, performance, or commercial validity.
2. A local dataset export is not the training dataset unless the checkpoint/training evidence says so.
3. An external-domain export cannot be used as the primary held-out test set.
4. `VALIDATED` requires verified provenance, licence, annotation quality, class semantics, a frozen threshold, and a one-time held-out evaluation. None of the three models has that evidence.
5. The matrices and manifests must be updated only with new evidence; status labels must not be edited to make the project look complete.
