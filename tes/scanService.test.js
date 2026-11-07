import test from 'node:test'
import assert from 'node:assert/strict'
import {
  ApiError,
  buildScanFormData,
  checkBackendHealth,
  fetchPricingCommodities,
  fetchScanHistory,
  scanHarvestImage,
  validateScanParams,
} from '../src/services/scanService.js'

test('validateScanParams menolak request tanpa berkas gambar', () => {
  assert.throws(
    () => validateScanParams({ imageFile: null }),
    (err) => err instanceof ApiError && err.code === 'MISSING_IMAGE_FILE'
  )

  assert.throws(
    () => validateScanParams({ imageFile: { invalid: true } }),
    (err) => err instanceof ApiError && err.code === 'INVALID_IMAGE_OBJECT'
  )
})

test('validateScanParams menolak threshold di luar rentang 0.05 - 0.95', () => {
  const fakeFile = new Blob(['image data'], { type: 'image/jpeg' })

  assert.throws(
    () => validateScanParams({ imageFile: fakeFile, confidenceThreshold: 0.01 }),
    (err) => err instanceof ApiError && err.code === 'INVALID_CONFIDENCE_THRESHOLD'
  )

  assert.throws(
    () => validateScanParams({ imageFile: fakeFile, confidenceThreshold: 0.99 }),
    (err) => err instanceof ApiError && err.code === 'INVALID_CONFIDENCE_THRESHOLD'
  )
})

test('validateScanParams menolak nilai bobot nol atau negatif', () => {
  const fakeFile = new Blob(['image data'], { type: 'image/jpeg' })

  assert.throws(
    () => validateScanParams({ imageFile: fakeFile, weightKg: 0 }),
    (err) => err instanceof ApiError && err.code === 'INVALID_WEIGHT_VALUE'
  )

  assert.throws(
    () => validateScanParams({ imageFile: fakeFile, weightKg: -5 }),
    (err) => err instanceof ApiError && err.code === 'INVALID_WEIGHT_VALUE'
  )
})

test('validateScanParams menerima parameter yang valid', () => {
  const fakeFile = new Blob(['image data'], { type: 'image/jpeg' })
  const result = validateScanParams({
    imageFile: fakeFile,
    confidenceThreshold: 0.4,
    weightKg: 25.5,
  })
  assert.equal(result, true)
})

test('buildScanFormData menyusun FormData dengan field yang diharapkan', () => {
  const fakeFile = new Blob(['image data'], { type: 'image/jpeg' })
  const formData = buildScanFormData({
    imageFile: fakeFile,
    commodity: 'Terung',
    weightKg: 50.0,
    confidenceThreshold: 0.35,
    mode: 'production',
  })

  assert.equal(formData.get('commodity'), 'Terung')
  assert.equal(formData.get('weight_kg'), '50')
  assert.equal(formData.get('confidence_threshold'), '0.35')
  assert.equal(formData.get('mode'), 'production')
  assert.ok(formData.get('image'))
})

test('scanHarvestImage berhasil memproses respons server sukses', async () => {
  const originalFetch = globalThis.fetch
  const mockPayload = {
    status: 'success',
    data: {
      scan_id: 'scan_test_123',
      commodity: 'Tomat',
      ai_supported: true,
      inference_result: { object_counts: { total: 10 } },
    },
  }

  globalThis.fetch = async () => ({
    ok: true,
    status: 200,
    json: async () => mockPayload,
  })

  try {
    const fakeFile = new Blob(['fake image bytes'], { type: 'image/jpeg' })
    const res = await scanHarvestImage({ imageFile: fakeFile, commodity: 'Tomat' })
    assert.equal(res.status, 'success')
    assert.equal(res.data.scan_id, 'scan_test_123')
  } finally {
    globalThis.fetch = originalFetch
  }
})

