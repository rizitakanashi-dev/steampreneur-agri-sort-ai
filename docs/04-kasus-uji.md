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

Wajib ada[cite: 1]:
- minimal satu kasus dengan **input yang salah** (kosong, negatif, huruf di kolom angka)[cite: 1],
- minimal satu kasus **di batas aturan** (contoh: tepat Rp50.000 jika aturannya "minimal Rp50.000")[cite: 1].

## Unit test otomatis (jika ada)[cite: 1]
Nama file test: `tes/kalkulasi.test.js`[cite: 1]
Jumlah test: 14 lulus dari 14[cite: 1]
