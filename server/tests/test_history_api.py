import unittest
from unittest.mock import patch

from fastapi import HTTPException

from server.routers import history as history_router


class TestProtectedHistoryRoutes(unittest.IsolatedAsyncioTestCase):
    class AuthorizationService:
        def __init__(self):
            self.resource_checks = []

        def require_resource_access(self, principal, resource_type, resource_id, action):
            self.resource_checks.append((principal.user_id, resource_type, resource_id, action))
            if resource_id != "scan-1":
                from server.services.authorization_service import AuthorizationError
                raise AuthorizationError("not found", 404)

    class Principal:
        user_id = "user-1"
        platform_role = None

    @classmethod
    def make_user(cls):
        return {
            "id": "user-1",
            "_access_token": "verified-token",
            "_principal": cls.Principal(),
            "_authorization_service": cls.AuthorizationService(),
        }

    def setUp(self):
        self.USER = self.make_user()

    async def test_history_read_scopes_to_verified_user_and_passes_user_token(self):
        expected = {"records": [], "total_count": 0}
        user = self.make_user()
        with patch.object(history_router.storage_service, "get_scans", return_value=expected) as get_scans:
            response = await history_router.get_scan_history(20, 10, "Tomat", user)
        self.assertEqual(response["data"], expected)
        get_scans.assert_called_once_with(
            limit=20, offset=10, commodity="Tomat", user_id="user-1", access_token="verified-token"
        )

    async def test_create_history_uses_authenticated_owner(self):
        payload = {"scan_id": "scan-1", "commodity": "Tomat"}
        user = self.make_user()
        with patch.object(history_router.storage_service, "save_scan", return_value={"scan_id": "scan-1"}) as save_scan:
            await history_router.create_scan_history_record(payload, user)
        save_scan.assert_called_once_with(payload, user_id="user-1", access_token="verified-token")

    async def test_create_history_rejects_spoofed_owner(self):
        payload = {"scan_id": "scan-1", "user_id": "attacker"}
        with self.assertRaises(HTTPException) as raised:
            await history_router.create_scan_history_record(payload, self.make_user())
        self.assertEqual(raised.exception.status_code, 400)
        self.assertEqual(raised.exception.detail["code"], "OWNER_ID_NOT_ACCEPTED")

    async def test_admin_membership_does_not_grant_private_history(self):
        user = self.make_user()
        user["_principal"].memberships = ("admin-membership-in-another-org",)
        with self.assertRaises(HTTPException) as raised:
            await history_router.get_scan_history_by_id("private-scan", user)
        self.assertEqual(raised.exception.status_code, 404)

    async def test_get_and_delete_scan_are_owner_scoped(self):
        record = {"scan_id": "scan-1", "user_id": "user-1"}
        user = self.make_user()
        with patch.object(history_router.storage_service, "get_scan_by_id", return_value=record) as get_scan:
            await history_router.get_scan_history_by_id("scan-1", user)
        self.assertEqual(user["_authorization_service"].resource_checks[-1], ("user-1", "scan", "scan-1", "scans.read"))
        get_scan.assert_called_once_with("scan-1", user_id="user-1", access_token="verified-token")

        with patch.object(history_router.storage_service, "delete_scan", return_value=True) as delete_scan:
            await history_router.delete_scan_history_record("scan-1", user)
        self.assertEqual(user["_authorization_service"].resource_checks[-1], ("user-1", "scan", "scan-1", "scans.delete"))
        delete_scan.assert_called_once_with("scan-1", user_id="user-1", access_token="verified-token")

    async def test_delete_all_is_owner_scoped(self):
        with patch.object(history_router.storage_service, "clear_scans", return_value=2) as clear_scans:
            await history_router.clear_all_scan_history(self.USER)
        clear_scans.assert_called_once_with(user_id="user-1", access_token="verified-token")


if __name__ == "__main__":
    unittest.main()
