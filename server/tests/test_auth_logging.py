import io
import json
import logging
import unittest
import urllib.error
from unittest.mock import patch

from server.services.auth_service import _request_supabase
from server.config.auth_config import AuthProviderUnavailableError


class TestAuthLoggingSafety(unittest.TestCase):
    def test_supabase_error_body_is_not_returned_to_callers(self):
        sensitive_values = ("access-secret", "user@example.com", "Password123", "654321", "anon-key")
        body = json.dumps({"message": " ".join(sensitive_values)}).encode("utf-8")
        error = urllib.error.HTTPError(
            "https://example.supabase.co/auth/v1/token",
            400,
            "Bad Request",
            {},
            io.BytesIO(body),
        )
        with patch("server.services.auth_service.urllib.request.urlopen", side_effect=error):
            with self.assertRaises(ValueError) as raised:
                _request_supabase("POST", "https://example.supabase.co/auth/v1/token", {}, {})
        for value in sensitive_values:
            self.assertNotIn(value, str(raised.exception))

    def test_provider_outage_log_does_not_include_url_or_credentials(self):
        logger = logging.getLogger("agrisort.auth")
        captured = io.StringIO()
        handler = logging.StreamHandler(captured)
        logger.addHandler(handler)
        logger.setLevel(logging.WARNING)
        try:
            with patch("server.services.auth_service.urllib.request.urlopen", side_effect=TimeoutError("private-token")):
                with self.assertRaises(AuthProviderUnavailableError):
                    _request_supabase(
                        "GET",
                        "https://private-user:private-password@example.supabase.co/auth/v1/user?access_token=secret",
                        {"Authorization": "Bearer private-token"},
                    )
        finally:
            logger.removeHandler(handler)
        output = captured.getvalue()
        for value in ("private-user", "private-password", "secret", "private-token", "Authorization"):
            self.assertNotIn(value, output)
        self.assertIn("Supabase Auth provider unavailable", output)


if __name__ == "__main__":
    unittest.main()
