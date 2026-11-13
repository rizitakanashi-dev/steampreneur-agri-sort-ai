import test from 'node:test'
import assert from 'node:assert/strict'
import {
  CLASS_PALETTE,
  DEFAULT_THEME,
  drawDetectionBox,
  formatConfidenceLabel,
  getClassTheme,
  scaleBoundingBox,
} from '../src/utils/canvasOverlayHelper.js'

test('getClassTheme mengembalikan tema warna yang tepat untuk tiap kelas Tomat & Terung', () => {
  // Tomat
  assert.equal(getClassTheme('fresh-tomato').stroke, '#047857')
  assert.equal(getClassTheme('rotten-tomato').stroke, '#b91c1c')

  // Terung (4 Kelas Mutu Komersial)
  assert.equal(getClassTheme('extra-class').stroke, '#059669')
  assert.equal(getClassTheme('class-1').stroke, '#0284c7')
  assert.equal(getClassTheme('class-2').stroke, '#d97706')
  assert.equal(getClassTheme('reject').stroke, '#dc2626')

  // Dukungan format kelas asli Roboflow dataset Terung
  assert.equal(getClassTheme('Extra Class').stroke, '#059669')
  assert.equal(getClassTheme('Class I').stroke, '#0284c7')
  assert.equal(getClassTheme('Class II').stroke, '#d97706')
  assert.equal(getClassTheme('Reject').stroke, '#dc2626')

  // Case-insensitive & whitespace trimming
  assert.equal(getClassTheme('  Fresh-Tomato  ').stroke, '#047857')

  // Unknown class fallback
  assert.equal(getClassTheme('unknown_fruit'), DEFAULT_THEME)
  assert.equal(getClassTheme(null), DEFAULT_THEME)
})

test('scaleBoundingBox melakukan penskalaan koordinat dengan rasio presisi', () => {
  const origDims = { width: 1280, height: 720 }
  const dispDims = { width: 640, height: 360 } // Skala 0.5x

  const box = { x1: 100, y1: 80, x2: 300, y2: 240 }
  const scaled = scaleBoundingBox(box, origDims, dispDims)

  assert.equal(scaled.x, 50)
  assert.equal(scaled.y, 40)
  assert.equal(scaled.width, 100)
  assert.equal(scaled.height, 80)
})

test('scaleBoundingBox melakukan clamping batas kanvas jika koordinat melebihi dimensi', () => {
  const origDims = { width: 1000, height: 1000 }
  const dispDims = { width: 500, height: 500 }

  // Koordinat negatif dan koordinat melebihi lebar asli
  const box = { x1: -50, y1: -20, x2: 1200, y2: 1500 }
  const scaled = scaleBoundingBox(box, origDims, dispDims)

  assert.equal(scaled.x, 0)
  assert.equal(scaled.y, 0)
  assert.equal(scaled.width, 500)
  assert.equal(scaled.height, 500)
})

test('scaleBoundingBox menangani box invalid secara aman tanpa error', () => {
  const scaledNull = scaleBoundingBox(null, { width: 100, height: 100 }, { width: 100, height: 100 })
  assert.equal(scaledNull.width, 0)
  assert.equal(scaledNull.height, 0)

  const scaledEmpty = scaleBoundingBox({}, { width: 100, height: 100 }, { width: 100, height: 100 })
  assert.equal(scaledEmpty.width, 0)
  assert.equal(scaledEmpty.height, 0)
})

test('scaleBoundingBox mendukung multi-format bounding box (array, xmin/ymin, x/y/width/height)', () => {
  const origDims = { width: 1000, height: 1000 }
  const dispDims = { width: 500, height: 500 } // Skala 0.5x

  // Format array [x1, y1, x2, y2]
  const arrayBox = [200, 100, 600, 500]
  const scaledArray = scaleBoundingBox(arrayBox, origDims, dispDims)
  assert.equal(scaledArray.x, 100)
  assert.equal(scaledArray.y, 50)
  assert.equal(scaledArray.width, 200)
  assert.equal(scaledArray.height, 200)

  // Format xmin, ymin, xmax, ymax
  const xminBox = { xmin: 200, ymin: 100, xmax: 600, ymax: 500 }
  const scaledXmin = scaleBoundingBox(xminBox, origDims, dispDims)
  assert.equal(scaledXmin.x, 100)
  assert.equal(scaledXmin.y, 50)
  assert.equal(scaledXmin.width, 200)
  assert.equal(scaledXmin.height, 200)

  // Format x, y, width, height
  const xywhBox = { x: 200, y: 100, width: 400, height: 400 }
  const scaledXywh = scaleBoundingBox(xywhBox, origDims, dispDims)
  assert.equal(scaledXywh.x, 100)
  assert.equal(scaledXywh.y, 50)
  assert.equal(scaledXywh.width, 200)
  assert.equal(scaledXywh.height, 200)
})

test('formatConfidenceLabel memformat nama kelas dan persentase', () => {
  assert.equal(formatConfidenceLabel('fresh-tomato', 0.942), 'Tomat Segar 94%')
  assert.equal(formatConfidenceLabel('extra-class', 0.918), 'Extra Class 92%')
  assert.equal(formatConfidenceLabel('class-1', 0.88), 'Class 1 88%')
  assert.equal(formatConfidenceLabel('reject', 0.75), 'Reject 75%')

  // Tanpa confidence score
  assert.equal(formatConfidenceLabel('fresh-tomato', null), 'Tomat Segar')
  assert.equal(formatConfidenceLabel('rotten-tomato', undefined), 'Tomat Busuk')
})

test('drawDetectionBox menolak eksekusi pada dimensi nol atau konteks null tanpa crash', () => {
  // Konteks null
  assert.doesNotThrow(() => {
    drawDetectionBox(null, { x: 0, y: 0, width: 100, height: 100 }, DEFAULT_THEME, 'Test')
  })

  // Dimensi nol
  const dummyCtx = {}
  assert.doesNotThrow(() => {
    drawDetectionBox(dummyCtx, { x: 0, y: 0, width: 0, height: 0 }, DEFAULT_THEME, 'Test')
  })
})

test('drawDetectionBox memanggil fungsi kanvas dasar secara tepat', () => {
  const calls = []
  const mockCtx = {
    save: () => calls.push('save'),
    restore: () => calls.push('restore'),
    fillRect: (x, y, w, h) => calls.push(`fillRect:${x},${y},${w},${h}`),
    strokeRect: (x, y, w, h) => calls.push(`strokeRect:${x},${y},${w},${h}`),
    beginPath: () => calls.push('beginPath'),
    moveTo: () => calls.push('moveTo'),
    lineTo: () => calls.push('lineTo'),
    stroke: () => calls.push('stroke'),
    fillText: () => calls.push('fillText'),
    measureText: () => ({ width: 40 }),
  }

  const box = { x: 10, y: 20, width: 100, height: 80 }
  const theme = CLASS_PALETTE['fresh-tomato']

  drawDetectionBox(mockCtx, box, theme, 'Tomat Segar 94%')

  assert.ok(calls.includes('save'))
  assert.ok(calls.includes('restore'))
  assert.ok(calls.includes('fillRect:10,20,100,80'))
  assert.ok(calls.includes('strokeRect:10,20,100,80'))
  assert.ok(calls.includes('fillText'))
})

