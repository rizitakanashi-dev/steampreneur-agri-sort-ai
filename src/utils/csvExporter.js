/**
 * Utilitas pembentuk dan pengunduh CSV.
 *
 * Dipisahkan dari komponen React agar bisa diuji dengan node --test
 * tanpa render atau akses DOM.
 *
 * Aturan format (kriteria change request):
 * - Baris pertama berisi header nama kolom.
 * - Angka ditulis murni: tanpa simbol mata uang dan tanpa pemisah ribuan.
 * - Pemisah kolom memakai koma, dan nilai yang mengandung koma, tanda kutip,
 *   atau baris baru di-escape sesuai aturan CSV (RFC 4180) agar aman di Excel.
 */

/** Karakter pemisah kolom CSV. */
export const CSV_SEPARATOR = ','

/** Baris baru yang dipakai: CRLF agar dikenali Excel di Windows maupun Linux. */
export const CSV_NEWLINE = '\r\n'

/**
 * Menulis satu nilai menjadi sel CSV yang aman.
 * - null/undefined menjadi sel kosong.
 * - Angka dikonversi apa adanya (15000 tetap "15000", bukan "Rp15.000").
 * - Nilai yang mengandung koma, kutip ganda, CR, atau LF dibungkus kutip ganda,
 *   dan kutip ganda di dalamnya digandakan.
 */
export function escapeCsvValue(value) {
  if (value === null || value === undefined) return ''
  const text = typeof value === 'number' ? String(value) : String(value)
  const needsQuoting = text.includes(CSV_SEPARATOR) || text.includes('"') || text.includes('\n') || text.includes('\r')
  if (!needsQuoting) return text
  return `"${text.replaceAll('"', '""')}"`
}

/** Mengubah matriks baris menjadi teks CSV lengkap. */
export function buildCsv(rows) {
  if (!Array.isArray(rows)) throw new TypeError('Baris CSV harus berupa array.')
  return rows.map((row) => row.map(escapeCsvValue).join(CSV_SEPARATOR)).join(CSV_NEWLINE)
}

const CSV_HEADERS = [
  'ID Batch',
  'Tanggal',
  'Komoditas',
  'Berat (kg)',
  'Kesegaran (%)',
  'Ukuran',
  'Cacat (%)',
  'Grade A (%)',
  'Grade B (%)',
  'Reject (%)',
  'Berat A (kg)',
  'Berat B (kg)',
  'Berat Reject (kg)',
  'Nilai A',
  'Nilai B',
  'Nilai Reject',
  'Total Nilai',
  'Catatan',
]

/**
 * Menyiapkan sel angka untuk CSV.
 * Angka dibulatkan maksimal 4 desimal agar sisa floating-point
 * (misalnya 4.305600000000001) tidak ikut tertulis ke berkas.
 * Bilangan bulat dan nilai Rupiah tidak berubah.
 */
function numericCell(value) {
  if (typeof value !== 'number' || !Number.isFinite(value)) return ''
  return Number(value.toFixed(4))
}

/** Mengubah daftar batch menjadi matriks baris CSV (header + data). */
export function buildHarvestCsvRows(batches = []) {
  const rows = [CSV_HEADERS]
  for (const batch of batches) {
    const result = batch.hasil || {}
    rows.push([
      batch.id,
      batch.tanggal,
      batch.komoditas,
      numericCell(batch.beratKg),
      numericCell(batch.kesegaranPersen),
      batch.ukuran,
      numericCell(batch.cacatPersen),
      numericCell(result.persenA),
      numericCell(result.persenB),
      numericCell(result.persenC),
      numericCell(result.beratA),
      numericCell(result.beratB),
      numericCell(result.beratC),
      numericCell(result.nilaiA),
      numericCell(result.nilaiB),
      numericCell(result.nilaiC),
      numericCell(result.totalNilai),
      batch.catatan ?? '',
    ])
  }
  return rows
}

/** Membuat teks CSV dari daftar batch yang sedang tampil. */
export function buildHarvestCsv(batches = []) {
  return buildCsv(buildHarvestCsvRows(batches))
}

function csvFileName(now = new Date()) {
  const stamp = now.toISOString().slice(0, 10)
  return `rekap-panen-${stamp}.csv`
}

/**
 * Mengunduh CSV di browser. Menambahkan BOM UTF-8 agar Excel membaca
 * karakter dengan benar, lalu memicu unduhan lewat anchor sementara.
 */
export function downloadCsv(batches, fileName) {
  if (typeof document === 'undefined') throw new Error('downloadCsv hanya dapat dipanggil di browser.')
  const csv = buildHarvestCsv(batches)
  const blob = new Blob([`\uFEFF${csv}`], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = fileName || csvFileName()
  anchor.style.display = 'none'
  document.body.appendChild(anchor)
  anchor.click()
  document.body.removeChild(anchor)
  URL.revokeObjectURL(url)
  return csv
}
