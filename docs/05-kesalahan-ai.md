# Kesalahan AI yang Kami Temukan

Catat setiap kali AI memberikan hasil yang salah, tidak sesuai spesifikasi, atau tidak perlu.
Ini bukan catatan kegagalan tim. Justru ini bukti bahwa tim memeriksa hasil AI.

| No | Apa yang diminta | Kesalahan AI | Bagaimana kami mengetahuinya | Perbaikan yang kami lakukan |
|---|---|---|---|---|
| 1 | Form input panen dengan validasi berat (log #3) | Validasi berat nol memakai perbandingan string, sehingga `0.0`, `0,00`, `0,0` lolos | Audit read-only T01: test `'0.0'`/`'0,00'` tidak ditolak (log #14) | Ubah ke `parseNumber(...) === 0` dengan TDD (log #15) |
| 2 | Dashboard metrik yang dapat diverifikasi (log #10) | Metrik dashboard mengklaim akurasi model AI padahal tidak ada model AI di proyek | Tim meninjau klaim dashboard saat Pricing Dashboard dibangun | Ganti metrik menjadi fakta yang dapat diverifikasi: jumlah komoditas, sumber harga simulasi (log #10) |
| 3 | Halaman dashboard dengan navigasi berfungsi (log #2) | Tombol "Mulai scan batch" dan "Buka QC Scanner" tidak punya `onClick` handler | Audit read-only T10: kedua tombol tidak memanggil navigasi (log #14) | Tambah `onNavigate('scanner')` ke `DashboardPreview` dan kedua tombol (log #15) |
| 4 | Pricing Dashboard dengan proyeksi pendapatan (log #10) | `setError()` dipanggil di dalam callback `useMemo` — React melarang side effect di render fase | Code review R05: grep `setError` di `useMemo` baris 56, 60, 64, 77 (log #16) | Refaktor `useMemo` ke derived value `{ projection, validationError }` tanpa `setState` (log #18) |
| 5 | Halaman rekap panen sesuai spesifikasi (log #7) | Tabel rekap tidak memiliki baris total (jumlah berat + jumlah nilai) | Code review R01: spesifikasi §4 baris 175 dan K16 mewajibkan baris total, kode tidak punya `<TableFooter>` (log #16) | Tambah `<TableFooter>` dengan `calculateBatchTotals(visibleBatches)` (log #18–#19) |
| 6 | Catatan review yang akurat (log #16) | R01, R03, R05 ditandai "Diterima" padahal kode belum berubah | Audit verifikasi ulang: `grep` membuktikan kode belum berubah (log #17) | Koreksi status menjadi "Ditunda (belum diterapkan)" di `docs/06-catatan-review.md` (log #17) |
| 7 | Deskripsi teknis R05 yang presisi (log #16) | Menyebut StrictMode mengeksekusi `useMemo` "tepat dua kali" | Verifikasi perilaku React StrictMode: tidak menjamin eksekusi tepat dua kali | Koreksi menjadi "dapat dijalankan lebih dari sekali per render cycle" (log #18) |

---

## Detail per Temuan

### Temuan 1 — Validasi berat nol memakai perbandingan string

**Konteks:** Implementasi form input panen dengan validasi two-tier (log prompt #3, #4). AI membuat `src/business/harvestValidation.js` dan `tes/harvestValidation.test.js`.

**Keluaran AI:** Fungsi `validateHarvestForm` memeriksa berat nol dengan perbandingan string terhadap `'0'`, bukan perbandingan numerik. Akibatnya, input seperti `0.0`, `0.00`, `0,0`, dan `0,00` tidak ditolak — semuanya bernilai numerik nol tetapi berbeda secara string.

**Bukti:**
- Komentar di `src/business/harvestValidation.js` baris 69: `"Cek numerik, bukan perbandingan string: '0.0', '0,00', dan varian nol lain harus ditolak sama seperti '0'"`.
- Log prompt #14 (audit read-only): T01 "bug berat `0.0` lolos validasi" dengan prioritas TINGGI.
- Log prompt #15: perbaikan T01 dengan TDD — 2 test baru untuk varian nol desimal.
- Test `tes/harvestValidation.test.js` menguji `'0'`, `'0.0'`, `'0.00'`, `'0,0'`, `'0,00'` ditolak, dan `'0,5'` (berat sah) tetap diterima.

**Cara ditemukan:** Audit read-only (log #14) memeriksa validasi berat nol dan menemukan bahwa varian desimal nol tidak ditolak. Test kemudian ditulis untuk membuktikan bug (RED), lalu kode diperbaiki (GREEN).

**Perbaikan:** Baris 71 `harvestValidation.js` diubah menjadi `if (parseNumber(String(form.beratKg ?? '').trim()) === 0)` — perbandingan numerik menggunakan `parseNumber` yang menormalisasi koma desimal ke titik.

**Pencegahan:** Validasi angka selalu memakai parser numerik (`parseNumber`), bukan perbandingan string. Test harus mencakup varian format desimal Indonesia (`0,0`) dan internasional (`0.0`).

---

### Temuan 2 — Metrik dashboard mengklaim akurasi model AI

**Konteks:** Pembuatan halaman Dashboard (overview) di `src/App.jsx` (log prompt #2), kemudian penyempurnaan Pricing Dashboard (log prompt #10).

**Keluaran AI:** Dashboard awal berisi metrik yang mengklaim akurasi model AI (misalnya akurasi klasifikasi grade), padahal proyek tidak memiliki model AI, inferensi YOLO/ONNX, atau integrasi machine learning apa pun — ini di luar cakupan §5 spesifikasi.

**Bukti:**
- Log prompt #10: *"metrik dashboard yang sebelumnya mengklaim akurasi model diganti menjadi fakta yang dapat diverifikasi"*.
- Kode aktual `App.jsx` baris 44–48: metrik sekarang berisi "Batch tersimpan: Lokal", "Komoditas terdaftar: 3", "Sumber harga: Simulasi" — semuanya fakta yang dapat diverifikasi, bukan klaim akurasi.
- `docs/01-spesifikasi.md` Bagian 5: integrasi AI YOLO/ONNX berada di luar cakupan proyek.

**Cara ditemukan:** Tim meninjau klaim yang ditampilkan di dashboard saat menyusun Pricing Dashboard (log #10) dan menyadari bahwa metrik lama menyebut akurasi model yang tidak ada.

**Perbaikan:** Metrik dashboard diganti menjadi: jumlah komoditas terdaftar (dapat diverifikasi dari `COMMODITY_OPTIONS.length`), sumber harga "Simulasi" (dapat diverifikasi dari `PRICE_REFERENCE_SOURCE`), dan status penyimpanan "Lokal" (dapat diverifikasi dari `localStorage`).

**Pencegahan:** AI tidak boleh menghasilkan klaim kuantitatif (akurasi, latensi, performa) tentang fitur yang tidak ada di source code atau spesifikasi. Tim harus memeriksa setiap angka di UI dan menelusuri sumbernya ke kode atau data aktual.

---

### Temuan 3 — Tombol dashboard tanpa navigasi

**Konteks:** Pembuatan halaman Dashboard dengan tombol "Mulai scan batch" dan "Buka QC Scanner" (log prompt #2).

**Keluaran AI:** `DashboardPreview` di `App.jsx` memiliki dua tombol yang terlihat interaktif tetapi tidak memanggil fungsi navigasi apa pun. Tombol-tombol ini adalah dead code — tidak melakukan apa-apa saat diklik.

**Bukti:**
- Log prompt #14 (audit read-only): T10 "UI dead code/hardcode" — tombol dashboard tidak terhubung ke navigasi.
- Log prompt #15: perbaikan T10 — `onNavigate` diteruskan ke `DashboardPreview` dan kedua tombol.
- Kode aktual `App.jsx` baris 75: `function DashboardPreview({ onNavigate })` — prop `onNavigate` ditambahkan setelah perbaikan.
- Baris 89: `onClick={() => onNavigate('scanner')}` untuk tombol "Mulai scan batch".
- Baris 131: `onClick={() => onNavigate('scanner')}` untuk tombol "Buka QC Scanner".

**Cara ditemukan:** Audit read-only (log #14) memeriksa seluruh tombol interaktif dan menemukan bahwa tombol dashboard tidak memanggil `onNavigate` atau handler apa pun.

**Perbaikan:** Prop `onNavigate` ditambahkan ke `DashboardPreview` (baris 75), dan kedua tombol dipasang `onClick={() => onNavigate('scanner')}` (baris 89, 131). Target `'scanner'` valid di objek `pages` (baris 38).

**Pencegahan:** Setiap elemen yang terlihat interaktif (Button dengan ikon dan teks aksi) harus memiliki handler yang terhubung ke fungsi atau navigasi yang valid. Tim harus mengklik setiap tombol saat pengujian manual.

---

### Temuan 4 — setError di dalam useMemo

**Konteks:** Pembuatan `src/components/PricingDashboard.jsx` dengan form proyeksi pendapatan (log prompt #10).

**Keluaran AI:** Callback `useMemo` di `PricingDashboard.jsx` baris 55–80 memanggil `setError()` empat kali (baris 56, 60, 64, 77). `setError` adalah `useState` setter — React melarang pemanggilan `setState` selama render fase, termasuk di dalam `useMemo`.

**Bukti:**
- Log prompt #16 (code review): R05 "`setError()` dipanggil di dalam `useMemo`" dengan prioritas SEDANG.
- `main.jsx` baris 9: `<React.StrictMode>` aktif — React dapat menjalankan callback `useMemo` lebih dari sekali per render cycle di mode pengembangan untuk mendeteksi side effect.
- Log prompt #17 (audit verifikasi ulang): `grep -n "setError" src/components/PricingDashboard.jsx` menemukan empat pemanggilan di baris 56, 60, 64, 77 (di dalam `useMemo`) dan dua di baris 278, 280 (di `onClick` handler — tidak bermasalah).
- Kode aktual (setelah perbaikan): `useMemo` baris 55–79 mengembalikan `{ projection, validationError }` tanpa `setState`.

**Cara ditemukan:** Code review (log #16) memeriksa penggunaan `setState` di dalam hook React dan menemukan pola anti-pattern. Audit verifikasi (log #17) mengkonfirmasi dengan `grep`.

**Perbaikan:** `useMemo` direfaktor menjadi fungsi murni yang mengembalikan objek `{ projection, validationError }`. `validationError` ditampilkan di baris 204 (`Alert severity="error"`). `setError` hanya dipanggil dari `onClick` handler (baris 278, 280) untuk hasil tombol "Coba markup/margin" — ini tidak bermasalah karena berada di event handler, bukan render fase.

**Pencegahan:** Callback `useMemo` harus murni — hanya membaca input dan mengembalikan nilai, tanpa side effect. Jika perlu menyimpan status error, gunakan derived value dari `useMemo` dan tampilkan di JSX, atau pindahkan ke `useEffect` atau event handler.

---

### Temuan 5 — Baris total rekap tidak diimplementasikan

**Konteks:** Pembuatan halaman rekap data panen dengan tabel, pagination, dan dialog detail (log prompt #7).

**Keluaran AI:** `src/components/HarvestRecap.jsx` dibuat dengan `<TableHead>`, `<TableBody>`, dan `<TablePagination>`, tetapi tidak memiliki `<TableFooter>` atau baris total yang menjumlahkan berat dan nilai.

**Bukti:**
- `docs/01-spesifikasi.md` §4 Langkah 3 baris 175: *"Di bawah tabel ada baris total: jumlah berat (kg) dan jumlah nilai (Rp) dari seluruh baris yang tampil."*
- Kriteria K16: *"Angka di baris total rekap sama dengan jumlah kolom berat dan kolom total nilai yang tampil."*
- Log prompt #16 (code review): R01 "Tabel rekap tidak memiliki baris total" dengan prioritas TINGGI.
- Kode aktual (setelah perbaikan): `<TableFooter>` baris 226–238 dengan `calculateBatchTotals(visibleBatches)`.

**Cara ditemukan:** Code review (log #16) membandingkan kolom dan elemen tabel di `HarvestRecap.jsx` dengan spesifikasi §4 dan menemukan baris total tidak ada.

**Perbaikan:** Ditambahkan `<TableFooter>` setelah `</TableBody>` (baris 226). Logika perhitungan diekstrak ke fungsi murni `calculateBatchTotals(batches)` di `src/business/harvestFilter.js` (baris 80–88) yang menjumlahkan `Number(batch?.beratKg) || 0` dan `Number(batch?.hasil?.totalNilai) || 0`. Fungsi diuji dengan 3 unit test: daftar kosong, beberapa batch, dan batch tanpa `hasil` (log #19).

**Pencegahan:** Saat mengimplementasikan komponen yang menampilkan tabel data, periksa spesifikasi untuk persyaratan baris total, kolom wajib, dan format angka. Jangan hanya mengimplementasikan struktur dasar tabel tanpa membaca seluruh §4 spesifikasi.

---

### Temuan 6 — Status review "Diterima" untuk perubahan yang belum diterapkan

**Konteks:** Pengisian catatan code review `docs/06-catatan-review.md` (log prompt #16). AI melakukan review menyeluruh dan mengisi dokumen review dengan 6 temuan R01–R06.

**Keluaran AI:** Pada versi awal `docs/06-catatan-review.md`, temuan R01, R03, dan R05 ditandai "Diterima" di kolom keputusan, padahal kode sumber belum berubah — tidak ada perbaikan yang diterapkan.

**Bukti:**
- Log prompt #17 (audit verifikasi ulang): *"R01/R03/R05 yang sebelumnya ditandai 'Diterima' diubah menjadi 'Ditunda (belum diterapkan)' karena verifikasi `grep` dan `sed` membuktikan kode belum berubah."*
- `docs/06-catatan-review.md` baris 105: R03 keputusan "Ditunda (belum diterapkan)" dengan catatan *"Verifikasi `grep -n "pribadi\|HP\|08.*\\d" src/business/harvestValidation.js` mengembalikan kosong — kode belum berubah."*
- R01 dan R05 baru diperbaiki di log #18, bukan di log #16 saat review ditulis.

**Cara ditemukan:** Audit verifikasi ulang (log #17) memeriksa setiap klaim "Diterima" dengan `grep` dan `sed` terhadap source code aktual. Hasil: kode belum berubah untuk R01, R03, dan R05, sehingga klaim "Diterima" tidak didukung bukti.

**Perbaikan:** Status R01, R03, R05 diubah dari "Diterima" menjadi "Ditunda (belum diterapkan)". Setelah R01 dan R05 benar-benar diperbaiki di log #18, status diperbarui kembali menjadi "Diterima dan diperbaiki".

**Pencegahan:** AI tidak boleh menandai temuan sebagai "Diterima" atau "Diperbaiki" tanpa memverifikasi bahwa kode sumber benar-benar berubah. Verifikasi harus dilakukan dengan membaca diff atau `grep` pola kode yang spesifik, bukan hanya dengan asumsi bahwa rekomendasi akan diterapkan.

---

### Temuan 7 — Deskripsi R05 "dua kali" tidak presisi

**Konteks:** Penjelasan teknis untuk temuan R05 (`setError` di `useMemo`) di `docs/06-catatan-review.md` (log prompt #16 dan #18).

**Keluaran AI:** Pada versi awal catatan review, AI menyebutkan bahwa `React.StrictMode` menyebabkan callback `useMemo` "dieksekusi ganda" atau "dua kali". Klaim ini tidak presisi — StrictMode tidak menjamin eksekusi tepat dua kali.

**Bukti:**
- Log prompt #18: *"R05 presisi 'dapat dijalankan lebih dari sekali' bukan 'tepat dua kali'"*.
- `docs/06-catatan-review.md` baris 39 (versi final): *"callback `useMemo` dapat dijalankan lebih dari sekali per render cycle di development mode"* — bukan "dua kali".
- Dokumentasi React: StrictMode sengaja menjalankan komponen, `useMemo`, dan `useEffect` tambahan untuk mendeteksi side effect, tetapi jumlah eksekusinya tidak dijamin tepat dua kali.

**Cara ditemukan:** Audit final (log #18) memeriksa presisi bahasa teknis di catatan review dan menemukan bahwa "dua kali" adalah klaim yang tidak dapat diverifikasi.

**Perbaikan:** Deskripsi diubah menjadi "dapat dijalankan lebih dari sekali per render cycle" — frasa yang lebih akurat dan tidak membuat klaim kuantitatif yang tidak dapat diverifikasi.

**Pencegahan:** Saat menjelaskan perilaku framework, gunakan dokumentasi resmi sebagai sumber. Hindari klaim kuantitatif ("dua kali", "pasti", "selalu") kecuali didukung dokumentasi yang eksplisit. Gunakan frasa yang lebih hati-hati ("dapat", "berpotensi", "lebih dari sekali").

---

## Catatan

- Semua temuan di atas didukung bukti dari `docs/03-log-prompt.md`, `docs/06-catatan-review.md`, source code aktual, atau `docs/01-spesifikasi.md`.
- Tidak semua bug di source code dicatat sebagai kesalahan AI — hanya yang dapat ditelusuri ke keluaran AI yang tercatat di log prompt.
- Temuan R02 (kolom rekap belum lengkap), R03 (validasi data pribadi), dan R04 (menu Pengaturan) tidak dicatat di sini karena merupakan keputusan desain yang masih ditunda tim, bukan kesalahan teknis keluaran AI.
- Temuan R06 (dependency array `useMemo`) tidak dicatat karena ditolak setelah verifikasi — bukan bug.
