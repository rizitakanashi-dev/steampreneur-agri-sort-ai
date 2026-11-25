# Phase 0–4 Security Verification

**Review date:** 2026-11-24  
**Scope:** repository and local disposable test environments only. No external database, provider settings, deployment, secrets, or real user data were accessed. No migration was applied outside the disposable local PostgreSQL cluster. No commit or push was made.

## Verdict

**Not production-ready.** The repository has meaningful local evidence for application authorization and regression behavior, but production readiness cannot be established without an approved production-schema inventory, Supabase-specific migration/RLS validation, provider/recovery checks, backup restoration proof, and deployment/rollback evidence.

## Scope and evidence

Reviewed the Phase 0–4 authentication configuration/service/routes, session restoration/storage, authorization services/dependencies, QC/history/pricing/organization routes, admin dashboard/API, browser harvest storage and CSV exports, migration SQL, test coverage, and dependency-limited AI tests.

The original audit confirmed the target checkout: branch `feat/phase0-phase1-org-rbac`, HEAD `83163756eb10e5e4c6528c45cc16aefad5b54ef6`. The PR #34 remediation was performed on the same branch at HEAD `8359704b4669bd5c83334c5e68a4c9b8fa823f3c`; the original audit evidence below is retained as historical context.

## PR #34 snapshot-integrity addendum

**Status:** implemented locally and exercised by automated tests; **not verified live on Supabase, not verified on staging, not production-ready.** See `docs/15-rbac-migration-retain-design.md` section 12 for the authoritative contract.

New finding closed by this remediation: the account export previously bound only a scan count, so a changed, added, deleted, or same-count-replaced scan set could pass deletion verification. That is now a database-coordinated exact-snapshot check:

- `public.rbac_scan_snapshot()` hashes canonical JSON containing schema version, owner, count, and every scan row; timestamps use fixed UTC microsecond text and rows are ordered by UUID `id`.
- `snapshot.json` is the exact canonical text; its SHA-256 is signed into the manifest and stored on `account_exports` alongside `snapshot_schema_version`.
- Every scan INSERT/UPDATE/DELETE takes a per-owner transaction advisory lock; owner transfer locks old and new owners in deterministic UUID order; TRUNCATE is rejected.
- `rbac_delete_account` takes the same lock, recomputes the exact snapshot, requires a downloaded/unexpired export, and rejects any add/change/delete/replacement, manifest/column mismatch, or same-count substitution. It also rejects non-READ-COMMITTED isolation so a stale snapshot cannot be verified.
- `downloaded` remains **user attestation only**; it is not technical proof that a file was saved.

Local test evidence from this remediation: account workflow 24/24; disposable PostgreSQL snapshot/integrity/concurrency 26/26; existing migration safety 24/24; frontend unit 146/146; frontend UI 19/19; frontend build passed; Python compile passed. The broad backend run executed 340 tests with three AI-runtime errors caused by missing `onnxruntime`/`ultralytics` and 28 dependency-related skips; those are environmental, not snapshot-test failures.

Still unverified: Supabase PostgREST RPC grants, actual RLS behavior with the real `scans` policies, live PostgreSQL extension/version behavior, staging migration, storage/SSE/HMAC key custody, deletion re-authentication for Google-only accounts, backup/rollback rehearsal, and production monitoring. Production verdict remains **NO-GO**.
 Existing Phase 0–4 edits were preserved. Work remained in `/home/Rizi/agri-sort-ai-phase0-phase1-rbac`.

### Findings and remediation

| Severity | Finding | Status / evidence |
| --- | --- | --- |
| High | Spreadsheet formula injection in text cells exported to CSV (e.g. `=`, `+`, `-`, `@`, including leading whitespace/control characters). RFC 4180 quoting alone does not prevent spreadsheet formula evaluation. | **Fixed locally.** `src/utils/csvExporter.js` now prefixes formula-like text with an apostrophe while preserving numeric values; `tes/csvExporter.test.js` has a regression test. Test-first confirmation: the new regression failed before the fix and passes after it. |
| High | Scan/history ownership and organization isolation are security-critical. | **No bypass found in reviewed application path.** Authenticated owner ID is used for history reads/writes/deletes; client `user_id` is rejected for manual history creation; scan storage queries include owner filters and use the user's bearer. RBAC does not grant org admins/Super Admins access to someone else's private scans. This is code/test evidence, not a deployed Supabase verification. |
| High | Auth provider selection, outage handling, session verification and recovery deployment configuration. | **Partial.** Provider selection is explicit/fail-closed; session identity is checked with the selected provider; provider outage is distinguished from invalid credentials in exercised tests. Refresh/session state in Local Auth is file-backed and not an atomic cross-process authority. Production provider, OTP rate limiting/delivery, recovery policy, session revocation and settings require operator verification. |
| Medium | Organization-management RPC/RLS/grants/audit/locking need database execution evidence. | **Partly verified in disposable PostgreSQL 18.7 only.** The migration applied successfully to a temporary local cluster with minimal `auth.users`, `auth.uid()` and `anon`/`authenticated` shims. Probes verified scoped organization/profile visibility, authenticated direct-write denial, anonymous RPC/table denial, authenticated API RPC grants, audit creation and append-only enforcement, actor-JWT checks, and last-active-Super-Admin profile/role protection. These shims are not Supabase; provider-managed roles, PostgREST, scans RLS, SQLSTATE mapping, and concurrency behavior remain unverified. |
| Medium | CSV/harvest browser storage is local, not an authorization boundary. | Confirmed and documented: harvest batches are partitioned using a browser-stored active user ID; the device owner or same-origin script can alter them. Do not treat them as server-authoritative or organization-shared. |
| Low / operational | AI test coverage requires optional runtime packages. | The local environment lacks ONNX Runtime and Ultralytics. Three AI-engine test cases error because candidate runtime construction cannot run; 28 tests skip for unavailable optional runtime/model conditions. This is a dependency limitation, not proof of safe or unsafe production inference. |

