# Task 1 implementation report

## Changes

- Added `server/services/model_registry.py` for manifest loading, streaming SHA-256 hashing, and exact 3-class/artifact/optional ONNX metadata validation. Contract violations raise `ModelContractError`; labels are never remapped.
- Added `server/tests/test_model_registry.py` with valid/invalid class order, missing/invalid digest, digest mismatch, ONNX embedded name mismatch, exact file hashing, missing/corrupt manifest, missing artifact, and real artifact/ONNX metadata checks.
- Updated `server/models/{terung,tomat,cabai}/model-metadata.json` with observed current ONNX/PT hashes, embedded class order and tensor shapes, dataset source/config/annotation tree hashes, counts, and explicit `candidate` / `needs_data` state.
- No external dataset images or labels were copied into the repository.

## TDD and verification evidence

RED command before adding the implementation:

```bash
./.venv/bin/python -m unittest server.tests.test_model_registry -v
```

Observed: import failed because `server.services.model_registry` did not exist (`ModuleNotFoundError`), as expected for the missing feature.

GREEN commands after implementation:

```bash
./.venv/bin/python -m unittest server.tests.test_model_registry server.tests.test_model_integration -v
```

Observed: 19 tests ran, all passed. Real ONNX Runtime metadata checks ran successfully.

```bash
python -m json.tool server/models/terung/model-metadata.json
python -m json.tool server/models/tomat/model-metadata.json
python -m json.tool server/models/cabai/model-metadata.json
git diff --check
sha256sum server/models/{terung,tomat,cabai}/best.onnx server/models/{terung,tomat,cabai}/best.pt
```

Observed: all JSON parsed, diff check was clean, and all six deployable weight hashes matched their manifests.

## Artifact/data evidence and limitations

Current ONNX exports were loaded with ONNX Runtime 1.32.0. All three embed `0: Grade A`, `1: Grade B`, `2: Reject`, use input `[1,3,640,640]`, and output `[1,7,8400]`. SHA-256 values and export metadata are in each canonical manifest. Dataset configuration and annotation counts are also recorded there, with dataset roots remaining external to git.

The current weight export descriptions point to training configurations that are not present in the repository and differ from some locally available candidate dataset exports. The local Tomato and Cabai dataset identities do not match the previously claimed model provenance. Matching three label names does not prove that annotations mean commercial grades. No per-commodity grade rubric or independent semantic verification was available. Therefore all current commodity releases remain `candidate`, and all candidate dataset semantics are `needs_data`; this task does not claim model accuracy or validation.

## Self-review

- Registry compares class IDs and ordered names exactly, rejects extra/missing classes, validates exact artifact bytes, and rejects missing/malformed ONNX names.
- Test fixtures use temporary bytes, while real model tests validate the deployed artifacts without modifying them.
- No dataset contents, user credentials, or model predictions were added to the report/manifests.
- Scope is limited to Task 1.

## Task 1 review fix: reject structurally incomplete manifests

Added structural validation to `load_model_manifest` for the canonical top-level sections (`model`, `artifacts`, `dataset`, `grading`, `inference`, `deployment`) and required nested fields/types, including canonical dataset class order. Existing supported grading sections are preserved: either `grading.mapping_status` or `grading.system` is accepted. No model metadata manifests were modified.

### TDD and verification evidence

RED command (the first invocation was from the parent checkout and failed during test-module import; it did not reach the regression assertion):

```bash
./.venv/bin/python -m unittest server.tests.test_model_registry.TestModelRegistry.test_rejects_structurally_incomplete_json_manifest -v
```

Result from the specified worktree after correcting cwd:

```text
FAIL: test_rejects_structurally_incomplete_json_manifest
AssertionError: ModelContractError not raised
```

This confirmed syntactically valid `{}` was incorrectly accepted.

GREEN command:

```bash
./.venv/bin/python -m unittest server.tests.test_model_registry server.tests.test_model_integration -v
```

Result: `Ran 20 tests in 0.252s` / `OK` (includes current manifests, artifact digest checks, and ONNX metadata checks).

Diff validation command:

```bash
git diff --check
```

Result: exit status 0; no whitespace errors.

The above commands were run with working directory `/home/Rizi/agri-sort-ai/.worktrees/three-grade-model-audit`.

Implementation commit: `8ea5a47` (`fix(models): validate manifest structure`).
