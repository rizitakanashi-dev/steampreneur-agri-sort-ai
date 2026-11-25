import unittest
from unittest.mock import Mock

from server.config.auth_config import AuthConfig
from server.services.auth_service import AuthService


def supabase_config():
    return AuthConfig(
        app_env="development",
        auth_mode="supabase",
        supabase_url="https://example.supabase.co",
        supabase_anon_key="anon-key",
    )


class TestSupabaseAuthService(unittest.TestCase):
    def test_auth_requests_fail_closed_before_startup_configuration(self):
        service = AuthService()

        with self.assertRaisesRegex(RuntimeError, "not been configured"):
            service.login_gmail_user("user@gmail.com", "Password123")

    def test_signup_does_not_create_a_session_until_signup_otp_is_verified(self):
        transport = Mock(return_value={"id": "pending-user", "email": "user@gmail.com"})
        service = AuthService(config=supabase_config(), transport=transport)

        result = service.register_gmail_user("User Uji", "user@gmail.com", "Password123")

        self.assertTrue(result["confirmation_required"])
        self.assertNotIn("access_token", result)
        self.assertEqual(transport.call_args.args[0], "POST")
        self.assertTrue(transport.call_args.args[1].endswith("/auth/v1/signup"))

    def test_signup_otp_verification_returns_supabase_session(self):
        transport = Mock(return_value={
            "access_token": "access-token",
            "refresh_token": "refresh-token",
            "user": {"id": "verified-user", "email": "user@gmail.com", "user_metadata": {"full_name": "User Uji"}},
        })
        service = AuthService(config=supabase_config(), transport=transport)

        result = service.verify_otp("user@gmail.com", "123456", "register")

        self.assertEqual(result["access_token"], "access-token")
        self.assertEqual(result["user"]["email"], "user@gmail.com")
        self.assertTrue(transport.call_args.args[1].endswith("/auth/v1/verify"))
        self.assertEqual(transport.call_args.args[3]["type"], "signup")

    def test_access_token_is_validated_against_supabase_auth(self):
        transport = Mock(return_value={"id": "verified-user", "email": "user@gmail.com"})
        service = AuthService(config=supabase_config(), transport=transport)

        user = service.get_user("access-token")

        self.assertEqual(user["id"], "verified-user")
        self.assertTrue(transport.call_args.args[1].endswith("/auth/v1/user"))
        self.assertEqual(transport.call_args.args[2]["Authorization"], "Bearer access-token")

    def test_recovery_otp_updates_password_only_after_supabase_verification(self):
        transport = Mock(side_effect=[
            {
                "access_token": "recovery-token",
                "refresh_token": "refresh-token",
                "user": {"id": "verified-user", "email": "user@gmail.com"},
            },
            {"id": "verified-user", "email": "user@gmail.com"},
        ])
        service = AuthService(config=supabase_config(), transport=transport)

        result = service.reset_password("user@gmail.com", "123456", "NewPassword123")

        self.assertEqual(result["message"], "Kata sandi berhasil diperbarui.")
        self.assertTrue(transport.call_args_list[0].args[1].endswith("/auth/v1/verify"))
        self.assertTrue(transport.call_args_list[1].args[1].endswith("/auth/v1/user"))
        self.assertEqual(transport.call_args_list[1].args[2]["Authorization"], "Bearer recovery-token")


if __name__ == "__main__":
    unittest.main()
