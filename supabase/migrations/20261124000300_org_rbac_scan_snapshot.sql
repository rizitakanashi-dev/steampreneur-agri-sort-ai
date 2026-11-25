-- Exact scan-snapshot integrity and mutation/deletion coordination.
-- Forward-only: base and retention migrations are immutable inputs.
-- This migration installs the owner-scoped snapshot function, binds exports
-- to a database-computed SHA-256 snapshot, and serializes every scan mutation
-- with account deletion through a per-owner transaction advisory lock.
-- No data is deleted, no ownership is changed, and no cross-user access is added.
BEGIN;

DO $$
DECLARE missing_column text;
BEGIN
    IF to_regclass('public.account_exports') IS NULL THEN
        RAISE EXCEPTION 'scan snapshot migration stopped: account_exports is missing';
    END IF;
    IF to_regclass('public.scans') IS NULL THEN
        RAISE EXCEPTION 'scan snapshot migration stopped: public.scans must exist';
    END IF;
    IF to_regprocedure('public.rbac_delete_account(uuid,uuid,boolean,text)') IS NULL THEN
        RAISE EXCEPTION 'scan snapshot migration stopped: retention deletion function is missing';
    END IF;
    FOR missing_column IN
        SELECT expected.column_name
        FROM (VALUES
            ('id','uuid'), ('user_id','uuid'), ('scan_id','character varying'),
            ('commodity','character varying'), ('ai_supported','boolean'),
            ('actual_weight_kg','numeric'), ('total_objects','integer'),
            ('fresh_count','integer'), ('rotten_count','integer'),
            ('fresh_ratio_percent','numeric'), ('rotten_ratio_percent','numeric'),
            ('reference_price_per_kg','integer'), ('estimated_economic_value','bigint'),
            ('potential_loss_value','bigint'), ('recommendation_note','text'),
            ('is_simulated','boolean'), ('model_version','character varying'),
            ('created_at','timestamp with time zone'), ('updated_at','timestamp with time zone')
        ) AS expected(column_name, type_name)
        WHERE NOT EXISTS (
            SELECT 1 FROM pg_attribute a
            WHERE a.attrelid = 'public.scans'::regclass
              AND a.attname = expected.column_name
              AND NOT a.attisdropped
              AND format_type(a.atttypid, NULL) = expected.type_name
        )
    LOOP
        RAISE EXCEPTION 'scan snapshot migration stopped: public.scans.% is missing or has an unexpected type', missing_column;
    END LOOP;
    IF EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema='public' AND table_name='account_exports'
          AND column_name IN ('snapshot_schema_version','snapshot_sha256')
          AND data_type NOT IN ('text','character varying')
    ) THEN
        RAISE EXCEPTION 'scan snapshot migration stopped: account_exports snapshot columns have an unexpected type';
    END IF;
END;
$$;

ALTER TABLE public.account_exports
    ADD COLUMN IF NOT EXISTS snapshot_schema_version text;
ALTER TABLE public.account_exports
    ADD COLUMN IF NOT EXISTS snapshot_sha256 text;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint
        WHERE conrelid='public.account_exports'::regclass
          AND conname='account_exports_snapshot_sha256_format'
    ) THEN
        ALTER TABLE public.account_exports
            ADD CONSTRAINT account_exports_snapshot_sha256_format
            CHECK (snapshot_sha256 IS NULL OR snapshot_sha256 ~ '^[0-9a-f]{64}$');
    END IF;
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint
        WHERE conrelid='public.account_exports'::regclass
          AND conname='account_exports_snapshot_schema_format'
    ) THEN
        ALTER TABLE public.account_exports
            ADD CONSTRAINT account_exports_snapshot_schema_format
            CHECK (snapshot_schema_version IS NULL OR snapshot_schema_version = 'scan-export-v1');
    END IF;
END;
$$;

