# Phase 6 — Staging & Production Readiness Assessment

**Assessment date:** 2026-11-24  
**Repository:** `/home/Rizi/agri-sort-ai-phase0-phase1-rbac`  
**Branch / expected HEAD:** `feat/phase0-phase1-org-rbac` / `8359704b4669bd5c83334c5e68a4c9b8fa823f3c`  
**PR #34 addendum:** the local snapshot-integrity remediation adds `supabase/migrations/20261124000300_org_rbac_scan_snapshot.sql`, a canonical database snapshot, a signed export manifest, exact deletion verification, and per-owner mutation/deletion locks. Local automated evidence now includes 26 snapshot/integrity/concurrency tests and 24 account workflow tests. This does **not** change the production decision: the new migration has not been applied to Supabase or staging, PostgREST/RLS behavior is unverified, and HMAC key custody, export storage/SSE, monitoring, and rollback rehearsal remain operator gates. See `docs/15-rbac-migration-retain-design.md` section 12.

**Scope:** local repository evidence, local environment metadata (without reading or publishing secret values), checked-in model artifact integrity, and prior documented disposable-PostgreSQL results. No Vercel/Supabase account, external database, deployed endpoint, production data, or secret was accessed. No migration, environment change, account creation/migration, deployment, commit, or push was performed.

## Executive decision

# `NO-GO — PRODUCTION RISKS REMAIN`

The repository contains explicit Auth Mode validation, deployment templates, owner-scoped scan code, RBAC source and migration draft, local regression evidence, and model manifests/artifacts. These facts do **not** establish deployed configuration, actual Supabase schema/RLS, account inventory/recovery, database backup/restore, staging behavior, or model inference in the target runtime.

**Staging verification cannot start against a real shared environment until an operator provides an approved non-production project/environment, read-only schema inventory, separate synthetic test accounts/data, and backup/restore plan.** A disposable environment may be prepared after the operator approves its scope. Production use remains blocked on all operator actions below.

### Status definitions

- **VERIFIED** — directly checked and supported by repository or local-run evidence stated here.
- **PARTIALLY VERIFIED** — some local/code evidence exists; environment or end-to-end behavior remains unproven.
- **NOT VERIFIED** — evidence is unavailable or a required check was not run.
- **BLOCKED** — cannot safely complete without operator-provided access/approval, or a required runtime/environment dependency is missing.
- **NOT APPLICABLE** — no applicable capability/resource is implemented in the repository; this does not imply availability elsewhere.

## Readiness matrix

