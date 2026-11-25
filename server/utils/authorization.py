"""FastAPI dependencies for organization-scoped RBAC."""

from typing import Callable

from fastapi import Depends, HTTPException, Request

from server.config.auth_config import AuthProviderUnavailableError
from server.services.auth_service import auth_service
from server.services.authorization_service import (
    AuthorizationError,
    AuthorizationService,
    SupabaseAuthorizationRepository,
)
from server.utils.auth import get_current_user


def get_active_principal(current_user: dict = Depends(get_current_user)):
    """Build fresh authorization state from Supabase for every request."""
    try:
        config = auth_service.config
        if config.auth_mode != "supabase":
            raise AuthorizationError("RBAC requires the Supabase Auth provider.", 503)
        repository = SupabaseAuthorizationRepository(config, current_user.get("_access_token", ""))
        service = AuthorizationService(repository)
        return service.get_active_principal(current_user)
    except AuthorizationError as exc:
        raise HTTPException(status_code=exc.status_code, detail={"code": "AUTHORIZATION_DENIED", "message": str(exc)}) from exc
    except AuthProviderUnavailableError as exc:
        raise HTTPException(status_code=503, detail={"code": "AUTH_PROVIDER_UNAVAILABLE", "message": "Authorization data provider is unavailable."}) from exc
    except RuntimeError as exc:
        raise HTTPException(status_code=503, detail={"code": "AUTH_PROVIDER_UNAVAILABLE", "message": "Authorization data provider is unavailable."}) from exc


def require_permission(action: str) -> Callable:
    def dependency(principal=Depends(get_active_principal)):
        try:
            from server.services.authorization_service import PLATFORM_PERMISSIONS

            if action not in PLATFORM_PERMISSIONS or principal.platform_role != "super_admin" or principal.user_status != "active":
                raise AuthorizationError("Izin platform tidak mencukupi.")
            return principal
        except AuthorizationError as exc:
            raise HTTPException(status_code=exc.status_code, detail={"code": "FORBIDDEN", "message": str(exc)}) from exc
    return dependency


def require_org_access(organization_id: str, action: str) -> Callable:
    def dependency(principal=Depends(get_active_principal), current_user: dict = Depends(get_current_user)):
        try:
            repo = SupabaseAuthorizationRepository(auth_service.config, current_user.get("_access_token", ""))
            return AuthorizationService(repo).require_org_access(principal, organization_id, action)
        except AuthorizationError as exc:
            raise HTTPException(status_code=exc.status_code, detail={"code": "FORBIDDEN", "message": "Resource not found." if exc.status_code == 404 else str(exc)}) from exc
    return dependency


def require_org_access_from_path(action: str) -> Callable:
    def dependency(request: Request, principal=Depends(get_active_principal), current_user: dict = Depends(get_current_user)):
        organization_id = request.path_params.get("organization_id")
        try:
            repo = SupabaseAuthorizationRepository(auth_service.config, current_user.get("_access_token", ""))
            return AuthorizationService(repo).require_org_access(principal, organization_id, action)
        except AuthorizationError as exc:
            raise HTTPException(status_code=exc.status_code, detail={"code": "FORBIDDEN", "message": str(exc)}) from exc
    return dependency


def require_owned_resource_permission(action: str) -> Callable:
    def dependency(current_user: dict = Depends(get_current_user), principal=Depends(get_active_principal)):
        try:
            service = get_authorization_service(current_user)
            service.require_owned_resource_permission(principal, action)
            return {**current_user, "_principal": principal, "_authorization_service": service}
        except AuthorizationError as exc:
            raise HTTPException(status_code=exc.status_code, detail={"code": "FORBIDDEN", "message": str(exc)}) from exc
    return dependency


def get_authorization_service(current_user: dict):
    try:
        repository = SupabaseAuthorizationRepository(auth_service.config, current_user.get("_access_token", ""))
        repository.set_verified_user_id(current_user.get("id", ""))
        return AuthorizationService(repository)
    except AuthorizationError as exc:
        raise HTTPException(status_code=exc.status_code, detail={"code": "AUTHORIZATION_DENIED", "message": str(exc)}) from exc


def get_authenticated_context(current_user: dict = Depends(get_current_user), principal=Depends(get_active_principal)):
    return {**current_user, "_principal": principal, "_authorization_service": get_authorization_service(current_user)}


def get_authorized_current_user(action: str):
    """Compatibility adapter for existing routes requiring user ID and bearer token."""
    from fastapi import Depends

    def dependency(current_user: dict = Depends(get_current_user), principal=Depends(get_active_principal)):
        from server.services.authorization_service import ALL_PERMISSIONS, PLATFORM_PERMISSIONS

        try:
            service = get_authorization_service(current_user)
            if action in PLATFORM_PERMISSIONS:
                service.require_permission(principal, action)
            elif action in ALL_PERMISSIONS:
                service.require_owned_resource_permission(principal, action)
            else:
                raise AuthorizationError("Izin tidak dikenal.", 403)
            return {**current_user, "_principal": principal, "_authorization_service": service}
        except AuthorizationError as exc:
            raise HTTPException(
                status_code=exc.status_code,
                detail={"code": "FORBIDDEN", "message": str(exc)},
            ) from exc

    return dependency


def require_resource_access(resource_type: str, action: str, path_parameter: str = "scan_id") -> Callable:
    def dependency(request: Request, principal=Depends(get_active_principal), current_user: dict = Depends(get_current_user)):
        resource_id = request.path_params.get(path_parameter)
        try:
            repo = SupabaseAuthorizationRepository(auth_service.config, current_user.get("_access_token", ""))
            return AuthorizationService(repo).require_resource_access(principal, resource_type, resource_id, action)
        except AuthorizationError as exc:
            raise HTTPException(status_code=exc.status_code, detail={"code": "RESOURCE_FORBIDDEN", "message": str(exc)}) from exc
    return dependency
