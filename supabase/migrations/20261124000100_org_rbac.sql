-- Organization RBAC core and audited management RPCs.
-- Additive only; do not associate existing scans with organizations.
BEGIN;

DO $$
DECLARE target_name text;
BEGIN
    FOREACH target_name IN ARRAY ARRAY[
        'organizations', 'user_profiles', 'organization_memberships', 'platform_roles', 'audit_events'
    ] LOOP
        IF to_regclass(format('public.%I', target_name)) IS NOT NULL THEN
            RAISE EXCEPTION 'RBAC migration stopped: public.% already exists; inspect and reconcile schema before applying', target_name;
        END IF;
    END LOOP;
END;
$$;

CREATE TABLE public.organizations (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    name text NOT NULL CHECK (length(btrim(name)) BETWEEN 1 AND 160),
    slug text NOT NULL UNIQUE CHECK (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
    status text NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'suspended')),
    region text CHECK (region IS NULL OR length(region) <= 120),
    kabupaten text CHECK (kabupaten IS NULL OR length(kabupaten) <= 120),
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX organizations_status_idx ON public.organizations(status);

CREATE TABLE public.user_profiles (
    user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    full_name text NOT NULL DEFAULT '' CHECK (length(full_name) <= 160),
    status text NOT NULL DEFAULT 'pending_assignment' CHECK (status IN ('active', 'suspended', 'pending_assignment')),
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX user_profiles_status_idx ON public.user_profiles(status);

CREATE TABLE public.organization_memberships (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE RESTRICT,
    user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    role text NOT NULL CHECK (role IN ('admin', 'farmer', 'merchant')),
    status text NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'suspended', 'revoked', 'pending')),
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX organization_memberships_one_active_idx
    ON public.organization_memberships(organization_id, user_id) WHERE status = 'active';
CREATE INDEX organization_memberships_user_status_idx ON public.organization_memberships(user_id, status);
CREATE INDEX organization_memberships_org_status_role_idx ON public.organization_memberships(organization_id, status, role);

