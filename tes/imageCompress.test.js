import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  computeTargetDimensions,
  isSupportedImageType,
  compressImageFile,
} from '../src/utils/imageCompress.js'

test('computeTargetDimensions: landscape besar di-resize ke sisi terpanjang 1600', () => {
  assert.deepEqual(computeTargetDimensions(4000, 3000), { width: 1600, height: 1200 })
})

test('computeTargetDimensions: portrait besar ikut dibatasi', () => {
  assert.deepEqual(computeTargetDimensions(3000, 4000), { width: 1200, height: 1600 })
})

test('computeTargetDimensions: citra kecil tidak diperbesar', () => {
  assert.deepEqual(computeTargetDimensions(800, 600), { width: 800, height: 600 })
  assert.deepEqual(computeTargetDimensions(1600, 1600), { width: 1600, height: 1600 })
})

test('computeTargetDimensions: input tidak valid → 0', () => {
  assert.deepEqual(computeTargetDimensions(0, 100), { width: 0, height: 0 })
  assert.deepEqual(computeTargetDimensions(-5, 100), { width: 0, height: 0 })
  assert.deepEqual(computeTargetDimensions(NaN, 100), { width: 0, height: 0 })
  assert.deepEqual(computeTargetDimensions(100, 100, 0), { width: 0, height: 0 })
})

test('isSupportedImageType: hanya JPG/PNG/WebP yang didukung', () => {
  assert.equal(isSupportedImageType('image/jpeg'), true)
  assert.equal(isSupportedImageType('image/png'), true)
  assert.equal(isSupportedImageType('image/webp'), true)
  assert.equal(isSupportedImageType('image/gif'), false)
  assert.equal(isSupportedImageType('image/heic'), false)
  assert.equal(isSupportedImageType(undefined), false)
})

test('compressImageFile: di lingkungan tanpa DOM (node) fallback ke berkas asli', async () => {
  const fake = { type: 'image/jpeg', size: 1024 * 1024, name: 'foto.jpg' }
  const result = await compressImageFile(fake)
  assert.equal(result, fake)
})

test('compressImageFile: tipe tak didukung tidak diproses', async () => {
  const fake = { type: 'image/gif', size: 1024 * 1024, name: 'anim.gif' }
  const result = await compressImageFile(fake)
  assert.equal(result, fake)
})

test('compressImageFile: berkas kecil tidak dikompres ulang', async () => {
  const fake = { type: 'image/jpeg', size: 1024, name: 'kecil.jpg' }
  const result = await compressImageFile(fake)
  assert.equal(result, fake)
})
