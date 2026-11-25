import unittest
from unittest.mock import patch

from server.routers import auth as auth_router
from server.config.auth_config import AuthConfig, AuthProviderUnavailableError
from server.services.auth_service import AuthService


class TestAuthApiRoutes(unittest.IsolatedAsyncioTestCase):
    async def test_provider_unavailable_is_reported_as_service_unavailable(self):
        with self.assertRaises(Exception) as raised:
            auth_router._raise_auth_error(AuthProviderUnavailableError("private upstream detail"), "LOGIN_AUTH_ERROR")
        self.assertEqual(raised.exception.status_code, 503)
        self.assertEqual(raised.exception.detail["code"], "AUTH_PROVIDER_UNAVAILABLE")
        self.assertNotIn("private upstream detail", str(raised.exception.detail))

    async def test_registration_returns_confirmation_required_without_authenticated_session(self):
        payload = auth_router.RegisterRequest(
            fullName="Petani Contoh",
            email="petani@gmail.com",
            password="Password123",
        )
        with patch.object(auth_router.auth_service, "register_gmail_user", return_value={
            "confirmation_required": True,
            "user": {"email": "petani@gmail.com"},
            "message": "Verifikasi email",
        }):
            response = await auth_router.register_user(payload)
        self.assertEqual(response["data"]["confirmation_required"], True)
        self.assertNotIn("access_token", response["data"])

    async def test_otp_verification_returns_a_supabase_session(self):
        payload = auth_router.VerifyOtpRequest(email="petani@gmail.com", otpCode="123456", purpose="register")
        session = {
            "user": {"id": "user-id", "email": "petani@gmail.com"},
            "access_token": "verified-token",
            "refresh_token": "refresh-token",
        }
        with patch.object(auth_router.auth_service, "verify_otp", return_value=session):
            response = await auth_router.verify_otp(payload)
        self.assertEqual(response["data"]["access_token"], "verified-token")

    async def test_session_route_rejects_missing_bearer_token(self):
        with self.assertRaises(Exception) as raised:
            await auth_router.verify_session(None)
        self.assertEqual(raised.exception.status_code, 401)
        self.assertEqual(raised.exception.detail["code"], "AUTH_REQUIRED")

    async def test_session_route_returns_only_supabase_verified_user(self):
        user = {"id": "verified-id", "email": "petani@gmail.com"}
        with patch.object(auth_router.auth_service, "get_user", return_value=user) as get_user:
            response = await auth_router.verify_session("Bearer access-token")
        get_user.assert_called_once_with("access-token")
        self.assertEqual(response["data"]["user"], user)


class TestNoFileBackedAuth(unittest.TestCase):
    def test_auth_service_has_no_users_or_otp_file_store(self):
        service = AuthService(config=AuthConfig(app_env="development", auth_mode="supabase", supabase_url="https://example.supabase.co", supabase_anon_key="anon"))
        self.assertFalse(hasattr(service, "users_path"))
        self.assertFalse(hasattr(service, "otp_path"))


if __name__ == "__main__":
    unittest.main()