| Category | Status | Evidence / release consequence |
|---|---|---|
| Vercel deployment settings and deployed commit | **NOT VERIFIED — OPERATOR ACTION REQUIRED** | `vercel.json` and a passing local frontend build were inspected. No `.vercel` project link, Vercel CLI, deployment credential variables, or operator-provided deployment read access is available. Do not infer actual deployment settings from templates. |
| Auth Mode policy and provider fallback | **PARTIALLY VERIFIED** | `server/config/auth_config.py` enforces explicit `APP_ENV` / `AUTH_MODE`, rejects Local Auth on Vercel/non-development, checks `VERCEL_ENV` compatibility, requires Supabase URL/key in Supabase mode, rejects service-role key formats, and the Auth client has no Local Auth provider fallback. Live Vercel values and Supabase behavior are unknown. |
| CORS / API URL / frontend configuration | **PARTIALLY VERIFIED** | Deployed UI uses same-origin `/api/v1/...`; Vite local dev proxies `/api` to `127.0.0.1:8000`. CORS source permits localhost/LAN and a broad `*.vercel.app` regex with credentials; actual domains and deployed origins are unknown. Tighten production allowlist to approved domains and validate preflight in staging. |
| Secret separation / frontend bundle | **PARTIALLY VERIFIED** | `.env.example` contains variable names and placeholders only. No local `.env` or `.vercel` file was present. A scan of the existing `dist` output found no service-role variable/name or JWT-like service secret markers. This is a limited local artifact check, not proof about deployed bundles or Vercel values. The anon key is public by design but must still be scoped correctly; service-role keys must remain backend-only and are not configured in checked-in frontend source. |
| Supabase schema, RLS, grants, and PostgREST compatibility | **PARTIALLY VERIFIED VIA CSV / GAPS REMAIN** | Operator-provided live SQL Editor CSV snippets (Nov 24 2026) confirm: (1) `public.scans` exists with 19 columns including `user_id uuid`; (2) the five RBAC tables are defined in the local migration source, but their live existence is **UNKNOWN** because Query B has not been run; (3) `auth.users` has UUID `id`; (4) `auth.uid()` and `auth.jwt()` exist as STABLE SQL functions; (5) CSV snippets show no RBAC functions or RBAC triggers, subject to the inventory visibility limitations documented in `docs/17-supabase-live-inventory-audit.md`. Live RLS policies, effective table privileges, FK constraints/delete actions, indexes, live RBAC objects, and migration history remain UNKNOWN (Queries A.1, A.2, B, D, E, F, G, H, J, K, L, M in `docs/17` §7 are not yet executed). The four CSV exports carry no project reference, so their provenance is asserted by operator context, not proven by the files. See `docs/17-supabase-live-inventory-audit.md`. |
| Account inventory and recovery | **BLOCKED — OPERATOR ACTION REQUIRED** | No authoritative Local Auth state file was present in the checked target paths; that says nothing about other machines, instances, snapshots, or deployments. Supabase/local account totals, duplicate identities, pending users, role/membership inventory, email status, and recovery readiness are **UNKNOWN**. |
| Database migration and rollback | **PARTIALLY VERIFIED / NOT READY TO APPLY EXTERNALLY** | SQL migration source is reviewed; previous work recorded a successful apply/probes on disposable PostgreSQL 18.7 with minimal auth shims. It is not idempotent: it intentionally aborts if any target table exists, and it has no down migration. Actual schema compatibility and operator rollback are unverified. |
| Backups and restore | **NOT VERIFIED — OPERATOR ACTION REQUIRED** | No database/object-storage/configuration backup or restore evidence was supplied. The protected local scans JSON hash is unchanged, but that file is not a database backup and was not restored. RPO/RTO are unknown. |
| Staging E2E verification | **BLOCKED** | No staging URL, approved project ref, environment values, isolated test identities, or deployed target was provided. Do not create external users or test against production. Checklist below is a required operator-run gate. |
| AI runtime / model loading / inference | **PARTIALLY VERIFIED; DEPLOYMENT BLOCKED** | Model manifests validate and all six ONNX/PyTorch artifacts match their declared SHA-256 hashes. All three models declare `candidate`, not `validated`. Local Python 3.14.10 has no ONNX Runtime, Ultralytics, PyTorch, or OpenCV, so inference and three prior AI tests are blocked. Vercel Python/runtime compatibility, memory, latency, and inference behavior are unknown. |
| Monitoring and incident response | **NOT VERIFIED — OPERATOR ACTION REQUIRED** | Code has selected safe Auth/provider error logs and audit intent, but no deployed dashboards, alerts, retention, on-call owner, incident playbook, or tested recovery evidence was available. |
| Prior local test/build evidence | **VERIFIED (LOCAL ONLY)** | The previous Phase 5 report documents JS tests/build, UI tests, focused Python tests, compile/diff checks, and disposable PostgreSQL shim probes. Unfiltered backend discovery had three AI-runtime errors and 28 skips. These results are not staging or production evidence. |

## 1. Deployment configuration and Auth provider

### Repository evidence

- `vercel.json` declares Vite framework, `npm run build`, output `dist`, rewrites `/api/:path*` to `/api/index.py`, SPA fallback to `/index.html`, and a serverless function maximum duration of 60 seconds. This is checked-in intent only.
- `api/index.py` validates Auth configuration during cold start, and `server/main.py` validates at ASGI lifespan startup. A malformed/missing selected configuration should fail closed; no Local Auth fallback is intended when Supabase is unavailable.
- `.env.example` lists `APP_ENV`, `AUTH_MODE`, `SUPABASE_URL`, `SUPABASE_ANON_KEY`, and optional `VITE_GOOGLE_CLIENT_ID`. It contains no valid project values. The repository's deployment guidance maps production to `APP_ENV=production`, `AUTH_MODE=supabase`, `VERCEL_ENV=production`; preview to `APP_ENV=preview`, `AUTH_MODE=supabase`, `VERCEL_ENV=preview`; staging on Vercel Preview to `APP_ENV=staging`, `AUTH_MODE=supabase`, `VERCEL_ENV=preview`.
- Frontend API calls are same-origin relative paths. Vite local dev proxies `/api` to localhost:8000. There is no checked-in VITE backend base URL configuration.
- CORS allows local origins and broad Vercel subdomains; production origin restrictions require operator review.
- No `pythonVersion`, custom Vercel runtime, or pinned Python runtime is specified in `vercel.json`; root/server requirements use lower bounds rather than a deployment lock. Actual Python runtime selection and dependency resolution are unknown.

### Environment matrix — values must be verified by operator without disclosing them

