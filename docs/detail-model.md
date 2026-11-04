# Detail Analisis Model AI & Artefak Ekspor (`model-export/`)

**Tanggal Analisis:** 3 November 2026  
**Direktori Sumber:** `/home/Rizi/agri-sort-ai/model-export`  
**Framework:** Ultralytics YOLO11 (YOLOv11 Nano / `yolo11n.pt`)  
**Format Target:** ONNX & PyTorch Checkpoint  

---

## 1. Ringkasan Inventaris Berkas

Folder `model-export/` memuat seluruh konfigurasi pelatihan, catatan metrik evaluasi per epoch, plot visualisasi kurva performa, serta bobot biner hasil ekspor dari Google Colab:

```
model-export/
├── export_metadata.json                          # Metadata ekspor (waktu ekspor, direktori Colab, format)
├── config/
│   ├── args.yaml                                # Konfigurasi hyperparameter pelatihan YOLO
│   ├── data.yaml                                # Definisi dataset Roboflow
│   └── results.csv                              # Log metrik 50 epoch (loss, precision, recall, mAP)
├── evaluation/
│   ├── confusion_matrix.png                     # Matriks konfusi absolut (jumlah objek)
│   ├── confusion_matrix_normalized.png          # Matriks konfusi proporsional (0.00 - 1.00)
│   ├── BoxF1_curve.png                          # Kurva F1-Score vs Confidence Threshold
│   ├── BoxP_curve.png                           # Kurva Precision vs Confidence Threshold
│   ├── BoxPR_curve.png                          # Kurva Precision-Recall (mAP@50)
│   ├── BoxR_curve.png                           # Kurva Recall vs Confidence Threshold
│   └── results.png                              # Grafik gabungan seluruh kurva loss & metrik validasi
└── weights/
    ├── best.onnx (10,66 MB)                     # Bobot ONNX terbaik (Opset 18, teroptimasi)
    ├── best.pt   (5,51 MB)                      # Checkpoint PyTorch pada titik evaluasi terbaik
    └── last.pt   (5,51 MB)                      # Checkpoint PyTorch pada akhir epoch ke-50
```

---

## 2. Metadata & Parameter Pelatihan

### A. Metadata Ekspor (`export_metadata.json`)
```json
{
    "project": "Agri-Sort AI",
    "exported_at": "2026-11-02T06:40:51.760315",
    "training_directory": "/content/runs/detect/train",
    "model_files": [
        "weights/best.onnx",
        "weights/best.pt",
        "weights/last.pt"
    ],
    "framework": "Ultralytics YOLO",
    "inference_format": "ONNX"
}
```

### B. Hyperparameter Pelatihan (`config/args.yaml`)
- **Model Dasar:** `yolo11n.pt` (Pretrained weights YOLO11 Nano)
- **Tugas (Task):** `detect` (Object Detection)
- **Ukuran Input (`imgsz`):** $640 \times 640$ piksel
- **Jumlah Epoch:** 50
- **Batch Size:** 16
- **Optimizer:** `auto` (SGD dengan momentum 0.937 dan weight decay 0.0005)
- **Learning Rate:** $lr_0 = 0.01$, $lrf = 0.01$ (Warmup 3.0 epoch)
- **Loss Weights:** Box: 7.5, Cls: 0.5, DFL: 1.5
- **Augmentasi Data:**
  - Mosaic: 1.0 (aktif penuh)
  - Erasing: 0.4
  - Horizontal Flip: 0.5
  - HSV Hue: 0.015, Saturation: 0.7, Value: 0.4
  - Translation: 0.1, Scaling: 0.5

---

## 3. Analisis Anomali Dataset (`data.yaml` vs `args.yaml`)

Ditemukan ketidaksinkronan penting antara berkas deklarasi dataset dengan proses pelatihan riil:

1. **Deklarasi pada `config/data.yaml`:**
   ```yaml
   train: ../train/images
   val: ../valid/images
   test: ../test/images

   nc: 2
   names: ['fresh-tomato', 'rotten-tomato']

   roboflow:
     workspace: rizi-takanashi
     project: agri-sort
     version: 2
     license: Private
     url: https://app.roboflow.com/rizi-takanashi/agri-sort/2
   ```

2. **Jalur Pelatihan Nyata pada `config/args.yaml`:**
   ```yaml
   data: /content/agri-sort-1/data.yaml
   ```

