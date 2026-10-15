# Kasus Uji

Bagian A diisi **sebelum** mulai membangun. Hasil yang diharapkan dihitung sendiri oleh tim (boleh dengan kalkulator), bukan oleh AI.
Bagian B diisi setelah aplikasi diuji[cite: 1].

## Bagian A — Kasus uji alur inti

| ID | Kriteria yang diuji | Langkah / input | Hasil yang diharapkan | Hasil sebenarnya | Lulus? | Bukti (nama file tangkapan layar) |
|---|---|---|---|---|---|---|
| U01 | Kalkulasi Sampel Standar (K06) | **Tomat**, Berat: `100 kg`, Kesegaran: `80%`, Ukuran: `Sedang`, Cacat: `10%`. | **Persen:** Grade A 72%, B 18%, C 10%.<br>**Total Nilai:** **Rp946.080**. | | Ya | `U01-kalkulasi-tomat-100kg.png` |
| U02 | Pemisah Desimal Koma (K07) | **Cabai Rawit Hijau**, Berat: `25,5 kg`, Kesegaran: `90%`, Ukuran: `Besar`, Cacat: `20%`. | Input `25,5` diterima.<br>**Persen:** A 72%, B 8%, C 20%.<br>**Total Nilai:** **Rp639.540**. | | Ya | `U02-desimal-koma-cabai.png` |
| U03 | Precision & Pembulatan Rupiah (K08) | **Tomat**, Berat: `1 kg`, Kesegaran: `33%`, Ukuran: `Sedang`, Cacat: `7%`. | **Persen:** A 30,69%, B 62,31%, C 7%.<br>**Nilai:** A Rp3.315, B Rp4.711, C Rp227.<br>**Total Nilai:** **Rp8.253**. | | Ya | `U03-pembulatan-rupiah.png` |
| U04 | Validasi Input Salah / Negatif (K03) | Field Berat panen diisi angka negatif: `-5`. | Sistem menolak input dengan pesan persis:<br>`"Berat panen tidak boleh negatif."` | | Ya | `U04-error-berat-negatif.png` |
| U05 | Validasi Input Salah / Tipe String (K04) | Field Berat panen diisi karakter huruf: `abc`. | Sistem menolak input dengan pesan persis:<br>`"Berat panen harus berupa angka."` | | Ya | `U05-error-berat-string.png` |
| U06 | Validasi Out of Range (K05) | Field Kesegaran diisi `101` atau Cacat diisi `-1`. | Sistem menolak input dengan pesan persis:<br>`"Kesegaran harus antara 0 sampai 100."` | | Ya | `U06-error-range-persen.png` |
| U07 | Validasi Citra Blur / Two-Tier (K02) | Unggah foto keranjang panen yang blur / tidak fokus (*Laplacian Variance* < 100). | Sistem menolak foto dengan pesan persis:<br>`"Gambar terlalu kabur/blur. Harap ambil ulang foto dengan fokus yang jelas."` | | Tidak (diluar cakupan) | `U07-validasi-foto-blur.png` |
| U08 | Filter Objek Non-Komoditas (K03) | Unggah foto selain komoditas (seperti gelas, sepatu) / *Confidence* < 50%. | Sistem memblokir proses dengan pesan persis:<br>`"Objek tidak dikenali sebagai komoditas pertanian yang didukung."` | | Tidak (diluar cakupan) | `U08-filter-objek-luar.png` |
| U09 | Batas Aturan / 100% Cacat (K09) | **Terung**, Berat: `10 kg`, Kesegaran: `0%`, Ukuran: `Besar`, Cacat: `100%`. | **Persen:** Grade A 0%, B 0%, C 100%.<br>**Total Nilai:** **Rp30.000**. | | Ya | `U09-batas-semua-cacat.png` |
| U10 | Batas Aturan / 100% Super (K09) | **Tomat**, Berat: `10 kg`, Kesegaran: `100%`, Ukuran: `Besar`, Cacat: `0%`. | **Persen:** Grade A 100%, B 0%, C 0%.<br>**Total Nilai:** **Rp120.000**. | | Ya | `U10-batas-semua-grade-a.png` |
| U11 | Batas Aturan / 100% Layu (K09) | **Tomat**, Berat: `10 kg`, Kesegaran: `0%`, Ukuran: `Besar`, Cacat: `0%`. | **Persen:** Grade A 0%, B 100%, C 0%.<br>**Total Nilai:** **Rp84.000**. | | Ya | `U11-batas-semua-grade-b.png` |
| U12 | Offline Fallback Caching (K17) | Jaringan internet terputus atau API Panel BAPANAS *timeout*. | Sistem mengambil data harga acuan lokal terakhir dari `localStorage` (`agrisort.harga_cache.v1`). | | Tidak (diluar cakupan) | `U12-offline-fallback.png` |
| U13 | Tampilan Rekap Kosong (K15) | Buka aplikasi pertama kali tanpa riwayat di `localStorage`. | Tabel rekap menampilkan pesan persis:<br>`"Belum ada data panen tersimpan."` | | Ya | `U13-rekap-kosong.png` |
| U14 | Responsivitas Layar HP (K19) | Akses aplikasi di perangkat dengan lebar layar 360 px. | Seluruh form dan tabel dapat diakses tanpa bergeser (*scroll*) horizontal. | | Ya | `U14-responsif-mobile-360px.png` |
| U15 | Validasi Berat Nol Desimal | Isi Berat dengan `0`, `0.0`, `0.00`, `0,0`, dan `0,00` secara bergantian. Sisa field valid. | Setiap varian ditolak dengan pesan persis:<br>`"Berat panen harus lebih dari 0 kg."`<br>Berat `0,5` (lebih dari nol) tetap diterima. | | Ya | `U15-validasi-berat-nol-desimal.png` |
| U16 | Validasi Berat Melebihi Maksimum | Isi Berat dengan `10001`. | Sistem menolak dengan pesan persis:<br>`"Berat panen maksimal 10.000 kg."` | | Ya | `U16-error-berat-maks.png` |
| U17 | Validasi Berat 3 Angka Desimal | Isi Berat dengan `25,555`. | Sistem menolak dengan pesan persis:<br>`"Berat panen maksimal 2 angka di belakang koma."` | | Ya | `U17-error-berat-desimal.png` |
| U18 | Baris Total Rekap (K16) | Simpan 2+ batch, buka halaman Rekap, periksa baris total di bawah tabel. | Baris total menampilkan jumlah berat dan jumlah nilai dari baris yang tampil pada halaman pagination saat ini. Angka sama dengan penjumlahan kolom berat dan kolom nilai yang terlihat. | | Ya | `U18-baris-total-rekap.png` |
| U19 | Persistensi Data Setelah Reload (K13) | Simpan satu batch, tekan F5 untuk memuat ulang halaman. | Seluruh baris rekap yang disimpan masih tampil dengan nilai yang sama. `localStorage` key `agrisort.panen.v1` berisi JSON Array valid. | | Ya | `U19-persistensi-reload.png` |
| U20 | Tombol Dashboard Navigasi | Buka halaman Dashboard, klik tombol "Mulai scan batch" dan "Buka QC Scanner". | Kedua tombol memindahkan halaman ke Batch QC Scanner. Tidak ada tombol mati. | | Ya | `U20-tombol-dashboard.png` |

