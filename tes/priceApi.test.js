/**
 * Tests isu #44 — klien kontrak harga `/api/v1/prices/*` & pemetaan state tampilan.
 * Dijalankan via `node --test` (konvensi repo), fetch dimock per test.
 */

import test from 'node:test'
import assert from 'node:assert/strict'
import {
  DEFAULT_REGION,
  DEFAULT_SOURCE_ID,
  PRICE_DATA_MODE,
  PriceApiError,
  commodityNameToId,
  fetchLatestPrice,
  formatObservedAt,
  mapObservationForDisplay,
} from '../src/services/priceApi.js'

const _origFetch = globalThis.fetch
function mockFetch(handler) {
  globalThis.fetch = async (url, init) => handler(url, init)
}
test.after(() => {
  globalThis.fetch = _origFetch
})

function okEnvelope(data) {
  return {
    ok: true,
    status: 200,
    json: async () => ({ data, meta: { request_id: 'req_test123' } }),
  }
}

const baseObservation = {
  commodity: { id: 'cabai_rawit_hijau', name: 'Cabai Rawit Hijau', raw_label: 'C Rawit Hijau' },
  region: { level: 'kabupaten', code: '1376', name: 'Kota Payakumbuh' },
  price_type: 'consumer',
  currency: 'IDR',
  unit_raw: 'kg',
  price_value: 44800,
  normalized_price_per_kg: 44800,
  normalization: null,
  data_status: 'actual',
  is_live: true,
  is_official: true,
  source: { id: 'sp2kp', name: 'SP2KP — Kementerian Perdagangan RI', access_status: 'authorized' },
  observed_at: '2026-11-27T08:00:00+07:00',
  published_at: '2026-11-27T09:30:00+07:00',
  fetched_at: '2026-11-27T02:31:12Z',
  freshness: { state: 'fresh', age_seconds: 9312, max_age_seconds: 194400 },
  provenance: { method: 'official_api', reference: null, notes: null },
  warnings: [],
}

test('mode data default OFF sampai diatur eksplisit', () => {
  assert.equal(PRICE_DATA_MODE, 'off')
})

test('fetchLatestPrice membangun query kontrak dengan benar', async () => {
  let captured = null
  mockFetch(async (url) => {
    captured = String(url)
    return okEnvelope(baseObservation)
  })
  const { observation, requestId } = await fetchLatestPrice({ commodityId: 'cabai_rawit_hijau' })
  assert.ok(captured.startsWith('/api/v1/prices/latest?'))
  assert.ok(captured.includes('commodity=cabai_rawit_hijau'))
  assert.ok(captured.includes('price_type=consumer'))
  assert.ok(captured.includes('region_level=kabupaten'))
  assert.ok(captured.includes('region_code=1376'))
  assert.ok(captured.includes('source_id=sp2kp'))
  assert.equal(observation.price_value, 44800)
  assert.equal(requestId, 'req_test123')
})

test('envelope tanpa meta.request_id ditolak — bukan dirender sebagian', async () => {
  mockFetch(async () => ({
    ok: true,
    status: 200,
    json: async () => ({ data: baseObservation, meta: {} }),
  }))
  await assert.rejects(
    () => fetchLatestPrice({ commodityId: 'tomat' }),
    (err) => err instanceof PriceApiError && /request_id/.test(err.message),
  )
})

test('envelope tanpa data ditolak', async () => {
  mockFetch(async () => ({
    ok: true,
    status: 200,
    json: async () => ({ meta: { request_id: 'req_x' } }),
  }))
  await assert.rejects(
    () => fetchLatestPrice({ commodityId: 'tomat' }),
    (err) => err instanceof PriceApiError && /data/.test(err.message),
  )
})

test('respons JSON rusak -> error terketik, tanpa angka sebagian', async () => {
  mockFetch(async () => ({ ok: true, status: 200, json: async () => { throw new Error('bad json') } }))
  await assert.rejects(
    () => fetchLatestPrice({ commodityId: 'tomat' }),
    (err) => err instanceof PriceApiError && /JSON/.test(err.message),
  )
})

