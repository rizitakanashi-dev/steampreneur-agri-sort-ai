# Agri-Sort AI

Website Quality Control & Smart Pricing Hortikultura untuk petani dan pedagang di Payakumbuh.

Agri-Sort AI membantu mencatat hasil panen cabai rawit hijau, terung, dan tomat, mengkalkulasi distribusi mutu (grade) secara otomatis, dan memantau acuan harga pasar agar keputusan jual lebih tepat.

Target pengguna: petani, pedagang pengumpul, dan penjual di pasar.

## Tech Stack

| Komponen | Teknologi | Versi |
|----------|-----------|-------|
| Framework UI | React | 19.3 |
| Bundler / Dev server | Vite | 8.3 |
| Library komponen UI | Material UI (`@mui/material`, `@mui/icons-material`) | 9.5 |
| Styling engine | Emotion (`@emotion/react`, `@emotion/styled`) | 11.14 |
| Grafik tren harga | MUI X Charts (`@mui/x-charts`) | 9.15 |
| Bahasa | JavaScript (ES modules, tanpa TypeScript) | — |
| Penyimpanan data | `localStorage` browser (tanpa backend) | — |
| Test runner | Node.js built-in (`node --test`) | Node 26+ |
| Font | Google Fonts (Inter) | SIL OFL 1.1 |

Tidak menggunakan Next.js, Tailwind, Supabase, atau framework test tambahan.

## Alur Inti

1. **Input Hasil Panen** — Pengguna memasukkan komoditas (cabai rawit hijau / terung / tomat), berat total (kg), dan parameter mutu (kesegaran, ukuran, cacat).
2. **Kalkulasi Distribusi Grade & Harga** — Sistem menghitung pembagian grade (A / B / C), estimasi harga per grade berdasarkan acuan harga pasar, dan total nilai panen.
3. **Lihat Rekap Data** — Pengguna melihat riwayat pencatatan, ringkasan distribusi mutu, dan perbandingan nilai antar panen di halaman rekap.

## Cara Menjalankan

### Prasyarat

- Node.js LTS (>= 18) dan npm.
- Git (untuk clone repositori).
- Browser modern (Chrome / Edge / Firefox terbaru).

### Clone Repo

```bash
git clone https://github.com/rizitakanashi-dev/steampreneur-agri-sort-ai.git
cd steampreneur-agri-sort-ai
```

### Install Dependensi

```bash
npm install
```

### Jalankan Server Development

```bash
npm run dev
```

Lalu buka URL yang ditampilkan di terminal (umumnya `http://localhost:5173`).

### Build Produksi (Opsional)

```bash
npm run build
npm run preview
```

## Tangkapan Layar Alur Inti

| Langkah | Deskripsi | Gambar |
|---------|-----------|--------|
| 1 | Input hasil panen | ![Langkah 1](docs/bukti/langkah-1.png) |
| 2 | Kalkulasi distribusi grade & harga | ![Langkah 2](docs/bukti/langkah-2.png) |
| 3 | Rekap data panen | ![Langkah 3](docs/bukti/langkah-3.png) |

## Cara Menjalankan Pengujian

```bash
npm test
```

Perintah di atas menjalankan seluruh unit test di folder `tes/` menggunakan test runner bawaan Node.js (`node --test`), tanpa framework tambahan.

Hasil yang diharapkan: **57 test lulus, 0 gagal**.

| Berkas test | Jumlah | Cakupan |
|-------------|--------|---------|
| `tes/harvestCalculation.test.js` | 12 | Kalkulasi distribusi grade, harga, pembulatan Rupiah |
| `tes/harvestValidation.test.js` | 5 | Validasi field form input panen (termasuk penolakan berat `0.0`/`0,00`) |
| `tes/gradeValidation.test.js` | 5 | Validasi persentase Grade A/B |
| `tes/harvestStorage.test.js` | 4 | Penyimpanan `localStorage` (data kosong, JSON rusak, ID unik) |
| `tes/harvestProjection.test.js` | 5 | Proyeksi pendapatan pada Pricing Dashboard |
| `tes/harvestRecapChangeRequest.test.js` | 15 | Pencarian, filter kombinasi, ekspor data tersaring, total berat/nilai rekap |
| `tes/csvExporter.test.js` | 10 | Header CSV, angka murni, escape koma/kutip/newline |
| `tes/initialState.test.js` | 1 | State awal aplikasi |
| **Total** | **57** | 32 test alur inti + 25 test Change Request |

