# RBAC Migration Design Revision — Retain Audit History Across Account Deletion

**Status:** IMPLEMENTED LOCALLY; NOT APPLIED TO ANY REMOTE DATABASE. No production SQL was executed and no production database was contacted.
**Date:** 2026-11-24
**Worktree:** feature worktree
**Branch / HEAD:** `feat/phase0-phase1-org-rbac` / `83163756eb10e5e4c6528c45cc16aefad5b54ef6`
**Source under review:** `supabase/migrations/20261124000100_org_rbac.sql` — 587 lines, sha256 prefix `73cb9cbcf5ca349e`
**Operator decision:** ACCOUNT DELETION POLICY = RETAIN. An account must remain deletable even when it has historical audit events; the historical audit records must remain intact.
**D1 decision (2026-11-24):** OPTION D — EXPORT BEFORE DELETION. Offer an export of the user's private scans, verify it, then delete the account and its scans; no ownership transfer; no ownerless scans; audit rows remain independent and retained.

---

## 1. Executive summary and verdict

### Verdict: `DESIGN COMPLETE — NOT IMPLEMENTATION-READY`

The current draft cannot satisfy the RETAIN policy. Three schema facts and one workflow gap block it:

1. `audit_events.actor_user_id` has `ON DELETE RESTRICT` against `auth.users` (line 61), so deleting a user who has ever produced an audit row fails.
2. `platform_roles.user_id` also has `ON DELETE RESTRICT` (line 54), so deleting a Super Admin fails even if the audit FK were removed.
3. The bootstrap function requires an already-active operator profile (line 511), but the migration backfills every profile as `pending_assignment` (lines 81-84). On a fresh database the function cannot succeed.
4. The `scans.user_id` FK deletes rows but cannot offer an export, prove that one was delivered, or obtain consent to continue without it. Option D therefore needs an application workflow plus an atomic database deletion step; the FK is only a backstop.

The design below resolves the schema blockers and specifies the D1 export workflow without weakening append-only audit, owner-only scan access, or Super Admin separation. D2, D3, D4, and D7 are now resolved and implemented locally in the forward migration and account workflow; D1a-D1d remain production prerequisites. This document is a design record, not evidence that any remote database has been migrated.

### What changes

| Area | Current | Proposed |
|---|---|---|
| `audit_events.actor_user_id` FK | `ON DELETE RESTRICT` to `auth.users` | **FK removed**; UUID retained as a pseudonymous historical actor reference |
| `platform_roles.user_id` FK | `ON DELETE RESTRICT` | `ON DELETE CASCADE`, guarded by the existing last-Super-Admin trigger |
| `organization_memberships` | user `CASCADE`, org `RESTRICT` | unchanged FKs, plus a new last-active-org-admin trigger |
| `user_profiles` | `ON DELETE CASCADE` | unchanged |
| `organizations` | no FK to users | unchanged; never deleted as a side effect |
| Bootstrap | operator profile must be `active` | operator must be a real Auth user; one-time guard recorded in audit |
| `public.scans` | separate DDL, FK action UNKNOWN live | FK unchanged; **D1 decided: export, verify, then explicit delete inside the account-deletion transaction** |
| Account deletion | Auth-delete; scans follow the FK | **export offer → verified download or explicit waiver → re-auth → atomic DB deletion** (section 8) |

### What deliberately does not change

- `scans.user_id` remains the only ownership boundary; owner-only RLS is unchanged.
- Organization membership, org admin, and Super Admin never grant access to private scans.
- No `organization_id` is added to `scans`; no ownership transfer and no ownerless scans are permitted.
- Organization Admin and Super Admin never receive private scan contents, including during an export or a deletion review.
- Audit rows remain append-only: no UPDATE, no DELETE, no API write path.
- No personal data (name, email, phone, IP) is added to audit metadata.

---

## 2. Current schema facts versus assumptions

### 2.1 Verified source facts

All line numbers refer to `supabase/migrations/20261124000100_org_rbac.sql`.

| Fact | Evidence |
|---|---|
| Five tables are created: `organizations`, `user_profiles`, `organization_memberships`, `platform_roles`, `audit_events` | lines 18-71 |
| RLS is enabled on all five; there are exactly five policies, all `SELECT`, all `TO authenticated` | lines 243-271 |
| `anon` and `authenticated` have all table privileges revoked, then `SELECT` is granted to `authenticated` | lines 273-277 |
| `audit_events` has a row-level `BEFORE UPDATE OR DELETE` trigger that always raises | lines 72-79 |
| The only audit writer is `rbac_audit`, `SECURITY DEFINER`, revoked from `PUBLIC`, `anon`, `authenticated` | lines 231-241 |
| `audit_events.actor_user_id` is `NOT NULL` and references `auth.users` with `ON DELETE RESTRICT` | lines 59-62 |
| `audit_events.organization_id` is nullable and references `organizations` with `ON DELETE RESTRICT` | line 62 |
| `platform_roles.user_id` references `auth.users` with `ON DELETE RESTRICT` | line 54 |
| `organization_memberships.user_id` references `auth.users` with `ON DELETE CASCADE` | line 42 |
| `organization_memberships.organization_id` references `organizations` with `ON DELETE RESTRICT` | line 41 |
| `user_profiles.user_id` references `auth.users` with `ON DELETE CASCADE` | line 31 |
| `organizations` has no user/owner column; admin responsibility exists only through active memberships | lines 18-27 |
| Existing Auth users are backfilled to `pending_assignment` | lines 81-84 |
| Bootstrap requires `session_user in ('postgres','supabase_admin')`, a different target, target in `auth.users`, and an **active** operator profile | lines 505-519 |
| 27 functions exist; 24 are `SECURITY DEFINER`; all 27 pin `search_path` | grep count |
| 7 triggers exist, including `AFTER INSERT ON auth.users` | lines 78, 90-94, 105, 537, 555 |
| The migration has no `DROP`, no `TRUNCATE`, and no idempotency construct; a guard aborts if any target table already exists | lines 5-16, 587 |

### 2.2 Assumptions and unknowns

