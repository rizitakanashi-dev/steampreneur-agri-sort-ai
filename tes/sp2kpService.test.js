import test from 'node:test'
import assert from 'node:assert/strict'
import {
  ApiError,
  fetchSp2kpLive,
  fetchSp2kpCommodity,
  syncSp2kpPrices,
  fetchGovernmentPriceComparison,
} from '../src/services/scanService.js'

test('fetchSp2kpLive mengambil data feed SP2KP Kemendag RI resmi', async () => {
  const originalFetch = globalThis.fetch

  const mockPayload = {
    status: 'success',
    data: {
      source: 'SP2KP — Kementerian Perdagangan Republik Indonesia',
      agency: 'Kementerian Perdagangan Republik Indonesia (Kemendag RI)',
      portal_url: 'https://sp2kp.kemendag.go.id/',
      region: 'Sumatera Barat',
      market_center: 'Pasar Ibuh Payakumbuh',
      commodities: {
        'cabai merah keriting': {
          commodity_name: 'Cabai Merah Keriting',
          price_per_kg: 44800,
        },
      },
    },
  }

  globalThis.fetch = async (url) => {
    assert.ok(url.includes('/api/v1/pricing/sp2kp/live'))
    return {
      ok: true,
      json: async () => mockPayload,
    }
  }

  try {
    const data = await fetchSp2kpLive()
    assert.ok(data)
    assert.equal(data.agency, 'Kementerian Perdagangan Republik Indonesia (Kemendag RI)')
    assert.equal(data.commodities['cabai merah keriting'].price_per_kg, 44800)
  } finally {
    globalThis.fetch = originalFetch
  }
})

test('fetchSp2kpCommodity mengambil harga komoditas spesifik dari SP2KP Kemendag', async () => {
  const originalFetch = globalThis.fetch

  globalThis.fetch = async (url) => {
    assert.ok(url.includes('/api/v1/pricing/sp2kp/commodities/tomat'))
    return {
      ok: true,
      json: async () => ({
        status: 'success',
        data: {
          commodity_name: 'Tomat',
          price_per_kg: 12000,
          market: 'Pasar Ibuh Payakumbuh',
        },
      }),
    }
  }

  try {
    const item = await fetchSp2kpCommodity('tomat')
    assert.equal(item.commodity_name, 'Tomat')
    assert.equal(item.price_per_kg, 12000)
  } finally {
    globalThis.fetch = originalFetch
  }
})

test('syncSp2kpPrices memperbarui data feed SP2KP Kemendag', async () => {
  const originalFetch = globalThis.fetch

  globalThis.fetch = async (url, options) => {
    assert.ok(url.includes('/api/v1/pricing/sp2kp/sync'))
    assert.equal(options.method, 'POST')
    return {
      ok: true,
      json: async () => ({
        status: 'success',
        data: { sync_status: 'live' },
      }),
    }
  }

  try {
    const res = await syncSp2kpPrices()
    assert.equal(res.sync_status, 'live')
  } finally {
    globalThis.fetch = originalFetch
  }
})

test('fetchGovernmentPriceComparison mengambil komparasi triangulasi BAPANAS vs Kemendag', async () => {
  const originalFetch = globalThis.fetch

  const mockComp = {
    status: 'success',
    data: {
      title: 'Triangulasi Harga Pangan Resmi Pemerintah RI',
      comparison: [
        {
          commodity_key: 'cabai merah keriting',
          commodity_name: 'Cabai Merah Keriting',
          bapanas_price_per_kg: 45000,
          sp2kp_kemendag_price_per_kg: 44800,
          composite_fair_price: 44900,
          disparity_rp: 200,
          convergence_index_percent: 99.55,
        },
      ],
    },
  }

  globalThis.fetch = async (url) => {
    assert.ok(url.includes('/api/v1/pricing/government/comparison'))
    return {
      ok: true,
      json: async () => mockComp,
    }
  }

  try {
    const res = await fetchGovernmentPriceComparison()
    assert.ok(res)
    assert.equal(res.comparison.length, 1)
    assert.equal(res.comparison[0].composite_fair_price, 44900)
    assert.equal(res.comparison[0].convergence_index_percent, 99.55)
  } finally {
    globalThis.fetch = originalFetch
  }
})

