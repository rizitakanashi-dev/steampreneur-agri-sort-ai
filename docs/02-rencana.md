# Rencana Kerja

**Waktu mulai:** 10 Oktober 2026  
**Batas akhir pengumpulan:** 15 Oktober 2026  

| No | Langkah | Penanggung jawab | Cara memeriksa bahwa langkah ini selesai | Estimasi waktu | Waktu sebenarnya | Status |
|---|---|---|---|---|---|---|
| 1 | Wawancara Pengguna & Rumusan Masalah | Hieray & Faris | Bagian 1–3 di `docs/01-spesifikasi.md` terisi | 60 menit | 60 menit | Selesai |
| 2 | Menyusun Kasus Uji & Edge Cases | Ahmad | File `docs/04-kasus-uji.md` terisi lengkap | 45 menit | 40 menit | Selesai |
| 3 | Menyusun Rencana Kerja & Estimasi | Faris & Hieray | File `docs/02-rencana.md` terisi lengkap | 30 menit | 30 menit | Selesai |
| 4 | Push Commit Checkpoint 1 | Faris | Terbuat commit `checkpoint: spesifikasi, kasus uji, dan rencana selesai` | 15 menit | 13 menit | Selesai |
| 5 | Setup Scaffolding React / Next.js + Tailwind | Hieray | Proyek di folder `src/` dapat dibuka di browser | 45 menit | ≈30 menit (log #1–#2) | Selesai (disesuaikan) — memakai React + Vite + MUI sesuai stack lock, bukan Next.js/Tailwind |
| 6 | Form Input Panen & Validasi Two-Tier (Blur & Objek Luar) | Hieray | Validasi *Laplacian Variance* (<100) & filter objek luar lulus | 50 menit | ≈125 menit (log #2–#4) | Selesai (disesuaikan) — form & validasi blur/onBlur selesai; validasi citra (K02/K03) tidak dikerjakan karena di luar cakupan §5 |
| 7 | Fungsi Logika Kalkulasi Grade & Pricing | Faris | Perhitungan sampel matematika presisi & lulus pengujian acuan | 60 menit | ≈60 menit (log #5–#6) | Selesai — 7 contoh §6.4 diverifikasi cocok |
| 8 | Model AI YOLO/ONNX, WebP, & localStorage | Faris & Hieray | Inferensi AI (<500ms), WebP (<200KB), & data tersimpan di `agrisort.panen.v1` | 50 menit | ≈30 menit (log #7–#8) | Selesai (disesuaikan) — hanya penyimpanan `localStorage` yang dikerjakan; YOLO/ONNX/WebP tidak ada karena di luar cakupan §5 |
| 9 | Integrasi API BAPANAS & Offline Fallback | Hieray | Integrasi BAPANAS & *fallback* `agrisort.harga_cache.v1` berfungsi | 50 menit | ≈60 menit (log #9–#10) | Selesai (disesuaikan) — harga acuan adalah tabel tetap simulasi di `priceReference.js`; tidak ada API BAPANAS maupun cache `agrisort.harga_cache.v1` (§5) |
| 10 | Tabel Rekap Panen & Responsif Mobile 360 px | Hieray | Tabel riwayat privat RLS & responsif 360px tanpa scroll horizontal | 45 menit | ≈45 menit (log #7–#9) | Selesai (disesuaikan) — tabel rekap & responsif 360px selesai; RLS tidak ada karena tanpa autentikasi/backend (§5) |
| 11 | Push Commit Checkpoint 2 | Faris | Terbuat commit `checkpoint: versi pertama alur inti berjalan` | 15 menit | ≈13 menit | Selesai — commit `9c9cd43` |
| 12 | Analisis Dampak Change Request | Hieray & Faris | File `docs/analisis-change-request.md` terisi & di-commit | 30 menit | 35 menit | Selesai |
| 13 | Fitur Pencarian & Filter Kategori/Tanggal | Hieray | Pencarian & filter tabel rekap berfungsi secara interaktif | 45 menit | 45 menit | Selesai |
| 14 | Fitur Ekspor CSV & Cetak Sertifikat PDF | Hieray | Tombol Unduh CSV & Cetak PDF berfungsi rapi | 45 menit | 40 menit | **Selesai sebagian** — Ekspor CSV selesai; Cetak Sertifikat PDF tidak dikerjakan (di luar kriteria Change Request, dan tidak ada pustaka PDF yang ditambahkan) |
| 15 | Pengujian Manual K01–K20 & Bukti Foto | Ahmad & Faris| Tabel `04-kasus-uji.md` terisi (Pass/Fail) & bukti di `docs/bukti/` | 45 menit | 30 menit | selesai |
| 16 | Pembuatan Unit Test & Log Kesalahan AI | Faris & Ahmad | File di folder `tes/` lulus & `docs/05-kesalahan-ai.md` terisi | 45 menit | 45 menit | Selesai |
| 17 | AI Code Review & Refactor Kode | Faris & Hieray | Catatan review di `docs/06-catatan-review.md` & refactor selesai | 30 menit | 40 menit | Selesai |
| 18 | Penjelasan Kode per Anggota & Pertanyaan | Seluruh Tim | `docs/08-penjelasan-kode.md` terisi oleh masing-masing anggota | 60 menit | 60 menit | Selesai |
| 19 | Bug Hunt & Testing Integrasi | Ahmad | Catatan bug di `bughunt-kasir/catatan-bug.md` selesai | 60 menit | 60 menit | Selesai |
| 20 | Eksekusi Fitur Change Request | Hieray | Semua kasus uji lama dan baru di fitur Change Request lulus | 120 menit | 105 menit | Selesai |
| 21 | Dokumentasi Final & Refleksi | Seluruh Tim | `README.md` lengkap & `07-refleksi.md` terisi penuh | 60 menit | 60 menit | Selesai |

---

## Informasi Tambahan Perencanaan Tim

### 1. Pembagian Peran
- **Faris Al Farizi (Project Leader / ML & Backend Engineer):** Arsitektur model AI YOLOv8/11 (ONNX), integrasi REST API FastAPI, konfigurasi Supabase Auth & Row Level Security (RLS), logika matematika kalkulasi grade (K06–K10), unit test (`tes/`), dan AI code review[cite: 4, 5].
- **Hieray Antovino (Fullstack & Frontend Engineer):** Komponen UI Next.js/Tailwind CSS, validasi *client-side* (blur detection & WebP compression), integrasi API BAPANAS, *offline fallback* `localStorage`, serta fitur Change Request (Pencarian, Filter, Ekspor CSV)[cite: 5].
- **Ahmad Afif (QA & Technical Documentator):** Pengujian manual K01–K20 (`04-kasus-uji.md`), tangkapan layar bukti (`docs/bukti/`), eksekusi *bug hunt*, serta log prompt (`03-log-prompt.md`).

### 2. Aturan Git & Format Pesan Commit
Semua commit wajib diawali dengan jenis perubahan resmi: `fitur:`, `perbaikan:`, `tes:`, `dokumen:`, `refactor:`, `checkpoint:`, atau `bughunt:`.
