# Catatan Code Review

Minta AI me-review kode kalian, lalu putuskan saran mana yang diterima.
Menolak saran AI dengan alasan yang jelas adalah hal yang baik.

**Prompt review yang dipakai:**

Senior Software Engineer code review kritis berbasis bukti terhadap seluruh source code Agri-Sort AI (React + Vite + MUI + localStorage + Node.js test runner). Review dilakukan setelah pengerjaan Fitur 11 (perbaikan audit). Setiap temuan ditelusuri ke file, baris kode, spesifikasi (`docs/01-spesifikasi.md`), kasus uji (`docs/04-kasus-uji.md`), atau hasil eksekusi nyata.

**Audit verifikasi ulang:** Setiap temuan diverifikasi ulang terhadap source code dan spesifikasi pada 2026-10-15. Test dan build dijalankan untuk konfirmasi.

## 1. Ringkasan struktur dan alur aplikasi

**Stack terbukti:** React 19 + Vite 8 + MUI 9.5 + Emotion + `@mui/x-charts` 9.15 + localStorage + Node.js `--test`. Tidak ada Next.js, Tailwind, backend, Supabase, atau framework test tambahan.

**Struktur direktori:**
- `src/business/` — logika bisnis murni tanpa React (6 modul).
- `src/components/` — 7 komponen UI MUI.
- `src/utils/` — `csvExporter.js`.
- `tes/` — 8 berkas test, 54 test total.

**Alur utama (3 langkah):**
1. **Input** (`HarvestForm.jsx`): pengguna mengisi 7 field → `validateHarvestForm` memvalidasi → Dialog ringkasan → konfirmasi.
2. **Kalkulasi & Simpan** (`App.jsx` baris 188–214): `calculateHarvest` + `calculateHarvestValue` → `saveBatch` ke `localStorage` key `agrisort.panen.v1` → navigasi ke QC Results.
3. **Rekap** (`HarvestRecap.jsx`): baca `readBatches` → `filterBatches` → `sortBatchesByNewest` → tabel dengan pagination, detail Dialog, filter, dan ekspor CSV.

**Halaman tambahan:** Dashboard (overview), QC Results, Pricing Dashboard (proyeksi + grafik tren).

**Data tersimpan:** Objek batch dengan `hasil` berisi persentase, berat, nilai per grade, dan `totalNilai`. QCResults dan HarvestRecap membaca `batch.hasil` tanpa menghitung ulang rumus.

## 2. Daftar temuan review