| Item | Status | Why it matters |
|---|---|---|
| Live `scans.user_id` FK action | **UNKNOWN** | Determines whether deleting an account deletes scan history. `storage_service.get_supabase_ddl()` only adds `RESTRICT` for a newly created FK; `test_migration_safety.py` asserts an existing `CASCADE` is preserved. No live `D`/`L` result exists. |
| Whether this migration was ever applied to any environment | **UNKNOWN** | Decides draft revision versus forward migration (section 9.1). Needs `K.1`/`K.2`. |
| `postgres` privilege to create a trigger on `auth.users` | **UNKNOWN** | The migration fails at line 105 if `TRIGGER` is not held. |
| Actual `session_user` in the Supabase SQL Editor | **UNKNOWN** | Bootstrap allowlist may not match the execution context. |
| Default privileges granting `service_role` on new `public` tables | **UNKNOWN** | Supabase commonly grants `ALL` to API roles; `REVOKE` only covers `anon`/`authenticated`. |
| Audit retention period and legal basis | **UNKNOWN** | Pseudonymous UUID retention still needs a documented basis. |
| Constraint names generated by PostgreSQL | High confidence, not observed | Assumed `audit_events_actor_user_id_fkey`, `platform_roles_user_id_fkey`; confirm with query `D` before implementation. |

---

## 3. Before / after relationship design

| Child table | Column | Before | After | Rationale |
|---|---|---|---|---|
| `user_profiles` | `user_id` | `auth.users(id) ON DELETE CASCADE` | unchanged | Profile has no meaning without the account. |
| `organization_memberships` | `user_id` | `auth.users(id) ON DELETE CASCADE` | unchanged | Deleted account must not retain memberships. |
| `organization_memberships` | `organization_id` | `organizations(id) ON DELETE RESTRICT` | unchanged | Deleting a user must never delete an organization. |
| `platform_roles` | `user_id` | `auth.users(id) ON DELETE RESTRICT` | **`ON DELETE CASCADE`** | Deleted account must not retain a platform role; the last-admin trigger still blocks deleting the last active Super Admin. |
| `audit_events` | `actor_user_id` | `auth.users(id) ON DELETE RESTRICT` | **no FK**, column kept `NOT NULL` | The audit row must outlive the account. `RESTRICT` blocks deletion; `SET NULL` is unusable (section 5.2). |
| `audit_events` | `organization_id` | `organizations(id) ON DELETE RESTRICT` | unchanged | Organization deletion is a separate policy; it is not triggered by account deletion. |
| `public.scans` | `user_id` | live action **UNKNOWN**; likely `CASCADE` | **unchanged**; rows are explicitly deleted inside the same transaction that deletes the account | D1 Option D; the FK remains only a backstop, never the workflow |

### Design invariants

1. `scans.user_id` remains the sole ownership boundary and `auth.uid() = user_id` policies remain mandatory.
2. Deleting an account must not require deleting audit rows, and must not be able to delete them.
3. Audit rows are never updated after insert, including by referential actions.
4. Deleting a user can never delete an organization.
5. The last active Super Admin and the last active admin of any organization are protected in the database, not only in application code.
6. Bootstrap remains a database-operator action, never an API action.

---

## 4. Account deletion lifecycle

Two paths exist. The **supported self-service path** is owned by the application and is the only path that satisfies D1. The **operator break-glass path** is a documented exception and must not be the normal route.

### 4.1 Supported self-service path (D1)

1. **Preflight.** Confirm the requester is authenticated as the target user (`auth.uid() = target`), count their scans under owner-only RLS, and run the readiness query in section 6.4. Block with a clear reason if the user is the last active Super Admin or the sole active admin of any organization; those responsibilities must be transferred first (D2, D3).
2. **Request export.** The user requests an export. The server creates an export job and an export record in the proposed `account_exports` table (section 9.8).
3. **Generate and verify.** The export worker reads scans with a **user-scoped** database session, so RLS `auth.uid() = user_id` is enforced, and builds the artifact described in section 8.3. The worker computes a SHA-256 for every file, writes the manifest, and records `scan_count` and `checksum` on the export record.
4. **Deliver.** The user receives a short-lived signed download link and downloads the artifact. The UI shows the scan count, file checksums, and a clear statement that the export is the user's only copy.
5. **Attest and confirm.** The user attests that the download succeeded, re-authenticates (password or fresh magic link), and types a confirmation phrase. If the export failed, the user must explicitly choose **Retry** or **Continue without export**; the latter requires a typed waiver phrase and writes `account.deletion_without_export`.
6. **Atomic database deletion.** The server calls `rbac_delete_account(target_user_id, export_id, allow_without_export)` (design in section 8.4). In one transaction the function verifies the export record, writes the `account.deleted` audit row, explicitly deletes the user's scan rows, and deletes the Auth user. Cascades remove the profile, memberships, and platform role.
7. **Post-commit cleanup.** Object-storage artifacts belonging to the user are deleted asynchronously (or queued), notification email is sent, and the export record is marked consumed. Cleanup failure never restores or partially deletes account data.
8. **Post-check.** Confirm zero rows remain in `scans`, `user_profiles`, `organization_memberships`, and `platform_roles` for the UUID; audit rows are present and unchanged apart from the new events; organizations still exist.

### 4.2 Operator break-glass path

Only for legal compulsion, abuse response, or a user who cannot authenticate. The operator must:

1. Attempt the export through the same service and record the artifact location and checksum, or record the documented reason an export is impossible.
2. Obtain and store the explicit waiver (or legal order reference).
3. Run the same atomic `rbac_delete_account` function or the reviewed SQL procedure; do not delete `auth.users` directly from the dashboard.
4. Record `account.deletion_override` with the operator as actor, target, reason code, and waiver reference.

A direct Supabase dashboard deletion bypasses the export offer and the export check. The dashboard path bypasses the application workflow; which credential it uses is **UNKNOWN**, but the effect is the same, so the runbook treats it as an override that must be justified and audited, never as the normal deletion path.

### 4.3 Failure points

| Failure | Effect | Recovery |
|---|---|---|
| Export generation fails | account and scans intact; export state `failed` | show Retry; after retries, explicit Continue without export or abort |
| Export checksum or count mismatch | deletion blocked | regenerate export; never accept a corrupt artifact |
| Download link expired | deletion blocked | issue a fresh link or regenerate while the account exists |
| User abandons before confirmation | nothing deleted | export record expires; user may restart |
| Target is the last active Super Admin | `platform_roles` delete fires the protection trigger, raises, whole transaction aborts | promote a successor, retry |
| Target is the only active admin of an organization | last-org-admin trigger raises, whole transaction aborts | assign a replacement admin, retry |
| Scan delete or audit insert fails | transaction aborts; account, scans, and audit unchanged | fix cause, retry; export artifact remains valid |
| Storage cleanup fails after commit | account and scans are gone; orphan objects may remain | reconcile job; no data restoration |
| Auth schema has a non-cascading dependency | transaction aborts with FK error | fix the dependency in a reviewed change; never delete rows ad hoc |
| Dashboard deletion used | export and audit ordering bypassed | treat as override; record justification and audit event |

