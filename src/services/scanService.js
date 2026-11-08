/**
 * Client API Service — Agri-Sort AI Frontend
 * Tanggung Jawab: Fullstack Developer (Frontend Services)
 * Dokumen Acuan: docs/rencana-kerja-fullstack.md (Task FS-FE-01)
 *
 * Mengelola komunikasi HTTP asinkron antara React 19 dan FastAPI backend
 * melalui reverse proxy Vite (/api) dengan timeout 15 detik dan penanganan error ramah pengguna.
 */

export const DEFAULT_TIMEOUT_MS = 15000

export class ApiError extends Error {
  constructor(message, { code = 'API_ERROR', details = {}, status = 500 } = {}) {
    super(message)
    this.name = 'ApiError'
    this.code = code
    this.details = details
    this.status = status
  }
}

/**
 * Validasi parameter input sebelum mengirim request ke backend (Pre-flight check).
 */
export function validateScanParams({ imageFile, confidenceThreshold, weightKg }) {
  if (!imageFile) {
    throw new ApiError('Berkas citra panen wajib dilampirkan.', {
      code: 'MISSING_IMAGE_FILE',
      status: 400,
    })
  }

  // Verifikasi objek menyerupai berkas citra (Blob/File)
  const isBlobLike =
    typeof imageFile === 'object' &&
    imageFile !== null &&
    (typeof imageFile.slice === 'function' ||
      typeof imageFile.arrayBuffer === 'function' ||
      'size' in imageFile)

  if (!isBlobLike) {
    throw new ApiError('Objek berkas citra tidak valid. Gunakan berkas gambar File/Blob.', {
      code: 'INVALID_IMAGE_OBJECT',
      status: 400,
    })
  }

  if (confidenceThreshold !== undefined && confidenceThreshold !== null) {
    const th = Number(confidenceThreshold)
    if (Number.isNaN(th) || th < 0.05 || th > 0.95) {
      throw new ApiError('Batas ambang keyakinan harus berada pada rentang 0.05 hingga 0.95.', {
        code: 'INVALID_CONFIDENCE_THRESHOLD',
        status: 400,
      })
    }
  }

  if (weightKg !== undefined && weightKg !== null && weightKg !== '') {
    const w = Number(weightKg)
    if (Number.isNaN(w) || w <= 0) {
      throw new ApiError('Estimasi berat fisik total harus berupa angka lebih besar dari 0 kg.', {
        code: 'INVALID_WEIGHT_VALUE',
        status: 400,
      })
    }
  }

  return true
}

/**
 * Membangun payload FormData untuk multipart/form-data upload.
 */
export function buildScanFormData({
  imageFile,
  commodity = 'Tomat',
  weightKg = null,
  confidenceThreshold = 0.35,
  mode = 'production',
  enableSlicing = true,
  disambiguateGrades = true,
}) {
  const formData = new FormData()
  formData.append('image', imageFile)
  formData.append('commodity', String(commodity || 'Tomat'))

  if (weightKg !== null && weightKg !== undefined && weightKg !== '') {
    formData.append('weight_kg', String(weightKg))
  }

  if (confidenceThreshold !== null && confidenceThreshold !== undefined) {
    formData.append('confidence_threshold', String(confidenceThreshold))
  }

  if (mode) {
    formData.append('mode', String(mode))
  }

  if (enableSlicing !== undefined) {
    formData.append('enable_slicing', String(enableSlicing))
  }

  if (disambiguateGrades !== undefined) {
    formData.append('disambiguate_grades', String(disambiguateGrades))
  }

  return formData
}

/**
 * Mengeksekusi fetch dengan batas waktu timeout menggunakan AbortController.
 */
async function fetchWithTimeout(url, options = {}, timeoutMs = DEFAULT_TIMEOUT_MS) {
  const controller = new AbortController()
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs)

  try {
    const response = await fetch(url, {
      ...options,
      signal: controller.signal,
    })
    clearTimeout(timeoutId)
    return response
  } catch (err) {
    clearTimeout(timeoutId)
    if (err.name === 'AbortError') {
      throw new ApiError(
        `Batas waktu pemindaian (${Math.round(timeoutMs / 1000)} detik) terlampaui. Pastikan koneksi server backend stabil.`,
        { code: 'REQUEST_TIMEOUT', status: 408 }
      )
    }
    if (err instanceof TypeError && err.message.toLowerCase().includes('fetch')) {
      throw new ApiError(
        'Tidak dapat terhubung ke server backend (port 8000). Pastikan server FastAPI sedang berjalan.',
        { code: 'NETWORK_DISCONNECTED', status: 503 }
      )
    }
    throw err
  }
}

/**
 * Mengirim berkas citra panen ke endpoint backend POST /api/v1/qc/scan.
 */
