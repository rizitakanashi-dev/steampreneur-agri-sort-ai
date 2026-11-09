import test from 'node:test'
import assert from 'node:assert/strict'
import { buildCertificateData } from '../src/utils/qcCertificateHelper.js'
import { aggregateMultiAngleScanResults } from '../src/business/multiAngleHelper.js'

test('Scenario 8: QC Certificate untuk execution_status ai_detected', () => {
  const batch = {
    id: 'BATCH-AI-01',
    komoditas: 'Terung',
    beratKg: 10,
    execution_status: 'ai_detected',
    inference: {
      commodity: 'terung',
      object_counts: { total: 4, extra_class: 2, class_1: 2, class_2: 0, reject: 0 },
    },
    pricing: {
      reference_price_per_kg: 10000,
      estimated_economic_value: 107500,
    },
  }
  const cert = buildCertificateData(batch)
  assert.equal(cert.executionStatus, 'ai_detected')
  assert.ok(cert.modelEngineName.includes('Ultralytics YOLO11n'))
  assert.ok(cert.inspectionMethod.includes('Computer Vision AI'))
  assert.ok(cert.evaluator.includes('Agri-Sort AI'))
})

test('Scenario 8: QC Certificate untuk execution_status needs_review', () => {
  const batch = {
    id: 'BATCH-REV-01',
    komoditas: 'Terung',
    beratKg: 10,
    execution_status: 'needs_review',
    status_details: { code: 'IMAGE_BLURRY', message: 'Citra buram' },
    inference: {
      commodity: 'terung',
      object_counts: { total: 2, extra_class: 1, class_1: 1, class_2: 0, reject: 0 },
    },
  }
  const cert = buildCertificateData(batch)
  assert.equal(cert.executionStatus, 'needs_review')
  assert.ok(cert.modelEngineName.includes('Perlu Review'))
  assert.ok(cert.inspectionMethod.includes('Memerlukan Verifikasi Manual'))
  assert.ok(cert.evaluator.includes('Perlu Verifikasi'))
})

test('Scenario 8: QC Certificate untuk execution_status simulated', () => {
  const batch = {
    id: 'BATCH-SIM-01',
    komoditas: 'Tomat',
    beratKg: 15,
    execution_status: 'simulated',
    is_simulated: true,
  }
  const cert = buildCertificateData(batch)
  assert.equal(cert.executionStatus, 'simulated')
  assert.ok(cert.modelEngineName.includes('Simulator AI'))
  assert.ok(cert.inspectionMethod.includes('Simulasi Digital'))
  assert.ok(cert.evaluator.includes('Simulator'))
})

test('Scenario 8: QC Certificate untuk execution_status unsupported (Cabai Rawit Hijau)', () => {
  const batch = {
    id: 'BATCH-CABAI-01',
    komoditas: 'Cabai Rawit Hijau',
    beratKg: 20,
    execution_status: 'unsupported',
    hasil: { persenA: 80, persenB: 15, persenC: 5, beratA: 16, beratB: 3, beratC: 1 },
  }
  const cert = buildCertificateData(batch)
  assert.equal(cert.executionStatus, 'unsupported')
  assert.ok(cert.modelEngineName.includes('Model Belum Didukung'))
  assert.ok(cert.inspectionMethod.includes('Inspeksi Visual Manual'))
  assert.ok(!cert.modelEngineName.includes('YOLO11'))
})

test('Scenario 8: QC Certificate untuk execution_status model_unavailable', () => {
  const batch = {
    id: 'BATCH-ERR-01',
    komoditas: 'Tomat',
    beratKg: 5,
    execution_status: 'model_unavailable',
    status_details: { code: 'RUNTIME_UNAVAILABLE' },
  }
  const cert = buildCertificateData(batch)
  assert.equal(cert.executionStatus, 'model_unavailable')
  assert.ok(cert.modelEngineName.includes('Model AI Tidak Tersedia') || cert.modelEngineName.includes('Sistem Cadangan'))
  assert.ok(cert.inspectionMethod.includes('Cadangan Manual'))
  assert.ok(cert.evaluator.includes('Petugas Mutu Lapangan'))
  assert.ok(!cert.inspectionMethod.includes('Terverifikasi'))
})

