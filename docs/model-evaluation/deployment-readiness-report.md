# Deployment readiness report — model provenance audit

**Audit date:** 27 November 2026
**Decision:** **NO-GO for validated production inference for all three models.**
**Current deployment state:** `candidate`; production inference fails closed unless the manifest status is `validated`. No status was changed by this audit.

## Decision summary

| Commodity | Provenance | Annotation integrity | Class semantics | Held-out evidence | Readiness |
|---|---|---|---|---|---|
| Terung | `PARTIALLY_VERIFIED` | Repairable but not clean: 4 invalid rows, 37 empty labels, 1 duplicate group | Unverified | None | **BLOCKED** |
| Tomat | `PARTIALLY_VERIFIED` (training export unavailable) | Training export unavailable; external export structurally valid | Unverified | None | **BLOCKED** |
| Cabai | `PARTIALLY_VERIFIED` (training export unavailable) | Training export unavailable; local external export has zero valid boxes | Unverified | None | **BLOCKED** |

## Gate-by-gate status

| Gate | Terung | Tomat | Cabai |
|---|---|---|---|
| 1. Training provenance verified | **Partial** — project/version agree, exact `/tmp` export absent | **Partial** — project/version agree, `/kaggle` export absent | **Partial** — project/version agree, `/content` export absent |
| 2. Exact dataset version established | **Partial** — v2, local export hash available | **Partial** — v1 recorded; training export hash unavailable | **Partial** — v2 recorded; training export hash unavailable |
| 3. Export integrity established | **Partial** — local export complete, 4 invalid rows | **Partial** — external export complete; training export missing | **Partial** — external export complete but zero valid boxes; training export missing |
| 4. Licence verified for intended use | **Partial** — CC BY 4.0 declared; publisher page not checked; AGPL artifact review required | **Partial** — declaration only; export missing; AGPL review required | **Partial** — declaration only; export missing; AGPL review required |
| 5. Annotation quality audited | **Partial** — structural audit only; 4 polygons, 37 empties, duplicate group | **Partial** — external export only; training labels unavailable | **Fail** — local export has 1,818 non-box rows / 0 valid boxes; training labels unavailable |
| 6. Class mapping verified | **No** — three class names recorded, semantics unverified | **No** — three class names recorded, semantics unverified | **No** — three class names recorded, semantics unverified |
| 7. Held-out dataset established | **No** — test split exists; held-out membership unproven | **No** — only external-domain export | **No** — no valid evaluation labels |
| 8. Evaluation reproducible | **No** — no frozen threshold/report | **No** — no frozen threshold/report | **No** — no valid evaluation data |
| 9. Performance meets approved criteria | **No** — no metrics | **No** — no metrics | **No** — no metrics |
| 10. Limitations documented | **Yes** — this audit and protocol | **Yes** — this audit and protocol | **Yes** — this audit and protocol |

`PARTIAL` or `No` on any gate is sufficient to keep the model at `BLOCKED`. Gate 10 alone does not make a model deployable.

## Code-enforced gate

`server/services/model_registry.py` now rejects a manifest whose `deployment.status` is `validated` unless all of the following are explicit and positive:

- `dataset.provenance_status == "VERIFIED"`
- `deployment.readiness == "VALIDATED"`
- `dataset.license_status == "VERIFIED"`
- audited `annotation_counts_status`
- `dataset.semantics_status == "verified"`
- `grading.mapping_status == "verified"`
- `evaluation.status == "PASSED"`
- `evaluation.threshold_frozen == true`
- `evaluation.held_out_test == true`
- `evaluation.acceptance_criteria_approved == true`
- a non-empty `evaluation.metrics_report`

This is a structural guard, not proof that the evidence is true. The evidence still has to be produced and reviewed. Tests cover candidate rejection, a relabelled candidate being rejected, and a fully populated synthetic gate being accepted.

## Per-commodity blockers

### Terung

**Why blocked:** the exact `/tmp/terung_calib` training export is absent; four training rows are polygons rather than detection boxes; 37 empty labels need owner confirmation; one exact duplicate group exists inside `train`; the class semantics and rubric are unverified; no threshold was frozen and no held-out test was run. The local export is structurally the strongest of the three, but that is not enough for validation.

**Minimum path to `READY_FOR_EVALUATION`:** provide or recreate the exact training export and hash; repair/annotate the four polygon rows; confirm or remove the 37 empty labels; resolve the duplicate group; complete group/session leakage review; obtain the agronomist rubric; approve gates; calibrate on validation and freeze.

### Tomat

**Why blocked:** the actual training export (`tomato-thesis-e4` v1 at `/kaggle/working/tomato-thesis-e4-1`) is unavailable. The local `tomato-freshness` export is a different project and cannot be the primary held-out set. Its 2,805 images and 3,168 boxes are external-domain evidence only. No training-label audit, rubric, frozen threshold, or held-out report exists.

**Minimum path:** obtain the thesis export, labels, split hashes, licence, and training log; audit annotation quality and leakage; approve the tomato rubric; establish an in-distribution held-out set; evaluate separately on `tomato-freshness` as external domain.

### Cabai

**Why blocked:** the actual training export (`Chili-Data-set-v4` v2 at `/content/Chili-Data-set-v4-2`) is unavailable. The local `Smart Conveyor` export is not the training source and is not valid detection data: all 1,818 rows are non-five-field and there are zero valid boxes. The checkpoint may still have learned valid boxes from Chili v4, but that cannot be demonstrated from the available evidence.

**Minimum path:** obtain and independently audit Chili v4; if its boxes are invalid or the task is segmentation, rebuild the dataset/annotation task before retraining; approve the cabai rubric; then calibrate and run a held-out test. Do not use Smart Conveyor as a substitute.

## Production behavior

- Candidate manifests cannot serve production inference; the application surfaces `MODEL_NOT_VALIDATED` / model-unavailable states and offers manual grading where supported.
- `get_system_status` reports candidate models as candidate, never `ready`.
- No model weights, thresholds, class mappings, or deployment status were changed by this audit.
- The models are therefore safe to leave deployed as candidates with fail-closed behavior, but they must not be described as validated or used for trusted commercial grading.

## Final decision

| Commodity | Decision | Next authorized action |
|---|---|---|
| Terung | **BLOCKED** | Obtain exact training export; repair annotation issues; rubric; calibrate/freeze; held-out test. |
| Tomat | **BLOCKED** | Obtain thesis export; audit; rubric; in-distribution held-out; external-domain report. |
| Cabai | **BLOCKED** | Obtain Chili v4; audit boxes/task; repair or retrain; rubric; evaluate. |

No model is `READY_FOR_EVALUATION` yet because the training-side evidence is incomplete. No model is `VALIDATED`, and none should be promoted on the current evidence.
