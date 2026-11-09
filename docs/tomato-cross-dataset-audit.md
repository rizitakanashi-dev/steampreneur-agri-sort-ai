# CROSS-DATASET LEAKAGE AUDIT — AGRI-SORT AI
**Evaluation Focus**: Cross-Dataset Leakage & Label Compatibility Audit between Existing Tomato Model Artifacts vs. Kaggle Tomato Grade Dataset  
**Auditor**: Senior Machine Learning Engineer, Computer Vision Specialist  
**Date**: November 9, 2026  
**Final Recommendation**: **ABANDON FOR PRODUCTION PIPELINE (`LEBIH BAIK DITINGGALKAN`)**

---

## 1. Executive Summary

Audit forensik independen dilakukan untuk mengevaluasi keterkaitan antara dataset eksternal **Kaggle Tomato Grade Dataset** (`/home/Rizi/archive/`) dengan dataset dan artefak model Tomat yang telah digunakan dalam proyek **Agri-Sort AI** (`model-export/` dan `/home/Rizi/dataset/test.v2i.yolov11.zip`).

### Temuan Inti:
1. **Zero Exact Overlap (0.0% Bit-Level Match)**: Tidak ditemukan satu pun gambar yang identik secara biner (MD5 / SHA-256) antara dataset Kaggle dan dataset pelatihan existing Agri-Sort AI (**0 dari 732 gambar Kaggle vs 1.664 gambar Existing**).
2. **Zero Near-Duplicate (Perceptual Hash Separation)**: Pengujian jarak Hamming (*Hamming distance*) pada 64-bit difference hash (dHash) menunjukkan **jarak minimum sebesar 12 bit** antar seluruh pasangan gambar lintas dataset. Tidak ada gambar hasil augmentasi, pemotongan (*crop*), atau kompresi ulang yang berasal dari sumber pemotretan yang sama.
3. **Domain & Sesi Pengambilan Terpisah Total**:
   - **Dataset Existing**: Merupakan gabungan dari *Kaggle Fruits Fresh and Rotten* (citra tomat terisolasi dengan latar belakang putih/hitam polos studio) dan *Tactile/Visual Tomato Dataset* (pencitraan boks terkontrol gripper robotik).
   - **Dataset Kaggle**: Merupakan foto ponsel pintar (*smartphone in-the-wild*) Xiaomi Redmi Note 9 / Realme X3 yang diambil di perkebunan dan pasar India pada Maret 2023.
4. **Ketiadaan Cross-Split Leakage**: Tidak ada citra dari Kaggle yang mencemari set uji (*Test set*) model existing Agri-Sort AI.
5. **Inkompatibilitas Taksonomi Label**: Model existing mendeteksi kondisi biner kesegaran (`fresh-tomato` vs `rotten-tomato`), sedangkan Kaggle membagi ke dalam 6 fase kematangan dan bercak (`Ripe`, `semi-ripe`, `unripe`, `spotted ripe`, `spotted unripe`, `rotten`).
6. **Risiko Fatal Penggabungan (*Poisoning Risk*)**: Penggabungan kedua dataset sangat berbahaya karena Kaggle mengandung **141 kelompok duplikat dengan label kontradiktif internal** (misal gambar yang sama dilabeli `Ripe` dan `rotten`), serta perbedaan distribusi domain visual yang ekstrem (*severe domain shift*).

---

## 2. Identifikasi Dataset & Artefak Model Existing Agri-Sort AI

