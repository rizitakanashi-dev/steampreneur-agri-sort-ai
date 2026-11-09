# AUDIT LAPORAN: FALSE POSITIVE & DUPLICATE DETECTION MODEL TOMAT
## Proyek: Agri-Sort AI

**Tanggal:** 9 November 2026  
**Status Audit:** READ-ONLY (Tanpa modifikasi kode, bobot model, konfigurasi, atau dataset)  
**Branch:** `feat/audit-tomato-fp-duplicate`  
**Auditor:** Senior Computer Vision & Machine Learning Engineer  

---

## 1. Executive Summary & Temuan Utama

Investigasi mendalam dilakukan untuk mereproduksi dan mengisolasi akar penyebab fenomena di mana **citra tomat yang secara visual hanya memuat 3 butir buah tomat menghasilkan 9 deteksi objek pada antarmuka aplikasi Agri-Sort AI**.

### Kesimpulan Inti
1. **Model Inti YOLO11n Sebenarnya Bekerja Normal pada Citra Penuh (Full Image):**  
   Ketika inferensi dijalankan pada citra utuh ($640 \times 640$) tanpa pemotongan tile, model menghasilkan **tepat 3 deteksi** dengan tingkat keyakinan sangat tinggi ($\ge 92.0\%$) yang selaras $100\%$ dengan ground truth visual.
2. **Inflasi Terjadi Sepenuhnya di Lapisan Sliced Inference (`tiled_inference.py`):**  
   Modul SAHI (Sliced Aided Hyper Inference) memotong citra resolusi standar $640 \times 640$ menjadi 13 tile (kombinasi grid $2 \times 2$ dan $3 \times 3$). Pemotongan ini membelah 3 tomat utuh menjadi fragmen-fragmen terpotong.
3. **Kegagalan Supresi Clustering NMS Akibat Dua Cacat Kritis:**
   - **Bug Typo Matematis pada `compute_iou` (Baris 35):** Formula menghitung `(box_a[3] - box_a[0])` alias $(y_2 - x_1)$ alih-alih $(y_2 - y_1)$. Pada objek di kuadran kanan atas (di mana $x_1 > y_2$), luas `box_a` dievaluasi bernilai $0.0$, merusak perhitungan overlap IoU.
   - **Asimetri Skala pada IoU Standar:** Fragmen buah kecil yang berada di dalam buah utuh memiliki $\text{IoU} < 0.40$ terhadap buah utuh karena luas gabungan (union) didominasi oleh ukuran buah utuh. Tanpa metrik penahanan (*Intersection-over-Minimum / IoM*), fragmen tersebut lolos dan dianggap sebagai tomat baru yang berdiri sendiri.
4. **Relaksasi Confidence Threshold Mengundang False Positive:**  
   Ambang batas keyakinan pada sub-tile diturunkan secara sepihak sebesar $-0.10$ (`sub_conf = 0.25` saat threshold = $0.35$), sehingga bayangan gelap di sudut keranjang terdeteksi sebagai tomat (`conf = 0.2695`).

---

## 2. Kasus Reproduksi (Reproduction Case)

### 2.1 Spesifikasi Citra Uji
- **File:** `train/images/freshTomato-245-_png.rf.fb61b4ea64c0447795be2b29e25e68ed.jpg`  
  (Tersedia dalam arsip dataset pelatihan `/home/Rizi/dataset/test.v2i.yolov11.zip`, identik secara hash visual dengan spesimen `freshTomato-197-` dan `freshTomato-86-`).
- **Dimensi Citra:** $640 \times 640$ piksel.
- **Jumlah Objek Visual Aktual (Ground Truth):** **3 butir tomat segar** berjajar vertikal dengan latar belakang permukaan gelap/keranjang.