| Target | Required policy | Presence/validity in Vercel |
|---|---|---|
| Local development | `APP_ENV=development`; explicit `AUTH_MODE=local` or `supabase`; Local Auth only local development | Local template present; live `.env` absent in inspected checkout. Other developers' environments unknown. |
| Preview | `APP_ENV=preview`, `AUTH_MODE=supabase`, `VERCEL_ENV=preview`, approved non-production Supabase project | **NOT VERIFIED** |
| Staging on Preview | `APP_ENV=staging`, `AUTH_MODE=supabase`, `VERCEL_ENV=preview`, isolated staging Supabase project | **NOT VERIFIED** |
| Production | `APP_ENV=production`, `AUTH_MODE=supabase`, `VERCEL_ENV=production`, production project approved | **NOT VERIFIED** |

The local validator checks URL syntax/HTTPS policy and rejects recognized service-role key encodings. It does not establish that a URL/key pair identifies the intended project, is active, is protected in Vercel, or has correct provider settings. Presence, exact scope, and consistency of each live variable are **unknown**. Do not paste secret values into tickets or this document; an authorized operator should record only pass/fail and masked project identity.

### Operator checks

- [ ] Verify variable presence and Vercel scope for Development / Preview / Production without copying values into logs.
- [ ] Verify `APP_ENV` matches `VERCEL_ENV`; require `AUTH_MODE=supabase` for every Vercel environment.
- [ ] Verify Supabase URL and anon key correspond to the approved project per environment; do not reuse production keys in Preview/Staging unless explicitly approved.
- [ ] Verify no service-role key is set in any `VITE_*` variable, frontend build argument, browser bundle, or client-side source.
- [ ] Confirm deployment uses the intended branch/commit and build command, Python runtime, dependency installation, function size/memory, timeout, and cold-start behavior.
- [ ] Replace/limit broad CORS `*.vercel.app` matching to explicitly approved production/staging origins; validate credentialed preflight and bearer requests.
- [ ] Exercise Supabase outage and invalid credentials separately; outage must fail closed as unavailable and never switch providers.

## 2. Supabase schema and RLS

### Repository and live catalog inventory comparison

| Data domain | Checked-in implementation | Current evidence/status (Operator CSV + Local PG) |
|---|---|---|
| Auth users | Supabase-managed `auth.users` referenced by RBAC/profile and scan foreign keys | **LIVE CSV VERIFIED:** `auth.users` exists with 35 columns, UUID `id` (`not_null=true`). Query G confirms `auth.uid()` and `auth.jwt()` exist with expected STABLE SQL definitions. |
| User profiles | `public.user_profiles` in RBAC migration; one profile per Auth UUID; `pending_assignment` default | **UNKNOWN:** The local migration defines this table; live existence is unverified because Query B has not been run. This does not establish that the migration was applied. |
| Organizations | `public.organizations`: UUID, unique slug, active/suspended, name/region/kabupaten, timestamps | **UNKNOWN:** The local migration defines this table; live existence is unverified because Query B has not been run. This does not establish that the migration was applied. |
| Memberships | `public.organization_memberships`: organization/user FKs, role/status checks, partial unique active `(organization_id,user_id)` index | **UNKNOWN:** The local migration defines this table; live existence is unverified because Query B has not been run. This does not establish that the migration was applied. |
| Platform roles/permissions | `public.platform_roles` permits `super_admin`; application permissions are Python constants; no normalized permissions table | **UNKNOWN:** The local migration defines this table; live existence is unverified because Query B has not been run. This does not establish that the migration was applied. |
| Audit logs | `public.audit_events`; append-only trigger intent; allowlisted metadata; RPC audit writes | **UNKNOWN:** The local migration defines this table; live existence is unverified because Query B has not been run. This does not establish that the migration was applied. |
| Scans/history | `public.scans` DDL is in `server/services/storage_service.py`; `user_id` FK to `auth.users`; owner-only read/insert/update/delete policies. History APIs address this scan store. | **LIVE CSV VERIFIED:** `public.scans` is the only relation in `public`. All 19 columns including `user_id uuid` (nullable) match target shape. **UNKNOWN:** Live RLS enabled/forced flag (Query B), FK delete action (Query D), indexes (Query E), and live policies (Query F). |
| Harvest batches | Browser localStorage partitioned by active user ID (`src/business/harvestStorage.js`) | No server table or organization-sharing store found. Client storage is mutable and not an authorization boundary. |
| Pricing | Reference data/services and BAPANAS/SP2KP cache files under runtime data/temp path; shared sync endpoints require Super Admin permission. | No dedicated pricing database table or Supabase migration found. External feeds/cache persistence and alerting unknown. |
| Storage metadata/files | Scan table stores metadata/results; image upload is processed in request and no Supabase Storage bucket/policy definition was found. | Query C/M confirms `storage.buckets` and `storage.objects` exist with 11 system triggers; application-specific image bucket policy is **NOT APPLICABLE / UNKNOWN**. |