CREATE TABLE public.platform_roles (
    user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE RESTRICT,
    role text NOT NULL CHECK (role = 'super_admin'),
    created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.audit_events (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    actor_user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE RESTRICT,
    organization_id uuid REFERENCES public.organizations(id) ON DELETE RESTRICT,
    action text NOT NULL CHECK (length(btrim(action)) BETWEEN 1 AND 120),
    target_type text NOT NULL CHECK (length(btrim(target_type)) BETWEEN 1 AND 80),
    target_id text CHECK (target_id IS NULL OR length(target_id) <= 200),
    metadata jsonb NOT NULL DEFAULT '{}'::jsonb CHECK (jsonb_typeof(metadata) = 'object'),
    created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX audit_events_org_created_idx ON public.audit_events(organization_id, created_at DESC);
CREATE INDEX audit_events_actor_created_idx ON public.audit_events(actor_user_id, created_at DESC);
CREATE INDEX audit_events_action_created_idx ON public.audit_events(action, created_at DESC);
CREATE FUNCTION public.rbac_reject_audit_mutation()
RETURNS trigger LANGUAGE plpgsql SET search_path = pg_catalog AS $$
BEGIN
    RAISE EXCEPTION 'audit events are append-only';
END;
$$;
CREATE TRIGGER audit_events_append_only BEFORE UPDATE OR DELETE ON public.audit_events
FOR EACH ROW EXECUTE FUNCTION public.rbac_reject_audit_mutation();

-- Existing users remain explicitly unassigned. Name/email are not copied from Auth metadata.
INSERT INTO public.user_profiles(user_id, full_name, status)
SELECT id, '', 'pending_assignment' FROM auth.users
ON CONFLICT (user_id) DO NOTHING;

CREATE FUNCTION public.rbac_touch_updated_at()
RETURNS trigger LANGUAGE plpgsql SET search_path = pg_catalog AS $$
BEGIN NEW.updated_at := now(); RETURN NEW; END;
$$;
CREATE TRIGGER organizations_touch_updated_at BEFORE UPDATE ON public.organizations
FOR EACH ROW EXECUTE FUNCTION public.rbac_touch_updated_at();
CREATE TRIGGER user_profiles_touch_updated_at BEFORE UPDATE ON public.user_profiles
FOR EACH ROW EXECUTE FUNCTION public.rbac_touch_updated_at();
CREATE TRIGGER organization_memberships_touch_updated_at BEFORE UPDATE ON public.organization_memberships
FOR EACH ROW EXECUTE FUNCTION public.rbac_touch_updated_at();

CREATE FUNCTION public.rbac_create_pending_profile()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog, public AS $$
BEGIN
    INSERT INTO public.user_profiles(user_id, full_name, status)
    VALUES (NEW.id, '', 'pending_assignment') ON CONFLICT (user_id) DO NOTHING;
    RETURN NEW;
END;
$$;
CREATE TRIGGER auth_user_create_pending_profile AFTER INSERT ON auth.users
FOR EACH ROW EXECUTE FUNCTION public.rbac_create_pending_profile();
REVOKE ALL ON FUNCTION public.rbac_create_pending_profile() FROM PUBLIC, anon, authenticated;

CREATE FUNCTION public.rbac_is_super_admin(check_user uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = pg_catalog, public AS $$
    SELECT check_user = auth.uid() AND EXISTS (
        SELECT 1 FROM public.platform_roles pr
        JOIN public.user_profiles up ON up.user_id = pr.user_id
        WHERE pr.user_id = auth.uid() AND pr.role = 'super_admin' AND up.status = 'active'
    );
$$;
CREATE FUNCTION public.rbac_has_active_membership(check_user uuid, check_org uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = pg_catalog, public AS $$
    SELECT check_user = auth.uid() AND EXISTS (
        SELECT 1 FROM public.organization_memberships m
        JOIN public.organizations o ON o.id = m.organization_id AND o.status = 'active'
        JOIN public.user_profiles up ON up.user_id = m.user_id AND up.status = 'active'
        WHERE m.user_id = auth.uid() AND m.organization_id = check_org AND m.status = 'active'
    );
$$;
CREATE FUNCTION public.rbac_is_org_admin(check_user uuid, check_org uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = pg_catalog, public AS $$
    SELECT check_user = auth.uid() AND EXISTS (
        SELECT 1 FROM public.organization_memberships m
        JOIN public.organizations o ON o.id = m.organization_id AND o.status = 'active'
        JOIN public.user_profiles up ON up.user_id = m.user_id AND up.status = 'active'
        WHERE m.user_id = auth.uid() AND m.organization_id = check_org
          AND m.role = 'admin' AND m.status = 'active'
    );
$$;

CREATE FUNCTION public.rbac_require_actor()
RETURNS uuid LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = pg_catalog, public AS $$
DECLARE actor uuid := auth.uid();
BEGIN
    IF actor IS NULL OR NOT EXISTS (
        SELECT 1 FROM public.user_profiles WHERE user_id = actor AND status = 'active'
    ) THEN RAISE EXCEPTION 'active authenticated profile required'; END IF;
    RETURN actor;
END;
$$;
CREATE FUNCTION public.rbac_require_super_admin()
RETURNS uuid LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = pg_catalog, public AS $$
DECLARE actor uuid := public.rbac_require_actor();
BEGIN
    IF NOT public.rbac_is_super_admin(actor) THEN RAISE EXCEPTION 'Super Admin permission required'; END IF;
    RETURN actor;
END;
$$;
CREATE FUNCTION public.rbac_require_org_admin(check_org uuid)
RETURNS uuid LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = pg_catalog, public AS $$
DECLARE actor uuid := public.rbac_require_actor();
BEGIN
    IF NOT public.rbac_is_org_admin(actor, check_org) THEN RAISE EXCEPTION 'active organization admin required'; END IF;
    RETURN actor;
END;
$$;
REVOKE ALL ON FUNCTION public.rbac_is_super_admin(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.rbac_has_active_membership(uuid, uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.rbac_is_org_admin(uuid, uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.rbac_require_actor() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.rbac_require_super_admin() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.rbac_require_org_admin(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.rbac_is_super_admin(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.rbac_has_active_membership(uuid, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.rbac_is_org_admin(uuid, uuid) TO authenticated;

CREATE FUNCTION public.rbac_safe_audit_metadata(input_value jsonb)
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
       AND input_value->>'resource_type' IN ('organization', 'user', 'membership') THEN
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
    RETURN output_value;
END;
$$;
REVOKE ALL ON FUNCTION public.rbac_safe_audit_metadata(jsonb) FROM PUBLIC, anon, authenticated;

CREATE FUNCTION public.rbac_audit(actor uuid, org uuid, event_action text, target_kind text, target_key text, event_metadata jsonb DEFAULT '{}'::jsonb)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog, public AS $$
DECLARE event_id uuid;
BEGIN
    INSERT INTO public.audit_events(actor_user_id, organization_id, action, target_type, target_id, metadata)
    VALUES (actor, org, event_action, target_kind, target_key, public.rbac_safe_audit_metadata(COALESCE(event_metadata, '{}'::jsonb)))
    RETURNING id INTO event_id;
    RETURN event_id;
END;
$$;
REVOKE ALL ON FUNCTION public.rbac_audit(uuid, uuid, text, text, text, jsonb) FROM PUBLIC, anon, authenticated;

-- RLS: organization operations are membership-scoped. These policies never apply to scans.
ALTER TABLE public.organizations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.organization_memberships ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.platform_roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.audit_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY organizations_read_scoped ON public.organizations FOR SELECT TO authenticated
USING (public.rbac_is_super_admin(auth.uid()) OR public.rbac_has_active_membership(auth.uid(), id));
CREATE POLICY user_profiles_read_self_or_related ON public.user_profiles FOR SELECT TO authenticated
USING (
    user_id = auth.uid() OR public.rbac_is_super_admin(auth.uid()) OR EXISTS (
        SELECT 1 FROM public.organization_memberships mine
        JOIN public.organization_memberships theirs ON theirs.organization_id = mine.organization_id
        WHERE mine.user_id = auth.uid() AND theirs.user_id = user_profiles.user_id
          AND mine.status = 'active' AND theirs.status = 'active'
          AND public.rbac_is_org_admin(auth.uid(), mine.organization_id)
    )
);
CREATE POLICY memberships_read_scoped ON public.organization_memberships FOR SELECT TO authenticated
USING (
    (user_id = auth.uid() AND status = 'active' AND public.rbac_has_active_membership(auth.uid(), organization_id))
    OR public.rbac_is_super_admin(auth.uid())
    OR public.rbac_is_org_admin(auth.uid(), organization_id)
);
CREATE POLICY platform_roles_read_self_or_super ON public.platform_roles FOR SELECT TO authenticated
USING (user_id = auth.uid() OR public.rbac_is_super_admin(auth.uid()));
CREATE POLICY audit_events_read_super_admin ON public.audit_events FOR SELECT TO authenticated
USING (public.rbac_is_super_admin(auth.uid()));

-- Explicitly deny direct writes; the RPC surface below is the only authenticated mutation path.
REVOKE ALL ON public.organizations, public.user_profiles, public.organization_memberships,
    public.platform_roles, public.audit_events FROM anon, authenticated;
GRANT SELECT ON public.organizations, public.user_profiles, public.organization_memberships,
    public.platform_roles, public.audit_events TO authenticated;

CREATE FUNCTION public.rbac_api_list_organizations()
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog, public AS $$
DECLARE actor uuid := public.rbac_require_super_admin();
DECLARE result jsonb;
BEGIN
    SELECT COALESCE(jsonb_agg(to_jsonb(o) ORDER BY o.created_at DESC), '[]'::jsonb) INTO result
    FROM public.organizations o;
    RETURN result;
END;
$$;
CREATE FUNCTION public.rbac_api_list_my_organizations()
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog, public AS $$
DECLARE actor uuid := public.rbac_require_actor();
DECLARE result jsonb;
BEGIN
    SELECT COALESCE(jsonb_agg(to_jsonb(o) ORDER BY o.created_at DESC), '[]'::jsonb) INTO result
    FROM public.organizations o JOIN public.organization_memberships m ON m.organization_id = o.id
    WHERE m.user_id = actor AND m.status = 'active' AND o.status = 'active';
    RETURN result;
END;
$$;
CREATE FUNCTION public.rbac_api_create_organization(org_name text, org_slug text, org_region text DEFAULT NULL, org_kabupaten text DEFAULT NULL)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog, public AS $$
DECLARE actor uuid := public.rbac_require_super_admin();
DECLARE result jsonb;
DECLARE new_org public.organizations;
BEGIN
    INSERT INTO public.organizations(name, slug, region, kabupaten)
    VALUES (btrim(org_name), lower(btrim(org_slug)), org_region, org_kabupaten) RETURNING * INTO new_org;
    PERFORM public.rbac_audit(actor, new_org.id, 'organization.create', 'organization', new_org.id::text,
        jsonb_build_object('slug', new_org.slug, 'status', new_org.status, 'resource_type', 'organization'));
    result := to_jsonb(new_org);
    RETURN result;
END;
$$;
CREATE FUNCTION public.rbac_api_get_organization(org_id uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog, public AS $$
DECLARE actor uuid := public.rbac_require_actor();
DECLARE result jsonb;
BEGIN
    IF NOT (public.rbac_is_super_admin(actor) OR public.rbac_has_active_membership(actor, org_id)) THEN
        RAISE EXCEPTION 'organization read permission required';
    END IF;
    SELECT to_jsonb(o) INTO result FROM public.organizations o WHERE o.id = org_id;
    RETURN result;
END;
$$;
CREATE FUNCTION public.rbac_api_update_organization(org_id uuid, org_name text DEFAULT NULL, org_slug text DEFAULT NULL, org_region text DEFAULT NULL, org_kabupaten text DEFAULT NULL)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog, public AS $$
DECLARE actor uuid := public.rbac_require_actor();
DECLARE updated_org public.organizations;
DECLARE event_action text;
BEGIN
    IF org_name IS NULL AND org_slug IS NULL AND org_region IS NULL AND org_kabupaten IS NULL THEN
        RAISE EXCEPTION 'organization update payload is empty';
    END IF;
    IF NOT (public.rbac_is_super_admin(actor) OR public.rbac_is_org_admin(actor, org_id)) THEN
        RAISE EXCEPTION 'organization update permission required';
    END IF;
    UPDATE public.organizations SET name = COALESCE(btrim(org_name), name), slug = COALESCE(lower(btrim(org_slug)), slug),
        region = COALESCE(org_region, region), kabupaten = COALESCE(org_kabupaten, kabupaten)
    WHERE id = org_id RETURNING * INTO updated_org;
    IF NOT FOUND THEN RETURN NULL; END IF;
    event_action := 'organization.update';
    PERFORM public.rbac_audit(actor, org_id, event_action, 'organization', org_id::text,
        jsonb_build_object('slug', updated_org.slug, 'changed_fields', jsonb_build_array('name', 'slug', 'region', 'kabupaten'), 'resource_type', 'organization'));
    RETURN to_jsonb(updated_org);
END;
$$;
CREATE FUNCTION public.rbac_api_set_organization_status(org_id uuid, new_status text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog, public AS $$
DECLARE actor uuid := public.rbac_require_super_admin();
DECLARE updated_org public.organizations;
DECLARE event_action text;
BEGIN
    IF new_status NOT IN ('active', 'suspended') THEN RAISE EXCEPTION 'invalid organization status'; END IF;
    UPDATE public.organizations SET status = new_status WHERE id = org_id RETURNING * INTO updated_org;
    IF NOT FOUND THEN RETURN NULL; END IF;
    event_action := CASE WHEN new_status = 'suspended' THEN 'organization.suspend' ELSE 'organization.reactivate' END;
    PERFORM public.rbac_audit(actor, org_id, event_action, 'organization', org_id::text,
        jsonb_build_object('status', new_status, 'resource_type', 'organization'));
    RETURN to_jsonb(updated_org);
END;
$$;
CREATE FUNCTION public.rbac_api_list_members(org_id uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog, public AS $$
DECLARE actor uuid := public.rbac_require_actor();
DECLARE result jsonb;
BEGIN
    IF NOT (public.rbac_is_super_admin(actor) OR public.rbac_is_org_admin(actor, org_id)) THEN
        RAISE EXCEPTION 'member list permission required';
    END IF;
    SELECT COALESCE(jsonb_agg(jsonb_build_object(
        'id', m.id, 'organization_id', m.organization_id, 'user_id', m.user_id,
        'role', m.role, 'status', m.status, 'full_name', p.full_name,
        'user_status', p.status, 'created_at', m.created_at
    ) ORDER BY m.created_at), '[]'::jsonb) INTO result
    FROM public.organization_memberships m JOIN public.user_profiles p ON p.user_id = m.user_id
    WHERE m.organization_id = org_id;
    RETURN result;
END;
$$;
CREATE FUNCTION public.rbac_api_assign_membership(org_id uuid, target_user_id uuid, new_role text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog, public AS $$
DECLARE actor uuid := public.rbac_require_actor();
DECLARE result public.organization_memberships;
DECLARE target_status text;
BEGIN
    IF new_role NOT IN ('admin', 'farmer', 'merchant') THEN RAISE EXCEPTION 'invalid organization role'; END IF;
    IF NOT (public.rbac_is_super_admin(actor) OR public.rbac_is_org_admin(actor, org_id)) THEN
        RAISE EXCEPTION 'membership assignment permission required';
    END IF;
    IF NOT public.rbac_is_super_admin(actor) AND (new_role = 'admin' OR target_user_id = actor) THEN
        RAISE EXCEPTION 'organization admin cannot grant admin or change self';
    END IF;
    IF NOT public.rbac_is_super_admin(actor) AND EXISTS (
        SELECT 1 FROM public.organization_memberships
        WHERE organization_id = org_id AND user_id = target_user_id AND status = 'active' AND role = 'admin'
    ) THEN RAISE EXCEPTION 'organization admin cannot alter another admin'; END IF;
    SELECT status INTO target_status FROM public.user_profiles WHERE user_id = target_user_id FOR UPDATE;
    IF NOT FOUND THEN RAISE EXCEPTION 'target profile not found'; END IF;
    IF target_status = 'suspended' THEN RAISE EXCEPTION 'suspended user cannot be assigned'; END IF;
    UPDATE public.user_profiles SET status = 'active' WHERE user_id = target_user_id AND status = 'pending_assignment';
    INSERT INTO public.organization_memberships(organization_id, user_id, role, status)
    VALUES (org_id, target_user_id, new_role, 'active')
    RETURNING * INTO result;
    PERFORM public.rbac_audit(actor, org_id, 'membership.assign', 'membership', result.id::text,
        jsonb_build_object('role', result.role, 'status', result.status, 'resource_type', 'membership'));
    RETURN to_jsonb(result);
END;
$$;
CREATE FUNCTION public.rbac_api_change_membership(org_id uuid, membership_id uuid, new_role text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog, public AS $$
DECLARE actor uuid := public.rbac_require_actor();
DECLARE result public.organization_memberships;
BEGIN
    IF new_role NOT IN ('admin', 'farmer', 'merchant') THEN RAISE EXCEPTION 'invalid organization role'; END IF;
    IF NOT (public.rbac_is_super_admin(actor) OR public.rbac_is_org_admin(actor, org_id)) THEN
        RAISE EXCEPTION 'membership update permission required';
    END IF;
    IF NOT public.rbac_is_super_admin(actor) AND (new_role = 'admin' OR EXISTS (
        SELECT 1 FROM public.organization_memberships
        WHERE id = membership_id AND organization_id = org_id AND status = 'active'
          AND (user_id = actor OR role = 'admin')
    )) THEN RAISE EXCEPTION 'organization admin cannot alter admin or self'; END IF;
    UPDATE public.organization_memberships SET role = new_role
    WHERE id = membership_id AND organization_id = org_id AND status = 'active'
      AND (public.rbac_is_super_admin(actor) OR (role <> 'admin' AND user_id <> actor))
    RETURNING * INTO result;
    IF NOT FOUND THEN RETURN NULL; END IF;
    PERFORM public.rbac_audit(actor, org_id, 'membership.role_changed', 'membership', result.id::text,
        jsonb_build_object('role', result.role, 'status', result.status, 'resource_type', 'membership'));
    RETURN to_jsonb(result);
END;
$$;
CREATE FUNCTION public.rbac_api_revoke_membership(org_id uuid, membership_id uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog, public AS $$
DECLARE actor uuid := public.rbac_require_actor();
DECLARE result public.organization_memberships;
BEGIN
    IF NOT (public.rbac_is_super_admin(actor) OR public.rbac_is_org_admin(actor, org_id)) THEN
        RAISE EXCEPTION 'membership revoke permission required';
    END IF;
    UPDATE public.organization_memberships SET status = 'revoked'
    WHERE id = membership_id AND organization_id = org_id AND status = 'active'
      AND (public.rbac_is_super_admin(actor) OR (user_id <> actor AND role <> 'admin'))
    RETURNING * INTO result;
    IF NOT FOUND THEN RETURN NULL; END IF;
    PERFORM public.rbac_audit(actor, org_id, 'membership.revoke', 'membership', result.id::text,
        jsonb_build_object('role', result.role, 'status', result.status, 'resource_type', 'membership'));
    RETURN to_jsonb(result);
END;
$$;
CREATE FUNCTION public.rbac_api_list_users(page_limit integer DEFAULT 50, page_offset integer DEFAULT 0)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog, public AS $$
DECLARE actor uuid := public.rbac_require_super_admin();
DECLARE result jsonb;
BEGIN
    IF page_limit < 1 OR page_limit > 200 OR page_offset < 0 THEN RAISE EXCEPTION 'invalid pagination'; END IF;
    SELECT COALESCE(jsonb_agg(jsonb_build_object(
        'user_id', p.user_id, 'full_name', p.full_name, 'status', p.status,
        'platform_role', (SELECT pr.role FROM public.platform_roles pr WHERE pr.user_id = p.user_id),
        'created_at', p.created_at,
        'memberships', COALESCE((SELECT jsonb_agg(jsonb_build_object('organization_id', m.organization_id, 'role', m.role, 'status', m.status))
            FROM public.organization_memberships m WHERE m.user_id = p.user_id), '[]'::jsonb)
    ) ORDER BY p.created_at DESC), '[]'::jsonb) INTO result
    FROM (SELECT * FROM public.user_profiles ORDER BY created_at DESC LIMIT page_limit OFFSET page_offset) p;
    RETURN result;
END;
$$;
CREATE FUNCTION public.rbac_api_set_user_status(target_user_id uuid, new_status text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog, public AS $$
DECLARE actor uuid := public.rbac_require_super_admin();
DECLARE result public.user_profiles;
BEGIN
    IF new_status NOT IN ('active', 'suspended', 'pending_assignment') THEN RAISE EXCEPTION 'invalid user status'; END IF;
    IF target_user_id = actor AND new_status <> 'active' THEN RAISE EXCEPTION 'cannot suspend self'; END IF;
    IF new_status <> 'active' AND EXISTS (SELECT 1 FROM public.platform_roles WHERE user_id = target_user_id AND role = 'super_admin') THEN
        PERFORM pg_advisory_xact_lock(hashtext('agri_sort_last_super_admin'));
        IF (SELECT count(*) FROM public.platform_roles pr JOIN public.user_profiles up ON up.user_id = pr.user_id
            WHERE pr.role = 'super_admin' AND up.status = 'active' AND pr.user_id <> target_user_id) = 0 THEN
            RAISE EXCEPTION 'cannot suspend last active Super Admin';
        END IF;
    END IF;
    UPDATE public.user_profiles SET status = new_status WHERE user_id = target_user_id RETURNING * INTO result;
    IF NOT FOUND THEN RETURN NULL; END IF;
    PERFORM public.rbac_audit(actor, NULL,
        CASE WHEN new_status = 'suspended' THEN 'user.suspend' ELSE 'user.reactivate' END,
        'user', target_user_id::text, jsonb_build_object('status', new_status, 'resource_type', 'user'));
    RETURN to_jsonb(result);
END;
$$;
CREATE FUNCTION public.rbac_api_list_audit_events(org_id uuid DEFAULT NULL, page_limit integer DEFAULT 50, page_offset integer DEFAULT 0)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog, public AS $$
DECLARE actor uuid := public.rbac_require_super_admin();
DECLARE result jsonb;
BEGIN
    IF page_limit < 1 OR page_limit > 200 OR page_offset < 0 THEN RAISE EXCEPTION 'invalid pagination'; END IF;
    SELECT COALESCE(jsonb_agg(to_jsonb(e) ORDER BY e.created_at DESC), '[]'::jsonb) INTO result
    FROM (SELECT * FROM public.audit_events WHERE org_id IS NULL OR organization_id = org_id
        ORDER BY created_at DESC LIMIT page_limit OFFSET page_offset) e;
    RETURN result;
END;
$$;

-- Bootstrap is a one-time operator-only action; it cannot be called by API roles.
CREATE FUNCTION public.rbac_bootstrap_super_admin(operator_actor_id uuid, target_user_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog, public AS $$
BEGIN
    IF session_user NOT IN ('postgres', 'supabase_admin') THEN RAISE EXCEPTION 'operator database role required'; END IF;
    IF operator_actor_id = target_user_id THEN RAISE EXCEPTION 'bootstrap actor cannot promote self'; END IF;
    IF NOT EXISTS (SELECT 1 FROM auth.users WHERE id = target_user_id) THEN RAISE EXCEPTION 'target Auth user not found'; END IF;
    IF NOT EXISTS (SELECT 1 FROM public.user_profiles WHERE user_id = operator_actor_id AND status = 'active') THEN RAISE EXCEPTION 'active operator audit identity required'; END IF;
    PERFORM pg_advisory_xact_lock(hashtext('agri_sort_last_super_admin'));
    INSERT INTO public.user_profiles(user_id, full_name, status) VALUES (target_user_id, '', 'active')
    ON CONFLICT (user_id) DO UPDATE SET status = 'active';
    INSERT INTO public.platform_roles(user_id, role) VALUES (target_user_id, 'super_admin');
    PERFORM public.rbac_audit(operator_actor_id, NULL, 'super_admin.bootstrap', 'user', target_user_id::text,
        jsonb_build_object('role', 'super_admin', 'resource_type', 'user'));
END;
$$;

-- Last active Super Admin cannot be demoted, deleted, or suspended.
CREATE FUNCTION public.rbac_protect_last_super_admin()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog, public AS $$
DECLARE active_count bigint;
BEGIN
    IF OLD.role = 'super_admin' AND (TG_OP = 'DELETE' OR NEW.role IS DISTINCT FROM OLD.role) THEN
        PERFORM pg_advisory_xact_lock(hashtext('agri_sort_last_super_admin'));
        SELECT count(*) INTO active_count FROM public.platform_roles pr
        JOIN public.user_profiles up ON up.user_id = pr.user_id
        WHERE pr.role = 'super_admin' AND up.status = 'active' AND pr.user_id <> OLD.user_id;
        IF active_count = 0 THEN RAISE EXCEPTION 'cannot remove or demote last active Super Admin'; END IF;
    END IF;
    IF TG_OP = 'DELETE' THEN RETURN OLD; END IF;
    RETURN NEW;
END;
$$;
CREATE TRIGGER platform_roles_protect_last_super_admin BEFORE UPDATE OR DELETE ON public.platform_roles
FOR EACH ROW EXECUTE FUNCTION public.rbac_protect_last_super_admin();
CREATE FUNCTION public.rbac_protect_last_super_admin_profile()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog, public AS $$
DECLARE active_count bigint;
BEGIN
    IF OLD.status = 'active' AND NEW.status <> 'active' AND EXISTS (
        SELECT 1 FROM public.platform_roles WHERE user_id = OLD.user_id AND role = 'super_admin'
    ) THEN
        PERFORM pg_advisory_xact_lock(hashtext('agri_sort_last_super_admin'));
        SELECT count(*) INTO active_count FROM public.platform_roles pr
        JOIN public.user_profiles up ON up.user_id = pr.user_id
        WHERE pr.role = 'super_admin' AND up.status = 'active' AND pr.user_id <> OLD.user_id;
        IF active_count = 0 THEN RAISE EXCEPTION 'cannot suspend last active Super Admin'; END IF;
    END IF;
    RETURN NEW;
END;
$$;
CREATE TRIGGER user_profiles_protect_last_super_admin BEFORE UPDATE OF status ON public.user_profiles
FOR EACH ROW EXECUTE FUNCTION public.rbac_protect_last_super_admin_profile();

-- API roles may execute only the named RPCs; security-definer helpers remain private.
REVOKE ALL ON FUNCTION public.rbac_api_list_organizations() FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.rbac_api_list_my_organizations() FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.rbac_api_create_organization(text, text, text, text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.rbac_api_get_organization(uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.rbac_api_update_organization(uuid, text, text, text, text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.rbac_api_set_organization_status(uuid, text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.rbac_api_list_members(uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.rbac_api_assign_membership(uuid, uuid, text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.rbac_api_change_membership(uuid, uuid, text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.rbac_api_revoke_membership(uuid, uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.rbac_api_list_users(integer, integer) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.rbac_api_set_user_status(uuid, text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.rbac_api_list_audit_events(uuid, integer, integer) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.rbac_bootstrap_super_admin(uuid, uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.rbac_api_list_organizations() TO authenticated;
GRANT EXECUTE ON FUNCTION public.rbac_api_list_my_organizations() TO authenticated;
GRANT EXECUTE ON FUNCTION public.rbac_api_create_organization(text, text, text, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.rbac_api_get_organization(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.rbac_api_update_organization(uuid, text, text, text, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.rbac_api_set_organization_status(uuid, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.rbac_api_list_members(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.rbac_api_assign_membership(uuid, uuid, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.rbac_api_change_membership(uuid, uuid, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.rbac_api_revoke_membership(uuid, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.rbac_api_list_users(integer, integer) TO authenticated;
GRANT EXECUTE ON FUNCTION public.rbac_api_set_user_status(uuid, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.rbac_api_list_audit_events(uuid, integer, integer) TO authenticated;

COMMIT;
