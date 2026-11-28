# Agri-Sort AI — Precision Agriculture & Smart Pricing

Aplikasi Computer Vision Quality Control (QC) dan Smart Pricing komoditas hortikultura untuk petani, pedagang pengumpul, dan pengelola pasar di Payakumbuh dan Sumatera Barat.

Agri-Sort AI menggabungkan model **Deep Learning YOLO11** dengan antarmuka modern **React 19** dan backend berkinerja tinggi **FastAPI**, membantu memilah mutu buah panen secara otomatis, memvisualisasikan sebaran grade komersial, menghitung estimasi nilai ekonomi, dan menerbitkan Sertifikat Mutu Digital standar cetak A4.

---

## 🌟 Fitur Utama Sistem

1. **Batch QC Scanner Cerdas (Live Camera & File Upload):**
   - **Live Viewfinder Kamera:** Mengakses sensor webcam laptop atau kamera smartphone secara real-time dengan sudut pandang tegak lurus (*top-down view*), fitur ganti kamera depan/belakang, dan pengambilan snapshot sekali klik.
   - **Drag & Drop Berkas:** Mendukung unggah berkas citra `JPG`, `PNG`, dan `WebP` (hingga 10 MB) dengan deteksi instan.
   - **Seleksi Komoditas Multi-Model:**
     - 🍆 **Terung (Eggplant):** Model YOLO11n dengan **4 kelas mutu komersial** (`Extra Class`, `Class I`, `Class II`, `Reject`).
     - 🍅 **Tomat (Tomato):** Model YOLO11n dengan **2 kelas mutu** (`Tomat Segar`, `Tomat Busuk/Cacat`).
     - 🌶️ **Cabai Rawit Hijau:** Mode pencatatan mutu lapangan manual.
   - **Slider Sensitivitas Deteksi:** Pengaturan batas keyakinan (*confidence threshold*) dari 5% hingga 80% (rekomendasi: 20% untuk Terung, 35% untuk Tomat).

2. **Hasil Analisis Mutu Instan (Instant QC Results):**
   - Hasil deteksi langsung muncul di layar tanpa memaksa pengguna mengisi formulir panen panjang terlebih dahulu.
   - **Lapisan Kanvas Visual Interaktif (`ScanCanvasOverlay`):** Bounding box berwarna per kelas mutu (Emerald untuk Extra Class, Sky Blue untuk Class I, Amber untuk Class II, Ruby Red untuk Reject), sudut bracket modern, dan toggle anotasi on/off.
   - **Indikator Distribusi Mutu:** Donut Chart (`@mui/x-charts`) dan kartu statistik butir serta persentase mutu panen.
   - **Estimasi Smart Pricing:** Rekomendasi harga jual per kg dan total nilai panen berdasarkan formula acuan pasar komoditas.

3. **Sertifikat Mutu QC Resmi (Format Cetak A4):**
   - Penerbitan Sertifikat Mutu Digital berstandar dokumen resmi A4 lengkap dengan ID registrasi, tabel rincian butir terdeteksi, ringkasan grade komersial (Grade A, Grade B, Reject), dan tanda tangan digital.
   - Tombol satu-klik untuk mencetak langsung ke printer atau mengunduh sebagai PDF resmi transaksi.

4. **Rekap Data Panen & Manajemen Inventaris:**
   - Riwayat seluruh batch panen yang tersimpan di penyimpanan lokal browser (`localStorage`).
   - Pencarian real-time (berdasarkan ID Batch atau Komoditas) dan filter rentang tanggal.
   - Ekspor laporan ke format **CSV** murni (ramah Microsoft Excel).

---

## 🛠️ Tech Stack & Arsitektur

| Lapisan | Komponen / Teknologi | Versi | Peran & Tanggung Jawab |
|---|---|---|---|
| **Frontend** | React 19, Vite 8 | 19.3 / 8.3 | SPA Interaktif, Client-Side State, Routing |
| **UI Library** | Material UI (MUI), Emotion | 9.5 / 11.14 | Desain komponen responsif mobile & desktop |
| **Visualisasi** | MUI X Charts (`@mui/x-charts`) | 9.15 | Diagram Donut sebaran mutu panen |
| **Backend API** | FastAPI, Uvicorn | 0.162 / 0.54 | REST API Gateway, validasi keamanan citra |
| **AI / ML Engine** | Ultralytics YOLO11n, PyTorch CPU | 8.4.205 / 2.15 | Inferensi deteksi objek buah (<500 ms) |
| **Penyimpanan** | Browser `localStorage` (`agrisort.panen.v1`) | — | Persistensi data batch panen lokal |
| **Testing** | Node.js Test Runner & Python Unittest | — | 89 test frontend + 51 test backend |

