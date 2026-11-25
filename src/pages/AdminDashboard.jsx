import { useEffect, useMemo, useState } from 'react'
import {
  Alert, AppBar, Avatar, Box, Button, Card, CardContent, Chip, CircularProgress,
  Container, Dialog, DialogActions, DialogContent, DialogTitle, Divider, Drawer,
  FormControl, Grid, IconButton, InputLabel, List, ListItemButton, ListItemIcon,
  ListItemText, MenuItem, Paper, Select, Skeleton, Stack, Table, TableBody,
  TableCell, TableContainer, TableHead, TablePagination, TableRow, TextField,
  Toolbar, Typography, useMediaQuery, useTheme,
} from '@mui/material'
import AgricultureRoundedIcon from '@mui/icons-material/AgricultureRounded'
import AssessmentRoundedIcon from '@mui/icons-material/AssessmentRounded'
import BusinessRoundedIcon from '@mui/icons-material/BusinessRounded'
import DashboardRoundedIcon from '@mui/icons-material/DashboardRounded'
import GroupsRoundedIcon from '@mui/icons-material/GroupsRounded'
import ManageAccountsRoundedIcon from '@mui/icons-material/ManageAccountsRounded'
import MenuRoundedIcon from '@mui/icons-material/MenuRounded'
import RefreshRoundedIcon from '@mui/icons-material/RefreshRounded'
import SettingsSuggestRoundedIcon from '@mui/icons-material/SettingsSuggestRounded'
import ShieldRoundedIcon from '@mui/icons-material/ShieldRounded'
import { createAdminApi, AdminApiError, errorPresentation, loadAdminContext } from '../services/adminApi.js'

const drawerWidth = 256
const PAGE_SIZE = 25
const roles = ['admin', 'farmer', 'merchant']
const statusOptions = ['active', 'suspended', 'pending_assignment']
const routeTitles = {
  overview: 'Overview', organizations: 'Organizations', users: 'Users', memberships: 'Memberships',
  members: 'Members', profile: 'Organization Profile', audit: 'Audit Logs', system: 'System Status',
}

export function getAdminNavigation(context) {
  if (!context || context.mode === 'member') return []
  if (context.mode === 'super_admin') return [
    { id: 'overview', label: 'Overview', icon: DashboardRoundedIcon },
    { id: 'organizations', label: 'Organizations', icon: BusinessRoundedIcon },
    { id: 'users', label: 'Users', icon: ManageAccountsRoundedIcon },
    { id: 'memberships', label: 'Memberships', icon: GroupsRoundedIcon },
    ...(context.capabilities.auditRead ? [{ id: 'audit', label: 'Audit Logs', icon: AssessmentRoundedIcon }] : []),
    { id: 'system', label: 'System Status', icon: SettingsSuggestRoundedIcon },
  ]
  return [
    { id: 'overview', label: 'Overview', icon: DashboardRoundedIcon },
    { id: 'members', label: 'Members', icon: ManageAccountsRoundedIcon },
    { id: 'memberships', label: 'Memberships', icon: GroupsRoundedIcon },
    { id: 'profile', label: 'Organization Profile', icon: BusinessRoundedIcon },
    ...(context.capabilities.auditRead ? [{ id: 'audit', label: 'Audit Logs', icon: AssessmentRoundedIcon }] : []),
  ]
}

function unwrap(error) {
  if (error instanceof AdminApiError) return errorPresentation(error)
  if (error?.status) return { title: errorPresentation(new AdminApiError(error.status, error.code, error.message)).title, message: error.message || 'Permintaan gagal.', status: error.status }
  return { title: 'Terjadi kesalahan', message: error?.message || 'Permintaan gagal. Coba lagi.' }
}

function ErrorNotice({ error, onRetry }) {
  const view = unwrap(error)
  return <Alert severity={view.status === 403 ? 'warning' : 'error'} action={onRetry ? <Button color="inherit" size="small" onClick={onRetry}>Coba lagi</Button> : undefined}>
    <strong>{view.title}.</strong> {view.message}
  </Alert>
}

function StatePanel({ title, description, severity = 'info', children }) {
  return <Alert severity={severity} sx={{ alignItems: 'center' }}><Typography fontWeight={700}>{title}</Typography><Typography variant="body2">{description}</Typography>{children}</Alert>
}

function Metric({ label, value, note, icon: Icon, unavailable = false }) {
  return <Card sx={{ height: '100%' }}><CardContent sx={{ p: 2.5 }}><Stack direction="row" justifyContent="space-between" spacing={1}>
    <Box><Typography color="text.secondary" variant="body2">{label}</Typography><Typography variant="h4" sx={{ mt: 1, fontWeight: 800 }}>{unavailable ? '—' : value}</Typography><Typography color="text.secondary" variant="caption">{note}</Typography></Box>
    <Box sx={{ width: 40, height: 40, display: 'grid', placeItems: 'center', color: 'primary.main', bgcolor: 'action.hover', borderRadius: 2 }}><Icon fontSize="small" /></Box>
  </Stack></CardContent></Card>
}