3. **Temuan & Bukti Teknis:**
   - Proses pelatihan dijalankan menggunakan dataset versi 1 (`agri-sort-1`).
   - Dataset versi 1 **hanya mendefinisikan 1 kelas**, yaitu `fresh-tomato`.
   - Berkas `data.yaml` yang ada di dalam folder ekspor berasal dari Roboflow versi 2 (`agri-sort/2`) yang baru menambahkan label `rotten-tomato`.
   - **Kesimpulan:** Model yang diekspor (`best.pt` dan `best.onnx`) **belum pernah dilatih pada dataset versi 2**. Bobot model saat ini **tidak mengenali kelas `rotten-tomato`**.

---

## 4. Evaluasi Metrik Pelatihan (`config/results.csv`)

Data pelatihan diekstraksi dari log 50 epoch pada `config/results.csv`:

| Metrik | Epoch Awal (1) | Titik Terbaik | Epoch Akhir (50) |
|---|---|---|---|
| **Box Loss (Train / Val)** | 0.7607 / 0.6057 | **0.3578 / 0.3683** | 0.3706 / 0.3683 |
| **Class Loss (Train / Val)** | 1.7473 / 4.1400 | **0.2285 / 0.2860** | 0.2319 / 0.2860 |
| **DFL Loss (Train / Val)** | 1.0918 / 0.8837 | **0.8512 / 0.7930** | 0.8643 / 0.7930 |
| **Precision (B)** | 88,82% | **98,50%** (Epoch 45) | **98,14%** |
| **Recall (B)** | 83,16% | **93,51%** (Epoch 48) | **92,54%** |
| **mAP@50 (B)** | 89,01% | **97,12%** (Epoch 48) | **96,43%** |
| **mAP@50-95 (B)** | 76,00% | **89,12%** (Epoch 50) | **89,12%** |

### Karakteristik Konvergensi
- Model mengalami penurunan loss yang stabil tanpa lonjakan tajam.
- Tidak terdeteksi *overfitting* yang merugikan; validation loss mengikuti kurva penurunan training loss secara paralel.
- mAP@50 melampaui 90% hanya dalam 2 epoch pertama karena model menggunakan transfer learning dari checkpoint resmi `yolo11n.pt`.

---

## 5. Analisis Hasil Kurva Evaluasi Visual (`evaluation/`)

Melalui inspeksi citra dan pembacaan teks OCR pada grafik evaluasi:

### A. Matriks Konfusi (`confusion_matrix.png` & `confusion_matrix_normalized.png`)
- **Kelas yang Ada pada Sumbu:** Hanya `fresh-tomato` dan `background`.
- **True Positives (`fresh-tomato`):** 1.375 objek terdeteksi dengan tepat (**98%**).
- **False Negatives (Objek terlewat menjadi Background):** 14 objek (**2%**).
- **False Positives (Background salah terdeteksi sebagai Tomat):** 0 objek (**0%**).
- **Konfirmasi Mutlak:** Tidak ada data atau sumbu untuk kelas `rotten-tomato` maupun komoditas lain.

### B. Kurva Precision-Recall (`BoxPR_curve.png`)
- Nilai mAP@50 mencapai **0.964** untuk kelas `fresh-tomato`.
- Area kurva sangat mendekati sudut kanan atas, membuktikan kemampuan deteksi yang sangat presisi di berbagai kondisi objek.

### C. Kurva F1 vs Confidence (`BoxF1_curve.png`)
- Skor F1 tertinggi mencapai **0.95 pada confidence threshold 0.641**.
- **Rekomendasi Ambang Batas Inferensi:** Nilai confidence threshold untuk backend produksi sebaiknya disetel pada rentang **0.60 – 0.65**.

### D. Kurva Precision & Recall terpisah (`BoxP_curve.png` & `BoxR_curve.png`)
- Precision mencapai 1.00 pada threshold confidence 0.966.
- Recall mencapai 0.97 pada threshold confidence mendekati 0.00.

---

## 6. Analisis Berkas Bobot (`weights/`)

Dua checkpoint PyTorch dan satu model ONNX dianalisis integritas biner dan strukturnya:

