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

### 3. Menjalankan Server Lokal

**Terminal 1 — Jalankan Backend FastAPI (Port 8000):**
```bash
python3 -m uvicorn server.main:app --host 127.0.0.1 --port 8000 --reload
```
*Dokumentasi Swagger API backend dapat diakses di `http://127.0.0.1:8000/docs`.*

**Terminal 2 — Jalankan Frontend React (Port 5173):**
```bash
npm run dev
```

Buka peramban di `http://localhost:5173`.

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
* **Faris Al Farizi** — Ketua Tim / Senior Fullstack Developer
* **Hieray Antovino** — Analis Bisnis & Dokumentator
* **Ahmad Afif** — Machine Learning Engineer & Quality Assurance

Lisensi: [MIT License](LICENSE).
