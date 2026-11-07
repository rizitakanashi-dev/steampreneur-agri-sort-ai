# Evaluasi & Audit Proyek — Agri-Sort AI (STEAMPreneur 2026)

| Item | Keterangan |
|---|---|
| Project | `steampreneur-agri-sort-ai` (Agri-Sort AI) |
| Institusi / Pengembang | SMKN 4 Payakumbuh — Rekayasa Perangkat Lunak (RPL) |
| Tim | Faris Al Farizi (Ketua), Hieray Antovino (Anggota 1), Ahmad Afif (Anggota 2) |
| Pembimbing | Rogi Auvi, S.Pd |
| Acuan Kompetisi | Sayembara STEAMPreneur SMK Tingkat Nasional Tahun 2026 ("Solusi Nyata untuk Indonesia") |
| Dokumen Acuan | `Proposal STEAMPreneur SMK Tahun 2026.docx.pdf` & `docs/01-spesifikasi.md` |
| Scope Audit | **Full-Stack & Sistem AI** (Kesesuaian Proposal vs Kode Nyata, Logika Bisnis, Keamanan, Performa) |
| Tanggal Review | 3 November 2026 (Diperbarui: 4 November 2026) |
| Versi Terakhir Dianalisis | Main (Sprint 1: Perbaikan Bug Fondasi P0) |
| Status Audit | **Bug Fondasi P0 Teratasi — 60/60 Tests Lulus (Menuju Integrasi AI)** |

---

## Ringkasan Eksekutif

Audit ini disusun secara independen dan obyektif untuk mengevaluasi kondisi kode saat ini (`steampreneur-agri-sort-ai`) terhadap janji inovasi pada **Proposal STEAMPreneur SMK Tingkat Nasional Tahun 2026** serta arahan penugasan mentor.

Pada review awal (3 Nov 2026), repositori berada pada fase fondasi klien dengan 57 pengujian. Pada pembaruan **4 November 2026**, seluruh temuan **Prioritas P0** (bug presisi floating-point `Number.EPSILON`, kebocoran tanggal kosong pada filter, penguncian dependensi `package.json`, dan penambahan komoditas proposal BPS) telah **selesai diperbaiki dan diverifikasi** dengan total **60 pengujian otomatis lulus 100% (`node --test`)**.

Fokus pengembangan berikutnya bergeser ke **Prioritas P1**: membangun antarmuka pemindaian kamera (*Batch QC Scanner UI*) dan mengintegrasikan model AI `model-export/weights/best.onnx` sesuai panduan [`docs/workflow.md`](docs/workflow.md).

---

## Daftar Isi