### Kasus uji Change Request (Tugas 3)

| ID | Kriteria yang diuji | Langkah / input | Hasil yang diharapkan | Hasil sebenarnya | Lulus? | Bukti (nama file tangkapan layar) |
|---|---|---|---|---|---|---|
| K21 | Pencarian real-time tanpa membedakan huruf besar/kecil | Ketik `TERUNG`, lalu `tOmAt` pada kotak pencarian halaman Rekap. | Hanya baris yang cocok yang tampil; huruf besar/kecil diabaikan. | `TERUNG` menampilkan 1 baris (`panen-2`); `tOmAt` menampilkan 2 baris (`panen-3`, `panen-1`). | Pass | `docs/bukti/01-pencarian-realtime-tomat.png` |
| K22 | Filter kombinasi (pencarian + komoditas + rentang tanggal) | Isi kata kunci `tomat` **dan** tanggal "Dari" `2026-10-11` secara bersamaan. | Hanya data yang memenuhi **kedua** kriteria yang tampil. | Tampil 1 baris (`panen-3`); tanpa filter tampil 3 baris. | Pass | `docs/bukti/02-filter-pencarian-dan-tanggal.png` |
| K23 | Empty state "Data tidak ditemukan" | Ketik kata kunci acak `zzz` yang tidak cocok dengan data apa pun. | Tabel menampilkan pesan persis `"Data tidak ditemukan"`. | Pesan persis `Data tidak ditemukan` tampil di dalam `<tbody>` dengan `colSpan` penuh. | Pass | `docs/bukti/03-empty-state-data-tidak-ditemukan.png` |
| K24 | Ekspor CSV hanya data yang sedang tampil | Saring data dengan kata kunci `tomat`, lalu klik tombol **Ekspor CSV**. | File CSV berisi header + hanya baris yang sedang tampil. | Berkas terunduh memuat 1 baris header + 2 baris data (`panen-3`, `panen-1`); baris `panen-2` tidak ikut. | Pass | `docs/bukti/05-csv-hasil-filter.png` |
| K25 | Format angka murni pada CSV | Buka berkas CSV hasil ekspor di editor teks/Excel. | Angka tanpa simbol `Rp` dan tanpa pemisah ribuan (contoh: `873000`). | Berkas memuat `873000` dan `946080`; tidak ada `Rp` maupun `946.080`. Nilai yang mengandung koma (catatan) terbungkus kutip ganda. | Pass | `docs/bukti/06-csv-detail-kolom.png` |