---

## 🚀 Panduan Menjalankan Aplikasi

### 1. Prasyarat Sistem
* **Node.js:** Versi $\ge 18.0$ (disarankan versi LTS)
* **Python:** Versi $\ge 3.10$ (didukung hingga Python 3.14)
* **Git** dan peramban modern (Google Chrome, Microsoft Edge, atau Mozilla Firefox)

### 2. Instalasi Dependensi

**Terminal 1 — Dependensi Frontend:**
```bash
git clone https://github.com/rizitakanashi-dev/steampreneur-agri-sort-ai.git
cd steampreneur-agri-sort-ai
npm install
```

**Terminal 2 — Dependensi Backend Python:**
```bash
# Pasang PyTorch CPU-only dan Ultralytics (hemat penyimpanan):
python3 -m pip install --break-system-packages torch torchvision --index-url https://download.pytorch.org/whl/cpu
python3 -m pip install --break-system-packages -r server/requirements.txt
```

### 3. Konfigurasi Supabase Auth

Backend memakai provider Auth yang dipilih secara eksplisit per startup: Supabase Auth untuk deployment dan Local Auth hanya untuk development lokal. Jika memilih Supabase, buat project Supabase lalu di **Authentication → Providers**:

1. Aktifkan Email dan konfirmasi email; atur template email OTP agar menampilkan `{{ .Token }}`. Tetapkan rate limits OTP yang sesuai di Auth settings (Supabase juga menegakkan rate limit provider); aktifkan CAPTCHA untuk permukaan publik bila diperlukan.
2. Jika ingin login Google, aktifkan provider Google dan konfigurasikan OAuth Client ID/Secret serta redirect URL sesuai Supabase.
3. Untuk development lokal dengan Local Auth, salin `.env.example` menjadi `.env`, biarkan `APP_ENV=development` dan `AUTH_MODE=local`. Local Auth hanya tersedia pada proses development lokal dan memakai state file lokal; jangan gunakan untuk Preview, Staging, atau Production.
4. Untuk Supabase Auth lokal, gunakan `APP_ENV=development`, ubah `AUTH_MODE=supabase`, dan isi `SUPABASE_URL` serta `SUPABASE_ANON_KEY`.
5. Jalankan DDL di `/api/v1/qc/schema` pada Supabase SQL Editor untuk membuat tabel scan dengan RLS per pengguna.
6. Untuk setiap environment deployment, set secara eksplisit `APP_ENV` dan `AUTH_MODE=supabase` di environment backend Vercel serta isi `SUPABASE_URL` dan `SUPABASE_ANON_KEY`. Production harus cocok dengan `VERCEL_ENV=production`; Preview dengan `VERCEL_ENV=preview`; Staging yang berjalan sebagai Vercel Preview memakai `APP_ENV=staging` dan `VERCEL_ENV=preview`. Gunakan project Supabase yang disetujui terpisah untuk Preview/Staging bila operator menetapkannya. Tidak ada fallback otomatis ke Local Auth saat kredensial tidak lengkap atau Supabase tidak tersedia; konfigurasi tidak valid menggagalkan startup, dan gangguan provider dilaporkan sebagai layanan tidak tersedia.
7. `SUPABASE_ANON_KEY` bukan service-role key. Jangan masukkan service-role key ke konfigurasi Auth. `VITE_GOOGLE_CLIENT_ID` opsional untuk Google Sign-In dan bukan rahasia.
8. Untuk ekspor dan penghapusan akun mandiri, terapkan migrasi RBAC dan forward migration di `supabase/migrations/`, lalu set `SUPABASE_SERVICE_ROLE_KEY`, `SUPABASE_EXPORT_BUCKET`, dan `EXPORT_HMAC_KEY` hanya pada proses backend. Service-role key tidak boleh dikirim ke browser atau dipakai untuk membaca isi scan; pembacaan scan tetap memakai token pengguna dan RLS.

