"""Supabase Auth routes for signup, OTP, login, and session management."""

from typing import Any, Dict, Optional

from fastapi import APIRouter, Header, HTTPException, status
from pydantic import BaseModel, Field

from server.services.auth_service import auth_service

router = APIRouter(prefix="/api/v1/auth", tags=["Authentication"])


class RegisterRequest(BaseModel):
    fullName: str = Field(..., min_length=3)
    email: str
    password: str = Field(..., min_length=8)


class LoginRequest(BaseModel):
    email: str
    password: str = Field(..., min_length=1)


class GoogleAuthRequest(BaseModel):
    idToken: str = Field(..., min_length=1)


class SendOtpRequest(BaseModel):
    email: str
    purpose: str = "reset_password"


class VerifyOtpRequest(BaseModel):
    email: str
    otpCode: str = Field(..., min_length=6, max_length=6)
    purpose: str = Field(...)


class ResetPasswordRequest(BaseModel):
    email: str
    otpCode: str = Field(..., min_length=6, max_length=6)
    newPassword: str = Field(..., min_length=8)


def _raise_auth_error(exc: Exception, code: str, default_status: int = 400) -> None:
    if isinstance(exc, RuntimeError):
        code = "AUTH_PROVIDER_UNAVAILABLE"
        status_code = status.HTTP_503_SERVICE_UNAVAILABLE
    else:
        status_code = default_status
    raise HTTPException(
        status_code=status_code,
        detail={"code": code, "message": str(exc)},
    ) from exc


def _session_response(session: Dict[str, Any]) -> Dict[str, Any]:
    return {"status": "success", "data": session}


@router.post("/register", status_code=status.HTTP_202_ACCEPTED)
async def register_user(payload: RegisterRequest) -> Dict[str, Any]:
    try:
        data = auth_service.register_gmail_user(payload.fullName, payload.email, payload.password)
        return {"status": "success", "message": data.get("message"), "data": data}
    except (ValueError, RuntimeError) as exc:
        _raise_auth_error(exc, "REGISTRATION_ERROR")


@router.post("/login")
async def login_user(payload: LoginRequest) -> Dict[str, Any]:
    try:
        return _session_response(auth_service.login_gmail_user(payload.email, payload.password))
    except (ValueError, RuntimeError) as exc:
        _raise_auth_error(exc, "LOGIN_AUTH_ERROR", status.HTTP_401_UNAUTHORIZED)


@router.post("/google")
async def authenticate_with_google(payload: GoogleAuthRequest) -> Dict[str, Any]:
    try:
        return _session_response(auth_service.authenticate_google(payload.idToken))
    except (ValueError, RuntimeError) as exc:
        _raise_auth_error(exc, "GOOGLE_AUTH_ERROR", status.HTTP_401_UNAUTHORIZED)


@router.post("/send-otp")
async def send_otp(payload: SendOtpRequest) -> Dict[str, Any]:
    try:
        result = auth_service.send_otp(payload.email, payload.purpose)
        return {"status": "success", "message": result["message"], "data": result}
    except (ValueError, RuntimeError) as exc:
        _raise_auth_error(exc, "OTP_SEND_ERROR")


@router.post("/verify-otp")
async def verify_otp(payload: VerifyOtpRequest) -> Dict[str, Any]:
    try:
        return _session_response(auth_service.verify_otp(payload.email, payload.otpCode, payload.purpose))
    except (ValueError, RuntimeError) as exc:
        _raise_auth_error(exc, "OTP_VERIFY_ERROR", status.HTTP_401_UNAUTHORIZED)


@router.post("/reset-password")
async def reset_password(payload: ResetPasswordRequest) -> Dict[str, Any]:
    try:
        result = auth_service.reset_password(payload.email, payload.otpCode, payload.newPassword)
        return {"status": "success", **result}
    except (ValueError, RuntimeError) as exc:
        _raise_auth_error(exc, "RESET_PASSWORD_ERROR")


@router.get("/session")
async def verify_session(authorization: Optional[str] = Header(None)) -> Dict[str, Any]:
    if not authorization or not authorization.lower().startswith("bearer "):
        raise HTTPException(status_code=401, detail={"code": "AUTH_REQUIRED", "message": "Sesi tidak ditemukan."})
    token = authorization.split(" ", 1)[1].strip()
    try:
        user = auth_service.get_user(token)
        return {"status": "success", "data": {"user": user}}
    except (ValueError, RuntimeError) as exc:
        _raise_auth_error(exc, "INVALID_SESSION", status.HTTP_401_UNAUTHORIZED)


@router.post("/refresh")
async def refresh_session(payload: Dict[str, str]) -> Dict[str, Any]:
    try:
        return _session_response(auth_service.refresh_session(payload.get("refresh_token", "")))
    except (ValueError, RuntimeError) as exc:
        _raise_auth_error(exc, "SESSION_REFRESH_ERROR", status.HTTP_401_UNAUTHORIZED)


@router.post("/logout")
async def logout(authorization: Optional[str] = Header(None)) -> Dict[str, Any]:
    if not authorization or not authorization.lower().startswith("bearer "):
        return {"status": "success", "message": "Sesi lokal dibersihkan."}
    try:
        auth_service.logout(authorization.split(" ", 1)[1].strip())
        return {"status": "success", "message": "Sesi berhasil diakhiri."}
    except (ValueError, RuntimeError) as exc:
        _raise_auth_error(exc, "LOGOUT_ERROR", status.HTTP_401_UNAUTHORIZED)
