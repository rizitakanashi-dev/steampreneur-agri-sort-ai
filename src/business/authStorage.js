const USERS_STORAGE_KEY = 'agri_sort_registered_users_v1'
const ACTIVE_USER_STORAGE_KEY = 'agri_sort_active_user_v1'

function resolveStorage(customStorage) {
  if (customStorage) return customStorage
  if (typeof window !== 'undefined' && window.localStorage) {
    return window.localStorage
  }
  return null
}

/**
 * Hash deterministik untuk penyimpanan password lokal yang aman
 * (tidak menyimpan plain-text password di localStorage).
 */
export function hashPassword(rawPassword) {
  const str = String(rawPassword || '')
  let h1 = 0xdeadbeef ^ str.length
  let h2 = 0x41c6ce57 ^ str.length
  for (let i = 0; i < str.length; i++) {
    const ch = str.charCodeAt(i)
    h1 = Math.imul(h1 ^ ch, 2654435761)
    h2 = Math.imul(h2 ^ ch, 1597334677)
  }
  h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507) ^ Math.imul(h2 ^ (h2 >>> 13), 3266489909)
  h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507) ^ Math.imul(h1 ^ (h1 >>> 13), 3266489909)
  return `agrisort_sha_${(h2 >>> 0).toString(16).padStart(8, '0')}${(h1 >>> 0).toString(16).padStart(8, '0')}`
}

/**
 * Membentuk nama tampilan otomatis dari bagian depan alamat Gmail jika nama belum diisi
 */
export function deriveNameFromEmail(email) {
  const localPart = String(email || '').split('@')[0] || ''
  const cleaned = localPart.replace(/[._-]+/g, ' ').replace(/\d+/g, ' ').trim()
  if (!cleaned) return 'Pengguna Google'
  return cleaned
    .split(/\s+/)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
    .join(' ')
}

/**
 * Validasi input form pendaftaran akun Gmail & Password
 */
export function validateRegistrationInput({
  fullName = '',
  email = '',
  password = '',
  confirmPassword = '',
} = {}) {
  const errors = {}
  const trimmedName = String(fullName || '').trim()
  const trimmedEmail = String(email || '').trim().toLowerCase()
  const rawPassword = String(password || '')
  const rawConfirm = String(confirmPassword || '')

  if (!trimmedName) {
    errors.fullName = 'Nama lengkap wajib diisi.'
  } else if (trimmedName.length < 3) {
    errors.fullName = 'Nama lengkap minimal 3 karakter.'
  }

  if (!trimmedEmail) {
    errors.email = 'Alamat Gmail wajib diisi.'
  } else {
    const gmailRegex = /^[a-zA-Z0-9._%+-]+@gmail\.com$/i
    if (!gmailRegex.test(trimmedEmail)) {
      errors.email = 'Gunakan alamat Gmail yang valid (contoh: nama@gmail.com).'
    }
  }

  if (!rawPassword) {
    errors.password = 'Password wajib diisi.'
  } else if (rawPassword.length < 8) {
    errors.password = 'Password minimal 8 karakter.'
  } else if (!/[A-Za-z]/.test(rawPassword) || !/[0-9]/.test(rawPassword)) {
    errors.password = 'Password harus mengandung kombinasi huruf dan angka.'
  }

  if (!rawConfirm) {
    errors.confirmPassword = 'Konfirmasi password wajib diisi.'
  } else if (rawConfirm !== rawPassword) {
    errors.confirmPassword = 'Konfirmasi password tidak cocok.'
  }

  return {
    isValid: Object.keys(errors).length === 0,
    errors,
    sanitized: {
      fullName: trimmedName,
      email: trimmedEmail,
    },
  }
}

/**
 * Membaca daftar seluruh akun yang terdaftar dari storage
 */
export function readRegisteredUsers(customStorage) {
  const storage = resolveStorage(customStorage)
  if (!storage) return []
  try {
    const raw = storage.getItem(USERS_STORAGE_KEY)
    if (!raw) return []
    const parsed = JSON.parse(raw)
    return Array.isArray(parsed) ? parsed : []
  } catch {
    return []
  }
}

/**
 * Membaca sesi user yang sedang aktif
 */
export function readActiveUser(customStorage) {
  const storage = resolveStorage(customStorage)
  if (!storage) return null
  try {
    const raw = storage.getItem(ACTIVE_USER_STORAGE_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw)
    return parsed && typeof parsed === 'object' && parsed.email ? parsed : null
  } catch {
    return null
  }
}

