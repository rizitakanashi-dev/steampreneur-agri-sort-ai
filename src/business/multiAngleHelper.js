/**
 * Modul Pembantu Inspeksi Multi-Sudut (Multi-Angle Quality Inspection)
 * Tanggung Jawab: Fullstack Developer (Anti-Fraud & Quality Assurance)
 * Dokumen Acuan: Proposal STEAMPreneur SMK 2026 (Bab 3.2 & 5.2) & AUDIT-AGRI-SORT-AI
 *
 * Menggabungkan hasil inferensi dari dua sudut pandang (Sisi Depan & Sisi Belakang / Goyang Nampan)
 * untuk mengeliminasi bias cacat tersembunyi (Single-View Occlusion Bias).
 */

import { calculateGradeWeights, roundRupiah } from './harvestCalculation.js'

/**
 * Menggabungkan hasil inferensi AI dari Foto Sisi 1 (Depan) dan Foto Sisi 2 (Belakang).
 *
 * @param {Object} scanFront - Respons inferensi AI untuk Sisi Depan
 * @param {Object} scanBack - Respons inferensi AI untuk Sisi Belakang
 * @param {number|string} weightKg - Bobot aktual timbangan (kg)
 * @param {string} commodity - Nama komoditas ('Terung' | 'Tomat' | 'Cabai')
 * @returns {Object} Hasil inferensi gabungan (Agregated Multi-Angle Scan Result)
 */