### 2.2 Ground Truth Anotasi Visual
| Objek | Kelas | Bounding Box $[x_1, y_1, x_2, y_2]$ | Luas (px²) | Deskripsi Visual |
|---|---|---|---|---|
| **GT 1** | fresh-tomato | $[349.5, 47.8, 473.5, 282.2]$ | 29,078 | Tomat Atas |
| **GT 2** | fresh-tomato | $[390.5, 282.2, 502.5, 504.8]$ | 24,920 | Tomat Tengah |
| **GT 3** | fresh-tomato | $[310.8, 455.0, 428.2, 640.0]$ | 21,738 | Tomat Bawah |

---

## 3. Hasil Deteksi: Full Image vs. Sliced Inference (SAHI)

### 3.1 Uji Citra Penuh (Tanpa Slicing / Full Image Only)
Konfigurasi: `conf = 0.35`, `iou = 0.45`, `imgsz = 640`.
- **Hasil:** **3 deteksi** (100% presisi dan recall).
  - Deteksi A: `[308.1, 453.3, 429.8, 640.0]`, Conf: 0.9260 (Mencocoki GT 3, IoU = 0.956)
  - Deteksi B: `[385.8, 282.1, 504.8, 510.3]`, Conf: 0.9258 (Mencocoki GT 2, IoU = 0.944)
  - Deteksi C: `[348.1, 44.5, 473.1, 290.5]`, Conf: 0.9200 (Mencocoki GT 1, IoU = 0.939)

### 3.2 Uji Pipeline Lengkap dengan Sliced Inference Aktif (`tiled_inference.py`)
Konfigurasi: `confidence_threshold = 0.35`, `iou_threshold = 0.40`.
- **Hasil:** **9 deteksi** (terjadi inflasi sebanyak +6 deteksi palsu/duplikat).

---

## 4. Rincian 9 Bounding Box Hasil Inferensi

Tabel berikut membedah setiap bounding box dari 9 hasil yang dikirim backend ke antarmuka pengguna:

| Det ID | Class | Confidence | Bounding Box $[x_1, y_1, x_2, y_2]$ | Luas (px²) | IoU vs GT | IoM (Coverage) | Klasifikasi Temuan |
|:---:|:---:|:---:|:---:|:---:|:---:|:---:|:---|
| **1** | fresh-tomato | 0.9341 | $[389.0, 281.4, 505.3, 508.5]$ | 26,412 | 0.944 (GT 2) | 1.000 | **True Positive** (Tomat Tengah) |
| **2** | fresh-tomato | 0.9260 | $[308.1, 453.3, 429.8, 640.0]$ | 22,721 | 0.956 (GT 3) | 1.000 | **True Positive** (Tomat Bawah) |
| **3** | fresh-tomato | 0.9200 | $[348.1, 44.5, 473.1, 290.5]$ | 30,750 | 0.939 (GT 1) | 0.997 | **True Positive** (Tomat Atas) |
| **4** | fresh-tomato | 0.9112 | $[308.6, 455.1, 365.0, 637.5]$ | 10,287 | 0.447 (GT 3) | 0.961 | **Duplicate Detection** (Potongan kiri Tomat Bawah pada batas tile $x=365.0$) |
| **5** | fresh-tomato | 0.9081 | $[390.3, 384.0, 447.9, 506.8]$ | 7,073 | 0.277 (GT 2) | 0.980 | **Duplicate Detection** (Potongan Tomat Tengah pada tile grid $3 \times 3$) |
| **6** | fresh-tomato | 0.9078 | $[384.0, 192.0, 473.2, 292.0]$ | 8,920 | 0.269 (GT 1) | 0.902 | **Duplicate Detection** (Potongan Tomat Atas pada batas tile $y=192.0$) |
| **7** | fresh-tomato | 0.6565 | $[384.0, 542.5, 428.8, 640.0]$ | 4,368 | 0.198 (GT 3) | 0.987 | **Duplicate Detection** (Ujung bawah Tomat Bawah pada sub-tile) |
| **8** | fresh-tomato | 0.3548 | $[349.1, 56.2, 364.9, 232.6]$ | 2,787 | 0.093 (GT 1) | 0.975 | **Duplicate Detection** (Irisan vertikal selebar 15.8 px akibat potongan batas tile $x=365$) |
| **9** | fresh-tomato | 0.2695 | $[164.8, 437.9, 256.0, 640.0]$ | 18,432 | 0.000 | 0.000 | **False Positive** (Bayangan gelap / latar keranjang non-tomat di kuadran kiri bawah) |

