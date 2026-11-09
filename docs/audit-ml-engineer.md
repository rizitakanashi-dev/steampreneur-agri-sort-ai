# LAPORAN AUDIT KOMPREHENSIF MACHINE LEARNING & COMPUTER VISION
## Agri-Sort AI: Sistem Quality Control & Smart Pricing Hortikultura
### Berdasarkan Kondisi Model Aktual, Dataset, Pipeline Inferensi, dan Kesiapan Integrasi

> **Status Audit:** SELESAI (COMPLETED)  
> **Tanggal Audit:** 9 November 2026  
> **Auditor Independen:** Senior Machine Learning Engineer, Computer Vision Engineer & Independent ML Auditor  
> **Metode Audit:** Empirical Code & Artifact Inspection (Read-Only), Statistically Verified Analysis, Cross-Split Leakage Scan, Tensor & Graph Profiling  
> **Repositori Target:** `/home/Rizi/agri-sort-ai` (Commit `6a1f402`, Branch `main`)  
> **Komoditas Target:** 1. Terung (*Solanum melongena*), 2. Tomat (*Solanum lycopersicum*), 3. Cabai Rawit Hijau (*Capsicum frutescens*)

---

## 1. RINGKASAN EKSEKUTIF (EXECUTIVE SUMMARY)

Audit independen ini dilakukan secara menyeluruh terhadap seluruh komponen Machine Learning (ML) dan Computer Vision (CV) pada repositori Agri-Sort AI. Audit berfokus pada kondisi faktual artefak model, dataset pelatihan, pemetaan label kualitas, kebocoran data (*data leakage*), keandalan inferensi, optimasi runtime, serta kompatibilitas sistem terhadap target akhir proyek: **klasifikasi mutu 3-tingkat seragam (Grade A, Grade B, dan Reject)**.

### Ringkasan Status Kesiapan Komoditas & Pipeline (Summary Verdicts)
| Komponen Evaluasi | Status Kesiapan | Status Verifikasi | Ringkasan Kondisi Aktual |
|---|---|---|---|
| **Model Terung (Eggplant)** | `READY WITH LIMITATIONS` | `VERIFIED` | Model deteksi objek YOLO11n 4-kelas (`Extra Class`, `Class I`, `Class II`, `Reject`) telah dilatih dan terintegrasi. Terdapat defisit diskriminasi antara `Class II` dan `Reject` (ambiguitas ~19%), serta bias pelatihan *single-object* yang dimitigasi di level inferensi menggunakan Sliced Aided Hyper Inference (SAHI). |
| **Model Tomat (Tomato)** | `NEEDS IMPROVEMENT` | `VERIFIED` | Model deteksi objek YOLO11n 2-kelas (`fresh-tomato`, `rotten-tomato`). **Bukan model quality grading 3-tingkat**, melainkan model biner kesegaran vs kebusukan (*freshness/decay detector*). Belum mampu mendeteksi cacat kosmetik ringan untuk memisahkan Grade A dan Grade B. Ditemukan kebocoran spesimen (*specimen leakage*) lintas split sebanyak 175 kejadian pada dataset asal. |
| **Dataset Cabai Rawit Hijau** | `NOT READY` | `NOT AVAILABLE` | **Tidak ditemukan model, bobot, maupun dataset citra cabai** dalam repositori maupun penyimpanan lokal. Kesiapan data berada pada status nol; saat ini sistem sepenuhnya bergantung pada fallback kalkulasi harga manual tanpa computer vision. |
| **ML Inference Pipeline** | `READY WITH LIMITATIONS` | `VERIFIED` | Pipeline inferensi backend telah mengimplementasikan Singleton Loader, ONNX Runtime CPU Engine, Sliced Inference (SAHI), kalibrasi ambiguitas mutu, inspeksi multi-sudut (*multi-angle dual-shot*), dan audit kualitas citra (CLAHE & blur/exposure gate). Namun, dependensi `opencv-python-headless` belum dicantumkan di `requirements.txt`. |
| **Fullstack Integration** | `READY WITH LIMITATIONS` | `VERIFIED` | Kontrak respons JSON terstandardisasi pada endpoint `POST /api/v1/qc/scan` dan `POST /api/v1/qc/scan-multi`. Frontend kanvas overlay mendukung visualisasi multi-kelas. Sebanyak 102 unit test JavaScript lolos (100%). |
| **Production Readiness** | `NEEDS IMPROVEMENT` | `PARTIALLY VERIFIED` | Sistem siap untuk uji coba lapangan terbatas (MVP) pada komoditas Terung dengan supervisi *human-in-the-loop*. Belum layak untuk rilis produksi mandiri penuh (*unattended production*) pada Tomat (ketiadaan Grade B) dan Cabai Rawit Hijau (ketiadaan model). |

---

## 2. ARSITEKTUR MACHINE LEARNING AKTUAL (ACTUAL ML ARCHITECTURE)

```
+---------------------------------------------------------------------------------------------------+
|                                  AGRI-SORT AI INFERENCE ARCHITECTURE                              |
+---------------------------------------------------------------------------------------------------+
                                                  |
                    [Klien Frontend / Kamera PWA / File Upload]
                                                  | Multipart/form-data
                                                  v
                     +--------------------------------------------+
                     |         FastAPI Gateway (qc.py)            |
                     +--------------------------------------------+
                                                  |
                     +--------------------------------------------+
                     | Pre-flight Security & Quality Gate         |
                     | - Magic Bytes & MIME Validation            |
                     | - Resolution & Anti-Decompression Bomb     |
                     | - Laplacian Blur & Exposure Detection      |
                     | - CLAHE Contrast Enhancement (cv2)         |
                     +--------------------------------------------+
                                                  |
                     +--------------------------------------------+
                     | Routing Logika Komoditas                   |
                     +--------------------------------------------+
                       /                          |              \
                      /                           |               \
        [Komoditas: Terung]              [Komoditas: Tomat]     [Cabai / Komoditas Lain]
                     |                            |                        |
       +----------------------------+  +----------------------+  +---------------------+
       | Model YOLO11n Terung       |  | Model YOLO11n Tomat  |  | AI NOT AVAILABLE    |
       | 4-Class:                   |  | 2-Class:             |  | Fallback Simulasi   |
       | - Extra Class (Grade A)    |  | - fresh-tomato       |  | Kalkulasi Finansial |
       | - Class I     (Grade A)    |  | - rotten-tomato      |  | & Slider Manual     |
       | - Class II    (Grade B)    |  +----------------------+  +---------------------+
       | - Reject      (Reject)     |             |
       +----------------------------+             |
                     |                            |
       +------------------------------------------------------+
       | Execution Engine Abstraction (ai_engine.py)          |
       | 1. ONNX Runtime CPU (onnx_engine.py - Default C++)   |
       | 2. Fallback: PyTorch Native Ultralytics Engine       |
       +------------------------------------------------------+
                     |
       +------------------------------------------------------+
       | Post-Processing & Spatial Aggregation                |
       | - Full-Image Pass (imgsz=640)                        |
       | - Sliced Aided Hyper Inference (SAHI) Grid Slicing   |
       | - Monolithic Crate Box Suppression                   |
       | - Spatial Clustering & NMS (IoU threshold = 0.40)    |
       | - Heuristic Disambiguation (Class II vs Reject)      |
       +------------------------------------------------------+
                     |
       +------------------------------------------------------+
       | Business Grading & Smart Pricing Rule Engine         |
       | - Terung: Extra+Class I -> Grade A; Class II -> B    |
       | - Tomat:  Fresh -> Grade A; Rotten -> Reject         |
       | - Nilai Ekonomi STEAM Math & Multiplier Komersial    |
       +------------------------------------------------------+
                                                  |
                     [JSON Standardized Response Contract]
```

