"""Supabase Auth + Gmail SMTP / Official Google OAuth fallback integration for Agri-Sort AI."""

from datetime import datetime, timedelta, timezone
from email.message import EmailMessage
import hashlib
import hmac
import json
import logging
import os
from pathlib import Path
import re
import secrets
import smtplib
import threading
from typing import Any, Callable, Dict, Optional, Tuple
import urllib.error
import urllib.parse
import urllib.request
import uuid

logger = logging.getLogger("agrisort.auth")

_DATA_DIR = (
    Path("/tmp/agri-sort-data")
    if os.environ.get("VERCEL")
    else Path(__file__).parent.parent / "data"
)
_LOCAL_STATE_PATH = _DATA_DIR / "local_auth_state.json"
_local_lock = threading.Lock()
_OTP_EXPIRY_MINUTES = 5


def _load_local_auth_config() -> None:
    """Load auth & SMTP settings from the project .env dynamically."""
    env_path = os.path.join(os.path.dirname(__file__), "..", "..", ".env")
    try:
        with open(os.path.abspath(env_path), encoding="utf-8") as env_file:
            for raw_line in env_file:
                line = raw_line.strip()
                if not line or line.startswith("#") or "=" not in line:
                    continue
                key, value = line.split("=", 1)
                key = key.strip()
                val = value.strip().strip('"').strip("'")
                if key in {
                    "SUPABASE_URL",
                    "SUPABASE_ANON_KEY",
                    "SMTP_EMAIL",
                    "SMTP_APP_PASSWORD",
                    "VITE_GOOGLE_CLIENT_ID",
                }:
                    if val or key not in os.environ:
                        os.environ[key] = val
    except OSError:
        pass


_load_local_auth_config()


def _hash_password_pbkdf2(password: str, salt: Optional[str] = None) -> str:
    active_salt = salt or secrets.token_hex(16)
    dk = hashlib.pbkdf2_hmac(
        "sha256",
        password.encode("utf-8"),
        active_salt.encode("utf-8"),
        100_000,
    )
    return f"pbkdf2_sha256${active_salt}${dk.hex()}"


def _verify_password_pbkdf2(password: str, stored_hash: str) -> bool:
    if not stored_hash or "$" not in stored_hash:
        return False
    parts = stored_hash.split("$")
    if len(parts) != 3:
        return False
    _, salt, _ = parts
    candidate = _hash_password_pbkdf2(password, salt=salt)
    return hmac.compare_digest(candidate, stored_hash)


def _read_local_state() -> Dict[str, Any]:
    with _local_lock:
        try:
            if not _LOCAL_STATE_PATH.exists():
                return {"users": {}, "otps": {}, "sessions": {}}
            data = json.loads(_LOCAL_STATE_PATH.read_text(encoding="utf-8"))
            if not isinstance(data, dict):
                return {"users": {}, "otps": {}, "sessions": {}}
            data.setdefault("users", {})
            data.setdefault("otps", {})
            data.setdefault("sessions", {})
            return data
        except Exception:
            return {"users": {}, "otps": {}, "sessions": {}}


def _write_local_state(state: Dict[str, Any]) -> None:
    with _local_lock:
        try:
            _LOCAL_STATE_PATH.parent.mkdir(parents=True, exist_ok=True)
            _LOCAL_STATE_PATH.write_text(
                json.dumps(state, indent=2, ensure_ascii=False),
                encoding="utf-8",
            )
        except Exception as exc:
            logger.warning("Gagal menyimpan state auth lokal: %s", exc)


