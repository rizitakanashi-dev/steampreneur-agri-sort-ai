"""Organization-scoped authorization primitives backed by Supabase Auth/RLS."""

from dataclasses import dataclass
import json
import logging
import re
from typing import Any, Dict, Iterable, List, Mapping, Optional, Protocol
import urllib.error
import urllib.parse
import urllib.request

from server.config.auth_config import AuthConfig, AuthProviderUnavailableError

logger = logging.getLogger("agrisort.authorization")

ORG_PERMISSIONS = frozenset({
    "organization.read",
    "organization.update",
    "members.read",
    "members.invite",
    "members.update",
    "members.revoke",
    "scans.read",
    "scans.create",
    "scans.update",
    "scans.delete",
    "reports.read",
})
PLATFORM_PERMISSIONS = frozenset({
    "organizations.read",
    "organizations.create",
    "organizations.update",
    "organizations.suspend",
    "users.read",
    "users.update",
    "memberships.assign",
    "memberships.revoke",
    "audit.read",
    "pricing.sync",
})
ALL_PERMISSIONS = ORG_PERMISSIONS | PLATFORM_PERMISSIONS
PRIVATE_RESOURCE_PERMISSIONS = frozenset({"scans.read", "scans.create", "scans.update", "scans.delete"})

# Keep organization-admin powers deliberately scoped. Organization lifecycle,
# platform administration, and audit access remain Super Admin-only.
ROLE_PERMISSIONS = {
    "super_admin": frozenset(ALL_PERMISSIONS),
    "admin": frozenset({
        "organization.read",
        "organization.update",
        "members.read",
        "members.invite",
        "members.update",
        "members.revoke",
        "scans.read",
        "scans.create",
        "scans.update",
        "scans.delete",
        "reports.read",
    }),
    "farmer": frozenset({"organization.read", "scans.read", "scans.create", "reports.read"}),
    "merchant": frozenset({"organization.read", "scans.read", "reports.read"}),
}
ORGANIZATION_ROLES = frozenset({"admin", "farmer", "merchant"})


class AuthorizationError(Exception):
    """Authorization denial with an HTTP-compatible status code."""

    def __init__(self, message: str = "Akses ditolak.", status_code: int = 403):
        super().__init__(message)
        self.status_code = status_code


@dataclass(frozen=True)
class Membership:
    membership_id: str
    organization_id: str
    user_id: str
    role: str
    status: str


@dataclass(frozen=True)
class ActivePrincipal:
    user_id: str
    user_status: str
    platform_role: Optional[str]
    memberships: tuple[Membership, ...]
    permission_context: Mapping[str, frozenset[str]]

    def organization_membership(self, organization_id: str) -> Optional[Membership]:
        return next((membership for membership in self.memberships if membership.organization_id == organization_id), None)


@dataclass(frozen=True)
class ResourceContext:
    resource_type: str
    owner_user_id: Optional[str]
    organization_id: Optional[str]
    status: str = "active"


class AuthorizationRepository(Protocol):
    def get_user_profile(self, user_id: str) -> Optional[Mapping[str, Any]]: ...
    def get_platform_role(self, user_id: str) -> Optional[str]: ...
    def list_memberships(self, user_id: str) -> Iterable[Mapping[str, Any]]: ...
    def get_organization_status(self, organization_id: str) -> Optional[str]: ...
    def get_membership(self, user_id: str, organization_id: str) -> Optional[Mapping[str, Any]]: ...
    def has_active_membership(self, user_id: str, organization_id: str) -> bool: ...
    def get_resource_context(self, resource_type: str, resource_id: str) -> Optional[ResourceContext]: ...
    def rpc(self, function_name: str, payload: Mapping[str, Any]) -> Any: ...


