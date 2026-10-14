# Analisis Change Request

Isi bagian ini **sebelum** mengubah kode, lalu commit dan push (contoh pesan: `dokumen: analisis change request`). Juri memeriksa bahwa commit ini muncul sebelum commit perubahan kode.

**Change request:** pencarian, filter, dan ekspor CSV (lihat Tugas 3 di lembar challenge).

**Kriteria penerimaan yang akan dipenuhi dan cara kami memenuhinya:**
1. **Kotak pencarian real-time (case-insensitive):** Menambahkan `TextField` MUI di `HarvestRecap.jsx` dengan fungsi filter berbasis teks tanpa membedakan huruf besar/kecil.
2. **Filter kombinasi:** Menambahkan komponen `Select` untuk kategori komoditas dan `TextField` tipe tanggal agar pencarian dan filter dapat digunakan bersamaan.
3. **Pesan data tidak ditemukan:** Menampilkan baris tabel khusus dengan teks persis `"Data tidak ditemukan"` jika hasil penyaringan kosong.
4. **Tombol Unduh CSV:** Menambahkan tombol dengan ikon `Download` yang memicu pembuatan file `.csv` dari data yang sedang aktif/tersaring di layar.
5. **Format angka CSV murni:** Membuat utilitas pembentuk CSV yang memastikan nilai angka tidak mengandung `Rp` atau titik/koma pemisah ribuan (contoh: `15000`), serta menangani *escape character* agar kompatibel dengan Excel.
6. **Regresi test:** Memastikan seluruh unit test lama di `tes/` tetap lulus 100%.

## 1. Dampak
| Bagian yang terdampak | File / fungsi | Perubahan yang diperlukan |
|---|---|---|
| Spesifikasi | `docs/01-spesifikasi.md` | Menambahkan aturan perilaku fitur Search, Filter komoditas/tanggal, dan syarat format data Ekspor CSV. |
| Kode | `src/components/HarvestRecap.jsx`, `src/utils/csvExporter.js` | Menambahkan state search/filter, UI input MUI, logika penyaringan data `useMemo`, pesan empty state, serta utilitas pembuat CSV. |
| Kasus uji / test | `tes/harvestRecap.test.js`, `tes/csvExporter.test.js` | Menambahkan unit test untuk pencarian case-insensitive, filter kombinasi, teks "Data tidak ditemukan", dan validasi format angka CSV murni. |
| README | `README.md` | Memperbarui daftar fitur utama dan menyertakan panduan penggunaan pencarian, pemfilteran, serta ekspor CSV. |

## 2. Kasus uji baru
| ID | Langkah / input | Hasil yang diharapkan |
|---|---|---|
| TC-CR-01 | Ketik kata kunci pada kolom Search (misal: "tomat" / "TOMAT") | Menampilkan baris batch yang mengandung kata kunci tersebut tanpa membedakan huruf besar/kecil. |
| TC-CR-02 | Pilih filter komoditas "Terung" dan isi kata kunci ID batch | Menampilkan data batch yang memenuhi kedua kriteria filter secara bersamaan. |
| TC-CR-03 | Ketik kata kunci acak yang tidak cocok dengan data apa pun | Tabel menampilkan pesan tunggal `"Data tidak ditemukan"`. |
| TC-CR-04 | Klik tombol "Ekspor CSV" saat data tersaring | Mengunduh file `.csv` yang hanya berisi baris data yang sedang tampil di tabel. |
| TC-CR-05 | Buka file CSV hasil unduhan di editor teks/Excel | Baris pertama adalah header, dan nilai angka ditulis tanpa simbol `Rp` atau pemisah ribuan (contoh: `15000`). |

## 3. Setelah selesai
- [ ] Kasus uji lama tetap lulus
- [ ] Kasus uji baru lulus
- [ ] Spesifikasi diperbarui
- [ ] README diperbarui