### Ringkasan Kategorisasi:
- **True Positive:** 3 buah (Det 1, Det 2, Det 3) — merepresentasikan 3 tomat visual aktual.
- **Duplicate Detections (Pecahan Tile):** 5 buah (Det 4, Det 5, Det 6, Det 7, Det 8) — 90% s.d. 98% luas kotak berada di dalam salah satu dari ketiga tomat utama.
- **False Positive (Latar/Bayangan):** 1 buah (Det 9) — lolos akibat penurunan threshold keyakinan sub-tile ke 0.25.

---

## 5. Audit Jumlah Deteksi di Setiap Tahap Pipeline

Sesuai permintaan instruksi, berikut penelusuran jumlah kandidat dan deteksi pada setiap langkah dari citra masuk hingga diterima klien frontend:

| Tahap Pipeline | Jumlah Bounding Box | Keterangan Teknis |
|---|---:|---|
| **Raw Model Output** | **117,600** | 14 pass inferensi (1 pass citra penuh + 13 pass tile multi-scale). Tiap pass menghasilkan $8,400$ anchor prediksi $(1 \times 5 \times 8400)$. |
| **Setelah Confidence Filtering** | **179** | 31 anchor lolos pada citra penuh ($\ge 0.35$); 148 anchor lolos pada 13 tile ($\ge 0.25$). |
| **Setelah NMS (Per-Pass)** | **20** | Per-tile OpenCV NMSBoxes: 3 box pada citra penuh + 17 box dari seluruh potongan tile. |
| **Setelah SAHI Merge & Clustering** | **9** | Algoritma clustering spasial berbasis IoU gagal menggabungkan 5 fragmen buah dan 1 false positive ke 3 objek utama. |
| **Setelah Backend Aggregation** | **9** | Endpoint `/api/v1/qc/scan` (`qc.py`) membungkus array `detections` langsung ke respons JSON tanpa filter tambahan. |
| **Yang Diterima Frontend** | **9** | `QCResults.jsx` dan `ScanCanvasOverlay.jsx` menerima 9 elemen dan merender seluruh 9 bounding box pada canvas. |

*(Catatan: Jika fitur Multi-Angle diaktifkan pada kasus ini dengan hasil identik pada kedua sisi, frontend `multiAngleHelper.js` menggabungkan array kedua sudut sehingga total objek yang ditampilkan bertambah menjadi $9 + 9 = 18$).*

---

## 6. Investigasi Root Cause & Bukti Kode

### 6.1 Bukti 1: Typo Kritis Formula Luas Kotak pada `compute_iou`
- **File:** `server/services/tiled_inference.py`
- **Fungsi:** `compute_iou()`
- **Baris:** 35
```python
# KODE SAAT INI:
area_a = max(0.0, box_a[2] - box_a[0]) * max(0.0, box_a[3] - box_a[0])
area_b = max(0.0, box_b[2] - box_b[0]) * max(0.0, box_b[3] - box_b[1])
```
- **Analisis Bug:**  
  Variabel `box_a` memiliki format $[x_1, y_1, x_2, y_2]$. Pada baris 35, tinggi kotak `box_a` dihitung dengan `box_a[3] - box_a[0]`, yang secara matematis berarti $(y_2 - x_1)$, bukan $(y_2 - y_1)$.
- **Dampak Fatal:**  
  Untuk setiap objek yang terletak di paruh kanan atas citra di mana $x_1 > y_2$ (contohnya Deteksi 3: $x_1 = 348.1$, $y_2 = 290.5 \implies y_2 - x_1 = -57.6$), fungsi `max(0.0, ...)` menghasilkan nilai **0.0**. Akibatnya, `area_a = 0.0`. Hal ini membuat perhitungan `union_area` menjadi cacat atau mendekati nol, menghasilkan nilai IoU palsu (seperti IoU bernilai 790 atau mendekati 0), yang menggagalkan mekanisme clustering.

