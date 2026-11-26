import { getAuthHeaders } from '../business/authStorage.js'

const STATUS_CODES = {
  401: 'AUTH_REQUIRED',
  403: 'FORBIDDEN',
  404: 'NOT_FOUND',
  409: 'CONFLICT',
  422: 'VALIDATION_ERROR',
  503: 'SERVICE_UNAVAILABLE',
}

export class AdminApiError extends Error {
  constructor(status, code, message, details = null) {
    super(message)
    this.name = 'AdminApiError'
    this.status = status
    this.code = code
    this.details = details
  }
}

function messageFrom(body, fallback) {
  return body?.detail?.message || body?.detail || body?.error?.message || body?.message || fallback
}

export function createAdminApi({ fetchImpl = globalThis.fetch, getHeaders = getAuthHeaders } = {}) {
  async function request(path, { method = 'GET', body, signal } = {}) {
    const sessionHeaders = getHeaders() || {}
    const headers = { ...sessionHeaders, Accept: 'application/json' }
    if (body !== undefined) headers['Content-Type'] = 'application/json'
    let response
    try {
      response = await fetchImpl(path, {
        method,
        headers,
        ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
        ...(signal ? { signal } : {}),
      })
    } catch {
      throw new AdminApiError(0, 'NETWORK_ERROR', 'Server tidak dapat dihubungi. Periksa koneksi lalu coba lagi.')
    }
    const payload = await response.json().catch(() => null)
    if (!response.ok) {
      const status = response.status
      const fallback = status === 503
        ? 'Layanan manajemen sedang tidak tersedia.'
        : status === 409
          ? 'Data bertentangan dengan kondisi saat ini.'
          : status === 422
            ? 'Periksa kembali data yang dimasukkan.'
            : status === 401
              ? 'Sesi berakhir. Silakan masuk kembali.'
              : status === 403
                ? 'Anda tidak memiliki izin untuk tindakan ini.'
                : status === 404
                  ? 'Data atau endpoint tidak ditemukan.'
                  : 'Permintaan gagal.'
      throw new AdminApiError(status, payload?.detail?.code || STATUS_CODES[status] || 'REQUEST_FAILED', messageFrom(payload, fallback), payload)
    }
    return payload?.data
  }

  return {
    request,
    getSession: () => request('/api/v1/auth/session'),
    listOrganizations: () => request('/api/v1/organizations'),
    createOrganization: (body) => request('/api/v1/organizations', { method: 'POST', body }),
    getOrganization: (id) => request(`/api/v1/organizations/${encodeURIComponent(id)}`),
    updateOrganization: (id, body) => request(`/api/v1/organizations/${encodeURIComponent(id)}`, { method: 'PUT', body }),
    setOrganizationStatus: (id, status) => request(`/api/v1/organizations/${encodeURIComponent(id)}/status`, { method: 'PATCH', body: { status } }),
    listMembers: (id) => request(`/api/v1/organizations/${encodeURIComponent(id)}/members`),
    assignMembership: (id, body) => request(`/api/v1/organizations/${encodeURIComponent(id)}/members`, { method: 'POST', body }),
    changeMembershipRole: (orgId, membershipId, role) => request(`/api/v1/organizations/${encodeURIComponent(orgId)}/members/${encodeURIComponent(membershipId)}`, { method: 'PATCH', body: { role } }),
    revokeMembership: (orgId, membershipId) => request(`/api/v1/organizations/${encodeURIComponent(orgId)}/members/${encodeURIComponent(membershipId)}`, { method: 'DELETE' }),
    listUsers: (limit = 50, offset = 0) => request(`/api/v1/admin/users?limit=${limit}&offset=${offset}`),
    setUserStatus: (id, status) => request(`/api/v1/admin/users/${encodeURIComponent(id)}/status`, { method: 'PATCH', body: { status } }),
    updateUserProfile: (id, body) => request(`/api/v1/admin/users/${encodeURIComponent(id)}/profile`, { method: 'PATCH', body }),
    getSystemStatus: () => request('/api/v1/admin/system-status'),
    listAuditEvents: (organizationId = null, limit = 50, offset = 0) => {
      const params = new URLSearchParams({ limit: String(limit), offset: String(offset) })
      if (organizationId) params.set('organization_id', organizationId)
      return request(`/api/v1/admin/audit-events?${params}`)
    },
  }
}

