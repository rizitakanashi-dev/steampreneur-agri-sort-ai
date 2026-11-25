import io
import json
import unittest
import urllib.error
from unittest.mock import patch

from server.config.auth_config import AuthProviderUnavailableError, AuthConfig
from server.services.authorization_service import (
    AuthorizationError,
    AuthorizationService,
    Membership,
    ResourceContext,
    SupabaseAuthorizationRepository,
)


class MemoryAuthorizationRepository:
    def __init__(self):
        self.users = {
            "admin-a": {"user_id": "admin-a", "status": "active"},
            "farmer-a": {"user_id": "farmer-a", "status": "active"},
            "farmer-b": {"user_id": "farmer-b", "status": "active"},
            "merchant-a": {"user_id": "merchant-a", "status": "active"},
            "suspended-user": {"user_id": "suspended-user", "status": "suspended"},
            "super": {"user_id": "super", "status": "active"},
            "unassigned": {"user_id": "unassigned", "status": "active"},
            "pending": {"user_id": "pending", "status": "pending_assignment"},
        }
        self.platform_roles = {"super": "super_admin"}
        self.organizations = {"org-a": "active", "org-b": "active", "org-suspended": "suspended"}
        self.memberships = {
            "admin-a": [{"id": "m1", "organization_id": "org-a", "user_id": "admin-a", "role": "admin", "status": "active", "organizations": {"status": "active"}}],
            "farmer-a": [{"id": "m2", "organization_id": "org-a", "user_id": "farmer-a", "role": "farmer", "status": "active", "organizations": {"status": "active"}}],
            "farmer-b": [{"id": "m4", "organization_id": "org-a", "user_id": "farmer-b", "role": "farmer", "status": "active", "organizations": {"status": "active"}}],
            "merchant-a": [{"id": "m3", "organization_id": "org-a", "user_id": "merchant-a", "role": "merchant", "status": "active", "organizations": {"status": "active"}}],
        }
        self.rpc_calls = []
        self.resources = {
            "farmer-own": ResourceContext("scan", "farmer-a", None, "active"),
            "farmer-other": ResourceContext("scan", "farmer-b", None, "active"),
            "admin-a-scan": ResourceContext("scan", "farmer-a", None, "active"),
            "org-b-scan": ResourceContext("scan", "other-admin", "org-b", "active"),
        }

    def get_user_profile(self, user_id):
        return self.users.get(user_id)

    def get_platform_role(self, user_id):
        return self.platform_roles.get(user_id)

    def list_memberships(self, user_id):
        return list(self.memberships.get(user_id, []))

    def get_organization_status(self, organization_id):
        return self.organizations.get(organization_id)

    def get_membership(self, user_id, organization_id):
        return next((row for row in self.memberships.get(user_id, []) if row.get("organization_id") == organization_id), None)

    def has_active_membership(self, user_id, organization_id):
        return any(
            row.get("organization_id") == organization_id and row.get("status") == "active"
            for row in self.memberships.get(user_id, [])
        )

    def get_resource_context(self, resource_type, resource_id):
        return self.resources.get(resource_id)

    def rpc(self, function_name, payload):
        self.rpc_calls.append((function_name, dict(payload)))
        return {"operation": function_name, **dict(payload)}


