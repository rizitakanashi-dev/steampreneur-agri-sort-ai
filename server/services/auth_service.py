"""Supabase Auth integration for Agri-Sort AI."""

import json
import logging
import os
from typing import Any, Callable, Dict, Optional
import urllib.error
import urllib.parse
import urllib.request

logger = logging.getLogger("agrisort.auth")


def _load_local_auth_config() -> None:
    """Load only Supabase settings from the project .env without replacing deployment env."""
    env_path = os.path.join(os.path.dirname(__file__), "..", "..", ".env")
    try:
        with open(os.path.abspath(env_path), encoding="utf-8") as env_file:
            for raw_line in env_file:
                line = raw_line.strip()
                if not line or line.startswith("#") or "=" not in line:
                    continue
                key, value = line.split("=", 1)
                key = key.strip()
                if key in {"SUPABASE_URL", "SUPABASE_ANON_KEY"} and key not in os.environ:
                    os.environ[key] = value.strip().strip('"').strip("'")
    except OSError:
        pass


_load_local_auth_config()


def _request_supabase(
    method: str,
    url: str,
    headers: Dict[str, str],
    payload: Optional[Dict[str, Any]] = None,
) -> Dict[str, Any]:
    data = json.dumps(payload).encode("utf-8") if payload is not None else None
    req = urllib.request.Request(url, data=data, headers=headers, method=method)
    try:
        with urllib.request.urlopen(req, timeout=10) as response:
            body = response.read().decode("utf-8")
            return json.loads(body) if body else {}
    except urllib.error.HTTPError as exc:
        try:
            error = json.loads(exc.read().decode("utf-8"))
            message = error.get("msg") or error.get("message") or error.get("error_description") or error.get("error")
        except (json.JSONDecodeError, UnicodeDecodeError):
            message = None
        raise ValueError(message or "Permintaan autentikasi ditolak.") from exc
    except (urllib.error.URLError, TimeoutError) as exc:
        logger.warning("Supabase Auth request failed: %s", exc)
        raise RuntimeError("Tidak dapat menghubungi layanan autentikasi.") from exc


