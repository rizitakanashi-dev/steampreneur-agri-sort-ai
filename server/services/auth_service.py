"""
Modul Layanan Autentikasi, Registrasi, Google OAuth 2.0 Resmi & OTP Gmail — Agri-Sort AI Backend
Tanggung Jawab: Fullstack Developer (Backend Services)

Menyediakan:
1. Persistensi akun pengguna terdaftar di server (server/data/users.json)
2. Hashing password kriptografis menggunakan PBKDF2-HMAC-SHA256 + salt
3. Pengiriman Kode OTP 6-digit ke inbox Gmail melalui SMTP (smtp.gmail.com)
   untuk verifikasi kepemilikan Gmail saat Register & fitur Lupa Kata Sandi (Forgot Password)
4. Verifikasi token Google OAuth 2.0 RESMI langsung ke server Google
   (https://www.googleapis.com/oauth2/v3/userinfo & https://oauth2.googleapis.com/tokeninfo)
   sehingga tidak ada akun sembarang/palsu yang bisa masuk tanpa autentikasi asli Google.
"""

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
from typing import Any, Dict, List, Optional, Tuple
import urllib.error
import urllib.parse
import urllib.request
import uuid

logger = logging.getLogger("agrisort.auth")

DATA_DIR = (
    Path("/tmp/agri-sort-data")
    if os.environ.get("VERCEL")
    else Path(__file__).parent.parent / "data"
)
DEFAULT_USERS_PATH = DATA_DIR / "users.json"
DEFAULT_OTP_PATH = DATA_DIR / "otps.json"

_auth_lock = threading.Lock()
GMAIL_REGEX = re.compile(r"^[a-zA-Z0-9._%+-]+@gmail\.com$", re.IGNORECASE)
OTP_EXPIRY_MINUTES = 5


def _load_dotenv_if_present() -> None:
    """Memuat variabel dari file .env di root proyek secara dinamis."""
    env_path = Path(__file__).parent.parent.parent / ".env"
    if not env_path.exists():
        return
    try:
        for raw_line in env_path.read_text(encoding="utf-8").splitlines():
            line = raw_line.strip()
            if not line or line.startswith("#") or "=" not in line:
                continue
            key, val = line.split("=", 1)
            key = key.strip()
            val = val.strip().strip('"').strip("'")
            if key and val:
                os.environ[key] = val
    except Exception as exc:
        logger.warning("Gagal membaca .env: %s", exc)


_load_dotenv_if_present()


def hash_password_pbkdf2(password: str, salt: Optional[str] = None) -> str:
    """Menghasilkan hash password PBKDF2-HMAC-SHA256 beserta salt."""
    active_salt = salt or secrets.token_hex(16)
    dk = hashlib.pbkdf2_hmac(
        "sha256",
        password.encode("utf-8"),
        active_salt.encode("utf-8"),
        100_000,
    )
    return f"pbkdf2_sha256${active_salt}${dk.hex()}"


def verify_password_pbkdf2(password: str, stored_hash: str) -> bool:
    """Memverifikasi password terhadap hash PBKDF2-HMAC-SHA256."""
    if not stored_hash or "$" not in stored_hash:
        return False
    parts = stored_hash.split("$")
    if len(parts) != 3:
        return False
    _, salt, _ = parts
    candidate = hash_password_pbkdf2(password, salt=salt)
    return hmac.compare_digest(candidate, stored_hash)


def derive_name_from_email(email: str) -> str:
    """Membentuk nama tampilan dari alamat Gmail jika nama tidak disertakan."""
    local_part = (email or "").split("@")[0]
    cleaned = re.sub(r"[._-]+", " ", local_part)
    cleaned = re.sub(r"\d+", " ", cleaned).strip()
    if not cleaned:
        return "Pengguna Google"
    return " ".join(w.capitalize() for w in cleaned.split())


