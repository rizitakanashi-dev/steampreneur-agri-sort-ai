/**
 * Helper Fungsi & Tema Warna Deteksi Citra Panen — Agri-Sort AI
 * Tanggung Jawab: Fullstack Developer (Frontend Visuals)
 * Dokumen Acuan: docs/rencana-kerja-fullstack.md (Task FS-FE-02)
 *
 * Mengelola kalkulasi matematika penskalaan koordinat bounding box (STEAM Math)
 * dan sistem palet warna multi-kelas untuk Tomat dan Terung.
 */

export const CLASS_PALETTE = Object.freeze({
  // Komoditas Tomat (2 Kelas)
  'fresh-tomato': {
    stroke: '#047857', // Emerald green
    fill: 'rgba(4, 120, 87, 0.18)',
    textBg: '#047857',
    label: 'Tomat Segar',
    badge: 'Segar',
  },
  'rotten-tomato': {
    stroke: '#b91c1c', // Ruby red
    fill: 'rgba(185, 28, 28, 0.24)',
    textBg: '#b91c1c',
    label: 'Tomat Busuk',
    badge: 'Cacat/Busuk',
  },

  // Komoditas Terung & Cabai (Standar 3-Grade Mutu Pasar)
  'grade-a': {
    stroke: '#059669', // Deep emerald
    fill: 'rgba(5, 150, 105, 0.20)',
    textBg: '#059669',
    label: 'Grade A',
    badge: 'Mutu Prima',
  },
  'grade-b': {
    stroke: '#d97706', // Amber
    fill: 'rgba(217, 119, 6, 0.22)',
    textBg: '#d97706',
    label: 'Grade B',
    badge: 'Mutu Pasar',
  },

  // Komoditas Terung (4 Kelas Standar Mutu Komersial FFV-05)
  'extra-class': {
    stroke: '#059669', // Deep emerald
    fill: 'rgba(5, 150, 105, 0.20)',
    textBg: '#059669',
    label: 'Extra Class',
    badge: 'Mutu Super',
  },
  'class-1': {
    stroke: '#0284c7', // Sky blue
    fill: 'rgba(2, 132, 199, 0.18)',
    textBg: '#0284c7',
    label: 'Class 1',
    badge: 'Mutu Kelas I',
  },
  'class-2': {
    stroke: '#d97706', // Amber
    fill: 'rgba(217, 119, 6, 0.22)',
    textBg: '#d97706',
    label: 'Class 2',
    badge: 'Mutu Kelas II',
  },
  reject: {
    stroke: '#dc2626', // Bright red
    fill: 'rgba(220, 38, 38, 0.25)',
    textBg: '#dc2626',
    label: 'Reject',
    badge: 'Afkir',
  },
})

export const DEFAULT_THEME = Object.freeze({
  stroke: '#4f46e5',
  fill: 'rgba(79, 70, 229, 0.18)',
  textBg: '#4f46e5',
  label: 'Objek',
  badge: 'Deteksi',
})

/**
 * Mengambil palet warna dan label ramah pengguna berdasarkan class_name model AI.
 * Mendukung format slug ('class-1') maupun format asli Roboflow ('Class I', 'Class II', 'Extra Class').
 */
export function getClassTheme(className) {
  if (!className) return DEFAULT_THEME
  const raw = String(className).trim().toLowerCase()
  const rawSlug = raw.replace(/\s+/g, '-')

  if (CLASS_PALETTE[rawSlug]) return CLASS_PALETTE[rawSlug]
  if (CLASS_PALETTE[raw]) return CLASS_PALETTE[raw]

  // Normalisasi alias nama kelas model YOLO (Terung 3/4-Kelas & Tomat 2-Kelas)
  if (raw === 'grade a' || raw === 'grade-a') {
    return CLASS_PALETTE['grade-a']
  }
  if (raw === 'grade b' || raw === 'grade-b') {
    return CLASS_PALETTE['grade-b']
  }
  if (raw === 'class ii' || raw === 'class 2' || raw === 'class-2' || rawSlug === 'class-ii') {
    return CLASS_PALETTE['class-2']
  }
  if (raw === 'class i' || raw === 'class 1' || raw === 'class-1' || rawSlug === 'class-i') {
    return CLASS_PALETTE['class-1']
  }
  if (raw.includes('extra')) {
    return CLASS_PALETTE['extra-class']
  }
  if (raw.includes('reject') || raw.includes('afkir')) {
    return CLASS_PALETTE['reject']
  }
  if (raw.includes('fresh')) {
    return CLASS_PALETTE['fresh-tomato']
  }
  if (raw.includes('rotten')) {
    return CLASS_PALETTE['rotten-tomato']
  }
  return DEFAULT_THEME
}

