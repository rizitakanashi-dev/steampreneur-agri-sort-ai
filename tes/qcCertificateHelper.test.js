import test from 'node:test'
import assert from 'node:assert/strict'
import {
  buildCertificateData,
  formatCertificateDate,
  formatRegistrationId,
  INSTITUTION_INFO,
} from '../src/utils/qcCertificateHelper.js'

test('formatRegistrationId menghasilkan ID standar registrasi QC', () => {
  assert.equal(formatRegistrationId('BATCH-001'), 'QC-2026-BATCH-001')
  assert.equal(formatRegistrationId('QC-2026-999'), 'QC-2026-999')
  assert.equal(formatRegistrationId('test@123'), 'QC-2026-TEST123')
  assert.equal(formatRegistrationId(null), 'QC-2026-UNKNOWN')
  assert.equal(formatRegistrationId(''), 'QC-2026-UNKNOWN')
})

test('formatCertificateDate memformat tanggal ke bahasa Indonesia secara aman', () => {
  assert.equal(formatCertificateDate('2026-11-08'), '8 November 2026')
  assert.equal(formatCertificateDate('2026-05-17'), '17 Mei 2026')
  assert.equal(formatCertificateDate('2026-11-07T18:54:30.000Z'), '8 November 2026')
  assert.equal(formatCertificateDate(null), '-')
  assert.equal(formatCertificateDate(undefined), '-')
})

test('buildCertificateData menangani batch kosong tanpa melempar exception', () => {
  const data = buildCertificateData(null)
  assert.ok(data)
  assert.equal(data.commodity, 'Hortikultura')
  assert.equal(data.totalWeightKg, 0)
  assert.equal(data.financials.totalRevenue, 0)
  assert.equal(data.institution.schoolName, 'SMK NEGERI 4 PAYAKUMBUH')
})

test('buildCertificateData memproses batch Terung 4-Class dengan akurat', () => {
  const terungBatch = {
    id: 'TRG-2026-01',
    tanggal: '2026-11-08',
    komoditas: 'Terung',
    beratKg: 100,
    inference: {
      commodity: 'terung',
      condition_ratios: {
        extra_class_ratio_percent: 40.0,
        class_1_ratio_percent: 30.0,
        class_2_ratio_percent: 20.0,
        reject_ratio_percent: 10.0,
      },
    },
    pricing: {
      reference_price_per_kg: 10000,
      estimated_economic_value: 920000,
      potential_loss_value: 100000,
      region: 'Payakumbuh',
      tier_breakdown: {
        extra_class: { weight_kg: 40, subtotal_value: 460000 },
        class_1: { weight_kg: 30, subtotal_value: 300000 },
        class_2: { weight_kg: 20, subtotal_value: 160000 },
        reject: { weight_kg: 10, subtotal_value: 0 },
      },
    },
  }

  const cert = buildCertificateData(terungBatch)
  assert.equal(cert.registrationId, 'QC-2026-TRG-2026-01')
  assert.equal(cert.commodity, 'Terung')
  assert.equal(cert.totalWeightKg, 100)
  assert.equal(cert.grades.length, 4)

  const extra = cert.grades.find((g) => g.code === 'EXTRA')
  assert.equal(extra.ratioPercent, 40)
  assert.equal(extra.weightKg, 40)
  assert.equal(extra.pricePerKg, 11500)
  assert.equal(extra.subtotalRp, 460000)

  const c1 = cert.grades.find((g) => g.code === 'CLASS-1')
  assert.equal(c1.ratioPercent, 30)
  assert.equal(c1.pricePerKg, 10000)

  const c2 = cert.grades.find((g) => g.code === 'CLASS-2')
  assert.equal(c2.ratioPercent, 20)
  assert.equal(c2.pricePerKg, 8000)

  const rej = cert.grades.find((g) => g.code === 'REJECT')
  assert.equal(rej.ratioPercent, 10)
  assert.equal(rej.pricePerKg, 0)
  assert.equal(rej.subtotalRp, 0)

  assert.equal(cert.financials.totalRevenue, 920000)
  assert.equal(cert.financials.potentialLoss, 100000)
})

test('buildCertificateData memproses batch Terung 4-Class dari respon riil backend tanpa tier_breakdown', () => {
  const realBackendBatch = {
    id: 'SCAN-TRG-001',
    tanggal: '2026-11-08',
    komoditas: 'Terung',
    beratKg: 10,
    inference: {
      commodity: 'terung',
      object_counts: { total: 4, extra_class: 1, class_1: 2, class_2: 1, reject: 0 },
      condition_ratios: {
        extra_class_percent: 25.0,
        class_1_percent: 50.0,
        class_2_percent: 25.0,
        reject_percent: 0.0,
        marketable_percent: 100.0,
      },
    },
    pricing: {
      reference_price_per_kg: 10000,
      estimated_economic_value: 98750,
      potential_loss_value: 0,
      condition_ratios: {
        extra_class_percent: 25.0,
        class_1_percent: 50.0,
        class_2_percent: 25.0,
        reject_percent: 0.0,
      },
    },
  }

  const cert = buildCertificateData(realBackendBatch)
  assert.equal(cert.modelEngineName, 'Ultralytics YOLO11n (4-Class Commercial Quality)')
  assert.ok(cert.inspectionMethod.includes('YOLO11n'))
  assert.equal(cert.grades.length, 4)

  const extra = cert.grades.find((g) => g.code === 'EXTRA')
  assert.equal(extra.ratioPercent, 25.0)
  assert.equal(extra.weightKg, 2.5)
  assert.equal(extra.subtotalRp, 28750)

  const c1 = cert.grades.find((g) => g.code === 'CLASS-1')
  assert.equal(c1.ratioPercent, 50.0)
  assert.equal(c1.weightKg, 5.0)
  assert.equal(c1.subtotalRp, 50000)

  const c2 = cert.grades.find((g) => g.code === 'CLASS-2')
  assert.equal(c2.ratioPercent, 25.0)
  assert.equal(c2.weightKg, 2.5)
  assert.equal(c2.subtotalRp, 20000)
})