class AuthService:
    """Small server-side client for Supabase Auth REST endpoints."""

    def __init__(
        self,
        supabase_url: Optional[str] = None,
        supabase_anon_key: Optional[str] = None,
        transport: Optional[Callable[..., Dict[str, Any]]] = None,
    ) -> None:
        self.supabase_url = (supabase_url if supabase_url is not None else os.environ.get("SUPABASE_URL", "")).strip().rstrip("/")
        self.supabase_anon_key = (supabase_anon_key if supabase_anon_key is not None else os.environ.get("SUPABASE_ANON_KEY", "")).strip()
        self.transport = transport or _request_supabase

    def _request(
        self,
        method: str,
        path: str,
        payload: Optional[Dict[str, Any]] = None,
        access_token: Optional[str] = None,
    ) -> Dict[str, Any]:
        if not self.supabase_url or not self.supabase_anon_key:
            raise RuntimeError("Supabase Auth belum dikonfigurasi di server.")
        headers = {
            "apikey": self.supabase_anon_key,
            "Authorization": f"Bearer {access_token or self.supabase_anon_key}",
            "Content-Type": "application/json",
        }
        return self.transport(method, f"{self.supabase_url}/auth/v1{path}", headers, payload)

    @staticmethod
    def _user_payload(user: Optional[Dict[str, Any]]) -> Dict[str, Any]:
        user = user or {}
        metadata = user.get("user_metadata") or {}
        email = str(user.get("email") or "").strip().lower()
        return {
            "id": user.get("id"),
            "fullName": metadata.get("full_name") or metadata.get("name") or (email.split("@")[0] if email else "Pengguna"),
            "email": email,
            "provider": (user.get("app_metadata") or {}).get("provider", "email"),
            "picture": metadata.get("avatar_url") or metadata.get("picture"),
            "createdAt": user.get("created_at"),
        }

    @classmethod
    def _session_payload(cls, response: Dict[str, Any]) -> Dict[str, Any]:
        user = response.get("user") or {}
        if not response.get("access_token") or not user.get("id"):
            raise ValueError("Email atau kode OTP belum terverifikasi.")
        return {
            "user": cls._user_payload(user),
            "access_token": response["access_token"],
            "refresh_token": response.get("refresh_token"),
            "expires_at": response.get("expires_at"),
            "token_type": response.get("token_type", "bearer"),
        }

    def register_gmail_user(self, full_name: str, email: str, password: str) -> Dict[str, Any]:
        clean_name = (full_name or "").strip()
        clean_email = (email or "").strip().lower()
        if len(clean_name) < 3:
            raise ValueError("Nama lengkap minimal 3 karakter.")
        if "@gmail.com" not in clean_email or not clean_email.endswith("@gmail.com"):
            raise ValueError("Gunakan alamat Gmail yang valid (contoh: nama@gmail.com).")
        if len(password or "") < 8 or not any(c.isalpha() for c in password) or not any(c.isdigit() for c in password):
            raise ValueError("Password minimal 8 karakter dengan kombinasi huruf dan angka.")

        response = self._request(
            "POST",
            "/signup",
            {"email": clean_email, "password": password, "data": {"full_name": clean_name}},
        )
        signup_user = response.get("user") or response
        return {
            "confirmation_required": True,
            "user": self._user_payload(signup_user),
            "message": "Masukkan kode verifikasi yang dikirim ke email Anda.",
        }

    def login_gmail_user(self, email: str, password: str) -> Dict[str, Any]:
        clean_email = (email or "").strip().lower()
        if not clean_email.endswith("@gmail.com") or not password:
            raise ValueError("Periksa kembali alamat Gmail dan kata sandi Anda.")
        response = self._request(
            "POST",
            "/token?grant_type=password",
            {"email": clean_email, "password": password},
        )
        return self._session_payload(response)

    def verify_otp(self, email: str, token: str, purpose: str) -> Dict[str, Any]:
        otp_type = {"register": "signup", "reset_password": "recovery"}.get(purpose)
        if not otp_type:
            raise ValueError("Tujuan verifikasi OTP tidak valid.")
        response = self._request(
            "POST",
            "/verify",
            {"email": (email or "").strip().lower(), "token": (token or "").strip(), "type": otp_type},
        )
        return self._session_payload(response)

    def send_otp(self, email: str, purpose: str) -> Dict[str, Any]:
        clean_email = (email or "").strip().lower()
        if not clean_email.endswith("@gmail.com"):
            raise ValueError("Masukkan alamat @gmail.com yang valid.")
        if purpose == "register":
            self._request("POST", "/resend", {"email": clean_email, "type": "signup"})
        elif purpose == "reset_password":
            self._request("POST", "/recover", {"email": clean_email})
        else:
            raise ValueError("Tujuan OTP tidak valid.")
        return {"email": clean_email, "purpose": purpose, "message": "Kode pemulihan telah dikirim ke email Anda."}

    def authenticate_google(self, id_token: str) -> Dict[str, Any]:
        if not id_token:
            raise ValueError("Token resmi Google wajib disertakan.")
        response = self._request(
            "POST",
            "/token?grant_type=id_token",
            {"provider": "google", "id_token": id_token},
        )
        return self._session_payload(response)

    def get_user(self, access_token: str) -> Dict[str, Any]:
        if not access_token:
            raise ValueError("Token sesi wajib disertakan.")
        user = self._request("GET", "/user", access_token=access_token)
        return self._user_payload(user)

    def refresh_session(self, refresh_token: str) -> Dict[str, Any]:
        if not refresh_token:
            raise ValueError("Token sesi kedaluwarsa. Silakan masuk kembali.")
        response = self._request("POST", "/token?grant_type=refresh_token", {"refresh_token": refresh_token})
        return self._session_payload(response)

    def logout(self, access_token: str) -> None:
        self._request("POST", "/logout", {}, access_token=access_token)

    def reset_password(self, email: str, otp_code: str, new_password: str) -> Dict[str, Any]:
        if len(new_password or "") < 8 or not any(c.isalpha() for c in new_password) or not any(c.isdigit() for c in new_password):
            raise ValueError("Password baru minimal 8 karakter dengan kombinasi huruf dan angka.")
        session = self.verify_otp(email, otp_code, "reset_password")
        self._request("PUT", "/user", {"password": new_password}, access_token=session["access_token"])
        return {"user": session["user"], "message": "Kata sandi berhasil diperbarui."}


# Keep a stable module-level singleton; environment configuration is read at import time.
auth_service = AuthService()
