/**
 * Modul Kalkulasi Finansial Petani: HPP, BEP, dan Analisis Laba Bersih
 * Pilar STEAM: Mathematics & Entrepreneurship (STEAMPreneur)
 * Dokumen Acuan: Proposal STEAMPreneur SMK 2026 (Bab 3.2 & 5.2)
 *
 * Menyediakan kalkulator finansial agribisnis presisi untuk petani dan pengepul hortikultura:
 * 1. Biaya Pokok Produksi (BPP / HPP) per kg
 * 2. Titik Impas Harga (BEP Price) & Titik Impas Volume (BEP Volume)
 * 3. Proyeksi Laba/Rugi Bersih (Net Profit) & Return on Investment (ROI)
 */

import { parseNumeric, roundRupiah } from './harvestCalculation.js'

function roundSignedRupiah(value) {
  if (typeof value !== 'number' || Number.isNaN(value) || !Number.isFinite(value)) return 0
  return value < 0 ? -roundRupiah(Math.abs(value)) : roundRupiah(value)
}

/**
 * Menghitung kelayakan ekonomi dan titik impas panen petani.
 *
 * @param {Object} params
 * @param {number} params.revenue - Total pendapatan jual panen (Rp)
 * @param {number} params.sellableVolumeKg - Volume buah yang terjual (kg, Grade A + Grade B)
 * @param {string} [params.costMode='perKg'] - 'perKg' (input BPP/kg) atau 'total' (input total modal)
 * @param {number|string} [params.bppPerKg=0] - Biaya pokok per kg (Rp)
 * @param {number|string} [params.totalCost=0] - Total biaya modal budidaya/panen (Rp)
 * @returns {Object} Hasil kalkulasi finansial
 */
export function calculateFarmerProfitability({
  revenue,
  sellableVolumeKg,
  costMode = 'perKg',
  bppPerKg = 0,
  totalCost = 0,
}) {
  const rev = Math.max(0, Number(revenue) || 0)
  const volume = Math.max(0, Number(sellableVolumeKg) || 0)

  let calculatedTotalCost = 0
  let calculatedBppPerKg = 0

  if (costMode === 'total') {
    const parsedCost = parseNumeric(totalCost)
    calculatedTotalCost = parsedCost !== null && parsedCost > 0 ? parsedCost : 0
    calculatedBppPerKg = volume > 0 ? calculatedTotalCost / volume : 0
  } else {
    const parsedBpp = parseNumeric(bppPerKg)
    calculatedBppPerKg = parsedBpp !== null && parsedBpp > 0 ? parsedBpp : 0
    calculatedTotalCost = calculatedBppPerKg * volume
  }

  calculatedTotalCost = roundRupiah(calculatedTotalCost)
  calculatedBppPerKg = roundRupiah(calculatedBppPerKg)

  const netProfit = rev - calculatedTotalCost
  const isProfitable = netProfit > 0
  const isBreakEven = netProfit === 0 && calculatedTotalCost > 0

  // Margin Laba Bersih (% terhadap Pendapatan)
  const profitMarginPercent = rev > 0 ? Number(((netProfit / rev) * 100).toFixed(2)) : 0

  // Return on Investment (% terhadap Modal)
  const roiPercent =
    calculatedTotalCost > 0 ? Number(((netProfit / calculatedTotalCost) * 100).toFixed(2)) : 0

  // BEP Harga (Rp/kg): Harga jual minimal per kg agar modal tertutup
  const bepPricePerKg = volume > 0 ? roundRupiah(calculatedTotalCost / volume) : 0

  // Rata-rata harga riil yang diterima petani per kg layak jual
  const actualAvgPricePerKg = volume > 0 ? roundRupiah(rev / volume) : 0

  // BEP Volume (kg): Berapa kg panen yang harus terjual pada harga rata-rata saat ini untuk menutup modal
  const bepVolumeKg =
    actualAvgPricePerKg > 0 ? Number((calculatedTotalCost / actualAvgPricePerKg).toFixed(2)) : 0

  return {
    revenue: roundRupiah(rev),
    sellableVolumeKg: volume,
    totalCost: calculatedTotalCost,
    bppPerKg: calculatedBppPerKg,
    netProfit: roundSignedRupiah(netProfit),
    isProfitable,
    isBreakEven,
    profitMarginPercent,
    roiPercent,
    bepPricePerKg,
    actualAvgPricePerKg,
    bepVolumeKg,
  }
}
