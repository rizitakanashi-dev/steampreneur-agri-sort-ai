import test from 'node:test'
import assert from 'node:assert/strict'
import {
  EMPTY_RECAP_FILTER,
  calculateBatchTotals,
  filterBatches,
  isFilterEmpty,
  listCommodities,
  sortBatchesByNewest,
} from '../src/business/harvestFilter.js'
import { buildHarvestCsv } from '../src/utils/csvExporter.js'

const batches = [
  { id: 'panen-1', tanggal: '2026-10-10', komoditas: 'Tomat', beratKg: 100, hasil: { totalNilai: 946080 }, dicatatPada: '2026-10-10T01:00:00.000Z' },
  { id: 'panen-2', tanggal: '2026-10-11', komoditas: 'Terung', beratKg: 50, hasil: { totalNilai: 300000 }, dicatatPada: '2026-10-11T01:00:00.000Z' },
  { id: 'panen-3', tanggal: '2026-10-12', komoditas: 'Tomat', beratKg: 75, hasil: { totalNilai: 500000 }, dicatatPada: '2026-10-12T01:00:00.000Z' },
]

test('pencarian cocok berdasarkan ID batch', () => {
  const result = filterBatches(batches, { ...EMPTY_RECAP_FILTER, search: 'panen-2' })
  assert.deepEqual(result.map((batch) => batch.id), ['panen-2'])
})

test('pencarian cocok berdasarkan komoditas', () => {
  const result = filterBatches(batches, { ...EMPTY_RECAP_FILTER, search: 'tomat' })
  assert.deepEqual(result.map((batch) => batch.id), ['panen-1', 'panen-3'])
})

test('pencarian tidak membedakan huruf besar dan kecil', () => {
  const lower = filterBatches(batches, { ...EMPTY_RECAP_FILTER, search: 'terung' })
  const upper = filterBatches(batches, { ...EMPTY_RECAP_FILTER, search: 'TERUNG' })
  const mixed = filterBatches(batches, { ...EMPTY_RECAP_FILTER, search: 'TeRuNg' })
  assert.deepEqual(lower.map((b) => b.id), ['panen-2'])
  assert.deepEqual(upper.map((b) => b.id), ['panen-2'])
  assert.deepEqual(mixed.map((b) => b.id), ['panen-2'])
})

test('filter komoditas menyaring tepat satu komoditas', () => {
  const result = filterBatches(batches, { ...EMPTY_RECAP_FILTER, komoditas: 'Tomat' })
  assert.deepEqual(result.map((batch) => batch.id), ['panen-1', 'panen-3'])
})

test('filter rentang tanggal memakai batas inklusif', () => {
  const result = filterBatches(batches, { ...EMPTY_RECAP_FILTER, tanggalDari: '2026-10-11', tanggalSampai: '2026-10-12' })
  assert.deepEqual(result.map((batch) => batch.id), ['panen-2', 'panen-3'])
})

test('pencarian dan filter dapat dipakai bersamaan', () => {
  const result = filterBatches(batches, { search: 'tomat', komoditas: 'Tomat', tanggalDari: '2026-10-12', tanggalSampai: '' })
  assert.deepEqual(result.map((batch) => batch.id), ['panen-3'])
})

test('kombinasi tanpa hasil mengembalikan array kosong', () => {
  const result = filterBatches(batches, { search: 'terung', komoditas: 'Tomat', tanggalDari: '', tanggalSampai: '' })
  assert.deepEqual(result, [])
})

test('isFilterEmpty mendeteksi kondisi awal dan kondisi terisi', () => {
  assert.equal(isFilterEmpty(EMPTY_RECAP_FILTER), true)
  assert.equal(isFilterEmpty({ ...EMPTY_RECAP_FILTER, search: '   ' }), true)
  assert.equal(isFilterEmpty({ ...EMPTY_RECAP_FILTER, komoditas: 'Tomat' }), false)
  assert.equal(isFilterEmpty({ ...EMPTY_RECAP_FILTER, tanggalDari: '2026-10-01' }), false)
})

test('filter kosong mengembalikan seluruh data', () => {
  assert.equal(filterBatches(batches, EMPTY_RECAP_FILTER).length, batches.length)
})

test('sortBatchesByNewest menaruh tanggal terbaru di atas', () => {
  const sorted = sortBatchesByNewest(batches)
  assert.deepEqual(sorted.map((batch) => batch.id), ['panen-3', 'panen-2', 'panen-1'])
})

test('listCommodities mengembalikan komoditas unik dan terurut', () => {
  assert.deepEqual(listCommodities(batches), ['Terung', 'Tomat'])
  assert.deepEqual(listCommodities([]), [])
})

test('CSV mengekspor hanya baris yang sedang tersaring', () => {
  const visible = filterBatches(batches, { ...EMPTY_RECAP_FILTER, komoditas: 'Terung' })
  const csv = buildHarvestCsv(visible)
  const lines = csv.split('\r\n')
  assert.equal(lines.length, 2, 'satu header + satu baris data')
  assert.ok(lines[1].startsWith('panen-2'))
  assert.ok(!csv.includes('panen-1'), 'baris yang tersaring tidak boleh ikut terekspor')
})

test('calculateBatchTotals mengembalikan nol untuk daftar kosong', () => {
  assert.deepEqual(calculateBatchTotals([]), { totalBeratKg: 0, totalNilai: 0 })
  assert.deepEqual(calculateBatchTotals(), { totalBeratKg: 0, totalNilai: 0 })
})

test('calculateBatchTotals menjumlahkan berat dan nilai dari beberapa batch', () => {
  const result = calculateBatchTotals(batches)
  assert.equal(result.totalBeratKg, 225)
  assert.equal(result.totalNilai, 1746080)
})

test('calculateBatchTotals menangani batch tanpa hasil', () => {
  const partial = [
    { id: 'a', beratKg: 10, hasil: { totalNilai: 50000 } },
    { id: 'b', beratKg: 20, hasil: null },
    { id: 'c', beratKg: 5 },
  ]
  const result = calculateBatchTotals(partial)
  assert.equal(result.totalBeratKg, 35)
  assert.equal(result.totalNilai, 50000)
})
