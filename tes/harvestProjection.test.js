import test from 'node:test'
import assert from 'node:assert/strict'
import { calculateRevenueProjection } from '../src/business/harvestProjection.js'
import { REFERENCE_PRICES_PER_KG } from '../src/business/priceReference.js'

test('calculateRevenueProjection memakai harga referensi per komoditas, bukan harga seragam', () => {
  const tomat = calculateRevenueProjection({ komoditas: 'Tomat', volumeKg: 100, persenA: 72, persenB: 18, persenC: 10 })
  const terung = calculateRevenueProjection({ komoditas: 'Terung', volumeKg: 100, persenA: 72, persenB: 18, persenC: 10 })

  assert.notEqual(tomat.totalNilai, terung.totalNilai)
  assert.equal(tomat.hargaAcuanPerKg, REFERENCE_PRICES_PER_KG.Tomat)
  assert.equal(terung.hargaAcuanPerKg, REFERENCE_PRICES_PER_KG.Terung)
})

test('calculateRevenueProjection menghitung berat dan nilai tiap grade dari input volume', () => {
  const result = calculateRevenueProjection({ komoditas: 'Tomat', volumeKg: 100, persenA: 72, persenB: 18, persenC: 10 })

  assert.deepEqual(result.beratKg, { gradeA: 72, gradeB: 18, reject: 10 })
  assert.deepEqual(result.nilai, { gradeA: 864000, gradeB: 151200, reject: 36000 })
  assert.equal(result.totalNilai, 1051200)
})

test('calculateRevenueProjection dapat mengabaikan Reject sebagai pendapatan jual', () => {
  const withReject = calculateRevenueProjection({ komoditas: 'Tomat', volumeKg: 100, persenA: 72, persenB: 18, persenC: 10, includeReject: true })
  const withoutReject = calculateRevenueProjection({ komoditas: 'Tomat', volumeKg: 100, persenA: 72, persenB: 18, persenC: 10, includeReject: false })

  assert.equal(withReject.nilai.reject, 36000)
  assert.equal(withoutReject.nilai.reject, 0)
  assert.equal(withoutReject.totalNilai, withReject.totalNilai - 36000)
})

test('calculateRevenueProjection menolak input volume dan persentase yang tidak valid', () => {
  assert.throws(() => calculateRevenueProjection({ komoditas: 'Tomat', volumeKg: 0, persenA: 72, persenB: 18, persenC: 10 }), /lebih dari 0/)
  assert.throws(() => calculateRevenueProjection({ komoditas: 'Tomat', volumeKg: 'abc', persenA: 72, persenB: 18, persenC: 10 }), /angka yang valid/)
  assert.throws(() => calculateRevenueProjection({ komoditas: 'Tomat', volumeKg: 100, persenA: 80, persenB: 30, persenC: 0 }), /berjumlah 100/)
})

test('calculateRevenueProjection menolak komoditas yang tidak memiliki harga referensi', () => {
  assert.throws(
    () => calculateRevenueProjection({ komoditas: 'Kentang', volumeKg: 100, persenA: 72, persenB: 18, persenC: 10 }),
    /harga referensi/,
  )
})