| No | Tingkat | Kepastian | File/fungsi | Temuan |
|---|---|---|---|---|
| R01 | TINGGI | Bug terkonfirmasi | `src/components/HarvestRecap.jsx` | Tabel rekap tidak memiliki baris total (jumlah berat + jumlah nilai) yang diwajibkan spesifikasi §4 Langkah 3 baris 175 dan kriteria K16. **Diperbaiki pada 2026-10-15.** |
| R02 | SEDANG | Bug terkonfirmasi | `src/components/HarvestRecap.jsx` | Tabel rekap tidak menampilkan kolom Kesegaran (%), Ukuran, Cacat (%), dan Catatan yang diwajibkan spesifikasi §4 Langkah 3 tabel kolom. Kolom "No" (nomor urut) juga tidak ada. |
| R03 | SEDANG | Bug terkonfirmasi | `src/business/harvestValidation.js` baris 87 | Validasi catatan tidak memeriksa larangan data pribadi (nama lengkap, nomor HP, alamat) yang diwajibkan spesifikasi §4 baris 106. Hanya cek panjang 100 karakter. |
| R04 | RENDAH | Saran perbaikan | `src/components/AppShell.jsx` baris 113 | Menu "Pengaturan" tidak memiliki `onClick` handler — tombol tidak melakukan apa-apa saat diklik. Spesifikasi tidak menjanjikan halaman Pengaturan; ini elemen UI tambahan yang belum dikembangkan. |
| R05 | SEDANG | Saran perbaikan | `src/components/PricingDashboard.jsx` baris 55–80 | `setError()` dipanggil di dalam `useMemo` — React melarang side effect (setState) dalam render fase. `main.jsx` baris 9 mengaktifkan `React.StrictMode`, sehingga callback `useMemo` dapat dijalankan lebih dari sekali per render cycle di development mode. Empat pemanggilan `setError` di baris 56, 60, 64, 77 berada di dalam `useMemo`; dua pemanggilan lain di baris 278, 280 berada di `onClick` handler dan tidak bermasalah. **Diperbaiki pada 2026-10-15.** |
| R06 | RENDAH | Potensi masalah | `src/components/HarvestRecap.jsx` baris 63 | `useMemo` dependency array `[batches, filter]` tidak menyertakan `page` dan `rowsPerPage`, tetapi `visibleBatches` dihitung dari `sortedBatches.slice(...)` di baris 64, di luar `useMemo`. Ini tidak menyebabkan bug karena `visibleBatches` dihitung di luar `useMemo`, tetapi bisa membingungkan pembaca. |
| R07 | TIDAK DITEMUKAN | Tidak ditemukan masalah | `src/business/harvestCalculation.js` | Rumus grade, pembulatan Rupiah, dan pengali harga diverifikasi cocok dengan 7 contoh di §6.4. Pembulatan tie `.5` aman dari floating-point error. `parseNumeric` menolak `12.000`, `1e3`, `abc`, kosong. |
| R08 | TIDAK DITEMUKAN | Tidak ditemukan masalah | `src/business/harvestStorage.js` | Recovery JSON rusak/missing berfungsi. ID collision-safe. Key `agrisort.panen.v1` sesuai spesifikasi. |
| R09 | TIDAK DITEMUKAN | Tidak ditemukan masalah | `src/utils/csvExporter.js` | Header, angka murni, escape RFC 4180, BOM UTF-8 — semua sesuai change request. |
| R10 | TIDAK DITEMUKAN | Tidak ditemukan masalah | `src/components/QCResults.jsx` | Membaca `batch.hasil` tanpa menghitung ulang rumus. Empty state dan rekomendasi berbasis data. Tidak mengklaim AI. |
| R11 | TIDAK DITEMUKAN | Tidak ditemukan masalah | `src/components/AppShell.jsx` | Drawer permanent/temporary, AppBar hamburger, active state — semua berfungsi. Responsif 360px/768px/1280px diverifikasi. |

### Detail per temuan

#### R01 — Baris total rekap tidak ada (TINGGI, bug terkonfirmasi → diperbaiki)

**Spesifikasi:** §4 Langkah 3 baris 175: "Di bawah tabel ada baris total: **jumlah berat (kg)** dan **jumlah nilai (Rp)** dari seluruh baris yang tampil." Kriteria K16: "Angka di baris total rekap sama dengan jumlah kolom berat dan kolom total nilai yang tampil."

**Kode aktual (sebelum perbaikan):** `HarvestRecap.jsx` tidak memiliki `<TableFooter>` atau baris total. Tabel hanya berisi `<TableHead>` dan `<TableBody>`, diikuti `<TablePagination>`.

**Perbaikan yang diterapkan:** Ditambahkan `<TableFooter>` setelah `</TableBody>` dengan baris yang berisi `formatNumber(visibleBatches.reduce((sum, b) => sum + b.beratKg, 0))` kg dan `formatRupiah(visibleBatches.reduce((sum, b) => sum + (b.hasil?.totalNilai || 0), 0))`. Baris total menjumlahkan data dari `visibleBatches` (baris yang tampil di halaman pagination saat ini), sesuai spesifikasi "baris yang tampil".

**Verifikasi:** 54 test pass, build berhasil. `TableFooter` diimpor dari `@mui/material`.

#### R02 — Kolom rekap tidak lengkap (SEDANG, bug terkonfirmasi)

**Spesifikasi:** §4 Langkah 3 baris 158–171: "Halaman rekap menampilkan semua data yang tersimpan dalam tabel:" diikuti tabel kolom: No, Tanggal, Komoditas, Berat (kg), Kesegaran (%), Ukuran, Cacat (%), Grade A/B/C (%), Total nilai (Rp), Catatan. Spesifikasi mengatakan "dalam tabel", bukan "dalam halaman" atau "dalam dialog".

