# Kasus Uji

Bagian A diisi **sebelum** mulai membangun. Hasil yang diharapkan dihitung sendiri oleh tim (boleh dengan kalkulator), bukan oleh AI.
Bagian B diisi setelah aplikasi diuji[cite: 1].

| ID | Kriteria yang diuji | Langkah / input | Hasil yang diharapkan | Hasil sebenarnya | Lulus? | Bukti (nama file tangkapan layar) |
|---|---|---|---|---|---|---|
| U01 | Kalkulasi Sampel Standar (K06) | **Tomat**, Berat: `100 kg`, Kesegaran: `80%`, Ukuran: `Sedang`, Cacat: `10%`. | **Persen:** Grade A 72%, B 18%, C 10%.<br>**Total Nilai:** **Rp946.080**. | | [ ] Ya [ ] Tidak | `U01-kalkulasi-tomat-100kg.png` |
| U02 | Pemisah Desimal Koma (K07) | **Cabai Rawit Merah**, Berat: `25,5 kg`, Kesegaran: `90%`, Ukuran: `Besar`, Cacat: `20%`. | Input `25,5` diterima.<br>**Total Nilai:** **Rp639.540**. | | [ ] Ya [ ] Tidak | `U02-desimal-koma-cabai.png` |
| U03 | Precision & Pembulatan Rupiah (K08) | **Tomat**, Berat: `1 kg`, Kesegaran: `33%`, Ukuran: `Sedang`, Cacat: `7%`. | **Nilai:** A Rp3.315, B Rp4.711, C Rp227.<br>**Total Nilai:** **Rp8.253**. | | [ ] Ya [ ] Tidak | `U03-pembulatan-rupiah.png` |
| U04 | Validasi Input Salah / Negatif (K03) | Field Berat panen diisi angka negatif: `-5`. | Sistem menolak input dengan pesan persis:<br>`"Berat panen tidak boleh negatif."` | | [ ] Ya [ ] Tidak | `U04-error-berat-negatif.png` |
| U05 | Validasi Input Salah / Tipe String (K04) | Field Berat panen diisi karakter huruf: `abc`. | Sistem menolak input dengan pesan persis:<br>`"Berat panen harus berupa angka."` | | [ ] Ya [ ] Tidak | `U05-error-berat-string.png` |
| U06 | Validasi Out of Range (K05) | Field Kesegaran diisi `101` atau Cacat diisi `-1`. | Sistem menolak input dengan pesan persis:<br>`"Kesegaran harus antara 0 sampai 100."` | | [ ] Ya [ ] Tidak | `U06-error-range-persen.png` |
| U07 | Validasi Citra Blur / Two-Tier (K02) | Unggah foto keranjang panen yang blur / tidak fokus (*Laplacian Variance* < 100). | Sistem menolak foto dengan pesan persis:<br>`"Gambar terlalu kabur/blur. Harap ambil ulang foto dengan fokus yang jelas."` | | [ ] Ya [ ] Tidak | `U07-validasi-foto-blur.png` |
| U08 | Filter Objek Non-Komoditas (K03) | Unggah foto selain komoditas (seperti gelas, sepatu) / *Confidence* < 50%. | Sistem memblokir proses dengan pesan persis:<br>`"Objek tidak dikenali sebagai komoditas pertanian yang didukung."` | | [ ] Ya [ ] Tidak | `U08-filter-objek-luar.png` |
| U09 | Batas Aturan / 100% Cacat (K09) | **Terung**, Berat: `10 kg`, Kesegaran: `0%`, Ukuran: `Besar`, Cacat: `100%`. | **Persen:** Grade A 0%, B 0%, C 100%.<br>**Total Nilai:** **Rp30.000**. | | [ ] Ya [ ] Tidak | `U09-batas-semua-cacat.png` |
| U10 | Batas Aturan / 100% Super (K09) | **Tomat**, Berat: `10 kg`, Kesegaran: `100%`, Ukuran: `Besar`, Cacat: `0%`. | **Persen:** Grade A 100%, B 0%, C 0%.<br>**Total Nilai:** **Rp120.000**. | | [ ] Ya [ ] Tidak | `U10-batas-semua-grade-a.png` |
| U11 | Batas Aturan / 100% Layu (K09) | **Tomat**, Berat: `10 kg`, Kesegaran: `0%`, Ukuran: `Besar`, Cacat: `0%`. | **Persen:** Grade A 0%, B 100%, C 0%.<br>**Total Nilai:** **Rp84.000**. | | [ ] Ya [ ] Tidak | `U11-batas-semua-grade-b.png` |
| U12 | Offline Fallback Caching (K17) | Jaringan internet terputus atau API Panel BAPANAS *timeout*. | Sistem mengambil data harga acuan lokal terakhir dari `localStorage` (`agrisort.harga_cache.v1`). | | [ ] Ya [ ] Tidak | `U12-offline-fallback.png` |
| U13 | Tampilan Rekap Kosong (K15) | Buka aplikasi pertama kali tanpa riwayat di `localStorage`. | Tabel rekap menampilkan pesan persis:<br>`"Belum ada data panen tersimpan."` | | [ ] Ya [ ] Tidak | `U13-rekap-kosong.png` |
| U14 | Responsivitas Layar HP (K19) | Akses aplikasi di perangkat dengan lebar layar 360 px. | Seluruh form dan tabel dapat diakses tanpa bergeser (*scroll*) horizontal. | | [ ] Ya [ ] Tidak | `U14-responsif-mobile-360px.png` |

