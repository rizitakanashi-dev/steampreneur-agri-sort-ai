# Task 2 report — production model manifest enforcement

## Behavior implemented

- Build Terung, Tomat, and Cabai configs from their `model-metadata.json` manifests, including exact manifest name/version, class order, artifact paths, and visible deployment status.
- Keep ONNX as the default runtime. Validate the declared artifact SHA-256 before loading, then validate ONNX embedded `names` against the manifest before caching. Revalidate the manifest, hash, and embedded class metadata on cached loads.
- Use only manifest-declared PyTorch weights when explicitly selected or when ONNX Runtime is unavailable. Validate the PT digest and embedded class order before caching; removed the legacy unrelated artifact fallbacks.
- Raise `ModelContractError` for manifest/artifact/class/runtime contract violations. A `candidate` deployment status and `needs_data` semantics status remain visible in inference metadata and do not block inference. Explicit simulation remains outside the AI engine and unchanged.

## TDD evidence

RED command:

```sh
PYTHONPATH="$PWD/.venv/lib/python3.14/site-packages${PYTHONPATH:+:$PYTHONPATH}" python -m unittest server.tests.test_ai_engine.TestYOLOInferenceEngine.test_model_configs_use_exact_canonical_class_order server.tests.test_ai_engine.TestYOLOInferenceEngine.test_get_model_rejects_manifest_hash_mismatch_before_construction_or_cache server.tests.test_ai_engine.TestYOLOInferenceEngine.test_get_model_rejects_noncanonical_manifest_classes_before_inference server.tests.test_ai_engine.TestYOLOInferenceEngine.test_get_model_rejects_mismatched_embedded_classes_before_cache server.tests.test_model_integration.TestModelIntegrationAndBusinessGrading.test_ai_engine_configs_are_manifest_backed_for_each_commodity -v
```

Result: failed as expected before implementation: the current engine had no manifest-validation imports/functions; the integration assertions showed wrong/missing manifest-derived config values, including Cabai version. (Initial attempts to run through `pytest` and the venv's plain `unittest` were blocked by missing pytest/Pillow; no application code was changed for those environment issues.)

GREEN/focused command:

```sh
cd /home/Rizi/agri-sort-ai/.worktrees/three-grade-model-audit && .venv/bin/python -m unittest server.tests.test_ai_engine server.tests.test_model_integration server.tests.test_onnx_engine server.tests.test_ml_safety -v
```

Result: `Ran 50 tests ... OK`, zero skips. The final combined command includes all four requested suites plus registry tests; it includes real ONNX inference and the full ML-safety HTTP/simulation suite.

The standalone registry check was also run:

```sh
cd /home/Rizi/agri-sort-ai/.worktrees/three-grade-model-audit && .venv/bin/python -m unittest server.tests.test_model_registry -v
```

Result: `Ran 11 tests ... OK`, including current manifest/artifact hashes and ONNX embedded metadata.

Static checks:

```sh
cd /home/Rizi/agri-sort-ai/.worktrees/three-grade-model-audit && git diff --check && python -m py_compile server/services/ai_engine.py server/tests/test_ai_engine.py server/tests/test_model_integration.py
```

Result: success.

## Files changed

- `server/services/ai_engine.py`
- `server/tests/test_ai_engine.py`
- `server/tests/test_model_integration.py`
- `.superpowers/sdd/2026-11-23-three-grade-model-audit/task-2-report.md`

## Commit

`feat(model): enforce manifests in production model loading` (full hash recorded in final task status).
