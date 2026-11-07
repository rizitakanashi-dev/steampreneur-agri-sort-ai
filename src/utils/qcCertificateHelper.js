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
    const d = new Date(dateVal)
    if (Number.isNaN(d.getTime())) {
      // Fallback if string like '2026-11-08'
      const parts = String(dateVal).split('-')
      if (parts.length === 3) {
        const months = [
          'Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni',
          'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'
        ]
        const mIdx = parseInt(parts[1], 10) - 1
        if (mIdx >= 0 && mIdx < 12) {
          return `${parseInt(parts[2], 10)} ${months[mIdx]} ${parts[0]}`
        }
      }
      return String(dateVal)
    }
    return new Intl.DateTimeFormat('id-ID', {
      day: 'numeric',
      month: 'long',
      year: 'numeric',
    }).format(d)
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
    safeBatch.inference?.commodity === 'terung'

  const hasInference = Boolean(safeBatch.inference || safeBatch.ai_scan_performed)
  const totalWeightKg = Number.isFinite(Number(safeBatch.beratKg))
    ? Number(safeBatch.beratKg)
    : Number.isFinite(Number(safeBatch.volume_kg))
      ? Number(safeBatch.volume_kg)
      : 0

  const refPrice =
    Number(safeBatch.pricing?.reference_price_per_kg) ||
    getReferencePricePerKg(commodity) ||
    (isEggplant ? 10000 : 12000)

  let grades = []

  if (isEggplant && (safeBatch.pricing?.tier_breakdown || safeBatch.inference?.condition_ratios)) {
    // 4-Class Terung Grading
    const ratios = safeBatch.inference?.condition_ratios || {}
    const tier = safeBatch.pricing?.tier_breakdown || {}

    const extraRatio = Number(ratios.extra_class_ratio_percent ?? (tier.extra_class?.weight_kg ? (tier.extra_class.weight_kg / (totalWeightKg || 1)) * 100 : 0))
    const c1Ratio = Number(ratios.class_1_ratio_percent ?? (tier.class_1?.weight_kg ? (tier.class_1.weight_kg / (totalWeightKg || 1)) * 100 : 0))
    const c2Ratio = Number(ratios.class_2_ratio_percent ?? (tier.class_2?.weight_kg ? (tier.class_2.weight_kg / (totalWeightKg || 1)) * 100 : 0))
    const rejRatio = Number(ratios.reject_ratio_percent ?? (tier.reject?.weight_kg ? (tier.reject.weight_kg / (totalWeightKg || 1)) * 100 : 0))

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
  } else if (hasInference && safeBatch.inference?.condition_ratios) {
    // Tomat 2-Class AI Scan
    const ratios = safeBatch.inference.condition_ratios
    const freshRatio = Number(ratios.fresh_ratio_percent ?? 0)
    const rottenRatio = Number(ratios.rotten_ratio_percent ?? 0)

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
    Number(safeBatch.pricing?.estimated_economic_value) ||
    Number(safeBatch.hasil?.totalNilai) ||
    calculatedTotal

  const potentialLoss =
    Number(safeBatch.pricing?.potential_loss_value) ||
    Number(safeBatch.hasil?.nilaiC) ||
    (grades.find((g) => g.code === 'REJECT' || g.code === 'ROTTEN')?.weightKg || 0) * refPrice

  const recommendationNote =
    safeBatch.pricing?.recommendation_note ||
    (potentialLoss > 0
      ? 'Segera pisahkan komoditas afkir untuk mencegah penyebaran mikroba pembusuk ke hasil panen bermutu prima.'
      : 'Kualitas panen prima merata. Batch memenuhi standar distribusi pasar modern.')

  return {
    registrationId: formatRegistrationId(safeBatch.id),
    harvestDate: formatCertificateDate(safeBatch.tanggal),
    inspectionDate: formatCertificateDate(new Date()),
    commodity,
    totalWeightKg,
    inspectionMethod: hasInference
      ? 'Computer Vision AI (YOLOv8 & Deep Learning Multi-Class)'
      : 'Inspeksi Visual & Model Perhitungan Terstandar',
    evaluator: hasInference ? 'Agri-Sort AI Autonomous Engine' : 'Sistem Analisis Panen SMKN 4 Payakumbuh',
    farmerName: safeBatch.petani || 'Kelompok Tani Mitra SMKN 4 Payakumbuh',
    location: safeBatch.lokasi || 'Kawasan Agribisnis Payakumbuh, Sumatera Barat',
    referencePricePerKg: refPrice,
    marketRegion: safeBatch.pricing?.region || 'Pasar Ibuh Payakumbuh / Sumatera Barat',
    dataStatus: safeBatch.pricing?.data_status || 'simulasi',
    grades,
    financials: {
      totalRevenue,
      potentialLoss,
      referencePricePerKg: refPrice,
    },
    recommendationNote,
    institution: INSTITUTION_INFO,
  }
}