---

## 5. Audit retention and privacy design

### 5.1 Options evaluated

| Option | Mechanism | Deletion works? | Append-only intact? | Privacy | Verdict |
|---|---|---|---|---|---|
| Keep `RESTRICT` | current design | **No** | yes | best | rejected: violates RETAIN |
| `ON DELETE SET NULL` | FK sets actor to NULL | **No in practice** | **No** | good | rejected: the referential action issues an UPDATE, which the `BEFORE UPDATE` append-only trigger rejects, so deletion still fails |
| Remove FK, keep UUID | no referential action | **Yes** | yes | pseudonymous | **recommended** |
| Remove FK + snapshot column | extra `actor_ref` copied at insert | yes | yes | no better than UUID | rejected: same identifier, and existing rows cannot be backfilled without disabling the append-only trigger |
| HMAC pseudonym | `HMAC(actor_uuid, key)` stored instead of UUID | yes | yes | stronger | optional future work; needs key management and breaks all existing actor lookups |

### 5.2 Why `SET NULL` is not sufficient

PostgreSQL implements `ON DELETE SET NULL` as a referential action that performs an `UPDATE` on the referencing row. `audit_events` has a row-level `BEFORE UPDATE OR DELETE` trigger that unconditionally raises (lines 72-79). The update is therefore rejected and the parent delete fails. Making it work would require weakening the trigger to permit actor nulling, which turns a bug into a deliberate mutation path on audit data. It is rejected.

### 5.3 Recommended design

- Drop the FK `audit_events_actor_user_id_fkey`; keep `actor_user_id uuid NOT NULL`.
- Do **not** add `ON DELETE` behavior: with no FK there is no referential action.
- Keep the append-only trigger unchanged.
- Keep all grants unchanged: no INSERT/UPDATE/DELETE to API roles; `rbac_audit` remains the only writer and remains revoked from API roles.
- Keep the existing RLS policy: only an active Super Admin may read audit rows.
- The actor UUID becomes a **pseudonymous historical identifier**. After the Auth user is deleted, the database no longer resolves it to a person; it is retained only as an opaque event attribute.

### 5.4 Privacy assessment

| Data in `audit_events` | Personal data? | Mitigation |
|---|---|---|
| `actor_user_id` UUID | pseudonymous identifier | no name/email is copied; retained under documented legitimate-interest/security basis |
| `organization_id`, `target_id` UUIDs | indirect | already minimal |
| `action`, `target_type` | no | fixed vocabulary |
| `metadata` | allowlisted only: role, status, previous_status, count, resource_type, slug, reason_code, changed_fields | `rbac_safe_audit_metadata` drops everything else; no contact fields |
| `created_at` | low | needed for ordering and audit validity |

Retention period is **UNKNOWN** and must be set by policy. A UUID is pseudonymous, not anonymous; if a stricter standard is later required, the migration path is a keyed HMAC with the key held outside the database (Vault), applied only to new rows. That is explicitly not part of this revision.

### 5.5 Integrity controls after FK removal

| Control | Status |
|---|---|
| `BEFORE UPDATE OR DELETE` row trigger | retained |
| No API write grants | retained |
| Single SECURITY DEFINER writer | retained |
| Super-Admin-only SELECT policy | retained |
| `TRUNCATE` protection | not provided by row triggers; only table owner/superuser can truncate. Optional defense-in-depth: `BEFORE TRUNCATE` statement trigger that raises. Decision D5. |
| Cross-check that actor existed | lost by design; the UUID is historical, not a live reference |

---

## 6. RBAC cleanup design

### 6.1 Per-table behavior

| Table | On account deletion | Residual risk | Design action |
|---|---|---|---|
| `user_profiles` | row deleted (`CASCADE`) | audit rows lose the profile join, intended | keep |
| `organization_memberships` | rows deleted (`CASCADE`) | an organization could be left with no admin | add last-active-org-admin trigger |
| `platform_roles` | row deleted (new `CASCADE`) | last Super Admin could disappear | existing trigger blocks when it is the last one |
| `organizations` | untouched | none from this path | no FK to users; no cascade path |
| `audit_events` | untouched | actor UUID no longer resolvable | intended; section 5 |

Deleting a user never deletes an organization: `organizations` has no FK to `auth.users`, and `organization_memberships.organization_id` points the other way. The only organization-side effect is removal of the user's membership rows.

### 6.2 Last organization admin guard

Add a `BEFORE UPDATE OR DELETE` row trigger on `organization_memberships`, active only when the old row is an active admin:

```sql
CREATE OR REPLACE FUNCTION public.rbac_protect_last_org_admin()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER
SET search_path = pg_catalog, public AS $$
BEGIN
    IF OLD.role = 'admin' AND OLD.status = 'active'
       AND NOT EXISTS (
           SELECT 1 FROM public.organization_memberships m
           WHERE m.organization_id = OLD.organization_id
             AND m.user_id <> OLD.user_id
             AND m.role = 'admin' AND m.status = 'active')
    THEN
        RAISE EXCEPTION 'organization must retain at least one active admin';
    END IF;
    IF TG_OP = 'DELETE' THEN RETURN OLD; END IF;
    RETURN NEW;
END;
$$;

CREATE TRIGGER organization_memberships_protect_last_admin
BEFORE UPDATE OR DELETE ON public.organization_memberships
FOR EACH ROW EXECUTE FUNCTION public.rbac_protect_last_org_admin();
```

Consequences:

- Deleting a sole org admin's account fails until a replacement is assigned. That is the required transfer workflow.
- `rbac_api_revoke_membership` and `rbac_api_change_membership` now raise instead of silently leaving the org adminless; the dashboard/API must surface the error.
- If an organization itself must be deleted, this trigger blocks removal of its last admin. Organization deletion has no RPC today and is blocked independently by `organization_memberships.organization_id RESTRICT` and `audit_events.organization_id RESTRICT`. That is a separate policy (D6), not part of account deletion.