export async function scanHarvestImage({
  imageFile,
  commodity = 'Tomat',
  weightKg = null,
  confidenceThreshold = 0.35,
  mode = 'production',
  enableSlicing = true,
  disambiguateGrades = true,
  timeoutMs = DEFAULT_TIMEOUT_MS,
}) {
  validateScanParams({ imageFile, confidenceThreshold, weightKg })

  const formData = buildScanFormData({
    imageFile,
    commodity,
    weightKg,
    confidenceThreshold,
    mode,
    enableSlicing,
    disambiguateGrades,
  })

  const response = await fetchWithTimeout(
    '/api/v1/qc/scan',
    {
      method: 'POST',
      body: formData,
    },
    timeoutMs
  )

  let data
  try {
    data = await response.json()
  } catch {
    throw new ApiError('Format respon server tidak valid (bukan JSON).', {
      code: 'INVALID_SERVER_RESPONSE',
      status: response.status,
    })
  }

  if (!response.ok || data.status === 'error') {
    const errorInfo = data.error || {}
    throw new ApiError(
      errorInfo.message || 'Terjadi kesalahan saat memproses pemindaian citra panen.',
      {
        code: errorInfo.code || 'SCAN_PROCESSING_FAILED',
        details: errorInfo.details || {},
        status: response.status,
      }
    )
  }

  return data
}

/**
 * Memeriksa status kesehatan server FastAPI (GET /api/v1/health).
 */
export async function checkBackendHealth(timeoutMs = 3000) {
  try {
    const response = await fetchWithTimeout('/api/v1/health', { method: 'GET' }, timeoutMs)
    if (!response.ok) return { isOnline: false, status: response.status }
    const data = await response.json()
    return { isOnline: data.status === 'ok', data }
  } catch {
    return { isOnline: false }
  }
}

/**
 * Mengambil daftar komoditas dan referensi harga dari backend (GET /api/v1/pricing/commodities).
 */
export async function fetchPricingCommodities(timeoutMs = 5000) {
  const response = await fetchWithTimeout('/api/v1/pricing/commodities', { method: 'GET' }, timeoutMs)
  if (!response.ok) {
    throw new ApiError('Gagal mengambil daftar komoditas dan harga acuan.', {
      status: response.status,
    })
  }
  const data = await response.json()
  return data.data?.commodities || []
}

/**
 * Mengambil data live feed Panel Harga Pangan BAPANAS (GET /api/v1/pricing/bapanas/live).
 */
export async function fetchBapanasLive(timeoutMs = 5000) {
  const response = await fetchWithTimeout('/api/v1/pricing/bapanas/live', { method: 'GET' }, timeoutMs)
  if (!response.ok) {
    throw new ApiError('Gagal memuat feed harga BAPANAS.', { status: response.status })
  }
  const data = await response.json()
  return data.data || null
}

/**
 * Memicu sinkronisasi instan feed Panel Harga Pangan BAPANAS (POST /api/v1/pricing/bapanas/sync).
 */
export async function syncBapanasPrices(timeoutMs = 8000) {
  const response = await fetchWithTimeout('/api/v1/pricing/bapanas/sync', { method: 'POST' }, timeoutMs)
  if (!response.ok) {
    throw new ApiError('Gagal menyinkronkan data BAPANAS.', { status: response.status })
  }
  const data = await response.json()
  return data.data || null
}

/**
 * Mengambil harga resmi BAPANAS untuk komoditas tertentu (GET /api/v1/pricing/bapanas/commodities/:commodity).
 */
export async function fetchBapanasCommodity(commodity, timeoutMs = 5000) {
  const response = await fetchWithTimeout(`/api/v1/pricing/bapanas/commodities/${encodeURIComponent(commodity)}`, { method: 'GET' }, timeoutMs)
  if (!response.ok) {
    throw new ApiError(`Gagal mengambil data harga BAPANAS untuk ${commodity}.`, { status: response.status })
  }
  const data = await response.json()
  return data.data || null
}

/**
 * Mengambil riwayat pemindaian panen dari backend (GET /api/v1/qc/history).
 */
export async function fetchScanHistory({ limit = 50, offset = 0, commodity = null, timeoutMs = 5000 } = {}) {
  const params = new URLSearchParams()
  params.append('limit', String(limit))
  params.append('offset', String(offset))
  if (commodity) params.append('commodity', commodity)

  const response = await fetchWithTimeout(`/api/v1/qc/history?${params.toString()}`, { method: 'GET' }, timeoutMs)
  if (!response.ok) {
    throw new ApiError('Gagal memuat riwayat pemindaian.', { status: response.status })
  }
  const data = await response.json()
  return data.data || { records: [], total_count: 0 }
}