### Migration review

`supabase/migrations/20261124000100_org_rbac.sql` is a transaction-wrapped, additive **draft** that:

- Stops if any target table name exists. This is an intentional safety guard, but means it is **not idempotent/re-runnable** after success and does not reconcile an existing compatible table.
- Creates organizations, user profiles, memberships, platform roles, and audit events with FK/check/unique/index definitions.
- Inserts existing `auth.users` as `pending_assignment` without copying email/name/roles; trigger creates a pending profile for future Auth users.
- Enables RLS on the five new tables and defines SELECT policies; direct table writes are revoked from `anon`/`authenticated`, with grants for SELECT and named management RPCs.
- Uses SECURITY DEFINER helpers/RPCs with a fixed search path, private helper grants, caller `auth.uid()` checks, audit writes, and advisory-lock/trigger safeguards for the last active Super Admin.
- Checks active membership and active organization for authorization decisions in helpers/RPCs.
- Does not change `scans`, assign old scans to organizations, create Harvest batch/history/pricing tables, define storage buckets, or set `ALTER DEFAULT PRIVILEGES` / `FORCE ROW LEVEL SECURITY` in this file.

The separate scans DDL in `storage_service.py` is **not a versioned Supabase migration**. A local-only safety revision now preserves existing constraints and data, validates named index/FK/policy definitions, and aborts on unknown policy/index collisions; its behavior was exercised in disposable PostgreSQL. It is still a manual DDL artifact, not an approved external migration path, and actual Supabase schema/roles/PostgREST behavior remain unverified. See `docs/15-database-migration-safety.md` for detailed matrix and operator procedure. Existing production constraints/policies and data shape must be inventoried before external use.

### Compatibility and security checks still required

- [ ] Read-only inventory of actual Supabase schemas/tables/columns/types/defaults/constraints/indexes/triggers/extensions/owners and migration history.
- [ ] Inventory all existing RLS policies and table/function grants including inherited/default privileges; verify scans RLS and table grants specifically.
- [ ] Compare live scans schema with `_SUPABASE_SCAN_COLUMNS`, current upsert conflict target `(user_id,scan_id)`, history filters, null owner rows, and historical data; no backfill or deletion without separate policy.
- [ ] Check name conflicts for all migration-created tables, functions, indexes, policies, and triggers; compare semantics, not names alone.
- [ ] Test as `anon`, two unrelated authenticated users, Org Admin, farmer, merchant, pending/revoked/suspended accounts, and Super Admin against two organizations; verify both direct table access and RPC access.
- [ ] Verify grants/default privileges, SECURITY DEFINER ownership/search path, trigger execution rights, append-only audit writes, bootstrap restrictions, and `auth.uid()` claims through real Supabase/PostgREST-compatible identities.
- [ ] Validate suspension, revoke, duplicate assignments and concurrent membership attempts; ensure suspended organizations deny list/detail/member/management operations as intended.
- [ ] Confirm whether the deployment uses PostgREST directly, FastAPI proxy only, or both; the policies must not permit direct browser bypass.

**Schema inventory status: PARTIALLY VERIFIED VIA OPERATOR CSV / GAPS REMAIN.** Four live SQL Editor CSV snippets (Nov 24 2026) verified schemas, relation columns, `auth.uid`/`jwt`, and triggers. Live RLS policies, effective table privileges, FK constraints/delete actions, indexes, live RBAC objects, and migration history remain UNKNOWN (Queries A.1, A.2, B, D, E, F, G, H, J, K, L, M in `docs/17` §7 are not yet executed). The four CSV exports carry no project reference, so their provenance is asserted by operator context, not proven by the files. See `docs/17-supabase-live-inventory-audit.md`.

## 3. Legacy account inventory and recovery

### Inventory result

| Item | Result |
|---|---|
| Local Auth users per environment | **UNKNOWN**. No state file was found in the target worktree's checked locations; deployment instances, prior machines, snapshots, or other volumes were not accessed. |
| Supabase Auth users per environment | **UNKNOWN**; no Auth admin inventory was performed. |
| Duplicate identities / email conflicts | **UNKNOWN**; do not infer or merge by email. |
| Pending assignments / memberships / existing platform roles | **UNKNOWN** remotely; migration draft would seed all current `auth.users` profiles as pending, but actual result depends on reviewed live schema and migration history. |
| Email confirmation / provider state | **UNKNOWN**. |
| Account recovery readiness | **NOT VERIFIED**. Repository has Supabase OTP/password-reset request paths and Local Auth OTP logic, but no live email delivery/provider, abuse limits, recovery ownership, or user-flow evidence. |

