/**
 * Data & helper untuk komparasi harga resmi pemerintah (SP2KP Kemendag vs acuan lokal).
 * Dipisah dari PricingDashboard agar data statis tidak membebani komponen utama.
 */

export function mapComparisonKeyToCommodity(key, name) {
  const norm = String(name || key || '').trim().toLowerCase()
  if (norm.includes('keriting') || (norm.includes('cabai merah') && !norm.includes('rawit'))) {
    return 'Cabai Merah Keriting'
  }
  if (norm.includes('rawit merah') || norm.includes('setan')) {
    return 'Cabai Rawit Merah'
  }
  if (norm.includes('rawit')) {
    return 'Cabai Rawit Hijau'
  }
  if (norm.includes('terung') || norm.includes('terong')) {
    return 'Terung'
  }
  if (norm.includes('tomat')) {
    return 'Tomat'
  }
  return null
}

export const DEFAULT_GOVERNMENT_COMPARISON = Object.freeze({
  title: 'Triangulasi Harga Pangan Resmi Pemerintah RI',
  region: 'Sumatera Barat',
  market_center: 'Pasar Ibuh Payakumbuh',
  date: '2026-11-08',
  last_synced: '2026-11-08T07:00:00+07:00',
  institutions: {
    bapanas: {
      name: 'Acuan Lokal (Simulasi)',
      url: 'https://panelharga.badanpangan.go.id',
    },
    kemendag: {
      name: 'Kementerian Perdagangan (SP2KP Kemendag RI)',
      url: 'https://sp2kp.kemendag.go.id/',
    },
  },
  comparison: Object.freeze([
    {
      commodity_key: 'cabai merah keriting',
      commodity_name: 'Cabai Merah Keriting',
      bapanas_price_per_kg: 45000,
      sp2kp_kemendag_price_per_kg: 44800,
      composite_fair_price: 44900,
      disparity_rp: 200,
      convergence_index_percent: 99.55,
      market: 'Pasar Ibuh Payakumbuh',
      region: 'Sumatera Barat',
    },
    {
      commodity_key: 'cabai rawit merah',
      commodity_name: 'Cabai Rawit Merah',
      bapanas_price_per_kg: 42000,
      sp2kp_kemendag_price_per_kg: 42500,
      composite_fair_price: 42250,
      disparity_rp: 500,
      convergence_index_percent: 98.82,
      market: 'Pasar Ibuh Payakumbuh',
      region: 'Sumatera Barat',
    },
    {
      commodity_key: 'cabai rawit hijau',
      commodity_name: 'Cabai Rawit Hijau',
      bapanas_price_per_kg: 30000,
      sp2kp_kemendag_price_per_kg: 30000,
      composite_fair_price: 30000,
      disparity_rp: 0,
      convergence_index_percent: 100.0,
      market: 'Pasar Ibuh Payakumbuh',
      region: 'Sumatera Barat',
    },
    {
      commodity_key: 'tomat',
      commodity_name: 'Tomat',
      bapanas_price_per_kg: 12000,
      sp2kp_kemendag_price_per_kg: 12000,
      composite_fair_price: 12000,
      disparity_rp: 0,
      convergence_index_percent: 100.0,
      market: 'Pasar Ibuh Payakumbuh',
      region: 'Sumatera Barat',
    },
    {
      commodity_key: 'terung',
      commodity_name: 'Terung',
      bapanas_price_per_kg: 10000,
      sp2kp_kemendag_price_per_kg: 10000,
      composite_fair_price: 10000,
      disparity_rp: 0,
      convergence_index_percent: 100.0,
      market: 'Pasar Ibuh Payakumbuh',
      region: 'Sumatera Barat',
    },
    {
      commodity_key: 'bawang merah',
      commodity_name: 'Bawang Merah',
      bapanas_price_per_kg: null,
      sp2kp_kemendag_price_per_kg: 34500,
      composite_fair_price: 34500,
      disparity_rp: 0,
      convergence_index_percent: 100.0,
      market: 'Pasar Ibuh Payakumbuh',
      region: 'Sumatera Barat',
    },
  ]),
})
