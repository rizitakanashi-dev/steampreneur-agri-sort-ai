import unittest
from unittest.mock import patch

from fastapi import FastAPI
from fastapi.testclient import TestClient

from server.routers.organizations import router
from server.services.authorization_service import AuthorizationError, AuthorizationService
from server.tests.test_authorization import MemoryAuthorizationRepository
from server.utils.authorization import get_active_principal
from server.utils.auth import get_current_user


class ManagementApiTests(unittest.TestCase):
    def setUp(self):
        self.app = FastAPI()
        self.app.include_router(router)
        self.repo = MemoryAuthorizationRepository()
        self.service = AuthorizationService(self.repo)
        self.current_user = {"id": "super", "_principal": self.service.get_active_principal({"id": "super"}), "_authorization_service": self.service}
        self.app.dependency_overrides[get_current_user] = lambda: {"id": self.current_user["id"]}
        self.app.dependency_overrides[get_active_principal] = lambda: self.current_user["_principal"]
        self.service_patch = patch("server.utils.authorization.get_authorization_service", return_value=self.service)
        self.service_patch.start()
        self.client = TestClient(self.app)

    def tearDown(self):
        self.service_patch.stop()
        self.app.dependency_overrides.clear()

    def use_user(self, user_id):
        principal = self.service.get_active_principal({"id": user_id})
        self.current_user = {"id": user_id, "_principal": principal, "_authorization_service": self.service}

    def test_super_admin_lists_all_organizations(self):
        response = self.client.get("/api/v1/organizations")
        self.assertEqual(response.status_code, 200)
        self.assertEqual(self.repo.rpc_calls[-1][0], "rbac_api_list_organizations")

    def test_member_organization_list_uses_membership_scoped_operation(self):
        self.use_user("farmer-a")
        response = self.client.get("/api/v1/organizations")
        self.assertEqual(response.status_code, 200)
        self.assertEqual(self.repo.rpc_calls[-1][0], "rbac_api_list_my_organizations")

    def test_member_cannot_read_organization_not_assigned_to_them(self):
        self.use_user("farmer-a")
        response = self.client.get("/api/v1/organizations/org-b")
        self.assertEqual(response.status_code, 403)

    def test_super_admin_can_create_organization(self):
        response = self.client.post("/api/v1/organizations", json={"name": "Org C", "slug": "org-c"})
        self.assertEqual(response.status_code, 201)
        self.assertEqual(self.repo.rpc_calls[-1][0], "rbac_api_create_organization")

    def test_invalid_organization_slug_is_rejected_before_rpc(self):
        response = self.client.post("/api/v1/organizations", json={"name": "Org C", "slug": "Org C"})
        self.assertEqual(response.status_code, 422)
        self.assertEqual(self.repo.rpc_calls, [])

    def test_org_admin_can_list_members_but_not_assign_an_admin_role(self):
        self.use_user("admin-a")
        response = self.client.get("/api/v1/organizations/org-a/members")
        self.assertEqual(response.status_code, 200)
        self.assertEqual(self.repo.rpc_calls[-1][0], "rbac_api_list_members")

        response = self.client.post("/api/v1/organizations/org-a/members", json={"user_id": "farmer-b", "role": "admin"})
        self.assertEqual(response.status_code, 403)
        self.assertEqual(self.repo.rpc_calls[-1][0], "rbac_api_list_members")

    def test_duplicate_active_membership_returns_conflict(self):
        response = self.client.post("/api/v1/organizations/org-a/members", json={"user_id": "farmer-a", "role": "merchant"})
        self.assertEqual(response.status_code, 409)
        self.assertEqual(self.repo.rpc_calls, [])

    def test_org_admin_cannot_read_platform_user_directory(self):
        self.use_user("admin-a")
        response = self.client.get("/api/v1/admin/users")
        self.assertEqual(response.status_code, 403)

    def test_provider_outage_is_503_not_401(self):
        from server.config.auth_config import AuthProviderUnavailableError
        with patch.object(self.repo, "rpc", side_effect=AuthProviderUnavailableError("offline")):
            response = self.client.get("/api/v1/organizations")
        self.assertEqual(response.status_code, 503)


if __name__ == "__main__":
    unittest.main()