-- The canonical row intentionally fixes timestamp rendering to UTC and includes
-- every column that is part of a scan export. JSONB text is deterministic and
-- is hashed only inside PostgreSQL; Python never recomputes this digest from a
-- different JSON representation.
CREATE FUNCTION public.rbac_scan_snapshot(target_user_id uuid)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER
SET search_path = pg_catalog, public AS $$
DECLARE scan_rows jsonb;
DECLARE payload jsonb;
BEGIN
    IF target_user_id IS NULL THEN
        RAISE EXCEPTION 'target user is required';
    END IF;
    SELECT COALESCE(jsonb_agg(
        jsonb_build_object(
            'id', s.id,
            'user_id', s.user_id,
            'scan_id', s.scan_id,
            'commodity', s.commodity,
            'ai_supported', s.ai_supported,
            'actual_weight_kg', s.actual_weight_kg,
            'total_objects', s.total_objects,
            'fresh_count', s.fresh_count,
            'rotten_count', s.rotten_count,
            'fresh_ratio_percent', s.fresh_ratio_percent,
            'rotten_ratio_percent', s.rotten_ratio_percent,
            'reference_price_per_kg', s.reference_price_per_kg,
            'estimated_economic_value', s.estimated_economic_value,
            'potential_loss_value', s.potential_loss_value,
            'recommendation_note', s.recommendation_note,
            'is_simulated', s.is_simulated,
            'model_version', s.model_version,
            'created_at', to_char(s.created_at AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.US"Z"'),
            'updated_at', to_char(s.updated_at AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.US"Z"')
        ) ORDER BY s.id), '[]'::jsonb)
    INTO scan_rows
    FROM public.scans s
    WHERE s.user_id = target_user_id;

    payload := jsonb_build_object(
        'schema_version', 'scan-export-v1',
        'owner_id', target_user_id,
        'scan_count', jsonb_array_length(scan_rows),
        'scans', scan_rows
    );
    RETURN payload || jsonb_build_object(
        'snapshot_sha256', encode(sha256(convert_to(payload::text, 'UTF8')), 'hex'),
        'snapshot_json', payload::text
    );
END;
$$;
REVOKE ALL ON FUNCTION public.rbac_scan_snapshot(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.rbac_scan_snapshot(uuid) TO service_role;

CREATE FUNCTION public.rbac_api_scan_snapshot()
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER
SET search_path = pg_catalog, public AS $$
DECLARE actor uuid := auth.uid();
BEGIN
    IF actor IS NULL THEN RAISE EXCEPTION 'authenticated owner required'; END IF;
    RETURN public.rbac_scan_snapshot(actor);
END;
$$;
REVOKE ALL ON FUNCTION public.rbac_api_scan_snapshot() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.rbac_api_scan_snapshot() TO authenticated;

CREATE FUNCTION public.rbac_guard_scan_mutation()
RETURNS trigger LANGUAGE plpgsql
SET search_path = pg_catalog, public AS $$
DECLARE old_owner uuid;
DECLARE new_owner uuid;
BEGIN
    IF TG_OP IN ('INSERT', 'UPDATE') THEN new_owner := NEW.user_id; END IF;
    IF TG_OP IN ('UPDATE', 'DELETE') THEN old_owner := OLD.user_id; END IF;

    IF TG_OP = 'UPDATE' AND old_owner IS NOT NULL AND new_owner IS NOT NULL
       AND old_owner <> new_owner THEN
        -- Owner transfer must lock both owners in one deterministic order.
        IF old_owner::text < new_owner::text THEN
            PERFORM pg_advisory_xact_lock(hashtextextended('agri_sort_scan_owner:' || old_owner::text, 0));
            PERFORM pg_advisory_xact_lock(hashtextextended('agri_sort_scan_owner:' || new_owner::text, 0));
        ELSE
            PERFORM pg_advisory_xact_lock(hashtextextended('agri_sort_scan_owner:' || new_owner::text, 0));
            PERFORM pg_advisory_xact_lock(hashtextextended('agri_sort_scan_owner:' || old_owner::text, 0));
        END IF;
    ELSE
        IF old_owner IS NOT NULL THEN
            PERFORM pg_advisory_xact_lock(hashtextextended('agri_sort_scan_owner:' || old_owner::text, 0));
        END IF;
        IF new_owner IS NOT NULL AND (old_owner IS NULL OR new_owner <> old_owner) THEN
            PERFORM pg_advisory_xact_lock(hashtextextended('agri_sort_scan_owner:' || new_owner::text, 0));
        END IF;
    END IF;

    IF TG_OP = 'DELETE' THEN RETURN OLD; END IF;
    RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION public.rbac_guard_scan_mutation() FROM PUBLIC, anon, authenticated;

CREATE FUNCTION public.rbac_reject_scan_truncate()
RETURNS trigger LANGUAGE plpgsql
SET search_path = pg_catalog AS $$
BEGIN
    RAISE EXCEPTION 'TRUNCATE public.scans is not permitted';
END;
$$;
REVOKE ALL ON FUNCTION public.rbac_reject_scan_truncate() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS scans_guard_mutation ON public.scans;
CREATE TRIGGER scans_guard_mutation
BEFORE INSERT OR UPDATE OR DELETE ON public.scans
FOR EACH ROW EXECUTE FUNCTION public.rbac_guard_scan_mutation();

DROP TRIGGER IF EXISTS scans_reject_truncate ON public.scans;
CREATE TRIGGER scans_reject_truncate
BEFORE TRUNCATE ON public.scans
FOR EACH STATEMENT EXECUTE FUNCTION public.rbac_reject_scan_truncate();

-- The deletion function recomputes the database snapshot after taking the
-- same owner lock used by every scan mutation. It requires the signed manifest
-- to reference the stored snapshot and rejects any difference in exact rows.
--
-- This function is intentionally VOLATILE. Under READ COMMITTED, each SPI
-- statement in a volatile PL/pgSQL function takes a fresh snapshot. The
-- snapshot assignment below therefore starts after the advisory-lock wait and
-- sees mutations committed by the prior lock holder. Do not mark it STABLE:
-- a STABLE function would reuse the outer RPC statement snapshot taken before
-- the wait and could accept a stale export.
CREATE OR REPLACE FUNCTION public.rbac_delete_account(
    target_user_id uuid, export_id uuid, allow_without_export boolean,
    waiver_reason_code text DEFAULT NULL)
RETURNS jsonb LANGUAGE plpgsql VOLATILE SECURITY DEFINER
SET search_path = pg_catalog, public AS $$
DECLARE export_row public.account_exports;
DECLARE snapshot jsonb;
DECLARE scan_total bigint := 0;
DECLARE snapshot_sha text;
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
    -- A repeatable-read/serializable snapshot could predate a scan row that
    -- committed while this transaction waited for the owner lock. Fail closed
    -- instead of verifying an older snapshot than the one we delete.
    IF current_setting('transaction_isolation') NOT IN ('read committed', 'read uncommitted') THEN
        RAISE EXCEPTION 'account deletion requires read committed isolation';
    END IF;
    PERFORM pg_advisory_xact_lock(hashtextextended('agri_sort_scan_owner:' || target_user_id::text, 0));
    IF NOT EXISTS (SELECT 1 FROM auth.users WHERE id = target_user_id) THEN
        RAISE EXCEPTION 'target Auth user not found';
    END IF;
    IF reason_code !~ '^[a-zA-Z0-9_-]{1,40}$' THEN
        RAISE EXCEPTION 'invalid waiver reason code';
    END IF;

    snapshot := public.rbac_scan_snapshot(target_user_id);
    scan_total := COALESCE((snapshot->>'scan_count')::bigint, 0);
    snapshot_sha := snapshot->>'snapshot_sha256';
    IF snapshot_sha IS NULL OR snapshot_sha !~ '^[0-9a-f]{64}$' THEN
        RAISE EXCEPTION 'scan snapshot fingerprint is unavailable';
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
        IF export_row.snapshot_schema_version IS DISTINCT FROM 'scan-export-v1'
           OR export_row.snapshot_sha256 IS NULL
           OR export_row.snapshot_sha256 !~ '^[0-9a-f]{64}$' THEN
            RAISE EXCEPTION 'export lacks a verifiable snapshot fingerprint';
        END IF;
        IF jsonb_typeof(export_row.manifest->'snapshot') IS DISTINCT FROM 'object'
           OR export_row.manifest->'snapshot'->>'algorithm' IS DISTINCT FROM 'sha256'
           OR export_row.manifest->'snapshot'->>'schema_version' IS DISTINCT FROM 'scan-export-v1'
           OR export_row.manifest->'snapshot'->>'owner_id' IS DISTINCT FROM target_user_id::text
           OR export_row.manifest->'snapshot'->>'sha256' IS DISTINCT FROM export_row.snapshot_sha256
           OR export_row.manifest->'snapshot'->>'scan_count' IS DISTINCT FROM export_row.scan_count::text THEN
            RAISE EXCEPTION 'export manifest snapshot metadata is inconsistent';
        END IF;
        IF export_row.scan_count <> scan_total
           OR export_row.snapshot_sha256 IS DISTINCT FROM snapshot_sha THEN
            RAISE EXCEPTION 'export does not match the current exact scan snapshot';
        END IF;
        export_sha := export_row.sha256;
        verified_export := true;
    ELSE
        IF scan_total > 0 AND NOT EXISTS (
            SELECT 1 FROM public.account_exports
            WHERE user_id = target_user_id AND state = 'failed'
        ) THEN
            RAISE EXCEPTION 'waiver requires no scans or a failed export';
        END IF;
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

    DELETE FROM public.scans WHERE user_id = target_user_id;
    IF EXISTS (SELECT 1 FROM public.scans WHERE user_id = target_user_id) THEN
        RAISE EXCEPTION 'scan rows remain after explicit deletion';
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
