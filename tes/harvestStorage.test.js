import test from 'node:test'
import assert from 'node:assert/strict'
import {
  clearBatches,
  deleteBatch,
  exportBatchesAsJson,
  HARVEST_STORAGE_KEY,
  importBatchesFromJson,
  readBatches,
  saveBatch,
} from '../src/business/harvestStorage.js'

function makeStorage(initialValue) {
  const values = new Map(initialValue === undefined ? [] : [[HARVEST_STORAGE_KEY, initialValue]])
  return {
    getItem: (key) => values.get(key) ?? null,
    setItem: (key, value) => values.set(key, value),
    removeItem: (key) => values.delete(key),
  }
}

const sampleBatch = { id: 'panen-1', tanggal: '2026-10-14', komoditas: 'Tomat', beratKg: 10 }

test('readBatches mengembalikan array kosong untuk storage kosong atau JSON rusak', () => {
  assert.deepEqual(readBatches(makeStorage()), [])
  assert.deepEqual(readBatches(makeStorage('{rusak')), [])
  assert.deepEqual(readBatches(makeStorage(JSON.stringify({ bukan: 'array' }))), [])
})

test('saveBatch menambah batch dan dapat dibaca kembali dari storage', () => {
  const storage = makeStorage()
  const saved = saveBatch(sampleBatch, storage)
  assert.equal(saved.id, 'panen-1')
  assert.deepEqual(readBatches(storage), [sampleBatch])
})

test('saveBatch membuat ID unik ketika ID yang diminta sudah ada', () => {
  const storage = makeStorage()
  saveBatch(sampleBatch, storage)
  const second = saveBatch(sampleBatch, storage)
  assert.equal(second.id, 'panen-1-2')
  assert.deepEqual(readBatches(storage).map((batch) => batch.id), ['panen-1', 'panen-1-2'])
})

test('clearBatches menghapus semua batch', () => {
  const storage = makeStorage()
  saveBatch(sampleBatch, storage)
  clearBatches(storage)
  assert.deepEqual(readBatches(storage), [])
})

test('deleteBatch menghapus satu batch spesifik dan mempertahankan batch lainnya', () => {
  const storage = makeStorage()
  saveBatch({ id: 'panen-A', komoditas: 'Tomat', beratKg: 10 }, storage)
  saveBatch({ id: 'panen-B', komoditas: 'Terung', beratKg: 20 }, storage)

  const remaining = deleteBatch('panen-A', storage)
  assert.equal(remaining.length, 1)
  assert.equal(remaining[0].id, 'panen-B')

  assert.deepEqual(readBatches(storage), [{ id: 'panen-B', komoditas: 'Terung', beratKg: 20 }])

  // Menghapus ID yang tidak ada tetap aman
  const same = deleteBatch('panen-NONEXISTENT', storage)
  assert.equal(same.length, 1)
})

test('exportBatchesAsJson menghasilkan format cadangan baku dengan metadata', () => {
  const storage = makeStorage()
  saveBatch(sampleBatch, storage)
  const jsonStr = exportBatchesAsJson(storage)
  const parsed = JSON.parse(jsonStr)

  assert.equal(parsed.app, 'Agri-Sort AI')
  assert.equal(parsed.totalRecords, 1)
  assert.equal(parsed.batches[0].id, 'panen-1')
  assert.equal(typeof parsed.exportedAt, 'string')
})

test('importBatchesFromJson menolak berkas JSON rusak atau bukan array rekaman valid', () => {
  const storage = makeStorage()
  const invalidJson = importBatchesFromJson('{rusak', storage)
  assert.equal(invalidJson.success, false)
  assert.equal(invalidJson.importedCount, 0)

  const emptyArray = importBatchesFromJson('[]', storage)
  assert.equal(emptyArray.success, false)

  const invalidRecords = importBatchesFromJson(JSON.stringify([{ invalid: 'record' }]), storage)
  assert.equal(invalidRecords.success, false)
})

test('importBatchesFromJson berhasil menggabungkan data dan mencegah tabrakan ID', () => {
  const storage = makeStorage()
  saveBatch(sampleBatch, storage) // id: 'panen-1'

  const backupToImport = {
    batches: [
      { id: 'panen-1', tanggal: '2026-10-15', komoditas: 'Terung Ungu', beratKg: 15 },
      { id: 'panen-new', tanggal: '2026-10-16', komoditas: 'Cabai', beratKg: 5 },
    ],
  }

  const result = importBatchesFromJson(JSON.stringify(backupToImport), storage)
  assert.equal(result.success, true)
  assert.equal(result.importedCount, 2)
  assert.equal(result.totalCount, 3)

  const finalBatches = readBatches(storage)
  assert.equal(finalBatches.length, 3)
  assert.equal(finalBatches[0].id, 'panen-1')
  assert.equal(finalBatches[1].id, 'panen-1-2') // disambiguated
  assert.equal(finalBatches[2].id, 'panen-new')
})
