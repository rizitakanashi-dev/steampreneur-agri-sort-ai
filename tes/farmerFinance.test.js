import test from 'node:test'
import assert from 'node:assert/strict'
import { calculateFarmerProfitability } from '../src/business/farmerFinance.js'

test('calculateFarmerProfitability mode perKg menghitung laba, ROI, dan BEP dengan benar saat untung', () => {
  // Misal: Volume panen terjual 500 kg, pendapatan Rp6.000.000, BPP Rp7.000/kg
  // Total Modal = 500 * 7.000 = Rp3.500.000
  // Laba Bersih = 6.000.000 - 3.500.000 = Rp2.500.000
  // Margin = (2.500.000 / 6.000.000) * 100 = 41.67%
  // ROI = (2.500.000 / 3.500.000) * 100 = 71.43%
  // BEP Harga = 3.500.000 / 500 = Rp7.000 / kg
  const result = calculateFarmerProfitability({
    revenue: 6000000,
    sellableVolumeKg: 500,
    costMode: 'perKg',
    bppPerKg: 7000,
  })

  assert.equal(result.totalCost, 3500000)
  assert.equal(result.netProfit, 2500000)
  assert.equal(result.isProfitable, true)
  assert.equal(result.isBreakEven, false)
  assert.equal(result.profitMarginPercent, 41.67)
  assert.equal(result.roiPercent, 71.43)
  assert.equal(result.bepPricePerKg, 7000)
  assert.equal(result.actualAvgPricePerKg, 12000)
})

test('calculateFarmerProfitability mode perKg mendeteksi kondisi rugi dengan benar', () => {
  // Pendapatan Rp2.000.000, Volume 400 kg, BPP Rp8.000/kg -> Modal = Rp3.200.000 -> Rugi Rp1.200.000
  const result = calculateFarmerProfitability({
    revenue: 2000000,
    sellableVolumeKg: 400,
    costMode: 'perKg',
    bppPerKg: 8000,
  })

  assert.equal(result.totalCost, 3200000)
  assert.equal(result.netProfit, -1200000)
  assert.equal(result.isProfitable, false)
  assert.equal(result.roiPercent, -37.5)
})

test('calculateFarmerProfitability mode total modal budidaya', () => {
  // Pendapatan Rp5.000.000, Volume 500 kg, Total Modal Rp4.000.000
  const result = calculateFarmerProfitability({
    revenue: 5000000,
    sellableVolumeKg: 500,
    costMode: 'total',
    totalCost: '4000000',
  })

  assert.equal(result.totalCost, 4000000)
  assert.equal(result.bppPerKg, 8000)
  assert.equal(result.netProfit, 1000000)
  assert.equal(result.isProfitable, true)
  assert.equal(result.profitMarginPercent, 20)
  assert.equal(result.roiPercent, 25)
  assert.equal(result.bepPricePerKg, 8000)
})

test('calculateFarmerProfitability menangani volume nol dan input invalid secara aman', () => {
  const result = calculateFarmerProfitability({
    revenue: 0,
    sellableVolumeKg: 0,
    costMode: 'perKg',
    bppPerKg: 'abc',
  })

  assert.equal(result.totalCost, 0)
  assert.equal(result.netProfit, 0)
  assert.equal(result.isProfitable, false)
  assert.equal(result.bepPricePerKg, 0)
})