### Safe migration and recovery plan

1. **Authorize and inventory:** operator exports counts and minimal pseudonymous identifiers from each approved environment. Keep raw emails/credentials out of routine reports; restrict handling and retention.
2. **Verify the human:** establish identity using an approved out-of-band process that does not rely only on the email address/name being linked. Do not assume a matching email proves ownership of a legacy account.
3. **Obtain confirmation:** inform the user of the target identity and required re-authentication; require explicit confirmation before linking, and record who approved the link and when.
4. **Link accounts safely:** link by verified immutable provider subject/UUID through a reviewed transaction/API. Avoid automatic merge, duplicate deletion, password transfer, or reuse of Local Auth password hashes. Resolve conflicting identities manually.
5. **Recover access:** use the chosen provider's verified password reset/email confirmation/MFA policy. Never collect passwords or OTPs through support or logs. Revoke legacy sessions only under an approved session migration plan.
6. **Pending assignment:** leave unmatched/new accounts `pending_assignment`; no organization or platform permission until a named authorized operator/admin assigns membership through the audited process.
7. **Audit:** record pseudonymous old/new IDs, verification method reference, operator approval, action/result, and timestamp without secrets or unnecessary PII.
8. **Rollback:** pause linking on mismatch, duplicate, provider outage, or audit failure. Preserve both identities and history; restore previous access mapping only from reviewed evidence. Do not delete either account or transfer scans automatically. Escalate to operator support.

No account count or account transition is claimed. **Account migration: NOT VERIFIED / BLOCKED.**

## 4. Database migration and rollback readiness

### Proposed sequence (operator approval required at every external stage)

1. **Freeze scope and identify target:** confirm a disposable/Staging Supabase project, project identity, region, role names, deployed commit, migration state, and maintenance window. Stop if target could be production or identity is ambiguous.
2. **Read-only baseline:** capture approved schema/RLS/grant inventory and row-count/constraint summaries without exporting sensitive records. Resolve every name/shape collision with a reviewed plan.
3. **Preflight scan schema separately:** review existing scans DDL and policies, including the named dropped constraint/policies. Identify duplicate keys, NULL/unowned rows, and all consumers. Do not execute runtime `get_supabase_ddl()` as a migration.
4. **Backup and prove restore:** capture a consistent database backup plus required object/configuration backup; restore only to an isolated target and verify integrity before change. A backup file existing is not restore evidence.
5. **Validate migration in disposable Supabase-compatible environment:** apply once to a schema representative of the approved target (including Auth roles/functions), verify transaction rollback on preflight failure, constraints/triggers/RPC signatures/ownership/grants/RLS, and concurrency-sensitive operations. Use synthetic identities/data.
6. **Review migration and deploy sequence:** approve a versioned forward migration and app compatibility window; draft currently aborts on existing target tables and has no down migration. Do not edit/apply the existing draft externally until schema comparison and operator review.
7. **Staging apply only after approval:** record migration version/checksum, actor, time, backup ID, and output. Run post-migration SQL and API smoke tests under separate role accounts.
8. **Production requires a separate approval:** staging pass is necessary but not sufficient. Confirm live backup/restore, traffic/maintenance plan, operator and support coverage, rollback decision and monitoring.

### Validation queries and smoke coverage

After an approved isolated/Staging apply, the operator should verify: all expected tables/columns and FK/check/index definitions; one profile per Auth user; no invented memberships or scan ownership backfill; active membership uniqueness; RLS enabled and effective for each role; absence of public write policies; `anon` RPC denial; authenticated RPC grants only as intended; direct table write denial; cross-org read/write denial; owner-only scan SELECT/INSERT/UPDATE/DELETE; append-only audit; audit row created atomically for each admin mutation; suspended user/org/revoked membership denial; last-active-Super-Admin protection; and postgREST error/status mapping. Test concurrency with independent transactions in disposable environment.

### Idempotency and rollback