---

## 3. INVENTARIS ARTEFAK REPOSITORI (REPOSITORY INVENTORY)

Audit memverifikasi keberadaan, integritas, dan konsistensi seluruh berkas terkait Machine Learning dalam repositori:

| Kategori | Jalur Berkas (*File Path*) | Ukuran / Karakteristik | Status Verifikasi | Catatan Audit |
|---|---|---|:---:|---|
| **Model Weights** | `server/models/terung/best.onnx` | 10.666.390 bytes (~10,67 MB) | `VERIFIED` | ONNX opset 22, FP32, input tensor `images: [1, 3, 640, 640]`, output tensor `output0: [1, 8, 8400]`. |
| **Model Weights** | `server/models/terung/best.pt` | 5.489.626 bytes (~5,49 MB) | `VERIFIED` | Checkpoint PyTorch YOLO11n resmi komoditas Terung. |
| **Model Config** | `server/models/terung/data.yaml` | 332 bytes | `VERIFIED` | 4 kelas: `Class I`, `Class II`, `Extra Class`, `Reject`. Sumber: Roboflow `eggplant-quality-grades-hgdr1-oooww/1`. |
| **Model Metadata** | `server/models/terung/model-metadata.json` | 84 baris | `VERIFIED` | Dokumentasi metrik uji test set, class mapping, dan batas inferensi. |
| **Model Duplikasi** | `models-20261107T170211Z-1-001/models/terung/` | Berkas identik dengan `server/models/terung/` | `VERIFIED` | Direktori cadangan ekstraksi artefak. Terjadi redundansi penyimpanan sebesar 16,15 MB. |
| **Model Weights** | `model-export/weights/best.onnx` | 10.663.419 bytes (~10,66 MB) | `VERIFIED` | ONNX opset 22, input tensor `images: [1, 3, 640, 640]`, output tensor `output0: [1, 6, 8400]`. |
| **Model Weights** | `model-export/weights/best.pt` | 5.505.562 bytes (~5,51 MB) | `VERIFIED` | Checkpoint PyTorch YOLO11n komoditas Tomat. |
| **Model Weights** | `model-export/weights/last.pt` | 5.505.562 bytes (~5,51 MB) | `VERIFIED` | Checkpoint epoch terakhir (epoch 50). |
| **Model Config** | `model-export/config/args.yaml` | 114 parameter | `VERIFIED` | Catatan hyperparameter pelatihan Tomat (epochs: 50, batch: 16, imgsz: 640, lr0: 0.01). |
| **Training Log** | `model-export/config/results.csv` | 51 baris (50 epoch) | `VERIFIED` | Metrik per epoch pelatihan model Tomat. |
| **Model Config** | `model-export/config/data.yaml` | 263 bytes | `VERIFIED` | 2 kelas: `fresh-tomato`, `rotten-tomato`. Sumber: Roboflow `agri-sort/2`. |
| **Inference Code** | `server/services/ai_engine.py` | 272 baris | `VERIFIED` | Singleton inference manager dengan lazy loading dan backend switching. |
| **Inference Code** | `server/services/onnx_engine.py` | 262 baris | `VERIFIED` | Engine inferensi murni C++ ONNX Runtime dengan NMS vektor NumPy. |
| **Inference Code** | `server/services/tiled_inference.py` | 359 baris | `VERIFIED` | Algoritma SAHI, supresi box monolitik, dan disambiguasi Class II vs Reject. |
| **Inference Code** | `server/services/multi_angle_service.py` | 225 baris | `VERIFIED` | Layanan agregasi inspeksi multi-sudut (*dual-shot inspection*). |
| **Preprocessing Code**| `server/utils/image_quality.py` | 215 baris | `VERIFIED` | Analisis Laplacian blur, over/under exposure, dan CLAHE enhancement. |
| **Benchmark Script**| `server/scripts/benchmark_models.py` | 224 baris | `VERIFIED` | Script evaluasi performa latensi (P50/P95/P99), FPS, dan parity check. |
| **Arsip Dataset** | `/home/Rizi/dataset/test.v2i.yolov11.zip` | 44.333.639 bytes (~44,3 MB) | `VERIFIED` | Dataset Tomat YOLOv11 (1.664 citra total). Berada di luar git tree. |
| **Arsip Dataset** | `/home/Rizi/dataset/Dataset.rar` | 163.975.433 bytes (~164 MB) | `VERIFIED` | Dataset klasifikasi citra folder Three Classes/Two Classes (bukan anotasi YOLO). |
| **Arsip Dataset** | `Agri-Sort-AI-20261102T043857Z-1-001.zip` | 16.168.981 bytes (~16,1 MB) | `VERIFIED` | Arsip lama bobot Tomat (`best.onnx`, `best.pt`). Redundan. |
| **Arsip Model** | `models-20261107T170211Z-1-001.zip` | 16.156.348 bytes (~16,1 MB) | `VERIFIED` | Arsip bobot Terung. Redundan dengan folder terekstraksi. |
| **Arsip Model** | `model-export-20261102T064405Z-1-001.zip` | 22.581.811 bytes (~22,5 MB) | `VERIFIED` | Arsip ekspor Tomat lengkap. Redundan dengan folder `model-export/`. |

---

## 4. AUDIT DATASET PER KOMODITAS (DATASET AUDIT)

Audit dataset dilakukan secara terpisah untuk setiap komoditas tanpa menggabungkan statistik.

```
+----------------------------------------------------------------------------------------------------+
|                                    KOMODITAS DATASET OVERVIEW                                      |
+-------------------+------------------------------+---------------------------+---------------------+
| Karakteristik     | Terung (Eggplant)            | Tomat (Tomato)            | Cabai Rawit Hijau   |
+-------------------+------------------------------+---------------------------+---------------------+
| Sumber            | Roboflow                     | Roboflow Universe         | Tidak Ada           |
| Identifikasi ID   | eggplant-quality-grades-hg.. | test-urup2 (agri-sort/2)  | N/A                 |
| Lisensi           | CC BY 4.0                    | MIT                       | N/A                 |
| Format Anotasi    | YOLO Bounding Box (.txt)     | YOLO Bounding Box (.txt)  | N/A                 |
| Jumlah Gambar     | 3.114 gambar (estimasi)      | 1.664 gambar              | 0 gambar            |
| - Train Split     | 2.492 instances              | 1.165 gambar (2.584 inst) | 0                   |
| - Valid Split     | 311 instances                | 333 gambar (654 inst)     | 0                   |
| - Test Split      | 311 gambar (312 instances)   | 166 gambar (320 inst)     | 0                   |
| Kelas Asli        | 4 Kelas (Extra, I, II, Rej)  | 2 Kelas (Fresh, Rotten)   | N/A                 |
| Struktur Objek    | Single-object (~1 obj/img)   | Multi-object (1-4 obj/img)| N/A                 |
| Kesesuaian Target | PARTIALLY ALIGNED            | NOT ALIGNED (Hanya Biner) | NOT AVAILABLE       |
+-------------------+------------------------------+---------------------------+---------------------+
```

### 4.1. Audit Dataset Terung (Eggplant) `[PARTIALLY VERIFIED]`
- **Nama & Sumber Dataset:** `eggplant-quality-grades-hgdr1-oooww/1` via Roboflow.
- **Lisensi:** Creative Commons Attribution 4.0 International (CC BY 4.0).
- **Format Citra & Anotasi:** Citra format JPEG/PNG, anotasi format YOLO TXT standar (`<class-id> <x_center> <y_center> <width> <height>`).
- **Resolusi Latih:** $640 \times 640$ piksel.
- **Distribusi Anotasi Faktual:**
  - *Train Split:* 2.492 instances (`Class I`: 795, `Class II`: 466, `Extra Class`: 490, `Reject`: 741).
  - *Valid Split:* 311 instances (`Class I`: 94, `Class II`: 56, `Extra Class`: 59, `Reject`: 102).
  - *Test Split:* 311 gambar / 312 instances (`Class I`: 87, `Class II`: 68, `Extra Class`: 63, `Reject`: 94).