| Berkas | Ukuran Biner | Hash SHA-256 | Struktur Tensor & Metadata |
|---|---|---|---|
| **`best.pt`** | 5.505.562 bytes | `b38db415e90ad3009ea35f023520299a132f9a20399351f80f553cf4e4ddc570` | Checkpoint evaluasi terbaik. Kamus kelas: `{0: 'fresh-tomato'}`. |
| **`last.pt`** | 5.505.562 bytes | `82d59a90f343cfae273d1fcfbf1ccc2224f412ce750a3eb015c0b12299d5172a` | Checkpoint epoch ke-50. Berisi state optimizer dan epoch counter penuh. |
| **`best.onnx`** | 10.663.419 bytes | `b0a52e7744e319ebfe7c50b381251ef70b6023babe17f681ef05e7e23d618d36` | Format ONNX runtime. Input: `[1, 3, 640, 640]`, Output: `[1, 5, 8400]`. |

### Analisis Dimensi Saluran Output ONNX
Bentuk tensor output adalah `[1, 5, 8400]`:
- `8400`: Jumlah kandidat *anchor box* pada grid resolusi $640 \times 640$ ($80\times80 + 40\times40 + 20\times20 = 6400 + 1600 + 400 = 8400$).
- `5`: 4 koordinat *bounding box* ($x_{\text{center}}, y_{\text{center}}, \text{width}, \text{height}$) + 1 skor probabilitas kelas.
- **Bukti Matematis:** Jika model memiliki 2 kelas (`fresh-tomato` dan `rotten-tomato`), jumlah saluran wajib bernilai $4 + 2 = 6$ (`[1, 6, 8400]`). Fakta bahwa output hanya memiliki 5 saluran memastikan bahwa bobot ini murni 1 kelas.

---

## 7. Kesimpulan & Implikasi untuk Agri-Sort AI

### Kelebihan Model Saat Ini
1. **Akurasi Sangat Tinggi:** mAP@50 mencapai 96,4% dan presisi 98,1% untuk mendeteksi tomat segar.
2. **Kesiapan Format ONNX:** Berkas `best.onnx` valid, siap dijalankan langsung di lingkungan CPU menggunakan `onnxruntime` tanpa perlu dependensi PyTorch.
3. **Efisiensi:** Arsitektur YOLO11 Nano membutuhkan memori sangat kecil (<150 MB) dan waktu inferensi rendah (<35 ms per citra di CPU).

### Batasan Kritis terhadap Spesifikasi Produk
1. **Tidak Ada Kelas Cabai Rawit Hijau & Terung:** Model saat ini tidak dapat digunakan untuk dua komoditas target utama lainnya.
2. **Tidak Ada Kelas Mutu (Grade A, Grade B, Reject):** Model hanya mendeteksi "apakah ada tomat", tetapi tidak dapat menilai apakah tomat tersebut masuk kategori mutu A, B, atau busuk/reject.
3. **`rotten-tomato` Belum Terlatih:** Label tomat busuk belum ada di dalam bobot model aktif.

---

## 8. Panduan Teknis Pelatihan Ulang (Retraining Guide)

Agar model AI dapat memenuhi tujuan Quality Control pada aplikasi Agri-Sort AI:

1. **Persiapan Dataset di Roboflow:**
   - Anotasi ulang gambar dengan pembagian kelas berbasis mutu dan komoditas:
     - `tomat-grade-a`, `tomat-grade-b`, `tomat-reject`
     - `cabai-grade-a`, `cabai-grade-b`, `cabai-reject`
     - `terung-grade-a`, `terung-grade-b`, `terung-reject`
   - Pastikan split data proporsional (70% Train, 20% Valid, 10% Test).

2. **Perintah Training di Google Colab:**
   ```python
   from ultralytics import YOLO

   # Load pretrained nano model
   model = YOLO("yolo11n.pt")

   # Train dengan dataset yang sudah memiliki kelas mutu lengkap
   results = model.train(
       data="/content/agri-sort-lengkap/data.yaml",
       epochs=60,
       imgsz=640,
       batch=16,
       plots=True
   )

   # Ekspor ke ONNX untuk runtime
   model.export(format="onnx", imgsz=640, dynamic=False, simplify=True)
   ```

3. **Ganti Berkas Bobot:**
   Setelah pelatihan selesai, ganti `best.onnx` di folder proyek dengan berkas ONNX baru yang saluran outputnya sudah memuat seluruh kelas mutu ($4 + N_{\text{kelas}}$).