### Kasus uji Change Request (Tugas 3)

| ID | Kriteria yang diuji | Langkah / input | Hasil yang diharapkan | Hasil sebenarnya | Lulus? | Bukti (nama file tangkapan layar) |
|---|---|---|---|---|---|---|
| K21 | Pencarian real-time tanpa membedakan huruf besar/kecil | Ketik `TERUNG`, lalu `tOmAt` pada kotak pencarian halaman Rekap. | Hanya baris yang cocok yang tampil; huruf besar/kecil diabaikan. | `TERUNG` menampilkan 1 baris (`panen-2`); `tOmAt` menampilkan 2 baris (`panen-3`, `panen-1`). | Pass | [perlu tangkapan layar] |
| K22 | Filter kombinasi (pencarian + komoditas + rentang tanggal) | Isi kata kunci `tomat` **dan** tanggal "Dari" `2026-10-11` secara bersamaan. | Hanya data yang memenuhi **kedua** kriteria yang tampil. | Tampil 1 baris (`panen-3`); tanpa filter tampil 3 baris. | Pass | [perlu tangkapan layar] |
| K23 | Empty state "Data tidak ditemukan" | Ketik kata kunci acak `zzz` yang tidak cocok dengan data apa pun. | Tabel menampilkan pesan persis `"Data tidak ditemukan"`. | Pesan persis `Data tidak ditemukan` tampil di dalam `<tbody>` dengan `colSpan` penuh. | Pass | [perlu tangkapan layar] |
| K24 | Ekspor CSV hanya data yang sedang tampil | Saring data dengan kata kunci `tomat`, lalu klik tombol **Ekspor CSV**. | File CSV berisi header + hanya baris yang sedang tampil. | Berkas terunduh memuat 1 baris header + 2 baris data (`panen-3`, `panen-1`); baris `panen-2` tidak ikut. | Pass | [perlu tangkapan layar] |
| K25 | Format angka murni pada CSV | Buka berkas CSV hasil ekspor di editor teks/Excel. | Angka tanpa simbol `Rp` dan tanpa pemisah ribuan (contoh: `873000`). | Berkas memuat `873000` dan `946080`; tidak ada `Rp` maupun `946.080`. Nilai yang mengandung koma (catatan) terbungkus kutip ganda. | Pass | [perlu tangkapan layar] |

Catatan: kolom **Bukti** pada K21–K25 masih perlu diisi tangkapan layar di `docs/bukti/`. Status **Pass** di atas didasarkan pada pengamatan langsung di browser saat pengujian, bukan pada berkas tangkapan layar.

Wajib ada[cite: 1]:
- minimal satu kasus dengan **input yang salah** (kosong, negatif, huruf di kolom angka)[cite: 1],
- minimal satu kasus **di batas aturan** (contoh: tepat Rp50.000 jika aturannya "minimal Rp50.000")[cite: 1].

## Unit test otomatis (jika ada)[cite: 1]
Nama file test: `tes/` (8 berkas: `harvestCalculation.test.js`, `harvestStorage.test.js`, `harvestProjection.test.js`, `harvestValidation.test.js`, `gradeValidation.test.js`, `harvestRecapChangeRequest.test.js`, `csvExporter.test.js`, `initialState.test.js`)[cite: 1]
Jumlah test: 49 lulus dari 49 (`npm test`)[cite: 1]

Perincian: 30 test alur inti (kalkulasi, penyimpanan, validasi, proyeksi harga) + 19 test Change Request (12 test pencarian/filter/ekspor CSV dan 7 test utilitas CSV).