function AdminOverview({ context, api }) {
  const [data, setData] = useState(null)
  const [error, setError] = useState(null)
  const [loading, setLoading] = useState(true)
  const [revision, setRevision] = useState(0)
  useEffect(() => {
    let cancelled = false
    setLoading(true); setError(null)
    async function load() {
      try {
        const orgs = context.mode === 'organization_admin'
          ? context.organizations.filter((org) => context.capabilities.adminOrganizationIds?.includes(org.id))
          : context.organizations
        const membersByOrg = await Promise.all(orgs.map((org) => api.listMembers(org.id).then((rows) => Array.isArray(rows) ? rows : null).catch((err) => { throw err })))
        let userCount = null; let activeUsers = null; let pendingUsers = null
        if (context.mode === 'super_admin') {
          let allUsers = []; let offset = 0
          while (true) {
            const page = await api.listUsers(200, offset)
            if (!Array.isArray(page)) throw new AdminApiError(503, 'INVALID_RESPONSE', 'Respons daftar pengguna tidak valid.')
            allUsers = allUsers.concat(page)
            if (page.length < 200) break
            offset += page.length
          }
          userCount = allUsers.length
          activeUsers = allUsers.filter((user) => user.status === 'active').length
          pendingUsers = allUsers.filter((user) => user.status === 'pending_assignment').length
        }
        const memberships = membersByOrg.flat()
        if (!cancelled) setData({
          organizations: orgs.length,
          activeOrganizations: orgs.filter((org) => org.status === 'active').length,
          suspendedOrganizations: orgs.filter((org) => org.status === 'suspended').length,
          userCount, activeUsers, pendingUsers,
          activeMemberships: memberships.filter((member) => member.status === 'active').length,
          memberships,
          membersByOrg,
        })
      } catch (err) { if (!cancelled) setError(err) }
      finally { if (!cancelled) setLoading(false) }
    }
    load()
    return () => { cancelled = true }
  }, [api, context, revision])

  const selectedOrganization = context.mode === 'organization_admin'
    ? context.organizations.find((org) => context.capabilities.adminOrganizationIds?.includes(org.id))
    : null
  const distribution = useMemo(() => (data?.memberships || []).reduce((counts, member) => {
    if (member.status === 'active') counts[member.role] = (counts[member.role] || 0) + 1
    return counts
  }, {}), [data])

  return <Stack spacing={2.5}>
    <Stack direction={{ xs: 'column', sm: 'row' }} justifyContent="space-between" spacing={1}>
      <Box><Typography variant="h4" component="h1">Overview</Typography><Typography color="text.secondary">{context.mode === 'super_admin' ? 'Ringkasan platform dari data yang diizinkan oleh API.' : 'Ringkasan organisasi yang dapat Anda kelola.'}</Typography></Box>
      <Button startIcon={<RefreshRoundedIcon />} onClick={() => setRevision((n) => n + 1)}>Refresh data</Button>
    </Stack>
    {error && <ErrorNotice error={error} onRetry={() => setRevision((n) => n + 1)} />}
    {loading ? <Grid container spacing={2}>{Array.from({ length: context.mode === 'super_admin' ? 6 : 3 }, (_, i) => <Grid key={i} size={{ xs: 12, sm: 6, lg: 4 }}><Skeleton variant="rounded" height={132} /></Grid>)}</Grid> : data && <>
      {context.mode === 'super_admin' ? <Grid container spacing={2}>
        <Grid size={{ xs: 12, sm: 6, lg: 4 }}><Metric label="Total organizations" value={data.organizations} note="Semua organisasi dari endpoint platform" icon={BusinessRoundedIcon} /></Grid>
        <Grid size={{ xs: 12, sm: 6, lg: 4 }}><Metric label="Active organizations" value={data.activeOrganizations} note="Status active" icon={BusinessRoundedIcon} /></Grid>
        <Grid size={{ xs: 12, sm: 6, lg: 4 }}><Metric label="Suspended organizations" value={data.suspendedOrganizations} note="Status suspended" icon={BusinessRoundedIcon} /></Grid>
        <Grid size={{ xs: 12, sm: 6, lg: 4 }}><Metric label="Total users" value={data.userCount} note="Seluruh halaman API pengguna" icon={ManageAccountsRoundedIcon} unavailable={data.userCount === null} /></Grid>
        <Grid size={{ xs: 12, sm: 6, lg: 4 }}><Metric label="Active users" value={data.activeUsers} note="Status active" icon={ManageAccountsRoundedIcon} unavailable={data.activeUsers === null} /></Grid>
        <Grid size={{ xs: 12, sm: 6, lg: 4 }}><Metric label="Pending assignments" value={data.pendingUsers} note="Status pending_assignment" icon={GroupsRoundedIcon} unavailable={data.pendingUsers === null} /></Grid>
        <Grid size={{ xs: 12, sm: 6, lg: 4 }}><Metric label="Active memberships" value={data.activeMemberships} note="Dihitung dari data member organisasi" icon={GroupsRoundedIcon} /></Grid>
      </Grid> : <>
        <Card><CardContent><Typography variant="h6">{selectedOrganization?.name || 'Organization'}</Typography><Typography color="text.secondary">{selectedOrganization?.slug || ''} · {selectedOrganization?.region || 'Region tidak tersedia'} · {selectedOrganization?.kabupaten || 'Kabupaten tidak tersedia'}</Typography></CardContent></Card>
        <Grid container spacing={2}>
          <Grid size={{ xs: 12, sm: 6, lg: 4 }}><Metric label="Active members" value={data.memberships.filter((m) => m.status === 'active').length} note="Dari anggota organisasi yang diizinkan" icon={GroupsRoundedIcon} /></Grid>
          <Grid size={{ xs: 12, sm: 6, lg: 4 }}><Metric label="Active memberships" value={data.activeMemberships} note="Keanggotaan aktif organisasi Anda" icon={ShieldRoundedIcon} /></Grid>
          <Grid size={{ xs: 12, sm: 6, lg: 4 }}><Metric label="Organization activity" value="—" note="Endpoint aktivitas organisasi belum tersedia" icon={AssessmentRoundedIcon} unavailable /></Grid>
        </Grid>
      </>}
      <Card><CardContent><Typography variant="h6" sx={{ mb: 1.5 }}>Membership distribution</Typography>{Object.keys(distribution).length ? <Stack direction="row" spacing={1} useFlexGap flexWrap="wrap">{roles.map((role) => <Chip key={role} label={`${role}: ${distribution[role] || 0}`} variant="outlined" />)}</Stack> : <Typography color="text.secondary">Data distribusi belum tersedia.</Typography>}</CardContent></Card>
    </>}
  </Stack>
}

