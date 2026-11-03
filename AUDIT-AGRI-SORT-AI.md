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
| Tanggal Review | 3 November 2026 |
| Versi Terakhir Dianalisis | commit `cffd294` |
| Status Audit | **Inventarisasi Kritis & Rencana Aksi Penyelarasan Menuju Lomba Nasional** |

---

## Ringkasan Eksekutif

Audit ini disusun secara independen dan obyektif untuk mengevaluasi kondisi kode saat ini (`steampreneur-agri-sort-ai`) terhadap janji inovasi pada **Proposal STEAMPreneur SMK Tingkat Nasional Tahun 2026** serta arahan penugasan mentor.

Saat ini repositori berada pada fase **Fondasi Antarmuka & Logika Kalkulasi Klien (Client-Side MVP)**. Sebagian besar fitur inti kalkulasi matematika, filter rekap panen, dan ekspor CSV telah diimplementasikan dengan sangat rapi dan memiliki 57 pengujian otomatis (`node --test`). Namun demikian, terdapat **gap substansial** antara janji proposal (Computer Vision YOLO11, Inferensi ONNX <500ms, Backend FastAPI, Supabase Cloud BaaS, dan Live API BAPANAS) dengan kondisi kode saat ini yang masih murni berjalan di browser dengan penyimpanan `localStorage`.