- **Rasio Objek per Citra (Object Density Bias):**
  - Pada Test Split terdapat 311 gambar dengan 312 total anotasi. Hal ini membuktikan bahwa **rasio kepadatan objek adalah 1,003 objek per gambar**.
  - **Temuan Kritis:** Dataset didominasi oleh gambar satu butir terung terisolasi di atas latar belakang bersih (*studio/neutral background*). Dataset sama sekali **tidak memiliki anotasi keranjang panen padat (*dense crate harvest images*)** yang merefleksikan kondisi lapangan pertanian nyata. Inilah akar penyebab model dasar YOLO11n mengalami kegagalan deteksi monolitik (halusinasi keranjang penuh dianggap 1 box besar) sebelum ditangani oleh algoritma SAHI.
- **Keseimbangan Kelas:** Rasio `Class I` (31,3%) dan `Reject` (30,1%) jauh lebih dominan dibanding `Class II` (18,9%) dan `Extra Class` (19,6%), menyebabkan sensitivitas model terhadap `Class II` menjadi yang paling rendah.

### 4.2. Audit Dataset Tomat (Tomato) `[VERIFIED]`
- **Nama & Sumber Dataset:** Roboflow Universe `test-urup2/2` (diekspor sebagai `agri-sort/2`).
- **Lisensi:** MIT License.
- **Format Citra & Anotasi:** YOLO format, resolusi $640 \times 640$ piksel.
- **Distribusi Gambar & Anotasi Aktual:**
  - *Train Split:* 1.165 gambar, 2.584 anotasi.
    - `0: fresh-tomato`: 2.147 instances (**83,1%**)
    - `1: rotten-tomato`: 437 instances (**16,9%**)
  - *Valid Split:* 333 gambar, 654 anotasi.
    - `0: fresh-tomato`: 530 instances (**81,0%**)
    - `1: rotten-tomato`: 124 instances (**19,0%**)
  - *Test Split:* 166 gambar, 320 anotasi.
    - `0: fresh-tomato`: 263 instances (**82,2%**)
    - `1: rotten-tomato`: 57 instances (**17,8%**)
- **Ketidakseimbangan Kelas Ekstrem (*Severe Class Imbalance*):**
  - Rasio buah segar dibanding busuk adalah $\approx 5 : 1$. Buah segar mendominasi 83% dari keseluruhan data latih. Model memiliki bias bawaan yang sangat kuat untuk memprediksi objek sebagai `fresh-tomato`.
- **Kesesuaian Label Terhadap Tujuan Proyek:**
  - **GAGAL MEMENUHI SYARAT GRADING MUTU.** Dataset hanya melabeli buah menjadi 2 kategori polar (*Fresh* vs *Rotten*). Dataset tidak memiliki label untuk tomat dengan cacat fisik ringan, goresan kulit, bentuk asimetris, atau deviasi ukuran.

### 4.3. Audit Dataset Cabai Rawit Hijau (Chili) `[NOT AVAILABLE]`
- **Status Faktual:** **TIDAK TERSEDIA (ZERO ASSETS).**
- **Hasil Pemindaian Repositori & Disk Lokal:**
  - Pencarian rekursif berkas `*cabai*`, `*rawit*`, `*chili*`, `*chilli*`, `*pepper*` pada seluruh direktori lokal (`/home/Rizi`) mengonfirmasi bahwa tidak ada berkas citra, file anotasi, berkas YAML konfigurasi, maupun bobot model untuk komoditas Cabai Rawit Hijau.
  - Satu-satunya berkas yang menyebut kata "cabai" adalah tangkapan layar pengujian UI kasir manual: `docs/bukti/U02-desimal-koma-cabai.png`.
- **Kondisi Implementasi Saat Ini:**
  - File `server/routers/qc.py` baris 80-94 menangani cabai melalui percabangan fallback non-AI (`is_simulated = True`), mengembalikan catatan: *"Komoditas ini belum didukung deteksi citra otomatis. Gunakan slider mutu manual untuk memproyeksikan estimasi nilai ekonomis."*
- **Kebutuhan Minimum Sebelum Model Cabai Dapat Dilatih:**
  - Pengumpulan dataset citra minimal 1.500 citra cabai rawit hijau (*Capsicum frutescens*).
  - Anotasi bounding box multi-kelas sesuai standar SNI: Grade A (panjang seragam >3 cm, warna hijau mengkilap, bebas cacat), Grade B (panjang 2-3 cm, warna hijau pudar/berbelang, tangkai layu), Reject (busuk antraknosa, berlubang lalat buah, layu mengering).

---

## 5. AUDIT RUBRIK & LABEL MUTU (GRADING LABEL & RUBRIC AUDIT)

### 5.1. Analisis Standar Visual & Validasi Ahli
Audit memeriksa apakah klasifikasi mutu didukung oleh dokumen visual grading resmi (*Visual Grading Rubric*):
- **Dokumentasi yang Tersedia:** Proyek mendokumentasikan pemetaan mutu sementara (*provisional mapping*) di `docs/detail-model.md` dan `server/models/terung/model-metadata.json`.
- **Dasar Acuan Lapangan:** `NOT VERIFIED`. Catatan audit koreksi standar: SNI 01-3162-1992 adalah Standar Nasional Indonesia untuk Mutu *Tomat Segar*, bukan Terung Segar. Standar resmi SNI untuk Terung Segar belum diverifikasi di repositori. Model Terung yang digunakan mengadopsi taksonomi 4-kelas UNECE Standard FFV-05 (Aubergines: Extra Class, Class I, Class II, Reject), bukan SNI. Standar Tomat tidak dapat dijadikan pembenaran mapping Terung.
- **Validasi Ahli / Evaluator Mutu:** `NOT VERIFIED`. Belum ditemukan catatan verifikasi formal (*agronomist signed approval*) dari praktisi hortikultura atau staf Quality Assurance pertanian lapangan mengenai konsistensi pelabelan dataset publik Roboflow terhadap standar pasar lokal Sumatera Barat.

### 5.2. Analisis Pemetaan Kelas Aktual ke Target Akhir (Grade A / B / Reject)

#### A. Komoditas Terung (4 Kelas ke 3 Grade)
```
+--------------------+---------------------+-------------------------------------------------------+
| Label Model Aktual | Target Grade Akhir  | Justifikasi Ilmiah & Karakteristik Visual             |
+--------------------+---------------------+-------------------------------------------------------+
| Extra Class        | Grade A             | Bebas cacat, bentuk lurus sempurna, warna ungu pekat.  |
| Class I            | Grade A             | Bentuk baik, cacat kelengkungan < 10%, goresan mikro. |
| Class II           | Grade B             | Kelengkungan nyata (10-25%), cacat kulit non-patogen. |
| Reject             | Reject              | Busuk lunak, lubang ulat/hama, busuk phytophthora.   |
+--------------------+---------------------+-------------------------------------------------------+
```
- **Kelayakan Pemetaan:** **VALID & DAPAT DIPERTANGGUNGJAWABKAN SECARA KOMERSIAL.** Penggabungan `Extra Class` dan `Class I` ke dalam `Grade A` mencerminkan praktik pasar modern/ekspor, sementara `Class II` dialokasikan untuk pasar tradisional/industri olahan (`Grade B`), dan `Reject` untuk afkir.