- **RBAC migration rerun:** **NOT SAFE / intentionally aborts** if any target table exists. Disposable PostgreSQL tests verify a second application fails closed without changing catalog counts, and a forced object collision rolls back the transaction and permits a corrected forward retry after the collision is resolved in disposable PostgreSQL. Do not rerun externally to “repair” a partial state or apply it twice; inspect transaction/migration history and use reviewed forward SQL.
- **Scans DDL rerun:** the local helper was revised and verified repeatable in disposable PostgreSQL: it preserves existing constraints/records, validates named index/FK/policy definitions, rejects unknown permissive policies atomically, and enforces owner-only policies. It remains a manual artifact, not a versioned or externally approved migration; do not run automatically at application startup.
- **Rollback:** no destructive down migration is provided. Local tests verify failed transaction rollback and forward retry only; after successful apply, prefer application rollback while leaving schema/data intact if the older app is compatible. Schema correction requires a reviewed forward migration; restore is a separate approved recovery operation with data-loss window and account/audit reconciliation. Never drop RBAC tables or reset roles automatically.
- **Partial migration:** migration file begins a transaction; confirm actual database transaction semantics and migration runner before assuming atomicity. If failed, capture error and inspect schema/migration history read-only. Do not manually “finish” statements without DBA review.

**External migration status: NOT RUN.**

## 5. Backup and restore

- Database backup: **NOT VERIFIED** (no approved backup metadata/artifact or restore proof supplied).
- Supabase Storage/object backup: **NOT VERIFIED / no bucket definition found in checked-in source**.
- File-backed Local Auth, scan JSON, and pricing caches: local paths exist in code; files may reside under `/tmp` on Vercel and are ephemeral. They are not demonstrated durable backup sources.
- Configuration/secrets backup and access recovery: **NOT VERIFIED**; do not export plaintext secrets into this repository.
- Retention policy, encryption, access controls, off-site copies, RPO/RTO, restore time, and restore owner: **UNKNOWN**.
- Protected scan JSON checksum remained unchanged during this assessment, but **no restore test was performed** and the protected data was not accessed/read.

### Operator restore gate

- [ ] Identify database, object/file storage, Auth recovery, audit, and configuration sources included/excluded by backups.
- [ ] Record backup time, consistency method, encryption/key owner, retention, region, and restore point.
- [ ] Restore to isolated non-production environment; verify counts/constraints/RLS, ownership, audit, and application read/write using synthetic or separately approved test identities.
- [ ] Measure RPO/RTO and compare with owner-approved targets; document missing data and reconciliation procedure.
- [ ] Obtain DBA/data-owner sign-off before relying on backup for a migration or incident.

## 6. Staging verification checklist

**Prerequisites:** operator-approved staging Vercel project and separate Supabase project, known commit, approved schema/migration, verified backup restore, synthetic data only, monitoring enabled, and individually provisioned non-production test accounts. No account should be created by this assessment.

### Test identities

- [ ] Super Admin (operator bootstrapped, audited; never bootstrap self).
- [ ] Organization Admin in Org A.
- [ ] Farmer in Org A.
- [ ] Merchant in Org A.
- [ ] User with no organization.
- [ ] User with `pending_assignment` profile.
- [ ] User with revoked membership.
- [ ] Suspended user and suspended organization fixture.
- [ ] Separate farmer/admin in Org B to test cross-organization isolation.

### Functional/security scenarios

- [ ] Confirm staging origin, commit, deployment runtime, environment matrix, provider identity, and no production data.
- [ ] Register/login/logout; valid/invalid/expired session; access refresh, refresh-token reuse/rotation behavior, session restore and provider outage; confirm outage is 503/unavailable, not automatic Local Auth fallback.
- [ ] OTP delivery, email confirmation, reset/recovery expiry, reuse, rate limiting, generic account-enumeration behavior, and post-reset session policy (only if provider settings are approved).
- [ ] Organization create/read/update/suspend/reactivate and member list/assign/change/revoke by allowed/denied roles; duplicate assignments; self/admin elevation guard; suspended-org denial.
- [ ] Pending/no-org user cannot perform organization/platform management; own private scan policy is tested separately if product policy allows; membership revocation does not expose private data.
- [ ] Scan create/list/detail/delete and history listing/pagination/delete/clear: User A cannot read/delete User B's records even as Organization Admin/Super Admin. Spoofed `user_id` rejected.
- [ ] Harvest batch localStorage is explicitly treated as device-local, not organization-shared; CSV/JSON export/import and spreadsheet formula neutralization are tested with synthetic data.
- [ ] Public reference-price reads work; pricing sync is denied to anonymous, member and Org Admin, and allowed only to active Super Admin; test outage and audit/monitoring.
- [ ] No image/file/bucket API is assumed unless separately configured; verify upload, retention, deletion, access, and backup for every approved storage provider.
- [ ] Audit entries include actor/scope/action/target/time, exclude credentials/OTP and unnecessary PII, are append-only, and expose only to approved audit role.
- [ ] Verify 401/403/404/409/422/503 behavior, rate limits, CORS origin allowlist, logs, metrics, and request correlation without sensitive payload capture.
- [ ] Verify rollback of application artifact and schema compatibility; do not run down migration or restore data without separate approval.
- [ ] Record each test's actor, synthetic fixture, expected/actual result, timestamp, trace/audit reference, pass/fail, and operator sign-off.

