import os
import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch

from server.config.auth_config import AuthConfigurationError, AuthConfig


class TestAuthConfig(unittest.TestCase):
    def config(self, **overrides):
        env = {
            "APP_ENV": "development",
            "AUTH_MODE": "supabase",
            "SUPABASE_URL": "https://example.supabase.co",
            "SUPABASE_ANON_KEY": "anon-key",
        }
        env.update(overrides)
        return AuthConfig.from_env(env)

    def test_missing_environment_is_rejected(self):
        with self.assertRaisesRegex(AuthConfigurationError, "APP_ENV"):
            self.config(APP_ENV="")

    def test_missing_auth_mode_is_rejected(self):
        with self.assertRaisesRegex(AuthConfigurationError, "AUTH_MODE"):
            self.config(AUTH_MODE="")

    def test_unknown_environment_or_mode_is_rejected(self):
        for values, setting in [
            ({"APP_ENV": "prod"}, "APP_ENV"),
            ({"AUTH_MODE": "automatic"}, "AUTH_MODE"),
        ]:
            with self.subTest(setting=setting), self.assertRaisesRegex(AuthConfigurationError, setting):
                self.config(**values)

    def test_production_rejects_local_mode(self):
        with self.assertRaisesRegex(AuthConfigurationError, "AUTH_MODE"):
            self.config(APP_ENV="production", AUTH_MODE="local")

    def test_supabase_mode_requires_both_credentials(self):
        for setting in ("SUPABASE_URL", "SUPABASE_ANON_KEY"):
            with self.subTest(setting=setting), self.assertRaisesRegex(AuthConfigurationError, setting):
                self.config(APP_ENV="production", **{setting: ""})

    def test_development_local_requires_explicit_mode(self):
        config = self.config(AUTH_MODE="local")
        self.assertEqual((config.app_env, config.auth_mode), ("development", "local"))

    def test_preview_and_staging_accept_supabase_mode(self):
        for app_env in ("preview", "staging"):
            with self.subTest(app_env=app_env):
                self.assertEqual(self.config(APP_ENV=app_env).auth_mode, "supabase")

    def test_non_development_rejects_local_mode(self):
        for app_env in ("preview", "staging"):
            with self.subTest(app_env=app_env), self.assertRaisesRegex(AuthConfigurationError, "AUTH_MODE"):
                self.config(APP_ENV=app_env, AUTH_MODE="local")

    def test_vercel_environment_must_match_application_environment(self):
        with self.assertRaisesRegex(AuthConfigurationError, "VERCEL_ENV"):
            self.config(APP_ENV="development", VERCEL_ENV="production")

    def test_vercel_requires_authoritative_vercel_environment(self):
        with self.assertRaisesRegex(AuthConfigurationError, "VERCEL_ENV"):
            self.config(AUTH_MODE="local", VERCEL="1")

    def test_vercel_development_must_match_explicit_development_mode(self):
        self.assertEqual(
            self.config(APP_ENV="development", VERCEL_ENV="development").app_env,
            "development",
        )

    def test_staging_can_use_preview_deployment_environment(self):
        self.assertEqual(self.config(APP_ENV="staging", VERCEL_ENV="preview").app_env, "staging")

    def test_invalid_or_credential_bearing_url_is_rejected_without_echoing_secret(self):
        secret_url = "https://private-user:private-password@example.supabase.co"
        with self.assertRaises(AuthConfigurationError) as raised:
            self.config(APP_ENV="production", SUPABASE_URL=secret_url)
        self.assertNotIn("private-user", str(raised.exception))
        self.assertNotIn("private-password", str(raised.exception))
        with self.assertRaisesRegex(AuthConfigurationError, "SUPABASE_URL"):
            self.config(APP_ENV="production", SUPABASE_URL="not a url")

    def test_service_role_jwt_is_rejected_without_echoing_key(self):
        import base64

        payload = base64.urlsafe_b64encode(b'{"role":"service_role"}').decode().rstrip("=")
        key = f"header.{payload}.signature"
        with self.assertRaisesRegex(AuthConfigurationError, "SUPABASE_ANON_KEY") as raised:
            self.config(SUPABASE_ANON_KEY=key)
        self.assertNotIn(key, str(raised.exception))

    def test_environment_variables_take_precedence_over_local_env_file(self):
        from server.config.auth_config import _load_local_development_env

        with tempfile.TemporaryDirectory(prefix="agri-auth-config-test-") as temp_dir:
            root = Path(temp_dir)
            (root / ".env").write_text("APP_ENV=production\nAUTH_MODE=supabase\n", encoding="utf-8")
            with patch("server.config.auth_config.Path.resolve", return_value=root / "server/config/auth_config.py"), patch.dict(
                os.environ,
                {"APP_ENV": "development", "AUTH_MODE": "local"},
                clear=True,
            ):
                _load_local_development_env()
                self.assertEqual(os.environ["APP_ENV"], "development")
                self.assertEqual(os.environ["AUTH_MODE"], "local")

    def test_local_env_file_can_supply_missing_development_settings(self):
        from server.config.auth_config import _load_local_development_env

        with tempfile.TemporaryDirectory(prefix="agri-auth-config-test-") as temp_dir:
            root = Path(temp_dir)
            (root / ".env").write_text(
                "APP_ENV=development\nAUTH_MODE=local\n"
                "SUPABASE_SERVICE_ROLE_KEY=local-service-key\n"
                "SUPABASE_EXPORT_BUCKET=local-exports\n"
                "EXPORT_HMAC_KEY=local-signing-key\n",
                encoding="utf-8",
            )
            with patch("server.config.auth_config.Path.resolve", return_value=root / "server/config/auth_config.py"), patch.dict(os.environ, {}, clear=True):
                _load_local_development_env()
                self.assertEqual(os.environ["APP_ENV"], "development")
                self.assertEqual(os.environ["AUTH_MODE"], "local")
                self.assertEqual(os.environ["SUPABASE_EXPORT_BUCKET"], "local-exports")
                self.assertEqual(os.environ["EXPORT_HMAC_KEY"], "local-signing-key")

    def test_http_url_is_only_allowed_for_local_development_host(self):
        self.assertEqual(
            self.config(SUPABASE_URL="http://localhost:54321").supabase_url,
            "http://localhost:54321",
        )
        with self.assertRaisesRegex(AuthConfigurationError, "SUPABASE_URL"):
            self.config(APP_ENV="production", SUPABASE_URL="http://example.supabase.co")


if __name__ == "__main__":
    unittest.main()