def _send_gmail_otp_email(recipient_email: str, otp_code: str, purpose: str) -> Tuple[bool, str]:
    _load_local_auth_config()
    smtp_email = os.environ.get("SMTP_EMAIL", "").strip()
    smtp_password = os.environ.get("SMTP_APP_PASSWORD", "").replace(" ", "").strip()

    if not smtp_email or not smtp_password:
        logger.warning("SMTP_EMAIL atau SMTP_APP_PASSWORD belum dikonfigurasi di .env.")
        return False, "SMTP_NOT_CONFIGURED"

    subject_map = {
        "register": f"[{otp_code}] Kode Verifikasi Pendaftaran Agri-Sort AI",
        "reset_password": f"[{otp_code}] Kode OTP Reset Kata Sandi Agri-Sort AI",
    }
    subject = subject_map.get(purpose, f"[{otp_code}] Kode OTP Keamanan Agri-Sort AI")
    purpose_title = (
        "Reset Kata Sandi Akun Anda"
        if purpose == "reset_password"
        else "Verifikasi Kepemilikan Akun Gmail Anda"
    )

    msg = EmailMessage()
    msg["Subject"] = subject
    msg["From"] = f"Agri-Sort AI Security <{smtp_email}>"
    msg["To"] = recipient_email
    msg.set_content(f"Kode OTP Agri-Sort AI Anda adalah: {otp_code} (Berlaku {_OTP_EXPIRY_MINUTES} menit).")
    msg.add_alternative(
        f"""
        <div style="font-family: 'Inter', Arial, sans-serif; max-width: 520px; margin: 0 auto; padding: 28px; border: 1px solid #e6ece8; border-radius: 16px; background-color: #ffffff; color: #17191c;">
          <div style="margin-bottom: 18px;">
            <span style="background-color: #e3f3ea; color: #034d32; padding: 6px 12px; border-radius: 999px; font-size: 12px; font-weight: 700;">
              Agri-Sort AI • SMKN 4 Payakumbuh
            </span>
          </div>
          <h2 style="margin: 0 0 10px 0; font-size: 20px; color: #17191c;">{purpose_title}</h2>
          <p style="font-size: 14px; color: #68736d; line-height: 1.5;">
            Gunakan kode OTP 6-digit berikut untuk memverifikasi akun <strong>{recipient_email}</strong>. Kode ini berlaku selama {_OTP_EXPIRY_MINUTES} menit:
          </p>
          <div style="margin: 24px 0; padding: 18px; border-radius: 12px; background-color: #f2f5f3; text-align: center; letter-spacing: 8px; font-size: 28px; font-weight: 800; color: #036e45;">
            {otp_code}
          </div>
          <p style="font-size: 12px; color: #8c9690; line-height: 1.4;">
            Jangan bagikan kode rahasia ini kepada siapa pun.
          </p>
        </div>
        """,
        subtype="html",
    )

    try:
        with smtplib.SMTP_SSL("smtp.gmail.com", 465, timeout=10) as smtp:
            smtp.login(smtp_email, smtp_password)
            smtp.send_message(msg)
        return True, "SENT_VIA_GMAIL_SMTP"
    except Exception as exc:
        logger.error("Gagal mengirim email OTP via SMTP Gmail: %s", exc)
        return False, f"SMTP_ERROR: {exc}"


