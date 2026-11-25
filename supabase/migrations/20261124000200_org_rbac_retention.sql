-- RBAC retention hardening and export-before-deletion workflow.
-- D7: the base migration is treated as immutable input; this forward migration
-- upgrades every environment that applied it and also works on a fresh apply.
-- No remote database is contacted by this file; it is applied by the migration runner.
BEGIN;

DO $$
BEGIN
    IF to_regclass('public.organizations') IS NULL
       OR to_regclass('public.user_profiles') IS NULL
       OR to_regclass('public.organization_memberships') IS NULL
       OR to_regclass('public.platform_roles') IS NULL
       OR to_regclass('public.audit_events') IS NULL THEN
        RAISE EXCEPTION 'RBAC forward migration stopped: base RBAC objects are missing';
    END IF;
    IF to_regprocedure('public.rbac_bootstrap_super_admin(uuid,uuid)') IS NULL THEN
        RAISE EXCEPTION 'RBAC forward migration stopped: base bootstrap function is missing';
    END IF;
    IF to_regclass('public.account_exports') IS NOT NULL THEN
        RAISE EXCEPTION 'RBAC forward migration stopped: public.account_exports already exists';
    END IF;
END;
$$;

-- 1. Audit retention: the actor UUID must outlive the account.
-- The append-only trigger still rejects every UPDATE and DELETE.
ALTER TABLE public.audit_events
    DROP CONSTRAINT IF EXISTS audit_events_actor_user_id_fkey;

-- 2. Platform role cleanup on account deletion. The existing last-Super-Admin
-- trigger runs on the cascade delete and still fails closed for the last one.
ALTER TABLE public.platform_roles
    DROP CONSTRAINT IF EXISTS platform_roles_user_id_fkey;
ALTER TABLE public.platform_roles
    ADD CONSTRAINT platform_roles_user_id_fkey
    FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;

-- 3. Extend the audit metadata allowlist for the D1 workflow. Only identifiers,
-- counts, digests, booleans, and reason codes are retained; no scan contents.
CREATE OR REPLACE FUNCTION public.rbac_safe_audit_metadata(input_value jsonb)
RETURNS jsonb LANGUAGE plpgsql IMMUTABLE SET search_path = pg_catalog AS $$
DECLARE output_value jsonb := '{}'::jsonb;
DECLARE role_value text;
DECLARE status_value text;
DECLARE reason_value text;
DECLARE item jsonb;
BEGIN
    IF jsonb_typeof(input_value) <> 'object' THEN RETURN output_value; END IF;
    IF input_value ? 'role' THEN
        role_value := input_value->>'role';
        IF role_value IN ('admin', 'farmer', 'merchant', 'super_admin') THEN
            output_value := output_value || jsonb_build_object('role', role_value);
        END IF;
    END IF;
    IF input_value ? 'status' THEN
        status_value := input_value->>'status';
        IF status_value IN ('active', 'suspended', 'revoked', 'pending', 'pending_assignment') THEN
            output_value := output_value || jsonb_build_object('status', status_value);
        END IF;
    END IF;
    IF input_value ? 'previous_status' THEN
        status_value := input_value->>'previous_status';
        IF status_value IN ('active', 'suspended', 'revoked', 'pending', 'pending_assignment') THEN
            output_value := output_value || jsonb_build_object('previous_status', status_value);
        END IF;
    END IF;
    IF jsonb_typeof(input_value->'count') = 'number' THEN
        output_value := output_value || jsonb_build_object('count', input_value->'count');
    END IF;
    IF jsonb_typeof(input_value->'resource_type') = 'string'
       AND input_value->>'resource_type' IN ('organization', 'user', 'membership', 'account_export') THEN
        output_value := output_value || jsonb_build_object('resource_type', input_value->>'resource_type');
    END IF;
    IF jsonb_typeof(input_value->'slug') = 'string'
       AND (input_value->>'slug') ~ '^[a-z0-9]+(-[a-z0-9]+)*$' THEN
        output_value := output_value || jsonb_build_object('slug', input_value->>'slug');
    END IF;
    IF jsonb_typeof(input_value->'reason_code') = 'string' THEN
        reason_value := input_value->>'reason_code';
        IF length(reason_value) <= 40 AND reason_value ~ '^[a-zA-Z0-9_-]+$' THEN
            output_value := output_value || jsonb_build_object('reason_code', reason_value);
        END IF;
    END IF;
    IF jsonb_typeof(input_value->'changed_fields') = 'array' THEN
        SELECT COALESCE(jsonb_agg(to_jsonb(field_name)), '[]'::jsonb) INTO item
        FROM jsonb_array_elements_text(input_value->'changed_fields') AS f(field_name)
        WHERE field_name IN ('name', 'slug', 'region', 'kabupaten', 'role', 'status');
        output_value := output_value || jsonb_build_object('changed_fields', item);
    END IF;
    IF jsonb_typeof(input_value->'export_id') = 'string'
       AND (input_value->>'export_id') ~ '^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$' THEN
        output_value := output_value || jsonb_build_object('export_id', lower(input_value->>'export_id'));
    END IF;
    IF jsonb_typeof(input_value->'scan_count') = 'number'
       AND (input_value->>'scan_count') ~ '^[0-9]{1,9}$' THEN
        output_value := output_value || jsonb_build_object('scan_count', (input_value->>'scan_count')::integer);
    END IF;
    IF jsonb_typeof(input_value->'sha256') = 'string'
       AND (input_value->>'sha256') ~ '^[0-9a-f]{64}$' THEN
        output_value := output_value || jsonb_build_object('sha256', input_value->>'sha256');
    END IF;
    IF jsonb_typeof(input_value->'export_verified') = 'boolean' THEN
        output_value := output_value || jsonb_build_object('export_verified', (input_value->>'export_verified')::boolean);
    END IF;
    IF jsonb_typeof(input_value->'without_export') = 'boolean' THEN
        output_value := output_value || jsonb_build_object('without_export', (input_value->>'without_export')::boolean);
    END IF;
    RETURN output_value;