---

### 6.2 Bukti 2: Kegagalan Asimetri Skala pada IoU Standar (Fragmen vs Buah Utuh)
- **File:** `server/services/tiled_inference.py`
- **Fungsi:** `run_sliced_yolo_inference()`
- **Baris:** 291–305
```python
# KODE SAAT INI:
for item in sorted_candidates:
    matched = False
    for cl in clusters:
        if compute_iou(item["box"], cl["centroid_box"]) > iou_threshold:
            cl["items"].append(item)
            matched = True
            break
    if not matched:
        clusters.append({
            "centroid_box": item["box"],
            "items": [item],
        })
```
- **Analisis Masalah:**  
  IoU standar dirumuskan sebagai:
  $$\text{IoU}(A, B) = \frac{\text{Area}(A \cap B)}{\text{Area}(A) + \text{Area}(B) - \text{Area}(A \cap B)}$$
  Ketika sebuah irisan tile (kotak $A$, luas 7,073 px²) berada **sepenuhnya di dalam** kotak tomat utuh (kotak $B$, luas 26,412 px²), nilai irisannya adalah $7,073 \text{ px²}$, namun nilai union-nya adalah $26,412 \text{ px²}$.
  $$\text{IoU} = \frac{7073}{26412} = 0.2678$$
  Karena $0.2678 < 0.40$ (`iou_threshold`), irisan tersebut **ditolak dari cluster tomat utama** dan membentuk bounding box baru yang independen (Duplicate Detection).
- Solusi standar dalam literatur SAHI / Object Detection adalah menggunakan **Intersection over Minimum (IoM / Containment Index)**:
  $$\text{IoM}(A, B) = \frac{\text{Area}(A \cap B)}{\min(\text{Area}(A), \text{Area}(B))}$$
  Pada contoh di atas, $\text{IoM} = \frac{7073}{7073} = 1.00$ ($100\%$ terkurung), sehingga langsung dimerge tanpa membuat duplikat.

---

### 6.3 Bukti 3: Penerapan SAHI Tanpa Gating Resolusi / Densitas
- **File:** `server/services/tiled_inference.py` (Baris 219–226) & `server/routers/qc.py` (Baris 165–171)
- **Analisis Masalah:**  
  Metode SAHI secara arsitektur diciptakan untuk mendeteksi objek kecil (*small objects*) pada citra beresolusi sangat tinggi (misal $4K$, $12\text{MP}$, atau citra drone).
  Pada Agri-Sort AI, citra input beresolusi standar $640 \times 640$, yang merupakan ukuran asli input YOLO ($imgsz = 640$).
  Memotong citra $640 \times 640$ menjadi potongan $365 \times 365$ dan $256 \times 256$ tidak menambah detail informasi visual, melainkan **secara artifisial memenggal buah-buah besar menjadi beberapa bagian**.
  Tidak adanya pengecekan resolusi citra atau rasio objek menyebabkan SAHI selalu dijalankan secara agresif.

---

### 6.4 Bukti 4: Penurunan Threshold Sub-Tile Meloloskan Noise Latar Belakang
- **File:** `server/services/tiled_inference.py`
- **Baris:** 230
```python
sub_conf = max(0.12, confidence_threshold - 0.10)
```
- **Analisis Masalah:**  
  Ketika pengguna atau sistem menetapkan `confidence_threshold = 0.35`, sub-tile dieksekusi dengan `sub_conf = 0.25`.
  Pada potongan tile kecil yang kehilangan konteks global citra, tekstur bayangan gelap di sudut keranjang menghasilkan respons aktivasi lemah sebesar `0.2695`. Pada citra penuh, deteksi ini tereliminasi oleh threshold 0.35, tetapi pada sub-tile deteksi ini lolos dan menjadi Deteksi #9 (False Positive).

