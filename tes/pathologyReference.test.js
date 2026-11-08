import test from 'node:test'
import assert from 'node:assert/strict'
import {
  ALL_PATHOLOGY_ITEMS,
  POST_HARVEST_PATHOLOGY_DATA,
  getPathologiesForCommodity,
  getPrimaryScienceRecommendation,
} from '../src/business/pathologyReference.js'

test('POST_HARVEST_PATHOLOGY_DATA memuat data patologi esensial lengkap', () => {
  assert.ok(POST_HARVEST_PATHOLOGY_DATA.anthracnose)
  assert.ok(POST_HARVEST_PATHOLOGY_DATA.bacterial_soft_rot)
  assert.ok(POST_HARVEST_PATHOLOGY_DATA.gray_mold)
  assert.ok(POST_HARVEST_PATHOLOGY_DATA.physiological_shrivel)
  assert.ok(POST_HARVEST_PATHOLOGY_DATA.blossom_end_rot)

  assert.equal(ALL_PATHOLOGY_ITEMS.length, 5)

  for (const item of ALL_PATHOLOGY_ITEMS) {
    assert.ok(item.id)
    assert.ok(item.name)
    assert.ok(item.scientificName)
    assert.ok(item.agentType)
    assert.ok(item.macroscopicSymptoms)
    assert.ok(item.postHarvestMechanism)
    assert.ok(item.mitigationAction)
    assert.ok(item.steamPillar)
    assert.ok(Array.isArray(item.affectedCommodities))
  }
})

test('getPathologiesForCommodity menyaring komoditas secara akurat', () => {
  const terungList = getPathologiesForCommodity('Terung')
  assert.ok(terungList.length >= 3)
  assert.ok(terungList.some((p) => p.id === 'anthracnose'))
  assert.ok(terungList.some((p) => p.id === 'bacterial_soft_rot'))

  const tomatList = getPathologiesForCommodity('Tomat')
  assert.ok(tomatList.some((p) => p.id === 'blossom_end_rot'))

  const cabaiList = getPathologiesForCommodity('Cabai Merah Keriting')
  assert.ok(cabaiList.some((p) => p.id === 'anthracnose'))

  // Default fallback jika null/empty
  const allFallback = getPathologiesForCommodity('')
  assert.equal(allFallback.length, ALL_PATHOLOGY_ITEMS.length)
})

test('getPrimaryScienceRecommendation memberikan panduan tepat saat ada reject dan saat prima', () => {
  // Kondisi ada reject
  const recWarning = getPrimaryScienceRecommendation({
    commodity: 'Terung',
    rejectCount: 2,
    rejectPercent: 15.4,
  })
  assert.equal(recWarning.severity, 'warning')
  assert.equal(recWarning.pathology.id, 'anthracnose')
  assert.ok(recWarning.headline.includes('Antraknosa'))
  assert.ok(recWarning.actionHighlight)

  // Kondisi prima (tanpa reject)
  const recPrime = getPrimaryScienceRecommendation({
    commodity: 'Tomat',
    rejectCount: 0,
    rejectPercent: 0,
  })
  assert.equal(recPrime.severity, 'success')
  assert.ok(recPrime.headline.includes('Prima'))
  assert.ok(recPrime.pathology.id === 'physiological_shrivel')
})

