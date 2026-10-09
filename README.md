# Agri-Sort AI

Website Quality Control & Smart Pricing Hortikultura untuk petani dan pedagang di Payakumbuh.

Agri-Sort AI membantu mencatat hasil panen cabai rawit hijau dan terung, mengkalkulasi distribusi mutu (grade) secara otomatis, dan memantau acuan harga pasar agar keputusan jual lebih tepat.

Target pengguna: petani, pedagang pengumpul, dan penjual di pasar.

Tech stack: HTML, CSS, JavaScript (SPA murni, tanpa backend/framework berat). Penyimpanan data berbasis `localStorage` browser.

## Alur Inti

1. **Input Hasil Panen** — Pengguna memasukkan komoditas (cabai rawit hijau / terung / tomat), berat total (kg), dan parameter mutu (kesegaran, ukuran, cacat).
2. **Kalkulasi Distribusi Grade & Harga** — Sistem menghitung pembagian grade (A / B / C), estimasi harga per grade berdasarkan acuan harga pasar, dan total nilai panen.
3. **Lihat Rekap Data** — Pengguna melihat riwayat pencatatan, ringkasan distribusi mutu, dan perbandingan nilai antar panen di halaman rekap.

## Cara Menjalankan

### Prasyarat

- Browser modern (Chrome / Edge / Firefox terbaru).
- Git (untuk clone repositori).
- Opsional: Node.js LTS (hanya untuk menjalankan unit test) dan ekstensi Live Server / `npx serve`.

### Clone Repo

```bash
git clone https://github.com/rizitakanashi-dev/steampreneur-agri-sort-ai.git
cd steampreneur-agri-sort-ai
```

### Jalankan Aplikasi

Pilih salah satu:

**Opsi A — Buka langsung:**

```bash
# Buka file berikut di browser:
src/index.html
```

**Opsi B — Live Server lokal (disarankan):**

```bash
# Dari root repositori:
npx serve src
# atau, jika memakai ekstensi Live Server VS Code:
# klik kanan src/index.html > Open with Live Server
```

Lalu buka URL yang ditampilkan di terminal (umumnya `http://localhost:3000`).

## Tangkapan Layar Alur Inti

| Langkah | Deskripsi | Gambar |
|---------|-----------|--------|
| 1 | Input hasil panen | ![Langkah 1](docs/bukti/langkah-1.png) |
| 2 | Kalkulasi distribusi grade & harga | ![Langkah 2](docs/bukti/langkah-2.png) |
| 3 | Rekap data panen | ![Langkah 3](docs/bukti/langkah-3.png) |

> Catatan: simpan tangkapan layar di folder `docs/bukti/` dengan nama `langkah-1.png`, `langkah-2.png`, `langkah-3.png`.

## Cara Menjalankan Pengujian

```bash
node --test
```

Perintah di atas menjalankan seluruh unit test di folder `tes/` menggunakan test runner bawaan Node.js (tanpa framework tambahan).

## Fitur dan Batasan

### Fitur

- Pencatatan hasil panen (komoditas, berat, parameter mutu)
- Kalkulasi distribusi grade (A / B / C) otomatis
- Estimasi harga per grade dan total nilai panen
- Acuan harga pasar cabai rawit hijau & terung
- Rekap dan riwayat data panen
- SPA ringan tanpa backend, berjalan penuh di browser

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
├── docs/
│   └── bukti/
│       ├── langkah-1.png
│       ├── langkah-2.png
│       └── langkah-3.png
├── src/
│   ├── index.html
│   ├── style.css
│   └── app.js
├── tes/
│   └── kalkulasi.test.js
└── bughunt-kasir/
```

## Sumber dan Lisensi

| Sumber | Lisensi |
|--------|---------|
| HTML / CSS / JavaScript (Web standar) | Standar terbuka |
| Google Fonts (mis. Inter / Poppins) | SIL Open Font License 1.1 |
| Ikon SVG bawaan / inline SVG | Milik proyek (bebas pakai) |

Proyek ini dirilis di bawah lisensi MIT. Lihat file `LICENSE` bila tersedia.

## Informasi Tim

Proyek oleh siswa SMKN 4 Payakumbuh:

- **Faris Al Farizi** — Ketua / Navigator
- **Hieray Antovino** — Analis / Dokumentator
- **Ahmad Afif** — Penguji
