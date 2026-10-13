import test from 'node:test'
import assert from 'node:assert/strict'
import { defaultHarvestForm, validateHarvestForm } from '../src/business/harvestValidation.js'

test('defaultHarvestForm berisi tanggal hari ini dan field sesuai spesifikasi', () => {
  assert.deepEqual(Object.keys(defaultHarvestForm), [
    'tanggal',
    'komoditas',
    'beratKg',
    'kesegaranPersen',
    'ukuran',
    'cacatPersen',
    'catatan',
  ])
  assert.match(defaultHarvestForm.tanggal, /^\d{4}-\d{2}-\d{2}$/)
})

test('validateHarvestForm mengembalikan semua pesan invalid sekaligus', () => {
  const result = validateHarvestForm({
    tanggal: '2099-01-01',
    komoditas: '',
    beratKg: '-5',
    kesegaranPersen: '101',
    ukuran: '',
    cacatPersen: 'abc',
    catatan: 'x'.repeat(101),
  }, '2026-10-13')

  assert.deepEqual(result.errors, {
    tanggal: 'Tanggal panen tidak boleh melebihi hari ini.',
    komoditas: 'Pilih komoditas terlebih dahulu.',
    beratKg: 'Berat panen tidak boleh negatif.',
    kesegaranPersen: 'Kesegaran harus antara 0 sampai 100.',
    ukuran: 'Pilih ukuran terlebih dahulu.',
    cacatPersen: 'Cacat harus berupa angka.',
    catatan: 'Catatan maksimal 100 karakter.',
  })
  assert.equal(result.isValid, false)
})

test('validateHarvestForm menerima koma dan batas 0 serta 100', () => {
  const result = validateHarvestForm({
    tanggal: '2026-10-13',
    komoditas: 'Tomat',
    beratKg: '25,5',
    kesegaranPersen: '0',
    ukuran: 'Besar',
    cacatPersen: '100',
    catatan: 'Setoran pagi',
  }, '2026-10-13')

  assert.equal(result.isValid, true)
  assert.deepEqual(result.values, {
    tanggal: '2026-10-13',
    komoditas: 'Tomat',
    beratKg: 25.5,
    kesegaranPersen: 0,
    ukuran: 'Besar',
    cacatPersen: 100,
    catatan: 'Setoran pagi',
  })
})