### 6.3 Super Admin role removal

Changing `platform_roles_user_id_fkey` to `CASCADE` means account deletion removes the role automatically. The existing `platform_roles_protect_last_super_admin` trigger runs on the cascade delete and raises when no other active Super Admin exists, so the account deletion aborts atomically. This is the safe replacement workflow: promote a successor first.

Alternative retained for decision: keep `RESTRICT` and require the operator to delete the `platform_roles` row first. That makes the privilege change explicit but breaks a single-step account deletion and produces a raw FK error in the dashboard. Recommendation: `CASCADE` plus the trigger guard (D2).

### 6.4 Deletion readiness query (read-only, runbook)

```sql
SELECT
  (SELECT count(*) FROM public.platform_roles WHERE user_id = :uid) AS platform_roles,
  (SELECT count(*) FROM public.organization_memberships
    WHERE user_id = :uid AND status = 'active') AS active_memberships,
  (SELECT count(*) FROM public.organization_memberships m
    WHERE m.user_id = :uid AND m.status = 'active' AND m.role = 'admin'
      AND NOT EXISTS (
          SELECT 1 FROM public.organization_memberships o
          WHERE o.organization_id = m.organization_id
            AND o.user_id <> m.user_id
            AND o.status = 'active' AND o.role = 'admin')) AS sole_admin_orgs,
  (SELECT count(*) FROM public.audit_events WHERE actor_user_id = :uid) AS audit_events;
```

Any non-zero `sole_admin_orgs` or a non-zero `platform_roles` for the last Super Admin is a hard stop until a replacement exists.

---

## 7. Super Admin bootstrap design

### 7.1 Problem

Backfill writes every existing profile as `pending_assignment` (line 83). Bootstrap requires `status = 'active'` for the operator (line 511). No active profile exists at that point, so the documented one-time action cannot succeed. A manual `UPDATE user_profiles SET status='active'` would work but is an undocumented, unaudited privilege write; it is rejected as the primary mechanism.

### 7.2 Design

Keep the signature `rbac_bootstrap_super_admin(operator_actor_id uuid, target_user_id uuid)`, replace the body:

```sql
CREATE OR REPLACE FUNCTION public.rbac_bootstrap_super_admin(
    operator_actor_id uuid, target_user_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER
SET search_path = pg_catalog, public AS $$
BEGIN
    IF session_user NOT IN ('postgres', 'supabase_admin') THEN
        RAISE EXCEPTION 'operator database role required';
    END IF;
    IF operator_actor_id = target_user_id THEN
        RAISE EXCEPTION 'bootstrap actor cannot promote self';
    END IF;
    IF NOT EXISTS (SELECT 1 FROM auth.users WHERE id = operator_actor_id) THEN
        RAISE EXCEPTION 'operator Auth user not found';
    END IF;
    IF NOT EXISTS (SELECT 1 FROM auth.users WHERE id = target_user_id) THEN
        RAISE EXCEPTION 'target Auth user not found';
    END IF;
    IF EXISTS (SELECT 1 FROM public.platform_roles WHERE user_id = target_user_id) THEN
        RAISE EXCEPTION 'target already holds a platform role';
    END IF;
    PERFORM pg_advisory_xact_lock(hashtext('agri_sort_bootstrap'));
    IF EXISTS (SELECT 1 FROM public.audit_events
               WHERE action = 'super_admin.bootstrap') THEN
        RAISE EXCEPTION 'bootstrap already completed';
    END IF;
    INSERT INTO public.user_profiles(user_id, full_name, status)
    VALUES (target_user_id, '', 'active')
    ON CONFLICT (user_id) DO UPDATE SET status = 'active';
    INSERT INTO public.platform_roles(user_id, role)
    VALUES (target_user_id, 'super_admin');
    PERFORM public.rbac_audit(operator_actor_id, NULL,
        'super_admin.bootstrap', 'user', target_user_id::text,
        jsonb_build_object('role', 'super_admin', 'resource_type', 'user'));
END;
$$;
```

### 7.3 Preconditions and properties

| Property | Mechanism |
|---|---|
| Authorized database operator | `session_user` allowlist; `SET ROLE` does not change `session_user`, so an API role cannot pass it |
| Separate identities | `operator_actor_id <> target_user_id` |
| Real identities | both must exist in `auth.users` |
| No silent re-promotion | target must not already hold a platform role |
| One-time execution | existence of a `super_admin.bootstrap` audit event; audit is append-only, so the guard is durable |
| Concurrency | transaction-scoped advisory lock before the guard read |
| Atomicity | all writes in the caller transaction; any `RAISE` rolls back everything |
| No API escalation | function remains revoked from `PUBLIC`, `anon`, `authenticated` |
| Audit evidence | one `super_admin.bootstrap` row with the operator as actor and the target as target |

`session_user` is the authenticating role, not `current_user`, so SECURITY DEFINER does not let an API caller impersonate the operator. A role that can `SET ROLE postgres` still keeps its own `session_user` and fails the check.

### 7.4 Why the operator no longer needs an active profile

The operator is already trusted with database-operator credentials; requiring an active RBAC profile adds no security, only a circular dependency. The audit row records the operator UUID, and because the audit FK is removed, deleting the operator later does not damage the trail. The target is explicitly activated as part of bootstrap.

### 7.5 Failure and retry

| Case | Result |
|---|---|
| Precondition fails | exception; no rows written; fix and retry |
| Transaction aborted mid-way | full rollback; retry is safe |
| Bootstrap already recorded | exception; no second Super Admin is created |
| First bootstrap target later deleted | guard still blocks; recovery needs the break-glass decision D4 |
| Concurrent calls | advisory lock serializes; second sees the audit event and fails |

Break-glass recovery (if the only Super Admin is ever lost outside the protected path) must be a separate, explicitly approved operator procedure. It is not shipped as a callable function in this design.

---

## 8. Scan export and deletion boundary

### 8.0 Decision

**D1 is DECIDED: OPTION D — EXPORT BEFORE DELETION (2026-11-24).**

An authenticated user must be offered an export of their private scan history before account deletion. After the workflow completes, the user's scans are deleted. No scan ownership is transferred. No scan is left ownerless. Audit events survive independently of the scan deletion. A failed export never causes a silent deletion: the user must explicitly retry or explicitly continue without an export.

