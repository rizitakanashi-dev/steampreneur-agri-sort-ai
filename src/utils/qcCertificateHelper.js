import { getReferencePricePerKg } from '../business/priceReference.js'

export const INSTITUTION_INFO = Object.freeze({
  schoolName: 'SMK NEGERI 4 PAYAKUMBUH',
  subTitle: 'Pusat Keunggulan Agribisnis & Rekayasa Perangkat Lunak',
  programName: 'Sayembara STEAMPreneur SMK Tingkat Nasional 2026',
  teamName: 'Tim Agri-Sort AI (SMKN 4 Payakumbuh)',
  address: 'Jl. Koto Kaciak, Kec. Payakumbuh Utara, Kota Payakumbuh, Sumatera Barat 26219',
  contact: 'smkn4payakumbuh.sch.id | agrisort@smkn4payakumbuh.sch.id',
  qcLaboratory: 'Laboratorium Uji Mutu & Komputasi Cerdas Hortikultura',
})

/**
 * Format tanggal ke format bahasa Indonesia.
 * @param {string|Date} dateVal
 * @returns {string}
 */
export function formatCertificateDate(dateVal) {
  if (!dateVal) return '-'
  try {
    const str = String(dateVal).trim()
    const months = [
      'Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni',
      'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'
    ]

    // Jika format tanggal murni YYYY-MM-DD (tanpa waktu), parse langsung agar tidak tergeser oleh UTC timezone
    const isoDateOnly = str.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/)
    if (isoDateOnly) {
      const year = isoDateOnly[1]
      const mIdx = parseInt(isoDateOnly[2], 10) - 1
      const day = parseInt(isoDateOnly[3], 10)
      if (mIdx >= 0 && mIdx < 12) {
        return `${day} ${months[mIdx]} ${year}`
      }
    }

    const d = new Date(dateVal)
    if (!Number.isNaN(d.getTime())) {
      return new Intl.DateTimeFormat('id-ID', {
        day: 'numeric',
        month: 'long',
        year: 'numeric',
        timeZone: 'Asia/Jakarta',
      }).format(d)
    }
    return str
  } catch {
    return String(dateVal)
  }
}

/**
 * Format ID registrasi sertifikat resmi.
 * @param {string|number} batchId
 * @returns {string}
 */
export function formatRegistrationId(batchId) {
  if (!batchId) return 'QC-2026-UNKNOWN'
  const cleanId = String(batchId).replace(/[^a-zA-Z0-9-]/g, '').toUpperCase()
  return cleanId.startsWith('QC-') ? cleanId : `QC-2026-${cleanId}`
}

/**
 * Menghasilkan data struktur sertifikat yang siap dirender atau dicetak.
 * Tahan banting terhadap null/undefined/angka tak tentu.
 * @param {object} batch
 * @returns {object}
 */
