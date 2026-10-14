import test from 'node:test'
import assert from 'node:assert/strict'
import {
  calculateHarvest,
  calculateGradeWeights,
  calculateMinimumPrice,
  calculateHarvestValue,
  parseNumeric,
  roundRupiah,
  validateCalculationInput,
} from '../src/business/harvestCalculation.js'

test('calculateHarvest menghitung distribusi dan berat grade dari kesegaran serta cacat', () => {
  const result = calculateHarvest({ beratKg: 100, kesegaranPersen: 80, cacatPersen: 10 })

  assert.deepEqual(result.persentase, { gradeA: 72, gradeB: 18, reject: 10 })
  assert.deepEqual(result.beratKg, { gradeA: 72, gradeB: 18, reject: 10 })
})

test('calculateGradeWeights menghitung berat berdasarkan persentase grade', () => {
  assert.deepEqual(calculateGradeWeights(25.5, { gradeA: 72, gradeB: 8, reject: 20 }), {
    gradeA: 18.36,
    gradeB: 2.04,
    reject: 5.1,
  })
})

test('calculateHarvestValue memakai harga acuan dan multiplier yang disetujui spesifikasi', () => {
  const result = calculateHarvestValue({
    beratKg: 100,
    kesegaranPersen: 80,
    cacatPersen: 10,
    hargaAcuanPerKg: 12000,
    ukuran: 'Sedang',
  })

  assert.deepEqual(result.nilai, { gradeA: 777600, gradeB: 136080, reject: 32400 })
  assert.equal(result.totalNilai, 946080)
})

test('validateCalculationInput menolak input invalid dan persentase Grade A+B di atas 100', () => {
  const result = validateCalculationInput({ beratKg: 0, gradeA: 70, gradeB: 31 })
  assert.equal(result.isValid, false)
  assert.match(result.errors.beratKg, /lebih dari 0/)
  assert.match(result.errors.gradeB, /tidak boleh melebihi 100/)
})

test('persentase batas menghasilkan berat yang benar', () => {
  assert.deepEqual(calculateHarvest({ beratKg: 10, kesegaranPersen: 100, cacatPersen: 0 }).beratKg, {
    gradeA: 10,
    gradeB: 0,
    reject: 0,
  })
  assert.deepEqual(calculateHarvest({ beratKg: 10, kesegaranPersen: 0, cacatPersen: 100 }).beratKg, {
    gradeA: 0,
    gradeB: 0,
    reject: 10,
  })
})

test('calculateMinimumPrice tidak mengarang kebijakan BPP atau margin yang belum disepakati', () => {
  assert.throws(
    () => calculateMinimumPrice({ bppPerKg: 10000, marginPersen: 20 }),
    /belum ditetapkan/,
  )
})

test('roundRupiah membulatkan tie .5 ke atas tanpa error floating-point', () => {
  assert.equal(roundRupiah(1127506.4999999998), 1127507)
  assert.equal(roundRupiah(1127506.5), 1127507)
})

test('calculateHarvestValue menangani kasus regression pembulatan .5', () => {
  const result = calculateHarvestValue({
    beratKg: 352.5,
    kesegaranPersen: 0,
    cacatPersen: 88.85,
    hargaAcuanPerKg: 12000,
    ukuran: 'Besar',
  })

  assert.equal(result.nilai.reject, 1127507)
})

test('parseNumeric menerima koma desimal dan menolak format ambigu', () => {
  assert.equal(parseNumeric('25,5'), 25.5)
  assert.equal(parseNumeric('25.5'), 25.5)
  assert.equal(parseNumeric('12.000'), null)
})

test('parseNumeric menolak input kosong dan invalid', () => {
  for (const value of ['', '   ', null, undefined, 'abc', '1e3', '--5']) {
    assert.equal(parseNumeric(value), null, `expected ${String(value)} to be invalid`)
  }
})

test('validateCalculationInput menolak ukuran dan field wajib invalid', () => {
  const result = validateCalculationInput({
    beratKg: '25,5',
    kesegaranPersen: '',
    cacatPersen: '10',
    ukuran: 'Jumbo',
    hargaAcuanPerKg: '',
  })

  assert.equal(result.isValid, false)
  assert.equal(result.errors.kesegaranPersen, 'Kesegaran wajib diisi.')
  assert.equal(result.errors.ukuran, 'Ukuran harus dipilih.')
  assert.equal(result.errors.hargaAcuanPerKg, 'Harga acuan per kg wajib diisi.')
})

test('calculateHarvest menolak input persentase campuran yang melanggar kontrak', () => {
  assert.throws(
    () => calculateHarvest({ beratKg: 100, gradeA: 70, gradeB: 20, cacatPersen: 5 }),
    /gunakan kesegaran dan cacat|tidak boleh dicampur/,
  )
})