The FK is **not** the workflow. It only removes rows once the account is deleted; it cannot offer, assemble, checksum, authorize, or attest an export. Section 8.4 therefore deletes scans explicitly inside the same transaction that deletes the account, and the FK remains a backstop.

### 8.1 Existing behavior (facts, unchanged)

| Fact | Evidence |
|---|---|
| `public.scans` is created by application DDL, not by a versioned migration | `storage_service.get_supabase_ddl()` |
| The app DDL adds `ON DELETE RESTRICT` only when it creates a new FK | source-reviewed |
| An existing FK is left untouched, and a test asserts an existing `CASCADE` is preserved | `test_migration_safety.py` |
| Live FK action | **UNKNOWN**; requires `D` / `L` / `L.2` |
| `scans.user_id` is nullable in the operator export | CSV C: `not_null = false` |
| `scans.user_id` is the only ownership boundary; RLS is owner-only | migration comments and policy matrix |
| There is no scan export endpoint today | source-reviewed |

### 8.2 Decision model

- **Offer:** every supported deletion flow starts with an export offer.
- **Requirement:** deletion proceeds only when a verified export exists, or when the user has explicitly waived the export after a failure.
- **No silent proceed:** an export error pauses the flow. The user chooses Retry or Continue without export; the waiver is typed and audited.
- **Deletion:** scans are deleted by explicit `DELETE ... WHERE user_id = target` in the account-deletion transaction, not by relying on the FK.
- **No transfer:** `scans.user_id` is never rewritten. No successor, organization, or administrator receives ownership.
- **No ownerless scans:** the workflow never sets `user_id` to `NULL`. If the live FK is `SET NULL`, the explicit delete still removes the rows first.
- **Audit independence:** `audit_events` rows are never part of scan deletion and are never removed by account deletion.

### 8.3 Export contract

#### Artifact format

A ZIP named `agri-sort-scan-export-<export_id>.zip` containing:

| File | Contents |
|---|---|
| `manifest.json` | `export_id`, `schema_version = "scan-export-v1"`, `created_at`, `user_id`, `scan_count`, `files[]` with relative path, byte size, and SHA-256, plus an HMAC-SHA256 `signature` over the canonical manifest |
| `scans.json` | JSON array; one object per `public.scans` row owned by the user; all columns present at export time; timestamps in ISO 8601 UTC |
| `scans.csv` | The same rows and columns, UTF-8, one header row, RFC 4180 quoting |
| `attachments/` | Only if a scan row references an object in storage; each object is included and listed in the manifest. A missing referenced object fails the export instead of producing an incomplete artifact. |
| `README.txt` | Schema version, row count, checksums, and support contact; no secrets |

The export is complete or it is not published. A partial ZIP is never marked ready.

#### Authorization

| Rule | Design |
|---|---|
| Requester identity | Derived from the verified JWT; never accepted from a request body or query parameter |
| Read path | User-scoped database session so RLS `auth.uid() = user_id` is enforced; the export worker never reads scan contents with `service_role` |
| Export record | Owner-only SELECT; writes only through the export service |
| Download | Signed URL bound to `export_id` and the requesting user; expiry and single-account scope enforced server-side |
| Administrators | Organization Admin and Super Admin have no export endpoint and no download path; audit access never includes scan contents |
| Rate limit | Proposed 3 exports per user per hour and 1 active export at a time; exact limits **UNKNOWN** pending product input |

#### Integrity

- SHA-256 per file and `scan_count` in the manifest; the server stores the same values on the export record.
- HMAC-SHA256 over the manifest with a server key held outside the database (Vault or equivalent); a modified manifest fails verification.
- The download page shows row count and checksums so the user can verify the artifact.
- Deletion verifies the stored export record against the artifact metadata before it deletes anything.
- Audit events `account.export_created` and `account.export_failed` record `export_id`, `scan_count`, and checksum, never scan contents.

#### Expiration

| Item | Proposed lifetime |
|---|---|
| Signed download URL | 15 minutes, renewable while the artifact exists |
| Export artifact in storage | 24 hours, then deleted |
| Export record (metadata only) | 30 days for audit and support |
| Deletion eligibility | Export must be unexpired and verified at deletion time; otherwise the user must re-export |

The 15-minute and 24-hour values are design proposals; the final values are **UNKNOWN** pending infrastructure review.

#### Retry behavior

1. Generation is attempted up to 3 times with backoff.
2. On persistent failure the export state becomes `failed`; the account is untouched.
3. The UI offers **Retry export** and **Continue without export**. Continue requires the typed phrase `DELETE WITHOUT EXPORT`, a reason code, and an explicit acknowledgement that scan history will be unrecoverable.
4. The waiver writes `account.deletion_without_export` and is passed to the deletion function.
5. A failed or expired export can never be treated as a successful one.

#### Deletion confirmation

- Re-authentication no older than 10 minutes.
- Display of scan count, export checksum, and the irreversible warning.
- Checkbox: "I have downloaded and verified my export" (or the explicit waiver path).
- Typed phrase: `DELETE MY ACCOUNT`.
- CSRF protection, rate limiting, and a server-side check that the session still belongs to the target.

### 8.4 Safe ordering and atomic deletion

The database phase must be all-or-nothing. A proposed `SECURITY DEFINER` function:

```sql
-- Design only; not created by this task.
rbac_delete_account(target_user_id uuid, export_id uuid, allow_without_export boolean)
RETURNS void
```

Properties:

| Step | Action | Why this order |
|---|---|---|
| 1 | Verify target exists and the caller is authorized (`service_role` only; revoked from `PUBLIC`, `anon`, `authenticated`) | prevents a user from deleting another account |
| 2 | Lock the target with `pg_advisory_xact_lock(hashtext(target_user_id::text))` | serializes concurrent deletion attempts |
| 3 | Verify the export record: same user, state `ready`/`downloaded`, unexpired, checksum present; or `allow_without_export` with a recorded waiver | no deletion without the export decision |
| 4 | Insert `account.deleted` audit row with actor = target, `export_id`, `scan_count`, `export_verified` | audit is inside the transaction; failure aborts everything |
| 5 | `DELETE FROM public.scans WHERE user_id = target_user_id;` | deterministic regardless of the live FK action; satisfies `RESTRICT`, prevents `SET NULL` orphans |
| 6 | `DELETE FROM auth.users WHERE id = target_user_id;` | cascades profile, memberships, platform role; last-admin triggers still apply |
| 7 | Assert one Auth row was deleted; otherwise raise | prevents a silent no-op |

