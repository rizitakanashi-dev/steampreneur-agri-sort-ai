import unittest
from unittest.mock import patch

from fastapi import HTTPException

from server.routers import history as history_router


class TestProtectedHistoryRoutes(unittest.IsolatedAsyncioTestCase):
    USER = {"id": "user-1", "_access_token": "verified-token"}

    async def test_history_read_scopes_to_verified_user_and_passes_user_token(self):
        expected = {"records": [], "total_count": 0}
        with patch.object(history_router.storage_service, "get_scans", return_value=expected) as get_scans:
            response = await history_router.get_scan_history(20, 10, "Tomat", self.USER)
        self.assertEqual(response["data"], expected)
        get_scans.assert_called_once_with(
            limit=20, offset=10, commodity="Tomat", user_id="user-1", access_token="verified-token"
        )

    async def test_create_history_uses_authenticated_owner(self):
        payload = {"scan_id": "scan-1", "commodity": "Tomat", "user_id": "attacker"}
        with patch.object(history_router.storage_service, "save_scan", return_value={"scan_id": "scan-1"}) as save_scan:
            await history_router.create_scan_history_record(payload, self.USER)
        save_scan.assert_called_once_with(payload, user_id="user-1", access_token="verified-token")

    async def test_get_and_delete_scan_are_owner_scoped(self):
        record = {"scan_id": "scan-1", "user_id": "user-1"}
        with patch.object(history_router.storage_service, "get_scan_by_id", return_value=record) as get_scan:
            await history_router.get_scan_history_by_id("scan-1", self.USER)
        get_scan.assert_called_once_with("scan-1", user_id="user-1", access_token="verified-token")

        with patch.object(history_router.storage_service, "delete_scan", return_value=True) as delete_scan:
            await history_router.delete_scan_history_record("scan-1", self.USER)
        delete_scan.assert_called_once_with("scan-1", user_id="user-1", access_token="verified-token")

    async def test_delete_all_is_owner_scoped(self):
        with patch.object(history_router.storage_service, "clear_scans", return_value=2) as clear_scans:
            await history_router.clear_all_scan_history(self.USER)
        clear_scans.assert_called_once_with(user_id="user-1", access_token="verified-token")


if __name__ == "__main__":
    unittest.main()