test('scanHarvestImage menangani pesan error HTTP 400 dari backend', async () => {
  const originalFetch = globalThis.fetch
  const mockError = {
    status: 'error',
    error: {
      code: 'IMAGE_VALIDATION_FAILED',
      message: 'Format file tidak didukung.',
    },
  }

  globalThis.fetch = async () => ({
    ok: false,
    status: 400,
    json: async () => mockError,
  })

  try {
    const fakeFile = new Blob(['fake bytes'], { type: 'image/jpeg' })
    await assert.rejects(
      async () => scanHarvestImage({ imageFile: fakeFile }),
      (err) => err instanceof ApiError && err.code === 'IMAGE_VALIDATION_FAILED' && err.message === 'Format file tidak didukung.'
    )
  } finally {
    globalThis.fetch = originalFetch
  }
})

test('scanHarvestImage menangani timeout AbortError secara elegan', async () => {
  const originalFetch = globalThis.fetch

  globalThis.fetch = async () => {
    const abortErr = new Error('The operation was aborted.')
    abortErr.name = 'AbortError'
    throw abortErr
  }

  try {
    const fakeFile = new Blob(['fake bytes'], { type: 'image/jpeg' })
    await assert.rejects(
      async () => scanHarvestImage({ imageFile: fakeFile, timeoutMs: 10 }),
      (err) => err instanceof ApiError && err.code === 'REQUEST_TIMEOUT'
    )
  } finally {
    globalThis.fetch = originalFetch
  }
})

test('scanHarvestImage menangani respon bukan JSON dari server', async () => {
  const originalFetch = globalThis.fetch

  globalThis.fetch = async () => ({
    ok: true,
    status: 502,
    json: async () => {
      throw new Error('Unexpected token < in JSON')
    },
  })

  try {
    const fakeFile = new Blob(['fake bytes'], { type: 'image/jpeg' })
    await assert.rejects(
      async () => scanHarvestImage({ imageFile: fakeFile }),
      (err) => err instanceof ApiError && err.code === 'INVALID_SERVER_RESPONSE'
    )
  } finally {
    globalThis.fetch = originalFetch
  }
})

test('checkBackendHealth mendeteksi status server aktif atau mati', async () => {
  const originalFetch = globalThis.fetch

  // Skenario online
  globalThis.fetch = async () => ({
    ok: true,
    json: async () => ({ status: 'ok' }),
  })
  const onlineRes = await checkBackendHealth()
  assert.equal(onlineRes.isOnline, true)

  // Skenario offline (network error)
  globalThis.fetch = async () => {
    throw new TypeError('Failed to fetch')
  }
  const offlineRes = await checkBackendHealth()
  assert.equal(offlineRes.isOnline, false)

  globalThis.fetch = originalFetch
})

test('fetchPricingCommodities mengembalikan daftar komoditas dari backend', async () => {
  const originalFetch = globalThis.fetch

  globalThis.fetch = async () => ({
    ok: true,
    json: async () => ({
      status: 'success',
      data: {
        commodities: [{ canonical_name: 'Tomat', price_per_kg: 12000 }],
      },
    }),
  })

  try {
    const commodities = await fetchPricingCommodities()
    assert.equal(commodities.length, 1)
    assert.equal(commodities[0].canonical_name, 'Tomat')
  } finally {
    globalThis.fetch = originalFetch
  }
})

test('fetchScanHistory mengambil riwayat scan dengan benar', async () => {
  const originalFetch = globalThis.fetch

  globalThis.fetch = async () => ({
    ok: true,
    json: async () => ({
      status: 'success',
      data: {
        total_count: 3,
        records: [{ scan_id: 'scan_1' }, { scan_id: 'scan_2' }, { scan_id: 'scan_3' }],
      },
    }),
  })

  try {
    const history = await fetchScanHistory()
    assert.equal(history.total_count, 3)
    assert.equal(history.records.length, 3)
  } finally {
    globalThis.fetch = originalFetch
  }
})