All steps run in the caller's transaction; the function never commits on its own. If step 6 is blocked by the last-Super-Admin or last-org-admin trigger, the transaction rolls back the scan delete and the audit insert, leaving the account and scans intact. If the audit insert fails, nothing is deleted.

The alternative, calling the Auth Admin API first and writing audit afterwards, is rejected for the supported path: it can delete the account while the audit write fails, producing an inconsistent trail. The operator break-glass path may use the Auth API only with a recorded override.

### 8.5 Does `ON DELETE CASCADE` implement the workflow?

No. Evaluation of each possible live action:

| Live action | If the FK were relied on alone | With explicit delete in the same transaction |
|---|---|---|
| `CASCADE` | scans disappear with the account, but only after deletion; no export, no verification, no consent | explicit delete removes them first; cascade is a no-op; outcome deterministic |
| `RESTRICT` / `NO ACTION` | deletion fails until scans are removed, and any manual removal can be partial | explicit delete satisfies the FK; account deletion then succeeds |
| `SET NULL` | scans become ownerless and invisible under owner-only RLS | explicit delete prevents ownerless rows; FK never fires |

Conclusion: the workflow is independent of the FK action, so the RBAC migration does not need to change `public.scans`. The live action must still be verified for evidence and for the regression test, but it is no longer a blocker for D1. The only hard requirement is that scan rows are deleted in the same transaction as the account.

### 8.6 Owner-only access preserved

- Export queries are owner-scoped and RLS-enforced.
- No organization role, org admin, or Super Admin can request or download another user's export.
- Audit rows expose identifiers and counts, never scan contents.
- No ownership transfer, no shared export links, no admin "view scans" feature is introduced.

### 8.7 Audit independence

- `account.export_created`, `account.export_failed`, `account.deletion_without_export`, and `account.deleted` use the existing `audit_events` writer.
- The actor UUID survives because the audit FK is removed (section 5).
- Metadata contains `export_id`, `scan_count`, `export_verified`, and a reason code; it never contains scan rows, image bytes, or storage URLs with credentials.
- Deleting scans or the account does not touch prior audit rows.

### 8.8 Explicit non-goals

- No scan ownership transfer.
- No organization or administrator access to private scan contents.
- No `organization_id` on `scans`.
- No change to scan RLS policies or grants.
- No storage-object ownership change.
- No promise that an export survives on the user's own device; the service cannot control copies the user downloads.

### 8.9 Unresolved D1 implementation details (UNKNOWN)

| Detail | Status |
|---|---|
| Actual `public.scans` columns and whether rows reference stored objects | **UNKNOWN**; needs live schema inspection |
| Export size limit and whether multi-part archives are required | **UNKNOWN** |
| Artifact encryption at rest and key management for the HMAC key | design recommends SSE plus Vault; provider details **UNKNOWN** |
| Where the export record lives (`account_exports` table vs job store) and which migration carries it | **RESOLVED**: `public.account_exports`, carried by the forward migration `20261124000200_org_rbac_retention.sql` |
| Whether the deletion function or a backend service performs the Auth delete | **RESOLVED**: transactional `public.rbac_delete_account` performs the Auth delete; the backend service never deletes `auth.users` directly |
| Auth-schema dependencies that could block `DELETE FROM auth.users` | **UNKNOWN**; verify on staging |
| Child tables referencing `public.scans` and their FK actions | **UNKNOWN**; deletion must fail closed rather than orphan children |
| `rbac_audit` EXECUTE for `service_role` after the PUBLIC revoke | **RESOLVED locally**: definer-owned workflow functions call it; `service_role` has no direct EXECUTE and integration tests exercise the workflow path |
| Final URL/artifact/record lifetimes and rate limits | **UNKNOWN**; proposals in section 8.3 |
| Notification provider and template | **UNKNOWN** |
| Legal retention of export metadata after account deletion | **UNKNOWN**; governance (D8) |

---

## 9. Migration implementation plan

### 9.1 Revise the draft or add a forward migration?

| Condition | Path |
|---|---|
| Migration never applied anywhere (expected; history **UNKNOWN**) | revise `20261124000100_org_rbac.sql` before its first apply |
| Applied in any environment | add a new forward migration; never edit an applied migration |

Confirm with `K.1` and `K.2` before choosing. Until then, implementation is blocked on D7.

### 9.2 Required DDL changes (design only, not executed)

```sql
-- 1. Audit retention: remove the blocking FK, keep the column.
ALTER TABLE public.audit_events
    DROP CONSTRAINT audit_events_actor_user_id_fkey;

-- 2. Platform role cleanup on account deletion.
ALTER TABLE public.platform_roles
    DROP CONSTRAINT platform_roles_user_id_fkey,
    ADD CONSTRAINT platform_roles_user_id_fkey
        FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;

-- 3. Last-org-admin protection (section 6.2).
-- 4. Replace rbac_bootstrap_super_admin body (section 7.2).
-- 5. D1 workflow objects: account_exports + rbac_delete_account (section 9.8).
--    public.scans DDL is deliberately not changed.
```

Constraint names are PostgreSQL defaults and must be confirmed with query `D` first. On the forward-migration path use `DROP CONSTRAINT IF EXISTS`; on the draft-revision path the names are created in the same transaction, so plain `DROP` is acceptable.

Optional, decision-dependent: `BEFORE TRUNCATE` audit trigger (D5); deletion preflight function instead of the runbook query (D6).

### 9.3 Data migration and backfill

- **None required** for the FK changes.
- No audit row is rewritten; the append-only trigger would reject it.
- Do not add a required `actor_ref` column: existing rows could not be backfilled without disabling the trigger, and a nullable column with no backfill adds no value.
- `platform_roles` already contains only valid `auth.users` IDs, so the new `CASCADE` FK validates without repair.

### 9.4 Transaction and lock implications