END;
$$;
REVOKE ALL ON FUNCTION public.rbac_safe_audit_metadata(jsonb) FROM PUBLIC, anon, authenticated;

-- 4. Last active organization admin guard. It is enforced on membership
-- removal and on profile suspension, so a suspended second admin cannot be
-- mistaken for a usable successor.
CREATE FUNCTION public.rbac_protect_last_org_admin()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER
SET search_path = pg_catalog, public AS $$
BEGIN
    IF OLD.role = 'admin' AND OLD.status = 'active'
       AND (TG_OP = 'DELETE' OR NEW.role <> 'admin' OR NEW.status <> 'active') THEN
        PERFORM pg_advisory_xact_lock(hashtext('agri_sort_last_org_admin:' || OLD.organization_id::text));
        IF NOT EXISTS (
            SELECT 1 FROM public.organization_memberships m
            JOIN public.user_profiles up ON up.user_id = m.user_id AND up.status = 'active'
            WHERE m.organization_id = OLD.organization_id
              AND m.user_id <> OLD.user_id
              AND m.role = 'admin' AND m.status = 'active'
        ) THEN
            RAISE EXCEPTION 'organization must retain at least one active admin';
        END IF;
    END IF;
    IF TG_OP = 'DELETE' THEN RETURN OLD; END IF;
    RETURN NEW;
END;
$$;
CREATE TRIGGER organization_memberships_protect_last_admin
BEFORE UPDATE OR DELETE ON public.organization_memberships
FOR EACH ROW EXECUTE FUNCTION public.rbac_protect_last_org_admin();

CREATE FUNCTION public.rbac_protect_last_org_admin_profile()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER
SET search_path = pg_catalog, public AS $$
DECLARE admin_org uuid;
BEGIN
    IF OLD.status = 'active' AND (TG_OP = 'DELETE' OR NEW.status <> 'active') THEN
        FOR admin_org IN
            SELECT organization_id FROM public.organization_memberships
            WHERE user_id = OLD.user_id AND role = 'admin' AND status = 'active'
        LOOP
            PERFORM pg_advisory_xact_lock(hashtext('agri_sort_last_org_admin:' || admin_org::text));
            IF NOT EXISTS (
                SELECT 1 FROM public.organization_memberships m
                JOIN public.user_profiles up ON up.user_id = m.user_id AND up.status = 'active'
                WHERE m.organization_id = admin_org
                  AND m.user_id <> OLD.user_id
                  AND m.role = 'admin' AND m.status = 'active'
            ) THEN
                RAISE EXCEPTION 'organization must retain at least one active admin';
            END IF;
        END LOOP;
    END IF;
    IF TG_OP = 'DELETE' THEN RETURN OLD; END IF;
    RETURN NEW;
END;
$$;
CREATE TRIGGER user_profiles_protect_last_org_admin
BEFORE UPDATE OF status OR DELETE ON public.user_profiles
FOR EACH ROW EXECUTE FUNCTION public.rbac_protect_last_org_admin_profile();

