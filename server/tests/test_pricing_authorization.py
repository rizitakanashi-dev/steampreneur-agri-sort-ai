import unittest
from unittest.mock import patch

from fastapi import FastAPI, HTTPException
from fastapi.testclient import TestClient

from server.routers.pricing import router
from server.services.authorization_service import AuthorizationService
from server.tests.test_authorization import MemoryAuthorizationRepository
from server.utils.authorization import get_active_principal
from server.utils.auth import get_current_user


class PricingAuthorizationTests(unittest.TestCase):
    def setUp(self):
        self.app = FastAPI()
        self.app.include_router(router)
        self.repository = MemoryAuthorizationRepository()
        self.service = AuthorizationService(self.repository)
        self.current_user = None

        def authenticated_user():
            if self.current_user is None:
                raise HTTPException(status_code=401, detail={"code": "AUTH_REQUIRED", "message": "Sign-in required."})
            return self.current_user

        self.app.dependency_overrides[get_current_user] = authenticated_user
        def active_principal():
            if self.current_user is None:
                raise HTTPException(status_code=401, detail={"code": "AUTH_REQUIRED", "message": "Sign-in required."})
            return self.service.get_active_principal({"id": self.current_user["id"]})

        self.app.dependency_overrides[get_active_principal] = active_principal
        self.service_patch = patch("server.utils.authorization.get_authorization_service", return_value=self.service)
        self.service_patch.start()
        self.client = TestClient(self.app)

    def tearDown(self):
        self.service_patch.stop()
        self.app.dependency_overrides.clear()

    def sign_in_as(self, user_id):
        self.current_user = {"id": user_id, "_access_token": "test-user-token"}

    def test_public_reference_price_reads_remain_available_without_authentication(self):
        response = self.client.get("/api/v1/pricing/commodities")
        self.assertEqual(response.status_code, 200)

    def test_global_price_sync_requires_authenticated_platform_permission(self):
        with patch("server.routers.pricing.bapanas_service.sync_feed") as sync_feed:
            response = self.client.post("/api/v1/pricing/bapanas/sync")
        self.assertEqual(response.status_code, 401)
        sync_feed.assert_not_called()

    def test_organization_admin_cannot_trigger_global_price_sync(self):
        self.sign_in_as("admin-a")
        with patch("server.routers.pricing.bapanas_service.sync_feed") as sync_feed:
            response = self.client.post("/api/v1/pricing/bapanas/sync")
        self.assertEqual(response.status_code, 403)
        sync_feed.assert_not_called()

    def test_organization_admin_cannot_trigger_sp2kp_sync(self):
        self.sign_in_as("admin-a")
        with patch("server.routers.pricing.sp2kp_service.sync_feed") as sync_feed:
            response = self.client.post("/api/v1/pricing/sp2kp/sync")
        self.assertEqual(response.status_code, 403)
        sync_feed.assert_not_called()

    def test_super_admin_can_trigger_global_price_sync(self):
        self.sign_in_as("super")
        with patch("server.routers.pricing.bapanas_service.sync_feed", return_value={"updated": True}) as sync_feed:
            response = self.client.post("/api/v1/pricing/bapanas/sync")
        self.assertEqual(response.status_code, 200)
        sync_feed.assert_called_once_with(force=True)


if __name__ == "__main__":
    unittest.main()