function isExpectedPermissionDenial(error) {
  return error instanceof AdminApiError && error.status === 403
}

function requireAvailable(error) {
  if (error instanceof AdminApiError && [0, 401, 503].includes(error.status)) throw error
}

export async function loadAdminContext(api) {
  const session = await api.getSession()
  const verifiedUser = session?.user
  if (!verifiedUser?.id) throw new AdminApiError(401, 'AUTH_REQUIRED', 'Sesi terverifikasi tidak tersedia.')

  const organizationResult = await api.listOrganizations()
  const organizations = Array.isArray(organizationResult) ? organizationResult : organizationResult?.organizations
  if (!Array.isArray(organizations)) throw new AdminApiError(503, 'INVALID_RESPONSE', 'Respons daftar organisasi tidak valid.')

  const currentUserId = String(verifiedUser.id)
  let usersRead = false
  try {
    await api.listUsers(1, 0)
    usersRead = true
  } catch (error) {
    requireAvailable(error)
    if (!isExpectedPermissionDenial(error)) throw error
  }

  if (usersRead) {
    let auditRead = false
    try {
      await api.listAuditEvents(null, 1, 0)
      auditRead = true
    } catch (error) {
      requireAvailable(error)
      if (!isExpectedPermissionDenial(error)) throw error
    }
    return {
      user: {
        id: currentUserId,
        email: verifiedUser.email || '',
        fullName: verifiedUser.fullName || verifiedUser.full_name || verifiedUser.user_metadata?.full_name || verifiedUser.user_metadata?.name || (verifiedUser.email ? verifiedUser.email.split('@')[0] : 'Super Admin'),
      },
      mode: 'super_admin',
      organizations,
      membershipsByOrganization: {},
      capabilities: { usersRead: true, auditRead, organizationsManage: true, membersManage: true, usersStatusUpdate: true, orgStatusUpdate: true },
    }
  }

  const membershipsByOrganization = {}
  const adminOrganizationIds = []
  for (const organization of organizations) {
    if (!organization?.id) continue
    try {
      const members = await api.listMembers(organization.id)
      const safeMembers = Array.isArray(members) ? members : []
      membershipsByOrganization[organization.id] = safeMembers
      const ownMembership = safeMembers.find((member) => String(member.user_id) === currentUserId && member.status === 'active')
      if (ownMembership?.role === 'admin' && organization.status === 'active') adminOrganizationIds.push(organization.id)
    } catch (error) {
      requireAvailable(error)
      if (!isExpectedPermissionDenial(error)) throw error
    }
  }
  const capabilities = {
    usersRead: false,
    auditRead: false,
    organizationsManage: adminOrganizationIds.length > 0,
    membersManage: adminOrganizationIds.length > 0,
    usersStatusUpdate: false,
    orgStatusUpdate: false,
    adminOrganizationIds,
  }
  return {
    user: {
      id: currentUserId,
      email: verifiedUser.email || '',
      fullName: verifiedUser.fullName || verifiedUser.full_name || verifiedUser.user_metadata?.full_name || verifiedUser.user_metadata?.name || (verifiedUser.email ? verifiedUser.email.split('@')[0] : 'Admin Organisasi'),
    },
    mode: adminOrganizationIds.length > 0 ? 'organization_admin' : 'member',
    organizations,
    membershipsByOrganization,
    capabilities,
  }
}

export function errorPresentation(error) {
  if (!(error instanceof AdminApiError)) return { title: 'Terjadi kesalahan', message: 'Permintaan gagal. Coba lagi.' }
  const titles = {
    0: 'Koneksi bermasalah',
    401: 'Sesi berakhir',
    403: 'Akses ditolak',
    404: 'Tidak ditemukan',
    409: 'Konflik data',
    422: 'Data belum valid',
    503: 'Layanan tidak tersedia',
  }
  return { title: titles[error.status] || 'Permintaan gagal', message: error.message, status: error.status, code: error.code }
}