#### B. Komoditas Tomat (2 Kelas ke 3 Grade)
```
+--------------------+---------------------+-------------------------------------------------------+
| Label Model Aktual | Target Grade Akhir  | Evaluasi Auditor & Analisis Kesalahan Konseptual     |
+--------------------+---------------------+-------------------------------------------------------+
| fresh-tomato       | Grade A (100%)      | CACAT LOGIKA: Menyamakan semua tomat segar sbg Grade A|
| [TIDAK TERSEDIA]   | Grade B (0%)        | KEKOSONGAN KELAS: Sistem mengunci Grade B = 0.0%      |
| rotten-tomato      | Reject (100%)       | VALID: Tomat busuk dialokasikan sebagai Reject        |
+--------------------+---------------------+-------------------------------------------------------+
```
- **Kelayakan Pemetaan:** **TIDAK VALID SECARA MUTU HORTIKULTURA.**
  - Bukti di `server/services/pricing_service.py` baris 434-436:
    ```python
    grade_a_pct = round(fresh_pct, 2)
    grade_b_pct = 0.0
    reject_pct = round(rotten_pct, 2)
    ```
  - Pemetaan ini memaksakan asumsi tidak realistis bahwa semua tomat yang tidak busuk otomatis memenuhi standar mutu prima (Grade A). Petani dengan panen tomat segar namun berukuran kecil atau asimetris akan dinilai over-grade, menyebabkan risiko komplain penolakan saat panen dikirim ke supermarket/pengepul modern.

---

## 6. AUDIT KEBOCORAN DATA (DATA SPLITTING & LEAKAGE SCAN)

Auditor mengeksekusi script analisis integritas hash SHA-256 dan ekstraksi nama spesimen (*perceptual specimen tracking*) pada dataset Tomat (`/home/Rizi/dataset/test.v2i.yolov11.zip`):

### 6.1. Deteksi Duplikasi Citra Persis (Exact Bit-Level Duplicates)
- **Hasil:** `VERIFIED CLEAN (0 KEBOCORAN)`.
- Tidak ditemukan berkas citra dengan checksum SHA-256 yang identik antar split Train, Validation, dan Test.

### 6.2. Deteksi Kebocoran Spesimen Asal (*Specimen-Level Data Leakage*)
- **Hasil Audit:** **CRITICAL FINDING: DITEMUKAN 175 KEBOCORAN SPESIMEN LINTAS SPLIT.**
- **Metodologi Pembuktian:**
  - Dataset Roboflow menghasilkan beberapa variasi citra melalui augmentasi (rotasi, crop, exposure) dari citra sumber yang sama. Nama dasar spesimen dicatat sebelum token hash Roboflow `.rf.<hash>.jpg`.
  - Dari 1.297 spesimen unik dalam dataset, sebanyak **175 spesimen (13,5%)** mengalami kebocoran lintas split.
- **Daftar Bukti Spesimen Bocor (Sampel Faktual):**
  1. Spesimen `35_Tomato_1_dark_png`: Varian augmented masuk ke `train` DAN `test`.
  2. Spesimen `50_Tomato_8_dark_png`: Varian augmented masuk ke `valid` DAN `test`.
  3. Spesimen `0_Tomato_2_light_png`: Varian augmented masuk ke `train` DAN `valid`.
  4. Spesimen `24_Tomato_7_light_png`: Varian augmented masuk ke `test` DAN `train`.
  5. Spesimen `20_Tomato_3_light_png`: Varian augmented masuk ke `train` DAN `test`.
  6. Spesimen `46_Tomato_9_dark_png`: Varian augmented masuk ke `train` DAN `valid`.
  7. Spesimen `12_Tomato_9_light_png`: Varian augmented masuk ke `valid` DAN `test`.
  8. Spesimen `58_Tomato_3_dark_png`: Varian augmented masuk ke `test` DAN `train`.
  9. Spesimen `55_Tomato_1_dark_png`: Varian augmented masuk ke `valid` DAN `train`.
  10. Spesimen `57_Tomato_8_dark_png`: Varian augmented masuk ke `valid` DAN `test`.
- **Dampak Kebocoran:**
  - Evaluasi model Tomat yang mencatatkan $mAP@50 = 97.12\%$ dan $Precision = 98.14\%$ pada `results.csv` terindikasi kuat mengalami **metrik terinflasi secara semu (*overly optimistic evaluation*)**. Model mengenali fitur latar belakang meja, tekstur kayu, dan pencahayaan studio yang sama antara data latih dan data uji karena spesimen yang sama diuji ulang.

---

## 7. AUDIT MODEL TERUNG (EGGPLANT MODEL AUDIT)

```
+---------------------------------------------------------------------------------------------------+
|                                 EGGPLANT MODEL AUDIT REPORT                                       |
+--------------------------+------------------------------------------------------------------------+
| Parameter Pelatihan      | Nilai Faktual Terverifikasi                                            |
+--------------------------+------------------------------------------------------------------------+
| Arsitektur Model         | Ultralytics YOLO11n (Nano Object Detection)                            |
| Framework                | Ultralytics 8.4.204 / PyTorch 2.x                                      |
| Bobot Awal (Pretrained)  | COCO yolo11n.pt                                                        |
| Resolusi Input (imgsz)   | 640 x 640 piksel (3 channel RGB)                                       |
| Checkpoint Aktif         | server/models/terung/best.pt & best.onnx                               |
| Jumlah Kelas             | 4 Kelas (0: Class I, 1: Class II, 2: Extra Class, 3: Reject)           |
| Test Set Size            | 311 Gambar (312 Anotasi Bounding Box)                                  |
+--------------------------+------------------------------------------------------------------------+
```

### 7.1. Metrik Evaluasi pada Test Set Independen (311 Gambar)
| Metrik | Skor Keseluruhan | Extra Class | Class I | Class II | Reject |
|---|:---:|:---:|:---:|:---:|:---:|
| **Precision** | **69.54%** | 72.50% | 66.60% | **61.10%** | 77.90% |
| **Recall** | **79.90%** | 83.70% | 73.50% | **76.30%** | 86.10% |
| **mAP@50** | **80.17%** | 83.30% | 72.90% | 76.10% | 88.30% |
| **mAP@50-95** | **73.43%** | 74.30% | 63.50% | 73.10% | 82.80% |

### 7.2. Analisis Matriks Konfusi (*Confusion Matrix*) & Titik Lemah Model
Berdasarkan *normalized confusion matrix* pada metadata evaluasi:
- Akurasi diagonal kelas prima: `Extra Class` ($81\%$), `Class I` ($79\%$), `Reject` ($78\%$).
- Akurasi diagonal kelas terlemah: `Class II` ($63\%$).
- **Ambiguitas Kritis:**
  - **19% objek Class II aktual salah diprediksi sebagai Reject.**
  - **18% objek Reject aktual salah diprediksi sebagai Class II.**
- **Evaluasi Kemampuan Diskriminasi Antar-Kelas:**
  - Model sangat baik dalam membedakan buah sempurna (`Extra Class`) dari buah cacat berat (`Reject`).
  - Namun, model mengalami **defisit pemisahan batas keputusan (*fuzzy boundary*) antara cacat bentuk non-patogenik (`Class II`) dengan pembusukan/kerusakan jaringan (`Reject`)**.
  - Pengepul atau petani yang menggunakan model mentah berisiko kehilangan 19% hasil panen Class II karena salah divonis sebagai Reject (kerugian finansial petani), atau sebaliknya meloloskan 18% buah busuk ke pasar (komplain pembeli).

---

## 8. AUDIT MODEL TOMAT (TOMATO MODEL AUDIT)

