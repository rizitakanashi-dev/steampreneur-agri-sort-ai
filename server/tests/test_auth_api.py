"""
Unit Tests untuk Layanan Autentikasi, Registrasi Gmail, Google OAuth Resmi & OTP Gmail
"""

from pathlib import Path
import tempfile
import unittest
from unittest.mock import patch

from fastapi.testclient import TestClient

from server.main import app
from server.services.auth_service import (
    AuthService,
    hash_password_pbkdf2,
    verify_password_pbkdf2,
)


class TestAuthServiceAndOtp(unittest.TestCase):
    def setUp(self) -> None:
        self.temp_dir = tempfile.TemporaryDirectory()
        base = Path(self.temp_dir.name)
        self.service = AuthService(
            users_path=base / "users.json",
            otp_path=base / "otps.json",
        )

    def tearDown(self) -> None:
        self.temp_dir.cleanup()

    def test_pbkdf2_password_hash_and_verify(self) -> None:
        hashed = hash_password_pbkdf2("ContohSandi2026")
        self.assertTrue(verify_password_pbkdf2("ContohSandi2026", hashed))
        self.assertFalse(verify_password_pbkdf2("WrongPass123", hashed))

    def test_register_gmail_user_and_prevent_duplicate(self) -> None:
        user = self.service.register_gmail_user(
            full_name="Pengguna Uji",
            email="pengguna.uji@gmail.com",
            password="ContohPassword123",
        )
        self.assertEqual(user["email"], "pengguna.uji@gmail.com")
        self.assertEqual(user["provider"], "gmail")

        with self.assertRaises(ValueError):
            self.service.register_gmail_user(
                full_name="Pengguna Kedua",
                email="PENGGUNA.UJI@gmail.com",
                password="ContohPassword123",
            )

        # Verifikasi login berhasil dengan password benar dan gagal jika password salah
        logged_in = self.service.login_gmail_user(
            email="pengguna.uji@gmail.com",
            password="ContohPassword123",
        )
        self.assertEqual(logged_in["email"], "pengguna.uji@gmail.com")

        with self.assertRaises(ValueError):
            self.service.login_gmail_user(
                email="pengguna.uji@gmail.com",
                password="WrongPassword99",
            )

    def test_google_auth_rejects_missing_official_token(self) -> None:
        with self.assertRaises(ValueError):
            self.service.authenticate_official_google(access_token=None, id_token=None)

    @patch("server.services.auth_service.send_gmail_otp_email", return_value=(True, "MOCKED_SMTP"))
    def test_send_verify_otp_and_reset_password(self, _mock_smtp: object) -> None:
        self.service.register_gmail_user(
            full_name="Petani Contoh",
            email="petani.contoh@gmail.com",
            password="OldPassword123",
        )
        otp_info = self.service.generate_and_send_otp(
            email="petani.contoh@gmail.com",
            purpose="reset_password",
        )
        self.assertEqual(otp_info["email"], "petani.contoh@gmail.com")
        otp_code = self.service._read_otps()["petani.contoh@gmail.com"]["otp_code"]
        self.assertEqual(len(otp_code), 6)

        with self.assertRaises(ValueError):
            self.service.verify_otp_code("petani.contoh@gmail.com", "000000", purpose="reset_password")

        updated_user = self.service.reset_password_with_otp(
            email="petani.contoh@gmail.com",
            otp_code=otp_code,
            new_password="NewPassword2026",
        )
        self.assertEqual(updated_user["email"], "petani.contoh@gmail.com")

    def test_auth_router_endpoints(self) -> None:
        client = TestClient(app)
        # Pastikan /api/v1/auth/google menolak request tanpa token resmi Google
        bad_google = client.post("/api/v1/auth/google", json={})
        self.assertEqual(bad_google.status_code, 400)


if __name__ == "__main__":
    unittest.main()