def send_gmail_otp_email(recipient_email: str, otp_code: str, purpose: str = "reset_password") -> Tuple[bool, str]:
    """
    Mengirim email kode OTP 6-digit langsung ke inbox Gmail pengguna via SMTP Gmail.
    Menggunakan SMTP_EMAIL dan SMTP_APP_PASSWORD dari environment / .env.
    """
    _load_dotenv_if_present()
    smtp_email = os.environ.get("SMTP_EMAIL", "").strip()
    smtp_password = os.environ.get("SMTP_APP_PASSWORD", "").replace(" ", "").strip()

    subject_map = {
        "register": f"[{otp_code}] Kode Verifikasi Pendaftaran Agri-Sort AI",
        "reset_password": f"[{otp_code}] Kode OTP Reset Kata Sandi Agri-Sort AI",
    }
    subject = subject_map.get(purpose, f"[{otp_code}] Kode OTP Keamanan Agri-Sort AI")

    if not smtp_email or not smtp_password:
        logger.warning("Pengiriman OTP dibatalkan karena SMTP_EMAIL atau SMTP_APP_PASSWORD belum dikonfigurasi di .env.")
        return False, "SMTP_NOT_CONFIGURED"

    msg = EmailMessage()
    msg["Subject"] = subject
    msg["From"] = f"Agri-Sort AI Security <{smtp_email}>"
    msg["To"] = recipient_email

    purpose_title = (
        "Reset Kata Sandi Akun Anda"
        if purpose == "reset_password"
        else "Verifikasi Kepemilikan Akun Gmail Anda"
    )

    html_body = f"""
    <div style="font-family: 'Inter', Arial, sans-serif; max-width: 520px; margin: 0 auto; padding: 28px; border: 1px solid #e6ece8; border-radius: 16px; background-color: #ffffff; color: #17191c;">
      <div style="margin-bottom: 18px;">
        <span style="background-color: #e3f3ea; color: #034d32; padding: 6px 12px; border-radius: 999px; font-size: 12px; font-weight: 700;">
          Agri-Sort AI • SMKN 4 Payakumbuh
        </span>
      </div>
      <h2 style="margin: 0 0 10px 0; font-size: 20px; color: #17191c;">{purpose_title}</h2>
      <p style="font-size: 14px; color: #68736d; line-height: 1.5;">
        Gunakan kode OTP 6-digit berikut untuk memverifikasi akun <strong>{recipient_email}</strong>. Kode ini berlaku selama {OTP_EXPIRY_MINUTES} menit:
      </p>
      <div style="margin: 24px 0; padding: 18px; border-radius: 12px; background-color: #f2f5f3; text-align: center; letter-spacing: 8px; font-size: 28px; font-weight: 800; color: #036e45;">
        {otp_code}
      </div>
      <p style="font-size: 12px; color: #8c9690; line-height: 1.4;">
        Jangan bagikan kode rahasia ini kepada siapa pun. Jika Anda tidak merasa melakukan permintaan ini, abaikan pesan email ini.
      </p>
    </div>
    """
    msg.set_content(f"Kode OTP Agri-Sort AI Anda adalah: {otp_code} (Berlaku {OTP_EXPIRY_MINUTES} menit).")
    msg.add_alternative(html_body, subtype="html")

    try:
        with smtplib.SMTP_SSL("smtp.gmail.com", 465, timeout=10) as smtp:
            smtp.login(smtp_email, smtp_password)
            smtp.send_message(msg)
        return True, "SENT_VIA_GMAIL_SMTP"
    except Exception as exc:
        logger.error("Gagal mengirim email OTP via SMTP Gmail: %s", exc)
        return False, f"SMTP_ERROR: {exc}"