function OrganizationPage({ context, api, onRefresh }) {
  const adminMode = context.mode === 'organization_admin'
  const manageableOrganizations = adminMode ? context.organizations.filter((org) => context.capabilities.adminOrganizationIds?.includes(org.id)) : context.organizations
  const [rows, setRows] = useState(manageableOrganizations)
  const [page, setPage] = useState(0)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const [query, setQuery] = useState('')
  const [filter, setFilter] = useState('all')
  const [dialog, setDialog] = useState(null)
  const [confirm, setConfirm] = useState(null)
  const [detail, setDetail] = useState(null)
  const [saving, setSaving] = useState(false)
  const canManage = context.capabilities.organizationsManage

  const load = async () => {
    setLoading(true); setError(null)
    try { const result = await api.listOrganizations(); const authorizedRows = Array.isArray(result) ? result : []; setRows(adminMode ? authorizedRows.filter((org) => context.capabilities.adminOrganizationIds?.includes(org.id)) : authorizedRows) }
    catch (err) { setError(err) } finally { setLoading(false) }
  }
  useEffect(() => {
    let cancelled = false
    setRows(manageableOrganizations)
    setLoading(true)
    setError(null)
    api.listOrganizations().then((result) => {
      if (cancelled) return
      const authorizedRows = Array.isArray(result) ? result : []
      setRows(adminMode ? authorizedRows.filter((org) => context.capabilities.adminOrganizationIds?.includes(org.id)) : authorizedRows)
    }).catch((err) => { if (!cancelled) setError(err) }).finally(() => { if (!cancelled) setLoading(false) })
    return () => { cancelled = true }
  }, [api, context.organizations, context.capabilities.adminOrganizationIds, adminMode])
  const filtered = rows.filter((org) => (!query || `${org.name} ${org.slug} ${org.region || ''} ${org.kabupaten || ''}`.toLowerCase().includes(query.toLowerCase())) && (filter === 'all' || org.status === filter))
  const visible = filtered.slice(page * 10, (page + 1) * 10)

  const submit = async (event) => {
    event.preventDefault(); setSaving(true); setError(null)
    const form = new FormData(event.currentTarget)
    const payload = { name: String(form.get('name') || '').trim(), slug: String(form.get('slug') || '').trim(), region: String(form.get('region') || '').trim() || null, kabupaten: String(form.get('kabupaten') || '').trim() || null }
    try {
      if (dialog?.kind === 'create') await api.createOrganization(payload)
      else {
        const updates = Object.fromEntries(Object.entries(payload).filter(([key, value]) => ['name', 'slug'].includes(key) || value !== null))
        await api.updateOrganization(dialog.org.id, updates)
      }
      setDialog(null); await load(); onRefresh?.()
    } catch (err) { setError(err) } finally { setSaving(false) }
  }
  const changeStatus = async () => {
    setSaving(true); setError(null)
    try { await api.setOrganizationStatus(confirm.org.id, confirm.status); setConfirm(null); await load(); onRefresh?.() }
    catch (err) { setError(err); setConfirm(null) } finally { setSaving(false) }
  }

  return <Stack spacing={2.5}>
    <Stack direction={{ xs: 'column', sm: 'row' }} justifyContent="space-between" spacing={1}>
      <Box><Typography component="h1" variant="h4">Organizations</Typography><Typography color="text.secondary">{adminMode ? 'Lihat dan ubah profil organisasi yang ditugaskan kepada Anda.' : 'Kelola organisasi dan status platform.'}</Typography></Box>
      <Stack direction="row" spacing={1}>{context.mode === 'super_admin' && <Button variant="contained" onClick={() => setDialog({ kind: 'create' })}>Create organization</Button>}<Button onClick={load}>Refresh organizations</Button></Stack>
    </Stack>
    {error && <ErrorNotice error={error} onRetry={load} />}
    <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.5}>
      <TextField label="Search organizations" value={query} onChange={(e) => setQuery(e.target.value)} fullWidth />
      <FormControl sx={{ minWidth: 190 }}><InputLabel id="org-status-label">Status</InputLabel><Select labelId="org-status-label" label="Status" value={filter} onChange={(e) => setFilter(e.target.value)}><MenuItem value="all">All statuses</MenuItem><MenuItem value="active">Active</MenuItem><MenuItem value="suspended">Suspended</MenuItem></Select></FormControl>
    </Stack>
    <TableContainer component={Paper} sx={{ border: '1px solid', borderColor: 'divider', borderRadius: 2 }}><Table aria-label="Organizations"><TableHead><TableRow><TableCell>Name</TableCell><TableCell>Slug</TableCell><TableCell>Status</TableCell><TableCell>Region</TableCell><TableCell align="right">Actions</TableCell></TableRow></TableHead><TableBody>
      {loading ? <TableRow><TableCell colSpan={5}><Skeleton /></TableCell></TableRow> : visible.map((org) => <TableRow key={org.id} hover><TableCell>{org.name}</TableCell><TableCell>{org.slug}</TableCell><TableCell><Chip size="small" label={org.status} color={org.status === 'active' ? 'success' : 'default'} /></TableCell><TableCell>{[org.region, org.kabupaten].filter(Boolean).join(' · ') || '—'}</TableCell><TableCell align="right"><Stack direction="row" justifyContent="flex-end" spacing={0.5}><Button size="small" onClick={async () => { try { const result = await api.getOrganization(org.id); setDetail(result) } catch (err) { setError(err) } }}>View</Button>{canManage && <Button size="small" onClick={() => setDialog({ kind: 'edit', org })}>Edit</Button>}{context.mode === 'super_admin' && <Button size="small" color={org.status === 'active' ? 'error' : 'success'} onClick={() => setConfirm({ org, status: org.status === 'active' ? 'suspended' : 'active' })}>{org.status === 'active' ? 'Suspend' : 'Reactivate'}</Button>}</Stack></TableCell></TableRow>)}
      {!loading && visible.length === 0 && <TableRow><TableCell colSpan={5}><StatePanel title="No organizations found" description={rows.length ? 'Ubah pencarian atau filter status.' : 'API tidak mengembalikan organisasi yang dapat diakses.'} /></TableCell></TableRow>}
    </TableBody></Table><TablePagination component="div" count={filtered.length} page={page} rowsPerPage={10} rowsPerPageOptions={[10]} onPageChange={(_, next) => setPage(next)} /></TableContainer>
    <Typography variant="caption" color="text.secondary">{filtered.length} organizations · daftar organisasi mengikuti otorisasi API. Tidak mencakup akses scan atau riwayat pribadi.</Typography>
    <Dialog open={Boolean(dialog)} onClose={() => !saving && setDialog(null)} fullWidth maxWidth="sm"><Box component="form" onSubmit={submit}><DialogTitle>{dialog?.kind === 'create' ? 'Create organization' : 'Edit organization'}</DialogTitle><DialogContent><Stack spacing={2} sx={{ pt: 1}}>
      <TextField label="Name" name="name" required defaultValue={dialog?.org?.name || ''} inputProps={{ maxLength: 160 }} />
      <TextField label="Slug" name="slug" required defaultValue={dialog?.org?.slug || ''} inputProps={{ maxLength: 160, pattern: '[a-z0-9]+(-[a-z0-9]+)*' }} helperText="Lowercase letters and digits separated by hyphens." />
      <TextField label="Region" name="region" defaultValue={dialog?.org?.region || ''} inputProps={{ maxLength: 120 }} helperText={dialog?.kind === 'edit' ? 'Leave blank to keep the current value; clearing is not supported by the API.' : undefined} />
      <TextField label="Kabupaten" name="kabupaten" defaultValue={dialog?.org?.kabupaten || ''} inputProps={{ maxLength: 120 }} helperText={dialog?.kind === 'edit' ? 'Leave blank to keep the current value; clearing is not supported by the API.' : undefined} />
      </Stack></DialogContent><DialogActions><Button onClick={() => setDialog(null)}>Cancel</Button><Button type="submit" variant="contained" disabled={saving}>{saving ? 'Saving…' : 'Save'}</Button></DialogActions></Box></Dialog>
    <Dialog open={Boolean(confirm)} onClose={() => setConfirm(null)}><DialogTitle>{confirm?.status === 'suspended' ? 'Suspend organization?' : 'Reactivate organization?'}</DialogTitle><DialogContent><Typography>{confirm?.org?.name} will be {confirm?.status}.</Typography></DialogContent><DialogActions><Button onClick={() => setConfirm(null)}>Cancel</Button><Button color={confirm?.status === 'suspended' ? 'error' : 'success'} onClick={changeStatus} disabled={saving}>{confirm?.status === 'suspended' ? 'Confirm suspend' : 'Confirm reactivate'}</Button></DialogActions></Dialog>
    <Dialog open={Boolean(detail)} onClose={() => setDetail(null)} fullWidth maxWidth="sm"><DialogTitle>Organization details</DialogTitle><DialogContent><Stack spacing={1}>{['name','slug','status','region','kabupaten','created_at','updated_at'].map((key) => <Stack key={key} direction="row" justifyContent="space-between" spacing={2}><Typography color="text.secondary">{key.replace('_',' ')}</Typography><Typography>{detail?.[key] || '—'}</Typography></Stack>)}</Stack></DialogContent><DialogActions><Button onClick={() => setDetail(null)}>Close</Button></DialogActions></Dialog>
  </Stack>
}

