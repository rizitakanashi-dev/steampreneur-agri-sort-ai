import unittest
from unittest.mock import patch

from fastapi import HTTPException
from fastapi.security import HTTPAuthorizationCredentials

from server.config.auth_config import AuthProviderUnavailableError
from server.utils.auth import get_current_user


class TestAuthDependency(unittest.TestCase):
    def test_missing_credentials_are_rejected(self):
        with self.assertRaises(HTTPException) as raised:
            get_current_user(None)
        self.assertEqual(raised.exception.status_code, 401)
        self.assertEqual(raised.exception.detail["code"], "AUTH_REQUIRED")

    @patch("server.utils.auth.auth_service.get_user", side_effect=ValueError("invalid"))
    def test_invalid_supabase_token_is_rejected(self, _mock_get_user):
        credentials = HTTPAuthorizationCredentials(scheme="Bearer", credentials="invalid-token")
        with self.assertRaises(HTTPException) as raised:
            get_current_user(credentials)
        self.assertEqual(raised.exception.status_code, 401)
        self.assertEqual(raised.exception.detail["code"], "INVALID_SESSION")

    @patch("server.utils.auth.auth_service.get_user", side_effect=AuthProviderUnavailableError("private upstream detail"))
    def test_provider_unavailable_is_not_mapped_to_invalid_credentials(self, _mock_get_user):
        credentials = HTTPAuthorizationCredentials(scheme="Bearer", credentials="valid-token")
        with self.assertRaises(HTTPException) as raised:
            get_current_user(credentials)
        self.assertEqual(raised.exception.status_code, 503)
        self.assertEqual(raised.exception.detail["code"], "AUTH_PROVIDER_UNAVAILABLE")
        self.assertNotIn("private upstream detail", str(raised.exception.detail))

    @patch("server.utils.auth.auth_service.get_user", return_value={"id": "user-1", "email": "user@gmail.com"})
    def test_verified_identity_is_returned_from_supabase(self, mock_get_user):
        credentials = HTTPAuthorizationCredentials(scheme="Bearer", credentials="valid-token")
        self.assertEqual(
            get_current_user(credentials),
            {"id": "user-1", "email": "user@gmail.com", "_access_token": "valid-token"},
        )
        mock_get_user.assert_called_once_with("valid-token")


if __name__ == "__main__":
    unittest.main()
