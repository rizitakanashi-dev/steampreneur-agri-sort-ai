"""Disposable PostgreSQL integration tests for RBAC and scan DDL safety.

These tests execute the real SQL against a temporary local cluster. They do not
connect to Supabase or any shared database. PostgreSQL server tools are required;
without them the suite reports skipped (blocked), never substitutes mocks.
"""

import os
from pathlib import Path
import shutil
import subprocess
import tempfile
import unittest

from server.services.storage_service import get_supabase_ddl


REPO_ROOT = Path(__file__).resolve().parents[2]
RBAC_MIGRATION = REPO_ROOT / "supabase/migrations/20261124000100_org_rbac.sql"
RBAC_RETENTION_MIGRATION = REPO_ROOT / "supabase/migrations/20261124000200_org_rbac_retention.sql"
POSTGRES_TOOLS = ("initdb", "pg_ctl", "psql")


def _run(command, *, input_text=None, check=True):
    return subprocess.run(
        command,
        input=input_text,
        text=True,
        stdout=subprocess.PIPE,
        stderr=subprocess.STDOUT,
        check=check,
        env={**os.environ, "PGOPTIONS": "-c timezone=UTC"},
    )


@unittest.skipUnless(all(shutil.which(tool) for tool in POSTGRES_TOOLS), "PostgreSQL server/client tools unavailable")
class TestDisposablePostgresMigrationSafety(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.temp = tempfile.TemporaryDirectory(prefix="agri-migration-pg-")
        cls.root = Path(cls.temp.name)
        cls.data = cls.root / "data"
        cls.socket = cls.root / "socket"
        cls.socket.mkdir()
        init = _run([shutil.which("initdb"), "-D", str(cls.data), "--auth-local=trust", "--auth-host=trust", "--username=postgres"])
        cls.port = "55471"
        _run([
            shutil.which("pg_ctl"), "-D", str(cls.data), "-o",
            f"-F -k {cls.socket} -p {cls.port} -h ''", "-l", str(cls.root / "postgres.log"), "start",
        ])
        cls.psql = [
            shutil.which("psql"), "-X", "-A", "-t", "-h", str(cls.socket), "-p", cls.port,
            "-U", "postgres", "-d", "postgres", "-v", "ON_ERROR_STOP=1",
        ]
        cls._sql("""
            CREATE ROLE anon NOLOGIN;
            CREATE ROLE authenticated NOLOGIN;
            CREATE ROLE service_role NOLOGIN BYPASSRLS;
            CREATE SCHEMA auth;
            CREATE TABLE auth.users (id uuid PRIMARY KEY, email text);
            CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS $$
                SELECT nullif(current_setting('request.jwt.claim.sub', true), '')::uuid
            $$;
            GRANT USAGE ON SCHEMA auth TO anon, authenticated;
            GRANT EXECUTE ON FUNCTION auth.uid() TO anon, authenticated;
        """)

    @classmethod
    def tearDownClass(cls):
        try:
            _run([shutil.which("pg_ctl"), "-D", str(cls.data), "-m", "fast", "stop"], check=False)
        finally:
            cls.temp.cleanup()

    @classmethod
    def _sql(cls, sql, *, check=True):
        return _run(cls.psql, input_text=sql, check=check)

    def setUp(self):
        self._sql("DROP SCHEMA public CASCADE; CREATE SCHEMA public; GRANT ALL ON SCHEMA public TO PUBLIC;")
        self._sql("""
            DROP SCHEMA auth CASCADE;
            CREATE SCHEMA auth;
            CREATE TABLE auth.users (id uuid PRIMARY KEY, email text);
            CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS $$
                SELECT nullif(current_setting('request.jwt.claim.sub', true), '')::uuid
            $$;
            GRANT USAGE ON SCHEMA auth TO anon, authenticated;
            GRANT EXECUTE ON FUNCTION auth.uid() TO anon, authenticated;
            GRANT USAGE ON SCHEMA public TO anon, authenticated;
        """)

    def apply_rbac(self, *, check=True):
        base = _run([*self.psql, "-f", str(RBAC_MIGRATION)], check=check)
        if base.returncode != 0:
            return base
        return _run([*self.psql, "-f", str(RBAC_RETENTION_MIGRATION)], check=check)

    def test_fresh_rbac_migration_enforces_constraints_grants_and_rls(self):
        self._sql("""
            INSERT INTO auth.users(id,email) VALUES
              ('00000000-0000-0000-0000-000000000001','operator@example.test'),
              ('00000000-0000-0000-0000-000000000002','org-admin@example.test'),
              ('00000000-0000-0000-0000-000000000003','farmer@example.test'),
              ('00000000-0000-0000-0000-000000000004','outsider@example.test');
        """)
        self.apply_rbac()
        self._sql("""
            INSERT INTO public.organizations(id,name,slug) VALUES
              ('10000000-0000-0000-0000-000000000001','Org One','org-one'),
              ('10000000-0000-0000-0000-000000000002','Org Two','org-two');
            UPDATE public.user_profiles SET status='active'
              WHERE user_id IN ('00000000-0000-0000-0000-000000000001','00000000-0000-0000-0000-000000000002','00000000-0000-0000-0000-000000000003','00000000-0000-0000-0000-000000000004');
            INSERT INTO public.platform_roles(user_id,role) VALUES ('00000000-0000-0000-0000-000000000001','super_admin');
            INSERT INTO public.organization_memberships(organization_id,user_id,role,status) VALUES
              ('10000000-0000-0000-0000-000000000001','00000000-0000-0000-0000-000000000002','admin','active'),
              ('10000000-0000-0000-0000-000000000001','00000000-0000-0000-0000-000000000003','farmer','active');
        """)
        catalog = self._sql("""
            SELECT c.relname || ':' || c.relrowsecurity || ':' || c.relforcerowsecurity
            FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
            WHERE n.nspname='public' AND c.relname IN
              ('organizations','user_profiles','organization_memberships','platform_roles','audit_events')
            ORDER BY c.relname;
            SELECT count(*) FROM public.user_profiles;
            SELECT has_function_privilege('anon','public.rbac_api_list_organizations()','EXECUTE');
            SELECT has_function_privilege('authenticated','public.rbac_api_list_organizations()','EXECUTE');
            SELECT has_function_privilege('authenticated','public.rbac_bootstrap_super_admin(uuid,uuid)','EXECUTE');
            SELECT has_table_privilege('authenticated','public.organizations','INSERT');
            SELECT has_table_privilege('service_role','public.organizations','SELECT');
            SELECT has_function_privilege('service_role','public.rbac_api_list_organizations()','EXECUTE');
        """).stdout
        self.assertIn("organizations:true:false", catalog)
        self.assertIn("user_profiles:true:false", catalog)
        self.assertIn("4", catalog)
        self.assertEqual(catalog.splitlines()[-6:], ["f", "t", "f", "f", "f", "f"])
        policy_matrix = self._sql("""
            SELECT tablename || ':' || cmd || ':' || array_to_string(roles, ',')
            FROM pg_policies WHERE schemaname='public'
            ORDER BY tablename, cmd;
        """).stdout.splitlines()
        self.assertEqual(policy_matrix, [
            "account_exports:SELECT:authenticated",
            "audit_events:SELECT:authenticated",
            "organization_memberships:SELECT:authenticated",
            "organizations:SELECT:authenticated",
            "platform_roles:SELECT:authenticated",
            "user_profiles:SELECT:authenticated",
        ])

        invalid_role = self._sql("""
            INSERT INTO public.organization_memberships(organization_id,user_id,role,status)
            VALUES ('10000000-0000-0000-0000-000000000001','00000000-0000-0000-0000-000000000003','super_admin','active');
        """, check=False)
        self.assertNotEqual(invalid_role.returncode, 0)
        duplicate = self._sql("""
            INSERT INTO public.organization_memberships(organization_id,user_id,role,status)
            VALUES ('10000000-0000-0000-0000-000000000001','00000000-0000-0000-0000-000000000003','merchant','active');
        """, check=False)
        self.assertNotEqual(duplicate.returncode, 0)

        escalation = self._sql("""
            SET ROLE authenticated;
            SELECT set_config('request.jwt.claim.sub','00000000-0000-0000-0000-000000000003',false);
            SELECT public.rbac_api_assign_membership(
              '10000000-0000-0000-0000-000000000001',
              '00000000-0000-0000-0000-000000000004', 'admin'
            );
        """, check=False)
        self.assertNotEqual(escalation.returncode, 0)

    def test_second_rbac_apply_fails_closed_without_changing_applied_schema(self):
        self._sql("INSERT INTO auth.users(id,email) VALUES ('00000000-0000-0000-0000-000000000001','u@example.test');")
        self.apply_rbac()
        before = self._sql("""
            SELECT (SELECT count(*) FROM public.user_profiles),
                   (SELECT count(*) FROM pg_policy WHERE polrelid='public.organizations'::regclass),
                   (SELECT count(*) FROM pg_proc WHERE pronamespace='public'::regnamespace AND proname LIKE 'rbac_api_%');
        """).stdout
        retry = self.apply_rbac(check=False)
        self.assertNotEqual(retry.returncode, 0)
        self.assertIn("already exists; inspect and reconcile schema before applying", retry.stdout)
        after = self._sql("""
            SELECT (SELECT count(*) FROM public.user_profiles),
                   (SELECT count(*) FROM pg_policy WHERE polrelid='public.organizations'::regclass),
                   (SELECT count(*) FROM pg_proc WHERE pronamespace='public'::regnamespace AND proname LIKE 'rbac_api_%');
        """).stdout
        self.assertEqual(before, after)

    def test_forward_migration_reapply_fails_closed(self):
        self.apply_rbac()
        retry = _run([*self.psql, "-f", str(RBAC_RETENTION_MIGRATION)], check=False)
        self.assertNotEqual(retry.returncode, 0)
        self.assertIn('account_exports already exists', retry.stdout)
        remaining = self._sql("SELECT to_regclass('public.account_exports') IS NOT NULL;")
        self.assertEqual(remaining.stdout.strip(), 't')

    def test_compatible_existing_rbac_table_is_not_adopted_or_modified(self):
        self._sql("""
            CREATE TABLE public.organizations (
              id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
              name text NOT NULL CHECK (length(btrim(name)) BETWEEN 1 AND 160),
              slug text NOT NULL UNIQUE CHECK (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
              status text NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'suspended')),
              region text, kabupaten text, created_at timestamptz NOT NULL DEFAULT now(),
              updated_at timestamptz NOT NULL DEFAULT now()
            );
            INSERT INTO public.organizations(name,slug) VALUES ('Existing','existing');
        """)
        result = self.apply_rbac(check=False)
        self.assertNotEqual(result.returncode, 0)
        self.assertIn("public.organizations already exists", result.stdout)
        state = self._sql("""
            SELECT count(*) FROM public.organizations WHERE slug='existing';
            SELECT to_regclass('public.user_profiles') IS NULL;
            SELECT count(*) FROM pg_constraint WHERE conrelid='public.organizations'::regclass AND contype IN ('p','u');
        """).stdout
        self.assertEqual([line for line in state.splitlines() if line], ["1", "t", "2"])

    def test_incompatible_existing_rbac_table_is_rejected_without_replacement(self):
        self._sql("CREATE TABLE public.organizations (id text PRIMARY KEY, private_note text); INSERT INTO public.organizations VALUES ('keep','preserve');")
        result = self.apply_rbac(check=False)
        self.assertNotEqual(result.returncode, 0)
        self.assertIn("public.organizations already exists", result.stdout)
        preserved = self._sql("SELECT id || ':' || private_note FROM public.organizations;").stdout
        self.assertIn("keep:preserve", preserved)
        columns = self._sql("SELECT string_agg(column_name,',' ORDER BY ordinal_position) FROM information_schema.columns WHERE table_schema='public' AND table_name='organizations';").stdout
        self.assertIn("id,private_note", columns)

    def test_scans_ddl_preserves_legacy_rows_and_global_unique_constraint(self):
        self._sql("""
            CREATE TABLE public.scans (
              id uuid PRIMARY KEY DEFAULT gen_random_uuid(), scan_id varchar(64) NOT NULL UNIQUE,
              user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
              commodity varchar(100) NOT NULL, ai_supported boolean NOT NULL DEFAULT true,
              actual_weight_kg numeric(8,2), total_objects integer NOT NULL DEFAULT 0,
              fresh_count integer NOT NULL DEFAULT 0, rotten_count integer NOT NULL DEFAULT 0,
              fresh_ratio_percent numeric(5,2) NOT NULL DEFAULT 0,
              rotten_ratio_percent numeric(5,2) NOT NULL DEFAULT 0,
              reference_price_per_kg integer NOT NULL DEFAULT 0, estimated_economic_value bigint,
              potential_loss_value bigint, recommendation_note text, is_simulated boolean NOT NULL DEFAULT false,
              model_version varchar(50), created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now()
            );
            INSERT INTO public.scans(scan_id,commodity,recommendation_note) VALUES ('legacy-1','Tomat','do not remove');
            ALTER TABLE public.scans ENABLE ROW LEVEL SECURITY;
            CREATE POLICY "Akses publik baca riwayat scan" ON public.scans FOR SELECT USING (true);
            CREATE POLICY "Akses publik simpan riwayat scan" ON public.scans FOR INSERT WITH CHECK (true);
        """)
        _run(self.psql, input_text=get_supabase_ddl())
        catalog = self._sql("""
            SELECT conname || ':' || contype::text FROM pg_constraint WHERE conrelid='public.scans'::regclass ORDER BY conname;
            SELECT count(*) || ':' || coalesce(max(recommendation_note),'') FROM public.scans WHERE scan_id='legacy-1';
            SELECT policyname || ':' || cmd || ':' || coalesce(qual,'') || ':' || coalesce(with_check,'')
              FROM pg_policies WHERE schemaname='public' AND tablename='scans' ORDER BY policyname;
        """).stdout
        self.assertIn("scans_scan_id_key:u", catalog)
        self.assertIn("1:do not remove", catalog)
        self.assertNotIn("Akses publik", catalog)
        self.assertIn("Users read own scan history:SELECT:(auth.uid() = user_id):", catalog)
        self.assertIn("Users insert own scan history:INSERT::(auth.uid() = user_id)", catalog)
        self.assertIn("Users update own scan history:UPDATE:(auth.uid() = user_id):(auth.uid() = user_id)", catalog)
        self.assertIn("Users delete own scan history:DELETE:(auth.uid() = user_id):", catalog)
        self.assertIn("scans_user_id_fkey:f", catalog)
        self.assertIn("scans_user_id_fkey_delete_action:c", self._sql("SELECT conname || '_delete_action:' || confdeltype::text FROM pg_constraint WHERE conrelid='public.scans'::regclass AND conname='scans_user_id_fkey';").stdout)

    def test_scans_ddl_rejects_incompatible_user_foreign_key_without_rewriting_it(self):
        self._sql("""
            CREATE TABLE public.other_users(id uuid PRIMARY KEY);
            CREATE TABLE public.scans (
              id uuid PRIMARY KEY DEFAULT gen_random_uuid(), scan_id varchar(64) NOT NULL UNIQUE,
              user_id uuid REFERENCES public.other_users(id) ON DELETE CASCADE,
              commodity varchar(100) NOT NULL, ai_supported boolean NOT NULL DEFAULT true,
              actual_weight_kg numeric(8,2), total_objects integer NOT NULL DEFAULT 0,
              fresh_count integer NOT NULL DEFAULT 0, rotten_count integer NOT NULL DEFAULT 0,
              fresh_ratio_percent numeric(5,2) NOT NULL DEFAULT 0,
              rotten_ratio_percent numeric(5,2) NOT NULL DEFAULT 0,
              reference_price_per_kg integer NOT NULL DEFAULT 0, estimated_economic_value bigint,
              potential_loss_value bigint, recommendation_note text, is_simulated boolean NOT NULL DEFAULT false,
              model_version varchar(50), created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now()
            );
        """)
        result = _run(self.psql, input_text=get_supabase_ddl(), check=False)
        self.assertNotEqual(result.returncode, 0)
        self.assertIn("existing user_id foreign key does not reference auth.users(id)", result.stdout)
        target = self._sql("""
            SELECT confrelid::regclass::text || ':' || confdeltype::text
            FROM pg_constraint WHERE conrelid='public.scans'::regclass AND conname='scans_user_id_fkey';
        """).stdout
        self.assertEqual(target.splitlines(), ["other_users:c"])

    def test_scans_ddl_rejects_same_name_incompatible_index_without_dropping_it(self):
        self._sql("""
            CREATE TABLE public.scans (
              id uuid PRIMARY KEY DEFAULT gen_random_uuid(), scan_id varchar(64) NOT NULL UNIQUE,
              user_id uuid REFERENCES auth.users(id) ON DELETE RESTRICT,
              commodity varchar(100) NOT NULL, ai_supported boolean NOT NULL DEFAULT true,
              actual_weight_kg numeric(8,2), total_objects integer NOT NULL DEFAULT 0,
              fresh_count integer NOT NULL DEFAULT 0, rotten_count integer NOT NULL DEFAULT 0,
              fresh_ratio_percent numeric(5,2) NOT NULL DEFAULT 0,
              rotten_ratio_percent numeric(5,2) NOT NULL DEFAULT 0,
              reference_price_per_kg integer NOT NULL DEFAULT 0, estimated_economic_value bigint,
              potential_loss_value bigint, recommendation_note text, is_simulated boolean NOT NULL DEFAULT false,
              model_version varchar(50), created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now()
            );
            CREATE INDEX idx_scans_commodity ON public.scans(scan_id);
        """)
        result = _run(self.psql, input_text=get_supabase_ddl(), check=False)
        self.assertNotEqual(result.returncode, 0)
        self.assertIn("index public.idx_scans_commodity has an incompatible definition", result.stdout)
        actual = self._sql("SELECT pg_get_indexdef('public.idx_scans_commodity'::regclass);").stdout
        self.assertIn("(scan_id)", actual)
        self.assertNotIn("idx_scans_created_at", self._sql("SELECT to_regclass('public.idx_scans_created_at');").stdout)

    def test_scans_ddl_is_idempotent_after_success(self):
        self._sql("""
            CREATE TABLE public.scans (
              id uuid PRIMARY KEY DEFAULT gen_random_uuid(), scan_id varchar(64) NOT NULL UNIQUE,
              user_id uuid REFERENCES auth.users(id) ON DELETE RESTRICT,
              commodity varchar(100) NOT NULL, ai_supported boolean NOT NULL DEFAULT true,
              actual_weight_kg numeric(8,2), total_objects integer NOT NULL DEFAULT 0,
              fresh_count integer NOT NULL DEFAULT 0, rotten_count integer NOT NULL DEFAULT 0,
              fresh_ratio_percent numeric(5,2) NOT NULL DEFAULT 0,
              rotten_ratio_percent numeric(5,2) NOT NULL DEFAULT 0,
              reference_price_per_kg integer NOT NULL DEFAULT 0, estimated_economic_value bigint,
              potential_loss_value bigint, recommendation_note text, is_simulated boolean NOT NULL DEFAULT false,
              model_version varchar(50), created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now()
            );
            INSERT INTO auth.users(id,email) VALUES ('00000000-0000-0000-0000-000000000001','owner@example.test');
            INSERT INTO public.scans(scan_id,commodity,user_id) VALUES ('repeat','Tomat','00000000-0000-0000-0000-000000000001');
        """)
        for _ in range(2):
            _run(self.psql, input_text=get_supabase_ddl())
        state = self._sql("""
            SELECT count(*) FROM public.scans WHERE scan_id='repeat';
            SELECT count(*) FROM pg_policies WHERE schemaname='public' AND tablename='scans';
            SELECT count(*) FROM pg_constraint WHERE conrelid='public.scans'::regclass AND conname='scans_scan_id_key';
        """).stdout
        self.assertEqual([line for line in state.splitlines() if line], ["1", "4", "1"])

    def test_scans_ddl_is_atomic_on_unknown_existing_policy(self):
        self._sql("""
            CREATE TABLE public.scans (
              id uuid PRIMARY KEY DEFAULT gen_random_uuid(), scan_id varchar(64) NOT NULL UNIQUE,
              user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
              commodity varchar(100) NOT NULL, ai_supported boolean NOT NULL DEFAULT true,
              actual_weight_kg numeric(8,2), total_objects integer NOT NULL DEFAULT 0,
              fresh_count integer NOT NULL DEFAULT 0, rotten_count integer NOT NULL DEFAULT 0,
              fresh_ratio_percent numeric(5,2) NOT NULL DEFAULT 0,
              rotten_ratio_percent numeric(5,2) NOT NULL DEFAULT 0,
              reference_price_per_kg integer NOT NULL DEFAULT 0, estimated_economic_value bigint,
              potential_loss_value bigint, recommendation_note text, is_simulated boolean NOT NULL DEFAULT false,
              model_version varchar(50), created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now()
            );
            INSERT INTO public.scans(scan_id,commodity) VALUES ('keep','Tomat');
            ALTER TABLE public.scans ENABLE ROW LEVEL SECURITY;
            CREATE POLICY legacy_unreviewed_open ON public.scans FOR SELECT TO authenticated USING (true);
        """)
        result = _run(self.psql, input_text=get_supabase_ddl(), check=False)
        self.assertNotEqual(result.returncode, 0)
        self.assertIn("unrecognized existing scans policy", result.stdout)
        catalog = self._sql("""
            SELECT count(*) FROM public.scans WHERE scan_id='keep';
            SELECT policyname FROM pg_policies WHERE schemaname='public' AND tablename='scans';
            SELECT EXISTS(SELECT 1 FROM pg_constraint WHERE conrelid='public.scans'::regclass AND conname='scans_scan_id_key');
        """).stdout
        self.assertIn("1", catalog)
        self.assertIn("legacy_unreviewed_open", catalog)
        self.assertIn("t", catalog)
        self.assertNotIn("owner", catalog)

    def test_scans_owner_rls_denies_other_users_including_super_admin(self):
        self._sql("""
            INSERT INTO auth.users(id,email) VALUES
              ('00000000-0000-0000-0000-000000000001','owner@example.test'),
              ('00000000-0000-0000-0000-000000000002','other@example.test');
            CREATE TABLE public.platform_roles(user_id uuid PRIMARY KEY, role text NOT NULL);
            INSERT INTO public.platform_roles(user_id,role)
            VALUES ('00000000-0000-0000-0000-000000000002','super_admin');
            CREATE TABLE public.scans (
              id uuid PRIMARY KEY DEFAULT gen_random_uuid(), scan_id varchar(64) NOT NULL UNIQUE,
              user_id uuid REFERENCES auth.users(id) ON DELETE RESTRICT,
              commodity varchar(100) NOT NULL, ai_supported boolean NOT NULL DEFAULT true,
              actual_weight_kg numeric(8,2), total_objects integer NOT NULL DEFAULT 0,
              fresh_count integer NOT NULL DEFAULT 0, rotten_count integer NOT NULL DEFAULT 0,
              fresh_ratio_percent numeric(5,2) NOT NULL DEFAULT 0,
              rotten_ratio_percent numeric(5,2) NOT NULL DEFAULT 0,
              reference_price_per_kg integer NOT NULL DEFAULT 0, estimated_economic_value bigint,
              potential_loss_value bigint, recommendation_note text, is_simulated boolean NOT NULL DEFAULT false,
              model_version varchar(50), created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now()
            );
            INSERT INTO public.scans(scan_id,commodity,user_id,recommendation_note)
            VALUES ('owner-private','Tomat','00000000-0000-0000-0000-000000000001','private');
        """)
        _run(self.psql, input_text=get_supabase_ddl())
        self._sql("GRANT SELECT,INSERT,UPDATE,DELETE ON public.scans TO authenticated; GRANT SELECT ON public.platform_roles TO authenticated;")
        denied_write = self._sql("""
            SET ROLE authenticated;
            SELECT set_config('request.jwt.claim.sub','00000000-0000-0000-0000-000000000002',false);
            INSERT INTO public.scans(scan_id,commodity,user_id) VALUES ('spoof','Tomat','00000000-0000-0000-0000-000000000001');
        """, check=False)
        self.assertNotEqual(denied_write.returncode, 0)
        own = self._sql("""
            SET ROLE authenticated;
            SELECT set_config('request.jwt.claim.sub','00000000-0000-0000-0000-000000000001',false);
            SELECT count(*) FROM public.scans;
            RESET ROLE;
        """).stdout
        other = self._sql("""
            SET ROLE authenticated;
            SELECT set_config('request.jwt.claim.sub','00000000-0000-0000-0000-000000000002',false);
            SELECT count(*) FROM public.scans;
            RESET ROLE;
        """).stdout
        self.assertIn("1", own.splitlines())
        self.assertIn("0", other.splitlines())
        self.assertIn("super_admin", self._sql("SET ROLE authenticated; SELECT set_config('request.jwt.claim.sub','00000000-0000-0000-0000-000000000002',false); SELECT role FROM public.platform_roles WHERE user_id=auth.uid(); RESET ROLE;").stdout)
        self._sql("""
            SET ROLE authenticated;
            SELECT set_config('request.jwt.claim.sub','00000000-0000-0000-0000-000000000001',false);
            UPDATE public.scans SET recommendation_note='owner-update' WHERE scan_id='owner-private';
            RESET ROLE;
        """)
        other_update = self._sql("""
            SET ROLE authenticated;
            SELECT set_config('request.jwt.claim.sub','00000000-0000-0000-0000-000000000002',false);
            UPDATE public.scans SET recommendation_note='unauthorized-update' WHERE scan_id='owner-private';
            RESET ROLE;
        """).stdout
        self.assertIn("UPDATE 0", other_update)

    def test_failed_rbac_migration_rolls_back_objects_and_forward_retry_succeeds(self):
        self._sql("""
            INSERT INTO auth.users(id,email) VALUES ('00000000-0000-0000-0000-000000000001','u@example.test');
            CREATE FUNCTION public.rbac_reject_audit_mutation()
            RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RETURN OLD; END; $$;
        """)
        failed = self.apply_rbac(check=False)
        self.assertNotEqual(failed.returncode, 0)
        self.assertIn('function "rbac_reject_audit_mutation" already exists', failed.stdout)
        state = self._sql("""
            SELECT to_regclass('public.organizations') IS NULL;
            SELECT to_regclass('public.user_profiles') IS NULL;
            SELECT count(*) FROM auth.users;
            SELECT to_regprocedure('public.rbac_reject_audit_mutation()') IS NOT NULL;
        """).stdout
        self.assertEqual([line for line in state.splitlines() if line], ["t", "t", "1", "t"])
        self._sql("DROP FUNCTION public.rbac_reject_audit_mutation();")
        self.apply_rbac()
        self.assertIn("organizations", self._sql("SELECT to_regclass('public.organizations');").stdout)

    def test_audit_actor_fk_removed_and_append_only_survives_account_delete(self):
        self._sql("""
            INSERT INTO auth.users(id,email) VALUES ('00000000-0000-0000-0000-000000000011','victim@example.test');
        """)
        self.apply_rbac()
        self._sql("""
            SELECT public.rbac_audit('00000000-0000-0000-0000-000000000011', NULL, 'test.event', 'user', '00000000-0000-0000-0000-000000000011', '{}'::jsonb);
            DELETE FROM auth.users WHERE id='00000000-0000-0000-0000-000000000011';
        """)
        state = self._sql("""
            SELECT count(*) FROM auth.users WHERE id='00000000-0000-0000-0000-000000000011';
            SELECT count(*) FROM public.audit_events WHERE action='test.event' AND actor_user_id='00000000-0000-0000-0000-000000000011';
            SELECT count(*) FROM pg_constraint WHERE conrelid='public.audit_events'::regclass AND confrelid='auth.users'::regclass;
        """).stdout.splitlines()
        self.assertEqual([line for line in state if line], ['0', '1', '0'])
        update_audit = self._sql("UPDATE public.audit_events SET action='tampered';", check=False)
        delete_audit = self._sql("DELETE FROM public.audit_events;", check=False)
        self.assertNotEqual(update_audit.returncode, 0)
        self.assertNotEqual(delete_audit.returncode, 0)
        self.assertIn('append-only', update_audit.stdout)
        self.assertIn('append-only', delete_audit.stdout)

    def test_platform_role_cascade_allows_non_last_admin_and_blocks_last(self):
        self._sql("""
            INSERT INTO auth.users(id,email) VALUES
              ('00000000-0000-0000-0000-000000000021','first@example.test'),
              ('00000000-0000-0000-0000-000000000022','second@example.test');
        """)
        self.apply_rbac()
        self._sql("""
            UPDATE public.user_profiles SET status='active' WHERE user_id IN ('00000000-0000-0000-0000-000000000021','00000000-0000-0000-0000-000000000022');
            INSERT INTO public.platform_roles(user_id,role) VALUES
              ('00000000-0000-0000-0000-000000000021','super_admin'),
              ('00000000-0000-0000-0000-000000000022','super_admin');
            DELETE FROM auth.users WHERE id='00000000-0000-0000-0000-000000000021';
        """)
        remaining = self._sql("""
            SELECT count(*) FROM public.platform_roles WHERE user_id='00000000-0000-0000-0000-000000000021';
            SELECT count(*) FROM public.user_profiles WHERE user_id='00000000-0000-0000-0000-000000000021';
            SELECT count(*) FROM public.platform_roles WHERE user_id='00000000-0000-0000-0000-000000000022';
        """).stdout.splitlines()
        self.assertEqual([line for line in remaining if line], ['0', '0', '1'])
        blocked = self._sql("DELETE FROM auth.users WHERE id='00000000-0000-0000-0000-000000000022';", check=False)
        self.assertNotEqual(blocked.returncode, 0)
        self.assertIn('last active Super Admin', blocked.stdout)

    def test_last_org_admin_guard_requires_replacement_before_delete_or_suspend(self):
        self._sql("""
            INSERT INTO auth.users(id,email) VALUES
              ('00000000-0000-0000-0000-000000000031','admin@example.test'),
              ('00000000-0000-0000-0000-000000000032','successor@example.test'),
              ('00000000-0000-0000-0000-000000000033','member@example.test');
        """)
        self.apply_rbac()
        self._sql("""
            UPDATE public.user_profiles SET status='active' WHERE user_id IN ('00000000-0000-0000-0000-000000000031','00000000-0000-0000-0000-000000000032','00000000-0000-0000-0000-000000000033');
            INSERT INTO public.organizations(id,name,slug) VALUES ('10000000-0000-0000-0000-000000000031','Org','org');
            INSERT INTO public.organization_memberships(organization_id,user_id,role,status) VALUES
              ('10000000-0000-0000-0000-000000000031','00000000-0000-0000-0000-000000000031','admin','active'),
              ('10000000-0000-0000-0000-000000000031','00000000-0000-0000-0000-000000000033','farmer','active');
        """)
        blocked = self._sql("DELETE FROM auth.users WHERE id='00000000-0000-0000-0000-000000000031';", check=False)
        self.assertNotEqual(blocked.returncode, 0)
        self.assertIn('at least one active admin', blocked.stdout)
        profile_block = self._sql("UPDATE public.user_profiles SET status='suspended' WHERE user_id='00000000-0000-0000-0000-000000000031';", check=False)
        self.assertNotEqual(profile_block.returncode, 0)
        self.assertIn('at least one active admin', profile_block.stdout)
        profile_delete = self._sql("DELETE FROM public.user_profiles WHERE user_id='00000000-0000-0000-0000-000000000031';", check=False)
        self.assertNotEqual(profile_delete.returncode, 0)
        self.assertIn('at least one active admin', profile_delete.stdout)
        self._sql("""
            INSERT INTO public.organization_memberships(organization_id,user_id,role,status)
            VALUES ('10000000-0000-0000-0000-000000000031','00000000-0000-0000-0000-000000000032','admin','active');
            DELETE FROM auth.users WHERE id='00000000-0000-0000-0000-000000000031';
        """)
        state = self._sql("""
            SELECT count(*) FROM public.organizations WHERE id='10000000-0000-0000-0000-000000000031';
            SELECT count(*) FROM public.organization_memberships WHERE organization_id='10000000-0000-0000-0000-000000000031' AND user_id='00000000-0000-0000-0000-000000000032' AND role='admin' AND status='active';
            SELECT count(*) FROM public.organization_memberships WHERE user_id='00000000-0000-0000-0000-000000000031';
        """).stdout.splitlines()
        self.assertEqual([line for line in state if line], ['1', '1', '0'])
        self._sql("DELETE FROM auth.users WHERE id='00000000-0000-0000-0000-000000000033';")
        member_state = self._sql("SELECT count(*) FROM public.user_profiles WHERE user_id='00000000-0000-0000-0000-000000000033';").stdout
        self.assertIn('0', member_state)

    def test_bootstrap_requires_real_distinct_operator_and_runs_once(self):
        self._sql("""
            INSERT INTO auth.users(id,email) VALUES
              ('00000000-0000-0000-0000-000000000041','operator@example.test'),
              ('00000000-0000-0000-0000-000000000042','target@example.test'),
              ('00000000-0000-0000-0000-000000000043','second@example.test');
        """)
        self.apply_rbac()
        self._sql("SELECT public.rbac_bootstrap_super_admin('00000000-0000-0000-0000-000000000041','00000000-0000-0000-0000-000000000042');")
        state = self._sql("""
            SELECT up.status FROM public.user_profiles up WHERE up.user_id='00000000-0000-0000-0000-000000000042';
            SELECT role FROM public.platform_roles WHERE user_id='00000000-0000-0000-0000-000000000042';
            SELECT count(*) FROM public.audit_events WHERE action='super_admin.bootstrap' AND actor_user_id='00000000-0000-0000-0000-000000000041' AND target_id='00000000-0000-0000-0000-000000000042';
        """).stdout.splitlines()
        self.assertEqual([line for line in state if line], ['active', 'super_admin', '1'])
        second = self._sql("SELECT public.rbac_bootstrap_super_admin('00000000-0000-0000-0000-000000000041','00000000-0000-0000-0000-000000000043');", check=False)
        self.assertNotEqual(second.returncode, 0)
        self.assertIn('bootstrap already completed', second.stdout)
        self_bootstrap = self._sql("SELECT public.rbac_bootstrap_super_admin('00000000-0000-0000-0000-000000000041','00000000-0000-0000-0000-000000000041');", check=False)
        self.assertIn('cannot promote self', self_bootstrap.stdout)
        api_call = self._sql("SET ROLE authenticated; SELECT public.rbac_bootstrap_super_admin('00000000-0000-0000-0000-000000000041','00000000-0000-0000-0000-000000000043');", check=False)
        self.assertNotEqual(api_call.returncode, 0)
        self.assertIn('permission denied', api_call.stdout)

    def test_break_glass_recovery_requires_no_active_super_admin_and_is_not_api_callable(self):
        self._sql("""
            INSERT INTO auth.users(id,email) VALUES
              ('00000000-0000-0000-0000-000000000051','operator@example.test'),
              ('00000000-0000-0000-0000-000000000052','holder@example.test'),
              ('00000000-0000-0000-0000-000000000053','recovered@example.test');
        """)
        self.apply_rbac()
        self._sql("INSERT INTO public.platform_roles(user_id,role) VALUES ('00000000-0000-0000-0000-000000000052','super_admin');")
        self._sql("SELECT public.rbac_recover_super_admin('00000000-0000-0000-0000-000000000051','00000000-0000-0000-0000-000000000053','lost_admin');")
        recovered = self._sql("""
            SELECT up.status FROM public.user_profiles up WHERE up.user_id='00000000-0000-0000-0000-000000000053';
            SELECT role FROM public.platform_roles WHERE user_id='00000000-0000-0000-0000-000000000053';
            SELECT count(*) FROM public.audit_events WHERE action='super_admin.recovery' AND metadata->>'reason_code'='lost_admin';
        """).stdout.splitlines()
        self.assertEqual([line for line in recovered if line], ['active', 'super_admin', '1'])
        blocked = self._sql("SELECT public.rbac_recover_super_admin('00000000-0000-0000-0000-000000000051','00000000-0000-0000-0000-000000000052','retry');", check=False)
        self.assertNotEqual(blocked.returncode, 0)
        self.assertIn('active Super Admin exists', blocked.stdout)
        api_call = self._sql("SET ROLE authenticated; SELECT public.rbac_recover_super_admin('00000000-0000-0000-0000-000000000051','00000000-0000-0000-0000-000000000052','retry');", check=False)
        self.assertNotEqual(api_call.returncode, 0)
        self.assertIn('permission denied', api_call.stdout)

    def test_account_deletion_requires_verified_matching_export_and_removes_scans_atomically(self):
        user = '00000000-0000-0000-0000-000000000061'
        export = '20000000-0000-0000-0000-000000000061'
        self._sql(f"INSERT INTO auth.users(id,email) VALUES ('{user}','owner@example.test');")
        self.apply_rbac()
        self._sql("""
            CREATE TABLE public.scans (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), scan_id text NOT NULL,
              user_id uuid REFERENCES auth.users(id) ON DELETE RESTRICT, commodity text NOT NULL DEFAULT 'Tomat');
            INSERT INTO public.scans(scan_id,user_id) SELECT 'scan-' || g, '00000000-0000-0000-0000-000000000061' FROM generate_series(1,2) g;
            INSERT INTO public.account_exports(id,user_id,state,scan_count,sha256,manifest,ready_at,expires_at)
            VALUES ('20000000-0000-0000-0000-000000000061','00000000-0000-0000-0000-000000000061','ready',2,repeat('a',64),'{}'::jsonb,now(),now()+interval '1 hour');
        """)
        rejected = self._sql("SET ROLE service_role; SELECT set_config('request.jwt.claim.role','service_role',false); SELECT public.rbac_delete_account('00000000-0000-0000-0000-000000000061','20000000-0000-0000-0000-000000000061',false);", check=False)
        self.assertNotEqual(rejected.returncode, 0)
        self.assertIn('must be downloaded and verified', rejected.stdout)
        self._sql("SET ROLE authenticated; SELECT set_config('request.jwt.claim.sub','00000000-0000-0000-0000-000000000061',false); SELECT public.rbac_mark_export_downloaded('20000000-0000-0000-0000-000000000061');")
        self._sql("SET ROLE service_role; SELECT set_config('request.jwt.claim.role','service_role',false); SELECT public.rbac_delete_account('00000000-0000-0000-0000-000000000061','20000000-0000-0000-0000-000000000061',false);")
        state = self._sql("""
            SELECT count(*) FROM auth.users WHERE id='00000000-0000-0000-0000-000000000061';
            SELECT count(*) FROM public.scans WHERE user_id='00000000-0000-0000-0000-000000000061';
            SELECT state FROM public.account_exports WHERE id='20000000-0000-0000-0000-000000000061';
            SELECT count(*) FROM public.audit_events WHERE action='account.deleted' AND actor_user_id='00000000-0000-0000-0000-000000000061' AND metadata->>'scan_count'='2' AND metadata->>'export_verified'='true' AND metadata->>'without_export'='false';
            SELECT count(*) FROM public.audit_events WHERE action='account.export_verified' AND metadata->>'sha256'=repeat('a',64);
        """).stdout.splitlines()
        self.assertEqual([line for line in state if line], ['0', '0', 'consumed', '1', '1'])

    def test_account_deletion_waiver_is_explicit_and_audited(self):
        user = '00000000-0000-0000-0000-000000000062'
        self._sql(f"INSERT INTO auth.users(id,email) VALUES ('{user}','waiver@example.test');")
        self.apply_rbac()
        self._sql("""
            CREATE TABLE public.scans (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), scan_id text NOT NULL,
              user_id uuid REFERENCES auth.users(id) ON DELETE RESTRICT, commodity text NOT NULL DEFAULT 'Tomat');
            INSERT INTO public.scans(scan_id,user_id) VALUES ('scan-1','00000000-0000-0000-0000-000000000062');
        """)
        missing_waiver = self._sql("SET ROLE service_role; SELECT set_config('request.jwt.claim.role','service_role',false); SELECT public.rbac_delete_account('00000000-0000-0000-0000-000000000062',NULL,false);", check=False)
        self.assertIn('export or explicit waiver', missing_waiver.stdout)
        self._sql("SET ROLE service_role; SELECT set_config('request.jwt.claim.role','service_role',false); SELECT public.rbac_delete_account('00000000-0000-0000-0000-000000000062',NULL,true,'user_waiver');")
        state = self._sql("""
            SELECT count(*) FROM auth.users WHERE id='00000000-0000-0000-0000-000000000062';
            SELECT count(*) FROM public.scans WHERE user_id='00000000-0000-0000-0000-000000000062';
            SELECT count(*) FROM public.audit_events WHERE action='account.deletion_without_export' AND actor_user_id='00000000-0000-0000-0000-000000000062' AND metadata->>'reason_code'='user_waiver';
            SELECT count(*) FROM public.audit_events WHERE action='account.deleted' AND actor_user_id='00000000-0000-0000-0000-000000000062' AND metadata->>'without_export'='true' AND metadata->>'export_verified'='false';
        """).stdout.splitlines()
        self.assertEqual([line for line in state if line], ['0', '0', '1', '1'])

    def test_account_deletion_rejects_foreign_export_and_rolls_back_last_admin_block(self):
        owner = '00000000-0000-0000-0000-000000000063'
        other = '00000000-0000-0000-0000-000000000064'
        self._sql(f"INSERT INTO auth.users(id,email) VALUES ('{owner}','owner@example.test'), ('{other}','other@example.test');")
        self.apply_rbac()
        self._sql("""
            CREATE TABLE public.scans (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), scan_id text NOT NULL,
              user_id uuid REFERENCES auth.users(id) ON DELETE RESTRICT, commodity text NOT NULL DEFAULT 'Tomat');
            INSERT INTO public.scans(scan_id,user_id) VALUES ('other-1','00000000-0000-0000-0000-000000000064');
            INSERT INTO public.account_exports(id,user_id,state,scan_count,sha256,manifest,ready_at,expires_at,downloaded_at)
            VALUES ('20000000-0000-0000-0000-000000000063','00000000-0000-0000-0000-000000000064','downloaded',1,repeat('a',64),'{}'::jsonb,now(),now()+interval '1 hour',now());
        """)
        foreign = self._sql("SET ROLE service_role; SELECT set_config('request.jwt.claim.role','service_role',false); SELECT public.rbac_delete_account('00000000-0000-0000-0000-000000000063','20000000-0000-0000-0000-000000000063',false);", check=False)
        self.assertNotEqual(foreign.returncode, 0)
        self.assertIn('does not belong to target', foreign.stdout)
        self._sql("""
            UPDATE public.user_profiles SET status='active' WHERE user_id='00000000-0000-0000-0000-000000000063';
            INSERT INTO public.organizations(id,name,slug) VALUES ('10000000-0000-0000-0000-000000000063','Solo','solo');
            INSERT INTO public.organization_memberships(organization_id,user_id,role,status) VALUES ('10000000-0000-0000-0000-000000000063','00000000-0000-0000-0000-000000000063','admin','active');
            INSERT INTO public.scans(scan_id,user_id) SELECT 'owner-' || g, '00000000-0000-0000-0000-000000000063' FROM generate_series(1,2) g;
            INSERT INTO public.account_exports(id,user_id,state,scan_count,sha256,manifest,ready_at,expires_at,downloaded_at)
            VALUES ('20000000-0000-0000-0000-000000000064','00000000-0000-0000-0000-000000000063','downloaded',2,repeat('b',64),'{}'::jsonb,now(),now()+interval '1 hour',now());
        """)
        blocked = self._sql("SET ROLE service_role; SELECT set_config('request.jwt.claim.role','service_role',false); SELECT public.rbac_delete_account('00000000-0000-0000-0000-000000000063','20000000-0000-0000-0000-000000000064',false);", check=False)
        self.assertNotEqual(blocked.returncode, 0)
        self.assertIn('at least one active admin', blocked.stdout)
        rollback = self._sql("""
            SELECT count(*) FROM auth.users WHERE id='00000000-0000-0000-0000-000000000063';
            SELECT count(*) FROM public.scans WHERE user_id='00000000-0000-0000-0000-000000000063';
            SELECT state FROM public.account_exports WHERE id='20000000-0000-0000-0000-000000000064';
            SELECT count(*) FROM public.audit_events WHERE action='account.deleted' AND actor_user_id='00000000-0000-0000-0000-000000000063';
        """).stdout.splitlines()
        self.assertEqual([line for line in rollback if line], ['1', '2', 'downloaded', '0'])

    def test_account_exports_are_owner_read_only_and_service_writable(self):
        self._sql('''
            INSERT INTO auth.users(id,email) VALUES
              ('00000000-0000-0000-0000-000000000071','owner@example.test'),
              ('00000000-0000-0000-0000-000000000072','stranger@example.test');
        ''')
        self.apply_rbac()
        self._sql('''
            INSERT INTO public.account_exports(id,user_id,state,scan_count,sha256,manifest,ready_at,expires_at)
            VALUES ('20000000-0000-0000-0000-000000000071','00000000-0000-0000-0000-000000000071','ready',0,repeat('a',64),'{}'::jsonb,now(),now()+interval '1 hour');
        ''')
        owner = self._sql('''SET ROLE authenticated; SELECT set_config('request.jwt.claim.sub','00000000-0000-0000-0000-000000000071',false); SELECT count(*) FROM public.account_exports;''').stdout.splitlines()
        stranger = self._sql('''SET ROLE authenticated; SELECT set_config('request.jwt.claim.sub','00000000-0000-0000-0000-000000000072',false); SELECT count(*) FROM public.account_exports;''').stdout.splitlines()
        self.assertIn('1', owner)
        self.assertIn('0', stranger)
        anon = self._sql('''SET ROLE anon; SELECT count(*) FROM public.account_exports;''', check=False)
        self.assertNotEqual(anon.returncode, 0)
        self.assertIn('permission denied', anon.stdout)
        update = self._sql('''SET ROLE authenticated; SELECT set_config('request.jwt.claim.sub','00000000-0000-0000-0000-000000000071',false); UPDATE public.account_exports SET state='downloaded';''', check=False)
        self.assertNotEqual(update.returncode, 0)
        self.assertIn('permission denied', update.stdout)
        service = self._sql('''SET ROLE service_role; SELECT count(*) FROM public.account_exports;''').stdout
        self.assertIn('1', service)

    def test_one_active_export_per_user_is_enforced(self):
        self._sql("INSERT INTO auth.users(id,email) VALUES ('00000000-0000-0000-0000-000000000075','owner@example.test');")
        self.apply_rbac()
        self._sql("""
            INSERT INTO public.account_exports(id,user_id,state,scan_count,sha256,manifest,ready_at,expires_at)
            VALUES ('20000000-0000-0000-0000-000000000075','00000000-0000-0000-0000-000000000075','ready',0,repeat('b',64),'{}'::jsonb,now(),now()+interval '1 hour');
        """)
        duplicate = self._sql("""
            INSERT INTO public.account_exports(id,user_id,state,scan_count,sha256,manifest,ready_at,expires_at)
            VALUES ('20000000-0000-0000-0000-000000000076','00000000-0000-0000-0000-000000000075','ready',0,repeat('c',64),'{}'::jsonb,now(),now()+interval '1 hour');
        """, check=False)
        self.assertNotEqual(duplicate.returncode, 0)
        self.assertIn('account_exports_one_active_per_user', duplicate.stdout)
        self._sql("UPDATE public.account_exports SET state='failed' WHERE id='20000000-0000-0000-0000-000000000075';")
        retry = self._sql("""
            INSERT INTO public.account_exports(id,user_id,state,scan_count,sha256,manifest,ready_at,expires_at)
            VALUES ('20000000-0000-0000-0000-000000000076','00000000-0000-0000-0000-000000000075','ready',0,repeat('c',64),'{}'::jsonb,now(),now()+interval '1 hour');
        """, check=False)
        self.assertEqual(retry.returncode, 0, retry.stdout)

    def test_account_deletion_and_export_event_are_not_api_callable(self):
        self._sql('''INSERT INTO auth.users(id,email) VALUES ('00000000-0000-0000-0000-000000000081','target@example.test');''')
        self.apply_rbac()
        delete_call = self._sql('''SET ROLE authenticated; SELECT public.rbac_delete_account('00000000-0000-0000-0000-000000000081',NULL,false);''', check=False)
        self.assertNotEqual(delete_call.returncode, 0)
        self.assertIn('permission denied', delete_call.stdout)
        event_call = self._sql('''SET ROLE authenticated; SELECT public.rbac_record_export_event('20000000-0000-0000-0000-000000000081','account.export_created',NULL);''', check=False)
        self.assertNotEqual(event_call.returncode, 0)
        self.assertIn('permission denied', event_call.stdout)

    def test_account_deletion_rolls_back_when_target_is_last_super_admin(self):
        self._sql('''INSERT INTO auth.users(id,email) VALUES ('00000000-0000-0000-0000-000000000091','root@example.test');''')
        self.apply_rbac()
        self._sql('''
            UPDATE public.user_profiles SET status='active' WHERE user_id='00000000-0000-0000-0000-000000000091';
            INSERT INTO public.platform_roles(user_id,role) VALUES ('00000000-0000-0000-0000-000000000091','super_admin');
            CREATE TABLE public.scans (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), scan_id text NOT NULL,
              user_id uuid REFERENCES auth.users(id) ON DELETE RESTRICT, commodity text NOT NULL DEFAULT 'Tomat');
            INSERT INTO public.scans(scan_id,user_id) VALUES ('root-1','00000000-0000-0000-0000-000000000091');
            INSERT INTO public.account_exports(id,user_id,state,scan_count,sha256,manifest,ready_at,expires_at,downloaded_at)
            VALUES ('20000000-0000-0000-0000-000000000091','00000000-0000-0000-0000-000000000091','downloaded',1,repeat('a',64),'{}'::jsonb,now(),now()+interval '1 hour',now());
        ''')
        blocked = self._sql('''SET ROLE service_role; SELECT set_config('request.jwt.claim.role','service_role',false); SELECT public.rbac_delete_account('00000000-0000-0000-0000-000000000091','20000000-0000-0000-0000-000000000091',false);''', check=False)
        self.assertNotEqual(blocked.returncode, 0)
        self.assertIn('last active Super Admin', blocked.stdout)
        state = self._sql('''
            SELECT count(*) FROM auth.users WHERE id='00000000-0000-0000-0000-000000000091';
            SELECT count(*) FROM public.scans WHERE user_id='00000000-0000-0000-0000-000000000091';
            SELECT state FROM public.account_exports WHERE id='20000000-0000-0000-0000-000000000091';
            SELECT count(*) FROM public.audit_events WHERE action='account.deleted';
        ''').stdout.splitlines()
        self.assertEqual([line for line in state if line], ['1', '1', 'downloaded', '0'])

if __name__ == "__main__":
    unittest.main()