Selain kesenjangan arsitektur, audit ini berhasil mendeteksi **1 bug floating-point kritis** pada modul kalkulasi yang menyebabkan aplikasi *crash* seketika pada kombinasi desimal tertentu, serta beberapa kerentanan pada manajemen paket dependency.

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
| **A2** | **Kamera / Batch Scanner** | Pemindaian foto keranjang panen langsung via kamera smartphone/laptop pengguna. | Input murni berbasis form formulir teks dan angka. Belum ada tombol upload berkas gambar atau akses kamera web (`<input type="file" capture>` atau WebRTC). | ⚠️ **GAP UTAMA** |
| **A3** | **Integrasi Harga BAPANAS** | Mengambil data harga harian resmi secara otomatis via API Panel Harga Badan Pangan Nasional untuk wilayah lokal/provinsi. | Menggunakan tabel konstanta simulasi statis di [`src/business/priceReference.js:15-30`](src/business/priceReference.js#L15-L30). Komponen eksplisit menyatakan "Bukan data resmi BAPANAS". | ⚠️ **GAP UTAMA** |
| **A4** | **Backend & API Service** | Python (FastAPI) REST API yang di-deploy pada DigitalOcean CPU Droplet untuk menangani inferensi ONNX dan kalkulasi harga cerdas. | Belum ada folder/kode backend Python sama sekali. Seluruh aplikasi berupa Single Page Application (SPA) client-side. | ⚠️ **GAP ARSITEKTUR** |
| **A5** | **Basis Data & Cloud Storage** | Supabase Cloud BaaS (Database PostgreSQL, Otentikasi Pengguna, Row-Level Security / RLS, dan penyimpanan berkas gambar 30 hari). | Data disimpan di `localStorage` peramban dengan key `agrisort.panen.v1` ([`src/business/harvestStorage.js:1`](src/business/harvestStorage.js#L1)). Tanpa autentikasi, tanpa RLS, tanpa backup cloud. | ⚠️ **GAP ARSITEKTUR** |
| **A6** | **Penyelarasan Komoditas** | Cabai Besar (1.720.000 ton), Cabai Rawit (1.743.125 ton), dan Tomat (1.227.949 ton) sesuai data statistik BPS hortikultura nasional. | Terdaftar 3 komoditas: `'Cabai Rawit Hijau'`, `'Terung'`, `'Tomat'` ([`src/business/priceReference.js:23-25`](src/business/priceReference.js#L23-L25)). Cabai Besar/Merah belum ada; Terung tidak tercantum di proposal BPS. | ℹ️ **GAP PENYELARASAN DATA** |
| **A7** | **Framework Frontend** | Proposal Bagian 3.2 & 5.2 menuliskan Next.js & Tailwind CSS. | Menggunakan React 19.3 + Vite 8.3 + Material UI (MUI) v9.5 + Emotion. Sesuai kesepakatan arahan mentor (Stack Lock). | ✅ **DITERIMA** (Stack React + Vite + MUI sudah sangat solid dan performan). |

> **Catatan Kontekstual Mentor:** Sesuai penjelasan pengguna, kode saat ini baru mencakup instruksi tahap awal mentor (membangun pondasi logika kalkulasi lokal yang kokoh sebelum menghubungkannya ke model machine learning dan backend cloud). Oleh karena itu, gap ini bukan kegagalan, melainkan peta jalan pengembangan berikutnya.

---

## B. Bug Kritis & Logika Bisnis (Dengan `file:baris`)

### B1. [KRITIS] Bug Presisi Floating-Point `Number.EPSILON` Menyebabkan Crash

- **Lokasi Kode:** [`src/business/harvestCalculation.js:53`](src/business/harvestCalculation.js#L53)
  ```javascript
  if (values.some((value) => value < 0 || value > 100) || Math.abs(values.reduce((sum, value) => sum + value, 0) - 100) > Number.EPSILON) {
    throw new RangeError('Persentase grade harus berjumlah 100% dan berada pada rentang 0 sampai 100.')
  }
  ```
- **Gejala Masalah:**
  Fungsi `calculateGradeWeights` (dan turunannya seperti `calculateRevenueProjection`) akan melempar `RangeError` dan mematikan eksekusi ketika menerima kombinasi desimal yang secara matematika tepat berjumlah 100%, misalnya:
  - Grade A = `70.1%`, Grade B = `20.1%`, Reject = `9.8%`.
  - Penjumlahan IEEE-754: `70.1 + 20.1 + 9.8 = 99.99999999999999`.
  - Nilai selisih terhadap 100 adalah `1.4210854715202004e-14`.
  - Nilai konstanta `Number.EPSILON` dalam JavaScript adalah `2.220446049250313e-16`.
  - Karena `1.42e-14 > 2.22e-16`, pengecekan bernilai `true` dan melempar *crash* `RangeError`!
- **Dampak:**
  Pengguna yang menginput persentase dengan 1 desimal (sangat umum dalam hasil inferensi Computer Vision) akan mendapati aplikasi macet dan memunculkan error tak terduga. Terlebih lagi di [`src/business/harvestProjection.js:36`](src/business/harvestProjection.js#L36), developer lain telah menyadari masalah ini dan memakai toleransi `1e-9`, namun di baris 39 saat memanggil `calculateGradeWeights`, fungsi tetap *crash* karena validasi di `harvestCalculation.js` masih memakai `Number.EPSILON`.
- **Rekomendasi Perbaikan:**
  Ubah batas toleransi dari `Number.EPSILON` menjadi `1e-9` (atau `0.0001`):
  ```javascript
  const sumPercentages = values.reduce((sum, value) => sum + value, 0)
  if (values.some((value) => value < 0 || value > 100) || Math.abs(sumPercentages - 100) > 1e-9) {
    throw new RangeError('Persentase grade harus berjumlah 100% dan berada pada rentang 0 sampai 100.')
  }
  ```

---

### B2. [SEDANG] Pencocokan Tanggal pada Filter Rentang Tanggal Melewati Batch Tanpa Tanggal

- **Lokasi Kode:** [`src/business/harvestFilter.js:36-43`](src/business/harvestFilter.js#L36-L43)
  ```javascript
  function matchesDateRange(batch, from, to) {
    const date = String(batch?.tanggal ?? '')
    if (!date) return true
    const start = String(from ?? '').trim()
    const end = String(to ?? '').trim()
    if (start && date < start) return false
    if (end && date > end) return false
    return true
  }
  ```
- **Gejala Masalah:**
  Jika ada data batch panen yang kolom `tanggal`-nya kosong (atau corrupt), kondisi `if (!date) return true` akan selalu mengembalikan `true`. Akibatnya, saat pengguna memfilter rekap panen khusus bulan tertentu (misal: "1 Okt 2026 s/d 15 Okt 2026"), data tanpa tanggal tetap ikut tampil di dalam hasil filter.
- **Rekomendasi Perbaikan:**
  Jika filter `from` atau `to` sedang aktif dan data tidak memiliki `tanggal`, seharusnya dievaluasi sebagai `false` (tidak lolos saring):
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

### C1. Versi Dependensi Menggunakan Tag `"latest"` di `package.json`

- **Lokasi Kode:** [`package.json:13-24`](package.json#L13-L24)
  ```json
  "dependencies": {
    "@emotion/react": "latest",
    "@emotion/styled": "latest",
    "@mui/icons-material": "latest",
    "@mui/material": "latest",
    "@mui/x-charts": "^9.15.0",
    "react": "latest",
    "react-dom": "latest"
  },
  "devDependencies": {
    "@vitejs/plugin-react": "latest",
    "vite": "latest"
  }
  ```
- **Analisis Dampak:**
  Penggunaan tag `"latest"` pada `dependencies` merupakan *bad practice* dalam industri perangkat lunak. Ketika tim atau juri kloning repo di masa depan dan menjalankan `npm install`, npm akan menarik rilis major terbaru (misal React 20 atau MUI v10) yang sangat berisiko mematahkan kompatibilitas (*breaking changes*).
- **Rekomendasi Perbaikan:**
  Kunci (*pin*) nomor versi sesuai yang terpasang di `package-lock.json`:
  ```json
  "dependencies": {
    "@emotion/react": "^11.14.0",
    "@emotion/styled": "^11.14.0",
    "@mui/icons-material": "^9.5.0",
    "@mui/material": "^9.5.0",
    "@mui/x-charts": "^9.15.0",
    "react": "^19.3.0",
    "react-dom": "^19.3.0"
  },
  "devDependencies": {
    "@vitejs/plugin-react": "^4.3.4",
    "vite": "^8.3.0"
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
| Form Input Panen | [`src/components/HarvestForm.jsx`](src/components/HarvestForm.jsx) | Form pencatatan komoditas, bobot, mutu, dan dialog konfirmasi | ✅ Berfungsi |
| Tampilan Hasil QC | [`src/components/QCResults.jsx`](src/components/QCResults.jsx) | Visualisasi kartu distribusi Grade A/B/Reject, estimasi berat & nilai | ✅ Berfungsi |
| Rekap Panen & Filter | [`src/components/HarvestRecap.jsx`](src/components/HarvestRecap.jsx) | Tabel riwayat panen, paginasi, pencarian, filter tanggal, baris total | ✅ Berfungsi |
| Dashboard Harga | [`src/components/PricingDashboard.jsx`](src/components/PricingDashboard.jsx) | Proyeksi pendapatan petani berdasarkan variasi mutu & volume | ✅ Berfungsi |
| Grafik Tren Harga | [`src/components/PriceTrendChart.jsx`](src/components/PriceTrendChart.jsx) | Grafik garis tren harga komoditas via `@mui/x-charts` | ✅ Berfungsi (Data simulasi) |
| Kalkulasi Panen | [`src/business/harvestCalculation.js`](src/business/harvestCalculation.js) | Logika pembagian grade, bobot, dan nominal Rupiah | ⚠️ Ada bug floating-point (B1) |
| Validasi Form | [`src/business/harvestValidation.js`](src/business/harvestValidation.js) | Pemeriksaan batas bobot (max 10.000 kg), koma desimal, batas tanggal | ✅ Berfungsi |
| Filter & Urutan | [`src/business/harvestFilter.js`](src/business/harvestFilter.js) | Penyaringan kata kunci, komoditas, tanggal, dan pengurutan terbaru | ⚠️ Tanggal kosong lolos filter (B2) |
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

### Prioritas P0 (Harus Dibereskan Segera — Kestabilan Kode Saat Ini)
- [ ] Perbaiki toleransi floating-point di [`src/business/harvestCalculation.js:53`](src/business/harvestCalculation.js#L53) dari `Number.EPSILON` menjadi `1e-9`.
- [ ] Perbaiki logika pencocokan tanggal kosong di [`src/business/harvestFilter.js:38`](src/business/harvestFilter.js#L38).
- [ ] Kunci versi dependensi di `package.json` (hindari penggunaan tag `"latest"`).
- [ ] Tambahkan unit test khusus untuk kasus desimal `70.1 + 20.1 + 9.8` di `tes/kalkulasiPanen.test.js` untuk memastikan tidak ada regresi.

### Prioritas P1 (Penyelarasan Janji Proposal Menuju Prototype Lomba Nasional)
- [ ] **Modul Upload/Kamera Keranjang Panen:** Tambahkan komponen input foto keranjang di tab QC Scanner (bisa upload file atau ambil foto langsung lewat kamera HP).
- [ ] **Service Inferensi AI Sederhana (FastAPI / Mock AI Worker):**
  - Buat folder `backend/` dengan framework FastAPI atau Cloudflare Worker.
  - Sediakan endpoint `POST /api/predict-qc` yang menerima gambar dan mengembalikan persentase `gradeA`, `gradeB`, `reject`, dan bounding boxes.
- [ ] **Sinkronisasi Komoditas Proposal:** Tambahkan pilihan komoditas `Cabai Merah Keriting / Cabai Besar` agar selaras dengan data BPS di Proposal.
- [ ] **Integrasi API Harga BAPANAS:** Buat endpoint integrasi atau service scraper harga harian pangan nasional untuk wilayah Sumatera Barat / Payakumbuh dengan fallback ke cache lokal.

### Prioritas P2 (Penyempurnaan Skalabilitas & Presentasi Juri)
- [ ] Integrasi Supabase Auth & Cloud Database untuk menggantikan keterbatasan `localStorage`.
- [ ] Fitur Cetak Bukti QC Digital (Export PDF / Resi QC Panen).
- [ ] Siapkan demonstrasi video berlatar keranjang panen nyata untuk pembuktian di hadapan dewan juri STEAMPreneur.

---

## H. Perintah Cek Cepat & Verifikasi Pengujian

Jalankan perintah-perintah berikut di terminal untuk memverifikasi kondisi sistem:

```bash
# 1. Jalankan seluruh unit test logika bisnis (57 tests)
npm test

# 2. Uji keberadaan bug floating-point EPSILON
node -e "import('./src/business/harvestCalculation.js').then(m => m.calculateGradeWeights(100, { gradeA: 70.1, gradeB: 20.1, reject: 9.8 })).then(() => console.log('PASS')).catch(e => console.error('FAIL:', e.message))"

# 3. Periksa status git dan riwayat commit
git status
git log -n 5 --oneline
```