def verify_official_google_token(
    access_token: Optional[str] = None,
    id_token: Optional[str] = None,
) -> Dict[str, Any]:
    """
    Memverifikasi token OAuth 2.0 / ID Token (JWT) LANGSUNG ke server resmi Google:
    - id_token: https://oauth2.googleapis.com/tokeninfo?id_token=...
    - access_token: https://www.googleapis.com/oauth2/v3/userinfo
    Menolak keras permintaan tanpa token resmi dari Google.
    """
    if id_token:
        url = f"https://oauth2.googleapis.com/tokeninfo?id_token={urllib.parse.quote(id_token)}"
        try:
            with urllib.request.urlopen(url, timeout=8) as resp:
                data = json.loads(resp.read().decode("utf-8"))
                email = str(data.get("email") or "").lower()
                email_verified = str(data.get("email_verified", "")).lower() == "true"
                if email and email_verified:
                    return {
                        "email": email,
                        "full_name": data.get("name") or derive_name_from_email(email),
                        "picture": data.get("picture"),
                        "google_sub": data.get("sub"),
                    }
        except Exception as exc:
            logger.warning("Verifikasi id_token Google gagal: %s", exc)
            raise ValueError("Token Google (id_token) tidak valid atau sudah kedaluwarsa.") from exc

    if access_token:
        req = urllib.request.Request(
            "https://www.googleapis.com/oauth2/v3/userinfo",
            headers={"Authorization": f"Bearer {access_token}"},
        )
        try:
            with urllib.request.urlopen(req, timeout=8) as resp:
                data = json.loads(resp.read().decode("utf-8"))
                email = str(data.get("email") or "").lower()
                if email and data.get("email_verified", True):
                    return {
                        "email": email,
                        "full_name": data.get("name") or derive_name_from_email(email),
                        "picture": data.get("picture"),
                        "google_sub": data.get("sub"),
                    }
        except Exception as exc:
            logger.warning("Verifikasi access_token Google gagal: %s", exc)
            raise ValueError("Token Google (access_token) tidak valid atau ditolak oleh server Google.") from exc

    raise ValueError("Autentikasi Google wajib menggunakan token resmi dari Google OAuth 2.0.")