/**
 * Menyimpan user ke localStorage dan menetapkan sebagai active user
 */
export function persistAuthenticatedUser(userRecord, customStorage) {
  if (!userRecord || !userRecord.email) return null
  const storage = resolveStorage(customStorage)
  const existingUsers = readRegisteredUsers(storage)
  const cleanEmail = String(userRecord.email).toLowerCase()

  const normalized = {
    id: userRecord.id || `user-${Date.now()}`,
    fullName: userRecord.fullName || deriveNameFromEmail(cleanEmail),
    email: cleanEmail,
    provider: userRecord.provider || 'gmail',
    picture: userRecord.picture || null,
    createdAt: userRecord.createdAt || new Date().toISOString(),
  }

  const idx = existingUsers.findIndex(
    (u) => String(u.email || '').toLowerCase() === cleanEmail
  )
  const updatedUsers =
    idx >= 0
      ? existingUsers.map((u, i) => (i === idx ? { ...u, ...normalized } : u))
      : [...existingUsers, normalized]

  if (storage) {
    storage.setItem(USERS_STORAGE_KEY, JSON.stringify(updatedUsers))
    storage.setItem(ACTIVE_USER_STORAGE_KEY, JSON.stringify(normalized))
  }
  return normalized
}

/**
 * Menyimpan user baru lewat form Gmail & Password (sinkronisasi lokal)
 */
export function registerWithGmail(input = {}, customStorage) {
  const validation = validateRegistrationInput(input)
  if (!validation.isValid) {
    return {
      ok: false,
      errors: validation.errors,
    }
  }

  const storage = resolveStorage(customStorage)
  const existingUsers = readRegisteredUsers(storage)
  const { fullName, email } = validation.sanitized

  const isDuplicate = existingUsers.some(
    (u) => String(u.email || '').toLowerCase() === email
  )
  if (isDuplicate) {
    return {
      ok: false,
      errors: {
        email: 'Alamat Gmail ini sudah terdaftar. Silakan gunakan Gmail lain.',
      },
    }
  }

  const nowIso = new Date().toISOString()
  const newUser = {
    id: `user-${Date.now()}`,
    fullName,
    email,
    provider: 'gmail',
    passwordHash: hashPassword(input.password),
    createdAt: nowIso,
  }

  const updatedUsers = [...existingUsers, newUser]
  const sessionUser = {
    id: newUser.id,
    fullName: newUser.fullName,
    email: newUser.email,
    provider: newUser.provider,
    createdAt: newUser.createdAt,
  }

  if (storage) {
    storage.setItem(USERS_STORAGE_KEY, JSON.stringify(updatedUsers))
    storage.setItem(ACTIVE_USER_STORAGE_KEY, JSON.stringify(sessionUser))
  }

  return {
    ok: true,
    user: sessionUser,
  }
}

/**
 * Mendaftarkan / melanjutkan akun menggunakan persetujuan Google OAuth (lokal)
 */
export function registerWithGoogleAccount(
  { fullName = '', email = '', picture = null } = {},
  customStorage
) {
  const trimmedEmail = String(email || '').trim().toLowerCase()
  const gmailRegex = /^[a-zA-Z0-9._%+-]+@gmail\.com$/i

  if (!gmailRegex.test(trimmedEmail)) {
    return {
      ok: false,
      errors: { email: 'Masukkan alamat @gmail.com yang valid.' },
    }
  }

  const trimmedName = String(fullName || '').trim() || deriveNameFromEmail(trimmedEmail)
  if (trimmedName.length < 2) {
    return {
      ok: false,
      errors: { fullName: 'Nama akun Google wajib diisi.' },
    }
  }

  const sessionUser = persistAuthenticatedUser(
    {
      id: `google-${Date.now()}`,
      fullName: trimmedName,
      email: trimmedEmail,
      provider: 'google',
      picture,
    },
    customStorage
  )

  return {
    ok: true,
    user: sessionUser,
  }
}

/**
 * Memanggil Backend FastAPI POST /api/v1/auth/register (Full Backend Persistence)
 */
