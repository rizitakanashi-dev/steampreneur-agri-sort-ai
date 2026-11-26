-- Migration: 20261124000400_user_profiles_username_sync.sql
-- Deskripsi: Sinkronisasi username / full_name user yang kosong dari auth.users ke public.user_profiles,
--            memperbarui trigger pembuat profil otomatis, menyertakan email di list_users/list_members,
--            dan menambahkan RPC update user profile untuk Super Admin.

BEGIN;

-- 1. Perbarui seluruh profil user yang full_name-nya kosong atau NULL
UPDATE public.user_profiles up
SET full_name = COALESCE(
    NULLIF(TRIM(au.raw_user_meta_data->>'full_name'), ''),
    NULLIF(TRIM(au.raw_user_meta_data->>'name'), ''),
    NULLIF(TRIM(au.raw_user_meta_data->>'user_name'), ''),
    NULLIF(TRIM(split_part(au.email, '@', 1)), ''),
    'Pengguna'
)
FROM auth.users au
WHERE up.user_id = au.id
  AND (up.full_name IS NULL OR TRIM(up.full_name) = '');

-- 2. Perbarui trigger agar pengguna baru (baik email maupun Google auth)
--    langsung mendapatkan full_name yang diekstrak dari metadata / email.
CREATE OR REPLACE FUNCTION public.rbac_create_pending_profile()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog, public AS $$
DECLARE
    extracted_name text;
BEGIN
    extracted_name := COALESCE(
        NULLIF(TRIM(NEW.raw_user_meta_data->>'full_name'), ''),
        NULLIF(TRIM(NEW.raw_user_meta_data->>'name'), ''),
        NULLIF(TRIM(NEW.raw_user_meta_data->>'user_name'), ''),
        NULLIF(TRIM(split_part(NEW.email, '@', 1)), ''),
        'Pengguna'
    );
    INSERT INTO public.user_profiles(user_id, full_name, status)
    VALUES (NEW.id, extracted_name, 'pending_assignment')
    ON CONFLICT (user_id) DO UPDATE
    SET full_name = CASE
        WHEN public.user_profiles.full_name IS NULL OR TRIM(public.user_profiles.full_name) = ''
        THEN EXCLUDED.full_name
        ELSE public.user_profiles.full_name
    END;
    RETURN NEW;
END;
$$;

-- 3. Perbarui rbac_api_list_users agar menyertakan email dan fallback name yang tidak pernah kosong
CREATE OR REPLACE FUNCTION public.rbac_api_list_users(page_limit integer DEFAULT 50, page_offset integer DEFAULT 0)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog, public AS $$
DECLARE actor uuid := public.rbac_require_super_admin();
DECLARE result jsonb;
BEGIN
    IF page_limit < 1 OR page_limit > 200 OR page_offset < 0 THEN RAISE EXCEPTION 'invalid pagination'; END IF;
    SELECT COALESCE(jsonb_agg(jsonb_build_object(
        'user_id', p.user_id,
        'full_name', COALESCE(
            NULLIF(TRIM(p.full_name), ''),
            NULLIF(TRIM(u.raw_user_meta_data->>'full_name'), ''),
            NULLIF(TRIM(u.raw_user_meta_data->>'name'), ''),
            NULLIF(TRIM(split_part(u.email, '@', 1)), ''),
            'Pengguna'
        ),
        'email', COALESCE(u.email, ''),
        'status', p.status,
        'platform_role', (SELECT pr.role FROM public.platform_roles pr WHERE pr.user_id = p.user_id),
        'created_at', p.created_at,
        'memberships', COALESCE((
            SELECT jsonb_agg(jsonb_build_object(
                'organization_id', m.organization_id,
                'role', m.role,
                'status', m.status
            ))
            FROM public.organization_memberships m
            WHERE m.user_id = p.user_id
        ), '[]'::jsonb)
    ) ORDER BY p.created_at DESC), '[]'::jsonb) INTO result
    FROM (
        SELECT * FROM public.user_profiles
        ORDER BY created_at DESC
        LIMIT page_limit OFFSET page_offset
    ) p
    LEFT JOIN auth.users u ON u.id = p.user_id;

    RETURN result;