**Kode aktual:** Kolom tabel (baris 179–184): ID/Tanggal, Komoditas, Berat total, Distribusi grade (chip), Nilai estimasi, Aksi. Tidak ada: No, Kesegaran, Ukuran, Cacat, Catatan sebagai kolom tabel. Data lengkap tersedia di Dialog detail (baris 239–258).

**Dampak:** Data yang disimpan tidak semua ditampilkan di tabel utama. Pengguna harus buka Dialog detail untuk melihat kesegaran/ukuran/cacat/catatan.

**Rekomendasi:** Tim perlu memutuskan: (a) tambahkan kolom yang kurang ke tabel, atau (b) pertahankan tabel ringkas dan tandai spesifikasi sebagai "disesuaikan" dengan catatan bahwa data lengkap tersedia di Dialog detail. Opsi (b) lebih realistis mengingat `minWidth: 900` sudah lebar; spesifikasi baris 178 mengizinkan scroll horizontal ("Tabel dapat digulir ke samping di layar HP").

#### R03 — Validasi data pribadi di catatan tidak ada (SEDANG, bug terkonfirmasi)

**Spesifikasi:** §4 baris 106: "Catatan — tidak boleh berisi data pribadi (nama lengkap, nomor HP, alamat)." §4 baris 376: "Tidak ada data pribadi yang disimpan."

**Kode aktual:** `harvestValidation.js` baris 87 hanya memeriksa `String(form.catatan ?? '').length > 100`. Tidak ada cek pola nomor HP, nama, atau alamat.

**Catatan spesifikasi:** Tabel "Pesan kesalahan" (baris 124–144) hanya mendefinisikan pesan untuk "Catatan lebih dari 100 karakter" — tidak ada pesan error yang didefinisikan untuk pelanggaran data pribadi. Implementasi validasi memerlukan keputusan tim tentang pesan error dan ambang deteksi.

**Dampak:** Pengguna bisa menyimpan catatan berisi nomor HP atau alamat, yang disimpan ke localStorage.

**Rekomendasi:** Tambahkan validasi pola dasar untuk nomor HP (mis. regex `/08\d{8,11}/` atau `/\+62\d{8,12}/`). Deteksi "nama lengkap" memiliki risiko false positive tinggi tanpa database nama; tim perlu mendefinisikan kriteria. Pertimbangkan: apakah validasi harus menolak menyimpan, atau cukup memberi peringatan yang bisa diabaikan pengguna?

#### R04 — Menu Pengaturan tanpa handler (RENDAH, saran perbaikan)

**Bukti:** `AppShell.jsx` baris 113: `<ListItemButton sx={{...}}>` tanpa `onClick`.

**Konteks:** Spesifikasi, README, dan `docs/02-rencana.md` tidak menyebutkan halaman "Pengaturan" sama sekali. Ini bukan pelanggaran spesifikasi — hanya elemen UI yang belum dikembangkan.

**Rekomendasi:** Tambahkan `onClick` yang menampilkan Snackbar "Pengaturan belum tersedia" atau hapus dari navigasi.

#### R05 — setError di dalam useMemo (SEDANG, saran perbaikan → diperbaiki)

**Bukti (sebelum perbaikan):** `PricingDashboard.jsx` baris 55–80: `useMemo(() => { setError('') ... setError(...) ... }, [...])`. Empat pemanggilan `setError` di baris 56, 60, 64, 77 berada di dalam body `useMemo`.

**Konteks StrictMode:** `main.jsx` baris 9 mengaktifkan `<React.StrictMode>`. Callback `useMemo` seharusnya murni — React dapat menjalankannya lebih dari sekali per render cycle di development mode untuk mendeteksi side effect. React secara eksplisit melarang pemanggilan `setState` selama render fase.

**Perbaikan yang diterapkan:** `useMemo` kini mengembalikan objek `{ projection, validationError }` sebagai derived value murni tanpa `setState`. Validasi error ditampilkan melalui `validationError` (baris 204). `setError` hanya dipanggil dari `onClick` handler (baris 278, 280) untuk hasil tombol "Coba markup/margin" — ini tidak bermasalah karena berada di event handler, bukan render fase.