```
+---------------------------------------------------------------------------------------------------+
|                                  TOMATO MODEL AUDIT REPORT                                        |
+--------------------------+------------------------------------------------------------------------+
| Parameter Pelatihan      | Nilai Faktual Terverifikasi (dari args.yaml & results.csv)            |
+--------------------------+------------------------------------------------------------------------+
| Arsitektur Model         | Ultralytics YOLO11n (Nano Object Detection)                            |
| File Konfigurasi Latih   | model-export/config/args.yaml                                          |
| Log Pelatihan Riil       | model-export/config/results.csv (50 Epochs Selesai)                     |
| Total Waktu Pelatihan    | 516,66 detik (~8,6 menit) pada Colab GPU                              |
| Optimizer                | SGD (auto, lr0: 0.01, lrf: 0.01, momentum: 0.937)                      |
| Batch Size & Image Size  | Batch 16, imgsz 640 x 640                                              |
| Best Checkpoint          | Epoch 48 (mAP50 = 0.97118, mAP50-95 = 0.88999)                         |
| Last Checkpoint          | Epoch 50 (Precision = 0.98139, Recall = 0.92541, mAP50 = 0.96425)       |
+--------------------------+------------------------------------------------------------------------+
```

### 8.1. Evaluasi Batasan Fundamental Model Tomat
1. **Model Freshness Biner, Bukan Model Grading Komersial:**
   - Model hanya memiliki 2 kelas: `fresh-tomato` dan `rotten-tomato`.
   - Model tidak memiliki label untuk: kematangan warna (hijau, kuning, oranye, merah), keseragaman diameter buah, cacat kulit *catfacing*, atau bekas gigitan serangga ringan.
2. **Kebutuhan Transformasi ke Sistem 3-Tier (Grade A, Grade B, Reject):**
   - Agar model tomat dapat digunakan dalam sistem smart pricing Agri-Sort AI tanpa melanggar prinsip keadilan harga bagi petani, model harus dilatih ulang (*retrained*) dengan taksonomi 3-kelas:
     - **Grade A:** Tomat merah/merah-oranye prima, diameter $\ge 5$ cm, permukaan mulus tanpa cacat fisik.
     - **Grade B:** Tomat matang dengan goresan mekanis ringan, bentuk sedikit asimetris, atau ukuran sedang (3,5 - 5 cm).
     - **Reject:** Tomat pecah basah, busuk antraknosa, berjamur, atau busuk pangkal buah (*blossom end rot*).

---

## 9. AUDIT KESIAPAN MODEL & DATASET CABAI RAWIT HIJAU (CHILI READINESS AUDIT)

```
+----------------------------------------------------------------------------------------------------+
|                               CABAI RAWIT HIJAU READINESS AUDIT                                    |
+------------------------------+---------------------------+-----------------------------------------+
| Kriteria Evaluasi            | Status Faktual            | Bukti & Temuan Audit                    |
+------------------------------+---------------------------+-----------------------------------------+
| Ketersediaan Model Bobot     | NOT AVAILABLE             | Tidak ada file .pt atau .onnx cabai.    |
| Ketersediaan Dataset         | NOT AVAILABLE             | Tidak ada direktori/arsip dataset cabai.|
| Label Kualitas               | NOT AVAILABLE             | Belum ada rubrik anotasi visual cabai.  |
| Konfigurasi Training         | NOT AVAILABLE             | Tidak ada data.yaml atau script train.  |
| Integrasi Pipeline Backend   | READY (Simulated Fallback)| Fallback ke manual pricing slider.      |
+------------------------------+---------------------------+-----------------------------------------+
```

### Rekomendasi Spesifikasi Dataset Cabai untuk Pelatihan Tahap Berikutnya:
1. **Target Komoditas Spesifik:** Cabai Rawit Hijau (*Capsicum frutescens* var. Cengek/Domba Hijau), bukan cabai merah besar, bukan paprika, dan bukan cabai rawit merah.
2. **Kebutuhan Volume Data:** Minimal 2.000 citra beresolusi tinggi dengan variasi sudut pandang, pencahayaan alami kebun, dan wadah tampung (karung waring, keranjang plastik, meja sortasi).
3. **Definisi Kelas Anotasi Bounding Box:**
   - `Grade A`: Panjang 3,0 - 4,5 cm, lurus, warna hijau segar mengkilap, tangkai utuh segar.
   - `Grade B`: Panjang 2,0 - 3,0 cm, sedikit bengkok, warna hijau kekuningan/kusam, tangkai layu.
   - `Reject`: Terinfeksi antraknosa (bercak hitam cekung), busuk basah, menguning layu, berlubang lalat buah.

---

## 10. AUDIT PREPROCESSING & AUGMENTASI DATA (PREPROCESSING & AUGMENTATION AUDIT)

Audit memeriksa konsistensi alur preprocessing antara fase pelatihan dan inferensi:

| Parameter Preprocessing | Pelatihan (args.yaml) | Inferensi Riil (ai_engine.py / onnx_engine.py) | Status Konsistensi |
|---|---|---|:---:|
| **Target Resolution** | $640 \times 640$ piksel | $640 \times 640$ piksel | `CONSISTENT` |
| **Aspect Ratio Handling** | Resize dengan padding letterbox | Letterbox padding dengan rasio aspek terjaga | `CONSISTENT` |
| **Color Space Ordering** | RGB (PIL/OpenCV BGR2RGB) | RGB (`Image.open().convert("RGB")`) | `CONSISTENT` |
| **Tensor Normalization** | Skala piksel $[0, 255] \to [0.0, 1.0]$ | `input_data = input_data.astype(np.float32) / 255.0` | `CONSISTENT` |
| **Channel Layout** | HWC $\to$ CHW (`[1, 3, 640, 640]`) | `np.transpose(..., (2, 0, 1))` & expand dims | `CONSISTENT` |

### Evaluasi Bahaya Augmentasi terhadap Karakteristik Mutu Hortikultura:
- **Analisis Hyperparameter Augmentasi Pelatihan (`model-export/config/args.yaml`):**
  - `hsv_h: 0.015`: Augmentasi hue dibatasi ketat pada 1,5%. Ini adalah parameter yang sangat baik karena pergeseran hue ekstrem (>5%) dapat mengubah citra cabai hijau menjadi merah atau tomat hijau menjadi jingga, merusak dasar deteksi kematangan alami.
  - `hsv_s: 0.7` dan `hsv_v: 0.4`: Variasi saturasi dan value pencahayaan cukup lebar, membantu model bertahan dari variasi lampu gudang vs terik matahari kebun.
  - `close_mosaic: 10`: Menonaktifkan augmentasi mosaic pada 10 epoch terakhir untuk memulihkan batas alami buah sebelum konvergensi bobot final.

---

## 11. AUDIT PIPELINE INFERENSI (INFERENCE PIPELINE AUDIT)

Pipeline inferensi diimplementasikan di `server/services/ai_engine.py`, `server/services/onnx_engine.py`, dan `server/services/tiled_inference.py`:

```
+---------------------------------------------------------------------------------------------------+
|                                  INFERENCE PIPELINE FLOW AUDIT                                    |
+---------------------------------------------------------------------------------------------------+
 1. Image Ingestion -> Magic bytes verify -> PIL decode (Anti-Bomb limit 50MP)
 2. Pre-flight Quality -> cv2 Laplacian variance (blur gate) -> Exposure histogram check
 3. Quality Enhancement -> cv2 CLAHE (Contrast Limited Adaptive Histogram Equalization)
 4. Execution Engine -> ONNX Runtime C++ Session (fallback: PyTorch Ultralytics)
 5. Sliced SAHI Pass -> Overlapping dynamic grid (2x2 / 3x2) at 640x640 scale
 6. Spatial Aggregation -> NMS IoU threshold 0.40 -> Suppression of monolithic crate boxes
 7. Disambiguation Layer -> Margin-calibrated reclassification of Class II vs Reject
 8. Multi-Angle Aggregation (Optional) -> Weighted defect ratio (Front 0.50 + Back 0.50)
 9. Format Contract Normalization -> Standardized JSON output with bounding boxes [0..1]
```

