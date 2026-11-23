/**
 * Formatter bersama untuk modul-modul pricing.
 * Dipisah dari PricingDashboard agar sub-komponen (kartu finansial,
 * modal triangulasi) tidak perlu duplikasi utilitas format.
 */

const rupiahFormatter = new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 })
const numberFormatter = new Intl.NumberFormat('id-ID', { maximumFractionDigits: 2 })

export function formatRupiah(value) {
  return typeof value === 'number' && Number.isFinite(value)
    ? rupiahFormatter.format(value).replace(/^Rp\s*/, 'Rp ')
    : '-'
}

export function formatNumber(value) {
  return typeof value === 'number' && Number.isFinite(value) ? numberFormatter.format(value) : '-'
}