No further Critical/High finding that could be safely and locally remediated was confirmed in this review. External configuration, migration, deployment and recovery changes were deliberately not attempted.

## Verification results

### Passed

- `npm test`: **146 passed, 0 failed, 0 skipped**.
- `npm run test:ui`: **19 passed, 0 failed**.
- `npm run build`: **passed** (Vite production build, 1,841 modules transformed).
- Focused backend authorization/auth/session/history/storage/pricing/security selection using `/tmp/agri-rbac-phase2-venv/bin/python`: **135 tests passed**.
- Backend discovery excluding only the three explicitly listed AI-runtime-blocked test cases: **257 passed, 28 skipped**.
- `/tmp/agri-rbac-phase2-venv/bin/python -m compileall -q server`: passed.
- `git diff --check`: passed.
- Disposable PostgreSQL migration/RLS/RPC/audit/last-Super-Admin probes: passed for the cases listed above.

### Failed / blocked

- Unfiltered `python -m unittest discover -s server/tests -p 'test_*.py'`: **260 total; 3 errors, 28 skipped**. Errors are solely these AI-engine cases; ONNX Runtime/Ultralytics are absent:
  - `test_ai_engine.TestYOLOInferenceEngine.test_get_model_rejects_manifest_hash_mismatch_before_construction_or_cache`
  - `test_ai_engine.TestYOLOInferenceEngine.test_get_model_rejects_mismatched_embedded_classes_before_cache`
  - `test_ai_engine.TestYOLOInferenceEngine.test_predict_blocks_candidate_models_unless_explicitly_allowed`
- Disposable PostgreSQL tests do **not** establish compatibility with Supabase's managed schema or deployed policies. There was no approved schema inventory and no `scans` table was created in the local RBAC harness.
- No real-browser Google/Auth provider, OTP email, account recovery, deployed endpoint, external RLS, backup restoration, or rollback test was run.

The focused Python suite emitted a Starlette/httpx deprecation warning and existing expected provider-offline fallback log messages; they were not failures.

## Explicitly not verified

- Actual staging/production branch, commit, secrets/environment, Supabase schema/migration history, PostgREST grants/RLS, Vercel deployment, or recovery/account status.
- Atomic refresh rotation/revocation across Local Auth processes, Local Auth absolute refresh expiry, or browser XSS resistance. Browser access/refresh tokens are in localStorage rather than HttpOnly cookies.
- Supabase Auth provider configuration, Google client/provider audience alignment, OTP abuse controls/email delivery, support/account-recovery procedures, or real-user flows.
- Backup restoration, destructive migration rollback, database concurrency/locking under parallel requests, and production scan-table RLS. No external system was touched.
- Runtime/model availability and real-model inference in this Python environment.

## Protected-data and repository integrity

Before and after the audit, SHA-256 remained identical for:

- Protected scans file `/home/Rizi/agri-sort-ai/server/data/scans.json`: `cc98e4a6dc95d8372248487a94a2996a0f5a7e21587d9ac2d1b2037914674318`
- Protected backup `/home/Rizi/.local/share/agri-sort-ai/protected-backups/scans.json.phase0-20261124-091229`: `cc98e4a6dc95d8372248487a94a2996a0f5a7e21587d9ac2d1b2037914674318`
- `docs/03-log-prompt.md`: `d009e64530061ea2f8d8928b953dc31ec033adfff168bf87004aca7ac011b0ef`

No migration was applied to an external database. No deploy, commit, push, merge, reset, rebase, or cleanup of existing user changes occurred. Disposable PostgreSQL files were created under `/tmp` and are scheduled for removal after the verification run.

## Operator actions before production consideration

1. Approve and inventory the real Supabase schema, roles, migration state, auth settings and existing RLS policies.
2. Validate this draft migration/RPC/RLS behavior against a Supabase-compatible disposable environment, including existing `scans` policies and error mapping; review and approve any follow-up migration before external use.
3. Verify Auth provider configuration, Google audience, OTP delivery and abuse protections, recovery/support process, token/session policy and secrets in each environment.
4. Perform and record an authorized backup restore and rollback/recovery exercise.
5. Verify deployed commit, environment isolation, health/readiness, monitoring and rollback in an approved deployment process.

Do not infer that any of these operator actions have happened from the local results above.
