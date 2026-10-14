/**
 * Logika pencarian dan filter untuk halaman rekap.
 *
 * Dipisahkan dari komponen React supaya bisa diuji dengan node --test
 * tanpa render. Komponen hanya memanggil fungsi ini dan menampilkan hasilnya.
 */

/** Nilai awal filter — dipakai juga oleh tombol reset. */
export const EMPTY_RECAP_FILTER = Object.freeze({
  search: '',
  komoditas: '',
  tanggalDari: '',
  tanggalSampai: '',
})

/** True jika filter masih sama dengan kondisi awal (tidak ada filter aktif). */
export function isFilterEmpty(filter = {}) {
  return (
    !String(filter.search ?? '').trim() &&
    !String(filter.komoditas ?? '').trim() &&
    !String(filter.tanggalDari ?? '').trim() &&
    !String(filter.tanggalSampai ?? '').trim()
  )
}

function matchesSearch(batch, search) {
  const keyword = String(search ?? '').trim().toLowerCase()
  if (!keyword) return true
  const id = String(batch?.id ?? '').toLowerCase()
  const commodity = String(batch?.komoditas ?? '').toLowerCase()
  return id.includes(keyword) || commodity.includes(keyword)
}

function matchesCommodity(batch, commodity) {
  const selected = String(commodity ?? '').trim()
  if (!selected) return true
  return String(batch?.komoditas ?? '') === selected
}

function matchesDateRange(batch, from, to) {
  const date = String(batch?.tanggal ?? '')
  if (!date) return true
  const start = String(from ?? '').trim()
  const end = String(to ?? '').trim()
  if (start && date < start) return false
  if (end && date > end) return false
  return true
}

/**
 * Menerapkan pencarian, filter komoditas, dan rentang tanggal sekaligus.
 * Semua kondisi harus terpenuhi (AND); filter yang kosong diabaikan.
 */
export function filterBatches(batches = [], filter = {}) {
  return batches.filter((batch) => (
    matchesSearch(batch, filter.search) &&
    matchesCommodity(batch, filter.komoditas) &&
    matchesDateRange(batch, filter.tanggalDari, filter.tanggalSampai)
  ))
}

/** Mengurutkan batch dari yang terbaru, lalu yang paling akhir disimpan. */
export function sortBatchesByNewest(batches = []) {
  return [...batches].sort((a, b) => {
    const dateDifference = String(b.tanggal ?? '').localeCompare(String(a.tanggal ?? ''))
    return dateDifference || String(b.dicatatPada ?? '').localeCompare(String(a.dicatatPada ?? ''))
  })
}

/** Daftar komoditas unik dari data yang tersimpan, untuk pilihan filter. */
export function listCommodities(batches = []) {
  return [...new Set(batches.map((batch) => batch?.komoditas).filter(Boolean))].sort((a, b) => a.localeCompare(b))
}
