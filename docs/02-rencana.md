# Rencana Kerja

**Waktu mulai:** 10 Oktober 2026
**Batas akhir pengumpulan:** 15 Oktober 2026

| No | Langkah | Penanggung jawab | Cara memeriksa bahwa langkah ini selesai | Estimasi waktu | Waktu sebenarnya | Status |
|---|---|---|---|---|---|---|
| 1 | Wawancara Pengguna & Rumusan Masalah | Hieray & Faris | Bagian 1–3 di `docs/01-spesifikasi.md` terisi | 60 menit | 60 menit | Selesai |
| 2 | Menyusun Kasus Uji & Edge Cases | Ahmad | File `docs/04-kasus-uji.md` terisi lengkap | 45 menit | 45 menit | Selesai |
| 3 | Menyusun Rencana Kerja & Estimasi | Faris & Hieray | File `docs/02-rencana.md` terisi lengkap | 30 menit | 30 menit | Selesai |
| 4 | Push Commit Checkpoint 1 | Faris | Terbuat commit `checkpoint: spesifikasi, kasus uji, dan rencana selesai` | 15 menit | ... menit | Belum |
| 5 | Setup Scaffolding React + Tailwind | Hieray | Proyek di folder `src/` dapat dibuka di browser | 45 menit | ... menit | Belum |
| 6 | Form Input Panen & Validasi Error | Hieray | Input kosong/salah ditolak dengan pesan error yang jelas | 50 menit | ... menit | Belum |
| 7 | Fungsi Logika Kalkulasi Grade & Rupiah | Faris | Perhitungan sampel matematika presisi & lulus pengujian acuan | 60 menit | ... menit | Belum |
| 8 | Pratinjau Hasil & Integrasi localStorage | Hieray | Pratinjau tampil & data tersimpan di `agrisort.panen.v1` | 50 menit | ... menit | Belum |
| 9 | Tabel Rekap Panen & Baris Akumulasi | Hieray | Tabel menampilkan riwayat setoran & akumulasi total harga | 45 menit | ... menit | Belum |
| 10 | Penyesuaian Responsivitas Mobile 360 px | Hieray | Layar HP 360px dapat diakses tanpa scroll horizontal | 30 menit | ... menit | Belum |
| 11 | Push Commit Checkpoint 2 | Faris | Terbuat commit `checkpoint: versi pertama alur inti berjalan` | 15 menit | ... menit | Belum |
| 12 | Analisis Dampak Change Request | Hieray & Faris | File `docs/analisis-change-request.md` terisi & di-commit sebelum koding | 30 menit | ... menit | Belum |
| 13 | Fitur Pencarian & Filter Kategori/Tanggal | Hieray | Pencarian & filter tabel rekap berfungsi secara interaktif | 45 menit | ... menit | Belum |
| 14 | Fitur Ekspor CSV (Format tanpa Rp/Ribuan) | Hieray | Tombol Unduh CSV berfungsi dan file dapat dibuka di Excel | 45 menit | ... menit | Belum |
| 15 | Pengujian Manual K01–K20 & Bukti Foto | Ahmad | Tabel `04-kasus-uji.md` terisi (Pass/Fail) & bukti di `docs/bukti/` | 45 menit | ... menit | Belum |
| 16 | Pembuatan Unit Test & Log Kesalahan AI | Faris & Ahmad | File di folder `tes/` lulus & `docs/05-kesalahan-ai.md` terisi | 45 menit | ... menit | Belum |
| 17 | AI Code Review & Refactor Kode | Faris & Hieray | Catatan review di `docs/06-catatan-review.md` & refactor selesai | 30 menit | ... menit | Belum |
| 18 | Penjelasan Kode per Anggota & Pertanyaan | Seluruh Tim | `docs/08-penjelasan-kode.md` terisi oleh masing-masing anggota | 60 menit | ... menit | Belum |
| | Bug Hunt | Ahmad | Catatan bug di `bughunt-kasir/catatan-bug.md` & test selesai (60m) | 60 menit | ... menit | Belum |
| | Change request | Hieray | Semua kasus uji lama dan baru di fitur Change Request lulus | 120 menit | ... menit | Belum |
| | Dokumentasi dan refleksi | Seluruh Tim | README.md lengkap bisa diikuti orang lain & `07-refleksi.md` terisi | 60 menit | ... menit | Belum |

---

## Informasi Tambahan Perencanaan Tim

### 1. Pembagian Peran
* **Faris (ML Engineer / Project Leader - Navigator & Penguji):** Logika matematika kalkulasi grade (K06–K10), manajemen Git/PR, commit Checkpoint 1 & 2, unit test (`tes/`), dan AI code review.
* **Hieray (Fullstack Engineer - Navigator Utama & Pengode):** Komponen UI (`src/`), Form Input, Tabel Rekap, responsif HP 360 px (K19), integrasi `localStorage`, serta fitur Change Request (Pencarian, Filter, Ekspor CSV).
* **Ahmad (Co-Fullstack / QA & Testing - Penguji & Dokumentator):** Pengujian manual K01–K20 (`04-kasus-uji.md`), tangkapan layar bukti (`docs/bukti/`), eksekusi Bug Hunt (60m), serta log prompt (`03-log-prompt.md`).

### 2. Aturan Git & Format Pesan Commit
Semua commit wajib diawali dengan jenis perubahan resmi: `fitur:`, `perbaikan:`, `tes:`, `dokumen:`, `refactor:`, `checkpoint:`, atau `bughunt:`.
