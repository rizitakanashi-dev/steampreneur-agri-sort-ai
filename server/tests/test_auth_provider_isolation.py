import unittest
from unittest.mock import Mock, patch

from server.config.auth_config import AuthConfig, AuthProviderUnavailableError
from server.services.auth_service import AuthService


def supabase_config():
    return AuthConfig(
        app_env="development",
        auth_mode="supabase",
        supabase_url="https://example.supabase.co",
        supabase_anon_key="anon-key",
    )


def local_config():
    return AuthConfig(app_env="development", auth_mode="local")


class TestAuthProviderIsolation(unittest.TestCase):
    def test_all_auth_operations_fail_closed_before_startup_configuration(self):
        service = AuthService()
        operations = (
            lambda: service.register_gmail_user("User Test", "user@gmail.com", "Password123"),
            lambda: service.login_gmail_user("user@gmail.com", "Password123"),
            lambda: service.authenticate_google("google-id-token"),
            lambda: service.send_otp("user@gmail.com", "register"),
            lambda: service.verify_otp("user@gmail.com", "123456", "register"),
            lambda: service.reset_password("user@gmail.com", "123456", "NewPassword123"),
            lambda: service.get_user("access-token"),
            lambda: service.refresh_session("refresh-token"),
            lambda: service.logout("access-token"),
        )
        for operation in operations:
            with self.subTest(operation=operation), self.assertRaisesRegex(RuntimeError, "not been configured"):
                operation()

    def test_supabase_mode_rejects_local_access_token_without_reading_state(self):
        service = AuthService(config=supabase_config(), transport=Mock())
        with patch("server.services.auth_service._read_local_state", side_effect=AssertionError("local state read")):
            with self.assertRaises(ValueError):
                service.get_user("ags_at_legacy")

    def test_supabase_mode_rejects_local_refresh_token_without_reading_state(self):
        service = AuthService(config=supabase_config(), transport=Mock())
        with patch("server.services.auth_service._read_local_state", side_effect=AssertionError("local state read")):
            with self.assertRaises(ValueError):
                service.refresh_session("ags_rt_legacy")

    def test_supabase_mode_rejects_local_logout_token_without_reading_state(self):
        service = AuthService(config=supabase_config(), transport=Mock())
        with patch("server.services.auth_service._read_local_state", side_effect=AssertionError("local state read")):
            with self.assertRaises(ValueError):
                service.logout("ags_at_legacy")

    def test_supabase_outage_does_not_read_or_write_local_state(self):
        transport = Mock(side_effect=AuthProviderUnavailableError("unavailable"))
        service = AuthService(config=supabase_config(), transport=transport)
        with patch("server.services.auth_service._read_local_state", side_effect=AssertionError("local state read")), patch(
            "server.services.auth_service._write_local_state", side_effect=AssertionError("local state write")
        ):
            with self.assertRaises(AuthProviderUnavailableError):
                service.login_gmail_user("user@gmail.com", "Password123")
        transport.assert_called_once()

    def test_local_mode_rejects_non_local_access_and_refresh_tokens(self):
        service = AuthService(config=local_config(), transport=Mock())
        with patch("server.services.auth_service._read_local_state", side_effect=AssertionError("local state read")):
            with self.assertRaises(ValueError):
                service.get_user("supabase-access-token")
            with self.assertRaises(ValueError):
                service.refresh_session("supabase-refresh-token")

    def test_local_session_creation_is_forbidden_in_supabase_mode(self):
        service = AuthService(config=supabase_config())
        with patch("server.services.auth_service._read_local_state", side_effect=AssertionError("local state read")):
            with self.assertRaises(RuntimeError):
                service._create_local_session({"id": "user-1"})

    def test_provider_configuration_cannot_change_after_selection(self):
        service = AuthService(config=local_config())
        with self.assertRaisesRegex(RuntimeError, "immutable"):
            service.configure(supabase_config())

    def test_local_refresh_uses_only_temporary_state(self):
        service = AuthService(config=local_config())
        with patch("server.services.auth_service._read_local_state", return_value={
            "users": {},
            "otps": {},
            "sessions": {
                "ags_at_old": {
                    "user": {"id": "local-user", "email": "dev@example.test"},
                    "refresh_token": "ags_rt_old",
                    "expires_at": 4_102_444_800,
                }
            },
        }) as read_state, patch("server.services.auth_service._write_local_state") as write_state, patch.object(
            service, "_create_local_session", return_value={"access_token": "ags_at_new"}
        ) as create_session:
            result = service.refresh_session("ags_rt_old")
        self.assertEqual(result, {"access_token": "ags_at_new"})
        read_state.assert_called_once()
        write_state.assert_called_once()
        create_session.assert_called_once_with({"id": "local-user", "email": "dev@example.test"})

    def test_supabase_signup_login_google_and_otp_use_only_remote_transport(self):
        transport = Mock(side_effect=[
            {"id": "pending", "email": "user@gmail.com"},
            {"access_token": "login", "refresh_token": "refresh", "user": {"id": "user", "email": "user@gmail.com"}},
            {"access_token": "google", "refresh_token": "refresh", "user": {"id": "user", "email": "user@gmail.com"}},
            {"access_token": "verified", "refresh_token": "refresh", "user": {"id": "user", "email": "user@gmail.com"}},
        ])
        service = AuthService(config=supabase_config(), transport=transport)
        with patch("server.services.auth_service._read_local_state", side_effect=AssertionError("local state read")), patch(
            "server.services.auth_service._write_local_state", side_effect=AssertionError("local state write")
        ):
            self.assertTrue(service.register_gmail_user("User Test", "user@gmail.com", "Password123")["confirmation_required"])
            self.assertEqual(service.login_gmail_user("user@gmail.com", "Password123")["access_token"], "login")
            self.assertEqual(service.authenticate_google("google-id-token")["access_token"], "google")
            self.assertEqual(service.verify_otp("user@gmail.com", "123456", "register")["access_token"], "verified")
        self.assertEqual(transport.call_count, 4)
        self.assertTrue(transport.call_args_list[0].args[1].endswith("/auth/v1/signup"))
        self.assertTrue(transport.call_args_list[1].args[1].endswith("/auth/v1/token?grant_type=password"))
        self.assertTrue(transport.call_args_list[2].args[1].endswith("/auth/v1/token?grant_type=id_token"))
        self.assertTrue(transport.call_args_list[3].args[1].endswith("/auth/v1/verify"))

    def test_supabase_refresh_and_logout_use_remote_transport_only(self):
        transport = Mock(return_value={"access_token": "new", "refresh_token": "next", "user": {"id": "u", "email": "user@gmail.com"}})
        service = AuthService(config=supabase_config(), transport=transport)
        with patch("server.services.auth_service._read_local_state", side_effect=AssertionError("local state read")), patch(
            "server.services.auth_service._write_local_state", side_effect=AssertionError("local state write")
        ):
            self.assertEqual(service.refresh_session("refresh-token")["access_token"], "new")
            service.logout("supabase-access-token")
        self.assertEqual(transport.call_count, 2)
        self.assertTrue(transport.call_args_list[0].args[1].endswith("/auth/v1/token?grant_type=refresh_token"))
        self.assertTrue(transport.call_args_list[1].args[1].endswith("/auth/v1/logout"))

    def test_password_recovery_uses_supabase_for_verify_and_update(self):
        transport = Mock(side_effect=[
            {
                "access_token": "recovery-token",
                "refresh_token": "refresh-token",
                "user": {"id": "user-1", "email": "user@gmail.com"},
            },
            {"id": "user-1", "email": "user@gmail.com"},
        ])
        service = AuthService(config=supabase_config(), transport=transport)
        result = service.reset_password("user@gmail.com", "123456", "NewPassword123")
        self.assertEqual(result["message"], "Kata sandi berhasil diperbarui.")
        self.assertTrue(transport.call_args_list[0].args[1].endswith("/auth/v1/verify"))
        self.assertTrue(transport.call_args_list[1].args[1].endswith("/auth/v1/user"))


if __name__ == "__main__":
    unittest.main()
