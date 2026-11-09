import test from 'node:test'
import assert from 'node:assert/strict'
import { calculatePixelDifference, isSceneStationary } from '../src/utils/imageSimilarity.js'

test('calculatePixelDifference mengembalikan 0.0 untuk array piksel identik', () => {
  const a = new Uint8Array([100, 150, 200, 50])
  const b = new Uint8Array([100, 150, 200, 50])

  const diff = calculatePixelDifference(a, b)
  assert.equal(diff, 0.0)
})

test('calculatePixelDifference menghitung perbedaan rata-rata dengan akurat', () => {
  const a = new Uint8Array([0, 0, 0, 0])
  const b = new Uint8Array([255, 255, 255, 255])

  const diff = calculatePixelDifference(a, b)
  assert.equal(diff, 1.0)
})

test('calculatePixelDifference menangani input tidak valid atau panjang berbeda secara aman', () => {
  assert.equal(calculatePixelDifference(null, null), 1.0)
  assert.equal(calculatePixelDifference([], []), 1.0)
  assert.equal(calculatePixelDifference([1, 2], [1, 2, 3]), 1.0)
})

test('isSceneStationary mendeteksi frame statis dengan fluktuasi sensor noise kecil (<4.5%)', () => {
  // Simulasi 2 frame kamera diam dengan noise sensor kecil (+/- 2 nilai pada skala 0-255)
  const frame1 = new Uint8Array([120, 130, 140, 150, 160, 170, 180, 190])
  const frame2 = new Uint8Array([121, 129, 141, 150, 161, 169, 181, 190])

  assert.equal(isSceneStationary(frame1, frame2), true)
})

test('isSceneStationary mendeteksi frame bergerak / goyang nampan saat sampel berubah (>15%)', () => {
  // Simulasi sampel panen yang berguling/berotasi setelah nampan digoyang
  const frame1 = new Uint8Array([30, 40, 50, 60, 200, 210, 220, 230])
  const frame2 = new Uint8Array([210, 220, 230, 240, 40, 50, 60, 70])

  assert.equal(isSceneStationary(frame1, frame2), false)
})