- [A. Gap Analisis: Janji Proposal STEAMPreneur 2026 vs Realisasi Kode](#a-gap-analisis-janji-proposal-steampreneur-2026-vs-realisasi-kode)
- [B. Bug Kritis & Logika Bisnis (Dengan file:baris)](#b-bug-kritis--logika-bisnis-dengan-filebaris)
- [C. Kualitas Kode, Tooling, & Dependensi](#c-kualitas-kode-tooling--dependensi)
- [D. Evaluasi 5 Pilar STEAM (Science, Tech, Engineering, Arts, Math)](#d-evaluasi-5-pilar-steam)
- [E. Inventarisasi Fitur & Komponen Saat Ini](#e-inventarisasi-fitur--komponen-saat-ini)
- [F. Yang Sudah Bagus (Pertahankan & Jangan Diubah)](#f-yang-sudah-bagus-pertahankan--jangan-diubah)
- [G. Checklist Penyelesaian & Rekomendasi Bertahap (P0, P1, P2)](#g-checklist-penyelesaian--rekomendasi-bertahap)
- [H. Perintah Cek Cepat & Verifikasi Pengujian](#h-perintah-cek-cepat--verifikasi-pengujian)

---

## A. Gap Analisis: Janji Proposal STEAMPreneur 2026 vs Realisasi Kode

Proposal lomba resmi mengajukan inovasi Web App Quality Control & Smart Pricing berbasis AI untuk komoditas hortikultura. Berikut matriks komparasi antara proposal dengan kondisi implementasi di repositori saat ini:

| No | Komponen Inovasi | Janji Proposal STEAMPreneur 2026 | Realisasi Kode Repositori Saat Ini | Status Kesenjangan |
|---|---|---|---|---|
| **A1** | **Computer Vision / AI Core** | Deteksi buah Grade A, Grade B, Reject secara otomatis berbasis model **YOLO11** (ekspor ONNX / OpenVINO), latensi < 500 ms di droplet CPU. | **Belum ada inferensi AI.** Mutu ditentukan lewat input manual form / slider (persentase kesegaran & cacat) di [`src/components/HarvestForm.jsx:130`](src/components/HarvestForm.jsx#L130). | ⚠️ **GAP UTAMA** (Wajib dikerjakan untuk lomba) |
| **A2** | **Kamera / Batch Scanner** | Pemindaian foto keranjang panen langsung via kamera smartphone/laptop pengguna. | **Selesai diimplementasikan.** Komponen Batch Camera & Upload Foto Keranjang aktif di [`src/components/HarvestForm.jsx`](src/components/HarvestForm.jsx) (kamera HP `capture="environment"`, galeri, drag-and-drop, validasi 10 MB, dan pratinjau). | ✅ **SELESAI (Sprint 2)** |
| **A3** | **Integrasi Harga BAPANAS** | Mengambil data harga harian resmi secara otomatis via API Panel Harga Badan Pangan Nasional untuk wilayah lokal/provinsi. | Menggunakan tabel konstanta simulasi statis di [`src/business/priceReference.js:15-30`](src/business/priceReference.js#L15-L30). Komponen eksplisit menyatakan "Bukan data resmi BAPANAS". | ⚠️ **GAP UTAMA** |
| **A4** | **Backend & API Service** | Python (FastAPI) REST API yang di-deploy pada DigitalOcean CPU Droplet untuk menangani inferensi ONNX dan kalkulasi harga cerdas. | **Fondasi backend aktif.** Struktur [`server/main.py`](server/main.py) dan `requirements.txt` selesai dibuat dengan healthcheck `GET /api/v1/health`, proteksi CORS, dan error handler terstandarisasi (Task FS-BE-01). | 🟡 **PROGRES (Fase 1 Backend)** |
| **A5** | **Basis Data & Cloud Storage** | Supabase Cloud BaaS (Database PostgreSQL, Otentikasi Pengguna, Row-Level Security / RLS, dan penyimpanan berkas gambar 30 hari). | Data disimpan di `localStorage` peramban dengan key `agrisort.panen.v1` ([`src/business/harvestStorage.js:1`](src/business/harvestStorage.js#L1)). Tanpa autentikasi, tanpa RLS, tanpa backup cloud. | ⚠️ **GAP ARSITEKTUR** |
| **A6** | **Penyelarasan Komoditas** | Cabai Besar (1.720.000 ton), Cabai Rawit (1.743.125 ton), dan Tomat (1.227.949 ton) sesuai data statistik BPS hortikultura nasional. | **Selesai diselaraskan.** Ditambahkan `Cabai Merah Keriting` (Rp45.000/kg) dan `Cabai Rawit Merah` (Rp42.000/kg) di [`src/business/priceReference.js`](src/business/priceReference.js) dan [`src/business/harvestValidation.js`](src/business/harvestValidation.js). | ✅ **SELESAI (Sprint 1)** |
| **A7** | **Framework Frontend** | Proposal Bagian 3.2 & 5.2 menuliskan Next.js & Tailwind CSS. | Menggunakan React 19.3 + Vite 8.3 + Material UI (MUI) v9.5 + Emotion. Sesuai kesepakatan arahan mentor (Stack Lock). | ✅ **DITERIMA** (Stack React + Vite + MUI sudah sangat solid dan performan). |

> **Catatan Kontekstual Mentor:** Sesuai penjelasan pengguna, kode saat ini baru mencakup instruksi tahap awal mentor (membangun pondasi logika kalkulasi lokal yang kokoh sebelum menghubungkannya ke model machine learning dan backend cloud). Oleh karena itu, gap ini bukan kegagalan, melainkan peta jalan pengembangan berikutnya.

---

## B. Bug Kritis & Logika Bisnis (Dengan `file:baris`)

### B1. [TERATASI 4 NOV 2026] Bug Presisi Floating-Point `Number.EPSILON` Menyebabkan Crash

- **Lokasi Kode Asal:** [`src/business/harvestCalculation.js:53`](src/business/harvestCalculation.js#L53)
- **Status Perbaikan:** ✅ **Selesai Diperbaiki & Lulus Uji.**
- **Solusi yang Diterapkan:**
  Toleransi presisi diubah dari `Number.EPSILON` menjadi `1e-9`:
  ```javascript
  const sumPercentages = values.reduce((sum, value) => sum + value, 0)
  if (values.some((value) => value < 0 || value > 100) || Math.abs(sumPercentages - 100) > 1e-9) {
    throw new RangeError('Persentase grade harus berjumlah 100% dan berada pada rentang 0 sampai 100.')
  }
  ```
  Diverifikasi dengan unit test baru: `tes/harvestCalculation.test.js` (`calculateGradeWeights menangani desimal floating-point IEEE-754 yang berjumlah 100 tanpa RangeError`).

---

### B2. [TERATASI 4 NOV 2026] Pencocokan Tanggal pada Filter Rentang Tanggal Melewati Batch Tanpa Tanggal

- **Lokasi Kode Asal:** [`src/business/harvestFilter.js:36-43`](src/business/harvestFilter.js#L36-L43)
- **Status Perbaikan:** ✅ **Selesai Diperbaiki & Lulus Uji.**
- **Solusi yang Diterapkan:**
  Jika filter rentang tanggal `from` atau `to` aktif dan sebuah batch tidak memiliki tanggal, dievaluasi menjadi `false`:
  ```javascript
  function matchesDateRange(batch, from, to) {
    const start = String(from ?? '').trim()
    const end = String(to ?? '').trim()
    if (!start && !end) return true
    const date = String(batch?.tanggal ?? '').trim()
    if (!date) return false
    if (start && date < start) return false
    if (end && date > end) return false
    return true
  }
  ```
  Diverifikasi dengan unit test baru: `tes/harvestRecapChangeRequest.test.js` (`filter rentang tanggal mengabaikan batch tanpa tanggal ketika filter aktif`).

---

### B3. [SEDANG] Kerentanan Data di `localStorage` (Ketiadaan Enkripsi & Limit Penyimpanan)

- **Lokasi Kode:** [`src/business/harvestStorage.js:1`](src/business/harvestStorage.js#L1)
- **Gejala Masalah:**
  - `localStorage` browser memiliki batas kapasitas rata-rata 5 MB. Jika data panen bertambah hingga ratusan batch atau jika nantinya ada lampiran base64 thumbnail gambar hasil deteksi keranjang, `localStorage` akan melempar `QuotaExceededError`.
  - Data hasil panen dan perkiraan omzet disimpan dalam format JSON polos tanpa autentikasi pengguna. Siapa pun yang membuka browser yang sama dapat melihat atau menghapus seluruh riwayat panen via `clearBatches()`.
- **Rekomendasi Perbaikan:**
  - Jangka pendek: Tangani `QuotaExceededError` dengan blok `try-catch` ramah pengguna di `saveBatch`.
  - Jangka menengah (sesuai Proposal): Migrasikan persistensi ke database Supabase Cloud PostgreSQL dengan enkripsi HTTPS dan Row Level Security (`auth.uid() = user_id`).

---

### B4. [RENDAH] Menu Pengaturan di AppShell Tidak Memiliki Aksi (`onClick`)

- **Lokasi Kode:** [`src/components/AppShell.jsx:113`](src/components/AppShell.jsx#L113)
- **Gejala Masalah:**
  Item navigasi "Pengaturan" pada Sidebar Drawer tidak memiliki properti `onClick` atau routing aktif. Pengguna yang mengklik item tersebut tidak mendapatkan respons apa pun.
- **Rekomendasi Perbaikan:**
  Berikan aksi modal/dialog informasi profil pengguna SMK atau sembunyikan sementara sampai modul manajemen akun / konfigurasi harga selesai dibuat.

---

## C. Kualitas Kode, Tooling, & Dependensi

### C1. [TERATASI 4 NOV 2026] Versi Dependensi Menggunakan Tag `"latest"` di `package.json`

- **Lokasi Kode Asal:** [`package.json:13-24`](package.json#L13-L24)
- **Status Perbaikan:** ✅ **Selesai Dikunci Sesuai `package-lock.json`.**
- **Solusi yang Diterapkan:**
  Seluruh dependensi telah di-pin ke versi semantik eksplisit:
  ```json
  "dependencies": {
    "@emotion/react": "^11.14.0",
    "@emotion/styled": "^11.14.1",
    "@mui/icons-material": "^9.5.0",
    "@mui/material": "^9.5.0",
    "@mui/x-charts": "^9.15.0",
    "react": "^19.3.0",
    "react-dom": "^19.3.0"
  },
  "devDependencies": {
    "@vitejs/plugin-react": "^6.1.2",
    "vite": "^8.3.4"
  }
  ```

---

### C2. Perintah `npm run build` Gagal jika `node_modules` Belum Terinstall

- **Status Pengujian:** Saat menjalankan `npm run build` langsung, terminal menampilkan:
  `sh: line 1: vite: command not found (exit code 127)`.
- **Penyebab:** Folder `node_modules` belum diunduh di *clean workspace*.
- **Kelebihan Unik:** Menariknya, `npm test` tetap berjalan sukses 100% (57/57 tests lulus) karena modul pengujian tim dirancang dengan brilian menggunakan Node.js *built-in test runner* (`node --test`) tanpa bergantung pada framework pihak ketiga seperti Jest atau Vitest!

---

## D. Evaluasi 5 Pilar STEAM

Proposal STEAMPreneur SMK mewajibkan integrasi nyata dari 5 pilar:

| Pilar | Janji pada Proposal | Status Implementasi Kode Saat Ini | Catatan & Aksi Lanjutan |
|---|---|---|---|
| **Science (Sains)** | Biologi & fisiologi pasca panen: degradasi klorofil/likopen, kadar air, susut bobot, infeksi jamur (*Colletotrichum capsici* / patek). | Parameter mutu masih diwakili 2 slider manual: `kesegaranPersen` dan `cacatPersen`. | ⚠️ Belum ada panduan visual ilmiah atau modul deteksi patologi pembusukan cabai/tomat. |
| **Technology (Teknologi)** | Model YOLO11 ONNX runtime, arsitektur REST API FastAPI, Supabase BaaS, Vercel & DigitalOcean Droplet. | Frontend React + Vite + MUI + localStorage. | ⚠️ Fondasi UI sangat baik, namun tumpukan teknologi AI & Cloud belum dikonstruksi. |
| **Engineering (Rekayasa)** | Pipeline lengkap: Kamera input → Ekstraksi fitur citra → Inferensi cepat <500ms → Pemetaan grade → Kalkulasi harga real-time. | Pipeline kalkulasi input manual berjalan mulus dari Form → Validasi → Dialog Konfirmasi → Penyimpanan → Ekspor CSV. | ⚠️ Perlu merekayasa integrasi modul kamera dan koneksi ke endpoint inferensi. |
| **Arts (Seni & Estetika)** | UI/UX ramah pengguna, human-centered design di Figma, skema warna alami bumi (*earthy green* `#036e45`). | Tema visual hijau daun & tanah terintegrasi sangat baik pada [`src/theme.js`](src/theme.js), komponen MUI responsif, ikon representatif. | ✅ **SANGAT BAIK.** Tampilan bersih, kontras warna tajam, dan mudah dipahami petani. |
| **Mathematics (Matematika)** | Rumus distribusi grade, konversi bobot ke Rupiah, deviasi harga pasar BAPANAS, HPP, BEP, dan rasio food loss. | Teruji lengkap di [`src/business/harvestCalculation.js`](src/business/harvestCalculation.js) dan [`harvestProjection.js`](src/business/harvestProjection.js). Formula Grade A, B, Reject terbukti presisi. | ✅ **SANGAT BAIK.** (Perlu memperbaiki bug `Number.EPSILON` pada B1). |

---

## E. Inventarisasi Fitur & Komponen Saat Ini

| Komponen / Modul | File Path | Fungsi Utama | Status |
|---|---|---|---|
| Shell Navigasi | [`src/components/AppShell.jsx`](src/components/AppShell.jsx) | Drawer menu navigasi samping, AppBar, status responsive mobile 360px | ✅ Berfungsi |
| Header Halaman | [`src/components/PageHeader.jsx`](src/components/PageHeader.jsx) | Judul dan breadcrumb sub-aplikasi | ✅ Berfungsi |
| Batch QC Scanner & Form Panen | [`src/components/HarvestForm.jsx`](src/components/HarvestForm.jsx) | Pengambilan foto keranjang (kamera HP/upload berkas/drag-drop), pratinjau citra, form komoditas, bobot, mutu, dan dialog konfirmasi | ✅ Berfungsi |
| Backend FastAPI Server | [`server/main.py`](server/main.py) | Entry point API Gateway, healthcheck (`/api/v1/health`), CORS middleware, dan error handling terstandarisasi | ✅ Berfungsi (Task FS-BE-01) |
| Modul Keamanan Upload Citra | [`server/utils/security.py`](server/utils/security.py) | Deteksi Magic Bytes (JPEG/PNG/WebP), batas ukuran 10 MB, anti-decompression bomb (4096 px), dan sanitasi path | ✅ Berfungsi (Task FS-BE-02) |
| Router QC & Scanner API | [`server/routers/qc.py`](server/routers/qc.py) | Endpoint `POST /api/v1/qc/scan` dengan validasi payload multipart dan penanganan error terstandarisasi | ✅ Berfungsi (Task FS-BE-02 & FS-BE-03) |
| Mock Inference Engine | [`server/services/mock_engine.py`](server/services/mock_engine.py) | Engine deteksi deterministik tomat (segar & busuk), filtering confidence threshold, dan perhitungan rasio kondisi | ✅ Berfungsi (Task FS-BE-03) |
| Tampilan Hasil QC | [`src/components/QCResults.jsx`](src/components/QCResults.jsx) | Visualisasi kartu distribusi Grade A/B/Reject, estimasi berat & nilai | ✅ Berfungsi |
| Rekap Panen & Filter | [`src/components/HarvestRecap.jsx`](src/components/HarvestRecap.jsx) | Tabel riwayat panen, paginasi, pencarian, filter tanggal, baris total | ✅ Berfungsi |
| Dashboard Harga | [`src/components/PricingDashboard.jsx`](src/components/PricingDashboard.jsx) | Proyeksi pendapatan petani berdasarkan variasi mutu & volume | ✅ Berfungsi |
| Grafik Tren Harga | [`src/components/PriceTrendChart.jsx`](src/components/PriceTrendChart.jsx) | Grafik garis tren harga komoditas via `@mui/x-charts` | ✅ Berfungsi (Data simulasi) |
| Kalkulasi Panen | [`src/business/harvestCalculation.js`](src/business/harvestCalculation.js) | Logika pembagian grade, bobot, dan nominal Rupiah | ✅ Berfungsi (Bug floating-point teratasi) |
| Validasi Form | [`src/business/harvestValidation.js`](src/business/harvestValidation.js) | Pemeriksaan batas bobot (max 10.000 kg), koma desimal, batas tanggal | ✅ Berfungsi |
| Filter & Urutan | [`src/business/harvestFilter.js`](src/business/harvestFilter.js) | Penyaringan kata kunci, komoditas, tanggal, dan pengurutan terbaru | ✅ Berfungsi (Filter tanggal kosong teratasi) |
| Utilitas Ekspor CSV | [`src/utils/csvExporter.js`](src/utils/csvExporter.js) | Konversi data batch panen ke file CSV sesuai standar RFC 4180 + BOM UTF-8 | ✅ Berfungsi |
| AI Inference Service | *Belum ada* | Menerima gambar keranjang dan mengekstrak proporsi grade | ❌ Belum dibuat |
| BAPANAS Scraper/API | *Belum ada* | Mengambil live feed harga pangan harian BAPANAS | ❌ Belum dibuat |

---

## F. Yang Sudah Bagus (Pertahankan & Jangan Diubah)

1. **Arsitektur Pemisahan Logika (Pure Business Logic):**
   Seluruh kalkulasi di folder `src/business/` berupa fungsi murni (*pure functions*) yang terbebas dari siklus hidup React. Ini adalah praktik *clean code* kelas profesional yang memungkinkan pengujian unit super cepat tanpa mock peramban.
2. **Kemandirian Pengujian (Zero External Test Dependencies):**
   Pemilihan `node --test` sebagai penguji utama adalah keputusan arsitektur yang sangat elegan. Pengujian dapat dieksekusi di lingkungan CI/CD mana pun dalam waktu kurang dari 400 ms tanpa perlu menginstall Jest yang berat.
3. **Kepatuhan Format Ekspor CSV (RFC 4180):**
   Implementasi `escapeCsvValue` di `src/utils/csvExporter.js` menangani karakter sensitif (tanda kutip ganda, koma, baris baru `\r\n`) dan menyematkan *Byte Order Mark* (`\uFEFF`) sehingga file CSV terbuka sempurna di Microsoft Excel Indonesia tanpa huruf yang berantakan.
4. **Desain UI/UX & Kerapian Tema:**
   Palet warna hijau alami (`#036e45`) dengan aksen emerald (`#0b8a5a`) dan tipografi Inter memberikan kesan profesional dan modern, sangat cocok untuk tema agritech yang dinilai oleh dewan juri STEAMPreneur.

---

## G. Checklist Penyelesaian & Rekomendasi Bertahap

### Prioritas P0 (Fondasi & Kestabilan Kode — SELESAI 4 NOV 2026)
- [x] **Perbaiki toleransi floating-point di [`src/business/harvestCalculation.js:53`](src/business/harvestCalculation.js#L53):** Diubah dari `Number.EPSILON` menjadi `1e-9`.
- [x] **Perbaiki logika pencocokan tanggal kosong di [`src/business/harvestFilter.js:38`](src/business/harvestFilter.js#L38):** Tanggal kosong ditolak saat filter tanggal aktif.
- [x] **Kunci versi dependensi di `package.json`:** Semua dependensi menggunakan versi semantik pasti (`^19.3.0`, `^9.5.0`, `^8.3.4`).
- [x] **Sinkronisasi komoditas nasional proposal BPS:** Menambahkan `Cabai Merah Keriting` dan `Cabai Rawit Merah` ke dalam `priceReference.js` dan `harvestValidation.js`.
- [x] **Tambahkan unit test verifikasi:** 3 unit test baru ditambahkan di folder `tes/` (total 60 tests, 100% pass).

### Prioritas P1 (Penyelarasan Janji Proposal Menuju Prototype Lomba Nasional)
- [x] **Modul Upload/Kamera Keranjang Panen:** Tambahkan komponen input foto keranjang di tab QC Scanner (bisa upload file atau ambil foto langsung lewat kamera HP) — **Selesai (4 Nov 2026)**.
- [x] **Inisialisasi Backend FastAPI & Healthcheck (Task FS-BE-01):** Struktur `server/main.py` dan `server/requirements.txt` selesai dibuat dengan CORS dan exception handler terstandarisasi — **Selesai (5 Nov 2026)**.
- [x] **Validasi & Keamanan Upload Citra (Task FS-BE-02):** Validasi *magic bytes* (JPEG, PNG, WebP), batas ukuran 10 MB, anti-decompression bomb (4096 px), dan sanitasi nama file di `server/utils/security.py` & `server/routers/qc.py` — **Selesai (5 Nov 2026)**.
- [x] **Mock Inference Engine Deterministik (Task FS-BE-03):** Engine mock di `server/services/mock_engine.py` dan integrasi endpoint `POST /api/v1/qc/scan` aktif sesuai kontrak output JSON baku (5 Nov 2026).
- [x] **Modul Smart Pricing & Metadata Harga Lengkap (Task FS-BE-04):** Modul `server/services/pricing_service.py` dan router `server/routers/pricing.py` selesai dibuat dengan metadata transparansi harga, STEAM Math kalkulator nilai ekonomi panen, dan pencegahan bug NaN/Inf — **Selesai (5 Nov 2026)**.
- [x] **Lapisan Penyimpanan Riwayat Transaksi (Task FS-BE-05):** Modul `server/services/storage_service.py` dan router `server/routers/history.py` selesai dibuat dengan persistensi lokal aman file-lock atomik, pagination & filter, ketahanan terhadap korupsi data JSON, serta DDL skema Supabase/PostgreSQL (5 Nov 2026).
- [x] **Dukungan Model AI Terung 4-Kelas Kualitas (Revisi 7 Nov 2026):** Modul `server/services/mock_engine.py` dan `server/routers/qc.py` diperluas mendukung klasifikasi mutu Terung 4 kelas (`extra-class`, `class-1`, `class-2`, `reject`) sesuai standar komersial UNECE/SNI dengan STEAM Math multi-tier pricing dan mitigasi KeyError (7 Nov 2026).
- [x] **Reverse Proxy Vite & Client API Service (Task FS-FE-01):** Konfigurasi reverse proxy `/api` di `vite.config.js` dan service klien `src/services/scanService.js` aktif dengan proteksi timeout 15 detik, multipart upload, pre-flight check, dan penanganan error terstandarisasi (7 Nov 2026).
- [x] **Komponen Visualisasi Deteksi Citra Interaktif (Task FS-FE-02):** Komponen `src/components/ScanCanvasOverlay.jsx` dan modul helper `src/utils/canvasOverlayHelper.js` aktif melukis kotak pembatas (*bounding box*) responsif dengan penskalaan proporsional, switch anotasi, dan palet warna multi-kelas Tomat & Terung (7 Nov 2026).
- [x] **Modernisasi Halaman Hasil QC & Integrasi Alur Pemindaian (Task FS-FE-03):** Halaman `src/components/QCResults.jsx` dan tombol pemicu AI di `HarvestForm.jsx` aktif menyajikan visualisasi kanvas bounding box, diagram donat proporsi kondisi buah (`@mui/x-charts`), kartu STEAM Math smart pricing, serta tombol pratinjau sertifikat (7 Nov 2026).
- [x] **Fitur Cetak Sertifikat & Resi Resmi QC Panen Digital (Pilihan 1 - Demo Kepsek):** Komponen `src/components/QCPrintCertificate.jsx`, helper `src/utils/qcCertificateHelper.js`, modal pratinjau A4 di `src/components/QCResults.jsx`, serta isolasi stylesheet `@media print` di `src/index.css` aktif mencetak sertifikat resmi ber-kop SMKN 4 Payakumbuh, logo/badge STEAMPreneur 2026, tabel klasifikasi mutu, rekapitulasi nilai ekonomi Rupiah, mitigasi risiko afkir, dan kolom tanda tangan resmi Petani & Petugas QC (8 Nov 2026).
- [x] **Integrasi Riwayat Panen Multi-Class & Navigasi Rekap (Task FS-FE-04):** Komponen `src/components/HarvestRecap.jsx`, `AppShell.jsx`, dan `src/business/harvestFilter.js` aktif mendukung navigasi drawer langsung ke Rekap Data Panen, indikator lencana AI, visualisasi chip mutu multi-kelas (Terung 4-Class & Tomat AI), kalkulasi total nilai ekonomi gabungan, ekspor CSV akurat, serta aksi instan 'Buka QC & Cetak Sertifikat' (8 Nov 2026).
- [ ] **Integrasi API Harga BAPANAS:** Buat endpoint integrasi atau service scraper harga harian pangan nasional untuk wilayah Sumatera Barat / Payakumbuh dengan fallback ke cache lokal.

### Prioritas P2 (Penyempurnaan Skalabilitas & Presentasi Juri)
- [ ] Integrasi Supabase Auth & Cloud Database untuk menggantikan keterbatasan `localStorage`.
- [x] Fitur Cetak Bukti QC Digital (Export PDF / Resi QC Panen) — **Selesai & Diverifikasi (8 Nov 2026)**.
- [ ] Siapkan demonstrasi video berlatar keranjang panen nyata untuk pembuktian di hadapan dewan juri STEAMPreneur.

---

## H. Perintah Cek Cepat & Verifikasi Pengujian

Jalankan perintah-perintah berikut di terminal untuk memverifikasi kondisi sistem:

```bash
# 1. Jalankan unit test frontend JavaScript (89 tests, 100% PASS)
npm test

# 2. Jalankan unit test backend Python (41 tests, 100% PASS)
python3 -m unittest discover -s server/tests

# 3. Uji toleransi floating-point IEEE-754 (Sudah lulus/PASS)
node -e "import('./src/business/harvestCalculation.js').then(m => m.calculateGradeWeights(100, { gradeA: 70.1, gradeB: 20.1, reject: 9.8 })).then(() => console.log('PASS')).catch(e => console.error('FAIL:', e.message))"

# 4. Periksa status git dan riwayat commit
git status
git log -n 5 --oneline
```