Catatan: kolom **Bukti** pada K21–K25 telah diisi dengan nama file tangkapan layar yang tersedia di `docs/bukti/`. Status **Pass** didasarkan pada pengamatan langsung di browser saat pengujian Change Request (log prompt #11), bukan pada pembacaan kode atau unit test saja.

Wajib ada[cite: 1]:
- minimal satu kasus dengan **input yang salah** (kosong, negatif, huruf di kolom angka)[cite: 1],
- minimal satu kasus **di batas aturan** (contoh: tepat Rp50.000 jika aturannya "minimal Rp50.000")[cite: 1].

## Unit test otomatis (jika ada)[cite: 1]

Nama file test: `tes/` (8 berkas: `harvestCalculation.test.js`, `harvestStorage.test.js`, `harvestProjection.test.js`, `harvestValidation.test.js`, `gradeValidation.test.js`, `harvestRecapChangeRequest.test.js`, `csvExporter.test.js`, `initialState.test.js`)[cite: 1]

Jumlah test: 57 lulus dari 57 (`npm test`)

Perincian: 32 test alur inti (kalkulasi, penyimpanan, validasi, proyeksi harga) + 25 test Change Request (15 test pencarian/filter/ekspor CSV/total rekap dan 10 test utilitas CSV).

Jumlah test bertambah dari 52 menjadi 57:
- 2 test di `tes/harvestValidation.test.js` menutup bug validasi berat bernilai nol yang ditulis dalam format desimal (`0.0`, `0.00`, `0,0`, `0,00`).
- 3 test di `tes/harvestRecapChangeRequest.test.js` menguji `calculateBatchTotals` untuk daftar kosong, beberapa batch, dan batch tanpa `hasil`.

### Pemetaan unit test ke kasus uji manual

| Kasus uji | Unit test yang relevan | Catatan |
|---|---|---|
| U01 (K06) | `calculateHarvest` contoh 1; `calculateHarvestValue` total 946080 | Verifikasi numerik, bukan UI |
| U02 (K07) | `parseNumeric('25,5')` → 25.5; `calculateHarvestValue` contoh 2 | Verifikasi parser dan kalkulasi |
| U03 (K08) | `roundRupiah` tie .5; `calculateHarvestValue` pembulatan contoh 4 | Verifikasi pembulatan |
| U04 | `validateHarvestForm` berat `-5` → "tidak boleh negatif" | Multi-error sekaligus |
| U05 | `parseNumeric('abc')` → null; `parseNumeric('1e3')` → null | Verifikasi penolakan non-numerik |
| U06 | `validateHarvestForm` kesegaran `101` → "antara 0 sampai 100" | Multi-error sekaligus |
| U09 (K09) | `calculateHarvest` K 0, C 100 → reject 10 kg | Verifikasi batas |
| U10 (K09) | `calculateHarvest` K 100, C 0 → gradeA 10 kg | Verifikasi batas |
| U11 (K09) | `calculateHarvest` K 0, C 0 → gradeB 10 kg | Verifikasi batas |
| U15 | `validateHarvestForm` berat `0`/`0.0`/`0,00` ditolak; `0,5` diterima | TDD fix bug T01 |
| U18 (K16) | `calculateBatchTotals` daftar kosong, beberapa batch, batch tanpa `hasil` | Verifikasi logika total |
| U19 (K13) | `saveBatch` + `readBatches` round-trip | Verifikasi persistensi storage |
| K21–K25 | `filterBatches`, `isFilterEmpty`, `sortBatchesByNewest`, `buildHarvestCsv`, `escapeCsvValue` | Logika filter/CSV, bukan UI |

Unit test memverifikasi logika bisnis dan kalkulasi numerik. Unit test **tidak** memverifikasi: tampilan UI, responsivitas, interaksi klik, format mata uang di layar, perilaku pagination, atau alur navigasi. Kasus uji yang memerlukan verifikasi UI tetap berstatus `Belum diuji` sampai pengujian manual dilakukan.

### Catatan cakupan kasus uji

Tiga kasus uji di Bagian A menguji fitur yang **berada di luar cakupan challenge** (lihat `docs/01-spesifikasi.md` Bagian 5), sehingga tidak dapat dijalankan pada versi aplikasi ini:

| ID | Alasan tidak diuji |
|---|---|
| U07 (validasi foto blur / Laplacian Variance) | Tidak ada unggah foto maupun model computer vision di versi challenge. |
| U08 (filter objek non-komoditas / confidence score) | Sama seperti U07 — inferensi model tidak tersedia. |
| U12 (offline fallback `agrisort.harga_cache.v1`) | Tidak ada integrasi API harga BAPANAS, sehingga tidak ada cache offline. Harga acuan adalah tabel tetap di `src/business/priceReference.js`. |

Kasus uji U07, U08, dan U12 tetap dicantumkan karena berasal dari kriteria challenge (K02, K03, K17). Statusnya `Di luar cakupan`, bukan `Gagal`.