---

### 6.5 Bukti 5: Kondisi Model Artefak Tomat
- **File:** `model-export/weights/best.onnx`
- **Bentuk Tensor Output:** `(1, 5, 8400)` $\implies 4$ koordinat $(x, y, w, h) + 1$ kelas (`fresh-tomato`).
- Model Tomat yang aktif saat ini diekspor hanya dengan 1 kelas. Seluruh 9 deteksi (termasuk potongan dan bayangan) dipaksa memiliki label `fresh-tomato`.

---

## 7. Rekomendasi Solusi Teknis

Sesuai batasan tugas audit (READ-ONLY), rekomendasi berikut dipersiapkan untuk fase implementasi perbaikan berikutnya:

1. **Koreksi Typo Baris 35 `compute_iou`:**
   Ubah `box_a[3] - box_a[0]` menjadi `box_a[3] - box_a[1]` pada `server/services/tiled_inference.py`.
2. **Implementasikan Containment / IoM Suppression pada Clustering NMS:**
   Di samping memeriksa `IoU > iou_threshold`, tambahkan aturan supresi fragmen:
   ```python
   # Jika satu kotak sebagian besar (misal >= 70%) berada di dalam kotak lain:
   iom = inter_area / min(area_a, area_b)
   if iou > iou_threshold or iom >= 0.70:
       # Merge kandidat ke dalam cluster yang sama
   ```
3. **Tambahkan Gating Resolusi Sebelum Menjalankan Slicing:**
   Jangan jalankan slicing pada citra resolusi rendah/menengah:
   ```python
   # Hanya aktifkan slicing jika citra beresolusi tinggi (misal > 1280x1280)
   if width <= 800 and height <= 800:
       enable_slicing = False
   ```
4. **Hapus / Batasi Relaksasi `sub_conf`:**
   Gunakan ambang batas yang sama antara sub-tile dan citra penuh (`sub_conf = confidence_threshold`) untuk mencegah lolosnya artefak bayangan berkeyakinan rendah.
5. **Dinamiskan `centroid_box` Saat Clustering:**
   Perbarui koordinat kotak gabungan cluster (bounding union atau weighted average) agar cluster tidak melenceng (*drift*) saat menerima kandidat baru.

---

## 8. Spesifikasi Test Case Pencegahan Regresi

Berikut adalah test case yang direkomendasikan untuk ditambahkan ke suite pengujian backend (`tests/test_tiled_inference.py`):

### Test Case 1: Verifikasi Akurasi Matematis `compute_iou` (Kuadran Atas)
- **Input:** Dua kotak di mana $x_1 > y_2$, contoh:
  - Box A: `[348.0, 40.0, 470.0, 290.0]` ($x_1 = 348 > y_2 = 290$)
  - Box B: `[350.0, 45.0, 472.0, 285.0]`
- **Ekspektasi:** `compute_iou(box_a, box_b)` harus mengembalikan nilai $\approx 0.92$, bukan $0.0$ atau $> 1.0$.

### Test Case 2: Supresi Fragmen Parsial (Containment Index / IoM)
- **Input:** 
  - Box Induk (Tomat Utuh): `[100, 100, 300, 300]` (Luas 40,000 px²)
  - Box Pecahan Slicing: `[100, 100, 200, 200]` (Luas 10,000 px², 100% berada di dalam Box Induk)
- **Ekspektasi:** Box pecahan harus digabungkan ke dalam cluster Box Induk (tidak menghasilkan 2 deteksi terpisah).

### Test Case 3: Uji Regresi Citra 3 Tomat (`freshTomato-245`)
- **Input:** Citra `freshTomato-245` diproses melalui `run_sliced_yolo_inference` dengan `confidence_threshold = 0.35`.
- **Ekspektasi:** `len(result["detections"])` harus bernilai **tepat 3**, bukan 9.
