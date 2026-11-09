/**
 * Utilitas Analisis Kemiripan Citra & Deteksi Gerakan Kamera — Agri-Sort AI
 * Tanggung Jawab: Fullstack Developer (Anti-Fraud & Computer Vision)
 * Dokumen Acuan: AUDIT-AGRI-SORT-AI (Temuan B5: Live Camera Silent Stationary Fraud)
 *
 * Mengatasi kelemahan deteksi kecurangan pada Live Camera di mana sensor noise
 * menyebabkan byte JPEG berbeda meskipun kamera dan objek panen tidak bergerak sama sekali.
 */

/**
 * Menghitung Mean Absolute Difference (MAD) antara dua array intensitas piksel greyscale.
 *
 * @param {ArrayLike<number>} pixelsA - Array piksel greyscale citra A (0 - 255)
 * @param {ArrayLike<number>} pixelsB - Array piksel greyscale citra B (0 - 255)
 * @returns {number} Nilai disparitas normalisasi 0.0 (identik 100%) hingga 1.0 (berbeda total)
 */
export function calculatePixelDifference(pixelsA, pixelsB) {
  if (!pixelsA || !pixelsB || pixelsA.length === 0 || pixelsA.length !== pixelsB.length) {
    return 1.0
  }

  let totalDiff = 0
  const len = pixelsA.length
  for (let i = 0; i < len; i++) {
    totalDiff += Math.abs(pixelsA[i] - pixelsB[i])
  }

  return totalDiff / (len * 255)
}

/**
 * Mengevaluasi apakah dua sidik jari piksel terindikasi statis / tidak bergerak (kamera diam).
 *
 * @param {ArrayLike<number>} thumbA - Sidik jari greyscale foto 1
 * @param {ArrayLike<number>} thumbB - Sidik jari greyscale foto 2
 * @param {number} threshold - Ambang batas toleransi perbedaan (default 0.045 atau 4.5%)
 * @returns {boolean} True jika adegan terdeteksi statis (tidak ada pergerakan/goyang sampel)
 */
export function isSceneStationary(thumbA, thumbB, threshold = 0.045) {
  if (!thumbA || !thumbB) return false
  const diff = calculatePixelDifference(thumbA, thumbB)
  return diff < threshold
}

/**
 * Mengekstrak sidik jari greyscale berukuran kecil (default 16x16 = 256 piksel)
 * dari elemen Canvas, Video, atau Image di lingkungan browser.
 *
 * @param {HTMLCanvasElement|HTMLVideoElement|HTMLImageElement} source - Elemen visual sumber
 * @param {number} size - Ukuran dimensi persegi (default 16 piksel)
 * @returns {Uint8Array|null} Array piksel greyscale bernilai 0-255, atau null jika gagal/non-browser
 */
export function extractGreyscaleThumbnail(source, size = 16) {
  if (typeof document === 'undefined' || !source) return null

  try {
    const canvas = document.createElement('canvas')
    canvas.width = size
    canvas.height = size
    const ctx = canvas.getContext('2d', { willReadFrequently: true })
    if (!ctx) return null

    ctx.drawImage(source, 0, 0, size, size)
    const imgData = ctx.getImageData(0, 0, size, size).data
    const greyscale = new Uint8Array(size * size)

    for (let i = 0; i < greyscale.length; i++) {
      const idx = i * 4
      // Standar koefisien luma ITU-R BT.601: 0.299 R + 0.587 G + 0.114 B
      greyscale[i] = Math.round(
        imgData[idx] * 0.299 + imgData[idx + 1] * 0.587 + imgData[idx + 2] * 0.114
      )
    }

    return greyscale
  } catch (err) {
    console.warn('Gagal mengekstrak sidik jari greyscale:', err)
    return null
  }
}