`APP_ENV` menerima `development`, `preview`, `staging`, atau `production`; `AUTH_MODE` menerima `local` atau `supabase`. Tanpa keduanya, backend gagal tertutup dan endpoint Auth tidak dialihkan ke provider lain. Token Local Auth lama tidak diterima dalam mode Supabase; inventory akun Local Auth deployment belum dipastikan, jadi lakukan rekonsiliasi akun dan minta pengguna login/daftar ulang melalui jalur yang disetujui sebelum rollout.

### 4. Backend Environment (Vercel)

Untuk deployment di Vercel (Production dan Preview), seluruh variabel lingkungan berikut wajib dipasang pada dashboard Vercel (**Settings → Environment Variables**) atau melalui Vercel CLI (`vercel env add`):

| Variabel | Lingkungan | Tipe | Keterangan |
|---|---|---|---|
| `APP_ENV` | Production: `production`<br>Preview: `preview` | Secret / Config | Wajib cocok persis dengan `VERCEL_ENV` (`production` di deploy production, `preview` di Preview). Backend menolak inisialisasi saat cold start bila tidak cocok. |
| `AUTH_MODE` | Production, Preview: `supabase` | Secret / Config | Mode autentikasi di serverless. `AUTH_MODE=local` ditolak keras di luar local development. |
| `SUPABASE_URL` | Production, Preview | Secret | URL HTTPS project Supabase (`https://<project-ref>.supabase.co`). |
| `SUPABASE_ANON_KEY` | Production, Preview | Secret | Public/Anon API key dari Supabase. **Bukan** `service_role` key (backend memvalidasi dan menolak service-role key di variabel ini). |
| `SUPABASE_SERVICE_ROLE_KEY` | Production, Preview | Secret | Kunci `service_role` dari Supabase (**Project Settings → API**). Server-only untuk workflow ekspor & penghapusan akun mandiri; jangan pernah kirim ke frontend. |
| `EXPORT_HMAC_KEY` | Production, Preview | Secret | Kunci HMAC SHA-256 untuk memverifikasi integritas snapshot ekspor data (minimal 32 byte, di-generate via `openssl rand -hex 32`). |
| `SUPABASE_EXPORT_BUCKET` | Production, Preview | Secret / Config | Bucket Supabase Storage untuk menampung arsip ekspor data akun (default: `account-exports`). |
| `VITE_GOOGLE_CLIENT_ID` | Production, Preview | Config | Google OAuth 2.0 Client ID resmi untuk Google Sign-In. |

### 5. Menjalankan Server Lokal

**Terminal 1 — Jalankan Backend FastAPI (Port 8000):**
```bash
python3 -m uvicorn server.main:app --host 127.0.0.1 --port 8000 --reload
```
*Dokumentasi Swagger API backend dapat diakses di `http://127.0.0.1:8000/docs`.*

**Terminal 2 — Jalankan Frontend React (Port 5173):**
```bash
npm run dev
```

Buka peramban di `http://localhost:5173`. Auth tidak dapat dipakai sampai `SUPABASE_URL` dan `SUPABASE_ANON_KEY` valid dikonfigurasi.

---

## 🧪 Eksekusi Pengujian Otomatis (*Test Suite*)

Seluruh logika bisnis, keamanan citra, dan kalkulasi diuji secara ketat:

### Pengujian Frontend (89 Unit Tests Passing)
```bash
npm test
```
*Mencakup penskalaan koordinat canvas, tema warna 4-kelas, pembulatan mata uang, validasi input, ekspor CSV, filter rekap panen, dan helper sertifikat mutu.*

### Pengujian Backend (51 Unit Tests Passing)
```bash
python3 -m unittest discover -s server/tests
```
*Mencakup validasi magic bytes citra, proteksi decompression bomb, AI inference engine, simulasi mock deterministik, dan formula smart pricing multi-tier.*

---

## 📁 Struktur Direktori Proyek

