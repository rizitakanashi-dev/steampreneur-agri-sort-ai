import test from 'node:test'
import assert from 'node:assert/strict'
import { buildCsv, buildHarvestCsv, buildHarvestCsvRows, escapeCsvValue } from '../src/utils/csvExporter.js'

const sampleBatch = {
  id: 'panen-1760000000000',
  tanggal: '2026-10-10',
  komoditas: 'Tomat',
  beratKg: 100,
  kesegaranPersen: 80,
  ukuran: 'Sedang',
  cacatPersen: 10,
  catatan: 'Setoran pagi',
  hasil: {
    persenA: 72, persenB: 18, persenC: 10,
    beratA: 72, beratB: 18, beratC: 10,
    nilaiA: 777600, nilaiB: 136080, nilaiC: 32400,
    totalNilai: 946080,
  },
}

test('baris pertama CSV berisi header nama kolom', () => {
  const csv = buildHarvestCsv([sampleBatch])
  const [header] = csv.split('\r\n')
  assert.match(header, /^ID Batch,Tanggal,Komoditas,/)
  assert.ok(header.includes('Total Nilai'))
})

test('angka ditulis murni tanpa simbol mata uang dan tanpa pemisah ribuan', () => {
  const csv = buildHarvestCsv([sampleBatch])
  assert.ok(csv.includes('946080'), 'total nilai harus 946080')
  assert.ok(!csv.includes('Rp'), 'tidak boleh ada simbol Rp')
  assert.ok(!csv.includes('946.080'), 'tidak boleh ada pemisah ribuan')
  assert.ok(csv.includes('100'), 'berat harus murni')
})

test('escapeCsvValue menangani koma, tanda kutip, dan baris baru', () => {
  assert.equal(escapeCsvValue('Tomat, Merah'), '"Tomat, Merah"')
  assert.equal(escapeCsvValue('kata "kutip"'), '"kata ""kutip"""')
  assert.equal(escapeCsvValue('baris\nbaru'), '"baris\nbaru"')
  assert.equal(escapeCsvValue('aman'), 'aman')
  assert.equal(escapeCsvValue(null), '')
  assert.equal(escapeCsvValue(undefined), '')
})

test('nilai yang mengandung pemisah tetap satu sel saat CSV dibuka Excel', () => {
  const csv = buildCsv([['nama', 'catatan'], ['Tomat', 'panen pagi, cuaca cerah']])
  const lines = csv.split('\r\n')
  assert.equal(lines[1], 'Tomat,"panen pagi, cuaca cerah"')
  // Jumlah kolom tetap 2 walau ada koma di dalam data
  assert.equal(lines[1].match(/,(?=(?:[^"]*"[^"]*")*[^"]*$)/g).length, 1)
})

test('buildHarvestCsvRows menolak argumen yang bukan array', () => {
  assert.throws(() => buildCsv('bukan array'), /harus berupa array/)
})

test('batch tanpa hasil tetap diekspor dengan sel kosong, bukan "undefined"', () => {
  const csv = buildHarvestCsv([{ id: 'panen-x', tanggal: '2026-10-11', komoditas: 'Terung', beratKg: 5, ukuran: 'Kecil' }])
  assert.ok(!csv.includes('undefined'), 'tidak boleh menulis undefined')
  assert.ok(!csv.includes('NaN'), 'tidak boleh menulis NaN')
})

test('CSV kosong hanya berisi header ketika tidak ada data', () => {
  const csv = buildHarvestCsv([])
  assert.equal(csv.split('\r\n').length, 1)
  assert.match(csv, /^ID Batch/)
})

test('berat hasil hitung tidak menuliskan artefak floating-point', () => {
  // Angka nyata dari hasil pengujian: 144 kg, kesegaran 77, cacat 87.
  // Berat B seharusnya 4.3056, bukan 4.305600000000001.
  const batch = {
    id: 'panen-1791964591110',
    tanggal: '2026-10-14',
    komoditas: 'Cabai Rawit Hijau',
    beratKg: 144,
    kesegaranPersen: 77,
    ukuran: 'Besar',
    cacatPersen: 87,
    hasil: {
      persenA: 10.01, persenB: 2.99, persenC: 87,
      beratA: 14.4144, beratB: 4.305600000000001, beratC: 125.28,
      nilaiA: 432432, nilaiB: 90418, nilaiC: 1127520, totalNilai: 1650370,
    },
  }
  const csv = buildHarvestCsv([batch])
  assert.ok(csv.includes('4.3056'), 'berat B harus ditulis 4.3056')
  assert.ok(!csv.includes('4.305600000000001'), 'artefak floating-point tidak boleh muncul')
  assert.ok(!/\d\.\d{6,}/.test(csv), 'tidak boleh ada angka dengan 6+ desimal')
})

test('angka desimal panjang dibulatkan maksimal 4 angka di belakang koma', () => {
  const batch = {
    id: 'panen-x', tanggal: '2026-10-14', komoditas: 'Tomat', beratKg: 144,
    ukuran: 'Besar', cacatPersen: 87, kesegaranPersen: 77,
    hasil: { beratA: 14.41444444, beratB: 4.30555555, beratC: 125.28000001 },
  }
  const csv = buildHarvestCsv([batch])
  const dataRow = csv.split('\r\n')[1]
  for (const cell of dataRow.split(',')) {
    const match = cell.match(/^-?\d+\.(\d+)$/)
    if (match) assert.ok(match[1].length <= 4, `sel "${cell}" punya lebih dari 4 desimal`)
  }
})

test('angka bulat dan nilai Rupiah tidak berubah oleh pembulatan desimal', () => {
  const batch = {
    id: 'panen-y', tanggal: '2026-10-14', komoditas: 'Tomat', beratKg: 100,
    ukuran: 'Sedang', cacatPersen: 10, kesegaranPersen: 80,
    hasil: { beratA: 72, beratB: 18, beratC: 10, nilaiA: 777600, nilaiB: 136080, nilaiC: 32400, totalNilai: 946080 },
  }
  const csv = buildHarvestCsv([batch])
  assert.ok(csv.includes('946080'), 'total nilai harus tetap bilangan bulat')
  assert.ok(!csv.includes('946080.0'), 'bilangan bulat tidak boleh diberi desimal')
  assert.ok(csv.includes(',72,'), 'berat bulat harus tetap 72')
})
