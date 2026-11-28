/**
 * Klien API kontrak harga `/api/v1/prices/*` (isu #41) — sisi frontend (isu #44).
 *
 * Prinsip:
 *  - Hanya memanggil backend Agri-Sort AI (same-origin); URL/kredensial provider
 *    TIDAK PERNAH ada di sini. Override base URL staging memakai flag PUBLIK
 *    `VITE_PRICE_API_BASE_URL` (bukan kredensial).
 *  - Mode data PUBLIK: `VITE_PRICE_DATA_MODE = live | demo | off` (default `off`
 *    sampai API tersedia). Bukan secret.
 *  - Envelope respons divalidasi; payload rusak ditolak, bukan dirender sebagian.
 */

const API_BASE = (typeof import.meta !== 'undefined' && import.meta.env?.VITE_PRICE_API_BASE_URL) || '/api/v1'

const RAW_MODE = (typeof import.meta !== 'undefined' && import.meta.env?.VITE_PRICE_DATA_MODE) || 'off'
export const PRICE_DATA_MODE = ['live', 'demo', 'off'].includes(RAW_MODE) ? RAW_MODE : 'off'

export const DEFAULT_REGION = { level: 'kabupaten', code: '1376' } // Payakumbuh
export const DEFAULT_SOURCE_ID = 'sp2kp'

/** Nama kanonik komoditas katalog -> ID kanonik kontrak (pemetaan eksak, tanpa tebak). */
export function commodityNameToId(name) {
  const id = String(name || '').trim().toLowerCase().replace(/\s+/g, '_')
  return ['cabai_rawit_hijau', 'cabai_merah_keriting', 'cabai_rawit_merah', 'tomat', 'terung'].includes(id) ? id : null
}

export class PriceApiError extends Error {
  constructor(message, { code = 'PRICE_API_ERROR', status = 0, requestId = null, details = null } = {}) {
    super(message)
    this.name = 'PriceApiError'
    this.code = code
    this.status = status
    this.requestId = requestId
    this.details = details
  }
}

function validateEnvelope(payload) {
  if (!payload || typeof payload !== 'object') {
    throw new PriceApiError('Respons API harga kosong atau bukan objek.')
  }
  if (!('data' in payload)) {
    throw new PriceApiError('Envelope respons tidak memuat `data` — payload ditolak.')
  }
  const requestId = payload.meta?.request_id ?? null
  if (!requestId) {
    throw new PriceApiError('Envelope respons tanpa `meta.request_id` — payload ditolak.')
  }
  return requestId
}

async function requestJson(path, { timeoutMs = 8000 } = {}) {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), timeoutMs)
  try {
    const response = await fetch(`${API_BASE}${path}`, { signal: controller.signal, headers: { Accept: 'application/json' } })
    let payload = null
    try {
      payload = await response.json()
    } catch {
      throw new PriceApiError('Respons API harga bukan JSON valid.', { status: response.status })
    }
    if (!response.ok) {
      const err = payload?.error ?? {}
      throw new PriceApiError(err.message || `API harga menolak (HTTP ${response.status}).`, {
        code: err.code || 'PRICE_API_HTTP_ERROR',
        status: response.status,
        requestId: err.request_id ?? null,
        details: err.details ?? null,
      })
    }
    const requestId = validateEnvelope(payload)
    return { data: payload.data, requestId }
  } catch (err) {
    if (err instanceof PriceApiError) throw err
    if (err?.name === 'AbortError') {
      throw new PriceApiError('Permintaan API harga melebihi batas waktu.', { code: 'TIMEOUT' })
    }
    throw new PriceApiError('API harga tidak terjangkau.', { code: 'NETWORK_ERROR' })
  } finally {
    clearTimeout(timer)
  }
}

export async function fetchPriceCommodities(options) {
  const { data, requestId } = await requestJson('/prices/commodities', options)
  if (!Array.isArray(data)) throw new PriceApiError('Katalog komoditas tidak valid.', { requestId })
  return { commodities: data, requestId }
}

export async function fetchPriceSources(options) {
  const { data, requestId } = await requestJson('/prices/sources', options)
  if (!Array.isArray(data)) throw new PriceApiError('Metadata sumber tidak valid.', { requestId })
  return { sources: data, requestId }
}

export async function fetchSourceHealth(sourceId, options) {
  if (!['sp2kp', 'sipashorti'].includes(sourceId)) {
    throw new PriceApiError('source_id tidak dikenal.', { code: 'INVALID_QUERY' })
  }
  const { data, requestId } = await requestJson(`/prices/sources/${sourceId}/health`, options)
  return { health: data, requestId }
}

export async function fetchLatestPrice(
  { commodityId, priceType = 'consumer', regionLevel = DEFAULT_REGION.level, regionCode = DEFAULT_REGION.code, sourceId = DEFAULT_SOURCE_ID },
  options,
) {
  if (!commodityId) throw new PriceApiError('commodityId wajib diisi.', { code: 'INVALID_QUERY' })
  const params = new URLSearchParams({ commodity: commodityId, price_type: priceType, region_level: regionLevel })
  if (regionCode) params.set('region_code', regionCode)
  if (sourceId) params.set('source_id', sourceId)
  const { data, requestId } = await requestJson(`/prices/latest?${params.toString()}`, options)
  if (!data || typeof data !== 'object' || !('data_status' in data)) {
    throw new PriceApiError('Observasi harga tidak valid — payload ditolak.', { requestId })
  }
  return { observation: data, requestId }
}