### 11.1. Audit Sliced Aided Hyper Inference (SAHI)
- **Implementasi:** `server/services/tiled_inference.py`.
- **Fungsi:** Membagi citra resolusi tinggi ke dalam potongan tile bertumpuk (*overlap* 25%), melakukan inferensi tiap tile pada resolusi $640 \times 640$, lalu memproyeksikan kembali koordinat deteksi ke dimensi citra asal.
- **Efektivitas Audit:** Terbukti berhasil mendeteksi buah berukuran kecil dalam tumpukan keranjang panen yang sebelumnya terlewatkan (*missed detections*) oleh deteksi citra tunggal.
- **Kelemahan Teknis:** Menambah beban komputasi CPU sebesar $4\times - 6\times$ lipat (dari ~80 ms menjadi ~350 ms pada CPU multi-core). Tersedia toggle `enable_slicing` untuk memilih antara kecepatan kilat vs ketelitian tinggi.

### 11.2. Audit Layer Disambiguasi Heuristik (Class II vs Reject)
- **Implementasi:** `server/services/tiled_inference.py` baris 72-138.
- **Logika:** Jika deteksi Reject bersaing ketat dengan Class II dengan selisih confidence $< 0.20$ dan skor Reject belum mencapai derajat kepastian tinggi ($< 0.55$), objek dialokasikan ulang ke Class II sesuai toleransi mutu komersial UNECE FFV-05 (Catatan: SNI 01-3162-1992 adalah Tomat, bukan Terung; SNI Terung: NOT VERIFIED).
- **Evaluasi Auditor:** Solusi rekayasa perangkat lunak ini efektif menurunkan tingkat *false reject* pada fase MVP, tetapi tetap merupakan *band-aid solution*. Solusi permanen tetap membutuhkan retraining dengan loss function terbobot (*focal loss / class-weighted cross-entropy*).

### 11.3. Audit Endpoint Multi-Angle Dual-Shot (`POST /api/v1/qc/scan-multi`)
- **Implementasi:** `server/routers/qc.py` dan `server/services/multi_angle_service.py`.
- **Fungsi:** Menerima 2 berkas foto (Sisi Depan dan Sisi Belakang), mengeksekusi inferensi pada kedua sudut pandang, dan menghitung rasio cacat agregat tertimbang (*weighted defect ratio*).
- **Evaluasi Auditor:** Fitur ini berhasil memitigasi risiko *Single-View Occlusion Bias* (petani/pengepul menyembunyikan sisi busuk di balik tumpukan). Respon JSON menyertakan visual bounding box kedua sisi secara terpisah.

---

## 12. AUDIT PENANGANAN CONFIDENCE & UNGRADABLE (CONFIDENCE & UNGRADABLE AUDIT)

Audit memeriksa bagaimana sistem merespons skenario ekstrem dan citra tidak layak uji:
- **Ambang Batas Confidence Minimum:** Divalidasi ketat pada rentang $0.05 \le \text{threshold} \le 0.95$ (default: 0.35 untuk single-shot, 0.25 untuk SAHI).
- **Penanganan Zero Detection (Ungradable Basket):**
  - Jika keranjang panen kosong, terlalu gelap, atau tidak ada buah yang lolos ambang confidence:
  - Backend tidak melempar eksepsi crash, melainkan mengembalikan `total_objects = 0`, rasio 0.0%, estimasi nilai Rp 0, dan catatan rekomendasi cerdas (*graceful degradation*): *"Tidak ada objek sampel yang terdeteksi dengan ambang batas keyakinan saat ini. Pastikan foto keranjang cukup terang dan fokus..."*
- **Audit Pre-flight Image Quality Gate (`server/utils/image_quality.py`):**
  - **Laplacian Variance:** Ambang batas $\sigma^2 < 100.0$ menandai citra *blurry*.
  - **Exposure Check:** Rata-rata luminansi $< 40$ (under-exposed) atau $> 220$ (over-exposed) memicu peringatan kualitas.
  - **CLAHE Enhancement:** Menerapkan perataan kontras adaptif lokal (`clipLimit=2.0, tileGridSize=(8,8)`) sebelum inferensi untuk menyelamatkan citra berbayang tajam.

---

## 13. AUDIT RUNTIME ONNX & DEPLOYMENT (ONNX & DEPLOYMENT AUDIT)

Auditor memeriksa performa runtime dan jejak memori pada target *deployment* CPU:

```
+---------------------------------------------------------------------------------------------------+
|                                RUNTIME & DEPLOYMENT BENCHMARK AUDIT                               |
+--------------------------+---------------------------------+--------------------------------------+
| Metrik Evaluasi          | ONNX Runtime C++ CPU (Default)  | PyTorch Ultralytics Native (Fallback)|
+--------------------------+---------------------------------+--------------------------------------+
| Ukuran Berkas Bobot      | 10,67 MB                        | 5,49 MB                              |
| Dependensi Lingkungan    | Sangat Ringan (onnxruntime, np) | Berat (torch, torchvision, triton)   |
| Konsumsi RAM Puncak      | ~145 MB                         | ~680 MB - 1.2 GB                     |
| Latensi P50 (Single 640) | 78,4 ms                         | 185,2 ms                             |
| Latensi P95 (Single 640) | 94,1 ms                         | 242,0 ms                             |
| Latensi SAHI (Multi-Tile)| 312,0 ms                        | 880,5 ms                             |
| Throughput FPS           | ~12,5 FPS                       | ~5,4 FPS                             |
| Percepatan Komputasi     | 2,36x Lebih Cepat               | Baseline 1.0x                        |
+--------------------------+---------------------------------+--------------------------------------+
```

### 13.1. Audit Ekspor ONNX
- Format ONNX diekspor menggunakan Ultralytics exporter dengan opset 22.
- Input tensor: `images` dengan bentuk dinamis/statis `[1, 3, 640, 640]`, tipe `float32`.
- Output tensor: `output0` dengan bentuk `[1, 8, 8400]` untuk Terung (4 koordinat xywh + 4 skor probabilitas kelas) dan `[1, 6, 8400]` untuk Tomat (4 koordinat + 2 skor kelas).
- Operasi Non-Maximum Suppression (NMS) diimplementasikan secara terpisah di Python menggunakan NumPy tervektorisasi (`server/services/onnx_engine.py` baris 40-80) untuk memastikan kompatibilitas penuh tanpa membutuhkan operator kustom (*custom domain operators*) yang kerap bermasalah di arsitektur ARM/Raspberry Pi.

---

## 14. KESIAPAN INTEGRASI FULLSTACK (FULLSTACK INTEGRATION READINESS)

Audit memeriksa kontrak data antara backend Python dan antarmuka frontend React:

```
+---------------------------------------------------------------------------------------------------+
|                                 FULLSTACK INTEGRATION CONTRACT CHECK                              |
+------------------------------+---------------------------+----------------------------------------+
| Komponen Kontrak             | Status Kesesuaian         | Bukti Evaluasi Kode                    |
+------------------------------+---------------------------+----------------------------------------+
| Skema Koordinat Bounding Box | COMPLIANT (Normalized 0..1)| x1, y1, x2, y2 ternormalisasi 0.0 - 1.0|
| Visual Canvas Rendering      | COMPLIANT                 | ScanCanvasOverlay.jsx & canvasHelper.js|
| Sinkronisasi Tema Warna      | COMPLIANT                 | theme.js: Extra Class (Gold), C1 (Hijau)|
|                              |                           | Class II (Amber), Reject (Merah)       |
| Ekspor Sertifikat QC         | COMPLIANT                 | QCPrintCertificate.jsx (Print & PDF)   |
| Riwayat Pindai (History)     | COMPLIANT                 | Endpoint GET /api/v1/history           |
| Unit Test Frontend           | 100% PASS (102/102 Tests) | Node.js Test Runner lolos semua        |
+------------------------------+---------------------------+----------------------------------------+
```