export async function registerWithGmailBackend(input = {}, customStorage) {
  const validation = validateRegistrationInput(input)
  if (!validation.isValid) {
    return { ok: false, errors: validation.errors }
  }

  try {
    const response = await fetch('/api/v1/auth/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        fullName: validation.sanitized.fullName,
        email: validation.sanitized.email,
        password: input.password,
      }),
    })
    const payload = await response.json().catch(() => null)

    if (!response.ok) {
      const msg =
        payload?.detail?.message ||
        payload?.error?.message ||
        'Gagal mendaftarkan akun ke server.'
      return {
        ok: false,
        errors: { email: msg },
      }
    }

    const savedUser = persistAuthenticatedUser(payload.data, customStorage)
    return { ok: true, user: savedUser }
  } catch {
    // Fallback ke localStorage apabila server backend sedang tidak berjalan
    return registerWithGmail(input, customStorage)
  }
}

/**
 * Memanggil Backend FastAPI POST /api/v1/auth/google (Verifikasi Token Google OAuth 2.0 Resmi)
 */
export async function authenticateGoogleBackend(
  { accessToken, idToken } = {},
  customStorage
) {
  if (!accessToken && !idToken) {
    return {
      ok: false,
      errors: { email: 'Token resmi Google OAuth 2.0 wajib disertakan.' },
    }
  }

  try {
    const response = await fetch('/api/v1/auth/google', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        accessToken,
        idToken,
      }),
    })
    const payload = await response.json().catch(() => null)

    if (!response.ok) {
      const msg =
        payload?.detail?.message ||
        payload?.error?.message ||
        'Autentikasi Google gagal.'
      return { ok: false, errors: { email: msg } }
    }

    const savedUser = persistAuthenticatedUser(payload.data, customStorage)
    return { ok: true, user: savedUser }
  } catch {
    return {
      ok: false,
      errors: { email: 'Server backend tidak terjangkau untuk memverifikasi token Google.' },
    }
  }
}

/**
 * Memanggil Backend FastAPI POST /api/v1/auth/send-otp untuk mengirim Kode OTP 6-digit ke Inbox Gmail
 */
export async function sendOtpToGmailBackend(email, purpose = 'reset_password') {
  const cleanEmail = String(email || '').trim().toLowerCase()
  const gmailRegex = /^[a-zA-Z0-9._%+-]+@gmail\.com$/i
  if (!gmailRegex.test(cleanEmail)) {
    return {
      ok: false,
      message: 'Masukkan alamat @gmail.com yang valid.',
    }
  }

  try {
    const response = await fetch('/api/v1/auth/send-otp', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: cleanEmail, purpose }),
    })
    const payload = await response.json().catch(() => null)
    if (!response.ok) {
      return {
        ok: false,
        message:
          payload?.detail?.message ||
          payload?.error?.message ||
          'Gagal mengirim kode OTP ke Gmail.',
      }
    }
    return {
      ok: true,
      message: payload.message,
      data: payload.data,
    }
  } catch {
    return {
      ok: false,
      message: 'Server backend tidak terjangkau untuk mengirim email OTP.',
    }
  }
}

/**
 * Memanggil Backend FastAPI POST /api/v1/auth/verify-otp untuk memverifikasi 6-digit OTP Gmail
 */
export async function verifyOtpBackend(email, otpCode, purpose = 'reset_password') {
  try {
    const response = await fetch('/api/v1/auth/verify-otp', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: String(email || '').trim().toLowerCase(),
        otpCode: String(otpCode || '').trim(),
        purpose,
      }),
    })
    const payload = await response.json().catch(() => null)
    if (!response.ok) {
      return {
        ok: false,
        message:
          payload?.detail?.message ||
          payload?.error?.message ||
          'Kode OTP tidak valid.',
      }
    }
    return {
      ok: true,
      message: payload.message,
      data: payload.data,
    }
  } catch {
    return {
      ok: false,
      message: 'Gagal menghubungi server untuk verifikasi OTP.',
    }
  }
}

/**
 * Validasi input form login Gmail & Password
 */
export function validateLoginInput({ email = '', password = '' } = {}) {
  const errors = {}
  const trimmedEmail = String(email || '').trim().toLowerCase()
  const rawPassword = String(password || '')

  if (!trimmedEmail) {
    errors.email = 'Alamat Gmail wajib diisi.'
  } else {
    const gmailRegex = /^[a-zA-Z0-9._%+-]+@gmail\.com$/i
    if (!gmailRegex.test(trimmedEmail)) {
      errors.email = 'Gunakan alamat Gmail yang valid (contoh: nama@gmail.com).'
    }
  }

  if (!rawPassword) {
    errors.password = 'Password wajib diisi.'
  }

  return {
    isValid: Object.keys(errors).length === 0,
    errors,
    sanitized: {
      email: trimmedEmail,
    },
  }
}

