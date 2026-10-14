import test from 'node:test'
import assert from 'node:assert/strict'
import { clearBatches, HARVEST_STORAGE_KEY, readBatches, saveBatch } from '../src/business/harvestStorage.js'

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