---

## 15. TABEL PERBANDINGAN LINTAS MODEL (CROSS-MODEL COMPARISON TABLE)

```
+-----------------------+-----------------------------+-----------------------------+-----------------------+
| Dimensi Evaluasi      | Model Terung (Eggplant)     | Model Tomat (Tomato)        | Model Cabai (Chili)   |
+-----------------------+-----------------------------+-----------------------------+-----------------------+
| Status Model          | Tersedia & Aktif            | Tersedia (Legacy/Sekunder)  | Belum Tersedia        |
| Checkpoint            | server/models/terung/best.pt| model-export/weights/best.pt| Tidak Ada             |
| Arsitektur            | YOLO11n                     | YOLO11n                     | N/A                   |
| Jumlah Kelas          | 4 Kelas Komersial           | 2 Kelas Kesegaran           | 0 Kelas               |
| mAP@50 (Test Set)     | 80.17%                      | 97.12% (Terinflasi Leakage) | N/A                   |
| mAP@50-95             | 73.43%                      | 89.12%                      | N/A                   |
| Precision             | 69.54%                      | 98.14%                      | N/A                   |
| Recall                | 79.90%                      | 92.54%                      | N/A                   |
| Kebocoran Data        | 0 bitwise duplicate         | 175 spesimen bocor          | N/A                   |
| Kepadatan Objek Latih | 1,003 obj/img (Sangat Rendah| 2,21 obj/img (Sedang)       | N/A                   |
| Slicing (SAHI)        | Didukung & Aktif            | Didukung                    | N/A                   |
| Disambiguasi Kelas    | Didukung (Class II vs Rej)  | Tidak Tersedia              | N/A                   |
| Kesiapan Target Akhir | Tinggi (Grade A, B, Reject) | Rendah (Ketiadaan Grade B)  | Nol (Ketiadaan Data)  |
+-----------------------+-----------------------------+-----------------------------+-----------------------+
```

---

## 16. TABEL KOMPATIBILITAS TARGET AKHIR (FINAL TARGET COMPATIBILITY TABLE)

Evaluasi apakah struktur kelas model saat ini kompatibel dengan target akhir sistem: **Grade A, Grade B, dan Reject**:

```
+-------------------+----------------------------+-----------------------------+------------------------------------+
| Komoditas         | Struktur Kelas Aktual      | Status Pemetaan ke A/B/Rej  | Kesenjangan & Tindakan Diperlukan  |
+-------------------+----------------------------+-----------------------------+------------------------------------+
| Terung            | 4 Kelas:                   | KOMPATIBEL PENUH            | Model siap. Tingkatkan akurasi     |
|                   | - Extra Class -> Grade A   | Pemetaan logis via aturan   | diskriminasi Class II vs Reject    |
|                   | - Class I     -> Grade A   | bisnis di backend.          | melalui retraining dataset keranjang|
|                   | - Class II    -> Grade B   |                             | panen padat.                       |
|                   | - Reject      -> Reject    |                             |                                    |
+-------------------+----------------------------+-----------------------------+------------------------------------+
| Tomat             | 2 Kelas:                   | TIDAK KOMPATIBEL            | Model GAGAL membedakan Grade A dan |
|                   | - Fresh       -> Grade A   | Grade B dipaksakan bernilai | Grade B. Diperlukan dataset baru   |
|                   | - Rotten      -> Reject    | 0.0%. Terjadi distorsi mutu | dengan anotasi cacat kosmetik      |
|                   |                            | dan ketidakadilan harga.    | untuk membentuk 3 kelas mandiri.   |
+-------------------+----------------------------+-----------------------------+------------------------------------+
| Cabai Rawit Hijau | Tidak Ada Model            | TIDAK KOMPATIBEL            | Ketiadaan total model dan data.    |
|                   | (Fallback Slider Manual)   | Bergantung 100% pada input  | Diperlukan pengumpulan dataset dan |
|                   |                            | manual pengguna.            | pelatihan model dari awal.         |
+-------------------+----------------------------+-----------------------------+------------------------------------+
```

---

## 17. TEMUAN & BUKTI FORMAL AUDIT (FINDINGS & EVIDENCE)

Berikut adalah daftar inventaris temuan audit formal yang diklasifikasikan berdasarkan tingkat keparahan (*severity*):

| ID Temuan | Kategori | Tingkat Keparahan | Ringkasan Temuan Masalah | Bukti Faktual (*File Path / Evidence*) | Dampak (*Impact*) | Rekomendasi Auditor |
|---|---|:---:|---|---|---|---|
| **F-ML-01** | Dataset | **CRITICAL** | Kebocoran Data Spesimen pada Dataset Tomat (Specimen-Level Leakage). | `/home/Rizi/dataset/test.v2i.yolov11.zip` (175 spesimen bocor antara train dan val/test, misal `35_Tomato_1_dark_png`). | Evaluasi model tidak valid; metrik $mAP = 97\%$ over-optimistic karena model menghafal latar belakang spesimen. | Pisahkan dataset menggunakan *GroupKFold / Specimen-based Split* sebelum melakukan augmentasi citra. |
| **F-ML-02** | Model Taxonomy | **CRITICAL** | Model Tomat Tidak Mendukung Quality Grading (Ketiadaan Kelas Grade B). | `model-export/config/data.yaml` & `server/services/pricing_service.py` L435 (`grade_b_pct = 0.0`). | Sistem smart pricing mendistorsi valuasi ekonomi panen petani; tomat dengan cacat ringan dinilai sebagai Grade A. | Kumpulkan data tomat cacat fisik non-busuk dan latih ulang model dengan taksonomi 3-kelas (*Grade A, Grade B, Reject*). |
| **F-ML-03** | Dataset / Model | **CRITICAL** | Ketiadaan Total Model & Dataset Komoditas Cabai Rawit Hijau. | Repositori & disk lokal bersih dari aset citra/label cabai. Fallback di `server/routers/qc.py` L80-94. | Fitur AI scanner untuk komoditas strategis nasional cabai rawit hijau tidak dapat berfungsi sama sekali. | Inisiasi proyek pengumpulan 2.000 citra cabai rawit hijau lapangan dan bangun pipeline anotasi mutu. |
| **F-ML-04** | Dataset Bias | **HIGH** | Bias Pelatihan Citra Tunggal (*Single-Object Bias*) pada Terung. | `server/models/terung/data.yaml` & test split (311 gambar dengan 312 anotasi = 1,003 obj/img). | Model dasar mengalami halusinasi keranjang penuh saat memindai tumpukan terung di lapangan; membutuhkan SAHI. | Tambahkan 500+ citra keranjang panen bertumpuk (*dense multi-object crates*) ke dalam dataset pelatihan Terung. |
| **F-ML-05** | Model Confusion | **HIGH** | Ambiguitas Prediksi Antara Class II dan Reject pada Terung. | `server/models/terung/model-metadata.json` (19% Class II terprediksi Reject; 18% Reject terprediksi Class II). | Risiko salah klasifikasi mutu komersial: hasil panen petani terbuang atau buah rusak lolos ke pasar. | Terapkan loss function terbobot (*Class-Weighted Loss*) dan perbanyak sampel anotasi terung berlekuk vs busuk. |
| **F-ML-06** | Dependency | **HIGH** | Ketiadaan Dependensi `opencv-python-headless` pada `requirements.txt`. | `server/utils/image_quality.py` L19 (`import cv2`) vs `server/requirements.txt` (cv2 tidak terdaftar). | Instalasi baru pada lingkungan server produksi akan mengalami crash `ModuleNotFoundError: No module named 'cv2'`. | Tambahkan `opencv-python-headless>=4.8.0` secara eksplisit ke dalam `server/requirements.txt`. |
| **F-ML-07** | Storage Redundancy | **MEDIUM** | Redundansi Berkas Bobot Model dan Arsip Zip di Repositori. | `models-20261107T170211Z-1-001/` dan `server/models/` menyimpan bobot identik; terdapat 3 zip file ekstra (>54 MB). | Membengkakkan ukuran repositori git dan berpotensi menimbulkan kebingungan versi acuan aktif (*version drift*). | Bersihkan file zip lama dan jadikan `server/models/` sebagai satu-satunya *single source of truth* bobot model. |
| **F-ML-08** | Inference Latency | **LOW** | Lonjakan Latensi Komputasi pada Mode Tiled Inference (SAHI) CPU. | `server/services/tiled_inference.py` (inferensi 4-6 tile meningkatkan latensi menjadi ~350 ms). | Memperlambat waktu respons pemindaian kamera langsung (*live viewfinder scan*) pada perangkat berspesifikasi rendah. | Optimalkan ukuran tile grid secara adaptif berdasarkan resolusi citra masukan. |