END;
$$;

-- 4. Perbarui rbac_api_list_members agar menyertakan email dan nama pengguna yang valid
CREATE OR REPLACE FUNCTION public.rbac_api_list_members(target_organization_id uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog, public AS $$
DECLARE actor uuid := auth.uid();
DECLARE result jsonb;
BEGIN
    PERFORM public.rbac_require_org_admin(target_organization_id);
    SELECT COALESCE(jsonb_agg(jsonb_build_object(
        'id', m.id,
        'organization_id', m.organization_id,
        'user_id', m.user_id,
        'full_name', COALESCE(
            NULLIF(TRIM(p.full_name), ''),
            NULLIF(TRIM(u.raw_user_meta_data->>'full_name'), ''),
            NULLIF(TRIM(u.raw_user_meta_data->>'name'), ''),
            NULLIF(TRIM(split_part(u.email, '@', 1)), ''),
            'Pengguna'
        ),
        'email', COALESCE(u.email, ''),
        'role', m.role,
        'status', m.status,
        'created_at', m.created_at
    ) ORDER BY m.created_at ASC), '[]'::jsonb) INTO result
    FROM public.organization_memberships m
    JOIN public.user_profiles p ON p.user_id = m.user_id
    LEFT JOIN auth.users u ON u.id = p.user_id
    WHERE m.organization_id = target_organization_id;

    RETURN result;
END;
$$;

-- 5. Tambahkan RPC untuk Super Admin memperbarui profil user (Nama/Username dan Status)
CREATE OR REPLACE FUNCTION public.rbac_api_update_user_profile(target_user_id uuid, new_full_name text, new_status text DEFAULT NULL)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog, public AS $$
DECLARE actor uuid := public.rbac_require_super_admin();
DECLARE clean_name text;
DECLARE result public.user_profiles;
BEGIN
    clean_name := TRIM(COALESCE(new_full_name, ''));
    IF LENGTH(clean_name) < 1 THEN
        RAISE EXCEPTION 'Nama pengguna tidak boleh kosong';
    END IF;

    IF new_status IS NOT NULL THEN
        IF new_status NOT IN ('active', 'suspended', 'pending_assignment') THEN
            RAISE EXCEPTION 'invalid user status';
        END IF;
        IF target_user_id = actor AND new_status <> 'active' THEN
            RAISE EXCEPTION 'cannot suspend self';
        END IF;
        IF new_status <> 'active' AND EXISTS (SELECT 1 FROM public.platform_roles WHERE user_id = target_user_id AND role = 'super_admin') THEN
            PERFORM pg_advisory_xact_lock(hashtext('agri_sort_last_super_admin'));
            IF (SELECT count(*) FROM public.platform_roles pr JOIN public.user_profiles up ON up.user_id = pr.user_id
                WHERE pr.role = 'super_admin' AND up.status = 'active' AND pr.user_id <> target_user_id) = 0 THEN
                RAISE EXCEPTION 'cannot suspend last active Super Admin';
            END IF;
        END IF;

        UPDATE public.user_profiles
        SET full_name = clean_name, status = new_status
        WHERE user_id = target_user_id
        RETURNING * INTO result;
    ELSE
        UPDATE public.user_profiles
        SET full_name = clean_name
        WHERE user_id = target_user_id
        RETURNING * INTO result;
    END IF;

    IF result.user_id IS NULL THEN
        RAISE EXCEPTION 'User profile not found';
    END IF;

    -- Catat event audit
    INSERT INTO public.audit_events (actor_user_id, action, target_type, target_id, metadata)
    VALUES (
        actor,
        'user.profile_update',
        'user',
        target_user_id,
        jsonb_build_object('full_name', clean_name, 'status', result.status)
    );

    RETURN jsonb_build_object(
        'user_id', result.user_id,
        'full_name', result.full_name,
        'status', result.status
    );
END;
$$;

-- Berikan izin eksekusi ke authenticated user (hak Super Admin divalidasi di dalam fungsi)
REVOKE ALL ON FUNCTION public.rbac_api_update_user_profile(uuid, text, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.rbac_api_update_user_profile(uuid, text, text) TO authenticated;

COMMIT;