**Staging verification status: BLOCKED — no staging access/config/accounts were supplied.**

## 7. AI runtime readiness

### Verified locally

- Python inspected: `3.14.10`; server requirements specify floors (`onnxruntime>=1.19.0`, `ultralytics>=8.3.0`, OpenCV headless, Pillow, NumPy) but do not pin a deployment lock.
- All three manifests (`terung`, `tomat`, `cabai`) parse and validate; each marks `deployment.status=candidate` and recommends FastAPI + ONNX Runtime.
- SHA-256 validation passes locally for each manifest-declared ONNX and PyTorch artifact (six files). Model files are present in checkout. This proves file integrity against the checked-in manifests only, not model quality/semantic readiness or Vercel packaging.
- AI code defaults to ONNX and fails closed on unavailable runtime; QC route returns `model_unavailable` or review-required status rather than silently synthesizing AI output in production mode. Explicit mock mode is marked simulated.
- Upload validation has a 10 MiB limit and a 4096 px dimension bound; this does not establish platform request limits or successful memory use.

### Partially verified / not verified

- **ONNX Runtime: NOT VERIFIED for inference.** Package absent locally. Three earlier AI tests are blocked/error because no runtime is available; the ONNX engine itself has no local runtime proof here.
- **Ultralytics/PyTorch: NOT VERIFIED for inference.** Packages absent locally. Model artifact hash alone does not show package/runtime compatibility.
- **Model loading and inference: BLOCKED.** No warm/cold load, CPU/GPU benchmark, output contract test against these artifacts, latency, concurrency, or real image test was run in an environment with compatible dependencies.
- **Vercel deployment: NOT VERIFIED.** Python runtime version, native wheel support, package/build size, cold-start, 60-second function duration, memory/CPU limits, and model-file inclusion/exclusion must be confirmed. `vercel.json` excludes `.pt` model files from function bundle but not ONNX files by pattern; actual artifact bundling was not inspected against a deployment.
- **Hardware:** current audit host reports a 6 GiB RTX 3050 Laptop GPU and 16 logical CPU cores, but the chosen manifest recommends ONNX CPU and Vercel hardware is unrelated/unknown. This host does not validate deploy hardware compatibility.
- **Temporary storage:** application scan/auth/cache files use `/tmp/agri-sort-data` on Vercel; this is ephemeral serverless storage and must not be used as the durable scan/account store. Request memory and temporary files were not load-tested.

**AI release condition:** keep models marked candidate and preserve human review/simulated labeling. Do not advertise production AI until compatible staging runtime loads the exact artifacts, validates class metadata/hash, runs representative synthetic/approved test images, meets operator-approved latency/memory/error targets, and clears model governance/evaluation criteria. Do not change model/threshold/algorithm merely to make tests pass.

## 8. Monitoring, logging, and incident readiness

### Source-level observations

- Auth and authorization code generally emits generic provider-unavailable logs without including credentials; prior isolated tests exercise some auth log redaction.
- QC and storage have exception logging paths; pricing cache logs error strings. This inspection did not prove deployed log redaction/retention. Review exception strings and HTTP client errors before enabling verbose production logs; never record request bodies, bearer headers, OTP, passwords, service-role keys, or private scan image/result payloads unnecessarily.
- Audit RPC intent covers org, user and membership administrative changes. No database-backed/deployed audit pipeline or alert delivery was verified. Pricing sync, Auth failures, storage and AI failures need operational telemetry in the actual runtime.
- No monitoring provider, alert rules, on-call roster, incident channel, incident response exercises, or tested restore process was verified.

### Required metrics/alerts

- Auth success/failure and provider latency/outage; 401/403/503 rate and refresh failure/reuse signal.
- Supabase/PostgREST availability, latency, auth schema/RLS errors, connection/rate limits and migration drift.
- Organization suspension/reactivation; member assign/revoke/role change; profile status and Super Admin/bootstrap events; alert on unexpected privilege transitions.
- Audit insert failure, append-only violations, missing audit for admin mutation, unusual Super Admin activity.
- Pricing sync caller/result/failure and stale cache age.
- Storage read/write failure, attempted fallback, request duration, durable DB availability; alert if production path touches ephemeral local JSON.
- AI runtime/model load/inference errors, latency, memory, candidate model use, and `model_unavailable` / `needs_review` rate.
- Logs must redact Authorization and secret fields, keep minimal actor/org identifiers under approved privacy policy, avoid image/scan content, and have documented retention/access controls.

### Incident response minimum

