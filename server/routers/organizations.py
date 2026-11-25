"""Organization and platform-user management endpoints."""

from typing import Any, Dict, Optional

from fastapi import APIRouter, Depends, HTTPException, Query, status
from pydantic import BaseModel, Field

from server.config.auth_config import AuthProviderUnavailableError
from server.services.authorization_service import AuthorizationError
from server.utils.authorization import get_authorized_current_user, get_authenticated_context

router = APIRouter(prefix="/api/v1", tags=["Organization Management"])


class OrganizationCreate(BaseModel):
    name: str = Field(min_length=1, max_length=160)
    slug: str = Field(min_length=1, max_length=160, pattern=r"^[a-z0-9]+(?:-[a-z0-9]+)*$")
    region: Optional[str] = Field(default=None, max_length=120)
    kabupaten: Optional[str] = Field(default=None, max_length=120)


class OrganizationUpdate(BaseModel):
    name: Optional[str] = Field(default=None, min_length=1, max_length=160)
    slug: Optional[str] = Field(default=None, min_length=1, max_length=160, pattern=r"^[a-z0-9]+(?:-[a-z0-9]+)*$")
    region: Optional[str] = Field(default=None, max_length=120)
    kabupaten: Optional[str] = Field(default=None, max_length=120)


class OrganizationStatusUpdate(BaseModel):
    status: str = Field(pattern=r"^(active|suspended)$")


class OrganizationStatusCreate(BaseModel):
    name: str = Field(min_length=1, max_length=160)
    slug: str = Field(min_length=1, max_length=160, pattern=r"^[a-z0-9]+(?:-[a-z0-9]+)*$")
    region: Optional[str] = Field(default=None, max_length=120)
    kabupaten: Optional[str] = Field(default=None, max_length=120)


class MembershipAssignment(BaseModel):
    user_id: str = Field(min_length=1, max_length=80)
    role: str = Field(pattern=r"^(admin|farmer|merchant)$")


class MembershipRoleUpdate(BaseModel):
    role: str = Field(pattern=r"^(admin|farmer|merchant)$")


class StatusUpdate(BaseModel):
    status: str = Field(pattern=r"^(active|suspended|pending_assignment)$")


def _invoke(current_user: Dict[str, Any], operation, *args, code: str = "MANAGEMENT_DENIED", **kwargs):
    try:
        result = operation(current_user["_principal"], *args, **kwargs)
        return {"status": "success", "data": result}
    except AuthorizationError as exc:
        raise HTTPException(
            status_code=exc.status_code,
            detail={"code": code, "message": "Not found." if exc.status_code == 404 else str(exc)},
        ) from exc
    except AuthProviderUnavailableError as exc:
        raise HTTPException(status_code=503, detail={"code": "AUTH_PROVIDER_UNAVAILABLE", "message": "Authorization data provider is unavailable."}) from exc


@router.get("/organizations")
def list_organizations(current_user=Depends(get_authenticated_context)):
    return _invoke(current_user, current_user["_authorization_service"].list_organizations, code="ORGANIZATIONS_LIST_FAILED")


@router.post("/organizations", status_code=status.HTTP_201_CREATED)
def create_organization(payload: OrganizationCreate, current_user=Depends(get_authorized_current_user("organizations.create"))):
    return _invoke(current_user, current_user["_authorization_service"].create_organization, payload.model_dump(), code="ORGANIZATION_CREATE_FAILED")


@router.get("/organizations/{organization_id}")
def get_organization(organization_id: str, current_user=Depends(get_authenticated_context)):
    return _invoke(current_user, current_user["_authorization_service"].get_organization, organization_id, code="ORGANIZATION_READ_FAILED")


@router.put("/organizations/{organization_id}")
def update_organization(organization_id: str, payload: OrganizationUpdate, current_user=Depends(get_authenticated_context)):
    updates = payload.model_dump(exclude_unset=True)
    if not updates:
        raise HTTPException(status_code=422, detail={"code": "EMPTY_ORGANIZATION_UPDATE", "message": "Setidaknya satu field harus diubah."})
    return _invoke(current_user, current_user["_authorization_service"].update_organization, organization_id, updates, code="ORGANIZATION_UPDATE_FAILED")


@router.patch("/organizations/{organization_id}/status")
def set_organization_status(organization_id: str, payload: OrganizationStatusUpdate, current_user=Depends(get_authorized_current_user("organizations.suspend"))):
    return _invoke(current_user, current_user["_authorization_service"].set_organization_status, organization_id, payload.status, code="ORGANIZATION_STATUS_FAILED")


@router.get("/organizations/{organization_id}/members")
def list_members(organization_id: str, current_user=Depends(get_authenticated_context)):
    return _invoke(current_user, current_user["_authorization_service"].list_members, organization_id, code="MEMBER_LIST_FAILED")


@router.post("/organizations/{organization_id}/members", status_code=status.HTTP_201_CREATED)
def assign_membership(organization_id: str, payload: MembershipAssignment, current_user=Depends(get_authenticated_context)):
    return _invoke(current_user, current_user["_authorization_service"].assign_membership, organization_id, payload.user_id, payload.role, code="MEMBERSHIP_ASSIGN_FAILED")


@router.patch("/organizations/{organization_id}/members/{membership_id}")
def change_membership_role(organization_id: str, membership_id: str, payload: MembershipRoleUpdate, current_user=Depends(get_authenticated_context)):
    return _invoke(current_user, current_user["_authorization_service"].change_membership, organization_id, membership_id, payload.role, code="MEMBERSHIP_UPDATE_FAILED")


@router.delete("/organizations/{organization_id}/members/{membership_id}")
def revoke_membership(organization_id: str, membership_id: str, current_user=Depends(get_authenticated_context)):
    return _invoke(current_user, current_user["_authorization_service"].revoke_membership, organization_id, membership_id, code="MEMBERSHIP_REVOKE_FAILED")


@router.get("/admin/users")
def list_users(
    limit: int = Query(50, ge=1, le=200),
    offset: int = Query(0, ge=0),
    current_user=Depends(get_authorized_current_user("users.read")),
):
    return _invoke(current_user, current_user["_authorization_service"].list_users, limit, offset, code="USERS_LIST_FAILED")


@router.patch("/admin/users/{user_id}/status")
def set_user_status(user_id: str, payload: StatusUpdate, current_user=Depends(get_authorized_current_user("users.update"))):
    return _invoke(current_user, current_user["_authorization_service"].set_user_status, user_id, payload.status, code="USER_STATUS_FAILED")


@router.get("/admin/audit-events")
def list_audit_events(
    organization_id: Optional[str] = None,
    limit: int = Query(50, ge=1, le=200),
    offset: int = Query(0, ge=0),
    current_user=Depends(get_authorized_current_user("audit.read")),
):
    return _invoke(current_user, current_user["_authorization_service"].list_audit_events, organization_id, limit, offset, code="AUDIT_READ_FAILED")