**Verifikasi:** 54 test pass, build berhasil.

## 3. Daftar saran dan keputusan

| No | Saran dari AI | Keputusan | Alasan | Bagian kode yang berubah |
|---|---|---|---|---|
| 1 | R01: Tambah baris total (jumlah berat + jumlah nilai) di tabel rekap | Diterima dan diperbaiki | Spesifikasi §4 baris 175 dan K16 mewajibkan baris total. Ditambahkan `<TableFooter>` dengan `reduce` atas `visibleBatches` untuk jumlah berat dan jumlah nilai. 54 test pass, build berhasil. | `src/components/HarvestRecap.jsx` — tambah `<TableFooter>` + import |
| 2 | R02: Lengkapi kolom tabel rekap (Kesegaran, Ukuran, Cacat, Catatan, No) | Ditunda | Spesifikasi §4 baris 158 mengatakan "dalam tabel". Tabel sudah `minWidth: 900`; menambah 5 kolom membuat tabel sangat lebar. Tim perlu memutuskan apakah tabel ringkas + Dialog detail cukup, atau kolom lengkap diwajibkan. Spesifikasi baris 178 mengizinkan scroll horizontal. | Belum berubah — menunggu keputusan tim |
| 3 | R03: Tambah validasi data pribadi di catatan | Ditunda (belum diterapkan) | Spesifikasi §4 baris 106 mewajibkan, tetapi tidak ada pesan error yang didefinisikan di tabel pesan kesalahan (baris 124–144). Verifikasi `grep -n "pribadi\|HP\|08.*\\\\d" src/business/harvestValidation.js` mengembalikan kosong — kode belum berubah. Deteksi "nama lengkap" memiliki risiko false positive tinggi; tim perlu mendefinisikan kriteria dan pesan error. | Belum berubah — menunggu keputusan tim |
| 4 | R04: Hubungkan menu Pengaturan ke handler | Ditunda | Spesifikasi tidak menjanjikan halaman Pengaturan. Bukan prioritas challenge. Tidak memengaruhi alur inti. | Belum berubah |
| 5 | R05: Pindahkan setError keluar dari useMemo | Diterima dan diperbaiki | Pelanggaran aturan React. `React.StrictMode` aktif di `main.jsx` baris 9. `useMemo` diubah menjadi pure function yang mengembalikan `{ projection, validationError }` tanpa `setState`. `validationError` ditampilkan di baris 204. `setError` hanya dipanggil dari `onClick` handler (baris 278, 280). 54 test pass, build berhasil. | `src/components/PricingDashboard.jsx` — refaktor `useMemo` ke derived value |
| 6 | R06: Perjelas dependency array useMemo | Ditolak | `visibleBatches` dihitung di baris 64, di luar `useMemo` di baris 63. Dependency array `[batches, filter]` untuk `sortedBatches` sudah benar — `page` dan `rowsPerPage` bukan input `sortedBatches`. Tidak ada bug. | Tidak berubah |

## 4. Hasil test dan build aktual

Dijalankan pada 2026-10-15 (setelah perbaikan R01, R05, dan ekstraksi `calculateBatchTotals`):

```
npm test   → ℹ tests 57  ℹ pass 57  ℹ fail 0  (421ms)
npm run build → ✓ built in 1.65s  (exit 0)
```

Perincian test per berkas: harvestCalculation (12), harvestValidation (5), gradeValidation (5), harvestStorage (4), harvestProjection (5), harvestRecapChangeRequest (15), csvExporter (10), initialState (1) = **57 total**.

Catatan build: Vite memberi warning "Some chunks are larger than 500 kB" — ini disebabkan oleh bundle MUI + `@mui/x-charts` yang besar. Tidak memengaruhi fungsionalitas; code-splitting dapat dipertimbangkan tetapi di luar cakupan review ini.

Penjelasan kode ditulis terpisah di `08-penjelasan-kode.md`.