1. Detect and classify; preserve sanitized request/correlation IDs and audit references, not secrets or images.
2. Contain by disabling affected management/sync path or provider access through approved controls; do not switch Production to Local Auth.
3. Escalate to named app, database, Auth, privacy and operator owners. Rotate/revoke leaked credentials only through approved secret management.
4. Recover through documented provider/database restore or forward fix; verify access isolation and audit continuity before reopening traffic.
5. Reconcile account/session/membership changes and notify affected users under approved policy.
6. Record timeline, impact, RPO/RTO, data integrity, corrective actions and approval.

**Operational readiness: NOT VERIFIED.**

## 9. Remaining critical/high release blockers

These are release-blocking unknowns, not claims that a particular remote environment is known to be compromised:

1. **High — deployed environment identity/configuration unknown.** No verification that Production/Preview use the correct project and Supabase Auth variables, or that deployed commit matches this worktree.
2. **High — live schema/RLS unknown.** Migration compatibility and direct PostgREST access policies are unverified against the actual schema, particularly the scans DDL/policies and existing data.
3. **High — account continuity/recovery unknown.** Local Auth and Supabase identity counts and user re-authentication plan are absent; switching provider may strand legacy users.
4. **High — restore/rollback evidence absent.** No database backup restore proof, RPO/RTO, or reviewed rollback execution plan.
5. **High — AI deployment readiness unknown.** Models are candidate; required runtime is not installed in this environment; function resource/runtime packaging and inference have not been proven.
6. **Medium/High — CORS/deployment perimeter needs confirmation.** Checked-in CORS allows broad Vercel subdomains; live origins and expected cross-site access policy are not validated.
7. **Medium — durability/observability unknown.** `/tmp` paths are ephemeral; actual durable storage configuration, fallback behavior, alerts and incident ownership are unverified.

## 10. Operator approval and evidence checklist

Do not check a box based solely on this repository audit. Record owner, date, environment/project identity (masked), evidence reference, and result.

- [ ] **Deployment owner:** approve environment matrix; verify app/backend build, Vercel Python runtime and deployed commit; verify variable presence/format/scope without exposing secrets.
- [ ] **Security owner:** approve CORS origins, service-role separation, log redaction, rate limits, browser session/storage risk, and Auth outage behavior.
- [ ] **Supabase/DBA owner:** provide approved read-only schema/RLS/grant inventory; review scan DDL and migration conflict/idempotency; approve isolated migration validation.
- [ ] **Identity/support owner:** count accounts per environment, resolve duplicates via verified identity, approve re-auth/password recovery/pending assignment, and define helpdesk workflow.
- [ ] **Backup owner:** identify backups/retention/encryption, complete isolated restore test, and approve RPO/RTO and rollback/recovery plan.
- [ ] **Staging owner:** provision separate staging project and explicitly authorized synthetic test identities/data; complete checklist and attach test evidence.
- [ ] **AI owner:** run compatible CPU/ONNX and/or approved runtime inference with exact artifacts; review candidate status, quality, class metadata, memory/latency and fallback semantics.
- [ ] **Operations owner:** define dashboards/alerts, on-call/escalation, incident runbook, audit retention, and recovery drill.
- [ ] **Release approver:** review all evidence and explicitly authorize any later staging/production migration or deployment in a separate request.

## 11. Integrity, changes, and external actions

- Expected target branch/HEAD verified: `feat/phase0-phase1-org-rbac` / `8359704b4669bd5c83334c5e68a4c9b8fa823f3c`.
- Target worktree already contained uncommitted Phase 0–5 changes; these remain preserved.
- Protected checksums verified before and after this assessment:
  - this worktree `server/data/scans.json`: **not present** (not created or accessed)
  - `/home/Rizi/.local/share/agri-sort-ai/protected-backups/scans.json.phase0-20261124-091229`: **not accessed in this PR #34 remediation**
  - target `docs/03-log-prompt.md`: `d009e64530061ea2f8d8928b953dc31ec033adfff168bf87004aca7ac011b0ef`
- Change made for Phase 6: updated `docs/14-production-readiness.md` with this assessment and operator checklist. No other file was changed by Phase 6.
- No external system action occurred: no Vercel/Supabase setting read or changed, no external schema inventory, no external migration, no account creation/migration, no backup/restore, no deployment, no commit/push. Each of those remains subject to explicit operator approval and suitable access.

## Final verdict

`NO-GO — PRODUCTION RISKS REMAIN`

Reassess only after operator evidence closes the deployment, schema/RLS, identity/recovery, restore, staging, monitoring, and AI runtime gates. Passing local tests or a disposable SQL harness does not override these blockers.
