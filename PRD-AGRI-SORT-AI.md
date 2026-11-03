# Product Requirements Document (PRD) — Agri-Sort AI

**Dokumen Spesifikasi Produk & Status Pengembangan — STEAMPreneur SMK 2026**

| Metadata | Keterangan |
|---|---|
| Nama Produk | **Agri-Sort AI** |
| Subjudul Resmi | *Web App Quality Control & Smart Pricing Berbasis Computer Vision untuk Pengepul dan Petani Hortikultura* |
| Institusi | SMKN 4 Payakumbuh — Kompetensi Keahlian Rekayasa Perangkat Lunak (RPL) |
| Tim Pengembang | Faris Al Farizi (Project Lead & ML), Hieray Antovino (Full-Stack Frontend), Ahmad Afif (QA & Documentation) |
| Guru Pendamping | Rogi Auvi, S.Pd |
| Repositori GitHub | [`https://github.com/rizitakanashi-dev/steampreneur-agri-sort-ai`](https://github.com/rizitakanashi-dev/steampreneur-agri-sort-ai) |
| Dokumen Acuan | `Proposal STEAMPreneur SMK Tahun 2026.docx.pdf` & `AUDIT-AGRI-SORT-AI.md` |
| Terakhir Diperbarui | 3 November 2026 |
| Status Proyek | **Fase Transisi dari Client-Side MVP ke Arsitektur Lengkap (AI + Cloud + BAPANAS)** |

---

## 1. Latar Belakang & Visi Produk

### 1.1 Masalah Riil Sektor Hortikultura
Komoditas hortikultura strategis Indonesia (khususnya Cabai Besar, Cabai Rawit, dan Tomat) memiliki volume produksi nasional yang masif (masing-masing lebih dari 1,2–1,7 juta ton per tahun menurut data BPS). Namun, komoditas ini memiliki karakteristik mudah rusak (*highly perishable*).

Di sentra-sentra produksi hortikultura seperti Payakumbuh dan wilayah sekitarnya di Indonesia, proses Kontrol Kualitas (QC) masih dilakukan secara **manual**:
1. **Boros Waktu & Tenaga:** Memilah 100 kg hasil panen membutuhkan waktu **2 hingga 4 jam**. Penumpukan hasil panen di gudang pengumpul menyebabkan kerusakan fisik pasca-panen (*food loss*) mencapai **15% hingga 25%**.
2. **Subjektivitas Tinggi:** Pemilahan manual bergantung pada penilaian mata pengepul yang berubah-ubah. Tidak ada parameter objektif yang tertulis.
3. **Ketimpangan Informasi & Posisi Tawar Petani Rendah:** Petani tidak memiliki bukti kualitas resmi, sehingga sering terpaksa menerima potongan harga drastis saat proses tawar-menawar.
4. **Solusi Eksisting Terlalu Mahal:** Mesin konveyor pemilah industri otomatis membutuhkan investasi fisik puluhan hingga ratusan juta rupiah yang mustahil dijangkau petani kecil atau Gapoktan.

### 1.2 Visi & Proposisi Nilai (Value Proposition)
**Agri-Sort AI** hadir sebagai solusi berbasis perangkat lunak murni (*software-only web app*). Pengguna cukup menggunakan smartphone atau laptop berkamera tanpa perlu membeli mesin mahal.

Dengan memanfaatkan **Computer Vision (YOLO11)** yang dioptimasi ke format **ONNX/OpenVINO** untuk inferensi CPU berbiaya rendah (< 500 ms per foto keranjang), serta integrasi **Panel Harga Harian BAPANAS**, Agri-Sort AI:
- Mempercepat proses QC hingga **>98%** (dari 2-4 jam menjadi beberapa detik).
- Menekan susut panen (*food loss*) hingga di bawah **5%** melalui deteksi dini pembusukan.
- Menghadirkan **transparansi dan keadilan harga** bagi petani dan pengepul.

---

## 2. Aktor & User Persona

| Peran (Role) | Karakteristik & Perangkat | Kebutuhan Utama |
|---|---|---|
| **Petani Hortikultura** | Petani cabai & tomat di kebun/lahan, menggunakan smartphone Android menengah ke bawah. | Mengetahui perkiraan kualitas (Grade A, B, Tolak) dan taksiran nilai jual panen sebelum dibawa ke pengepul agar tidak dirugikan saat tawar-menawar. |
| **Pedagang Pengumpul (Toke / Pengepul)** | Pemilik gudang sortir di tingkat kecamatan, menggunakan smartphone atau laptop. | Memindai puluhan keranjang panen secara serempak, mendapatkan angka persentase mutu objektif, dan mencatat nota transaksi secara cepat. |
| **Kelompok Tani (Gapoktan) / Koperasi** | Pengurus koperasi pertanian desa, menggunakan PC/laptop. | Memantau rekapitulasi volume panen seluruh anggota, memproyeksikan pendapatan, dan memantau fluktuasi harga pasar harian. |
| **Pedagang Grosir / Pasar Induk** | Pembeli skala besar di pasar kota. | Memastikan standar pasokan bebas dari buah busuk/jamur sebelum dikirim antarkota. |

---

## 3. Kondisi Sistem Saat Ini

### 3.1 Fitur yang Sudah Selesai & Berfungsi di Kode Saat Ini
- **Fondasi Antarmuka Web Responsif (React 19 + MUI v9.5):** Tampilan dasbor, form input, kartu metrik, dan tabel rekapitulasi yang ramah layar smartphone (lebar 360 px) dengan palet warna hijau alami bumi.
- **Logika Kalkulasi Matematika Murni (`src/business/harvestCalculation.js`):** Perhitungan distribusi Grade A, Grade B, dan Tolak (Reject) serta konversi ke berat (kg) dan nilai Rupiah berdasarkan harga acuan.
- **Validasi Formulir Bertingkat (`src/business/harvestValidation.js`):** Menolak input di luar batas (bobot > 10.000 kg, nilai negatif, koma desimal, tanggal melebihi hari ini).
- **Rekapitulasi Riwayat Panen & Pencarian Multi-Kriteria (`src/business/harvestFilter.js`):** Pencarian teks, filter komoditas, filter rentang tanggal, paginasi, dan baris total kalkulasi.
- **Ekspor Data CSV Sesuai Standar RFC 4180 (`src/utils/csvExporter.js`):** Lengkap dengan escaping karakter sensitif dan BOM UTF-8 untuk kompatibilitas Microsoft Excel.
- **Dashboard Proyeksi Pendapatan (`src/components/PricingDashboard.jsx`):** Simulasi harga jual rata-rata tertimbang dan grafik tren harga komoditas via `@mui/x-charts`.
- **Rangkaian Pengujian Unit Otomatis (57 Tests):** Menjalankan `node --test` tanpa dependensi eksternal dengan waktu eksekusi < 400 ms.

### 3.2 Fitur yang Belum Ada & Menjadi Target Pengembangan (Sesuai Proposal)
- Inferensi AI Computer Vision (Model YOLO11 ONNX).
- Pengambilan foto langsung dari kamera keranjang panen (Batch Camera Scanner).
- Integrasi live feed API Panel Harga Harian BAPANAS.
- Backend REST API berbasis Python FastAPI.
- Cloud BaaS Supabase (Database PostgreSQL, Storage berkas gambar 30 hari, dan Supabase Auth dengan Row Level Security).
- Sinkronisasi komoditas utama sesuai data BPS nasional (Cabai Merah Keriting / Cabai Besar, Cabai Rawit, Tomat).

---

## 4. Kebutuhan Fungsional Berprioritas (Prioritized FR)

### 4.1 Prioritas P0 — Fondasi & Perbaikan Kritis (Sprint 1)
- **FR-01: Perbaikan Bug Floating-Point Kalkulasi:** Memperbaiki ambang toleransi perbandingan persentase pada `src/business/harvestCalculation.js` dari `Number.EPSILON` menjadi `1e-9` agar input desimal (contoh `70.1% + 20.1% + 9.8%`) tidak memicu error *crash*.
- **FR-02: Penguncian Versi Dependensi (Dependency Pinning):** Memperbarui `package.json` dari tag `"latest"` ke versi eksplisit semantik (`^19.3.0`, `^9.5.0`, dll) untuk menjamin stabilitas build.
- **FR-03: Penyelarasan Komoditas Nasional:** Menambahkan `Cabai Merah Keriting` dan `Cabai Rawit Merah` ke dalam daftar komoditas resmi sesuai data BPS di Proposal STEAMPreneur.

### 4.2 Prioritas P1 — Fitur Inti Proposal Lomba (Sprint 2)
- **FR-04: Batch Camera & Image Upload Scanner:**
  - Komponen antarmuka yang memungkinkan pengguna mengambil gambar langsung via kamera ponsel (`capture="environment"`) atau mengunggah berkas foto keranjang panen (JPG, PNG, WebP maksimal 5 MB).
  - Validasi kualitas gambar di sisi klien (deteksi blur dasar dan kompresi WebP otomatis < 200 KB sebelum dikirim ke API).
- **FR-05: Layanan Inferensi AI (FastAPI + YOLO11 ONNX Runtime):**
  - Endpoint `POST /api/predict-qc` menerima berkas gambar keranjang.
  - Model YOLO11 mendeteksi objek cabai/tomat individual dan mengklasifikasikan kelas: `Grade_A` (segar, merah cerah, tanpa cacat), `Grade_B` (matang sebagian, ada bercak ringan), dan `Reject` (busuk, patek/antraknosa, berlubang ulat).
  - API merespons dalam waktu **< 500 ms** dengan data bounding box, jumlah deteksi per kelas, dan persentase distribusi otomatis.
- **FR-06: Integrasi Smart Pricing dengan Panel Harga BAPANAS:**
  - Service backend mengambil data harga harian komoditas pangan dari portal BAPANAS (Badan Pangan Nasional) per tingkat kabupaten/kota atau provinsi (Sumatera Barat).
  - Mekanisme *caching* lokal 24 jam dengan *offline fallback* ke tabel acuan jika server BAPANAS tidak merespons.
  - Perhitungan rekomendasi harga beli yang wajar:
    $$\text{Harga Saran} = (\%A \times \text{Harga BAPANAS} \times 1.0) + (\%B \times \text{Harga BAPANAS} \times 0.7) + (\%Reject \times \text{Harga BAPANAS} \times 0.3)$$
- **FR-07: Tampilan Laporan Hasil QC Digital:**
  - Menampilkan visual foto keranjang dengan kotak deteksi AI (bounding boxes warna hijau untuk Grade A, kuning untuk Grade B, merah untuk Reject).
  - Menampilkan ringkasan rekomendasi tindakan (misal: "Layak kirim pasar induk", "Segera jual cepat", atau "Pisahkan 12% buah busuk agar tidak menular").

### 4.3 Prioritas P2 — Skalabilitas & Fitur Lanjutan (Sprint 3)
- **FR-08: Integrasi Cloud BaaS (Supabase Database & Auth):**
  - Autentikasi petani dan pengepul menggunakan Supabase Auth (Email / Nomor WhatsApp OTP).
  - Isolasi data transaksi menggunakan PostgreSQL Row Level Security (RLS: `auth.uid() = user_id`).
  - Unggah foto bukti QC ke Supabase Storage dengan kebijakan retensi 30 hari.
- **FR-09: Cetak Resi / Sertifikat QC Digital (PDF):**
  - Fitur mengunduh sertifikat bukti uji mutu panen dalam format PDF (mencakup tanggal panen, nama petani, rincian grade, total bobot, nilai kesepakatan, dan QR Code verifikasi).

---

## 5. Kebutuhan Non-Fungsional (NFR)

1. **Performa & Latensi:**
   - Inferensi citra model AI via ONNX Runtime di CPU Droplet DigitalOcean harus selesai dalam waktu **< 500 ms**.
   - Waktu muat awal halaman web (*First Contentful Paint*) **< 1,5 detik** pada koneksi 4G mobile.
2. **Ketersediaan & Offline Resilience:**
   - Sistem memiliki *offline-first fallback*: jika koneksi internet terputus di area kebun, aplikasi tetap dapat mencatat batch secara lokal menggunakan `localStorage` dan melakukan sinkronisasi saat internet kembali aktif.
3. **Kompatibilitas Perangkat:**
   - Antarmuka web responsif penuh dari layar smartphone paling ramping (**360 px**) hingga layar desktop monitor (**1920 px**).
4. **Keamanan & Integritas Data:**
   - Komunikasi data wajib menggunakan enkripsi TLS/HTTPS.
   - Tidak ada kredensial API atau token rahasia yang tertulis *hardcoded* di sisi klien (semua variabel lingkungan menggunakan `.env`).

---

## 6. Target Arsitektur Sistem

```
       +-------------------------------------------------------------+
       |                      PERANGKAT PENGGUNA                     |
       |         (Smartphone / Tablet / Laptop di Lapangan)          |
       +-------------------------------------------------------------+
                                     |
                                     | (1) Ambil Foto / Input Form
                                     v
       +-------------------------------------------------------------+
       |               FRONTEND WEB APP (Hosted on Vercel)           |
       |  - React 19 + Vite + Material UI (MUI v9)                   |
       |  - Validasi Klien & Kompresi WebP (<200 KB)                 |
       |  - State Management & Offline Cache (localStorage)          |
       +-------------------------------------------------------------+
                        |                             |
      (2) REST API Foto |                             | (4) Query Riwayat & Auth
      (Inference <500ms)|                             |     (HTTPS / RLS)
                        v                             v
+-------------------------------+             +-------------------------------+
|    BACKEND INFERENCE SERVER   |             |     SUPABASE CLOUD (BaaS)     |
| (DigitalOcean CPU Droplet)    |             |                               |
| - Python 3.11 + FastAPI       |             | - PostgreSQL DB (Transactions)|
| - ONNX Runtime / OpenVINO     |             | - Supabase Auth (JWT / RLS)   |
| - Model YOLO11 (Quantized)    |             | - Storage Bucket (Foto 30 Hari)|
| - BAPANAS Price Scraper Engine|             +-------------------------------+
+-------------------------------+
                |
                | (3) Tarik Harga Pangan Harian
                v
+-------------------------------+
|      API / PORTAL BAPANAS     |
| (Badan Pangan Nasional Pusat) |
+-------------------------------+
```

---

## 7. Desain Skema Database (Target Supabase PostgreSQL)

```sql
-- 1. Tabel Profil Pengguna (Petani / Pengepul)
CREATE TABLE profiles (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    nama_lengkap TEXT NOT NULL,
    role TEXT CHECK (role IN ('petani', 'pengepul', 'gapoktan', 'pedagang')) DEFAULT 'petani',
    nomor_telepon TEXT,
    lokasi_desa TEXT DEFAULT 'Payakumbuh',
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Aktifkan Row Level Security (RLS)
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Pengguna dapat mengelola profil sendiri" ON profiles
    FOR ALL USING (auth.uid() = id);

-- 2. Tabel Batch Panen (Harvest Batches)
CREATE TABLE harvest_batches (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    nomor_batch TEXT NOT NULL UNIQUE,
    tanggal DATE NOT NULL DEFAULT CURRENT_DATE,
    komoditas TEXT NOT NULL,
    berat_total_kg NUMERIC(8, 2) NOT NULL CHECK (berat_total_kg > 0),
    ukuran TEXT CHECK (ukuran IN ('Besar', 'Sedang', 'Kecil')) DEFAULT 'Sedang',
    catatan TEXT,
    foto_url TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE harvest_batches ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Isolasi data batch per pengguna" ON harvest_batches
    FOR ALL USING (auth.uid() = user_id);

-- 3. Tabel Hasil Kontrol Kualitas (QC Results)
CREATE TABLE qc_results (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    batch_id UUID NOT NULL REFERENCES harvest_batches(id) ON DELETE CASCADE,
    persen_grade_a NUMERIC(5, 2) NOT NULL,
    persen_grade_b NUMERIC(5, 2) NOT NULL,
    persen_reject NUMERIC(5, 2) NOT NULL,
    berat_grade_a_kg NUMERIC(8, 2) NOT NULL,
    berat_grade_b_kg NUMERIC(8, 2) NOT NULL,
    berat_reject_kg NUMERIC(8, 2) NOT NULL,
    harga_acuan_per_kg NUMERIC(10, 2) NOT NULL,
    total_nilai_rupiah NUMERIC(14, 2) NOT NULL,
    ai_inference_time_ms NUMERIC(6, 2),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE qc_results ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Isolasi data QC per pemilik batch" ON qc_results
    FOR ALL USING (
        auth.uid() = (SELECT user_id FROM harvest_batches WHERE id = qc_results.batch_id)
    );

-- 4. Tabel Cache Harga BAPANAS
CREATE TABLE bapanas_prices_cache (
    id SERIAL PRIMARY KEY,
    komoditas TEXT NOT NULL,
    wilayah TEXT NOT NULL DEFAULT 'Sumatera Barat',
    harga_pasar_per_kg NUMERIC(10, 2) NOT NULL,
    tanggal_berlaku DATE NOT NULL DEFAULT CURRENT_DATE,
    diperbarui_pada TIMESTAMPTZ DEFAULT NOW(),
    CONSTRAINT unique_commodity_date UNIQUE (komoditas, wilayah, tanggal_berlaku)
);
```

---

## 8. Spesifikasi Kontrak API (Target Backend FastAPI)

### 8.1 Inferensi Citra Panen
- **Endpoint:** `POST /api/v1/qc/predict`
- **Tipe Konten:** `multipart/form-data`
- **Request Body:**
  - `file`: Berkas citra (JPG/PNG/WebP, maks 5 MB).
  - `komoditas`: String (`Cabai Merah Keriting` / `Cabai Rawit Merah` / `Tomat`).
  - `berat_kg`: Float (contoh `50.0`).
- **Response Sukses (200 OK):**
  ```json
  {
    "status": "success",
    "inference_time_ms": 342.5,
    "detections": {
      "total_count": 84,
      "grade_a_count": 60,
      "grade_b_count": 18,
      "reject_count": 6
    },
    "percentages": {
      "grade_a": 71.43,
      "grade_b": 21.43,
      "reject": 7.14
    },
    "estimated_weights_kg": {
      "grade_a": 35.71,
      "grade_b": 10.71,
      "reject": 3.57
    },
    "recommendation": "Kualitas Tinggi: 71% Grade A. Siapkan untuk distribusi pasar grosir utama."
  }
  ```

### 8.2 Harga Pangan Harian BAPANAS
- **Endpoint:** `GET /api/v1/prices/today?province=Sumatera+Barat`
- **Response Sukses (200 OK):**
  ```json
  {
    "source": "Badan Pangan Nasional (BAPANAS)",
    "date": "2026-11-03",
    "province": "Sumatera Barat",
    "data": [
      { "commodity": "Cabai Merah Keriting", "price_per_kg": 45000 },
      { "commodity": "Cabai Rawit Merah", "price_per_kg": 42000 },
      { "commodity": "Tomat", "price_per_kg": 14000 }
    ]
  }
  ```

---

## 9. Analisis Kelayakan Bisnis & Finansial (STEAM Mathematics)

Sesuai Bab 6.2 Proposal Resmi STEAMPreneur SMK 2026:
- **Biaya Pengembangan Awal (Fase MVP):** Rp0 (Memaksimalkan Vercel Free Tier, Supabase Cloud Free Tier, Google Colab GPU T4, GitHub, dan Figma Education).
- **Proyeksi Biaya Komersialisasi Skala Penuh:** Rp3.750.000 / tahun.
  - DigitalOcean Basic CPU Droplet (1 vCPU / 2GB RAM): Rp1.200.000
  - Akun API / Kuota Tambahan: Rp1.500.000
  - Domain `.id` resmi & SSL: Rp250.000
  - Akuisisi dataset lapangan petani lokal: Rp800.000
- **Model Monetisasi SaaS Skala Mikro:**
  - Biaya Langganan Pengepul/Gapoktan: **Rp50.000 / bulan / pengguna**.
  - Beban Variabel Server/DB: Rp10.000 / bulan / pengguna.
  - Margin Bersih: **Rp40.000 / bulan / pengguna**.
- **Titik Impas (BEP):**
  $$\text{BEP} = \frac{\text{Total Biaya Komersialisasi}}{\text{Margin Bersih}} = \frac{\text{Rp3.750.000}}{\text{Rp40.000}} = 93,75 \approx 94 \text{ pengguna-bulan}$$
  Dengan target **32 pengepul / Gapoktan aktif**, titik impas investasi komersial tercapai tepat dalam kurun waktu **3 bulan**.

---

## 10. Roadmap Pelaksanaan Proyek Menuju Lomba STEAMPreneur 2026

```
+-------------------------------------------------------------------------+
| BULAN 1: PEMBERSIHAN FONDASI & INTEGRASI CAMERA MVP                     |
| - Perbaiki bug floating-point EPSILON di harvestCalculation.js          |
| - Kunci dependensi package.json                                         |
| - Implementasi komponen Batch Image/Camera Upload di tab Scanner        |
| - Uji coba lapangan bersama kelompok tani lokal di Payakumbuh           |
+-------------------------------------------------------------------------+
                                    |
                                    v
+-------------------------------------------------------------------------+
| BULAN 2-3: INTEGRASI AI ONNX & LIVE API BAPANAS                         |
| - Ekspor model YOLO11 hasil latih Colab ke format ONNX                  |
| - Setup service backend FastAPI di DigitalOcean CPU Droplet             |
| - Hubungkan inferensi citra keranjang panen via REST API (<500ms)       |
| - Integrasi scraper/feed Panel Harga Harian BAPANAS wilayah Sumbar      |
+-------------------------------------------------------------------------+
                                    |
                                    v
+-------------------------------------------------------------------------+
| BULAN 4-6: SUPABASE BAAS, SERTIFIKASI DIGITAL, & FINALISASI LOMBA       |
| - Migrasi penyimpanan riwayat dari localStorage ke Supabase PostgreSQL  |
| - Terapkan Row Level Security (RLS) untuk perlindungan data petani      |
| - Fitur unduh Sertifikat/Resi QC Digital (PDF)                          |
| - Pembuatan video demonstrasi karya nyata untuk penjurian STEAMPreneur  |
+-------------------------------------------------------------------------+
```

