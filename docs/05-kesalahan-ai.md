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