function UserPage({ api }) {
  const [rows, setRows] = useState([]); const [loading, setLoading] = useState(true); const [error, setError] = useState(null)
  const [search, setSearch] = useState(''); const [filter, setFilter] = useState('all'); const [page, setPage] = useState(0); const [confirm, setConfirm] = useState(null)
  const load = async (offset = page * PAGE_SIZE) => { setLoading(true); setError(null); try { const data = await api.listUsers(PAGE_SIZE, offset); if (!Array.isArray(data)) throw new AdminApiError(503,'INVALID_RESPONSE','Respons daftar pengguna tidak valid.'); setRows(data) } catch (err) { setError(err) } finally { setLoading(false) } }
  useEffect(() => { load(0) }, [api])
  const filtered = rows.filter((user) => (filter === 'all' || user.status === filter) && (!search || `${user.user_id} ${user.full_name || ''}`.toLowerCase().includes(search.toLowerCase())))
  const updateStatus = async () => { if (!confirm) return; try { await api.setUserStatus(confirm.user.user_id, confirm.status); setConfirm(null); await load() } catch (err) { setError(err); setConfirm(null) } }
  return <Stack spacing={2.5}><Box><Typography component="h1" variant="h4">Users</Typography><Typography color="text.secondary">Daftar profil platform dan ringkasan membership yang diizinkan.</Typography></Box>{error && <ErrorNotice error={error} onRetry={() => load()} />}
    <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.5}><TextField label="Search users" value={search} onChange={(e) => setSearch(e.target.value)} fullWidth /><FormControl sx={{ minWidth: 200 }}><InputLabel id="user-status-label">Status</InputLabel><Select labelId="user-status-label" label="Status" value={filter} onChange={(e) => setFilter(e.target.value)}><MenuItem value="all">All statuses</MenuItem>{statusOptions.map((status) => <MenuItem key={status} value={status}>{status}</MenuItem>)}</Select></FormControl></Stack>
    <TableContainer component={Paper} sx={{ border: '1px solid', borderColor: 'divider', borderRadius: 2 }}><Table aria-label="Users"><TableHead><TableRow><TableCell>User ID</TableCell><TableCell>Profile</TableCell><TableCell>Status</TableCell><TableCell>Memberships</TableCell><TableCell align="right">Actions</TableCell></TableRow></TableHead><TableBody>{loading ? <TableRow><TableCell colSpan={5}><Skeleton /></TableCell></TableRow> : filtered.map((user) => <TableRow key={user.user_id}><TableCell sx={{ fontFamily: 'monospace', overflowWrap: 'anywhere' }}>{user.user_id}</TableCell><TableCell>{user.full_name || 'Name unavailable'}</TableCell><TableCell><Chip size="small" label={user.status} /></TableCell><TableCell>{(user.memberships || []).map((m) => `${m.organization_id}: ${m.role} (${m.status})`).join('; ') || 'No memberships'}</TableCell><TableCell align="right"><Button size="small" color={user.status === 'active' ? 'error' : 'success'} onClick={() => setConfirm({ user, status: user.status === 'active' ? 'suspended' : 'active' })}>{user.status === 'active' ? 'Suspend' : 'Reactivate'}</Button></TableCell></TableRow>)}{!loading && !filtered.length && <TableRow><TableCell colSpan={5}><StatePanel title="No users found" description="Tidak ada pengguna di halaman ini yang cocok dengan pencarian/filter." /></TableCell></TableRow>}</TableBody></Table><TablePagination component="div" count={-1} page={page} rowsPerPage={PAGE_SIZE} rowsPerPageOptions={[PAGE_SIZE]} onPageChange={(_, next) => { setPage(next); load(next * PAGE_SIZE) }} labelDisplayedRows={({ from, to }) => `${from}–${to}`} /></TableContainer>
    <StatePanel title="Profile editing unavailable" description="API saat ini hanya mengembalikan full_name untuk tampilan dan tidak menyediakan endpoint edit profil. Perubahan platform role tidak tersedia." />
    <Dialog open={Boolean(confirm)} onClose={() => setConfirm(null)}><DialogTitle>{confirm?.status === 'suspended' ? 'Suspend account?' : 'Reactivate account?'}</DialogTitle><DialogContent><Typography>User {confirm?.user.user_id} will be {confirm?.status}.</Typography><Typography color="text.secondary" variant="body2" sx={{ mt: 1 }}>Backend melindungi akun Super Admin terakhir dan mencegah suspend diri sendiri.</Typography></DialogContent><DialogActions><Button onClick={() => setConfirm(null)}>Cancel</Button><Button color={confirm?.status === 'suspended' ? 'error' : 'success'} onClick={updateStatus}>Confirm</Button></DialogActions></Dialog>
  </Stack>
}