Pengujian Bug Hunt Kasir Kantin (Tugas 2) berada di folder `bughunt-kasir/tes/` dan dijalankan terpisah:

```bash
cd bughunt-kasir
node --test tes/*.test.js
```

Hasil: **24 test lulus, 0 gagal** (4 bug diperbaiki: validasi jumlah, batas gabungan 99, tipe jumlah numerik, diskon member eksklusif).

## Fitur dan Batasan

### Fitur

- Pencatatan hasil panen (komoditas, berat, parameter mutu)
- Kalkulasi distribusi grade (A / B / C) otomatis
- Estimasi harga per grade dan total nilai panen
- Acuan harga pasar cabai rawit hijau, terung, dan tomat
- Rekap dan riwayat data panen
- **Pencarian real-time** pada halaman Rekap (berdasarkan ID batch atau komoditas, tidak membedakan huruf besar/kecil)
- **Filter komoditas dan rentang tanggal** yang dapat dikombinasikan dengan pencarian
- **Ekspor CSV** data yang sedang tampil (hasil pencarian + filter aktif)
- **Baris total rekap** (jumlah berat + jumlah nilai dari baris yang tampil)
- **Pricing Dashboard** dengan grafik tren harga dan proyeksi pendapatan
- SPA React tanpa backend, berjalan penuh di browser

### Halaman Rekap Data Panen

Halaman **Hasil Analisis QC → Lihat semua rekap** menampilkan seluruh batch yang tersimpan di browser.

1. **Mencari** — ketik ID batch atau nama komoditas pada kotak pencarian. Tabel tersaring langsung saat mengetik dan tidak membedakan huruf besar/kecil.
2. **Memfilter** — pilih **Komoditas** pada dropdown, dan/atau isi rentang tanggal pada kolom **Dari** dan **Sampai** (batas tanggal ikut dihitung). Pencarian dan filter dapat dipakai bersamaan.
3. **Mereset** — klik ikon **Reset filter** untuk mengembalikan semua filter ke keadaan awal.
4. **Mengekspor CSV** — klik **Ekspor CSV** untuk mengunduh **hanya baris yang sedang tampil**. Berkas dapat dibuka di Excel; baris pertama berisi nama kolom dan angka ditulis murni tanpa simbol `Rp` maupun pemisah ribuan (contoh: `15000`).

Jika tidak ada data yang cocok, tabel menampilkan pesan **"Data tidak ditemukan"**.

### Batasan

- Simulasi client-side: seluruh data tersimpan di `localStorage` browser
- Data tidak tersinkron antar perangkat/browser
- Data hilang jika cache/`localStorage` browser dihapus
- Acuan harga bersifat referensi dan perlu pembaruan manual
- Belum ada autentikasi, backend, maupun database server

## Struktur Folder

```
steampreneur-agri-sort-ai/
├── README.md
├── .gitignore
├── package.json
├── package-lock.json
├── vite.config.js
├── index.html
├── docs/
│   ├── 01-spesifikasi.md
│   ├── 02-rencana.md
│   ├── 03-log-prompt.md
│   ├── 04-kasus-uji.md
│   ├── 05-kesalahan-ai.md
│   ├── 06-catatan-review.md
│   ├── 07-refleksi.md
│   ├── 08-penjelasan-kode.md
│   ├── analisis-change-request.md
│   └── bukti/                    (tangkapan layar hasil uji)
├── src/
│   ├── main.jsx
│   ├── App.jsx
│   ├── theme.js                  (tema MUI)
│   ├── index.css
│   ├── business/                 (logika bisnis, tanpa React)
│   │   ├── harvestCalculation.js
│   │   ├── harvestValidation.js
│   │   ├── harvestStorage.js
│   │   ├── harvestFilter.js      (pencarian, filter, & total rekap)
│   │   ├── harvestProjection.js
│   │   ├── priceReference.js
│   │   └── initialState.js
│   ├── components/               (komponen UI MUI)
│   │   ├── AppShell.jsx
│   │   ├── HarvestForm.jsx
│   │   ├── HarvestRecap.jsx
│   │   ├── QCResults.jsx
│   │   ├── PricingDashboard.jsx
│   │   ├── PriceTrendChart.jsx
│   │   └── PageHeader.jsx
│   └── utils/
│       └── csvExporter.js        (pembangun & pengunduh CSV)
├── tes/                          (unit test aplikasi utama)
│   ├── harvestCalculation.test.js
│   ├── harvestValidation.test.js
│   ├── gradeValidation.test.js
│   ├── harvestStorage.test.js
│   ├── harvestProjection.test.js
│   ├── harvestRecapChangeRequest.test.js
│   ├── csvExporter.test.js
│   └── initialState.test.js
└── bughunt-kasir/                (Bug Hunt Tugas 2 — Kasir Kantin STEAM)
    ├── app.js
    ├── kasir.js
    ├── index.html
    ├── package.json              (konfigurasi "type": "commonjs" untuk node --test)
    ├── catatan-bug.md
    └── tes/
        ├── validasiJumlah.test.js
        ├── batasGabungan.test.js
        ├── tipeJumlah.test.js
        ├── diskonMember.test.js
        └── contoh.test.js
```