test('Scenario 10: Multi-angle aggregation kombinasi unsupported', () => {
  const scanFront = {
    execution_status: 'unsupported',
    commodity: 'Cabai Rawit Hijau',
    inference_result: null,
  }
  const scanBack = {
    execution_status: 'unsupported',
    commodity: 'Cabai Rawit Hijau',
    inference_result: null,
  }
  const agg = aggregateMultiAngleScanResults(scanFront, scanBack, 10, 'Cabai Rawit Hijau')
  assert.equal(agg.execution_status, 'unsupported')
  assert.equal(agg.status_details.code, 'COMMODITY_UNSUPPORTED')
})

test('Scenario 10: Multi-angle aggregation satu sudut model_unavailable, satu sudut valid -> needs_review', () => {
  const scanFront = {
    execution_status: 'model_unavailable',
    commodity: 'Terung',
    inference_result: null,
  }
  const scanBack = {
    execution_status: 'ai_detected',
    commodity: 'Terung',
    inference_result: { object_counts: { extra_class: 2 } },
  }
  const agg = aggregateMultiAngleScanResults(scanFront, scanBack, 10, 'Terung')
  assert.equal(agg.execution_status, 'needs_review')
  assert.equal(agg.status_details.code, 'PARTIAL_ANGLE_INFERENCE')
})

test('Scenario 10: Multi-angle aggregation kedua sudut model_unavailable -> model_unavailable', () => {
  const scanFront = {
    execution_status: 'model_unavailable',
    commodity: 'Terung',
    inference_result: null,
  }
  const scanBack = {
    execution_status: 'model_unavailable',
    commodity: 'Terung',
    inference_result: null,
  }
  const agg = aggregateMultiAngleScanResults(scanFront, scanBack, 10, 'Terung')
  assert.equal(agg.execution_status, 'model_unavailable')
  assert.equal(agg.status_details.code, 'MODEL_UNAVAILABLE')
})

test('Scenario 10: Multi-angle aggregation kombinasi simulated', () => {
  const scanFront = {
    execution_status: 'simulated',
    commodity: 'Tomat',
    inference_result: { object_counts: { fresh_tomato: 5, rotten_tomato: 1 } },
  }
  const scanBack = {
    execution_status: 'ai_detected',
    commodity: 'Tomat',
    inference_result: { object_counts: { fresh_tomato: 4, rotten_tomato: 1 } },
  }
  const agg = aggregateMultiAngleScanResults(scanFront, scanBack, 10, 'Tomat')
  assert.equal(agg.execution_status, 'simulated')
  assert.equal(agg.status_details.code, 'EXPLICIT_SIMULATION')
})

test('Scenario 10: Multi-angle aggregation deteksi disparitas oklusi -> needs_review', () => {
  // Sisi depan: 0% reject (100% mulus)
  const scanFront = {
    execution_status: 'ai_detected',
    commodity: 'Terung',
    inference_result: {
      object_counts: { extra_class: 5, class_1: 5, class_2: 0, reject: 0 },
    },
  }
  // Sisi belakang: 50% reject (tersembunyi di belakang)
  const scanBack = {
    execution_status: 'ai_detected',
    commodity: 'Terung',
    inference_result: {
      object_counts: { extra_class: 2, class_1: 3, class_2: 0, reject: 5 },
    },
  }
  const agg = aggregateMultiAngleScanResults(scanFront, scanBack, 10, 'Terung')
  assert.equal(agg.execution_status, 'needs_review')
  assert.equal(agg.status_details.code, 'OCCLUSION_DISPARITY_DETECTED')
  assert.ok(agg.status_details.message.includes('+50%'))
})

test('Scenario 10: Multi-angle aggregation optimal -> ai_detected', () => {
  const scanFront = {
    execution_status: 'ai_detected',
    commodity: 'Terung',
    inference_result: {
      object_counts: { extra_class: 4, class_1: 4, class_2: 2, reject: 0 },
    },
  }
  const scanBack = {
    execution_status: 'ai_detected',
    commodity: 'Terung',
    inference_result: {
      object_counts: { extra_class: 4, class_1: 4, class_2: 2, reject: 0 },
    },
  }
  const agg = aggregateMultiAngleScanResults(scanFront, scanBack, 10, 'Terung')
  assert.equal(agg.execution_status, 'ai_detected')
  assert.equal(agg.status_details.code, 'MULTI_ANGLE_OPTIMAL')
})