test('buildCertificateData memproses batch Tomat AI scan dengan akurat', () => {
  const tomatBatch = {
    id: 'TMT-009',
    tanggal: '2026-11-08',
    komoditas: 'Tomat',
    beratKg: 50,
    inference: {
      commodity: 'tomat',
      condition_ratios: {
        fresh_ratio_percent: 80.0,
        rotten_ratio_percent: 20.0,
      },
    },
    pricing: {
      reference_price_per_kg: 12000,
      estimated_economic_value: 480000,
      potential_loss_value: 120000,
    },
  }

  const cert = buildCertificateData(tomatBatch)
  assert.equal(cert.grades.length, 2)
  assert.equal(cert.grades[0].code, 'FRESH')
  assert.equal(cert.grades[0].weightKg, 40)
  assert.equal(cert.grades[1].code, 'ROTTEN')
  assert.equal(cert.grades[1].weightKg, 10)
  assert.equal(cert.financials.totalRevenue, 480000)
})

test('buildCertificateData memproses batch Cabai 3-Class AI scan dengan akurat', () => {
  const cabaiBatch = {
    id: 'CBI-001',
    tanggal: '2026-11-11',
    komoditas: 'Cabai',
    beratKg: 10,
    inference: {
      commodity: 'cabai',
      object_counts: { grade_a: 7, grade_b: 2, reject: 1 },
      condition_ratios: {
        grade_a_percent: 70.0,
        grade_b_percent: 20.0,
        reject_percent: 10.0,
      },
    },
    pricing: {
      reference_price_per_kg: 45000,
      estimated_economic_value: 434250,
      potential_loss_value: 45000,
      tier_breakdown: {
        grade_a: { ratio_percent: 70.0, weight_kg: 7.0, price_per_kg: 51750, subtotal_value: 362250 },
        grade_b: { ratio_percent: 20.0, weight_kg: 2.0, price_per_kg: 36000, subtotal_value: 72000 },
        reject: { ratio_percent: 10.0, weight_kg: 1.0, price_per_kg: 0, subtotal_value: 0 },
      },
    },
  }

  const cert = buildCertificateData(cabaiBatch)
  assert.equal(cert.modelEngineName, 'Ultralytics YOLO11n (3-Class Chili Quality)')
  assert.equal(cert.grades.length, 3)
  assert.equal(cert.grades[0].code, 'GRADE-A')
  assert.equal(cert.grades[0].ratioPercent, 70.0)
  assert.equal(cert.grades[0].weightKg, 7.0)
  assert.equal(cert.grades[1].code, 'GRADE-B')
  assert.equal(cert.grades[1].ratioPercent, 20.0)
  assert.equal(cert.grades[1].weightKg, 2.0)
  assert.equal(cert.grades[2].code, 'REJECT')
  assert.equal(cert.grades[2].ratioPercent, 10.0)
  assert.equal(cert.grades[2].weightKg, 1.0)
})

test('buildCertificateData memproses batch Manual Calculation dengan akurat', () => {
  const manualBatch = {
    id: 'MNL-001',
    tanggal: '2026-11-08',
    komoditas: 'Tomat',
    beratKg: 100,
    hasil: {
      persenA: 60,
      beratA: 60,
      nilaiA: 792000,
      persenB: 30,
      beratB: 30,
      nilaiB: 324000,
      persenC: 10,
      beratC: 10,
      nilaiC: 0,
      totalNilai: 1116000,
    },
  }

  const cert = buildCertificateData(manualBatch)
  assert.equal(cert.grades.length, 3)
  assert.equal(cert.grades[0].code, 'GRADE-A')
  assert.equal(cert.grades[0].ratioPercent, 60)
  assert.equal(cert.financials.totalRevenue, 1116000)
})

test('buildCertificateData menangani edge-cases seperti berat invalid dan format tanggal aneh', () => {
  const edgeBatch = {
    id: 'EDGE-999',
    tanggal: 'invalid-date-string',
    komoditas: 'Cabai Rawit Merah',
    beratKg: 'bukan-angka',
    pricing: null,
    hasil: null,
    inference: null,
  }

  const cert = buildCertificateData(edgeBatch)
  assert.equal(cert.totalWeightKg, 0)
  assert.equal(cert.commodity, 'Cabai Rawit Merah')
  assert.equal(cert.referencePricePerKg, 42000) // dari priceReference.js
  assert.equal(cert.grades.length, 1)
  assert.equal(cert.grades[0].code, 'STANDAR')
  assert.equal(cert.financials.totalRevenue, 0)
})

test('formatCertificateDate menangani string tanggal tidak valid dengan aman', () => {
  assert.equal(formatCertificateDate('bukan-tanggal'), 'bukan-tanggal')
  assert.equal(formatCertificateDate(''), '-')
})