class AuthService:
    """Manajer persistensi pengguna terdaftar, Google OAuth Resmi, dan OTP Gmail."""

    def __init__(
        self,
        users_path: Path = DEFAULT_USERS_PATH,
        otp_path: Path = DEFAULT_OTP_PATH,
    ) -> None:
        self.users_path = users_path
        self.otp_path = otp_path
        self._ensure_files()

    def _ensure_files(self) -> None:
        try:
            self.users_path.parent.mkdir(parents=True, exist_ok=True)
            if not self.users_path.exists():
                self.users_path.write_text("[]", encoding="utf-8")
            if not self.otp_path.exists():
                self.otp_path.write_text("{}", encoding="utf-8")
        except Exception as exc:
            logger.warning("Gagal membuat file storage auth: %s", exc)

    def _read_users(self) -> List[Dict[str, Any]]:
        with _auth_lock:
            try:
                if not self.users_path.exists():
                    return []
                data = json.loads(self.users_path.read_text(encoding="utf-8"))
                return data if isinstance(data, list) else []
            except Exception:
                return []

    def _write_users(self, users: List[Dict[str, Any]]) -> None:
        with _auth_lock:
            self._ensure_files()
            self.users_path.write_text(
                json.dumps(users, indent=2, ensure_ascii=False),
                encoding="utf-8",
            )

    def _read_otps(self) -> Dict[str, Any]:
        with _auth_lock:
            try:
                if not self.otp_path.exists():
                    return {}
                data = json.loads(self.otp_path.read_text(encoding="utf-8"))
                return data if isinstance(data, dict) else {}
            except Exception:
                return {}

    def _write_otps(self, otps: Dict[str, Any]) -> None:
        with _auth_lock:
            self._ensure_files()
            self.otp_path.write_text(
                json.dumps(otps, indent=2, ensure_ascii=False),
                encoding="utf-8",
            )

    @staticmethod
    def _sanitize_user(user: Dict[str, Any]) -> Dict[str, Any]:
        return {
            "id": user.get("id"),
            "fullName": user.get("full_name") or user.get("fullName"),
            "email": user.get("email"),
            "provider": user.get("provider", "gmail"),
            "picture": user.get("picture"),
            "createdAt": user.get("created_at") or user.get("createdAt"),
        }

    def register_gmail_user(
        self,
        full_name: str,
        email: str,
        password: str,
    ) -> Dict[str, Any]:
        clean_name = (full_name or "").strip()
        clean_email = (email or "").strip().lower()
        raw_password = password or ""

        if len(clean_name) < 3:
            raise ValueError("Nama lengkap minimal 3 karakter.")
        if not GMAIL_REGEX.match(clean_email):
            raise ValueError("Gunakan alamat Gmail yang valid (contoh: nama@gmail.com).")
        if len(raw_password) < 8 or not re.search(r"[A-Za-z]", raw_password) or not re.search(r"\d", raw_password):
            raise ValueError("Password minimal 8 karakter dengan kombinasi huruf dan angka.")

        users = self._read_users()
        if any(str(u.get("email", "")).lower() == clean_email for u in users):
            raise ValueError("Alamat Gmail ini sudah terdaftar. Silakan gunakan Gmail lain.")

        now_iso = datetime.now(timezone.utc).isoformat()
        new_user = {
            "id": f"usr_{uuid.uuid4().hex[:12]}",
            "full_name": clean_name,
            "email": clean_email,
            "provider": "gmail",
            "password_hash": hash_password_pbkdf2(raw_password),
            "picture": None,
            "created_at": now_iso,
        }
        users.append(new_user)
        self._write_users(users)
        return self._sanitize_user(new_user)

    def login_gmail_user(
        self,
        email: str,
        password: str,
    ) -> Dict[str, Any]:
        """Memverifikasi login pengguna menggunakan alamat Gmail dan Password."""
        clean_email = (email or "").strip().lower()
        raw_password = password or ""

        if not GMAIL_REGEX.match(clean_email):
            raise ValueError("Gunakan alamat Gmail yang valid (contoh: nama@gmail.com).")
        if not raw_password:
            raise ValueError("Password wajib diisi.")

        users = self._read_users()
        target_user = next(
            (u for u in users if str(u.get("email", "")).lower() == clean_email),
            None,
        )
        if not target_user:
            raise ValueError("Akun Gmail tersebut belum terdaftar. Silakan daftar terlebih dahulu.")

        stored_hash = target_user.get("password_hash")
        if not stored_hash:
            raise ValueError(
                "Akun ini terdaftar melalui Google. Silakan gunakan tombol Login dengan Google atau atur sandi lewat Lupa Kata Sandi."
            )

        if not verify_password_pbkdf2(raw_password, stored_hash):
            raise ValueError("Kata sandi yang Anda masukkan salah.")

        return self._sanitize_user(target_user)

    def authenticate_official_google(
        self,
        access_token: Optional[str] = None,
        id_token: Optional[str] = None,
    ) -> Dict[str, Any]:
        """
        Mendaftarkan atau masuk HANYA menggunakan token resmi dari Google OAuth 2.0.
        Profil (email, nama, foto) diambil langsung dari server Google setelah token diverifikasi.
        """
        verified_profile = verify_official_google_token(
            access_token=access_token,
            id_token=id_token,
        )
        target_email = verified_profile["email"]
        target_name = verified_profile["full_name"]
        target_picture = verified_profile.get("picture")

        users = self._read_users()
        existing = next(
            (u for u in users if str(u.get("email", "")).lower() == target_email),
            None,
        )

        if not existing:
            now_iso = datetime.now(timezone.utc).isoformat()
            existing = {
                "id": f"ggl_{uuid.uuid4().hex[:12]}",
                "full_name": target_name,
                "email": target_email,
                "provider": "google",
                "password_hash": None,
                "picture": target_picture,
                "google_sub": verified_profile.get("google_sub"),
                "created_at": now_iso,
            }
            users.append(existing)
            self._write_users(users)
        else:
            existing["full_name"] = target_name or existing.get("full_name")
            existing["picture"] = target_picture or existing.get("picture")
            self._write_users(users)

        return self._sanitize_user(existing)

    def generate_and_send_otp(
        self,
        email: str,
        purpose: str = "reset_password",
    ) -> Dict[str, Any]:
        """
        Membuat kode OTP 6-digit dan mengirimkannya ke alamat Gmail pengguna.
        - Untuk 'register': Memastikan Gmail belum terdaftar ganda.
        - Untuk 'reset_password': Memastikan Gmail sudah terdaftar di sistem.
        """
        clean_email = (email or "").strip().lower()
        if not GMAIL_REGEX.match(clean_email):
            raise ValueError("Masukkan alamat @gmail.com yang valid.")

        users = self._read_users()
        user_exists = any(str(u.get("email", "")).lower() == clean_email for u in users)

        if purpose == "register" and user_exists:
            raise ValueError("Alamat Gmail ini sudah terdaftar. Silakan gunakan Gmail lain.")

        if purpose == "reset_password" and not user_exists:
            raise ValueError("Alamat Gmail tersebut belum terdaftar di Agri-Sort AI.")

        otp_code = f"{secrets.randbelow(900000) + 100000}"
        expires_at = (
            datetime.now(timezone.utc) + timedelta(minutes=OTP_EXPIRY_MINUTES)
        ).isoformat()

        otps = self._read_otps()
        otps[clean_email] = {
            "otp_code": otp_code,
            "purpose": purpose,
            "expires_at": expires_at,
            "verified": False,
        }
        self._write_otps(otps)

        sent_ok, delivery_status = send_gmail_otp_email(
            recipient_email=clean_email,
            otp_code=otp_code,
            purpose=purpose,
        )

        return {
            "email": clean_email,
            "purpose": purpose,
            "expires_in_seconds": OTP_EXPIRY_MINUTES * 60,
            "smtp_delivered": sent_ok,
            "delivery_status": delivery_status,
        }

    def verify_otp_code(
        self,
        email: str,
        otp_code: str,
        purpose: Optional[str] = None,
    ) -> bool:
        clean_email = (email or "").strip().lower()
        clean_code = (otp_code or "").strip()
        otps = self._read_otps()
        record = otps.get(clean_email)
        if not record:
            raise ValueError("Kode OTP tidak ditemukan atau belum dikirim.")

        if purpose and record.get("purpose") != purpose:
            raise ValueError("Tujuan kode OTP tidak sesuai.")

        expires_at = datetime.fromisoformat(record["expires_at"])
        if datetime.now(timezone.utc) > expires_at:
            raise ValueError("Kode OTP sudah kedaluwarsa. Silakan kirim ulang OTP baru.")

        if not hmac.compare_digest(str(record.get("otp_code", "")), clean_code):
            raise ValueError("Kode OTP salah. Periksa kembali 6-digit kode di inbox Gmail Anda.")

        record["verified"] = True
        otps[clean_email] = record
        self._write_otps(otps)
        return True

    def reset_password_with_otp(
        self,
        email: str,
        otp_code: str,
        new_password: str,
    ) -> Dict[str, Any]:
        """Mengganti password akun Gmail setelah kode OTP 6-digit terverifikasi."""
        clean_email = (email or "").strip().lower()
        if len(new_password or "") < 8 or not re.search(r"[A-Za-z]", new_password) or not re.search(r"\d", new_password):
            raise ValueError("Password baru minimal 8 karakter dengan kombinasi huruf dan angka.")

        self.verify_otp_code(clean_email, otp_code, purpose="reset_password")

        users = self._read_users()
        target_user = next(
            (u for u in users if str(u.get("email", "")).lower() == clean_email),
            None,
        )
        if not target_user:
            raise ValueError("Akun Gmail tidak ditemukan.")

        target_user["password_hash"] = hash_password_pbkdf2(new_password)
        target_user["updated_at"] = datetime.now(timezone.utc).isoformat()
        self._write_users(users)

        otps = self._read_otps()
        otps.pop(clean_email, None)
        self._write_otps(otps)

        return self._sanitize_user(target_user)


auth_service = AuthService()
