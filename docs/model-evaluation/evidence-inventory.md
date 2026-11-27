# Evidence inventory — model and dataset provenance

**Audit date:** 27 November 2026
**Repository:** `/home/Rizi/agri-sort-ai`
**Branch:** `fix/ml-provenance-readiness`
**Scope:** Terung, Tomat, Cabai model artifacts; available dataset exports; provenance metadata; audit outputs.

This inventory records what was actually inspected. It does not infer training use from a dataset name, and it does not treat an artifact hash as evidence of model quality.

## Verification legend

| Status | Meaning |
|---|---|
| `VERIFIED` | The exact file/content was inspected and the claim was checked against it. |
| `PARTIALLY_VERIFIED` | Independent sources agree on identity, but at least one required artifact or source is unavailable. |
| `UNVERIFIED` | No sufficient evidence was available. No hash or statistic is invented. |
| `CONFLICTED` | Two inspected sources disagree and the conflict has not been resolved. |

## Model artifacts

All artifact digests below were recomputed from the working tree and match the digests declared in the corresponding manifest.

| Commodity | Artifact | Path | SHA-256 | Manifest match |
|---|---|---|---|---|
| Terung | ONNX | `server/models/terung/best.onnx` | `2275d05fafbb8d28f06b305c000e842c56ec2d716697217a56c6daff4e579b4b` | yes |
| Terung | PyTorch | `server/models/terung/best.pt` | `336f21b9fa844a790856218cff59ee897db05680e972810c5ec4f99b0c6ff21f` | yes |
| Tomat | ONNX | `server/models/tomat/best.onnx` | `6f10f34cf7022919012363f4497a42d0b9a642da947893067419e7292e6f7be2` | yes |
| Tomat | PyTorch | `server/models/tomat/best.pt` | `a1021b12b44d77ff30a5b797e9ff878e9d6316ff592f99fb7f6568409a3a49c3` | yes |
| Cabai | ONNX | `server/models/cabai/best.onnx` | `4ea442e1197de2f81e1791a9031ad99341f5e3e92e236d44237b01e4f2da3739` | yes |
| Cabai | PyTorch | `server/models/cabai/best.pt` | `6365a711d59a98d128be5b623cb1c2926c86d12a4b1edffeb58bb10115ec977c` | yes |

No model weight, ONNX graph, class order, or inference threshold was modified by the provenance audit.

## Model-local dataset configuration

| Commodity | File | SHA-256 | Project | Version | Classes |
|---|---|---|---|---:|---|
| Terung | `server/models/terung/data.yaml` | `876ad29a13932a63c07443e194b36d6936b56c17e34b719ee610b240b1586e15` | `eggplant-quality-grades-hgdr1-oooww` | 2 | Grade A, Grade B, Reject |
| Tomat | `server/models/tomat/data.yaml` | `fe277add28d120e904ca296f9769024a0da3dbab66cb1e00a7bf5ad87c600d97` | `tomato-thesis-e4-89vr8` | 1 | Grade A, Grade B, Reject |
| Cabai | `server/models/cabai/data.yaml` | `446afed3845ce4009e77579b0e400142cb60d52f24ad00aed1ae33fe4fc96cbb` | `chili-data-set-v4-r9wwe` | 2 | Grade A, Grade B, Reject |

All three files declare `license: CC BY 4.0`. The declaration is evidence of the export metadata, not independent confirmation from the publisher page.

## Checkpoint and ONNX evidence

| Commodity | Evidence source | Recorded training input | Recorded run directory | Embedded classes | Framework metadata |
|---|---|---|---|---|---|
| Terung | `best.pt` pickle strings + ONNX `description` | `/tmp/terung_calib/data.yaml` | `/tmp/terung_finetune/expr` | `Grade A`, `Grade B`, `Reject` | Ultralytics 8.4.208; ONNX export `2026-11-11T12:12:17.148904+07:00` |
| Tomat | `best.pt` pickle strings + ONNX `description` | `/kaggle/working/tomato-thesis-e4-1/data.yaml` | `/kaggle/working/runs/tomato/expr` | `Grade A`, `Grade B`, `Reject` | Ultralytics 8.4.211; ONNX export `2026-11-12T03:22:47.514363+00:00` |
| Cabai | `best.pt` pickle strings + ONNX `description` | `/content/Chili-Data-set-v4-2/data.yaml` | `/content/runs/detect/runs/cabai/yolo11n_chili_v2` | `Grade A`, `Grade B`, `Reject` | Ultralytics 8.4.210; ONNX export `2026-11-11T06:46:33.302201+00:00` |

The checkpoint strings were read without importing or executing the pickle. The ONNX metadata was read with ONNX Runtime. The three inputs are `[1, 3, 640, 640]` float tensors and the outputs are `[1, 7, 8400]` tensors, consistent with a three-class YOLO11n detection head.

**Artifact license:** each ONNX file embeds `license: AGPL-3.0 License (https://ultralytics.com/license)`. This is a separate issue from the dataset license. Distribution and network-use obligations require legal review before production deployment. This inventory is not legal advice.

