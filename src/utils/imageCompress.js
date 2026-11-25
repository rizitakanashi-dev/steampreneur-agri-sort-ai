// Util kompresi citra sisi klien (Paket 2 "Unggah Cerdas").
// Foto dikompres di HP sebelum dikirim ke backend FastAPI:
// payload 3-5x lebih kecil, upload cepat di jaringan lambat, hemat kuota —
// sementara resolusi tetap cukup untuk model YOLO (sisi terpanjang 1600px).
//
// Desain aman: bila kompresi tidak tersedia/gagal, fungsi mengembalikan
// berkas ASLI — alur scan tidak pernah terhenti karena kompresi.

export const MAX_SCAN_IMAGE_SIDE = 1600
export const COMPRESSED_JPEG_QUALITY = 0.85
// Berkas kecil tidak dikompres ulang (hindari degradasi kualitas & CPU sia-sia)
export const SKIP_COMPRESSION_BELOW_BYTES = 350 * 1024

/**
 * Pure & testable: hitung dimensi target dengan sisi terpanjang dibatasi
 * maxSide. Tidak pernah memperbesar citra yang sudah kecil.
 */
export function computeTargetDimensions(width, height, maxSide = MAX_SCAN_IMAGE_SIDE) {
  if (!Number.isFinite(width) || !Number.isFinite(height) || width <= 0 || height <= 0 || maxSide <= 0) {
    return { width: 0, height: 0 }
  }
  if (width <= maxSide && height <= maxSide) {
    return { width, height }
  }
  const ratio = width >= height ? maxSide / width : maxSide / height
  return {
    width: Math.max(1, Math.round(width * ratio)),
    height: Math.max(1, Math.round(height * ratio)),
  }
}

/** Tipe berkas yang diterima pipeline scan (selaras validasi frontend & backend). */
export function isSupportedImageType(type) {
  return ['image/jpeg', 'image/png', 'image/webp'].includes(type)
}

/** Dekode gambar ke bitmap/element siap digambar ke canvas (dengan orientasi EXIF). */
async function decodeImage(file) {
  if (typeof createImageBitmap === 'function') {
    try {
      // imageOrientation 'from-image': hormati metadata rotasi EXIF kamera HP
      return await createImageBitmap(file, { imageOrientation: 'from-image' })
    } catch {
      /* jatuh ke fallback <img> di bawah */
    }
  }
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file)
    const img = new Image()
    img.onload = () => {
      URL.revokeObjectURL(url)
      resolve(img)
    }
    img.onerror = () => {
      URL.revokeObjectURL(url)
      reject(new Error('Gagal memuat gambar'))
    }
    img.src = url
  })
}

/**
 * Kompres berkas gambar menjadi JPEG dengan sisi terpanjang <= maxSide.
 * Mengembalikan File ASLI bila: tipe tak didukung, ukuran sudah kecil,
 * lingkungan tanpa DOM (node/test), atau kompresi gagal — fallback selalu aman.
 */
export async function compressImageFile(file, { maxSide = MAX_SCAN_IMAGE_SIDE, quality = COMPRESSED_JPEG_QUALITY } = {}) {
  if (typeof document === 'undefined' || !file || !isSupportedImageType(file.type)) return file
  if (file.size <= SKIP_COMPRESSION_BELOW_BYTES) return file

  try {
    const source = await decodeImage(file)
    const srcW = source.width || source.naturalWidth
    const srcH = source.height || source.naturalHeight
    const { width, height } = computeTargetDimensions(srcW, srcH, maxSide)
    if (!width || !height) return file

    // Sudah sesuai target & ukurannya wajar? Pakai asli (hindari generasi-kedua JPEG)
    if (width === srcW && height === srcH && file.type === 'image/jpeg' && file.size < 1.5 * 1024 * 1024) {
      return file
    }

    const canvas = document.createElement('canvas')
    canvas.width = width
    canvas.height = height
    const ctx = canvas.getContext('2d')
    if (!ctx) return file
    // Latar putih: PNG transparan tidak jadi hitam saat diubah ke JPEG
    ctx.fillStyle = '#ffffff'
    ctx.fillRect(0, 0, width, height)
    ctx.drawImage(source, 0, 0, width, height)
    if (typeof source.close === 'function') source.close()

    const blob = await new Promise((resolve) => canvas.toBlob(resolve, 'image/jpeg', quality))
    if (!blob || blob.size >= file.size) return file

    const name = `${(file.name || 'scan').replace(/\.[^.]+$/, '')}.jpg`
    return new File([blob], name, { type: 'image/jpeg', lastModified: Date.now() })
  } catch (err) {
    console.warn('Kompresi gambar gagal, memakai berkas asli:', err)
    return file
  }
}
