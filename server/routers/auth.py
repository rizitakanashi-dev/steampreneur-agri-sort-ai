"""
Router Autentikasi, Registrasi, Google OAuth 2.0 Resmi & OTP Gmail — Agri-Sort AI Backend
Prefix: /api/v1/auth
"""

from typing import Any, Dict, Optional
from fastapi import APIRouter, HTTPException, status
from pydantic import BaseModel, Field

from server.services.auth_service import auth_service

router = APIRouter(prefix="/api/v1/auth", tags=["Authentication & OTP Gmail"])


class RegisterGmailRequest(BaseModel):
    fullName: str = Field(..., min_length=2, description="Nama lengkap pengguna")
    email: str = Field(..., description="Alamat Gmail pengguna (@gmail.com)")
    password: str = Field(..., min_length=8, description="Password akun")


class LoginGmailRequest(BaseModel):
    email: str = Field(..., description="Alamat Gmail pengguna (@gmail.com)")
    password: str = Field(..., min_length=1, description="Password akun")


class GoogleAuthRequest(BaseModel):
    accessToken: Optional[str] = Field(None, description="OAuth 2.0 Access Token resmi dari Google")
    idToken: Optional[str] = Field(None, description="OpenID Connect JWT credential (id_token) resmi dari Google")


class SendOtpRequest(BaseModel):
    email: str = Field(..., description="Alamat Gmail tujuan pengiriman kode OTP")
    purpose: str = Field("reset_password", description="'register' atau 'reset_password'")


class VerifyOtpRequest(BaseModel):
    email: str = Field(..., description="Alamat Gmail pengguna")
    otpCode: str = Field(..., min_length=6, max_length=6, description="6-digit kode OTP")
    purpose: Optional[str] = Field(None, description="'register' atau 'reset_password'")


class ResetPasswordOtpRequest(BaseModel):
    email: str = Field(..., description="Alamat Gmail pengguna")
    otpCode: str = Field(..., min_length=6, max_length=6, description="6-digit kode OTP dari Gmail")
    newPassword: str = Field(..., min_length=8, description="Password baru")


@router.post("/register", status_code=status.HTTP_201_CREATED)
async def register_user(payload: RegisterGmailRequest) -> Dict[str, Any]:
    """Mendaftarkan pengguna baru dengan Gmail dan Password ke database server."""
    try:
        user = auth_service.register_gmail_user(
            full_name=payload.fullName,
            email=payload.email,
            password=payload.password,
        )
        return {
            "status": "success",
            "message": "Akun Gmail berhasil didaftarkan.",
            "data": user,
        }
    except ValueError as exc:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail={
                "code": "REGISTRATION_VALIDATION_ERROR",
                "message": str(exc),
            },
        ) from exc


@router.post("/login")
async def login_user(payload: LoginGmailRequest) -> Dict[str, Any]:
    """Autentikasi login pengguna dengan Gmail dan Password."""
    try:
        user = auth_service.login_gmail_user(
            email=payload.email,
            password=payload.password,
        )
        return {
            "status": "success",
            "message": "Login berhasil.",
            "data": user,
        }
    except ValueError as exc:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail={
                "code": "LOGIN_AUTH_ERROR",
                "message": str(exc),
            },
        ) from exc


@router.post("/google")
async def authenticate_with_google(payload: GoogleAuthRequest) -> Dict[str, Any]:
    """
    Mendaftarkan atau masuk HANYA menggunakan token resmi dari Google OAuth 2.0.
    Menolak keras permintaan tanpa accessToken atau idToken yang terverifikasi oleh server Google.
    """
    try:
        user = auth_service.authenticate_official_google(
            access_token=payload.accessToken,
            id_token=payload.idToken,
        )
        return {
            "status": "success",
            "message": "Autentikasi Google resmi berhasil.",
            "data": user,
        }
    except ValueError as exc:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail={
                "code": "GOOGLE_AUTH_ERROR",
                "message": str(exc),
            },
        ) from exc


@router.post("/send-otp")
async def send_otp_to_gmail(payload: SendOtpRequest) -> Dict[str, Any]:
    """
    Mengirimkan kode OTP 6-digit ke alamat Gmail pengguna melalui SMTP Gmail.
    """
    try:
        otp_info = auth_service.generate_and_send_otp(
            email=payload.email,
            purpose=payload.purpose,
        )
        if not otp_info.get("smtp_delivered"):
            raise HTTPException(
                status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
                detail={
                    "code": "SMTP_NOT_CONFIGURED",
                    "message": "Pengiriman email OTP belum aktif. Harap isi SMTP_EMAIL dan SMTP_APP_PASSWORD di file .env server.",
                },
            )
        return {
            "status": "success",
            "message": f"Kode OTP 6-digit telah dikirim ke inbox Gmail {payload.email}.",
            "data": otp_info,
        }
    except ValueError as exc:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail={
                "code": "OTP_SEND_ERROR",
                "message": str(exc),
            },
        ) from exc


@router.post("/verify-otp")
async def verify_gmail_otp(payload: VerifyOtpRequest) -> Dict[str, Any]:
    """Memverifikasi 6-digit kode OTP yang dikirim ke Gmail."""
    try:
        auth_service.verify_otp_code(
            email=payload.email,
            otp_code=payload.otpCode,
            purpose=payload.purpose,
        )
        return {
            "status": "success",
            "message": "Kode OTP valid dan terverifikasi.",
            "data": {"email": payload.email.lower(), "verified": True},
        }
    except ValueError as exc:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail={
                "code": "OTP_VERIFY_ERROR",
                "message": str(exc),
            },
        ) from exc


@router.post("/reset-password")
async def reset_password_via_otp(payload: ResetPasswordOtpRequest) -> Dict[str, Any]:
    """Mereset password akun setelah kode OTP Gmail terverifikasi."""
    try:
        user = auth_service.reset_password_with_otp(
            email=payload.email,
            otp_code=payload.otpCode,
            new_password=payload.newPassword,
        )
        return {
            "status": "success",
            "message": "Kata sandi berhasil diperbarui.",
            "data": user,
        }
    except ValueError as exc:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail={
                "code": "RESET_PASSWORD_ERROR",
                "message": str(exc),
            },
        ) from exc
