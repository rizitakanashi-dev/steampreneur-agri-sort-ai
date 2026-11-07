# Detail Analisis Model AI & Artefak Ekspor
## Proyek: Agri-Sort AI — Model Deteksi Kualitas Hortikultura

> **Status:** AKTIF & DIMUTAKHIRKAN (8 November 2026)  
> **Model Utama Saat Ini:** YOLO11n Terung (Eggplant Quality Detection — 4 Kelas)  
> **Model Sekunder (Legacy):** YOLO11n Tomat (Tomato Freshness Detection — 2 Kelas)  

---

## 1. Model Utama: YOLO11n Terung (Eggplant Quality Grades) `[VERIFIED]`

Model ini merupakan model resmi aktif yang digunakan untuk fitur Computer Vision pada komoditas Terung dalam Agri-Sort AI.

### A. Inventaris Berkas Artefak Model
Direktori Sumber: `models-20261107T170211Z-1-001/models/terung/`

```
models-20261107T170211Z-1-001/models/terung/
├── best.pt (5.489.626 bytes / 5,49 MB)        # Checkpoint PyTorch pada titik evaluasi terbaik
├── best.onnx (10.666.390 bytes / 10,67 MB)    # Bobot ONNX ekspor untuk inferensi CPU tanpa dependensi CUDA
├── data.yaml                                  # Konfigurasi 4 kelas dataset Roboflow
└── model-metadata.json                        # Metadata lengkap arsitektur, split dataset, & metrik uji
```

### B. Spesifikasi Arsitektur & Lingkungan Pelatihan
- **Arsitektur Model:** Ultralytics YOLO11n (Nano Object Detection)
- **Framework & Versi:** Ultralytics 8.4.204
- **Resolusi Masukan (*Input Size*):** $640 \times 640$ piksel (3 kanal warna RGB)
- **Perangkat Keras Pelatihan:** Google Colab dengan GPU NVIDIA Tesla T4
- **Dataset Asal:** Roboflow `eggplant-quality-grades-hgdr1-oooww/1` (Lisensi: CC BY 4.0)
- **Tugas (*Task*):** `detect` (*Object Detection* dengan *bounding box*)

---

## 2. Kelas Deteksi & Distribusi Anotasi Dataset `[VERIFIED]`

Model Terung dilatih dengan 4 kelas mutu komersial:

| Class ID | Nama Kelas Asli (*Original Class*) | Train Instances | Valid Instances | Test Instances (311 Gambar) | Total Anotasi |
|:---:|---|:---:|:---:|:---:|:---:|
| `0` | `Class I` | 795 | 94 | 87 | 976 |
| `1` | `Class II` | 466 | 56 | 68 | 590 |
| `2` | `Extra Class` | 490 | 59 | 63 | 612 |
| `3` | `Reject` | 741 | 102 | 94 | 937 |
| **Total** | **4 Kelas** | **2.492** | **311** | **312** | **3.115** |

> [!IMPORTANT]
> **Preservasi Nama dan ID Kelas:**  
> Nama dan ID kelas wajib dipertahankan persis sesuai `data.yaml` (`0: Class I`, `1: Class II`, `2: Extra Class`, `3: Reject`). Aplikasi tidak mengubah label di dalam model.

---

## 3. Hasil Evaluasi Performa Model Terung `[VERIFIED]`

Evaluasi dilakukan pada split independen (*Test Set* — 311 gambar):

### A. Metrik Keseluruhan (*Overall Metrics*)
- **Precision:** **69.54%** (0.6954)
- **Recall:** **79.90%** (0.7990)
- **mAP@50:** **80.17%** (0.8017)
- **mAP@50-95:** **73.43%** (0.7343)

### B. Performa Rinci per Kelas
| Nama Kelas | Precision | Recall | mAP@50 | mAP@50-95 |
|---|:---:|:---:|:---:|:---:|
| **Extra Class** | **72.5%** | **83.7%** | **83.3%** | **74.3%** |
| **Reject** | **77.9%** | **86.1%** | **88.3%** | **82.8%** |
| **Class I** | **66.6%** | **73.5%** | **72.9%** | **63.5%** |
| **Class II** | **61.1%** | **76.3%** | **76.1%** | **73.1%** |

### C. Temuan Kritis Matriks Konfusi (*Confusion Matrix Analysis*)
Berdasarkan analisis *normalized confusion matrix*:
- `Extra Class` terklasifikasi benar: $\approx 81\%$
- `Class I` terklasifikasi benar: $\approx 79\%$
- `Reject` terklasifikasi benar: $\approx 78\%$
- `Class II` terklasifikasi benar: $\approx 63\%$

**Temuan Kunci Defisit Diskriminasi:**
- Sebanyak **19%** objek aktual `Class II` salah diprediksi sebagai `Reject`.
- Sebanyak **18%** objek aktual `Reject` salah diprediksi sebagai `Class II`.

**Rekomendasi Rekayasa:**
- Prioritas perbaikan model masa depan adalah meningkatkan diskriminasi antara `Class II` dan `Reject`.
- Untuk fase MVP saat ini, sistem mengadopsi mekanisme *Human-in-the-Loop* (pengguna dapat meninjau dan mengonfirmasi hasil deteksi sebelum transaksi difinalisasi).

---

## 4. Logika Pemetaan Grade Mutu (*Preliminary Grade Mapping*)

Untuk menyelaraskan keluaran 4-kelas model dengan standar komersial Agri-Sort AI:

| Kelas Asli Model | Grade Agri-Sort AI | Standar Mutu Lapangan | Perlakuan Pasca Panen |
|---|---|---|---|
| `Extra Class` | **Grade A** | Mutu Super / Bebas Cacat | Distribusi pasar modern / supermarket |
| `Class I` | **Grade A** | Mutu Baik / Cacat Sangat Ringan | Distribusi pasar retail utama |
| `Class II` | **Grade B** | Mutu Standar / Bentuk Kurang Sempurna | Industri olahan / pasar tradisional |
| `Reject` | **Reject** | Cacat Berat / Busuk / Luka | Dipisahkan untuk pakan ternak / kompos |

*Catatan: Pemetaan ini bersifat provisional dan diimplementasikan murni di lapisan logika bisnis backend, bukan dengan mengubah model.*

---

## 5. Model Sekunder (Legacy): YOLO11n Tomat 2-Kelas

Sebagai referensi historis dan dukungan komoditas multi-model:
- **Lokasi Bobot:** `model-export/weights/best.pt` (5,51 MB) & `best.onnx` (10,66 MB)
- **Kelas:** `0: fresh-tomato`, `1: rotten-tomato`
- **Performa:** Best mAP@50: 97.12%, Best mAP@50-95: 89.12%
- **Status:** Dipertahankan pada backend untuk routing komoditas Tomat.
