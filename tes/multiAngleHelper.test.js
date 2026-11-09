import test from 'node:test'
import assert from 'node:assert/strict'
import { aggregateMultiAngleScanResults } from '../src/business/multiAngleHelper.js'

test('aggregateMultiAngleScanResults menggabungkan deteksi Terung 4-kelas dari 2 sisi', () => {
  const scanFront = {
    scan_id: 'scan_001',
    commodity: 'Terung',
    inference_result: {
      object_counts: { extra_class: 4, class_1: 2, class_2: 0, reject: 0 },
      detections: [{ id: 1, class_name: 'Extra Class' }],
    },
    smart_pricing: { price_per_kg: 10000 },
  }

  // Sisi belakang ternyata mendeteksi 1 butir reject yang sebelumnya tersembunyi!
  const scanBack = {
    scan_id: 'scan_002',
    commodity: 'Terung',
    inference_result: {
      object_counts: { extra_class: 3, class_1: 2, class_2: 0, reject: 1 },
      detections: [{ id: 1, class_name: 'Reject' }],
    },
    smart_pricing: { price_per_kg: 10000 },
  }

  const result = aggregateMultiAngleScanResults(scanFront, scanBack, 15, 'Terung')

  assert.equal(result.is_multi_angle, true)
  assert.equal(result.angle_count, 2)
  // Rata-rata extra_class: (4 + 3)/2 = 4 (rounded)
  assert.equal(result.inference_result.object_counts.extra_class, 4)
  // Zero-defect escape principle: reject diambil nilai maksimum (1)
  assert.equal(result.inference_result.object_counts.reject, 1)
  assert.ok(result.inference_result.condition_ratios.reject_percent > 0)
  assert.equal(result.smart_pricing.inspection_mode, 'multi_angle_verified')
  assert.ok(result.smart_pricing.recommendation_note.includes('Inspeksi 2-Sisi'))
})

test('aggregateMultiAngleScanResults menggabungkan deteksi Tomat 2-kelas dari 2 sisi', () => {
  const scanFront = {
    scan_id: 'tomat_01',
    commodity: 'Tomat',
    inference_result: {
      object_counts: { fresh_tomato: 10, rotten_tomato: 0 },
      detections: [],
    },
  }

  const scanBack = {
    scan_id: 'tomat_02',
    commodity: 'Tomat',
    inference_result: {
      object_counts: { fresh_tomato: 8, rotten_tomato: 2 },
      detections: [],
    },
  }

  const result = aggregateMultiAngleScanResults(scanFront, scanBack, 10, 'Tomat')

  assert.equal(result.is_multi_angle, true)
  assert.equal(result.inference_result.object_counts.fresh_tomato, 9)
  assert.equal(result.inference_result.object_counts.rotten_tomato, 2)
  assert.ok(result.inference_result.condition_ratios.rotten_ratio_percent > 0)
})

test('aggregateMultiAngleScanResults fallback jika salah satu sudut null', () => {
  const scanFront = {
    scan_id: 'single_01',
    commodity: 'Terung',
    inference_result: { object_counts: { extra_class: 5 } },
  }

  const result = aggregateMultiAngleScanResults(scanFront, null, 10, 'Terung')
  assert.equal(result.is_multi_angle, false)
  assert.equal(result.angle_count, 1)

  assert.throws(() => aggregateMultiAngleScanResults(null, null))
})

test('aggregateMultiAngleScanResults menolak jika scanFront dan scanBack identik', () => {
  const scanFront = {
    scan_id: 'scan_001',
    commodity: 'Terung',
    inference_result: {
      object_counts: { extra_class: 4, class_1: 2, class_2: 0, reject: 0 },
      detections: [{ id: 1, class_name: 'Extra Class' }],
    },
    smart_pricing: { price_per_kg: 10000 },
  }

  assert.throws(
    () => aggregateMultiAngleScanResults(scanFront, scanFront, 15, 'Terung'),
    /identik|kembar/i
  )
})

