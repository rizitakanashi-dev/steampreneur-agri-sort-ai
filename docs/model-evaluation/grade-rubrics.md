# Provisional commodity grade rubrics

**Status: requires agronomist review; no commodity is semantically validated.**

The model contract uses exactly three output IDs for each commodity:

| ID | Output | Provisional shared meaning |
|---:|---|---|
| 0 | Grade A | Candidate for the top acceptable grade under a commodity-specific, documented standard. |
| 1 | Grade B | Candidate for a lower acceptable grade under that same standard. |
| 2 | Reject | Candidate for exclusion from the acceptable grades under that same standard. |

These descriptions are taxonomy placeholders, not operational grading criteria. They do not define acceptable size, shape, color, maturity, blemishes, disease, decay, damage, or commercial tolerance. Those criteria must be specified for each commodity by a qualified agronomist and the relevant buyer/market standard, with visual examples, borderline cases, and annotation instructions. No such criteria are asserted here.

## Commodity readiness

| Commodity | Dataset label structure | Semantic status | Required next evidence |
|---|---|---|---|
| Terung | `data.yaml` names match the canonical order, but the training split contains polygon/segmentation label rows that this object-detection evaluator cannot score as boxes. | `needs_data`; rubric unverified. | Establish the authoritative commercial standard; resolve segmentation-vs-detection annotation format without guessing; verify annotation provenance and split grouping. |
| Tomat | `data.yaml` names match the canonical order and labels are structurally parseable as three detection classes. | `needs_data`; rubric unverified. A canonical class-name list does not prove these labels mean commercial Grade A/B/Reject. | Confirm annotation instructions and provenance, independently review representative images/labels against an approved tomato rubric, and check capture-group leakage. |
| Cabai | `data.yaml` names match the canonical order, but current labels are not valid five-field detection boxes and cannot be evaluated by the box evaluator. | `needs_data`; rubric unverified. Manifest provenance also notes a mismatch with the previously recorded project. | Confirm source/release and label task, obtain valid reviewed detection annotations or an approved conversion protocol, and establish the cabai rubric. |

## Gate

Until commodity-specific criteria and annotation semantics are independently reviewed, all three models remain `candidate` and all grading claims remain exploratory. Structural class compatibility is not a label-semantics check. Do not rename unrelated freshness, ripeness, defect, or segmentation labels into commercial grades. Do not mark a model `validated` or enable trusted commercial grading based on this document or the structural audit alone.