function MembershipPage({ context, api, onRefresh, readOnly = false }) {
  const accessibleOrgs = context.mode === 'super_admin' ? context.organizations : context.organizations.filter((org) => context.capabilities.adminOrganizationIds?.includes(org.id))
  const [orgId, setOrgId] = useState(accessibleOrgs[0]?.id || '')
  const [rows, setRows] = useState([]); const [loading, setLoading] = useState(false); const [error, setError] = useState(null)
  const [dialog, setDialog] = useState(false); const [confirm, setConfirm] = useState(null); const [saving, setSaving] = useState(false); const [page, setPage] = useState(0)
  const load = async () => { if (!orgId) return; setLoading(true); setError(null); try { const result = await api.listMembers(orgId); if (!Array.isArray(result)) throw new AdminApiError(503,'INVALID_RESPONSE','Respons anggota tidak valid.'); setRows(result) } catch (err) { setError(err) } finally { setLoading(false) } }
  useEffect(() => { if (!accessibleOrgs.some((org) => org.id === orgId)) setOrgId(accessibleOrgs[0]?.id || '') }, [accessibleOrgs, orgId])
  useEffect(() => { load() }, [orgId, api])
  const submit = async (event) => { event.preventDefault(); const form = new FormData(event.currentTarget); const target = String(form.get('user_id') || '').trim(); const role = String(form.get('role') || 'farmer'); if (!target) return; setSaving(true); setError(null); try { await api.assignMembership(orgId, { user_id: target, role }); setDialog(false); await load(); onRefresh?.() } catch (err) { setError(err) } finally { setSaving(false) } }
  const saveRole = async () => { setSaving(true); setError(null); try { await api.changeMembershipRole(orgId, confirm.membership.id, confirm.role); setConfirm(null); await load(); onRefresh?.() } catch (err) { setError(err); setConfirm(null) } finally { setSaving(false) } }
  const revoke = async () => { setSaving(true); setError(null); try { await api.revokeMembership(orgId, confirm.membership.id); setConfirm(null); await load(); onRefresh?.() } catch (err) { setError(err); setConfirm(null) } finally { setSaving(false) } }
  const org = accessibleOrgs.find((item) => item.id === orgId)
  const adminRoleAllowed = context.mode === 'super_admin'
  return <Stack spacing={2.5}><Box><Typography component="h1" variant="h4">Memberships</Typography><Typography color="text.secondary">Tetapkan dan kelola membership pada organisasi yang dapat Anda administrasikan.</Typography></Box>
    {error && <ErrorNotice error={error} onRetry={load} />}
    <Stack direction={{ xs: 'column', sm: 'row' }} justifyContent="space-between" spacing={1}><FormControl sx={{ minWidth: { sm: 300 } }}><InputLabel id="membership-org-label">Organization</InputLabel><Select labelId="membership-org-label" label="Organization" value={orgId} onChange={(e) => { setOrgId(e.target.value); setPage(0) }}>{accessibleOrgs.map((item) => <MenuItem key={item.id} value={item.id}>{item.name}</MenuItem>)}</Select></FormControl>{!readOnly && <Button variant="contained" disabled={!orgId || !context.capabilities.membersManage} onClick={() => setDialog(true)}>Assign member</Button>}</Stack>
    {!accessibleOrgs.length ? <StatePanel severity="warning" title="No manageable organization" description="Keanggotaan organisasi yang dapat dikelola tidak ditemukan." /> : <TableContainer component={Paper} sx={{ border: '1px solid', borderColor: 'divider', borderRadius: 2 }}><Table aria-label="Memberships"><TableHead><TableRow><TableCell>Member</TableCell><TableCell>User ID</TableCell><TableCell>Role</TableCell><TableCell>Status</TableCell><TableCell align="right">Actions</TableCell></TableRow></TableHead><TableBody>{loading ? <TableRow><TableCell colSpan={5}><Skeleton /></TableCell></TableRow> : rows.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE).map((member) => <TableRow key={member.id}><TableCell>{member.full_name || 'Name unavailable'}</TableCell><TableCell sx={{ fontFamily: 'monospace', overflowWrap: 'anywhere' }}>{member.user_id}</TableCell><TableCell>{member.role}</TableCell><TableCell><Chip size="small" label={member.status} color={member.status === 'active' ? 'success' : 'default'} /></TableCell><TableCell align="right"><Stack direction={{ xs: 'column', sm: 'row' }} justifyContent="flex-end">{!readOnly && <><Button size="small" disabled={member.status !== 'active' || !context.capabilities.membersManage || (context.mode === 'organization_admin' && member.role === 'admin')} onClick={() => setConfirm({ kind: 'role', membership: member, role: member.role })}>Change role</Button><Button aria-label="Revoke membership" size="small" color="error" disabled={member.status !== 'active' || !context.capabilities.membersManage || (context.mode === 'organization_admin' && member.role === 'admin')} onClick={() => setConfirm({ kind: 'revoke', membership: member })}>Revoke</Button></>}</Stack></TableCell></TableRow>)}{!loading && rows.length === 0 && <TableRow><TableCell colSpan={5}><StatePanel title="No members" description="Organisasi ini belum memiliki membership yang dikembalikan API." /></TableCell></TableRow>}</TableBody></Table><TablePagination component="div" count={rows.length} page={page} rowsPerPage={PAGE_SIZE} rowsPerPageOptions={[PAGE_SIZE]} onPageChange={(_, next) => setPage(next)} /></TableContainer>}
    <StatePanel title="Invitations unavailable" description="Membership hanya dapat ditetapkan kepada Auth user ID yang sudah ada. Email invitation dan acceptance flow belum tersedia." />
    <Dialog open={dialog} onClose={() => !saving && setDialog(false)} fullWidth maxWidth="xs"><Box component="form" onSubmit={submit}><DialogTitle>Assign existing member</DialogTitle><DialogContent><Stack spacing={2} sx={{ pt: 1 }}><Typography color="text.secondary" variant="body2">Organization: {org?.name || '—'}</Typography><TextField label="User ID" name="user_id" required inputProps={{ maxLength: 80 }} helperText="Existing Auth user ID only; no invitation is sent." /><FormControl><InputLabel id="role-assign-label">Role</InputLabel><Select labelId="role-assign-label" label="Role" name="role" defaultValue={adminRoleAllowed ? 'admin' : 'farmer'}>{roles.filter((role) => adminRoleAllowed || role !== 'admin').map((role) => <MenuItem key={role} value={role}>{role}</MenuItem>)}</Select></FormControl></Stack></DialogContent><DialogActions><Button onClick={() => setDialog(false)}>Cancel</Button><Button type="submit" variant="contained" disabled={saving}>{saving ? 'Assigning…' : 'Assign'}</Button></DialogActions></Box></Dialog>
    <Dialog open={Boolean(confirm)} onClose={() => setConfirm(null)} fullWidth maxWidth="xs"><DialogTitle>{confirm?.kind === 'revoke' ? 'Revoke membership?' : 'Change membership role?'}</DialogTitle><DialogContent>{confirm?.kind === 'role' ? <FormControl fullWidth sx={{ mt: 1 }}><InputLabel id="role-change-label">Role</InputLabel><Select labelId="role-change-label" label="Role" value={confirm.role} onChange={(e) => setConfirm((old) => ({ ...old, role: e.target.value }))}>{roles.filter((role) => adminRoleAllowed || role !== 'admin').map((role) => <MenuItem key={role} value={role}>{role}</MenuItem>)}</Select></FormControl> : <Typography>Membership for {confirm?.membership?.full_name || confirm?.membership?.user_id} will be revoked. This action can affect access immediately.</Typography>}</DialogContent><DialogActions><Button onClick={() => setConfirm(null)}>Cancel</Button><Button color={confirm?.kind === 'revoke' ? 'error' : 'primary'} onClick={confirm?.kind === 'revoke' ? revoke : saveRole} disabled={saving}>{confirm?.kind === 'revoke' ? 'Confirm revoke' : 'Save role'}</Button></DialogActions></Dialog>
  </Stack>
}

