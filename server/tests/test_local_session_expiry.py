from datetime import datetime, timedelta, timezone
import json
from pathlib import Path
import tempfile
import unittest
from unittest.mock import patch

from server.config.auth_config import AuthConfig
from server.services.auth_service import AuthService


class TestLocalSessionExpiry(unittest.TestCase):
    def test_expired_local_access_token_is_rejected(self):
        with tempfile.TemporaryDirectory(prefix="agri-auth-test-") as temp_dir:
            state_path = Path(temp_dir) / "local_auth_state.json"
            token = "ags_at_expired"
            state_path.write_text(
                json.dumps(
                    {
                        "users": {},
                        "otps": {},
                        "sessions": {
                            token: {
                                "user": {"id": "user-1", "email": "user@example.com"},
                                "expires_at": int((datetime.now(timezone.utc) - timedelta(seconds=1)).timestamp()),
                            }
                        },
                    }
                ),
                encoding="utf-8",
            )
            service = AuthService(config=AuthConfig(app_env="development", auth_mode="local"))
            with patch("server.services.auth_service._LOCAL_STATE_PATH", state_path):
                with self.assertRaises(ValueError):
                    service.get_user(token)

    def test_unexpired_local_access_token_remains_compatible(self):
        with tempfile.TemporaryDirectory(prefix="agri-auth-test-") as temp_dir:
            state_path = Path(temp_dir) / "local_auth_state.json"
            token = "ags_at_valid"
            user = {"id": "user-1", "email": "user@example.com"}
            state_path.write_text(
                json.dumps(
                    {
                        "users": {},
                        "otps": {},
                        "sessions": {
                            token: {
                                "user": user,
                                "expires_at": int((datetime.now(timezone.utc) + timedelta(minutes=5)).timestamp()),
                            }
                        },
                    }
                ),
                encoding="utf-8",
            )
            service = AuthService(config=AuthConfig(app_env="development", auth_mode="local"))
            with patch("server.services.auth_service._LOCAL_STATE_PATH", state_path):
                self.assertEqual(service.get_user(token), user)


if __name__ == "__main__":
    unittest.main()
