"""FastAPI dependency for verifying Supabase bearer sessions."""

from typing import Any, Dict

from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer

from server.config.auth_config import AuthProviderUnavailableError
from server.services.auth_service import auth_service

bearer_scheme = HTTPBearer(auto_error=False)


def get_current_user(
    credentials: HTTPAuthorizationCredentials = Depends(bearer_scheme),
) -> Dict[str, Any]:
    if credentials is None or credentials.scheme.lower() != "bearer":
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail={"code": "AUTH_REQUIRED", "message": "Sesi masuk diperlukan."},
            headers={"WWW-Authenticate": "Bearer"},
        )
    try:
        user = auth_service.get_user(credentials.credentials)
        return {**user, "_access_token": credentials.credentials}
    except AuthProviderUnavailableError as exc:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail={"code": "AUTH_PROVIDER_UNAVAILABLE", "message": "Layanan autentikasi tidak tersedia."},
        ) from exc
    except RuntimeError as exc:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail={"code": "AUTH_PROVIDER_UNAVAILABLE", "message": "Layanan autentikasi tidak tersedia."},
        ) from exc
    except ValueError as exc:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail={"code": "INVALID_SESSION", "message": "Sesi tidak valid atau kedaluwarsa. Silakan masuk kembali."},
            headers={"WWW-Authenticate": "Bearer"},
        ) from exc