test('error kontrak 404 membawa code & request_id', async () => {
  mockFetch(async () => ({
    ok: false,
    status: 404,
    json: async () => ({ error: { code: 'COMMODITY_NOT_FOUND', message: 'tidak ada', request_id: 'req_e1' } }),
  }))
  await assert.rejects(
    () => fetchLatestPrice({ commodityId: 'durian' }),
    (err) => err instanceof PriceApiError && err.code === 'COMMODITY_NOT_FOUND' && err.requestId === 'req_e1',
  )
})

test('pemetaan komoditas eksak — tanpa fuzzy', () => {
  assert.equal(commodityNameToId('Cabai Rawit Hijau'), 'cabai_rawit_hijau')
  assert.equal(commodityNameToId('Terung'), 'terung')
  assert.equal(commodityNameToId('Tomat'), 'tomat')
  assert.equal(commodityNameToId('Tomat Merah'), null)
  assert.equal(commodityNameToId(''), null)
})

test('state actual: harga + jenis + sumber + waktu observasi TERPISAH dari waktu tarik', () => {
  const d = mapObservationForDisplay(baseObservation)
  assert.equal(d.state, 'actual')
  assert.equal(d.priceText, '44.800')
  assert.equal(d.unitText, 'kg')
  assert.equal(d.priceTypeText, 'harga konsumen')
  assert.ok(d.headline.includes('terkini'))
  assert.notEqual(d.observedText, d.fetchedText) // dua waktu berbeda tampil berbeda
  assert.ok(!/live/i.test(d.headline) || d.state === 'actual')
})

test('state historical tidak pernah dilabel harga hari ini', () => {
  const d = mapObservationForDisplay({ ...baseObservation, data_status: 'historical', is_live: false })
  assert.equal(d.state, 'historical')
  assert.ok(/historis/i.test(d.headline))
  assert.ok(!/terkini/i.test(d.headline))
})

test('state cached+stale: berlabel cache, tidak pernah live, timestamp asli tampil', () => {
  const d = mapObservationForDisplay({
    ...baseObservation,
    data_status: 'cached',
    is_live: false,
    freshness: { state: 'stale', age_seconds: 200000, max_age_seconds: 259200 },
    warnings: ['STALE_OBSERVATION'],
  })
  assert.equal(d.state, 'cached')
  assert.ok(/tidak live|cache/i.test(d.headline))
  assert.ok(d.warnings.some((w) => /tidak terbaru/i.test(w)))
  assert.ok(d.observedText)
})

test('state simulated: hanya di mode demo, berlabel demo', () => {
  const d = mapObservationForDisplay({ ...baseObservation, data_status: 'simulated', is_live: false })
  assert.equal(d.state, 'simulated')
  assert.ok(/demo/i.test(d.headline))
})

test('Terung tidak dipublikasi SP2KP: alasan eksplisit, BUKAN angka pengganti', () => {
  const d = mapObservationForDisplay({
    ...baseObservation,
    commodity: { id: 'terung', name: 'Terung (Eggplant)' },
    data_status: 'unavailable',
    price_value: null,
    normalized_price_per_kg: null,
    warnings: ['SOURCE_DOES_NOT_PUBLISH_COMMODITY', 'SOURCE_ACCESS_UNCONFIRMED'],
  })
  assert.equal(d.state, 'unavailable')
  assert.equal(d.priceText, undefined)
  assert.ok(d.reasons.some((r) => /Sumber tidak menyediakan data komoditas/i.test(r)))
  assert.ok(d.reasons.some((r) => /belum terkonfirmasi/i.test(r)))
})

test('unavailable tanpa warning tetap punya alasan', () => {
  const d = mapObservationForDisplay({ ...baseObservation, data_status: 'unavailable', price_value: null, warnings: [] })
  assert.equal(d.state, 'unavailable')
  assert.ok(d.reasons.length >= 1)
})

test('formatObservedAt memakai zona Asia/Jakarta', () => {
  const text = formatObservedAt('2026-11-27T08:00:00+07:00')
  assert.ok(/27/.test(text))
  assert.ok(/Nov/i.test(text))
})

test('konstanta wilayah default = Payakumbuh & sumber sp2kp', () => {
  assert.deepEqual(DEFAULT_REGION, { level: 'kabupaten', code: '1376' })
  assert.equal(DEFAULT_SOURCE_ID, 'sp2kp')
})
