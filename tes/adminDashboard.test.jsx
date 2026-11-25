// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest'
import React from 'react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { AdminDashboard, getAdminNavigation } from '../src/pages/AdminDashboard.jsx'

afterEach(() => { cleanup(); vi.restoreAllMocks() })

const superContext = {
  mode: 'super_admin',
  user: { id: 'root', fullName: 'Root', email: 'root@example.test' },
  organizations: [
    { id: 'o1', name: 'Koperasi Padi', slug: 'koperasi-padi', status: 'active' },
    { id: 'o2', name: 'Tani Jaya', slug: 'tani-jaya', status: 'suspended' },
  ],
  membershipsByOrganization: {},
  capabilities: { usersRead: true, auditRead: true, organizationsManage: true, membersManage: true, usersStatusUpdate: true, orgStatusUpdate: true },
}

const orgAdminContext = {
  mode: 'organization_admin',
  user: { id: 'admin', fullName: 'Org Admin', email: 'admin@example.test' },
  organizations: [{ id: 'o1', name: 'Koperasi Padi', slug: 'koperasi-padi', status: 'active' }],
  membershipsByOrganization: { o1: [{ id: 'm1', user_id: 'admin', role: 'admin', status: 'active' }, { id: 'm2', user_id: 'farmer-1', role: 'farmer', status: 'active' }] },
  capabilities: { usersRead: false, auditRead: false, organizationsManage: true, membersManage: true, usersStatusUpdate: false, orgStatusUpdate: false, adminOrganizationIds: ['o1'] },
}

function makeApi(overrides = {}) {
  return {
    listOrganizations: vi.fn().mockResolvedValue(superContext.organizations),
    listUsers: vi.fn().mockResolvedValue([]),
    listMembers: vi.fn().mockResolvedValue([]),
    listAuditEvents: vi.fn().mockResolvedValue([]),
    createOrganization: vi.fn().mockResolvedValue({ id: 'o3', name: 'New Org', status: 'active' }),
    updateOrganization: vi.fn().mockResolvedValue({ id: 'o1', name: 'Updated', status: 'active' }),
    setOrganizationStatus: vi.fn().mockResolvedValue({ status: 'suspended' }),
    assignMembership: vi.fn().mockResolvedValue({ id: 'm3' }),
    changeMembershipRole: vi.fn().mockResolvedValue({ id: 'm2' }),
    revokeMembership: vi.fn().mockResolvedValue({ id: 'm2' }),
    setUserStatus: vi.fn().mockResolvedValue({ status: 'suspended' }),
    getOrganization: vi.fn().mockResolvedValue(superContext.organizations[0]),
    ...overrides,
  }
}