| Statement | Lock | Practical effect |
|---|---|---|
| `DROP CONSTRAINT` on audit FK | `ACCESS EXCLUSIVE` on `audit_events`; brief lock on `auth.users` | short; blocks audit reads/writes for the duration |
| `DROP`/`ADD` platform FK | `ACCESS EXCLUSIVE` on `platform_roles`; `SHARE ROW EXCLUSIVE` on `auth.users` | **blocks signups** while held |
| `CREATE TRIGGER` on `auth.users` | `SHARE ROW EXCLUSIVE` on `auth.users` | **blocks signups** for the transaction |
| Backfill `INSERT ... SELECT` from `auth.users` | `ACCESS SHARE` on `auth.users`, `ROW EXCLUSIVE` on `user_profiles` | long scan on large Auth tables; holds locks until commit |
| RLS/grants/policies | table locks on the five new tables | new objects, negligible |

Recommendation: one maintenance window; measure on staging; consider splitting the `auth.users` trigger and the backfill into a second migration so the signup lock is short and independently retryable.

### 9.5 Idempotency and retry

- The draft remains intentionally single-shot: the guard aborts if any target table exists.
- A failed apply rolls back completely (DDL is transactional), so retry after fixing the cause is safe.
- Do not add blanket `IF NOT EXISTS`: it would mask a partially reconciled schema.
- On the forward-migration path, guard each `ALTER` with an existence check and keep the same fail-closed behavior.

### 9.6 Rollback and PITR

- There is no down migration. Rollback is PITR or a reviewed manual drop of the five tables, 27 functions, and 7 triggers.
- The audit FK removal is effectively **forward-only**: once orphan actor UUIDs exist, restoring `RESTRICT` would fail, and deleting those audit rows is forbidden by append-only.
- Restoring from PITR also rolls back the bootstrap audit event, which makes bootstrap possible again; that is expected after a restore and must be re-run deliberately.

### 9.7 Supabase-specific assumptions

| Assumption | Verify with |
|---|---|
| `postgres` can `CREATE` in `public` | `has_schema_privilege` preflight |
| `postgres` holds `TRIGGER`, `REFERENCES`, `SELECT` on `auth.users` | `has_table_privilege` preflight |
| `session_user` is `postgres` or `supabase_admin` in the chosen execution path | `SELECT session_user` |
| Roles `anon`, `authenticated`, `service_role` exist | `pg_roles` |
| Default privileges do not leave `service_role` with unintended writes | `pg_default_acl` + query `H` |
| Migration history strategy is decided | `K.1` / `K.2` |
| PostgREST schema cache is reloaded after DDL | API smoke test |

### 9.8 D1 workflow objects and rollout

No change is made to `public.scans`: same columns, RLS policies, grants, and FK action. The workflow adds application/DB objects in a future migration (placement per D7):

| Object | Purpose | Key design constraints |
|---|---|---|
| `account_exports` | Export job and verification record | `id`, `user_id` (UUID, no FK so metadata can outlive the account), `state`, `scan_count`, `sha256`, `storage_path`, `created_at`, `expires_at`, `downloaded_at`, `failure_reason`; RLS owner-only SELECT; writes only by the export service |
| `rbac_delete_account(uuid, uuid, boolean)` | Atomic audit + scan delete + Auth delete | `SECURITY DEFINER`, pinned `search_path`, revoked from `PUBLIC`/`anon`/`authenticated`, execute granted only to `service_role` (verify default grants); no autonomous transaction |
| Storage bucket policy | Export artifact access | Private bucket; signed URL only; object key contains `export_id`, never an email or name |

Dependency: the audit FK removal (section 9.2) must be applied before the deletion function is used. Otherwise the `account.deleted` insert succeeds but the subsequent Auth delete is blocked by the audit `RESTRICT` FK, and the transaction rolls back. The export-record table must not carry a cascading FK to `auth.users`, or the verification record disappears at the moment it is needed.

Rollout order: export service and storage first, deletion function second, UI last. Until the UI ships, the operator runbook remains the only deletion path and must record the waiver. A feature flag can disable self-service deletion without changing the database or the FK.

Rollback: disabling the workflow or dropping the new objects does not affect the RBAC migration or `public.scans`. Accounts already deleted are not restored by a code rollback; only PITR can restore them.

---

## 10. Failure and rollback scenarios

| # | Scenario | Detection | Behavior | Recovery |
|---|---|---|---|---|
| 1 | Any of the five tables already exists | guard exception | apply aborts, no change | inspect and reconcile; never force |
| 2 | `auth.users` trigger permission denied | exception at trigger creation | full rollback | grant/execute as a role that owns the table; do not skip the trigger silently |
| 3 | Backfill exceeds statement timeout | timeout | full rollback | retry in a window; consider staged backfill |
| 4 | Lock wait on signups | monitoring | signups queue during apply | schedule window; split trigger |
| 5 | Bootstrap run before migration commit | function missing | no change | run after commit |
| 6 | Bootstrap called twice | guard exception | no second role | none needed |
| 7 | API role calls bootstrap | permission denied | no change | expected |
| 8 | Delete last Super Admin | trigger exception | account intact | promote successor |
| 9 | Delete sole org admin | trigger exception | account intact | assign replacement |
| 10 | Export generation fails | job state `failed` | account and scans intact; deletion paused | Retry, or explicit Continue without export with typed waiver |
| 11 | Export expired or checksum mismatch | verification failure | deletion blocked | issue a fresh export; never accept the stale artifact |
| 12 | Audit row update attempted | trigger exception | no change | expected |
| 13 | Audit TRUNCATE by owner | no row trigger | data lost | restrict owner access; optional D5 |
| 14 | PITR restore | operator action | migration effects reverted | reapply and re-bootstrap deliberately |
| 15 | Deletion function called without a verified export | guard exception | no change | expected; use the export workflow |
| 16 | Waiver requested without typed phrase or reason | validation error | no change | require both; record the audit event |
| 17 | Scan delete succeeds but Auth delete fails | transaction abort | scans and audit insert rolled back; account intact | fix cause, retry |
| 18 | Storage cleanup fails after commit | cleanup job error | account and scans gone; orphan objects | reconcile; do not restore account |
| 19 | Two concurrent deletion attempts | advisory lock | one succeeds; the other fails cleanly | no double audit; verify |
| 20 | Dashboard direct deletion | override path | export offer bypassed | record justification and `account.deletion_override`; review in runbook |

---

## 11. Test matrix and acceptance criteria

### 11.1 Test matrix (disposable PostgreSQL and Supabase-compatible staging; synthetic data only)