class SupabaseAuthorizationRepository:
    """Read authorization state using the verified caller JWT and anon key."""

    def __init__(self, config: AuthConfig, access_token: str, timeout_seconds: float = 8.0):
        if config.auth_mode != "supabase":
            raise AuthorizationError("Organization authorization requires Supabase Auth.", 503)
        if not access_token:
            raise AuthorizationError("Sesi masuk diperlukan.", 401)
        self.base_url = config.supabase_url.rstrip("/")
        self.anon_key = config.supabase_anon_key
        self.access_token = access_token
        self.verified_user_id: Optional[str] = None
        self.timeout_seconds = timeout_seconds

    def _select(self, table: str, query: str) -> List[Dict[str, Any]]:
        url = f"{self.base_url}/rest/v1/{table}?{query}"
        request = urllib.request.Request(url, headers={
            "apikey": self.anon_key,
            "Authorization": f"Bearer {self.access_token}",
            "Accept": "application/json",
        })
        try:
            with urllib.request.urlopen(request, timeout=self.timeout_seconds) as response:
                payload = json.loads(response.read().decode("utf-8"))
            if not isinstance(payload, list):
                raise AuthProviderUnavailableError("Authorization data provider returned an invalid response.")
            return payload
        except urllib.error.HTTPError as exc:
            exc.close()
            if exc.code in (401, 403):
                raise AuthorizationError("Identitas tidak memiliki akses.", 403) from exc
            if exc.code == 404:
                raise AuthProviderUnavailableError("Authorization schema is unavailable.") from exc
            raise AuthProviderUnavailableError("Authorization data provider is unavailable.") from exc
        except (urllib.error.URLError, TimeoutError, json.JSONDecodeError, UnicodeDecodeError) as exc:
            logger.warning("Authorization data provider unavailable")
            raise AuthProviderUnavailableError("Authorization data provider is unavailable.") from exc

    def get_user_profile(self, user_id: str) -> Optional[Mapping[str, Any]]:
        rows = self._select("user_profiles", f"select=user_id,status&user_id=eq.{urllib.parse.quote(user_id, safe='')}&limit=1")
        return rows[0] if rows else None

    def get_platform_role(self, user_id: str) -> Optional[str]:
        rows = self._select("platform_roles", f"select=role&user_id=eq.{urllib.parse.quote(user_id, safe='')}&limit=1")
        return str(rows[0]["role"]) if rows else None

    def list_memberships(self, user_id: str) -> Iterable[Mapping[str, Any]]:
        rows = self._select(
            "organization_memberships",
            "select=id,organization_id,user_id,role,status,organizations!inner(status)"
            f"&user_id=eq.{urllib.parse.quote(user_id, safe='')}&status=eq.active",
        )
        return rows

    def get_organization_status(self, organization_id: str) -> Optional[str]:
        rows = self._select("organizations", f"select=status&id=eq.{urllib.parse.quote(organization_id, safe='')}&limit=1")
        return str(rows[0]["status"]) if rows else None

    def get_membership(self, user_id: str, organization_id: str) -> Optional[Mapping[str, Any]]:
        rows = self._select(
            "organization_memberships",
            "select=id,organization_id,user_id,role,status,organizations!inner(status)"
            f"&user_id=eq.{urllib.parse.quote(user_id, safe='')}"
            f"&organization_id=eq.{urllib.parse.quote(organization_id, safe='')}&limit=1",
        )
        return rows[0] if rows else None

    def has_active_membership(self, user_id: str, organization_id: str) -> bool:
        rows = self._select(
            "organization_memberships",
            "select=id&status=eq.active"
            f"&user_id=eq.{urllib.parse.quote(user_id, safe='')}"
            f"&organization_id=eq.{urllib.parse.quote(organization_id, safe='')}&limit=1",
        )
        return bool(rows)

    def set_verified_user_id(self, user_id: str) -> None:
        self.verified_user_id = user_id

    def get_resource_context(self, resource_type: str, resource_id: str) -> Optional[ResourceContext]:
        if resource_type != "scan":
            raise AuthorizationError("Resource type is not supported for authorization.", 403)
        if not self.verified_user_id:
            raise AuthorizationError("Sesi masuk diperlukan.", 401)
        rows = self._select("scans", f"select=user_id&scan_id=eq.{urllib.parse.quote(resource_id, safe='')}&user_id=eq.{urllib.parse.quote(self.verified_user_id, safe='')}&limit=1")
        if not rows:
            return None
        return ResourceContext("scan", rows[0].get("user_id"), None)

    def rpc(self, function_name: str, payload: Mapping[str, Any]) -> Any:
        if not re.fullmatch(r"rbac_api_[a-z_]+", function_name):
            raise AuthorizationError("RPC operation is not supported.", 403)
        url = f"{self.base_url}/rest/v1/rpc/{function_name}"
        request = urllib.request.Request(
            url,
            data=json.dumps(dict(payload)).encode("utf-8"),
            headers={
                "apikey": self.anon_key,
                "Authorization": f"Bearer {self.access_token}",
                "Content-Type": "application/json",
                "Accept": "application/json",
            },
            method="POST",
        )
        try:
            with urllib.request.urlopen(request, timeout=self.timeout_seconds) as response:
                body = response.read().decode("utf-8")
            return json.loads(body) if body else None
        except urllib.error.HTTPError as exc:
            exc.close()
            if exc.code in (401, 403, 404, 409, 422):
                mapped_status = {401: 401, 403: 403, 404: 503, 409: 409, 422: 422}[exc.code]
                raise AuthorizationError("Management operation was denied.", mapped_status) from exc
            raise AuthProviderUnavailableError("Authorization provider is unavailable.") from exc
        except (urllib.error.URLError, TimeoutError, json.JSONDecodeError, UnicodeDecodeError) as exc:
            logger.warning("Authorization management provider unavailable")
            raise AuthProviderUnavailableError("Authorization provider is unavailable.") from exc