describe('admin dashboard', () => {
  it('shows platform navigation only for backend-authorized Super Admin', () => {
    expect(getAdminNavigation(superContext)).toEqual(expect.arrayContaining([
      expect.objectContaining({ id: 'overview', label: 'Overview' }),
      expect.objectContaining({ id: 'organizations', label: 'Organizations' }),
      expect.objectContaining({ id: 'users', label: 'Users' }),
      expect.objectContaining({ id: 'memberships', label: 'Memberships' }),
      expect.objectContaining({ id: 'audit', label: 'Audit Logs' }),
      expect.objectContaining({ id: 'system', label: 'System Status' }),
    ]))
  })

  it('limits Organization Admin navigation to assigned organization features', () => {
    const labels = getAdminNavigation(orgAdminContext).map(({ label }) => label)
    expect(labels).toEqual(['Overview', 'Members', 'Memberships', 'Organization Profile'])
    expect(labels).not.toContain('Users')
    expect(labels).not.toContain('Audit Logs')
  })

  it('does not render platform user management for an organization admin route', () => {
    render(<AdminDashboard context={orgAdminContext} api={makeApi()} route="users" onNavigate={vi.fn()} />)
    expect(screen.getByRole('heading', { name: 'Overview' })).toBeInTheDocument()
    expect(screen.queryByRole('heading', { name: 'Users' })).not.toBeInTheDocument()
    expect(screen.getByRole('alert')).toHaveTextContent(/permission denied|akses/i)
  })

  it('shows exact user totals from the authorized complete user list', async () => {
    const api = makeApi({ listUsers: vi.fn().mockResolvedValue([{ user_id: 'u1', status: 'active' }, { user_id: 'u2', status: 'pending_assignment' }]) })
    render(<AdminDashboard context={superContext} api={api} route="overview" onNavigate={vi.fn()} />)
    expect(await screen.findByText(/total users/i)).toBeInTheDocument()
    expect(screen.getAllByText('2').length).toBeGreaterThan(0)
    expect(api.listUsers).toHaveBeenCalledWith(200, 0)
  })

  it('creates organization through the supported API and validates the form', async () => {
    const api = makeApi()
    render(<AdminDashboard context={superContext} api={api} route="organizations" onNavigate={vi.fn()} />)
    fireEvent.click(screen.getByRole('button', { name: /create organization/i }))
    fireEvent.change(screen.getByLabelText(/name/i), { target: { value: 'New Org' } })
    fireEvent.change(screen.getByLabelText(/slug/i), { target: { value: 'new-org' } })
    fireEvent.click(screen.getByRole('button', { name: /^save$/i }))
    await waitFor(() => expect(api.createOrganization).toHaveBeenCalledWith({ name: 'New Org', slug: 'new-org', region: null, kabupaten: null }))
  })

  it('lists users with status filtering using the paginated API', async () => {
    const api = makeApi({ listUsers: vi.fn().mockResolvedValue([{ user_id: 'u1', status: 'pending_assignment', memberships: [] }]) })
    render(<AdminDashboard context={superContext} api={api} route="users" onNavigate={vi.fn()} />)
    await waitFor(() => expect(api.listUsers).toHaveBeenCalled())
    expect(screen.getByText(/pending_assignment/i)).toBeInTheDocument()
    fireEvent.mouseDown(screen.getByLabelText(/status/i))
    fireEvent.click(await screen.findByRole('option', { name: /active/i }))
    await waitFor(() => expect(screen.getAllByText(/no users|tidak ada pengguna/i).length).toBeGreaterThan(0))
  })

  it('assigns membership with only the supported organization roles', async () => {
    const api = makeApi({ listUsers: vi.fn().mockResolvedValue([{ user_id: 'u1', status: 'active', memberships: [] }]), listMembers: vi.fn().mockResolvedValue([]) })
    render(<AdminDashboard context={superContext} api={api} route="memberships" onNavigate={vi.fn()} />)
    fireEvent.click(await screen.findByRole('button', { name: /assign member/i }))
    fireEvent.change(screen.getByLabelText(/user id/i), { target: { value: 'u1' } })
    fireEvent.mouseDown(screen.getByLabelText(/organization/i))
    fireEvent.click(await screen.findByRole('option', { name: /koperasi padi/i }))
    fireEvent.mouseDown(screen.getByLabelText(/role/i))
    fireEvent.click(await screen.findByRole('option', { name: /farmer/i }))
    fireEvent.click(screen.getByRole('button', { name: /^assign$/i }))
    await waitFor(() => expect(api.assignMembership).toHaveBeenCalledWith('o1', { user_id: 'u1', role: 'farmer' }))
  })

  it('displays duplicate active membership conflict without role-update retry', async () => {
    const api = makeApi({ assignMembership: vi.fn().mockRejectedValue({ status: 409, code: 'CONFLICT', message: 'User already has an active membership.' }) })
    render(<AdminDashboard context={superContext} api={api} route="memberships" onNavigate={vi.fn()} />)
    fireEvent.click(await screen.findByRole('button', { name: /assign member/i }))
    fireEvent.change(screen.getByLabelText(/user id/i), { target: { value: 'u1' } })
    fireEvent.mouseDown(screen.getByLabelText(/organization/i))
    fireEvent.click(await screen.findByRole('option', { name: /koperasi padi/i }))
    fireEvent.mouseDown(screen.getByLabelText(/role/i))
    fireEvent.click(await screen.findByRole('option', { name: /farmer/i }))
    fireEvent.click(screen.getByRole('button', { name: /^assign$/i }))
    expect(await screen.findByText(/already has an active membership/i)).toBeInTheDocument()
    expect(api.changeMembershipRole).not.toHaveBeenCalled()
  })

  it('requires confirmation before revoking membership', async () => {
    const api = makeApi({ listMembers: vi.fn().mockResolvedValue([{ id: 'm2', user_id: 'farmer-1', full_name: 'Farmer One', role: 'farmer', status: 'active' }]) })
    render(<AdminDashboard context={orgAdminContext} api={api} route="memberships" onNavigate={vi.fn()} />)
    await screen.findByText('Farmer One')
    fireEvent.click(screen.getByRole('button', { name: /revoke membership/i }))
    expect(api.revokeMembership).not.toHaveBeenCalled()
    fireEvent.click(screen.getByRole('button', { name: /confirm revoke/i }))
    await waitFor(() => expect(api.revokeMembership).toHaveBeenCalledWith('o1', 'm2'))
  })

  it('shows API service-unavailable errors explicitly', async () => {
    const api = makeApi({ listOrganizations: vi.fn().mockRejectedValue({ status: 503, message: 'Management service unavailable.' }) })
    render(<AdminDashboard context={superContext} api={api} route="organizations" onNavigate={vi.fn()} />)
    expect(await screen.findByText(/layanan tidak tersedia/i)).toBeInTheDocument()
  })
})