/**
 * Menghitung penskalaan proporsional koordinat bounding box dari resolusi asli citra
 * ke resolusi kanvas tampilan di peramban (STEAM Coordinate Geometry).
 */
export function scaleBoundingBox(box, originalDimensions, displayDimensions) {
  if (!box || typeof box !== 'object') {
    return { x: 0, y: 0, width: 0, height: 0, x1: 0, y1: 0, x2: 0, y2: 0 }
  }

  const origW = Number(originalDimensions?.width) || 1
  const origH = Number(originalDimensions?.height) || 1
  const dispW = Number(displayDimensions?.width) || origW
  const dispH = Number(displayDimensions?.height) || origH

  const scaleX = dispW / origW
  const scaleY = dispH / origH

  // Ambil koordinat mentah dengan dukungan multi-format bounding box
  let rawX1 = 0
  let rawY1 = 0
  let rawX2 = 0
  let rawY2 = 0

  if (Array.isArray(box)) {
    rawX1 = Number(box[0]) || 0
    rawY1 = Number(box[1]) || 0
    rawX2 = Number(box[2]) || rawX1
    rawY2 = Number(box[3]) || rawY1
  } else if (box.xmin !== undefined || box.ymin !== undefined) {
    rawX1 = Number(box.xmin) || 0
    rawY1 = Number(box.ymin) || 0
    rawX2 = Number(box.xmax) || rawX1
    rawY2 = Number(box.ymax) || rawY1
  } else if (box.width !== undefined && box.height !== undefined && (box.x !== undefined || box.y !== undefined)) {
    rawX1 = Number(box.x) || 0
    rawY1 = Number(box.y) || 0
    rawX2 = rawX1 + (Number(box.width) || 0)
    rawY2 = rawY1 + (Number(box.height) || 0)
  } else {
    rawX1 = Number(box.x1) || 0
    rawY1 = Number(box.y1) || 0
    rawX2 = Number(box.x2) || rawX1
    rawY2 = Number(box.y2) || rawY1
  }

  // Skalakan dan pastikan tidak keluar dari batas kanvas (Clamping)
  const x1 = Math.max(0, Math.min(dispW, rawX1 * scaleX))
  const y1 = Math.max(0, Math.min(dispH, rawY1 * scaleY))
  const x2 = Math.max(x1, Math.min(dispW, rawX2 * scaleX))
  const y2 = Math.max(y1, Math.min(dispH, rawY2 * scaleY))

  const width = Math.max(0, x2 - x1)
  const height = Math.max(0, y2 - y1)

  return {
    x: Math.round(x1),
    y: Math.round(y1),
    width: Math.round(width),
    height: Math.round(height),
    x1,
    y1,
    x2,
    y2,
  }
}

/**
 * Memformat label kelas dan persentase keyakinan model.
 */
export function formatConfidenceLabel(className, confidence) {
  const theme = getClassTheme(className)
  const confPercent =
    typeof confidence === 'number' && Number.isFinite(confidence)
      ? Math.round(confidence * 100)
      : null

  if (confPercent !== null) {
    return `${theme.label} ${confPercent}%`
  }
  return theme.label
}

/**
 * Places annotation pills so dense detections keep readable, non-overlapping labels.
 */
