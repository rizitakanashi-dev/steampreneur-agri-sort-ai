import { calculateGradeWeights, GRADE_MULTIPLIERS, parseNumeric, roundRupiah } from './harvestCalculation.js'
import { getReferencePricePerKg } from './priceReference.js'

/**
 * Proyeksi pendapatan untuk Pricing Dashboard.
 *
 * Memakai pengali grade yang sama dengan kalkulasi batch (GRADE_MULTIPLIERS).
 * Pengali ukuran TIDAK dipakai di sini karena form proyeksi hanya meminta volume,
 * bukan ukuran buah. Perbedaan ini disengaja dan dicatat di dokumen.
 *
 * Semua angka tetap numerik; format Rupiah hanya dilakukan di komponen UI.
 */
export function calculateRevenueProjection({
  komoditas,
  volumeKg,
  persenA,
  persenB,
  persenC,
  includeReject = true,
}) {
  const hargaAcuanPerKg = getReferencePricePerKg(komoditas)
  if (hargaAcuanPerKg === null) {
    throw new RangeError('Komoditas ini belum memiliki harga referensi di konfigurasi harga.')
  }

  const volume = parseNumeric(volumeKg)
  if (volume === null) throw new TypeError('Volume panen harus berupa angka yang valid.')
  if (volume <= 0) throw new RangeError('Volume panen harus lebih dari 0 kg.')

  const persentase = {
    gradeA: parseNumeric(persenA),
    gradeB: parseNumeric(persenB),
    reject: parseNumeric(persenC),
  }
  if (Object.values(persentase).some((value) => value === null)) {
    throw new TypeError('Persentase grade harus berupa angka yang valid.')
  }
  const totalPersen = persentase.gradeA + persentase.gradeB + persentase.reject
  if (Object.values(persentase).some((value) => value < 0 || value > 100) || Math.abs(totalPersen - 100) > 1e-9) {
    throw new RangeError('Persentase grade harus berjumlah 100% dan berada pada rentang 0 sampai 100.')
  }

  const beratKg = calculateGradeWeights(volume, persentase)
  const nilai = {
    gradeA: roundRupiah(beratKg.gradeA * hargaAcuanPerKg * GRADE_MULTIPLIERS.gradeA),
    gradeB: roundRupiah(beratKg.gradeB * hargaAcuanPerKg * GRADE_MULTIPLIERS.gradeB),
    reject: includeReject ? roundRupiah(beratKg.reject * hargaAcuanPerKg * GRADE_MULTIPLIERS.reject) : 0,
  }

  return {
    komoditas,
    hargaAcuanPerKg,
    volumeKg: volume,
    persentase,
    beratKg,
    nilai,
    includeReject,
    totalNilai: nilai.gradeA + nilai.gradeB + nilai.reject,
    totalNilaiJual: nilai.gradeA + nilai.gradeB,
  }
}

/** Harga jual rata-rata tertimbang per kg berdasarkan komposisi grade (Reject tidak dihitung). */
export function calculateWeightedPricePerKg(projection) {
  if (!projection || projection.volumeKg <= 0) throw new RangeError('Proyeksi tidak valid untuk menghitung harga rata-rata.')
  const sellableKg = projection.beratKg.gradeA + projection.beratKg.gradeB
  if (sellableKg <= 0) return 0
  return roundRupiah((projection.nilai.gradeA + projection.nilai.gradeB) / sellableKg)
}