Catatan: struktur folder mengikuti konvensi Vite, sesuai izin pada lembar challenge. Logika bisnis dipisahkan dari komponen React agar dapat diuji tanpa render.

### Catatan Cakupan: fitur proposal vs implementasi challenge

Beberapa fitur yang berasal dari proposal awal **tidak diimplementasikan** karena berada di luar cakupan challenge (lihat `docs/01-spesifikasi.md` Bagian 5):

| Item | Status | Alasan |
|------|--------|--------|
| Kasus uji U07 (validasi foto blur / Laplacian Variance) | Tidak diuji | Fitur AI vision tidak diimplementasikan dalam versi challenge (frontend-only, tanpa unggah foto atau model YOLO/ONNX). |
| Kasus uji U08 (filter objek non-komoditas / confidence score) Tidak diuji | Sama seperti U07 — inferensi model tidak tersedia di versi challenge. |
| Kasus uji U12 / kriteria K17 (`agrisort.harga_cache.v1`) | Tidak diimplementasikan | Tidak ada integrasi API harga BAPANAS, sehingga tidak ada cache offline yang perlu dibaca. Harga acuan adalah tabel tetap di `src/business/priceReference.js`. |
| Cetak Sertifikat PDF | Tidak dikerjakan | Di luar kriteria Change Request; tidak ada pustaka PDF yang ditambahkan. |

Semua nilai BPP (biaya pokok produksi) dan harga acuan di aplikasi ini adalah **data bawaan/simulasi (mock)** yang ditulis di dalam kode, bukan hasil pengambilan data nyata dari API mana pun.

## Dokumentasi

| Berkas | Isi |
|--------|-----|
| `docs/01-spesifikasi.md` | Spesifikasi lengkap: masalah, solusi, aturan bisnis, rumus, field form, pesan error |
| `docs/02-rencana.md` | Rencana kerja: 21 langkah, estimasi vs aktual, pembagian peran |
| `docs/03-log-prompt.md` | Log prompt AI: setiap interaksi, hasil, dan keputusan tim |
| `docs/04-kasus-uji.md` | Kasus uji K01–K25 dengan status Pass/Fail |
| `docs/05-kesalahan-ai.md` | 7 kesalahan AI yang ditemukan dan diperbaiki tim |
| `docs/06-catatan-review.md` | Code review: 6 temuan (R01–R06) dengan keputusan diterima/ditunda/ditolak |
| `docs/07-refleksi.md` | Refleksi tim: 6 pertanyaan, diisi jujur termasuk kesalahan urutan commit |
| `docs/08-penjelasan-kode.md` | Penjelasan kode per anggota (7 bagian: Ahmad 2, Faris 3, Hieray 2) |
| `docs/analisis-change-request.md` | Analisis dampak change request sebelum eksekusi |

## Sumber dan Lisensi

| Sumber | Versi | Lisensi |
|--------|-------|---------|
| React | 19.3 | MIT |
| Vite | 8.3 | MIT |
| Material UI (`@mui/material`, `@mui/icons-material`) | 9.5 | MIT |
| Emotion (`@emotion/react`, `@emotion/styled`) | 11.14 | MIT |
| MUI X Charts (`@mui/x-charts`) | 9.15 | MIT |
| Google Fonts (Inter) | — | SIL Open Font License 1.1 |

Proyek ini dirilis di bawah lisensi MIT.

## Informasi Tim

Proyek oleh siswa SMKN 4 Payakumbuh:

- **Faris Al Farizi** — Ketua / Navigator
- **Hieray Antovino** — Analis / Dokumentator
- **Ahmad Afif** — Penguji