/**
 * Login pengguna dengan Gmail & Password pada storage lokal
 */
export function loginWithGmail({ email = '', password = '' } = {}, customStorage) {
  const validation = validateLoginInput({ email, password })
  if (!validation.isValid) {
    return { ok: false, errors: validation.errors }
  }

  const storage = resolveStorage(customStorage)
  const existingUsers = readRegisteredUsers(storage)
  const targetUser = existingUsers.find(
    (u) => String(u.email || '').toLowerCase() === validation.sanitized.email
  )

  if (!targetUser) {
    return {
      ok: false,
      errors: {
        email: 'Akun Gmail tersebut belum terdaftar. Silakan daftar terlebih dahulu.',
      },
    }
  }

  if (targetUser.passwordHash && targetUser.passwordHash !== hashPassword(password)) {
    return {
      ok: false,
      errors: {
        password: 'Kata sandi yang Anda masukkan salah.',
      },
    }
  }

  const sessionUser = persistAuthenticatedUser(targetUser, storage)
  return { ok: true, user: sessionUser }
}

/**
 * Memanggil Backend FastAPI POST /api/v1/auth/login
 */
export async function loginWithGmailBackend(input = {}, customStorage) {
  const validation = validateLoginInput(input)
  if (!validation.isValid) {
    return { ok: false, errors: validation.errors }
  }

  try {
    const response = await fetch('/api/v1/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: validation.sanitized.email,
        password: input.password,
      }),
    })
    const payload = await response.json().catch(() => null)

    if (!response.ok) {
      const msg =
        payload?.detail?.message ||
        payload?.error?.message ||
        'Gagal masuk. Periksa kembali Gmail dan kata sandi Anda.'
      const isPasswordErr = msg.toLowerCase().includes('sandi')
      return {
        ok: false,
        errors: isPasswordErr ? { password: msg } : { email: msg },
      }
    }

    const savedUser = persistAuthenticatedUser(payload.data, customStorage)
    return { ok: true, user: savedUser }
  } catch {
    return loginWithGmail(input, customStorage)
  }
}

/**
 * Memanggil Backend FastAPI POST /api/v1/auth/reset-password untuk mengganti password via OTP Gmail
 */
export async function resetPasswordWithOtpBackend({
  email = '',
  otpCode = '',
  newPassword = '',
  confirmNewPassword = '',
} = {}) {
  const cleanEmail = String(email || '').trim().toLowerCase()
  const cleanOtp = String(otpCode || '').trim()
  const rawNewPass = String(newPassword || '')
  const rawConfirm = String(confirmNewPassword || '')

  if (cleanOtp.length !== 6) {
    return { ok: false, message: 'Masukkan 6-digit kode OTP dari Gmail Anda.' }
  }
  if (rawNewPass.length < 8 || !/[A-Za-z]/.test(rawNewPass) || !/[0-9]/.test(rawNewPass)) {
    return {
      ok: false,
      message: 'Password baru minimal 8 karakter dengan kombinasi huruf dan angka.',
    }
  }
  if (rawNewPass !== rawConfirm) {
    return { ok: false, message: 'Konfirmasi password baru tidak cocok.' }
  }

  try {
    const response = await fetch('/api/v1/auth/reset-password', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: cleanEmail,
        otpCode: cleanOtp,
        newPassword: rawNewPass,
      }),
    })
    const payload = await response.json().catch(() => null)
    if (!response.ok) {
      return {
        ok: false,
        message:
          payload?.detail?.message ||
          payload?.error?.message ||
          'Gagal mereset kata sandi.',
      }
    }
    return {
      ok: true,
      message: payload.message || 'Kata sandi berhasil diperbarui.',
      data: payload.data,
    }
  } catch {
    return {
      ok: false,
      message: 'Gagal menghubungi server untuk mereset kata sandi.',
    }
  }
}

/**
 * Keluar dari sesi akun aktif (Logout)
 */
export function logoutActiveUser(customStorage) {
  const storage = resolveStorage(customStorage)
  if (!storage) return
  try {
    storage.removeItem(ACTIVE_USER_STORAGE_KEY)
  } catch {
    // ignore storage errors
  }
}
