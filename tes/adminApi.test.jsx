import { afterEach, describe, expect, it, vi } from 'vitest'
import { createAdminApi, AdminApiError, loadAdminContext } from '../src/services/adminApi.js'

const authHeaders = { Authorization: 'Bearer session-token' }

afterEach(() => vi.restoreAllMocks())

describe('admin API client', () => {
  it('uses the existing auth header mechanism without storing another token', async () => {
    const fetchImpl = vi.fn().mockResolvedValue({ ok: true, status: 200, json: async () => ({ data: [] }) })
    const api = createAdminApi({ fetchImpl, getHeaders: () => authHeaders })
    await api.request('/api/v1/organizations')
    expect(fetchImpl).toHaveBeenCalledWith('/api/v1/organizations', expect.objectContaining({ headers: expect.objectContaining(authHeaders) }))
  })

  it.each([
    [401, 'AUTH_REQUIRED'],
    [403, 'FORBIDDEN'],
    [404, 'NOT_FOUND'],
    [409, 'CONFLICT'],
    [422, 'VALIDATION_ERROR'],
    [503, 'AUTH_PROVIDER_UNAVAILABLE'],
  ])('preserves status %i as a typed API error', async (status, code) => {
    const fetchImpl = vi.fn().mockResolvedValue({ ok: false, status, json: async () => ({ detail: { code, message: 'safe message' } }) })
    const api = createAdminApi({ fetchImpl, getHeaders: () => authHeaders })
    await expect(api.request('/api/v1/organizations')).rejects.toMatchObject({ status, code })
  })

  it('detects Super Admin only from successful backend-authorized reads', async () => {
    const calls = []
    const fetchImpl = vi.fn(async (path) => {
      calls.push(path)
      if (path.endsWith('/auth/session')) return { ok: true, status: 200, json: async () => ({ data: { user: { id: 'user-1', email: 'admin@example.test' } } }) }
      if (path.endsWith('/organizations')) return { ok: true, status: 200, json: async () => ({ data: [{ id: 'org-1', name: 'Koperasi', status: 'active' }] }) }
      if (path.includes('/admin/users')) return { ok: true, status: 200, json: async () => ({ data: [] }) }
      if (path.includes('/audit-events')) return { ok: true, status: 200, json: async () => ({ data: [] }) }
      if (path.includes('/members')) return { ok: true, status: 200, json: async () => ({ data: [] }) }
      throw new Error(`Unexpected endpoint ${path}`)
    })
    const context = await loadAdminContext(createAdminApi({ fetchImpl, getHeaders: () => authHeaders }))
    expect(context.mode).toBe('super_admin')
    expect(context.capabilities).toMatchObject({ usersRead: true, auditRead: true, organizationsManage: true })
    expect(calls).toContain('/api/v1/admin/users?limit=1&offset=0')
  })

  it('does not infer admin access from cached user role fields', async () => {
    const fetchImpl = vi.fn(async (path) => {
      if (path.endsWith('/auth/session')) return { ok: true, status: 200, json: async () => ({ data: { user: { id: 'user-1', email: 'admin@example.test', role: 'super_admin' } } }) }
      if (path.endsWith('/organizations')) return { ok: true, status: 200, json: async () => ({ data: [{ id: 'org-1', name: 'Koperasi', status: 'active' }] }) }
      return { ok: false, status: 403, json: async () => ({ detail: { code: 'FORBIDDEN', message: 'denied' } }) }
    })
    const context = await loadAdminContext(createAdminApi({ fetchImpl, getHeaders: () => authHeaders }))
    expect(context.mode).toBe('member')
    expect(context.capabilities.usersRead).toBe(false)
    expect(context.user.role).toBeUndefined()
  })
})