class TestAuthorizationService(unittest.TestCase):
    def setUp(self):
        self.repository = MemoryAuthorizationRepository()
        self.service = AuthorizationService(self.repository)

    def test_active_principal_requires_profile_active_membership_and_active_organization(self):
        principal = self.service.get_active_principal({"id": "admin-a", "email": "ignored@example.test"})
        self.assertEqual(principal.user_id, "admin-a")
        self.assertEqual(principal.memberships[0].organization_id, "org-a")
        self.assertNotEqual(principal.user_status, "suspended")

    def test_suspended_user_is_denied(self):
        with self.assertRaises(AuthorizationError) as raised:
            self.service.get_active_principal({"id": "suspended-user"})
        self.assertEqual(raised.exception.status_code, 403)

    def test_missing_profile_is_denied_without_trusting_user_metadata(self):
        with self.assertRaises(AuthorizationError) as raised:
            self.service.get_active_principal({"id": "unknown", "role": "super_admin", "organization_id": "org-a"})
        self.assertEqual(raised.exception.status_code, 403)

    def test_super_admin_can_access_any_active_organization(self):
        principal = self.service.get_active_principal({"id": "super"})
        self.service.require_org_access(principal, "org-b", "scans.read")
        self.assertEqual(principal.platform_role, "super_admin")

    def test_admin_is_limited_to_active_organization_membership(self):
        principal = self.service.get_active_principal({"id": "admin-a"})
        self.service.require_org_access(principal, "org-a", "members.update")
        with self.assertRaises(AuthorizationError) as raised:
            self.service.require_org_access(principal, "org-b", "members.update")
        self.assertEqual(raised.exception.status_code, 403)

    def test_organization_list_is_scoped_for_members_and_global_for_super_admin(self):
        member = self.service.get_active_principal({"id": "farmer-a"})
        self.service.list_organizations(member)
        self.assertEqual(self.repository.rpc_calls[-1][0], "rbac_api_list_my_organizations")

        super_admin = self.service.get_active_principal({"id": "super"})
        self.service.list_organizations(super_admin)
        self.assertEqual(self.repository.rpc_calls[-1][0], "rbac_api_list_organizations")

    def test_duplicate_active_membership_assignment_is_conflict(self):
        super_admin = self.service.get_active_principal({"id": "super"})
        with self.assertRaises(AuthorizationError) as raised:
            self.service.assign_membership(super_admin, "org-a", "farmer-a", "merchant")
        self.assertEqual(raised.exception.status_code, 409)
        self.assertEqual(self.repository.rpc_calls, [])

    def test_organization_management_validates_and_requires_platform_permission(self):
        member = self.service.get_active_principal({"id": "farmer-a"})
        with self.assertRaises(AuthorizationError):
            self.service.create_organization(member, {"name": "Org", "slug": "org"})

        super_admin = self.service.get_active_principal({"id": "super"})
        with self.assertRaises(AuthorizationError):
            self.service.create_organization(super_admin, {"name": "Bad", "slug": "Not Valid"})
        self.service.create_organization(super_admin, {"name": "Org", "slug": "new-org"})
        self.assertEqual(self.repository.rpc_calls[-1][0], "rbac_api_create_organization")

    def test_revoked_membership_immediately_blocks_organizational_operation(self):
        principal = self.service.get_active_principal({"id": "admin-a"})
        self.repository.memberships["admin-a"][0]["status"] = "revoked"
        with self.assertRaises(AuthorizationError):
            self.service.require_org_access(principal, "org-a", "members.read")

    def test_suspended_organization_is_denied(self):
        self.repository.memberships["admin-a"].append({"id": "m4", "organization_id": "org-suspended", "user_id": "admin-a", "role": "admin", "status": "active", "organizations": {"status": "suspended"}})
        principal = self.service.get_active_principal({"id": "admin-a"})
        self.assertNotIn("org-suspended", [membership.organization_id for membership in principal.memberships])
        with self.assertRaises(AuthorizationError):
            self.service.require_org_access(principal, "org-suspended", "organization.read")

    def test_farmer_and_merchant_can_only_access_their_own_resources(self):
        farmer = self.service.get_active_principal({"id": "farmer-a"})
        self.service.require_resource_access(farmer, "scan", "farmer-own", "scans.read")
        with self.assertRaises(AuthorizationError):
            self.service.require_resource_access(farmer, "scan", "farmer-other", "scans.read")
        merchant = self.service.get_active_principal({"id": "merchant-a"})
        with self.assertRaises(AuthorizationError):
            self.service.require_resource_access(merchant, "scan", "farmer-own", "scans.read")

    def test_org_admin_cannot_access_member_private_scan_for_any_mutation(self):
        admin = self.service.get_active_principal({"id": "admin-a"})
        for action in ("scans.read", "scans.update", "scans.delete"):
            with self.subTest(action=action), self.assertRaises(AuthorizationError):
                self.service.require_resource_access(admin, "scan", "admin-a-scan", action)

    def test_super_admin_does_not_bypass_private_scan_ownership(self):
        super_admin = self.service.get_active_principal({"id": "super"})
        with self.assertRaises(AuthorizationError):
            self.service.require_resource_access(super_admin, "scan", "farmer-own", "scans.read")

    def test_user_can_access_own_scan_after_explicit_resource_permission_check(self):
        farmer = self.service.get_active_principal({"id": "farmer-a"})
        resource = self.service.require_resource_access(farmer, "scan", "farmer-own", "scans.read")
        self.assertEqual(resource.owner_user_id, farmer.user_id)

    def test_active_owner_without_organization_membership_can_access_private_scan(self):
        self.repository.resources["unassigned-scan"] = ResourceContext("scan", "unassigned", None, "active")
        principal = self.service.get_active_principal({"id": "unassigned"})
        resource = self.service.require_resource_access(principal, "scan", "unassigned-scan", "scans.read")
        self.assertEqual(resource.owner_user_id, "unassigned")

    def test_pending_assignment_user_can_access_own_private_scan(self):
        self.repository.resources["pending-scan"] = ResourceContext("scan", "pending", None, "active")
        principal = self.service.get_active_principal({"id": "pending"})
        resource = self.service.require_resource_access(principal, "scan", "pending-scan", "scans.read")
        self.assertEqual(resource.owner_user_id, "pending")
        with self.assertRaises(AuthorizationError):
            self.service.require_permission(principal, "users.read")

    def test_revoked_membership_does_not_remove_private_scan_ownership(self):
        self.repository.resources["farmer-own"] = ResourceContext("scan", "farmer-a", None, "active")
        self.repository.memberships["farmer-a"][0]["status"] = "revoked"
        principal = self.service.get_active_principal({"id": "farmer-a"})
        resource = self.service.require_resource_access(principal, "scan", "farmer-own", "scans.read")
        self.assertEqual(resource.owner_user_id, "farmer-a")

    def test_resource_permission_is_checked_for_specific_organization(self):
        farmer = self.service.get_active_principal({"id": "farmer-a"})
        with self.assertRaises(AuthorizationError):
            self.service.require_resource_access(farmer, "scan", "org-b-scan", "scans.read")

    def test_admin_resource_access_cannot_cross_organization(self):
        admin = self.service.get_active_principal({"id": "admin-a"})
        with self.assertRaises(AuthorizationError):
            self.service.require_resource_access(admin, "scan", "org-b-scan", "scans.read")

    def test_admin_cannot_assign_super_admin_or_raise_self(self):
        admin = self.service.get_active_principal({"id": "admin-a"})
        with self.assertRaises(AuthorizationError):
            self.service.validate_membership_assignment(admin, "org-a", "new-user", "super_admin")
        with self.assertRaises(AuthorizationError):
            self.service.validate_membership_assignment(admin, "org-a", "admin-a", "farmer")

    def test_unknown_permission_and_role_are_default_deny(self):
        admin = self.service.get_active_principal({"id": "admin-a"})
        with self.assertRaises(AuthorizationError):
            self.service.require_org_access(admin, "org-a", "users.make_super_admin")
        with self.assertRaises(AuthorizationError):
            self.service.validate_membership_assignment(admin, "org-a", "new-user", "platform_admin")

    def test_supabase_repository_uses_verified_bearer_and_queries_membership_freshly(self):
        config = AuthConfig(
            app_env="development",
            auth_mode="supabase",
            supabase_url="https://example.supabase.co",
            supabase_anon_key="anon",
        )
        response = unittest.mock.MagicMock()
        response.__enter__.return_value.read.return_value = json.dumps([
            {"user_id": "u1"}
        ]).encode()
        with patch("server.services.authorization_service.urllib.request.urlopen", return_value=response) as open_url:
            repository = SupabaseAuthorizationRepository(config, "verified-user-jwt")
            repository.set_verified_user_id("u1")
            resource = repository.get_resource_context("scan", "private-1")
        request = open_url.call_args.args[0]
        self.assertEqual(resource.owner_user_id, "u1")
        self.assertEqual(request.get_header("Authorization"), "Bearer verified-user-jwt")
        self.assertIn("user_id=eq.u1", request.full_url)

    def test_scan_resource_lookup_fails_closed_without_verified_user_id(self):
        config = AuthConfig(
            app_env="development",
            auth_mode="supabase",
            supabase_url="https://example.supabase.co",
            supabase_anon_key="anon",
        )
        repository = SupabaseAuthorizationRepository(config, "verified-user-jwt")
        with self.assertRaises(AuthorizationError):
            repository.get_resource_context("scan", "private-1")

    def test_repository_provider_failure_is_not_invalid_identity(self):
        config = AuthConfig(
            app_env="development",
            auth_mode="supabase",
            supabase_url="https://example.supabase.co",
            supabase_anon_key="anon",
        )
        with patch("server.services.authorization_service.urllib.request.urlopen", side_effect=urllib.error.URLError("offline")):
            with self.assertRaises(AuthProviderUnavailableError):
                SupabaseAuthorizationRepository(config, "verified-user-jwt").get_user_profile("u1")

    def test_audit_metadata_removes_credentials_and_limits_values(self):
        metadata = self.service.sanitize_audit_metadata({
            "role": "farmer",
            "email": "private@example.test",
            "access_token": "never-log",
            "reason_code": "membership_update",
            "nested": {"phone": "never-log", "status": "active"},
        })
        self.assertEqual(metadata["role"], "farmer")
        self.assertEqual(metadata["reason_code"], "membership_update")
        self.assertNotIn("email", metadata)
        self.assertNotIn("access_token", metadata)
        self.assertNotIn("nested", metadata)

    def test_last_super_admin_guard_rejects_removal_of_last_admin(self):
        with self.assertRaises(AuthorizationError):
            self.service.ensure_last_super_admin_removal_allowed(1)
        self.service.ensure_last_super_admin_removal_allowed(2)

    def test_audit_metadata_removes_credentials_and_limits_values(self):
        metadata = self.service.sanitize_audit_metadata({
            "role": "farmer",
            "access_token": "secret-token",
            "otp": "123456",
            "nested": {"password": "secret", "count": 3},
            "changed_fields": ["status"],
        })
        self.assertNotIn("access_token", metadata)
        self.assertNotIn("otp", metadata)
        self.assertNotIn("nested", metadata)
        self.assertEqual(metadata["changed_fields"], ["status"])


if __name__ == "__main__":
    unittest.main()
