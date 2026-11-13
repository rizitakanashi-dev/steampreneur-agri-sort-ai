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

test('aggregateMultiAngleScanResults menggabungkan deteksi Terung 3-grade v2 dari 2 sisi', () => {
  const scanFront = {
    scan_id: 'scan_v2_001',
    commodity: 'Terung',
    inference_result: {
      object_counts: { grade_a: 6, grade_b: 2, reject: 0 },
      detections: [{ id: 1, class_name: 'Grade A' }],
    },
    smart_pricing: { price_per_kg: 12000 },
  }

  const scanBack = {
    scan_id: 'scan_v2_002',
    commodity: 'Terung',
    inference_result: {
      object_counts: { grade_a: 4, grade_b: 2, reject: 1 },
      detections: [{ id: 1, class_name: 'Reject' }],
    },
    smart_pricing: { price_per_kg: 12000 },
  }

  const result = aggregateMultiAngleScanResults(scanFront, scanBack, 20, 'Terung')

  assert.equal(result.is_multi_angle, true)
  assert.equal(result.angle_count, 2)
  // Rata-rata Grade A: (6 + 4)/2 = 5
  assert.equal(result.inference_result.object_counts.grade_a, 5)
  // Rata-rata Grade B: (2 + 2)/2 = 2
  assert.equal(result.inference_result.object_counts.grade_b, 2)
  // Zero-defect escape: reject = max(0, 1) = 1
  assert.equal(result.inference_result.object_counts.reject, 1)

  // Total samples = 5 + 2 + 1 = 8
  // Grade A = 5/8 * 100 = 62.5%
  // Grade B = 2/8 * 100 = 25.0%
  // Reject = 1/8 * 100 = 12.5%
  assert.equal(result.inference_result.condition_ratios.grade_a_percent, 62.5)
  assert.equal(result.inference_result.condition_ratios.grade_b_percent, 25.0)
  assert.equal(result.inference_result.condition_ratios.reject_percent, 12.5)

  // Bisnis grading dan bobot
  assert.equal(result.business_grading.grade_percentages.gradeA, 62.5)
  assert.equal(result.business_grading.grade_percentages.gradeB, 25.0)
  assert.equal(result.business_grading.grade_percentages.reject, 12.5)
  assert.equal(result.business_grading.weights.gradeA, 12.5) // 20 * 62.5% = 12.5 kg
  assert.equal(result.business_grading.weights.gradeB, 5.0)  // 20 * 25.0% = 5.0 kg
  assert.equal(result.business_grading.weights.reject, 2.5)  // 20 * 12.5% = 2.5 kg
})

test('aggregateMultiAngleScanResults menggabungkan deteksi Tomat 3-kelas dari 2 sisi', () => {
  const scanFront = {
    scan_id: 'tomat_3c_01',
    commodity: 'Tomat',
    inference_result: {
      object_counts: { grade_a: 8, grade_b: 2, reject: 0 },
      detections: [{ id: 1, class_name: 'Grade A' }],
    },
    smart_pricing: { reference_price_per_kg: 12000 },
  }

  const scanBack = {
    scan_id: 'tomat_3c_02',
    commodity: 'Tomat',
    inference_result: {
      object_counts: { grade_a: 4, grade_b: 2, reject: 2 },
      detections: [{ id: 1, class_name: 'Reject' }],
    },
    smart_pricing: { reference_price_per_kg: 12000 },
  }

  const result = aggregateMultiAngleScanResults(scanFront, scanBack, 10, 'Tomat')

  assert.equal(result.is_multi_angle, true)
  assert.equal(result.inference_result.object_counts.grade_a, 6)
  assert.equal(result.inference_result.object_counts.grade_b, 2)
  assert.equal(result.inference_result.object_counts.reject, 2)
  assert.equal(result.inference_result.condition_ratios.grade_a_percent, 60.0)
  assert.equal(result.inference_result.condition_ratios.grade_b_percent, 20.0)
  assert.equal(result.inference_result.condition_ratios.reject_percent, 20.0)
  assert.equal(result.business_grading.weights.gradeA, 6.0)
  assert.equal(result.business_grading.weights.gradeB, 2.0)
  assert.equal(result.business_grading.weights.reject, 2.0)
})