export async function fetchPriceHistory(
  { commodityId, priceType = 'consumer', regionLevel = DEFAULT_REGION.level, regionCode = DEFAULT_REGION.code, sourceId = DEFAULT_SOURCE_ID, limit = 90 },
  options,
) {
  if (!commodityId) throw new PriceApiError('commodityId wajib diisi.', { code: 'INVALID_QUERY' })
  const params = new URLSearchParams({
    commodity: commodityId,
    price_type: priceType,
    region_level: regionLevel,
    limit: String(limit),
  })
  if (regionCode) params.set('region_code', regionCode)
  if (sourceId) params.set('source_id', sourceId)
  const { data, requestId } = await requestJson(`/prices/history?${params.toString()}`, options)
  if (!Array.isArray(data.rows)) throw new PriceApiError('Deret waktu tidak valid.', { requestId })
  return { rows: data.rows, dataStatus: data.data_status ?? null, warnings: data.warnings ?? [], requestId }
}

/* ---------- pemetaan tampilan (state display) ---------- */

export const WARNING_TEXT = {
  SOURCE_DOES_NOT_PUBLISH_COMMODITY: 'Sumber tidak menyediakan data komoditas ini',
  SOURCE_ACCESS_UNCONFIRMED: 'Akses sumber resmi belum terkonfirmasi',
  STALE_OBSERVATION: 'Data tidak terbaru',
  UNIT_NOT_NORMALIZABLE: 'Unit tidak bisa dinormalisasi ke kg',
}

const STATUS_LABEL = {
  actual: 'Data terkini',
  historical: 'Data historis',
  cached: 'Data tersimpan (cache)',
  simulated: 'Data demo',
  unavailable: 'Tidak tersedia',
}

const PRICE_TYPE_LABEL = {
  producer: 'harga produsen',
  wholesale: 'harga grosir',
  retail: 'harga eceran',
  consumer: 'harga konsumen',
  unknown: 'jenis harga tidak diketahui',
}

export function formatObservedAt(iso) {
  if (!iso) return null
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) return null
  return date.toLocaleString('id-ID', {
    day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Jakarta',
  })
}

/**
 * Petakan observasi kontrak -> satu state tampilan yang JELAS.
 * `cached + stale` tidak pernah dilabel live; `historical` tidak pernah jadi harga hari ini.
 */
export function mapObservationForDisplay(observation) {
  if (!observation || typeof observation !== 'object') {
    return { state: 'unavailable', headline: 'Observasi tidak valid', reasons: ['Payload tidak dapat dibaca'], detail: null }
  }
  const warnings = (observation.warnings ?? []).map((code) => WARNING_TEXT[code] ?? code)
  const status = observation.data_status
  const freshness = observation.freshness?.state ?? 'unknown'

  if (status === 'unavailable' || observation.price_value == null) {
    const reasons = [...warnings]
    if (!reasons.length) reasons.push('Tidak ada observasi untuk kombinasi ini')
    return {
      state: 'unavailable',
      headline: reasons[0],
      reasons,
      detail: { commodity: observation.commodity?.name, source: observation.source?.name },
    }
  }

  const observedText = formatObservedAt(observation.observed_at)
  const fetchedText = formatObservedAt(observation.fetched_at)
  const base = {
    priceText: new Intl.NumberFormat('id-ID').format(observation.price_value),
    unitText: observation.unit_raw ?? 'kg',
    normalizedPerKgText:
      observation.normalized_price_per_kg == null
        ? null
        : new Intl.NumberFormat('id-ID').format(observation.normalized_price_per_kg),
    priceTypeText: PRICE_TYPE_LABEL[observation.price_type] ?? PRICE_TYPE_LABEL.unknown,
    sourceName: observation.source?.name ?? null,
    observedText,
    fetchedText,
    warnings,
  }

  if (status === 'simulated') {
    return { state: 'simulated', headline: 'Data demo (simulasi)', reasons: ['Hanya sah dalam mode demo'], ...base }
  }
  if (status === 'historical') {
    return {
      state: 'historical',
      headline: 'Data historis — bukan harga hari ini',
      reasons: ['Catatan historis dari sumber resmi', ...warnings],
      observedLabel: observedText,
      ...base,
    }
  }
  if (status === 'cached' || freshness === 'stale') {
    return {
      state: 'cached',
      headline: `Data tersimpan per ${observedText ?? '—'} (tidak live)`,
      reasons: ['Ditayangkan sesuai kebijakan cache', ...warnings],
      observedLabel: observedText,
      ...base,
    }
  }
  return {
    state: 'actual',
    headline: `Harga terkini per ${observedText ?? '—'}`,
    reasons: [...warnings],
    observedLabel: observedText,
    ...base,
  }
}