export function placeDetectionLabels(items, dimensions, measureText) {
  const canvasWidth = Math.max(0, Number(dimensions?.width) || 0)
  const canvasHeight = Math.max(0, Number(dimensions?.height) || 0)
  const labelHeight = 18
  const gap = 2
  const placed = []

  const normalized = (items || []).map((item, index) => {
    const box = item?.box || {}
    const label = String(item?.label || '')
    const textWidth = Math.max(0, Number(measureText(label)) || 0)
    return {
      index,
      label,
      box,
      width: Math.min(canvasWidth, Math.ceil(textWidth + 12)),
      height: Math.min(labelHeight, canvasHeight),
    }
  })

  // Give upper, left-most fruit first dibs on available label space.
  normalized.sort((a, b) => (a.box.y - b.box.y) || (a.box.x - b.box.x) || (a.index - b.index))

  for (const item of normalized) {
    const maxX = Math.max(0, canvasWidth - item.width)
    const maxY = Math.max(0, canvasHeight - item.height)
    const preferredY = item.box.y - item.height
    const preferredX = item.box.x
    const candidates = []

    for (let y = 0; y <= maxY; y += labelHeight + gap) {
      const anchorX = Math.max(0, Math.min(maxX, preferredX))
      const rightX = Math.max(0, Math.min(maxX, item.box.x + item.box.width - item.width))
      const centerX = Math.max(0, Math.min(maxX, item.box.x + (item.box.width - item.width) / 2))
      for (const x of new Set([anchorX, rightX, centerX, 0, maxX])) {
        candidates.push({
          x,
          y,
          score: Math.abs(y - preferredY) * 2 + Math.abs(x - preferredX),
        })
      }
    }
    candidates.sort((a, b) => a.score - b.score)

    const position = candidates.find((candidate) =>
      placed.every((other) =>
        candidate.x + item.width + gap <= other.x ||
        other.x + other.width + gap <= candidate.x ||
        candidate.y + item.height + gap <= other.y ||
        other.y + other.height + gap <= candidate.y
      )
    ) || candidates[0] || { x: 0, y: 0 }

    placed.push({ ...position, width: item.width, height: item.height, index: item.index })
  }

  const result = new Array(normalized.length)
  for (const position of placed) {
    result[position.index] = {
      x: Math.round(position.x),
      y: Math.round(position.y),
      width: position.width,
      height: position.height,
    }
  }
  return result
}

/** Paint one annotation pill at its precomputed non-overlapping position. */
export function drawDetectionLabel(ctx, theme, labelText, labelPosition) {
  if (!ctx || !labelText || !labelPosition) return
  const paddingX = 6
  const paddingY = 3
  const textH = 12
  const textW = ctx.measureText(labelText).width
  const pillW = textW + paddingX * 2
  const pillH = textH + paddingY * 2
  ctx.fillStyle = theme.textBg
  if (typeof ctx.roundRect === 'function') {
    ctx.beginPath()
    ctx.roundRect(labelPosition.x, labelPosition.y, pillW, pillH, 4)
    ctx.fill()
  } else {
    ctx.fillRect(labelPosition.x, labelPosition.y, pillW, pillH)
  }
  ctx.fillStyle = '#ffffff'
  ctx.fillText(labelText, labelPosition.x + paddingX, labelPosition.y + textH + paddingY - 2)
}

/**
 * Menggambar satu kotak bounding box pada konteks Canvas 2D dengan aksen label pill.
 */
export function drawDetectionBox(ctx, { x, y, width, height }, theme, labelText, isSelected = false, labelPosition = null) {
  if (!ctx || width <= 0 || height <= 0) return

  ctx.save()

  // 1. Gambar isian semi-transparan
  ctx.fillStyle = isSelected ? theme.fill.replace('0.18', '0.35').replace('0.20', '0.38') : theme.fill
  ctx.fillRect(x, y, width, height)

  // 2. Gambar garis pembatas (Stroke)
  ctx.strokeStyle = theme.stroke
  ctx.lineWidth = isSelected ? 3 : 2
  ctx.lineJoin = 'round'
  ctx.strokeRect(x, y, width, height)

  // 3. Gambar sudut aksen visual (Corner brackets) untuk kesan teknologi Computer Vision modern
  const cornerLen = Math.min(12, width / 4, height / 4)
  ctx.strokeStyle = '#ffffff'
  ctx.lineWidth = 2

  // Sudut Kiri-Atas
  ctx.beginPath()
  ctx.moveTo(x, y + cornerLen)
  ctx.lineTo(x, y)
  ctx.lineTo(x + cornerLen, y)
  ctx.stroke()

  // Sudut Kanan-Bawah
  ctx.beginPath()
  ctx.moveTo(x + width - cornerLen, y + height)
  ctx.lineTo(x + width, y + height)
  ctx.lineTo(x + width, y + height - cornerLen)
  ctx.stroke()

  // 4. Gambar label di lokasi terhindar dari label deteksi lain.
  if (labelText) {
    ctx.font = 'bold 11px Inter, sans-serif'
    drawDetectionLabel(ctx, theme, labelText, labelPosition || { x, y: Math.max(0, y - 18) })
  }

  ctx.restore()
}