## Available dataset exports

The export manifest hash is deterministic: `SHA-256(relative_path NUL size NUL file_sha256 LF)` over sorted files, including `data.yaml`, `README.roboflow.txt`, images, and labels. Cache files are excluded. The label manifest uses the same construction over label files only.

| Dataset | Local root | Data config SHA-256 | README SHA-256 | Export manifest SHA-256 | Label manifest SHA-256 | Files hashed |
|---|---|---|---|---|---|---:|---|
| `Eggplant-Quality-Grades-2` v2 | `/home/Rizi/agri-sort-ai/Eggplant-Quality-Grades-2` | `876ad29a13932a63c07443e194b36d6936b56c17e34b719ee610b240b1586e15` | `31c1c10f205a5349dabeb0493067034051c19a4503a32a422d92e3e0bccda235` | `0beffe50676d433ea5751def52029607e032e13465f1e46cfe626291a6c3cbfb` | `50a2c542fd0ea70df820cc32175010bf98ceaa05044fafc703ef711793e13a5a` | 36,438 |
| `tomato-freshness.v1-tomat.yolov11` | `/home/Rizi/dataset/tomato-freshness.v1-tomat.yolov11` | `58dc0fb3fa811bb0d95627344d9061f91f73ecb8922f1ae61d15c4f9d908f0ab` | `fa3b99b2cb121d4347533dabf5fbf62e47b1e111be69c34c4115cc924236af69` | `7edbc2d4c7c1443c43d5af8b1a68a50e0a5cd1c17a8f364535ed5e9cf3cc6076` | `4ec63ee5ec67c6a85fa8e3387ac621012fc83c3c0713b492a6c8da63eadf0a52` | 5,612 |
| `Smart Conveyor Cabai Rawit.v1i.yolov11` | `/home/Rizi/dataset/Smart Conveyor Cabai Rawit.v1i.yolov11` | `185ef6cd88c970a4b842bf9b20af031bf29e5816871463731200ab4a84ddd63c` | `459795fda8ec07f370b858c9aede16b6be873d017e863c5a56b258262617d26e` | `ec67b176c58ff95f1e88d8579168c456aaf5c4d54a517438591d065e683d49d1` | `dd147b7ab40b1f548e0cf4a45324908da5b92c7ff6346eb8d7d1f1d6218a9ff4` | 3,602 |

These three exports are not interchangeable. `tomato-freshness` and `Smart Conveyor` are **not** the training datasets recorded by the Tomat and Cabai checkpoints.

## Audit evidence files

| Report | Path | SHA-256 |
|---|---|---|
| Terung structural audit | `docs/model-evaluation/evidence/terung-eggplant-quality-grades-v2.audit.json` | `b783932e1bcdfcfbf9db6e84d72d82abcbfe29281bb4b73ca9a515d2b1c40234` |
| Tomat external export audit | `docs/model-evaluation/evidence/tomat-tomato-freshness-v1.audit.json` | `3819a7e78bcddbe6c12d21e1450b055bbac373327a4d88971388a8ab29583360` |
| Cabai external export audit | `docs/model-evaluation/evidence/cabai-smart-conveyor-v1.audit.json` | `3f87e6632fecab10471e2779b4b43d5073ff797ac795c66f20eb05b9862ae733` |

Reports contain aggregate counts and hashes only; they do not contain local roots, per-image filenames, or image contents.

## Required evidence that is unavailable

| Commodity | Missing evidence | Why it matters | Current status |
|---|---|---|---|
| Terung | Exact `/tmp/terung_calib` export and training logs | Proves the model trained on the same bytes as `Eggplant-Quality-Grades-2` v2 | `PARTIALLY_VERIFIED` |
| Tomat | Exact `/kaggle/working/tomato-thesis-e4-1` export and training logs | Counts, labels, split membership, and licence for the actual training data | `UNVERIFIED` |
| Cabai | Exact `/content/Chili-Data-set-v4-2` export and training logs | Determines whether the model learned valid boxes and what the classes mean | `UNVERIFIED` |
| All | Original Roboflow project pages / licence records | Independent licence and version confirmation | `PARTIALLY_VERIFIED` |
| All | Training logs, frozen threshold, held-out report | Reproducible performance and deployment decision | `UNVERIFIED` |

No hash, image count, class count, or metric was fabricated for an unavailable file.

## Reproduction commands

```bash
cd /home/Rizi/agri-sort-ai
sha256sum server/models/*/best.onnx server/models/*/best.pt server/models/*/data.yaml
PYTHONPATH=. .venv/bin/python server/scripts/audit_yolo_dataset.py \
  --dataset-root Eggplant-Quality-Grades-2 \
  --output /tmp/terung-audit.json
PYTHONPATH=. .venv/bin/python -m pytest server/tests/test_dataset_audit.py \
  server/tests/test_model_provenance.py server/tests/test_model_registry.py -q
```

The audit command is read-only. It does not copy, rename, relabel, or delete dataset files.