class AuthorizationService:
    def __init__(self, repository: AuthorizationRepository):
        self.repository = repository

    def get_active_principal(self, verified_user: Mapping[str, Any]) -> ActivePrincipal:
        user_id = str(verified_user.get("id") or "").strip()
        if not user_id:
            raise AuthorizationError("Sesi masuk diperlukan.", 401)
        profile = self.repository.get_user_profile(user_id)
        if not profile:
            raise AuthorizationError("Profil pengguna belum aktif.", 403)
        user_status = str(profile.get("status", ""))
        if user_status not in {"active", "pending_assignment"}:
            raise AuthorizationError("Pengguna tidak aktif.", 403)

        platform_role = self.repository.get_platform_role(user_id)
        if platform_role not in (None, "super_admin"):
            logger.error("Invalid platform role stored for user")
            raise AuthorizationError("Peran platform tidak valid.", 403)

        memberships: List[Membership] = []
        for row in self.repository.list_memberships(user_id):
            role = str(row.get("role", ""))
            status = str(row.get("status", ""))
            organization_id = str(row.get("organization_id", ""))
            organization_data = row.get("organizations") or {}
            organization_status = organization_data.get("status") if isinstance(organization_data, Mapping) else None
            if role not in ORGANIZATION_ROLES or status != "active" or organization_status != "active" or not organization_id:
                continue
            memberships.append(Membership(str(row.get("id", "")), organization_id, user_id, role, status))

        return ActivePrincipal(
            user_id=user_id,
            user_status=user_status,
            platform_role=platform_role,
            memberships=tuple(memberships),
            permission_context={membership.organization_id: ROLE_PERMISSIONS[membership.role] for membership in memberships},
        )

    @staticmethod
    def has_permission(principal: ActivePrincipal, action: str, organization_id: Optional[str] = None) -> bool:
        if action not in ALL_PERMISSIONS or principal.user_status != "active":
            return False
        if principal.platform_role == "super_admin":
            return action in ROLE_PERMISSIONS["super_admin"]
        if action in PLATFORM_PERMISSIONS or not organization_id:
            return False
        membership = principal.organization_membership(organization_id)
        return bool(membership and action in ROLE_PERMISSIONS.get(membership.role, frozenset()))

    def require_permission(self, principal: ActivePrincipal, action: str) -> ActivePrincipal:
        if action not in PLATFORM_PERMISSIONS or principal.platform_role != "super_admin" or principal.user_status != "active":
            raise AuthorizationError("Izin platform tidak mencukupi.")
        return principal

    def require_org_access(self, principal: ActivePrincipal, organization_id: str, action: str) -> Membership:
        if not organization_id or action not in ORG_PERMISSIONS or principal.user_status != "active":
            raise AuthorizationError()
        organization_status = self.repository.get_organization_status(organization_id)
        if organization_status != "active":
            raise AuthorizationError()
        if principal.platform_role == "super_admin":
            return Membership("", organization_id, principal.user_id, "super_admin", "active")
        row = self.repository.get_membership(principal.user_id, organization_id)
        organization = (row or {}).get("organizations") or {}
        if not row or row.get("status") != "active" or organization.get("status") != "active":
            raise AuthorizationError()
        role = str(row.get("role", ""))
        if role not in ORGANIZATION_ROLES or action not in ROLE_PERMISSIONS[role]:
            raise AuthorizationError()
        return Membership(str(row.get("id", "")), organization_id, principal.user_id, role, "active")

    def require_resource_access(
        self,
        principal: ActivePrincipal,
        resource_type: str,
        resource_id: str,
        action: str,
    ) -> ResourceContext:
        if action not in PRIVATE_RESOURCE_PERMISSIONS or principal.user_status not in {"active", "pending_assignment"}:
            raise AuthorizationError()
        resource = self.repository.get_resource_context(resource_type, resource_id)
        if resource is None or resource.status != "active" or resource.owner_user_id != principal.user_id:
            raise AuthorizationError("Resource tidak ditemukan.", 404)
        if resource.organization_id:
            self.require_org_access(principal, resource.organization_id, action)
        return resource

    def require_owned_resource_permission(self, principal: ActivePrincipal, action: str) -> ActivePrincipal:
        if action not in PRIVATE_RESOURCE_PERMISSIONS or principal.user_status not in {"active", "pending_assignment"}:
            raise AuthorizationError()
        fresh_principal = self.get_active_principal({"id": principal.user_id})
        if fresh_principal.user_status not in {"active", "pending_assignment"}:
            raise AuthorizationError("Pengguna tidak aktif.", 403)
        return fresh_principal

    def validate_membership_assignment(
        self,
        actor: ActivePrincipal,
        organization_id: str,
        target_user_id: str,
        role: str,
    ) -> None:
        if role not in ORGANIZATION_ROLES:
            raise AuthorizationError("Role organisasi tidak valid.")
        self.require_org_access(actor, organization_id, "members.invite")
        if actor.platform_role != "super_admin" and role == "admin":
            raise AuthorizationError("Admin organisasi tidak dapat menetapkan role admin.")
        if actor.platform_role != "super_admin" and target_user_id == actor.user_id:
            raise AuthorizationError("Admin tidak dapat mengubah membership sendiri.")

    @staticmethod
    def sanitize_audit_metadata(metadata: Optional[Mapping[str, Any]]) -> Dict[str, Any]:
        forbidden = re.compile(r"password|token|secret|otp|credential|authorization|api.?key|email|phone|address", re.IGNORECASE)
        allowed = {"role", "status", "previous_status", "changed_fields", "slug", "resource_type", "reason_code", "count"}
        result: Dict[str, Any] = {}

        def clean(value: Any, depth: int = 0) -> Any:
            if depth > 3:
                return None
            if value is None or isinstance(value, (bool, int, float)):
                return value
            if isinstance(value, str):
                return value[:256]
            if isinstance(value, Mapping):
                return {
                    str(key)[:64]: clean(item, depth + 1)
                    for key, item in value.items()
                    if not forbidden.search(str(key)) and str(key) in allowed
                }
            if isinstance(value, (list, tuple)):
                return [clean(item, depth + 1) for item in value[:20]]
            return None

        for key, value in (metadata or {}).items():
            name = str(key)
            if not forbidden.search(name) and name in allowed:
                result[name[:64]] = clean(value)
        return result

    def list_organizations(self, principal: ActivePrincipal) -> Any:
        if principal.platform_role == "super_admin":
            self.require_permission(principal, "organizations.read")
            return self.repository.rpc("rbac_api_list_organizations", {})
        return self.repository.rpc("rbac_api_list_my_organizations", {})

    def create_organization(self, principal: ActivePrincipal, values: Mapping[str, Any]) -> Any:
        self.require_permission(principal, "organizations.create")
        self._validate_organization(values)
        return self.repository.rpc("rbac_api_create_organization", {
            "org_name": values["name"].strip(),
            "org_slug": values["slug"].strip().lower(),
            "org_region": values.get("region"),
            "org_kabupaten": values.get("kabupaten"),
        })

    def get_organization(self, principal: ActivePrincipal, organization_id: str) -> Any:
        if principal.platform_role == "super_admin":
            self.require_permission(principal, "organizations.read")
            return self.repository.rpc("rbac_api_get_organization", {"org_id": organization_id})
        self.require_org_access(principal, organization_id, "organization.read")
        return self.repository.rpc("rbac_api_get_organization", {"org_id": organization_id})

    def update_organization(self, principal: ActivePrincipal, organization_id: str, values: Mapping[str, Any]) -> Any:
        if not values:
            raise AuthorizationError("Organization update is empty.", 422)
        self._validate_organization(values, require_slug=False)
        if principal.platform_role == "super_admin":
            self.require_permission(principal, "organizations.update")
        else:
            self.require_org_access(principal, organization_id, "organization.update")
        return self.repository.rpc("rbac_api_update_organization", {
            "org_id": organization_id,
            "org_name": values.get("name", "").strip() if values.get("name") else None,
            "org_slug": values.get("slug", "").strip().lower() if values.get("slug") else None,
            "org_region": values.get("region"),
            "org_kabupaten": values.get("kabupaten"),
        })

    def set_organization_status(self, principal: ActivePrincipal, organization_id: str, status: str) -> Any:
        self.require_permission(principal, "organizations.suspend")
        if status not in {"active", "suspended"}:
            raise AuthorizationError("Organization status is invalid.", 422)
        return self.repository.rpc("rbac_api_set_organization_status", {"org_id": organization_id, "new_status": status})

    def list_members(self, principal: ActivePrincipal, organization_id: str) -> Any:
        if principal.platform_role == "super_admin":
            self.require_permission(principal, "users.read")
        else:
            self.require_org_access(principal, organization_id, "members.read")
        return self.repository.rpc("rbac_api_list_members", {"org_id": organization_id})

    def assign_membership(self, principal: ActivePrincipal, organization_id: str, user_id: str, role: str) -> Any:
        self.validate_membership_assignment(principal, organization_id, user_id, role)
        if self.repository.has_active_membership(user_id, organization_id):
            raise AuthorizationError("User already has an active membership in this organization.", 409)
        return self.repository.rpc("rbac_api_assign_membership", {
            "org_id": organization_id,
            "target_user_id": user_id,
            "new_role": role,
        })

    def change_membership(self, principal: ActivePrincipal, organization_id: str, membership_id: str, role: str) -> Any:
        if role not in ORGANIZATION_ROLES:
            raise AuthorizationError("Role organisasi tidak valid.", 422)
        if principal.platform_role == "super_admin":
            self.require_permission(principal, "memberships.assign")
        else:
            self.require_org_access(principal, organization_id, "members.update")
            if role == "admin":
                raise AuthorizationError("Admin organisasi tidak dapat menetapkan role admin.")
        return self.repository.rpc("rbac_api_change_membership", {
            "org_id": organization_id,
            "membership_id": membership_id,
            "new_role": role,
        })

    def revoke_membership(self, principal: ActivePrincipal, organization_id: str, membership_id: str) -> Any:
        if principal.platform_role == "super_admin":
            self.require_permission(principal, "memberships.revoke")
        else:
            self.require_org_access(principal, organization_id, "members.revoke")
        return self.repository.rpc("rbac_api_revoke_membership", {
            "org_id": organization_id,
            "membership_id": membership_id,
        })

    def list_users(self, principal: ActivePrincipal, limit: int = 50, offset: int = 0) -> Any:
        self.require_permission(principal, "users.read")
        if not 1 <= limit <= 200 or offset < 0:
            raise AuthorizationError("Pagination is invalid.", 422)
        return self.repository.rpc("rbac_api_list_users", {"page_limit": limit, "page_offset": offset})

    def set_user_status(self, principal: ActivePrincipal, user_id: str, status: str) -> Any:
        self.require_permission(principal, "users.update")
        if status not in {"active", "suspended", "pending_assignment"}:
            raise AuthorizationError("User status is invalid.", 422)
        if user_id == principal.user_id and status != "active":
            raise AuthorizationError("A user cannot suspend themselves.")
        return self.repository.rpc("rbac_api_set_user_status", {"target_user_id": user_id, "new_status": status})

    def list_audit_events(self, principal: ActivePrincipal, organization_id: Optional[str], limit: int = 50, offset: int = 0) -> Any:
        self.require_permission(principal, "audit.read")
        if not 1 <= limit <= 200 or offset < 0:
            raise AuthorizationError("Pagination is invalid.", 422)
        return self.repository.rpc("rbac_api_list_audit_events", {
            "org_id": organization_id,
            "page_limit": limit,
            "page_offset": offset,
        })

    @staticmethod
    def _validate_organization(values: Mapping[str, Any], require_slug: bool = True) -> None:
        name = values.get("name")
        slug = values.get("slug")
        if name is not None and (not isinstance(name, str) or not 1 <= len(name.strip()) <= 160):
            raise AuthorizationError("Organization name is invalid.", 422)
        if require_slug and name is None:
            raise AuthorizationError("Organization name is required.", 422)
        if require_slug and (not isinstance(slug, str) or not re.fullmatch(r"[a-z0-9]+(?:-[a-z0-9]+)*", slug.strip().lower())):
            raise AuthorizationError("Organization slug is invalid.", 422)
        if slug is not None and (not isinstance(slug, str) or not re.fullmatch(r"[a-z0-9]+(?:-[a-z0-9]+)*", slug.strip().lower())):
            raise AuthorizationError("Organization slug is invalid.", 422)
        for key in ("region", "kabupaten"):
            if values.get(key) is not None and (not isinstance(values[key], str) or len(values[key]) > 120):
                raise AuthorizationError(f"Organization {key} is invalid.", 422)

    @staticmethod
    def ensure_last_super_admin_removal_allowed(active_super_admin_count: int) -> None:
        if active_super_admin_count <= 1:
            raise AuthorizationError("Cannot remove or suspend the last active Super Admin.")