export function aggregateMultiAngleScanResults(scanFront, scanBack, weightKg = 10, commodity = 'Terung') {
  if (!scanFront && !scanBack) {
    throw new Error('Minimal satu hasil pemindaian sudut diperlukan untuk agregasi.')
  }

  // Jika hanya satu sisi yang tersedia, gunakan sisi tersebut sebagai basis
  if (!scanBack) return { ...scanFront, is_multi_angle: false, angle_count: 1 }
  if (!scanFront) return { ...scanBack, is_multi_angle: false, angle_count: 1 }

  // Deteksi foto / hasil inferensi identik (Pencegahan Kecurangan Berkas Kembar)
  if (scanFront === scanBack || (scanFront.scan_id && scanFront.scan_id === scanBack.scan_id)) {
    throw new Error('Berkas foto Sisi 1 dan Sisi 2 identik (file kembar terdeteksi). Harap gunakan foto berbeda setelah nampan digoyang!')
  }

  const infFront = scanFront.inference_result || {}
  const infBack = scanBack.inference_result || {}

  const countsFront = infFront.object_counts || {}
  const countsBack = infBack.object_counts || {}

  const isEggplant = String(commodity).toLowerCase().includes('terung') || String(commodity).toLowerCase().includes('terong')

  let aggregatedCounts = {}
  let conditionRatios = {}
  let gradePercentages = { gradeA: 0, gradeB: 0, reject: 0 }

  if (isEggplant) {
    // Ambil rata-rata jumlah deteksi per kelas dari kedua sudut
    const extraClassAvg = Math.round(((countsFront.extra_class || 0) + (countsBack.extra_class || 0)) / 2)
    const class1Avg = Math.round(((countsFront.class_1 || 0) + (countsBack.class_1 || 0)) / 2)
    const class2Avg = Math.round(((countsFront.class_2 || 0) + (countsBack.class_2 || 0)) / 2)

    // Prinsip Zero-Defect Escape: Reject diambil dari nilai maksimal di antara kedua sisi
    const rejectCount = Math.max(countsFront.reject || 0, countsBack.reject || 0)

    aggregatedCounts = {
      extra_class: extraClassAvg,
      class_1: class1Avg,
      class_2: class2Avg,
      reject: rejectCount,
    }

    const totalSamples = Math.max(1, extraClassAvg + class1Avg + class2Avg + rejectCount)
    const pExtra = Number(((extraClassAvg / totalSamples) * 100).toFixed(2))
    const pClass1 = Number(((class1Avg / totalSamples) * 100).toFixed(2))
    const pClass2 = Number(((class2Avg / totalSamples) * 100).toFixed(2))
    const pReject = Number(((rejectCount / totalSamples) * 100).toFixed(2))

    conditionRatios = {
      extra_class_percent: pExtra,
      class_1_percent: pClass1,
      class_2_percent: pClass2,
      reject_percent: pReject,
    }

    // Pemetaan komersial: Extra Class + Class 1 -> Grade A, Class 2 -> Grade B, Reject -> Reject
    const rawGradeA = pExtra + pClass1
    const rawGradeB = pClass2
    const rawReject = pReject
    const sum = rawGradeA + rawGradeB + rawReject || 100

    gradePercentages = {
      gradeA: Number(((rawGradeA / sum) * 100).toFixed(2)),
      gradeB: Number(((rawGradeB / sum) * 100).toFixed(2)),
      reject: Number(((rawReject / sum) * 100).toFixed(2)),
    }
  } else {
    // Komoditas Tomat (2-Kelas: fresh vs rotten)
    const freshAvg = Math.round(((countsFront.fresh_tomato || 0) + (countsBack.fresh_tomato || 0)) / 2)
    const rottenCount = Math.max(countsFront.rotten_tomato || 0, countsBack.rotten_tomato || 0)

    aggregatedCounts = {
      fresh_tomato: freshAvg,
      rotten_tomato: rottenCount,
    }

    const totalSamples = Math.max(1, freshAvg + rottenCount)
    const pFresh = Number(((freshAvg / totalSamples) * 100).toFixed(2))
    const pRotten = Number(((rottenCount / totalSamples) * 100).toFixed(2))

    conditionRatios = {
      fresh_ratio_percent: pFresh,
      rotten_ratio_percent: pRotten,
    }

    gradePercentages = {
      gradeA: pFresh,
      gradeB: 0,
      reject: pRotten,
    }
  }

  // Gabungkan seluruh kotak deteksi (detections) dari kedua gambar dengan penanda sisi
  const detectionsFront = (infFront.detections || []).map((d) => ({ ...d, angle_source: 'front' }))
  const detectionsBack = (infBack.detections || []).map((d) => ({
    ...d,
    id: (d.id || 0) + 1000,
    angle_source: 'back',
  }))

  const allDetections = [...detectionsFront, ...detectionsBack]

  // Hitung bobot per grade
  const numWeight = Number(weightKg) || 10
  let weights = { gradeA: 0, gradeB: 0, reject: 0 }
  try {
    weights = calculateGradeWeights(numWeight, gradePercentages)
  } catch {
    weights = {
      gradeA: (numWeight * gradePercentages.gradeA) / 100,
      gradeB: (numWeight * gradePercentages.gradeB) / 100,
      reject: (numWeight * gradePercentages.reject) / 100,
    }
  }

  // Gunakan rekomendasi pricing dari sisi yang paling akurat
  const basePricing = scanFront.smart_pricing || scanBack.smart_pricing || {}

  const updatedPricing = {
    ...basePricing,
    condition_ratios: conditionRatios,
    inspection_mode: 'multi_angle_verified',
    recommendation_note:
      (conditionRatios.reject_percent || conditionRatios.rotten_ratio_percent || 0) > 0
        ? 'Inspeksi 2-Sisi terverifikasi: Terdeteksi buah cacat pada salah satu sudut pandang. Pisahkan sebelum pengiriman.'
        : 'Inspeksi 2-Sisi terverifikasi: Kedua sisi sampel bebas cacat (Mutu Terkonfirmasi Prima).',
  }

  return {
    scan_id: `multi_${scanFront.scan_id || Date.now()}`,
    commodity,
    is_multi_angle: true,
    angle_count: 2,
    timestamp: new Date().toISOString(),
    inference_result: {
      ...infFront,
      object_counts: aggregatedCounts,
      condition_ratios: conditionRatios,
      detections: allDetections,
    },
    smart_pricing: updatedPricing,
    business_grading: {
      commodity,
      weight_kg: numWeight,
      grade_percentages: gradePercentages,
      weights,
    },
    raw_front: scanFront,
    raw_back: scanBack,
  }
}