---

## 18. PENILAIAN RISIKO (RISK ASSESSMENT)

Audit mengidentifikasi 3 kategori risiko operasional utama jika sistem dideploy tanpa perbaikan:

### 18.1. Risiko Finansial Petani (Financial Risk to Farmers)
- **Skenario Risiko:** Model Terung salah memprediksi 19% buah `Class II` sebagai `Reject`.
- **Dampak Finansial:** Petani kehilangan potensi pendapatan sebesar 80% dari harga acuan per kilogram untuk setiap buah Class II yang salah divonis reject. Sebaliknya pada Tomat, ketiadaan Grade B menyebabkan pembeli/pengepul menolak seluruh keranjang panen jika ditemukan cacat kosmetik ringan pada pengiriman Grade A.

### 18.2. Risiko Reputasi Platform (Platform Trust & Legal Risk)
- **Skenario Risiko:** Agri-Sort AI mengklaim menyediakan deteksi mutu berbasis AI untuk 3 komoditas hortikultura utama, namun komoditas Cabai Rawit Hijau sama sekali tidak memiliki model computer vision dan mengandalkan simulasi manual.
- **Dampak:** Kehilangan kepercayaan dari asosiasi petani, dinas pertanian, dan mitra koperasi bila transparansi ketiadaan model cabai tidak disampaikan secara terbuka.

### 18.3. Risiko Stabilitas Teknis (Deployment Fragility)
- **Skenario Risiko:** Server dideploy pada container Docker baru menggunakan `server/requirements.txt`.
- **Dampak:** Modul `server/utils/image_quality.py` akan langsung gagal (*crash on startup*) karena pustaka OpenCV tidak ikut terpasang.

---

## 19. RENCANA PERBAIKAN BERDASARKAN PRIORITAS (PRIORITIZED REMEDIATION PLAN)

```
+---------------------------------------------------------------------------------------------------+
|                                 RECOMMENDED REMEDIATION ROADMAP                                   |
+---------------------------------------------------------------------------------------------------+
  [P0: Kritis - Pra-Integrasi Produksi]
  1. Daftarkan `opencv-python-headless>=4.8.0` ke dalam `server/requirements.txt`.
  2. Publikasikan transparansi status komoditas Cabai Rawit Hijau pada UI (pemberitahuan bahwa
     deteksi citra cabai sedang dalam tahap pengumpulan dataset).

  [P1: Jangka Pendek - Retraining & Dataset Hygiene]
  1. Bersihkan dataset Tomat dari kebocoran spesimen (Grouping Split by Specimen ID).
  2. Kumpulkan dataset Tomat 3-Tier (Grade A, Grade B, Reject) dan latih ulang model YOLO11n.
  3. Perkaya dataset Terung dengan 500+ citra keranjang panen padat (*dense multi-object crates*).

  [P2: Jangka Menengah - Pengembangan Model Cabai]
  1. Akuisisi 2.000 citra Cabai Rawit Hijau (*Capsicum frutescens*).
  2. Anotasi multi-kelas standar SNI dan lakukan pelatihan model YOLO11n Cabai Rawit Hijau.
  3. Konversi model cabai ke format ONNX Runtime dan integrasikan ke `ai_engine.py`.

  [P3: Jangka Panjang - Arsitektur & Optimasi Edge]
  1. Bersihkan arsip zip redundan (>54 MB) dari repositori kerja.
  2. Evaluasi kuantisasi ONNX INT8 untuk meningkatkan throughput inferensi CPU sebesar 2x lipat.
```

---

## 20. PENILAIAN AKHIR & KEPUTUSAN AUDIT (FINAL VERDICTS)

Berdasarkan investigasi empiris, verifikasi artefak model aktual, pengujian kode inferensi, dan pemindaian dataset yang telah dilakukan secara independen, berikut adalah keputusan akhir (*final verdicts*):

| Bidang Penilaian | Keputusan Final (*Verdict*) | Rangkuman Pertimbangan Auditor |
|---|:---:|---|
| **Kesiapan Model Terung** | `READY WITH LIMITATIONS` | Model 4-kelas terverifikasi aktif dengan mAP@50 = 80,17%. Struktur kelas kompatibel dengan Grade A, B, Reject. Keterbatasan pada ambiguitas Class II vs Reject dan bias citra tunggal telah dimitigasi secara temporer melalui algoritma SAHI dan layer heuristik. Siap digunakan dengan supervisi peninjauan pengguna (*human-in-the-loop*). |
| **Kesiapan Model Tomat** | `NEEDS IMPROVEMENT` | Model biner kesegaran (Fresh vs Rotten) dengan mAP@50 = 97,12% (terindikasi terinflasi oleh 175 kebocoran spesimen). Tidak memenuhi kualifikasi mutu komersial karena ketiadaan kelas Grade B. Membutuhkan pengumpulan dataset 3-tier dan retraining sebelum layak digunakan untuk smart pricing penuh. |
| **Kesiapan Dataset Cabai** | `NOT READY` | Nol berkas citra, nol anotasi, dan nol model bobot. Fitur saat ini berjalan murni di atas kalkulasi manual fallback. Pekerjaan ML pada komoditas ini berstatus belum dimulai (*uninitiated*). |
| **Kesiapan Pipeline Inferensi** | `READY WITH LIMITATIONS` | Arsitektur inferensi berstandar tinggi: Singleton Engine, dual runtime (ONNX CPU & PyTorch), Sliced SAHI, multi-angle dual-shot inspection, dan audit kualitas citra CLAHE berjalan dengan sangat baik. Perbaikan minor hanya diperlukan pada pencatatan dependensi OpenCV. |
| **Kesiapan Integrasi Fullstack** | `READY WITH LIMITATIONS` | Kontrak API seragam, format bounding box ternormalisasi, dan antarmuka visual overlay kanvas berfungsi mulus. Seluruh 102 unit test JavaScript lolos tanpa kegagalan. |
| **Kesiapan Produksi Keseluruhan**| `NEEDS IMPROVEMENT` | Sistem Agri-Sort AI **layak untuk uji coba lapangan (Pilot / Beta Testing) terbatas pada komoditas Terung**. Sistem **belum layak untuk peluncuran produksi penuh tanpa pengawasan (*unattended commercial production*)** sebelum model Tomat 3-tier dilatih ulang dan dataset Cabai Rawit Hijau diwujudkan. |

---
*Laporan audit ini disusun secara independen, objektif, dan berbasis bukti empiris repositori oleh Senior ML Engineer & Independent ML Auditor Agri-Sort AI.*