```
steampreneur-agri-sort-ai/
├── server/                              # Backend FastAPI & AI Engine
│   ├── main.py                          # Inisialisasi FastAPI & middleware CORS
│   ├── requirements.txt                 # Dependensi Python
│   ├── routers/                         # Endpoint API (QC, History, Pricing)
│   ├── services/                        # Service AI Engine, Storage, & Pricing
│   │   ├── ai_engine.py                 # Singleton Ultralytics YOLO11 Loader & Predictor
│   │   └── pricing_service.py           # Formula Smart Pricing & Grading Rule Engine
│   ├── utils/security.py                # Validasi Magic Bytes & Keamanan Berkas
│   └── tests/                           # 51 Backend Unit Tests
├── models-20261107T170211Z-1-001/       # Artefak Model YOLO11 Terung
│   └── models/terung/
│       ├── best.pt                      # Bobot PyTorch Terung 4-Class (5.49 MB)
│       ├── best.onnx                    # Bobot ONNX Opset 18 (10.67 MB)
│       ├── data.yaml                    # Konfigurasi Roboflow (Class I, II, Extra, Reject)
│       └── model-metadata.json          # Metadata & evaluasi mAP model
├── model-export/                        # Artefak Model YOLO11 Tomat 2-Class Legacy
│   └── weights/best.pt                  # Bobot Tomat Segar & Busuk
├── src/                                 # Frontend React 19
│   ├── components/
│   │   ├── BatchQCScanner.jsx           # Scanner Utama (Live Camera + File Upload + Direct Results)
│   │   ├── LiveCameraViewfinder.jsx     # Viewfinder Kamera Realtime (Webcam / HP)
│   │   ├── ScanCanvasOverlay.jsx        # Lapisan Kanvas Bounding Box Interaktif
│   │   ├── QCResults.jsx                # Dasbor Hasil Pemeriksaan Mutu & Donut Chart
│   │   ├── QCPrintCertificate.jsx       # Template Cetak Sertifikat Mutu Format A4
│   │   ├── HarvestRecap.jsx             # Tabel Rekap Panen & Ekspor CSV
│   │   └── PricingDashboard.jsx         # Tren Harga Acuan Pasar & Kalkulator Pendapatan
│   ├── business/                        # Domain Logika Bisnis & Validasi Klien
│   ├── utils/                           # Helper Kanvas, Sertifikat, & CSV
│   └── services/scanService.js          # API Client Penghubung ke Backend
├── tes/                                 # 89 Frontend Unit Tests
└── docs/                                # Dokumentasi Teknis, Workflow, & Panduan Lapangan
```

---

## 👥 Informasi Pengembang

Karya siswa **SMKN 4 Payakumbuh** — Bidang Lomba *STEAMPreneur* Tingkat Nasional 2026:
* **Faris Al Farizi** — Ketua & Machine Learning Engineer
* **Hieray Antovino** — Fullstack Engineer & Quality Assurance
* **Ahmad Afif** — Analis Bisnis & Dokumentator

Lisensi: [MIT License](LICENSE).

## Deploy lewat Coolify

Repo menyediakan `compose.yaml` untuk menjalankan frontend Nginx dan backend FastAPI sebagai satu aplikasi Compose. Di Coolify, pilih build pack **Docker Compose**, gunakan file `compose.yaml`, lalu arahkan domain publik ke service `web` pada port internal `80`. Service `api` hanya diakses melalui jaringan internal Compose; Nginx meneruskan rute `/api/` ke backend.

Tambahkan variabel berikut di environment produksi Coolify, jangan masukkan nilainya ke Git:

- `SUPABASE_URL` dan `SUPABASE_ANON_KEY` — project Supabase produksi.
- `SUPABASE_SERVICE_ROLE_KEY` — hanya untuk backend; jangan pernah gunakan sebagai `VITE_*`.
- `EXPORT_HMAC_KEY` — nilai acak minimal 32 byte, misalnya dibuat dengan `openssl rand -hex 32`.
- `SUPABASE_EXPORT_BUCKET` — opsional, default `account-exports`; bucket harus sudah disiapkan di Supabase.
- `VITE_GOOGLE_CLIENT_ID` — opsional, hanya bila Google sign-in telah dikonfigurasi.

Compose mengunci `APP_ENV=production` dan `AUTH_MODE=supabase`, memerlukan secrets Supabase/HMAC saat deployment, mengaktifkan healthcheck, dan menyimpan file runtime backend pada volume Docker. Riwayat scan memakai Supabase; volume ini bukan pengganti backup database. Terapkan serta verifikasi migrasi dan RLS Supabase sebelum menerima data nyata. Model QC saat ini berstatus candidate dan inferensi produksi ditolak sampai model tervalidasi.
