import test from 'node:test'
import assert from 'node:assert/strict'
import {
  getAuthHeaders,
  loginWithGmailBackend,
  readActiveUser,
  restoreAuthSession,
  validateLoginInput,
} from '../src/business/authStorage.js'

function createMemoryStorage() {
  const store = new Map()
  return {
    getItem(key) { return store.has(key) ? store.get(key) : null },
    setItem(key, value) { store.set(key, String(value)) },
    removeItem(key) { store.delete(key) },
  }
}

test('login rejects backend failure and never authenticates from cached local profile', async () => {
  const storage = createMemoryStorage()
  storage.setItem('agri_sort_active_user_v1', JSON.stringify({ id: 'cached', email: 'user@gmail.com' }))
  storage.setItem('agri_sort_registered_users_v1', JSON.stringify([{ email: 'user@gmail.com', passwordHash: 'old-hash' }]))
  const originalFetch = globalThis.fetch
  globalThis.fetch = async () => { throw new TypeError('network unavailable') }
  try {
    const result = await loginWithGmailBackend({ email: 'user@gmail.com', password: 'Password123' }, storage)
    assert.equal(result.ok, false)
    assert.equal(readActiveUser(storage).id, 'cached')
    assert.deepEqual(getAuthHeaders(storage), {})
  } finally {
    globalThis.fetch = originalFetch
  }
})

test('session restoration clears cached identity when server rejects access token', async () => {
  const storage = createMemoryStorage()
  storage.setItem('agri_sort_active_user_v1', JSON.stringify({ id: 'cached', email: 'user@gmail.com' }))
  storage.setItem('agri_sort_access_token_v1', 'expired-token')
  const originalFetch = globalThis.fetch
  globalThis.fetch = async () => ({ ok: false, json: async () => ({ detail: { message: 'expired' } }) })
  try {
    assert.equal(await restoreAuthSession(storage), null)
    assert.equal(readActiveUser(storage), null)
    assert.deepEqual(getAuthHeaders(storage), {})
  } finally {
    globalThis.fetch = originalFetch
  }
})

test('session restoration only trusts profile returned by the backend', async () => {
  const storage = createMemoryStorage()
  storage.setItem('agri_sort_access_token_v1', 'valid-token')
  const originalFetch = globalThis.fetch
  globalThis.fetch = async (_url, options) => {
    assert.equal(options.headers.Authorization, 'Bearer valid-token')
    return { ok: true, json: async () => ({ data: { user: { id: 'verified-id', email: 'USER@gmail.com' } } }) }
  }
  try {
    const user = await restoreAuthSession(storage)
    assert.equal(user.id, 'verified-id')
    assert.equal(user.email, 'user@gmail.com')
  } finally {
    globalThis.fetch = originalFetch
  }
})

test('login form validation rejects malformed Gmail and empty password', () => {
  const result = validateLoginInput({ email: 'invalid@example.com', password: '' })
  assert.equal(result.isValid, false)
  assert.ok(result.errors.email)
  assert.ok(result.errors.password)
})

test('login displays FastAPI string detail instead of the generic auth error', async () => {
  const originalFetch = globalThis.fetch
  globalThis.fetch = async () => ({
    ok: false,
    status: 401,
    json: async () => ({ detail: 'Email atau kata sandi tidak cocok.' }),
  })
  try {
    const result = await loginWithGmailBackend({ email: 'user@gmail.com', password: 'Password123' }, createMemoryStorage())
    assert.deepEqual(result, { ok: false, errors: { password: 'Email atau kata sandi tidak cocok.' } })
  } finally {
    globalThis.fetch = originalFetch
  }
})

test('login explains a non-JSON backend error using its HTTP status', async () => {
  const originalFetch = globalThis.fetch
  globalThis.fetch = async () => ({
    ok: false,
    status: 503,
    json: async () => { throw new SyntaxError('not JSON') },
  })
  try {
    const result = await loginWithGmailBackend({ email: 'user@gmail.com', password: 'Password123' }, createMemoryStorage())
    assert.deepEqual(result, { ok: false, errors: { email: 'Layanan login sedang mengalami gangguan. Silakan coba lagi.' } })
  } finally {
    globalThis.fetch = originalFetch
  }
})