function AuditPage({ api, context }) {
  const [rows, setRows] = useState([]); const [loading, setLoading] = useState(true); const [error, setError] = useState(null); const [page, setPage] = useState(0)
  const load = async (offset = page * PAGE_SIZE) => { setLoading(true); setError(null); try { const result = await api.listAuditEvents(null, PAGE_SIZE, offset); if (!Array.isArray(result)) throw new AdminApiError(503,'INVALID_RESPONSE','Respons audit tidak valid.'); setRows(result) } catch (err) { setError(err) } finally { setLoading(false) } }
  useEffect(() => { load(0) }, [api])
  return <Stack spacing={2.5}><Box><Typography component="h1" variant="h4">Audit Logs</Typography><Typography color="text.secondary">Event administratif yang tersedia melalui endpoint audit.</Typography></Box>{error && <ErrorNotice error={error} onRetry={() => load()} />}<TableContainer component={Paper} sx={{ border: '1px solid', borderColor: 'divider', borderRadius: 2 }}><Table aria-label="Audit log"><TableHead><TableRow><TableCell>Time</TableCell><TableCell>Action</TableCell><TableCell>Target</TableCell><TableCell>Organization</TableCell><TableCell>Metadata</TableCell></TableRow></TableHead><TableBody>{loading ? <TableRow><TableCell colSpan={5}><Skeleton /></TableCell></TableRow> : rows.map((event) => <TableRow key={event.id}><TableCell>{event.created_at || '—'}</TableCell><TableCell>{event.action}</TableCell><TableCell>{event.target_type}: {event.target_id || '—'}</TableCell><TableCell>{event.organization_id || 'Platform'}</TableCell><TableCell>{JSON.stringify(event.metadata || {})}</TableCell></TableRow>)}{!loading && !rows.length && <TableRow><TableCell colSpan={5}><StatePanel title="No audit events" description="Belum ada event audit yang tersedia." /></TableCell></TableRow>}</TableBody></Table><TablePagination component="div" count={-1} page={page} rowsPerPage={PAGE_SIZE} rowsPerPageOptions={[PAGE_SIZE]} onPageChange={(_, next) => { setPage(next); load(next * PAGE_SIZE) }} labelDisplayedRows={({ from, to }) => `${from}–${to}`} /></TableContainer><Typography variant="caption" color="text.secondary">Audit access is platform Super Admin only. Organization Admin audit endpoint belum tersedia.</Typography></Stack>
}

