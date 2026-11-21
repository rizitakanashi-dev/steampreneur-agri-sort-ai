const ACTIVE_USER_STORAGE_KEY = 'agri_sort_active_user_v1'
const ACCESS_TOKEN_STORAGE_KEY = 'agri_sort_access_token_v1'
const REFRESH_TOKEN_STORAGE_KEY = 'agri_sort_refresh_token_v1'

function resolveStorage(customStorage) {
  if (customStorage) return customStorage
  if (typeof window !== 'undefined' && window.localStorage) return window.localStorage
  return null
}

function parseResponse(payload) {
  return payload?.detail?.message || payload?.error?.message || payload?.message || 'Permintaan autentikasi gagal.'
}

function normalizedUser(user = {}) {
  const email = String(user.email || '').trim().toLowerCase()
  return {
    id: user.id,
    fullName: user.fullName || user.user_metadata?.full_name || user.user_metadata?.name || email.split('@')[0] || 'Pengguna',
    email,
    provider: user.provider || user.app_metadata?.provider || 'email',
    picture: user.picture || user.user_metadata?.avatar_url || user.user_metadata?.picture || null,
    createdAt: user.createdAt || user.created_at || null,
  }
}

function persistSession(session, customStorage) {
  if (!session?.access_token || !session?.user?.email) return null
  const storage = resolveStorage(customStorage)
  const user = normalizedUser(session.user)
  if (storage) {
    storage.setItem(ACTIVE_USER_STORAGE_KEY, JSON.stringify(user))
    storage.setItem(ACCESS_TOKEN_STORAGE_KEY, session.access_token)
    if (session.refresh_token) storage.setItem(REFRESH_TOKEN_STORAGE_KEY, session.refresh_token)
  }
  return user
}

export function getAuthHeaders(customStorage) {
  const storage = resolveStorage(customStorage)
  const token = storage?.getItem(ACCESS_TOKEN_STORAGE_KEY)
  return token ? { Authorization: `Bearer ${token}` } : {}
}

export function readActiveUser(customStorage) {
  const storage = resolveStorage(customStorage)
  try {
    const raw = storage?.getItem(ACTIVE_USER_STORAGE_KEY)
    const user = raw ? JSON.parse(raw) : null
    return user && typeof user === 'object' && user.email ? user : null
  } catch {
    return null
  }
}

export function clearAuthSession(customStorage) {
  const storage = resolveStorage(customStorage)
  if (!storage) return
  storage.removeItem(ACTIVE_USER_STORAGE_KEY)
  storage.removeItem(ACCESS_TOKEN_STORAGE_KEY)
  storage.removeItem(REFRESH_TOKEN_STORAGE_KEY)
}

export async function refreshAuthSession(customStorage) {
  const storage = resolveStorage(customStorage)
  const refreshToken = storage?.getItem(REFRESH_TOKEN_STORAGE_KEY)
  if (!refreshToken) return null
  try {
    const response = await fetch('/api/v1/auth/refresh', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ refresh_token: refreshToken }),
    })
    const payload = await response.json().catch(() => null)
    if (!response.ok) {
      clearAuthSession(storage)
      return null
    }
    const user = persistSession(payload?.data, storage)
    return user ? payload.data.access_token : null
  } catch {
    return null
  }
}

export async function restoreAuthSession(customStorage) {
  const storage = resolveStorage(customStorage)
  const accessToken = storage?.getItem(ACCESS_TOKEN_STORAGE_KEY)
  if (!accessToken) {
    clearAuthSession(storage)
    return null
  }
  try {
    const response = await fetch('/api/v1/auth/session', {
      headers: { Authorization: `Bearer ${accessToken}` },
    })
    const payload = await response.json().catch(() => null)
    if (!response.ok || !payload?.data?.user?.email) {
      const refreshedToken = await refreshAuthSession(storage)
      if (!refreshedToken) {
        clearAuthSession(storage)
        return null
      }
      const retry = await fetch('/api/v1/auth/session', {
        headers: { Authorization: `Bearer ${refreshedToken}` },
      })
      const retryPayload = await retry.json().catch(() => null)
      if (!retry.ok || !retryPayload?.data?.user?.email) {
        clearAuthSession(storage)
        return null
      }
      const refreshedUser = normalizedUser(retryPayload.data.user)
      storage.setItem(ACTIVE_USER_STORAGE_KEY, JSON.stringify(refreshedUser))
      return refreshedUser
    }
    const user = normalizedUser(payload.data.user)
    storage.setItem(ACTIVE_USER_STORAGE_KEY, JSON.stringify(user))
    return user
  } catch {
    clearAuthSession(storage)
    return null
  }
}

export function validateRegistrationInput({ fullName = '', email = '', password = '', confirmPassword = '' } = {}) {
  const errors = {}
  const cleanName = String(fullName || '').trim()
  const cleanEmail = String(email || '').trim().toLowerCase()
  const rawPassword = String(password || '')
  if (cleanName.length < 3) errors.fullName = 'Nama lengkap minimal 3 karakter.'
  if (!/^[a-zA-Z0-9._%+-]+@gmail\.com$/i.test(cleanEmail)) errors.email = 'Gunakan alamat Gmail yang valid (contoh: nama@gmail.com).'
  if (rawPassword.length < 8 || !/[A-Za-z]/.test(rawPassword) || !/[0-9]/.test(rawPassword)) errors.password = 'Password minimal 8 karakter dengan kombinasi huruf dan angka.'
  if (!confirmPassword) errors.confirmPassword = 'Konfirmasi password wajib diisi.'
  else if (confirmPassword !== rawPassword) errors.confirmPassword = 'Konfirmasi password tidak cocok.'
  return { isValid: Object.keys(errors).length === 0, errors, sanitized: { fullName: cleanName, email: cleanEmail } }
}

