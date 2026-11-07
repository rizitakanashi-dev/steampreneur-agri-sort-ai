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
  const rawKey = String(className).trim().toLowerCase().replace(/\s+/g, '-')
  const normalizedKey =
    rawKey === 'class-i'
      ? 'class-1'
      : rawKey === 'class-ii'
        ? 'class-2'
        : rawKey

  return CLASS_PALETTE[normalizedKey] || CLASS_PALETTE[rawKey] || DEFAULT_THEME
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

  // Ambil koordinat mentah
  const rawX1 = Number(box.x1) || 0
  const rawY1 = Number(box.y1) || 0
  const rawX2 = Number(box.x2) || rawX1
  const rawY2 = Number(box.y2) || rawY1

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
 * Menggambar satu kotak bounding box pada konteks Canvas 2D dengan aksen label pill.
 */
export function drawDetectionBox(ctx, { x, y, width, height }, theme, labelText, isSelected = false) {
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

  // 4. Gambar label pill
  if (labelText) {
    ctx.font = 'bold 11px Inter, sans-serif'
    const paddingX = 6
    const paddingY = 3
    const textMetrics = ctx.measureText(labelText)
    const textW = textMetrics.width
    const textH = 12
    const pillW = textW + paddingX * 2
    const pillH = textH + paddingY * 2

    // Posisikan label di atas kotak (jika ruang cukup), atau di dalam kotak
    let pillY = y - pillH
    if (pillY < 0) {
      pillY = y
    }

    // Gambar background pill
    ctx.fillStyle = theme.textBg
    if (typeof ctx.roundRect === 'function') {
      ctx.beginPath()
      ctx.roundRect(x, pillY, pillW, pillH, 4)
      ctx.fill()
    } else {
      ctx.fillRect(x, pillY, pillW, pillH)
    }

    // Tulis teks label
    ctx.fillStyle = '#ffffff'
    ctx.fillText(labelText, x + paddingX, pillY + textH + paddingY - 2)
  }

  ctx.restore()
}