export function buildCertificateData(batch = {}) {
  const safeBatch = batch || {}
  const commodity = safeBatch.komoditas || 'Hortikultura'
  const isEggplant =
    commodity.toLowerCase().includes('terung') ||
    commodity.toLowerCase().includes('terong') ||
    commodity.toLowerCase().includes('eggplant') ||
    safeBatch.inference?.commodity === 'terung' ||
    safeBatch.scanResult?.commodity === 'Terung'

  const isMultiAngle = Boolean(
    safeBatch.is_multi_angle ||
    safeBatch.scanResult?.is_multi_angle ||
    safeBatch.scanResult?.inspection_mode?.includes('multi')
  )

  const hasInference = Boolean(
    safeBatch.inference ||
    safeBatch.ai_scan_performed ||
    safeBatch.scanResult
  )

  const rawWeight = Number(safeBatch.beratKg ?? safeBatch.volume_kg ?? safeBatch.actual_weight_kg)
  const totalWeightKg = Number.isFinite(rawWeight) && rawWeight > 0 ? rawWeight : 0

  const refPrice =
    Number(safeBatch.pricing?.reference_price_per_kg) ||
    Number(safeBatch.scanResult?.smart_pricing?.reference_price_per_kg) ||
    getReferencePricePerKg(commodity) ||
    (isEggplant ? 10000 : 12000)

  const pricing = safeBatch.pricing || safeBatch.scanResult?.smart_pricing || {}
  const inference = safeBatch.inference || safeBatch.scanResult?.inference_result || {}
  const ratios =
    pricing.condition_ratios ||
    inference.condition_ratios ||
    safeBatch.condition_ratios ||
    {}
  const counts = inference.object_counts || {}
  const tier = pricing.tier_breakdown || {}

  let grades = []

  const hasTerung3Grade =
    isEggplant &&
    ((counts.grade_a !== undefined || counts.grade_b !== undefined) &&
      !counts.class_1 &&
      !counts.extra_class)

  const hasTerungData =
    isEggplant &&
    (tier.extra_class ||
      ratios.extra_class_percent !== undefined ||
      ratios.extra_class_ratio_percent !== undefined ||
      counts.extra_class !== undefined ||
      hasInference)

  if (hasTerung3Grade) {
    // 3-Grade Terung Commercial Grading (YOLO11n v2: Grade A, Grade B, Reject)
    const totalCount =
      Number(counts.total) ||
      ((Number(counts.grade_a) || 0) +
        (Number(counts.grade_b) || 0) +
        (Number(counts.reject) || 0)) ||
      1

    const gradeARatio = Number(
      ratios.grade_a_percent ??
      ratios.grade_a_ratio_percent ??
      (tier.grade_a?.weight_kg ? (tier.grade_a.weight_kg / (totalWeightKg || 1)) * 100 : 0) ??
      (counts.grade_a !== undefined ? (Number(counts.grade_a) / totalCount) * 100 : 0)
    )
    const gradeBRatio = Number(
      ratios.grade_b_percent ??
      ratios.grade_b_ratio_percent ??
      (tier.grade_b?.weight_kg ? (tier.grade_b.weight_kg / (totalWeightKg || 1)) * 100 : 0) ??
      (counts.grade_b !== undefined ? (Number(counts.grade_b) / totalCount) * 100 : 0)
    )
    const rejRatio = Number(
      ratios.reject_percent ??
      ratios.reject_ratio_percent ??
      (tier.reject?.weight_kg ? (tier.reject.weight_kg / (totalWeightKg || 1)) * 100 : 0) ??
      (counts.reject !== undefined ? (Number(counts.reject) / totalCount) * 100 : 0)
    )

    const gradeAWeight = Number(tier.grade_a?.weight_kg ?? (totalWeightKg * (gradeARatio / 100)))
    const gradeBWeight = Number(tier.grade_b?.weight_kg ?? (totalWeightKg * (gradeBRatio / 100)))
    const rejWeight = Number(tier.reject?.weight_kg ?? (totalWeightKg * (rejRatio / 100)))

    const gradeAPrice = Math.round(refPrice * 1.15)
    const gradeBPrice = Math.round(refPrice * 0.80)
    const rejPrice = 0

    grades = [
      {
        code: 'GRADE-A',
        label: 'Grade A (Mutu Prima)',
        desc: 'Bentuk proporsional lurus, warna ungu mengkilap, segar tanpa cacat fisik',
        ratioPercent: gradeARatio,
        weightKg: Number(gradeAWeight.toFixed(2)),
        pricePerKg: gradeAPrice,
        subtotalRp: Number(tier.grade_a?.subtotal_value ?? Math.round(gradeAWeight * gradeAPrice)),
        status: 'Supermarket Modern & Horeka',
      },
      {
        code: 'GRADE-B',
        label: 'Grade B (Mutu Pasar)',
        desc: 'Kelengkungan wajar <15%, warna cerah, sedikit goresan mikro superfisial',
        ratioPercent: gradeBRatio,
        weightKg: Number(gradeBWeight.toFixed(2)),
        pricePerKg: gradeBPrice,
        subtotalRp: Number(tier.grade_b?.subtotal_value ?? Math.round(gradeBWeight * gradeBPrice)),
        status: 'Pasar Tradisional & Grosir',
      },
      {
        code: 'REJECT',
        label: 'Reject (Afkir / Rusak)',
        desc: 'Busuk basah, lubang hama/ulat, busuk tangkai lunak',
        ratioPercent: rejRatio,
        weightKg: Number(rejWeight.toFixed(2)),
        pricePerKg: rejPrice,
        subtotalRp: 0,
        status: 'Pakan Ternak / Kompos Organik',
      },
    ]
  } else if (hasTerungData) {
    // 4-Class Terung Grading (YOLO11n 4-Kelas Komersial)
    const totalCount =
      Number(counts.total) ||
      ((Number(counts.extra_class) || 0) +
        (Number(counts.class_1) || 0) +
        (Number(counts.class_2) || 0) +
        (Number(counts.reject) || 0)) ||
      1

    const extraRatio = Number(
      ratios.extra_class_percent ??
      ratios.extra_class_ratio_percent ??
      (tier.extra_class?.weight_kg ? (tier.extra_class.weight_kg / (totalWeightKg || 1)) * 100 : 0) ??
      (counts.extra_class !== undefined ? (Number(counts.extra_class) / totalCount) * 100 : 0)
    )
    const c1Ratio = Number(
      ratios.class_1_percent ??
      ratios.class_1_ratio_percent ??
      (tier.class_1?.weight_kg ? (tier.class_1.weight_kg / (totalWeightKg || 1)) * 100 : 0) ??
      (counts.class_1 !== undefined ? (Number(counts.class_1) / totalCount) * 100 : 0)
    )
    const c2Ratio = Number(
      ratios.class_2_percent ??
      ratios.class_2_ratio_percent ??
      (tier.class_2?.weight_kg ? (tier.class_2.weight_kg / (totalWeightKg || 1)) * 100 : 0) ??
      (counts.class_2 !== undefined ? (Number(counts.class_2) / totalCount) * 100 : 0)
    )
    const rejRatio = Number(
      ratios.reject_percent ??
      ratios.reject_ratio_percent ??
      (tier.reject?.weight_kg ? (tier.reject.weight_kg / (totalWeightKg || 1)) * 100 : 0) ??
      (counts.reject !== undefined ? (Number(counts.reject) / totalCount) * 100 : 0)
    )

    const extraWeight = Number(tier.extra_class?.weight_kg ?? (totalWeightKg * (extraRatio / 100)))
    const c1Weight = Number(tier.class_1?.weight_kg ?? (totalWeightKg * (c1Ratio / 100)))
    const c2Weight = Number(tier.class_2?.weight_kg ?? (totalWeightKg * (c2Ratio / 100)))
    const rejWeight = Number(tier.reject?.weight_kg ?? (totalWeightKg * (rejRatio / 100)))

    const extraPrice = Math.round(refPrice * 1.15)
    const c1Price = Math.round(refPrice * 1.00)
    const c2Price = Math.round(refPrice * 0.80)
    const rejPrice = 0

    grades = [
      {
        code: 'EXTRA',
        label: 'Extra Class (Mutu Super)',
        desc: 'Bentuk lurus mulus, warna ungu pekat mengkilap, tanpa cacat fisik',
        ratioPercent: extraRatio,
        weightKg: Number(extraWeight.toFixed(2)),
        pricePerKg: extraPrice,
        subtotalRp: Number(tier.extra_class?.subtotal_value ?? Math.round(extraWeight * extraPrice)),
        status: 'Premium Export & Supermarket',
      },
      {
        code: 'CLASS-1',
        label: 'Class 1 (Mutu Standar Pasar)',
        desc: 'Kelengkungan wajar <10%, warna cerah merata, segar optimal',
        ratioPercent: c1Ratio,
        weightKg: Number(c1Weight.toFixed(2)),
        pricePerKg: c1Price,
        subtotalRp: Number(tier.class_1?.subtotal_value ?? Math.round(c1Weight * c1Price)),
        status: 'Pasar Modern & Horeka',
      },
      {
        code: 'CLASS-2',
        label: 'Class 2 (Mutu Olahan / Tradisional)',
        desc: 'Sedikit bercak daun/goresan mikro superfisial, daging buah padat',
        ratioPercent: c2Ratio,
        weightKg: Number(c2Weight.toFixed(2)),
        pricePerKg: c2Price,
        subtotalRp: Number(tier.class_2?.subtotal_value ?? Math.round(c2Weight * c2Price)),
        status: 'Pasar Lokal & Industri Olahan',
      },
      {
        code: 'REJECT',
        label: 'Reject (Afkir / Rusak)',
        desc: 'Busuk basah, lubang ulat/hama, busuk tangkai lunak',
        ratioPercent: rejRatio,
        weightKg: Number(rejWeight.toFixed(2)),
        pricePerKg: rejPrice,
        subtotalRp: 0,
        status: 'Pakan Ternak / Kompos Organik',
      },
    ]
  } else if (hasInference && (ratios.fresh_ratio_percent !== undefined || ratios.fresh_percent !== undefined || counts.fresh_tomato !== undefined)) {
    // Tomat 2-Class AI Scan
    const freshCount = Number(counts.fresh_tomato ?? counts.fresh ?? 0)
    const rottenCount = Number(counts.rotten_tomato ?? counts.rotten ?? 0)
    const totalTomato = Number(counts.total) || (freshCount + rottenCount) || 1

    const freshRatio = Number(
      ratios.fresh_ratio_percent ??
      ratios.fresh_percent ??
      (counts.fresh_tomato !== undefined ? (freshCount / totalTomato) * 100 : 0)
    )
    const rottenRatio = Number(
      ratios.rotten_ratio_percent ??
      ratios.rotten_percent ??
      (counts.rotten_tomato !== undefined ? (rottenCount / totalTomato) * 100 : 0)
    )

    const freshWeight = Number((totalWeightKg * (freshRatio / 100)).toFixed(2))
    const rottenWeight = Number((totalWeightKg * (rottenRatio / 100)).toFixed(2))

    grades = [
      {
        code: 'FRESH',
        label: 'Segar (Mutu Komersial)',
        desc: 'Tomat utuh, kulit kencang, segar, siap konsumsi & pasok',
        ratioPercent: freshRatio,
        weightKg: freshWeight,
        pricePerKg: refPrice,
        subtotalRp: Math.round(freshWeight * refPrice),
        status: 'Layak Jual & Konsumsi',
      },
      {
        code: 'ROTTEN',
        label: 'Afkir / Busuk',
        desc: 'Gejala pembusukan, infeksi jamur, atau cacat parah',
        ratioPercent: rottenRatio,
        weightKg: rottenWeight,
        pricePerKg: 0,
        subtotalRp: 0,
        status: 'Dipisahkan (Kompos / Pakan)',
      },
    ]
  } else if (safeBatch.hasil) {
    // Standard Manual 3-Grade (A, B, C)
    const h = safeBatch.hasil
    grades = [
      {
        code: 'GRADE-A',
        label: 'Grade A (Mutu Prima)',
        desc: 'Kualitas tertinggi, fisik mulus seragam',
        ratioPercent: Number(h.persenA ?? 0),
        weightKg: Number(h.beratA ?? 0),
        pricePerKg: Math.round(refPrice * 1.1),
        subtotalRp: Number(h.nilaiA ?? Math.round((h.beratA || 0) * (refPrice * 1.1))),
        status: 'Pasar Premium / Grosir A',
      },
      {
        code: 'GRADE-B',
        label: 'Grade B (Mutu Standar)',
        desc: 'Kualitas standar konsumsi umum',
        ratioPercent: Number(h.persenB ?? 0),
        weightKg: Number(h.beratB ?? 0),
        pricePerKg: Math.round(refPrice * 0.9),
        subtotalRp: Number(h.nilaiB ?? Math.round((h.beratB || 0) * (refPrice * 0.9))),
        status: 'Pasar Tradisional / Olahan',
      },
      {
        code: 'GRADE-C',
        label: 'Grade C / Afkir (Reject)',
        desc: 'Cacat bentuk atau afkir sortasi',
        ratioPercent: Number(h.persenC ?? 0),
        weightKg: Number(h.beratC ?? 0),
        pricePerKg: 0,
        subtotalRp: 0,
        status: 'Afkir / Daur Ulang',
      },
    ]
  } else {
    // Fallback baseline
    grades = [
      {
        code: 'STANDAR',
        label: 'Hasil Uji Panen Lapangan',
        desc: 'Data hasil penimbangan awal',
        ratioPercent: 100,
        weightKg: totalWeightKg,
        pricePerKg: refPrice,
        subtotalRp: Math.round(totalWeightKg * refPrice),
        status: 'Proses Sortasi',
      },
    ]
  }

  // Financial aggregation
  const calculatedTotal = grades.reduce((acc, curr) => acc + (curr.subtotalRp || 0), 0)
  const totalRevenue =
    Number(pricing.estimated_economic_value) ||
    Number(safeBatch.hasil?.totalNilai) ||
    calculatedTotal

  const potentialLoss =
    Number(pricing.potential_loss_value) ||
    Number(safeBatch.hasil?.nilaiC) ||
    (grades.find((g) => g.code === 'REJECT' || g.code === 'ROTTEN')?.weightKg || 0) * refPrice

  const recommendationNote =
    pricing.recommendation_note ||
    (potentialLoss > 0
      ? 'Segera pisahkan komoditas afkir untuk mencegah penyebaran mikroba pembusuk ke hasil panen bermutu prima.'
      : 'Kualitas panen prima merata. Batch memenuhi standar distribusi pasar modern.')

  const todayStr = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Jakarta' }).format(new Date())

  const scanResult = safeBatch.scanResult
  const execStatus =
    safeBatch.execution_status ||
    scanResult?.execution_status ||
    (safeBatch.is_simulated || scanResult?.is_simulated
      ? 'simulated'
      : (hasInference && (isEggplant || commodity.toLowerCase().includes('tomat'))
        ? 'ai_detected'
        : 'unsupported'))

  let modelEngineName = 'Pencatatan Mutu Non-AI (Model Belum Didukung)'
  let inspectionMethod = 'Inspeksi Visual Manual & Model Perhitungan STEAM'
  let evaluator = 'Sistem Analisis Panen SMKN 4 Payakumbuh'

  if (execStatus === 'ai_detected') {
    modelEngineName = hasTerung3Grade
      ? 'Ultralytics YOLO11n (3-Grade Commercial Quality)'
      : isEggplant
        ? 'Ultralytics YOLO11n (4-Class Commercial Quality)'
        : 'Ultralytics YOLO11 (2-Class Fresh/Rotten)'
    inspectionMethod = isMultiAngle
      ? `Computer Vision AI (Multi-Angle 2-Sisi Terverifikasi) — ${modelEngineName}`
      : `Computer Vision AI (Single-View Terverifikasi) — ${modelEngineName}`
    evaluator = 'Agri-Sort AI Autonomous Engine (Terverifikasi)'
  } else if (execStatus === 'needs_review') {
    modelEngineName = isEggplant
      ? (hasTerung3Grade ? 'Ultralytics YOLO11n 3-Grade (Perlu Review)' : 'Ultralytics YOLO11n (Perlu Review)')
      : 'Ultralytics YOLO11 (Perlu Review)'
    inspectionMethod = isMultiAngle
      ? 'Computer Vision AI (Multi-Angle 2-Sisi) — Memerlukan Verifikasi Manual'
      : 'Computer Vision AI — Memerlukan Verifikasi Manual'
    evaluator = 'Agri-Sort AI Engine & Peninjau Lapangan (Perlu Verifikasi)'
  } else if (execStatus === 'simulated') {
    modelEngineName = 'Simulator AI Agri-Sort (Mode Uji / Edukasi)'
    inspectionMethod = 'Simulasi Digital Sintetis (Non-AI Model)'
    evaluator = 'Simulator Digital Agri-Sort AI (Mode Uji)'
  } else if (execStatus === 'model_unavailable') {
    modelEngineName = 'Sistem Cadangan (Model AI Tidak Tersedia)'
    inspectionMethod = 'Pencatatan Cadangan Manual (AI Offline / Error)'
    evaluator = 'Petugas Mutu Lapangan (Pencatatan Cadangan)'
  } else {
    modelEngineName = 'Pencatatan Mutu Non-AI (Model Belum Didukung)'
    inspectionMethod = 'Inspeksi Visual Manual & Model Perhitungan STEAM'
    evaluator = 'Sistem Analisis Panen SMKN 4 Payakumbuh'
  }

  return {
    registrationId: formatRegistrationId(safeBatch.id),
    harvestDate: formatCertificateDate(safeBatch.tanggal || todayStr),
    inspectionDate: formatCertificateDate(todayStr),
    commodity,
    totalWeightKg,
    isMultiAngle,
    executionStatus: execStatus,
    modelEngineName,
    inspectionMethod,
    evaluator,
    farmerName: safeBatch.petani || 'Kelompok Tani Mitra SMKN 4 Payakumbuh',
    location: safeBatch.lokasi || 'Kawasan Agribisnis Payakumbuh, Sumatera Barat',
    referencePricePerKg: refPrice,
    marketRegion: pricing.region || safeBatch.pricing?.region || 'Pasar Ibuh Payakumbuh / Sumatera Barat',
    dataStatus: pricing.data_status || safeBatch.pricing?.data_status || 'simulasi',
    grades,
    financials: {
      totalRevenue,
      potentialLoss,
      referencePricePerKg: refPrice,
    },
    recommendationNote,
    occlusion: safeBatch.scanResult?.occlusion_analysis || safeBatch.occlusion_analysis || null,
    institution: INSTITUTION_INFO,
  }
}