export function validateLoginInput({ email = '', password = '' } = {}) {
  const cleanEmail = String(email || '').trim().toLowerCase()
  const errors = {}
  if (!/^[a-zA-Z0-9._%+-]+@gmail\.com$/i.test(cleanEmail)) errors.email = 'Gunakan alamat Gmail yang valid (contoh: nama@gmail.com).'
  if (!password) errors.password = 'Password wajib diisi.'
  return { isValid: Object.keys(errors).length === 0, errors, sanitized: { email: cleanEmail } }
}

async function postAuth(path, body, customStorage, saveSession = true) {
  try {
    const response = await fetch(`/api/v1/auth/${path}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })
    const payload = await response.json().catch(() => null)
    if (!response.ok) return { ok: false, message: parseResponse(payload) }
    const data = payload?.data || {}
    const user = saveSession ? persistSession(data, customStorage) : data.user
    return { ok: true, user: user ? normalizedUser(user) : null, data, message: payload?.message || data.message }
  } catch {
    return { ok: false, message: 'Server autentikasi tidak dapat dihubungi. Periksa koneksi lalu coba lagi.' }
  }
}

export async function registerWithGmailBackend(input = {}, customStorage) {
  const validation = validateRegistrationInput(input)
  if (!validation.isValid) return { ok: false, errors: validation.errors }
  const result = await postAuth('register', {
    fullName: validation.sanitized.fullName,
    email: validation.sanitized.email,
    password: input.password,
  }, customStorage, false)
  if (!result.ok) return { ok: false, errors: { email: result.message } }
  return { ok: true, user: result.user, confirmationRequired: Boolean(result.data.confirmation_required), message: result.message }
}

export async function authenticateGoogleBackend({ idToken } = {}, customStorage) {
  if (!idToken) return { ok: false, errors: { email: 'Token resmi Google OAuth wajib disertakan.' } }
  const result = await postAuth('google', { idToken }, customStorage)
  return result.ok ? result : { ok: false, errors: { email: result.message } }
}

export async function sendOtpToGmailBackend(email, purpose = 'reset_password') {
  const cleanEmail = String(email || '').trim().toLowerCase()
  if (!/^[a-zA-Z0-9._%+-]+@gmail\.com$/i.test(cleanEmail)) return { ok: false, message: 'Masukkan alamat @gmail.com yang valid.' }
  const result = await postAuth('send-otp', { email: cleanEmail, purpose }, undefined, false)
  return result.ok ? { ok: true, message: result.message, data: result.data } : { ok: false, message: result.message }
}

export async function verifyOtpBackend(email, otpCode, purpose = 'register', customStorage) {
  const result = await postAuth('verify-otp', {
    email: String(email || '').trim().toLowerCase(),
    otpCode: String(otpCode || '').trim(),
    purpose,
  }, customStorage)
  return result.ok ? { ok: true, user: result.user, message: result.message, data: result.data } : { ok: false, message: result.message }
}

export async function loginWithGmailBackend(input = {}, customStorage) {
  const validation = validateLoginInput(input)
  if (!validation.isValid) return { ok: false, errors: validation.errors }
  const result = await postAuth('login', { email: validation.sanitized.email, password: input.password }, customStorage)
  if (result.ok) return result
  const field = /password|kata sandi|kata sand|sandi/i.test(result.message) ? 'password' : 'email'
  return { ok: false, errors: { [field]: result.message } }
}

export async function resetPasswordWithOtpBackend({ email = '', otpCode = '', newPassword = '', confirmNewPassword = '' } = {}) {
  const cleanOtp = String(otpCode || '').trim()
  if (cleanOtp.length !== 6) return { ok: false, message: 'Masukkan 6-digit kode OTP dari email Anda.' }
  if (newPassword.length < 8 || !/[A-Za-z]/.test(newPassword) || !/[0-9]/.test(newPassword)) return { ok: false, message: 'Password baru minimal 8 karakter dengan kombinasi huruf dan angka.' }
  if (newPassword !== confirmNewPassword) return { ok: false, message: 'Konfirmasi password baru tidak cocok.' }
  try {
    const response = await fetch('/api/v1/auth/reset-password', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: String(email || '').trim().toLowerCase(), otpCode: cleanOtp, newPassword }),
    })
    const payload = await response.json().catch(() => null)
    if (!response.ok) return { ok: false, message: parseResponse(payload) }
    return { ok: true, message: payload.message || 'Kata sandi berhasil diperbarui.' }
  } catch {
    return { ok: false, message: 'Server autentikasi tidak dapat dihubungi.' }
  }
}

export async function logoutActiveUser(customStorage) {
  const storage = resolveStorage(customStorage)
  const token = storage?.getItem(ACCESS_TOKEN_STORAGE_KEY)
  clearAuthSession(storage)
  if (!token) return
  try {
    await fetch('/api/v1/auth/logout', { method: 'POST', headers: { Authorization: `Bearer ${token}` } })
  } catch {
    // Local logout remains effective when the remote revocation endpoint is unavailable.
  }
}
