"""Explicit, immutable authentication mode configuration."""

import base64
from dataclasses import dataclass
import json
import os
from pathlib import Path
from typing import Mapping
from urllib.parse import urlsplit


class AuthConfigurationError(ValueError):
    """Raised when auth configuration violates the environment policy."""


class AuthProviderUnavailableError(RuntimeError):
    """Raised when the selected remote authentication provider is unavailable."""


@dataclass(frozen=True)
class AuthConfig:
    app_env: str
    auth_mode: str
    supabase_url: str = ""
    supabase_anon_key: str = ""

    @classmethod
    def from_env(cls, env: Mapping[str, str]) -> "AuthConfig":
        app_env = env.get("APP_ENV", "").strip().lower()
        auth_mode = env.get("AUTH_MODE", "").strip().lower()
        if app_env not in {"development", "preview", "staging", "production"}:
            raise AuthConfigurationError("APP_ENV must be development, preview, staging, or production")
        if auth_mode not in {"local", "supabase"}:
            raise AuthConfigurationError("AUTH_MODE must be local or supabase")

        vercel_env = env.get("VERCEL_ENV", "").strip().lower()
        if env.get("VERCEL", "").strip() and not vercel_env:
            raise AuthConfigurationError("VERCEL_ENV is required when running on Vercel")
        if vercel_env:
            compatible_apps = {
                "production": {"production"},
                "preview": {"preview", "staging"},
                "development": {"development"},
            }.get(vercel_env)
            if compatible_apps is None or app_env not in compatible_apps:
                raise AuthConfigurationError("APP_ENV must match VERCEL_ENV")

        if auth_mode == "local":
            if app_env != "development" or vercel_env:
                raise AuthConfigurationError("AUTH_MODE=local is allowed only in explicit local development")
            return cls(app_env=app_env, auth_mode=auth_mode)

        supabase_url = env.get("SUPABASE_URL", "").strip().rstrip("/")
        supabase_anon_key = env.get("SUPABASE_ANON_KEY", "").strip()
        if not supabase_url:
            raise AuthConfigurationError("SUPABASE_URL is required when AUTH_MODE=supabase")
        if not supabase_anon_key:
            raise AuthConfigurationError("SUPABASE_ANON_KEY is required when AUTH_MODE=supabase")
        if _is_service_role_key(supabase_anon_key):
            raise AuthConfigurationError("SUPABASE_ANON_KEY must not be a service-role key")

        try:
            parsed_url = urlsplit(supabase_url)
            _ = parsed_url.port
            valid_url = (
                parsed_url.scheme in {"https", "http"}
                and bool(parsed_url.hostname)
                and parsed_url.username is None
                and parsed_url.password is None
                and parsed_url.query == ""
                and parsed_url.fragment == ""
                and parsed_url.path in {"", "/"}
            )
        except ValueError:
            valid_url = False
        if not valid_url:
            raise AuthConfigurationError("SUPABASE_URL must be a valid URL without credentials or path")

        is_local_host = parsed_url.hostname in {"localhost", "127.0.0.1", "::1"}
        if parsed_url.scheme != "https" and not (app_env == "development" and is_local_host):
            raise AuthConfigurationError("SUPABASE_URL must use HTTPS outside local development")

        return cls(
            app_env=app_env,
            auth_mode=auth_mode,
            supabase_url=supabase_url,
            supabase_anon_key=supabase_anon_key,
        )


def _is_service_role_key(key: str) -> bool:
    if key.startswith("sb_secret_"):
        return True
    parts = key.split(".")
    if len(parts) != 3:
        return False
    try:
        payload = parts[1] + "=" * (-len(parts[1]) % 4)
        claims = json.loads(base64.urlsafe_b64decode(payload).decode("utf-8"))
    except (ValueError, UnicodeDecodeError):
        return False
    return isinstance(claims, dict) and claims.get("role") == "service_role"


def _load_local_development_env() -> None:
    """Load missing settings from .env only for an explicitly local process."""
    if os.environ.get("VERCEL_ENV") or os.environ.get("VERCEL"):
        return
    project_root = Path(__file__).resolve().parents[2]
    allowed_keys = {
        "APP_ENV",
        "AUTH_MODE",
        "SUPABASE_URL",
        "SUPABASE_ANON_KEY",
        "SMTP_EMAIL",
        "SMTP_APP_PASSWORD",
        "SUPABASE_SERVICE_ROLE_KEY",
        "SUPABASE_EXPORT_BUCKET",
        "EXPORT_HMAC_KEY",
    }
    try:
        lines = (project_root / ".env").read_text(encoding="utf-8").splitlines()
    except OSError:
        return
    for raw_line in lines:
        line = raw_line.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        key, value = line.split("=", 1)
        key = key.strip()
        if key in allowed_keys and key not in os.environ:
            os.environ[key] = value.strip().strip('"').strip("'")


def load_auth_config() -> AuthConfig:
    """Load and validate process settings without allowing files to override them."""
    if not os.environ.get("VERCEL_ENV") and not os.environ.get("VERCEL"):
        _load_local_development_env()
    return AuthConfig.from_env(os.environ)