function ProfilePage({ context, api, onRefresh }) {
  const org = context.organizations.find((item) => context.capabilities.adminOrganizationIds?.includes(item.id))
  const [error, setError] = useState(null); const [saving, setSaving] = useState(false); const [saved, setSaved] = useState(false)
  if (!org) return <StatePanel severity="warning" title="Organization unavailable" description="Tidak ada organisasi aktif yang diizinkan untuk profil ini." />
  const save = async (event) => { event.preventDefault(); const form = new FormData(event.currentTarget); setSaving(true); setError(null); setSaved(false); const region = String(form.get('region') || '').trim(); const kabupaten = String(form.get('kabupaten') || '').trim(); try { await api.updateOrganization(org.id, { name: String(form.get('name') || '').trim(), slug: String(form.get('slug') || '').trim(), ...(region ? { region } : {}), ...(kabupaten ? { kabupaten } : {}) }); setSaved(true); onRefresh?.() } catch (err) { setError(err) } finally { setSaving(false) } }
  return <Stack spacing={2.5}><Box><Typography component="h1" variant="h4">Organization Profile</Typography><Typography color="text.secondary">Admin organisasi dapat mengubah nama, slug, region, dan kabupaten. Status organisasi tidak dapat diubah di sini.</Typography></Box>{error && <ErrorNotice error={error} />}{saved && <Alert severity="success">Organization profile updated.</Alert>}<Card><CardContent><Box component="form" onSubmit={save}><Stack spacing={2}><TextField label="Name" name="name" defaultValue={org.name} required /><TextField label="Slug" name="slug" defaultValue={org.slug} required helperText="Lowercase letters and digits separated by hyphens." /><TextField label="Region" name="region" defaultValue={org.region || ''} helperText="Leave blank to keep the current value; clearing is not supported by the API." /><TextField label="Kabupaten" name="kabupaten" defaultValue={org.kabupaten || ''} helperText="Leave blank to keep the current value; clearing is not supported by the API." /><TextField label="Status" value={org.status} disabled /><Stack direction="row" justifyContent="flex-end"><Button type="submit" variant="contained" disabled={saving}>{saving ? 'Saving…' : 'Save profile'}</Button></Stack></Stack></Box></CardContent></Card></Stack>
}

function SystemPage() {
  return <Stack spacing={2.5}><Box><Typography component="h1" variant="h4">System Status</Typography><Typography color="text.secondary">Informasi ketersediaan sistem.</Typography></Box><StatePanel title="System health endpoint unavailable" description="Backend tidak menyediakan endpoint health khusus dashboard ini. Status Auth/database/deployment tidak disimpulkan dari respons organisasi." /></Stack>
}

function DeniedPage() {
  return <Stack spacing={2.5}><Typography component="h1" variant="h4">Overview</Typography><StatePanel severity="warning" title="Permission denied" description="Akun ini tidak memiliki izin manajemen organisasi. Route frontend bukan pengganti otorisasi backend." /></Stack>
}