### 2.1 Lokasi Artefak Model & Konfigurasi
Berdasarkan penelusuran arsitektur pada repositori Agri-Sort AI dan service backend ([`server/services/ai_engine.py`](file:///home/Rizi/agri-sort-ai/server/services/ai_engine.py)):

| Komponen Artefak | Lokasi Repositori | Keterangan Faktual |
| :--- | :--- | :--- |
| **Model PyTorch (.pt)** | `model-export/weights/best.pt` | Model YOLO11n (bobot aktif Tomat) |
| **Model ONNX Runtime** | `model-export/weights/best.onnx` | Model terkuantisasi / FP32 ONNX |
| **Model Checkpoint** | `model-export/weights/last.pt` | Checkpoint epoch ke-50 |
| **Konfigurasi Training**| `model-export/config/args.yaml` | Hyperparameter YOLO11 (imgsz: 640, epochs: 50, batch: 16) |
| **Dataset Manifest** | `model-export/config/data.yaml` | Definisi kelas: `['fresh-tomato', 'rotten-tomato']` |
| **Sumber Ekspor** | Roboflow Private Project | `workspace: rizi-takanashi`, `project: agri-sort`, `version: 2` |

### 2.2 Dataset Pelatihan yang Benar-Benar Digunakan
Dataset asal yang digunakan untuk melatih bobot `model-export/weights/best.pt` terverifikasi berada pada arsip lokal:
- **Lokasi Berkas**: `/home/Rizi/dataset/test.v2i.yolov11.zip`
- **Total Citra**: 1.664 berkas citra `.jpg` (resolusi $640 \times 640$ piksel).
- **Manifest Split**:
  - `train/images/`: 1.165 citra
  - `valid/images/`: 333 citra
  - `test/images/`: 166 citra
- **Total Anotasi YOLO**: 1.666 berkas label `.txt` (Kelas `0: fresh-tomato`, Kelas `1: rotten-tomato`).
- **Asal Usul Citra**:
  - Sub-koleksi 1: Spesimen `freshTomato-XXX` dan `rottenTomato-XXX` (dataset open-source klasifikasi buah segar/busuk).
  - Sub-koleksi 2: Spesimen `XX_Tomato_X_light` dan `XX_Tomato_X_dark` (dataset multi-modal visual-taktil pencahayaan terkontrol).

---

## 3. Komparasi Gambar: Kaggle Tomato Grade vs. Existing Dataset

### 3.1 Ringkasan Perbandingan Statistik Dataset

| Metrik Evaluasi | Existing Agri-Sort AI Dataset | Kaggle Tomato Grade Dataset |
| :--- | :---: | :---: |
| **Lokasi Penyimpanan** | `/home/Rizi/dataset/test.v2i.yolov11.zip` | `/home/Rizi/archive/Tomatoes/images` |
| **Format Anotasi** | YOLO txt (`labels/*.txt`) | COCO JSON (`Tomatoes/result.json`) |
| **Total Berkas Citra** | 1.664 berkas | 732 berkas |
| **Jumlah Citra Unik (MD5)** | 1.297 spesimen dasar (sebelum rotasi/crop) | **321 citra unik** (411 berkas duplikat) |
| **Resolusi Citra** | Seragam $640 \times 640$ piksel | Bervariasi ($460 \times 1024$ s.d. $3264 \times 1472$) |
| **Rasio Aspek Dominan** | $1:1$ (Square) | $9:16$ & $9:20$ (Portrait Smartphone) |
| **Latar Belakang Citra** | Polos putih / hitam studio terisolasi | Lahan kebun, meja kotor, tangan manusia, pasar |

### 3.2 Audit Exact Bit-Level Duplicates (MD5 & SHA-256)
Audit hash kriptografis dilakukan antara seluruh 732 berkas Kaggle dan 1.664 berkas dataset existing:
- **Exact Hash Match Count**: **0 berkas (0.00%)**.
- Tidak ada satu berkas pun dari dataset Kaggle yang identik secara biner dengan berkas di dalam Train, Valid, maupun Test split existing.

### 3.3 Audit Near-Duplicates (Perceptual Hash - 64-bit dHash)
Algoritma *difference hash* (dHash) dieksekusi dengan normalisasi kanvas grayscale $9 \times 8$ piksel:
- **Pasangan dengan Hamming Distance $\le 4$ (Near Identical / Crop)**: **0 pasangan**.
- **Pasangan dengan Hamming Distance $\le 8$ (High Structural Similarity)**: **0 pasangan**.
- **Jarak Hamming Minimum yang Ditemukan**: **12 bit** (dari 64 bit).
  - Contoh pasangan dengan jarak terdekat (dist=12):
    - `Kaggle(2e1716d8-Image_410.jpg)` $\leftrightarrow$ `Existing(test/images/55_Tomato_4_dark_png.rf.e3963c30dfa259687bf18e54fdbdf0d1.jpg)`
    - `Kaggle(4e7b80a4-Image_330.jpg)` $\leftrightarrow$ `Existing(train/images/rottenTomato-329-_jpg.rf.974258f4d888d1c4257164dfa7cc2b50.jpg)`
- **Inspeksi Visual Hasil Pasangan Terdekat**:  
  Inspeksi visual membuktikan bahwa kemiripan jarak 12 bit ini murni merupakan kemiripan komposisi global (objek bulat di tengah kanvas), bukan karena objek atau sesi foto yang sama. Latar belakang, varietas tomat, dan karakteristik pencahayaan 100% berbeda.

---

## 4. Evaluasi Cross-Split Leakage & Sesi Pengambilan

```
+---------------------------------------------------------------------------------------------------+
|                              CROSS-DATASET LEAKAGE TOPOLOGY                                       |
+---------------------------------------------------------------------------------------------------+

     [Kaggle Tomato Grade Dataset]                   [Existing Agri-Sort AI Model Dataset]
           (/home/Rizi/archive)                           (test.v2i.yolov11.zip)
       Total: 732 files (321 unique)                    Total: 1,664 files (1,297 specimens)
                     |                                                |
                     |                   NO OVERLAP (0.0%)            |
                     +---------------------------X--------------------+
                     |           (Jarak dHash min = 12 bit)           |
                     |                                                |
        [Internal Leakage Kaggle]                        [Internal Leakage Existing]
        - 72.6% Test ada di Train!                       - 175 spesimen bocor Train <-> Test
        - 141 grup label kontradiktif                    - Varian rotasi/crop spesimen sama
```

### 4.1 Kebocoran Lintas Dataset (Cross-Dataset Leakage)
- **Status**: **CLEAN (0 Kebocoran)**.
- Dataset Kaggle tidak pernah menjadi bagian dari data latih maupun data uji model Tomat existing.
- Evaluasi performa model Tomat saat ini (mAP@50 = 97.12%) tidak dipengaruhi oleh dataset Kaggle.

### 4.2 Kebocoran Internal Masing-Masing Dataset (Internal Split Leakage)
Meskipun tidak ada kebocoran antar dataset, kedua dataset sama-sama mengalami cacat metodologis pemisahan data (*data splitting*) secara internal:
1. **Existing Dataset**: 175 spesimen mengalami kebocoran lintas split (varian augmentasi dari spesimen yang sama tersebar di Train dan Test).
2. **Kaggle Dataset**: 106 dari 146 citra Test (72.6%) merupakan duplikat identik dari citra Train.

---

## 5. Audit Kesesuaian Taksonomi Label (Label Compatibility)

| Label Existing Agri-Sort AI | Label Kaggle Tomato Grade | Kesesuaian Semantik & Risiko Konflik |
| :--- | :--- | :--- |
| `fresh-tomato` (0) | `Ripe` (0) | **Kompatibel Sebagian**. Tomat matang mulus adalah segar, namun Kaggle tidak membedakan cacat fisik minor. |
| `fresh-tomato` (0) | `semi-ripe` (2) | **Kompatibel Sebagian**. Tahap *breaker/turning* segar, namun di Kaggle memiliki tumpang tindih visual dengan `rotten`. |
| `fresh-tomato` (0) | `unripe` (5) | **Kompatibel Sebagian**. Tomat hijau segar, namun tidak merepresentasikan produk konsumsi segar meja. |
| `rotten-tomato` (1) | `rotten` (1) | **Kompatibel Semantik, tetapi Rusak oleh Label Noise**. Di Kaggle, 141 grup duplikat memiliki gambar identik yang dilabeli `rotten` sekaligus `Ripe`. |
| *Tidak Ada Padanan* | `spotted ripe` (3) | **INKOMPATIBEL**. Tidak jelas apakah bercak masuk kategori segar (toleransi cacat fisik) atau busuk (penyakit antraknosa). |
| *Tidak Ada Padanan* | `spotted unripe` (4) | **INKOMPATIBEL**. Tidak ada definisi ambang luas bercak untuk menentukan kelayakan mutu. |

---

## 6. Analisis Risiko Penggabungan Dataset (Dataset Merging Risks)

Jika kedua dataset digabungkan (*merged*) ke dalam satu pipeline pelatihan, sistem akan menghadapi risiko kritis berikut:

1. **Pencemaran Label (*Label Poisoning*)**:  
   Kaggle membawa 141 kelompok duplikat dengan label kontradiktif. Citra yang sama persis akan diajarkan ke model sebagai `fresh-tomato` dan sekaligus `rotten-tomato`, merusak konvergensi *loss function* dan menurunkan akurasi deteksi kebusukan.
2. **Pergeseran Domain Ekstrem (*Extreme Domain Shift*)**:  
   Model akan mengalami kebingungan representasi visual (*feature representation interference*):
   - Citra existing mengajarkan model bahwa tomat selalu berada di atas latar putih/hitam tanpa tangan/daun.
   - Citra Kaggle mengajarkan model mengenali tomat di antara kerumunan daun, tanah, dan bayangan tajam.
   Penggabungan tanpa adaptasi domain terencana akan menurunkan presisi deteksi pada baki QC Agri-Sort AI.
3. **Hilangnya 185 Anotasi Multi-Objek**:  
   Format YOLO bawaan Kaggle (`TomatoDataset/TomatoDataset/`) telah kehilangan 185 anotasi objek akibat skrip konversi yang cacat. Melatih model dengan data ini akan mengajarkan model mengabaikan tomat-tomat yang berada dalam kluster (*false negative reinforcement*).
4. **Kegagalan Menjawab Target Mutu Komersial**:  
   Penggabungan ini tetap **tidak menghasilkan kelas Grade B**. Masalah mendasar Agri-Sort AI (ketiadaan pemisah antara Grade A dan Grade B berdasarkan persentase cacat visual SNI 01-3162-1992) sama sekali tidak terselesaikan dengan menambahkan 6 kelas Kaggle.

---

## 7. Rekomendasi Final ML Engineer

### **Verdict**: **`LEBIH BAIK DITINGGALKAN (ABANDON FOR PRODUCTION PIPELINE)`**

### Justifikasi Keputusan:
1. **Rasio Biaya-Manfaat (*Cost-to-Benefit*) Sangat Buruk**:
   - Jumlah data unik yang didapat sangat kecil: hanya **321 citra fisik unik**.
   - Beban *engineering* kurasi sangat tinggi: harus menghapus 411 duplikat, mere-anotasi ulang 141 citra berlabel konflik, memperbaiki 8 boks keluar kanvas, membuang 23 klik mikro, dan menyusun ulang konversi COCO-ke-YOLO untuk 185 anotasi yang hilang.
   - Mengeluarkan biaya kurasi besar hanya untuk mendapatkan 321 gambar dengan latar kebun yang tidak sesuai dengan lingkungan operasional baki QC Agri-Sort AI adalah tindakan yang tidak efisien.
2. **Kebutuhan Sebenarnya Adalah Dataset Mutu SNI**:
   - Agri-Sort AI membutuhkan dataset tomat multi-objek pada wadah/baki pemindaian panen dengan 3 tingkatan mutu:
     - **Grade A (Mutu I)**: Bentuk teratur, bebas cacat penyakit, cacat fisik $\le 5\%$.
     - **Grade B (Mutu II)**: Cacat fisik permukaan $\le 10\%$, tidak busuk.
     - **Reject**: Busuk basah, berjamur, luka terbuka.
3. **Arahan Aksi**:
   - Tinggalkan dataset Kaggle Tomato Grade pada arsip dingin (*cold storage*) sebagai referensi historis semata.
   - Alokasikan sumber daya tim ML untuk **akuisisi citra primer Tomat lokal di gudang/pasar mitra hortikultura**, menggunakan baki inspeksi multi-sudut Agri-Sort AI berstandar SNI 01-3162-1992.