| # | Case | Expected |
|---|---|---|
| 1 | Apply migration once on clean DB with Auth shim | success; 5 tables, 5 policies, 27 functions, 7 triggers |
| 2 | Apply second time | guard exception; catalog counts unchanged |
| 3 | Delete user with audit events (FK removed) | user deleted; audit rows intact; actor UUID unchanged |
| 4 | Delete user who is the only Super Admin | blocked by protection trigger; user and rows intact |
| 5 | Delete one of two Super Admins | success; role removed by cascade; audit intact |
| 6 | Delete sole org admin | blocked by last-org-admin trigger |
| 7 | Assign replacement admin, then delete | success; org still has an admin |
| 8 | Delete normal member | profile and membership removed; org untouched |
| 9 | Export then delete user with scans | ZIP verifies; account, scans, profile, memberships, and role removed; audit rows intact |
| 10 | `UPDATE`/`DELETE` audit row as table owner | trigger raises |
| 11 | `anon` SELECT audit | denied |
| 12 | `authenticated` non-Super-Admin SELECT audit | zero rows |
| 13 | Bootstrap with fresh pending profiles | success; target active Super Admin; audit row written |
| 14 | Bootstrap second time | exception |
| 15 | Bootstrap self | exception |
| 16 | Bootstrap from API role | permission denied |
| 17 | Failed migration transaction | no objects remain |
| 18 | Post-apply scans regression | same columns, policies, grants, FK action as baseline |
| 19 | Export requested by another user, org admin, or Super Admin | denied; archive contains zero foreign rows |
| 20 | Manifest or file checksum tampered | signature/checksum verification fails; deletion blocked |
| 21 | Export fails, user chooses Retry | new export succeeds; no deletion before verification |
| 22 | Export fails, user chooses Continue without export | typed waiver required; `account.deletion_without_export` written; deletion proceeds |
| 23 | Deletion function called without verified export | exception; account, scans, and audit unchanged |
| 24 | Deletion blocked by last-admin or last-org-admin trigger | transaction rolls back; scans remain; export still valid |
| 25 | Concurrent deletion attempts | one succeeds, one clean failure; exactly one `account.deleted` |
| 26 | Any deletion path | zero ownerless scans remain; no `scans.user_id` value is transferred |
| 27 | Audit after deletion | export and deletion events retained; actor UUID present; no scan contents in metadata |
| 28 | Operator dashboard deletion | override recorded and reviewed; export attempt documented |

### 11.2 Acceptance criteria

- [ ] `audit_events` has no FK to `auth.users`; the column remains `NOT NULL`.
- [ ] Append-only trigger still rejects UPDATE and DELETE.
- [ ] Deleting a user with audit history succeeds and leaves every audit row byte-identical.
- [ ] Deleting the last Super Admin fails closed.
- [ ] Deleting a sole org admin fails closed.
- [ ] Deleting a user never deletes an organization.
- [ ] Bootstrap succeeds on a fresh database without any manual profile UPDATE, exactly once.
- [ ] No API role can execute bootstrap or write audit directly.
- [ ] `public.scans` schema, policies, grants, and FK action are unchanged by this migration.
- [ ] An export is offered before every supported deletion, and an artifact verifies by count and SHA-256.
- [ ] A failed export pauses deletion; only an explicit typed waiver allows continuation.
- [ ] Deletion is atomic: audit insert, scan delete, and Auth delete succeed or all roll back.
- [ ] No scan ownership is transferred and no ownerless scan remains after any deletion path.
- [ ] Organization Admin and Super Admin cannot request or download another user's export.
- [ ] Export and deletion audit events survive the account and contain no scan contents.
- [ ] Rollback/PITR procedure is documented and rehearsed.

---

## 12. Remaining operator decisions and blockers

| ID | Decision | Recommendation | Blocks implementation? |
|---|---|---|---|
| D1 | Scan retention on account deletion | **DECIDED 2026-11-24: Option D — export before deletion** (section 8) | Resolved |
| D1a | Export artifact storage, encryption, HMAC key custody, URL/artifact lifetimes, rate limits | private bucket + SSE + Vault-held HMAC key; 15 min URL / 24 h artifact; confirm limits | No (design), **Yes** before production |
| D1b | Deletion mechanism: transactional `rbac_delete_account` vs Auth Admin API | transactional function for the supported path; Auth API only as audited break-glass | No (design), **Yes** before production |
| D1c | Auth-schema cascade behavior and `rbac_audit` EXECUTE for the deletion role | verify on staging; grant narrowly; fail closed | No (design), **Yes** before production |
| D1d | Scan child tables and stored attachments included in export/deletion | inspect live schema; include attachments or fail; delete children explicitly if needed | No (design), **Yes** before production |

Current local implementation: deletion requires a fresh password proof through the selected Auth provider. A fresh magic-link path and a deletion flow for Google-only accounts without a password are **not implemented** and remain a production blocker. The backend never treats an existing session as sufficient re-authentication.
| D2 | `platform_roles` cleanup: `CASCADE` vs manual `RESTRICT` removal | `CASCADE` + last-admin trigger | **Yes** |
| D3 | Add last-org-admin trigger | yes; it is the only database-level transfer enforcement | **Yes** |
| D4 | Bootstrap recovery after loss of the only Super Admin | strict one-time plus a separate approved break-glass runbook | **Yes** |
| D5 | Optional `BEFORE TRUNCATE` audit guard | add as defense-in-depth | No |
| D6 | Organization deletion policy when audit/memberships exist | keep blocked; define a separate reviewed procedure | No (separate) |
| D7 | Revise draft vs forward migration | depends on `K.1`/`K.2` history | **Yes** |
| D8 | Audit retention period and legal basis | document before production use | No (governance) |
| D9 | `service_role` default grants on new tables | verify with `H`; revoke if not needed | No |

### Readiness statement

D1 is decided and no longer blocks the design. **D2, D3, and D4 are resolved** by the local forward migration: guarded cascade cleanup, last-organization-admin protections, strict one-time bootstrap, and operator-only recovery. **D7 is resolved** by keeping the base migration immutable and adding `20261124000200_org_rbac_retention.sql` as the forward upgrade path for fresh and already-migrated environments. The account export/deletion workflow is implemented locally with tests. D1a-D1d remain infrastructure/verification details that must be closed before production. No SQL in this document has been executed against a remote database.