def _verify_official_google_id_token(id_token: str) -> Dict[str, Any]:
    url = f"https://oauth2.googleapis.com/tokeninfo?id_token={urllib.parse.quote(id_token)}"
    try:
        with urllib.request.urlopen(url, timeout=8) as resp:
            data = json.loads(resp.read().decode("utf-8"))
            email = str(data.get("email") or "").strip().lower()
            email_verified = str(data.get("email_verified", "")).lower() == "true"
            if email and email_verified:
                local_part = email.split("@")[0]
                cleaned_name = " ".join(
                    w.capitalize() for w in re.sub(r"[._\d-]+", " ", local_part).split()
                ) or "Pengguna Google"
                return {
                    "email": email,
                    "full_name": data.get("name") or cleaned_name,
                    "picture": data.get("picture"),
                    "google_sub": data.get("sub"),
                }
    except Exception as exc:
        logger.warning("Verifikasi id_token Google gagal: %s", exc)
    raise ValueError("Token Google (id_token) tidak valid atau sudah kedaluwarsa.")


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
    """Server-side client for Supabase Auth with automatic Gmail SMTP & Google OAuth fallback."""

    def __init__(
        self,
        supabase_url: Optional[str] = None,
        supabase_anon_key: Optional[str] = None,
        transport: Optional[Callable[..., Dict[str, Any]]] = None,
    ) -> None:
        self._explicit_supabase = supabase_url is not None or supabase_anon_key is not None
        self.supabase_url = (supabase_url if supabase_url is not None else os.environ.get("SUPABASE_URL", "")).strip().rstrip("/")
        self.supabase_anon_key = (supabase_anon_key if supabase_anon_key is not None else os.environ.get("SUPABASE_ANON_KEY", "")).strip()
        self.transport = transport or _request_supabase

    def _has_supabase(self) -> bool:
        if not self._explicit_supabase:
            _load_local_auth_config()
            self.supabase_url = os.environ.get("SUPABASE_URL", "").strip().rstrip("/")
            self.supabase_anon_key = os.environ.get("SUPABASE_ANON_KEY", "").strip()
        return bool(self.supabase_url and self.supabase_anon_key)

    def _use_local_fallback(self) -> bool:
        return not self._explicit_supabase and not self._has_supabase()

    def _create_local_session(self, user_record: Dict[str, Any]) -> Dict[str, Any]:
        access_token = f"ags_at_{secrets.token_urlsafe(24)}"
        refresh_token = f"ags_rt_{secrets.token_urlsafe(24)}"
        expires_at = int((datetime.now(timezone.utc) + timedelta(days=7)).timestamp())
        user_payload = {
            "id": user_record.get("id"),
            "fullName": user_record.get("full_name") or user_record.get("fullName") or "Pengguna",
            "email": user_record.get("email"),
            "provider": user_record.get("provider", "email"),
            "picture": user_record.get("picture"),
            "createdAt": user_record.get("created_at") or user_record.get("createdAt"),
        }
        state = _read_local_state()
        state["sessions"][access_token] = {
            "user": user_payload,
            "refresh_token": refresh_token,
            "expires_at": expires_at,
        }
        _write_local_state(state)
        return {
            "user": user_payload,
            "access_token": access_token,
            "refresh_token": refresh_token,
            "expires_at": expires_at,
            "token_type": "bearer",
        }

    def _request(
        self,
        method: str,
        path: str,
        payload: Optional[Dict[str, Any]] = None,
        access_token: Optional[str] = None,
    ) -> Dict[str, Any]:
        if not self._has_supabase():
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

        if self._use_local_fallback():
            state = _read_local_state()
            existing = state["users"].get(clean_email)
            if existing and existing.get("verified", True):
                raise ValueError("Alamat Gmail ini sudah terdaftar. Silakan masuk atau gunakan Gmail lain.")

            otp_code = f"{secrets.randbelow(900000) + 100000}"
            now_iso = datetime.now(timezone.utc).isoformat()
            user_record = {
                "id": existing.get("id") if existing else f"usr_{uuid.uuid4().hex[:12]}",
                "full_name": clean_name,
                "email": clean_email,
                "provider": "gmail",
                "password_hash": _hash_password_pbkdf2(password),
                "picture": None,
                "verified": False,
                "created_at": existing.get("created_at", now_iso) if existing else now_iso,
            }
            state["users"][clean_email] = user_record
            state["otps"][clean_email] = {
                "otp_code": otp_code,
                "purpose": "register",
                "expires_at": (datetime.now(timezone.utc) + timedelta(minutes=_OTP_EXPIRY_MINUTES)).isoformat(),
            }
            _write_local_state(state)

            sent_ok, status_msg = _send_gmail_otp_email(clean_email, otp_code, "register")
            if not sent_ok:
                raise RuntimeError(f"Gagal mengirim email OTP ({status_msg}). Pastikan SMTP_EMAIL dan SMTP_APP_PASSWORD di .env benar.")

            return {
                "confirmation_required": True,
                "user": {
                    "id": user_record["id"],
                    "fullName": clean_name,
                    "email": clean_email,
                    "provider": "gmail",
                    "picture": None,
                    "createdAt": user_record["created_at"],
                },
                "message": f"Kode OTP 6-digit telah dikirim ke inbox Gmail {clean_email}.",
            }

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

        if self._use_local_fallback():
            state = _read_local_state()
            user_record = state["users"].get(clean_email)
            if not user_record:
                raise ValueError("Akun Gmail tersebut belum terdaftar. Silakan daftar terlebih dahulu.")
            if not user_record.get("password_hash"):
                raise ValueError("Akun ini terdaftar lewat Google. Gunakan tombol Login dengan Google atau Lupa Kata Sandi.")
            if not _verify_password_pbkdf2(password, user_record["password_hash"]):
                raise ValueError("Kata sandi yang Anda masukkan salah.")
            return self._create_local_session(user_record)

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

        if self._use_local_fallback():
            clean_email = (email or "").strip().lower()
            clean_code = (token or "").strip()
            state = _read_local_state()
            record = state["otps"].get(clean_email)
            if not record:
                raise ValueError("Kode OTP tidak ditemukan atau belum dikirim.")
            if record.get("purpose") != purpose:
                raise ValueError("Tujuan kode OTP tidak sesuai.")
            if datetime.now(timezone.utc) > datetime.fromisoformat(record["expires_at"]):
                raise ValueError("Kode OTP sudah kedaluwarsa. Silakan kirim ulang OTP baru.")
            if not hmac.compare_digest(str(record.get("otp_code", "")), clean_code):
                raise ValueError("Kode OTP salah. Periksa kembali 6-digit kode di inbox Gmail Anda.")

            user_record = state["users"].get(clean_email)
            if not user_record:
                raise ValueError("Data akun tidak ditemukan.")
            user_record["verified"] = True
            state["users"][clean_email] = user_record
            if purpose == "register":
                state["otps"].pop(clean_email, None)
            _write_local_state(state)
            return self._create_local_session(user_record)

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

        if self._use_local_fallback():
            if purpose not in {"register", "reset_password"}:
                raise ValueError("Tujuan OTP tidak valid.")
            state = _read_local_state()
            user_record = state["users"].get(clean_email)
            if purpose == "reset_password" and not user_record:
                raise ValueError("Alamat Gmail tersebut belum terdaftar di Agri-Sort AI.")

            otp_code = f"{secrets.randbelow(900000) + 100000}"
            state["otps"][clean_email] = {
                "otp_code": otp_code,
                "purpose": purpose,
                "expires_at": (datetime.now(timezone.utc) + timedelta(minutes=_OTP_EXPIRY_MINUTES)).isoformat(),
            }
            _write_local_state(state)

            sent_ok, status_msg = _send_gmail_otp_email(clean_email, otp_code, purpose)
            if not sent_ok:
                raise RuntimeError(f"Gagal mengirim email OTP ({status_msg}).")
            return {
                "email": clean_email,
                "purpose": purpose,
                "message": f"Kode OTP 6-digit telah dikirim ke inbox Gmail {clean_email}.",
            }

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

        if self._use_local_fallback():
            verified = _verify_official_google_id_token(id_token)
            clean_email = verified["email"]
            state = _read_local_state()
            user_record = state["users"].get(clean_email)
            now_iso = datetime.now(timezone.utc).isoformat()
            if not user_record:
                user_record = {
                    "id": f"ggl_{uuid.uuid4().hex[:12]}",
                    "full_name": verified["full_name"],
                    "email": clean_email,
                    "provider": "google",
                    "password_hash": None,
                    "picture": verified.get("picture"),
                    "verified": True,
                    "created_at": now_iso,
                }
            else:
                user_record["full_name"] = verified["full_name"] or user_record.get("full_name")
                user_record["picture"] = verified.get("picture") or user_record.get("picture")
                user_record["verified"] = True
            state["users"][clean_email] = user_record
            _write_local_state(state)
            return self._create_local_session(user_record)

        response = self._request(
            "POST",
            "/token?grant_type=id_token",
            {"provider": "google", "id_token": id_token},
        )
        return self._session_payload(response)

    def get_user(self, access_token: str) -> Dict[str, Any]:
        if not access_token:
            raise ValueError("Token sesi wajib disertakan.")

        if self._use_local_fallback() or access_token.startswith("ags_at_"):
            state = _read_local_state()
            session = state["sessions"].get(access_token)
            if not session:
                raise ValueError("Sesi tidak valid atau kedaluwarsa. Silakan masuk kembali.")
            return session["user"]

        user = self._request("GET", "/user", access_token=access_token)
        return self._user_payload(user)

    def refresh_session(self, refresh_token: str) -> Dict[str, Any]:
        if not refresh_token:
            raise ValueError("Token sesi kedaluwarsa. Silakan masuk kembali.")

        if self._use_local_fallback() or refresh_token.startswith("ags_rt_"):
            state = _read_local_state()
            for token, sess in list(state["sessions"].items()):
                if sess.get("refresh_token") == refresh_token:
                    user_email = sess.get("user", {}).get("email")
                    user_record = state["users"].get(user_email) or sess.get("user", {})
                    state["sessions"].pop(token, None)
                    _write_local_state(state)
                    return self._create_local_session(user_record)
            raise ValueError("Token sesi kedaluwarsa. Silakan masuk kembali.")

        response = self._request("POST", "/token?grant_type=refresh_token", {"refresh_token": refresh_token})
        return self._session_payload(response)

    def logout(self, access_token: str) -> None:
        if self._use_local_fallback() or (access_token and access_token.startswith("ags_at_")):
            state = _read_local_state()
            state["sessions"].pop(access_token, None)
            _write_local_state(state)
            return
        self._request("POST", "/logout", {}, access_token=access_token)

    def reset_password(self, email: str, otp_code: str, new_password: str) -> Dict[str, Any]:
        if len(new_password or "") < 8 or not any(c.isalpha() for c in new_password) or not any(c.isdigit() for c in new_password):
            raise ValueError("Password baru minimal 8 karakter dengan kombinasi huruf dan angka.")

        if self._use_local_fallback():
            session = self.verify_otp(email, otp_code, "reset_password")
            clean_email = (email or "").strip().lower()
            state = _read_local_state()
            user_record = state["users"].get(clean_email)
            if not user_record:
                raise ValueError("Akun Gmail tidak ditemukan.")
            user_record["password_hash"] = _hash_password_pbkdf2(new_password)
            state["users"][clean_email] = user_record
            state["otps"].pop(clean_email, None)
            _write_local_state(state)
            return {"user": session["user"], "message": "Kata sandi berhasil diperbarui."}

        session = self.verify_otp(email, otp_code, "reset_password")
        self._request("PUT", "/user", {"password": new_password}, access_token=session["access_token"])
        return {"user": session["user"], "message": "Kata sandi berhasil diperbarui."}


# Keep a stable module-level singleton; environment configuration is read at import time.
auth_service = AuthService()