-- 5. Strict one-time bootstrap. The operator must be a real Auth identity but
-- does not need an active profile; requiring one was circular.
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
    IF EXISTS (SELECT 1 FROM public.audit_events WHERE action = 'super_admin.bootstrap') THEN
        RAISE EXCEPTION 'bootstrap already completed';
    END IF;
    IF EXISTS (SELECT 1 FROM public.platform_roles WHERE role = 'super_admin') THEN
        RAISE EXCEPTION 'a Super Admin already exists; bootstrap is one-time only';
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
REVOKE ALL ON FUNCTION public.rbac_bootstrap_super_admin(uuid, uuid) FROM PUBLIC, anon, authenticated, service_role;

-- 6. Break-glass recovery is a separate operator-only function. It is not an
-- API endpoint and cannot run while an active Super Admin exists.
CREATE FUNCTION public.rbac_recover_super_admin(
    operator_actor_id uuid, target_user_id uuid, recovery_reason_code text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER
SET search_path = pg_catalog, public AS $$
BEGIN
    IF session_user NOT IN ('postgres', 'supabase_admin') THEN
        RAISE EXCEPTION 'operator database role required';
    END IF;
    IF operator_actor_id = target_user_id THEN
        RAISE EXCEPTION 'recovery actor cannot promote self';
    END IF;
    IF recovery_reason_code IS NULL OR recovery_reason_code !~ '^[a-zA-Z0-9_-]{1,40}$' THEN
        RAISE EXCEPTION 'a bounded recovery reason code is required';
    END IF;
    IF NOT EXISTS (SELECT 1 FROM auth.users WHERE id = operator_actor_id) THEN
        RAISE EXCEPTION 'operator Auth user not found';
    END IF;
    IF NOT EXISTS (SELECT 1 FROM auth.users WHERE id = target_user_id) THEN
        RAISE EXCEPTION 'target Auth user not found';
    END IF;
    PERFORM pg_advisory_xact_lock(hashtext('agri_sort_last_super_admin'));
    IF EXISTS (
        SELECT 1 FROM public.platform_roles pr
        JOIN public.user_profiles up ON up.user_id = pr.user_id
        WHERE pr.role = 'super_admin' AND up.status = 'active'
    ) THEN
        RAISE EXCEPTION 'active Super Admin exists; recovery is not permitted';
    END IF;
    IF EXISTS (SELECT 1 FROM public.platform_roles WHERE user_id = target_user_id AND role <> 'super_admin') THEN
        RAISE EXCEPTION 'target already holds a different platform role';
    END IF;
    INSERT INTO public.user_profiles(user_id, full_name, status)
    VALUES (target_user_id, '', 'active')
    ON CONFLICT (user_id) DO UPDATE SET status = 'active';
    INSERT INTO public.platform_roles(user_id, role)
    VALUES (target_user_id, 'super_admin')
    ON CONFLICT (user_id) DO UPDATE SET role = 'super_admin';
    PERFORM public.rbac_audit(operator_actor_id, NULL,
        'super_admin.recovery', 'user', target_user_id::text,
        jsonb_build_object('role', 'super_admin', 'reason_code', recovery_reason_code,
                           'resource_type', 'user'));
END;
$$;
REVOKE ALL ON FUNCTION public.rbac_recover_super_admin(uuid, uuid, text) FROM PUBLIC, anon, authenticated, service_role;

-- 7. D1 export record. No FK to auth.users: the verification evidence must
-- survive the account deletion it authorizes.
CREATE TABLE public.account_exports (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id uuid NOT NULL,
    state text NOT NULL DEFAULT 'pending'
        CHECK (state IN ('pending', 'ready', 'downloaded', 'failed', 'consumed', 'expired')),
    scan_count integer NOT NULL DEFAULT 0 CHECK (scan_count >= 0),
    sha256 text CHECK (sha256 IS NULL OR sha256 ~ '^[0-9a-f]{64}$'),
    manifest jsonb NOT NULL DEFAULT '{}'::jsonb CHECK (jsonb_typeof(manifest) = 'object'),
    storage_path text CHECK (storage_path IS NULL OR length(storage_path) <= 500),
    failure_reason text CHECK (failure_reason IS NULL OR length(failure_reason) <= 500),
    attempt_count integer NOT NULL DEFAULT 0 CHECK (attempt_count >= 0),
    created_at timestamptz NOT NULL DEFAULT now(),
    expires_at timestamptz NOT NULL DEFAULT now() + interval '24 hours',
    ready_at timestamptz,
    downloaded_at timestamptz,
    consumed_at timestamptz
);
CREATE INDEX account_exports_user_created_idx ON public.account_exports(user_id, created_at DESC);
CREATE INDEX account_exports_state_expiry_idx ON public.account_exports(state, expires_at);
-- A user may have only one live export. This closes the check-then-create race
-- between concurrent requests; failed/consumed/expired rows do not block retry.
CREATE UNIQUE INDEX account_exports_one_active_per_user
    ON public.account_exports(user_id)
    WHERE state IN ('pending', 'ready');
ALTER TABLE public.account_exports ENABLE ROW LEVEL SECURITY;
CREATE POLICY account_exports_owner_select ON public.account_exports FOR SELECT TO authenticated
USING (auth.uid() = user_id);
REVOKE ALL ON public.account_exports FROM PUBLIC, anon, authenticated;
GRANT SELECT ON public.account_exports TO authenticated;
GRANT SELECT, INSERT, UPDATE ON public.account_exports TO service_role;

-- Owner attests that the artifact downloaded. This is idempotent and does not
-- expose or transfer scan contents.
CREATE FUNCTION public.rbac_mark_export_downloaded(export_id uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER
SET search_path = pg_catalog, public AS $$
DECLARE actor uuid := auth.uid();
DECLARE result public.account_exports;
BEGIN
    IF actor IS NULL THEN RAISE EXCEPTION 'authenticated owner required'; END IF;
    SELECT * INTO result FROM public.account_exports
    WHERE id = export_id AND user_id = actor FOR UPDATE;
    IF NOT FOUND THEN RAISE EXCEPTION 'export not found for owner'; END IF;
    IF result.state = 'downloaded' AND result.downloaded_at IS NOT NULL THEN
        RETURN jsonb_build_object('export_id', result.id, 'state', result.state,
            'scan_count', result.scan_count, 'sha256', result.sha256,
            'downloaded_at', result.downloaded_at, 'expires_at', result.expires_at);
    END IF;
    IF result.state <> 'ready' OR result.expires_at <= now() THEN
        RAISE EXCEPTION 'export is not ready or has expired';
    END IF;
    UPDATE public.account_exports SET state = 'downloaded', downloaded_at = now()
    WHERE id = result.id RETURNING * INTO result;
    PERFORM public.rbac_audit(actor, NULL, 'account.export_verified',
        'account_export', result.id::text,
        jsonb_build_object('export_id', result.id, 'scan_count', result.scan_count,
                           'sha256', result.sha256, 'resource_type', 'account_export'));
    RETURN jsonb_build_object('export_id', result.id, 'state', result.state,
        'scan_count', result.scan_count, 'sha256', result.sha256,
        'downloaded_at', result.downloaded_at, 'expires_at', result.expires_at);
END;
$$;
REVOKE ALL ON FUNCTION public.rbac_mark_export_downloaded(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.rbac_mark_export_downloaded(uuid) TO authenticated;

-- Narrow service-role audit writer for export creation and failure. It never
-- accepts scan rows or free-form content.
CREATE FUNCTION public.rbac_record_export_event(
    export_id uuid, event_action text, failure_reason_code text DEFAULT NULL)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER
SET search_path = pg_catalog, public AS $$
DECLARE export_row public.account_exports;
DECLARE event_id uuid;
BEGIN
    IF current_setting('request.jwt.claim.role', true) IS DISTINCT FROM 'service_role'
       AND session_user NOT IN ('postgres', 'supabase_admin') THEN
        RAISE EXCEPTION 'service role required';
    END IF;
    IF event_action NOT IN ('account.export_created', 'account.export_failed') THEN
        RAISE EXCEPTION 'invalid export event action';
    END IF;
    SELECT * INTO export_row FROM public.account_exports WHERE id = export_id;
    IF NOT FOUND THEN RAISE EXCEPTION 'export record not found'; END IF;
    event_id := public.rbac_audit(export_row.user_id, NULL, event_action,
        'account_export', export_row.id::text,
        jsonb_build_object('export_id', export_row.id, 'scan_count', export_row.scan_count,
                           'sha256', export_row.sha256,
                           'reason_code', failure_reason_code,
                           'resource_type', 'account_export'));
    RETURN event_id;
END;
$$;
REVOKE ALL ON FUNCTION public.rbac_record_export_event(uuid, text, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.rbac_record_export_event(uuid, text, text) TO service_role;

-- 8. Atomic account deletion. All steps share the caller transaction; any
-- failure rolls back the audit row, scan delete, and Auth delete together.
CREATE FUNCTION public.rbac_delete_account(
    target_user_id uuid, export_id uuid, allow_without_export boolean,
    waiver_reason_code text DEFAULT NULL)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER
SET search_path = pg_catalog, public AS $$
DECLARE export_row public.account_exports;
DECLARE scan_total bigint := 0;
DECLARE deleted_users bigint := 0;
DECLARE verified_export boolean := false;
DECLARE export_sha text;
DECLARE reason_code text := COALESCE(NULLIF(btrim(waiver_reason_code), ''), 'user_waiver');
BEGIN
    IF current_setting('request.jwt.claim.role', true) IS DISTINCT FROM 'service_role'
       AND session_user NOT IN ('postgres', 'supabase_admin') THEN
        RAISE EXCEPTION 'service role required for account deletion';
    END IF;
    IF target_user_id IS NULL THEN RAISE EXCEPTION 'target user is required'; END IF;
    PERFORM pg_advisory_xact_lock(hashtext(target_user_id::text));
    IF NOT EXISTS (SELECT 1 FROM auth.users WHERE id = target_user_id) THEN
        RAISE EXCEPTION 'target Auth user not found';
    END IF;
    IF reason_code !~ '^[a-zA-Z0-9_-]{1,40}$' THEN
        RAISE EXCEPTION 'invalid waiver reason code';
    END IF;

    IF to_regclass('public.scans') IS NOT NULL THEN
        EXECUTE 'SELECT count(*) FROM public.scans WHERE user_id = $1'
            INTO scan_total USING target_user_id;
    END IF;

    IF NOT COALESCE(allow_without_export, false) THEN
        IF export_id IS NULL THEN
            RAISE EXCEPTION 'an export or explicit waiver is required';
        END IF;
        SELECT * INTO export_row FROM public.account_exports
        WHERE id = export_id AND user_id = target_user_id FOR UPDATE;
        IF NOT FOUND THEN RAISE EXCEPTION 'export does not belong to target user'; END IF;
        IF export_row.state <> 'downloaded' OR export_row.downloaded_at IS NULL THEN
            RAISE EXCEPTION 'export must be downloaded and verified before deletion';
        END IF;
        IF export_row.expires_at <= now() THEN
            RAISE EXCEPTION 'export has expired; re-export before deletion';
        END IF;
        IF export_row.sha256 IS NULL OR export_row.scan_count <> scan_total THEN
            RAISE EXCEPTION 'export does not match the current scan set';
        END IF;
        export_sha := export_row.sha256;
        verified_export := true;
    END IF;

    IF COALESCE(allow_without_export, false) THEN
        PERFORM public.rbac_audit(target_user_id, NULL, 'account.deletion_without_export',
            'user', target_user_id::text,
            jsonb_build_object('reason_code', reason_code, 'resource_type', 'user'));
    END IF;

    PERFORM public.rbac_audit(target_user_id, NULL, 'account.deleted',
        'user', target_user_id::text,
        jsonb_build_object('export_id', export_id, 'scan_count', scan_total,
                           'export_verified', verified_export,
                           'without_export', COALESCE(allow_without_export, false),
                           'sha256', export_sha,
                           'resource_type', 'user'));

    IF to_regclass('public.scans') IS NOT NULL THEN
        EXECUTE 'DELETE FROM public.scans WHERE user_id = $1' USING target_user_id;
        IF EXISTS (SELECT 1 FROM public.scans WHERE user_id = target_user_id) THEN
            RAISE EXCEPTION 'scan rows remain after explicit deletion';
        END IF;
    END IF;

    DELETE FROM auth.users WHERE id = target_user_id;
    GET DIAGNOSTICS deleted_users = ROW_COUNT;
    IF deleted_users <> 1 THEN
        RAISE EXCEPTION 'Auth user was not deleted exactly once';
    END IF;

    IF verified_export THEN
        UPDATE public.account_exports SET state = 'consumed', consumed_at = now()
        WHERE id = export_row.id;
    END IF;

    RETURN jsonb_build_object('user_id', target_user_id, 'scan_count', scan_total,
        'export_verified', verified_export, 'without_export', COALESCE(allow_without_export, false));
END;
$$;
REVOKE ALL ON FUNCTION public.rbac_delete_account(uuid, uuid, boolean, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.rbac_delete_account(uuid, uuid, boolean, text) TO service_role;

COMMIT;