export function AdminDashboard({ context, api = createAdminApi(), route = 'overview', onNavigate = () => {}, onBack = () => {}, onRefreshContext = () => {} }) {
  const theme = useTheme(); const desktop = useMediaQuery(theme.breakpoints.up('md')); const [mobileOpen, setMobileOpen] = useState(false); const [refreshKey, setRefreshKey] = useState(0)
  const refreshData = () => { setRefreshKey((n) => n + 1); onRefreshContext() }
  const navigation = useMemo(() => getAdminNavigation(context), [context])
  const allowed = navigation.some((item) => item.id === route)
  const activeRoute = allowed ? route : (context.mode === 'member' ? 'overview' : 'overview')
  const title = routeTitles[activeRoute] || 'Overview'
  const setRoute = (id) => { onNavigate(id); setMobileOpen(false) }
  let content
  if (context.mode === 'member') content = <DeniedPage />
  else if (!allowed) content = <DeniedPage />
  else if (activeRoute === 'overview') content = <AdminOverview key={refreshKey} context={context} api={api} />
  else if (activeRoute === 'organizations') content = <OrganizationPage key={refreshKey} context={context} api={api} onRefresh={refreshData} />
  else if (activeRoute === 'users') content = <UserPage key={refreshKey} api={api} />
  else if (activeRoute === 'members' || activeRoute === 'memberships') content = <MembershipPage key={`${refreshKey}-${activeRoute}`} context={context} api={api} onRefresh={refreshData} readOnly={activeRoute === 'members'} />
  else if (activeRoute === 'profile') content = <ProfilePage key={refreshKey} context={context} api={api} onRefresh={refreshData} />
  else if (activeRoute === 'audit') content = context.capabilities.auditRead ? <AuditPage key={refreshKey} context={context} api={api} /> : <DeniedPage />
  else if (activeRoute === 'system') content = <SystemPage />
  else content = <DeniedPage />
  const drawer = <Box sx={{ height: '100%', display: 'flex', flexDirection: 'column', bgcolor: 'background.paper' }}>
    <Toolbar sx={{ minHeight: 72, px: 2.5 }}><Box sx={{ width: 36, height: 36, display: 'grid', placeItems: 'center', bgcolor: 'primary.main', color: 'primary.contrastText', borderRadius: 2, mr: 1.25 }}><AgricultureRoundedIcon fontSize="small" /></Box><Box><Typography fontWeight={800}>Agri-Sort AI</Typography><Typography variant="caption" color="text.secondary">Administration</Typography></Box></Toolbar>
    <Divider /><Box sx={{ px: 2, py: 2 }}><Chip label={context.mode === 'super_admin' ? 'Super Admin' : 'Organization Admin'} color="primary" size="small" /></Box>
    <List component="nav" aria-label="Administration navigation" sx={{ px: 1.5 }}>{navigation.map(({ id, label, icon: Icon }) => <ListItemButton key={id} selected={activeRoute === id} onClick={() => setRoute(id)} aria-current={activeRoute === id ? 'page' : undefined} sx={{ borderRadius: 2, mb: .5, minHeight: 44, '&.Mui-selected': { bgcolor: 'action.selected', color: 'primary.dark' } }}><ListItemIcon sx={{ minWidth: 38, color: activeRoute === id ? 'primary.main' : 'text.secondary' }}><Icon fontSize="small" /></ListItemIcon><ListItemText primary={label} /></ListItemButton>)}</List>
    <Box sx={{ flexGrow: 1 }} /><Divider /><Stack direction="row" spacing={1.25} sx={{ p: 2, alignItems: 'center' }}><Avatar sx={{ bgcolor: 'primary.dark' }}>{(context.user.fullName || context.user.email || 'A').slice(0,1).toUpperCase()}</Avatar><Box sx={{ minWidth: 0 }}><Typography variant="body2" fontWeight={700} noWrap>{context.user.fullName || 'Verified account'}</Typography><Typography variant="caption" color="text.secondary" noWrap>{context.user.email}</Typography></Box></Stack>
    <Button onClick={onBack} sx={{ mx: 2, mb: 2 }}>Back to app</Button>
  </Box>
  return <Box sx={{ display: 'flex', minHeight: '100vh', bgcolor: 'background.default' }}>
    {!desktop && <AppBar position="fixed" color="inherit" elevation={0} sx={{ borderBottom: '1px solid', borderColor: 'divider' }}><Toolbar><IconButton aria-label="Open administration navigation" onClick={() => setMobileOpen(true)} edge="start" sx={{ mr: 1 }}><MenuRoundedIcon /></IconButton><Typography fontWeight={800}>Administration</Typography><Box sx={{ flexGrow: 1 }} /><Typography variant="caption" color="text.secondary">{title}</Typography></Toolbar></AppBar>}
    <Drawer variant={desktop ? 'permanent' : 'temporary'} open={desktop || mobileOpen} onClose={() => setMobileOpen(false)} ModalProps={{ keepMounted: true }} sx={{ width: drawerWidth, flexShrink: 0, '& .MuiDrawer-paper': { width: drawerWidth, boxSizing: 'border-box', borderRight: '1px solid', borderColor: 'divider' } }}>{drawer}</Drawer>
    <Box component="main" sx={{ minWidth: 0, flexGrow: 1, width: '100%' }}><Toolbar sx={{ display: { xs: 'flex', md: 'none' }, minHeight: 64 }} /><Container maxWidth="xl" sx={{ py: { xs: 2.5, md: 4 }, px: { xs: 2, sm: 3, lg: 4 } }}>
      <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 2.5 }}><Typography variant="caption" color="text.secondary">Administration</Typography><Typography variant="caption" color="text.disabled">/</Typography><Typography variant="caption" aria-current="page">{title}</Typography></Stack>
      {content}
    </Container></Box>
  </Box>
}

export function AdminDashboardGate({ onBack, onUnauthorized, onAccessChange = () => {} }) {
  const api = useMemo(() => createAdminApi(), [])
  const [state, setState] = useState({ loading: true, context: null, error: null })
  const [route, setRoute] = useState(() => window.location.hash.replace(/^#admin\/?/, '') || 'overview')
  const load = async () => { setState({ loading: true, context: null, error: null }); try { const context = await loadAdminContext(api); setState({ loading: false, context, error: null }) } catch (error) { setState({ loading: false, context: null, error }) } }
  useEffect(() => { load() }, [api])
  useEffect(() => { onAccessChange(state.context?.mode === 'super_admin' || state.context?.mode === 'organization_admin') }, [state.context, onAccessChange])
  useEffect(() => { const update = () => setRoute(window.location.hash.replace(/^#admin\/?/, '') || 'overview'); window.addEventListener('hashchange', update); return () => window.removeEventListener('hashchange', update) }, [])
  const navigate = (next) => { window.location.hash = `admin/${next}`; setRoute(next) }
  if (state.loading) return <Container maxWidth="md" sx={{ py: 8 }}><Stack spacing={2}><Skeleton variant="rounded" height={48} /><Skeleton variant="rounded" height={220} /><Skeleton variant="rounded" height={140} /><Typography role="status" color="text.secondary">Loading verified permissions and management data…</Typography></Stack></Container>
  if (state.error) return <Container maxWidth="sm" sx={{ py: 8 }}><Stack spacing={2}><Typography variant="h4" component="h1">Administration unavailable</Typography><ErrorNotice error={state.error} onRetry={load} /><Button onClick={state.error.status === 401 ? onUnauthorized : onBack}> {state.error.status === 401 ? 'Sign in again' : 'Back to app'} </Button></Stack></Container>
  return <AdminDashboard context={state.context} api={api} route={route} onNavigate={navigate} onBack={onBack} onRefreshContext={load} />
}
