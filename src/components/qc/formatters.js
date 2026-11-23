/**
 * Formatter bersama untuk modul-modul QC.
 * Catatan: formatRupiah versi QC mengembalikan 'Belum tersedia' untuk nilai
 * tidak valid (beda dengan versi pricing yang mengembalikan '-').
 */

const numberFormatter = new Intl.NumberFormat('id-ID', { maximumFractionDigits: 2 })
const rupiahFormatter = new Intl.NumberFormat('id-ID', {
  style: 'currency',
  currency: 'IDR',
  maximumFractionDigits: 0,
})

export function formatNumber(value) {
  return typeof value === 'number' && Number.isFinite(value) ? numberFormatter.format(value) : '-'
}

export function formatRupiah(value) {
  return typeof value === 'number' && Number.isFinite(value)
    ? rupiahFormatter.format(value).replace(/^Rp\s*/, 'Rp ')
    : 'Belum tersedia'
}
