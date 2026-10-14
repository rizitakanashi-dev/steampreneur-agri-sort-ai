/**
 * Data referensi harga pasar.
 *
 * Sumber: tabel tetap di dalam kode (simulasi), sesuai docs/01-spesifikasi.md Bagian 6.2
 * dan Bagian 5 ("Integrasi harga BAPANAS atau API harga lain" berada di luar cakupan).
 * Ini BUKAN data BAPANAS resmi dan tidak mengambil data live dari API mana pun.
 *
 * Cara mengganti harga referensi: ubah angka pada REFERENCE_PRICES_PER_KG di file ini saja.
 * File lain membaca dari sini, jadi tidak perlu menyentuh komponen UI atau modul kalkulasi.
 */

export const PRICE_REFERENCE_SOURCE = Object.freeze({
  label: 'Simulasi (tabel tetap di dalam kode)',
  note: 'Bukan data resmi BAPANAS dan tidak diperbarui otomatis.',
  updatedAt: '2026-10-13',
})

/** Harga acuan Grade A per kg (Rp). Disetujui di docs/01-spesifikasi.md Bagian 6.2. */
export const REFERENCE_PRICES_PER_KG = Object.freeze({
  'Cabai Rawit Hijau': 30000,
  Terung: 10000,
  Tomat: 12000,
})

export const COMMODITY_OPTIONS = Object.freeze(Object.keys(REFERENCE_PRICES_PER_KG))

/**
 * Riwayat harga contoh untuk grafik tren.
 * Setiap titik diberi label simulasi dan tanggal eksplisit; bukan hasil pengambilan data nyata.
 */
export const PRICE_HISTORY = Object.freeze({
  'Cabai Rawit Hijau': Object.freeze([
    { label: '22 Sep', pricePerKg: 27500 },
    { label: '29 Sep', pricePerKg: 28200 },
    { label: '06 Okt', pricePerKg: 29400 },
    { label: '13 Okt', pricePerKg: 30000 },
  ]),
  Terung: Object.freeze([
    { label: '22 Sep', pricePerKg: 9200 },
    { label: '29 Sep', pricePerKg: 9500 },
    { label: '06 Okt', pricePerKg: 9800 },
    { label: '13 Okt', pricePerKg: 10000 },
  ]),
  Tomat: Object.freeze([
    { label: '22 Sep', pricePerKg: 10800 },
    { label: '29 Sep', pricePerKg: 11400 },
    { label: '06 Okt', pricePerKg: 11700 },
    { label: '13 Okt', pricePerKg: 12000 },
  ]),
})

export function getReferencePricePerKg(commodity) {
  return Object.hasOwn(REFERENCE_PRICES_PER_KG, commodity) ? REFERENCE_PRICES_PER_KG[commodity] : null
}

export function getPriceHistory(commodity) {
  return Object.hasOwn(PRICE_HISTORY, commodity) ? PRICE_HISTORY[commodity] : []
}
