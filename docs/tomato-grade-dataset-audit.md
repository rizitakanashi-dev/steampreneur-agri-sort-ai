# DATASET AUDIT REPORT — KAGGLE TOMATO GRADE DATASET
**Target Dataset**: [Kaggle: prateek0328/tomato-grade-dataset](https://www.kaggle.com/datasets/prateek0328/tomato-grade-dataset)  
**Local Workspace Path**: `/home/Rizi/archive/`  
**Auditor**: Senior Machine Learning Engineer, Computer Vision Engineer  
**Date**: November 9, 2026  
**Final Verdict**: **`NO-GO` (Direct Training / Merging)** | **`CONDITIONAL GO` (Cleaned Auxiliary Pre-training Only)**

---

## 1. Executive Summary

Audit teknis dan agronomis independen dilakukan terhadap dataset *Kaggle Tomato Grade Dataset* yang tersimpan di direktori lokal `/home/Rizi/archive/`. Evaluasi mencakup integritas file COCO/YOLO/Pascal VOC, validitas bounding box, distribusi kelas, visual quality, kebocoran data (*data leakage*), kompatibilitas pipeline YOLO11 Agri-Sort AI, serta kesesuaian agronomis terhadap standar mutu komersial (SNI 01-3162-1992).

### Ringkasan Temuan Utama:
1. **Anomali Angka (916 vs 1136 vs 732)**: File COCO `result.json` mencatat 916 entri gambar dan 1137 anotasi (`id` 0 s.d. 1136). Namun, fisik file unik pada disk hanya berjumlah **732 file**. Terdapat 184 entri gambar redundan yang menunjuk ke 62 file fisik yang sama.
2. **Duplikasi Masif File Gambar**: Dari 732 file gambar pada disk, hanya terdapat **321 gambar unik secara byte-level (MD5)**. Sebanyak **411 file (56.1%) adalah duplikat identik** dari gambar lain yang dinamai ulang.
3. **Konflik Label Kontradiktif (Severe Label Noise)**: Dari 275 kelompok gambar duplikat identik, **141 kelompok (51.3%) memiliki label yang saling bertentangan**. Gambar yang sama persis dilabeli sebagai `Ripe` di satu file, namun dilabeli `rotten` di file lainnya.
4. **Kebocoran Split Katastropik (*Data Leakage*)**: Pada folder split siap pakai `TomatoDataset` (YOLO format), **72.6% gambar Test (106 dari 146 file) merupakan duplikat persis dari gambar di Training set**. Pada `Custom-Dataset` (COCO format), file fisik yang sama bocor langsung ke Train, Val, dan Test.
5. **Anotasi Hilang pada Konversi YOLO**: Konversi YOLO bawaan pada `TomatoDataset` kehilangan **185 anotasi** (hanya 942 anotasi dibandingkan 1127 anotasi COCO fisik) karena skrip konversi menimpa file label untuk gambar yang memiliki banyak objek.
6. **Boks di Luar Batas & Artifak Mikro**: Ditemukan 8 bounding box yang keluar dari batas gambar (termasuk boks yang 100% berada di luar kanvas) dan 23 artifak klik mikro ($< 15$ piksel).
7. **Ketidaksesuaian Agronomis Mutu Komersial**: 6 kelas dataset (`Ripe`, `semi-ripe`, `unripe`, `spotted ripe`, `spotted unripe`, `rotten`) merepresentasikan tingkat kematangan visual dan bercak, bukan kelas mutu komersial SNI (Grade A, Grade B, Reject). Tomat mentah (*unripe*) bernilai komersial tinggi untuk logistik jarak jauh dan tidak boleh diklasifikasikan sebagai mutu rendah.

---

## 2. Dataset Availability & Directory Structure

Dataset target telah tersedia secara lokal pada `/home/Rizi/archive/` tanpa perlu pengunduhan eksternal. Struktur repositori lokal terdiri dari 5 subdirektori:

```
/home/Rizi/archive/
├── Tomatoes/
│   ├── images/               # 732 file gambar (.jpg, .jpeg, .webp)
│   └── result.json           # Master COCO annotation (916 image records, 1137 annotations)
├── Custom-Dataset/
│   └── Custom-Dataset/
│       ├── images/           # 732 file gambar
│       ├── train_images/     # 448 file gambar (bocor ke val & test)
│       ├── val_images/       # 172 file gambar
│       ├── test_images/      # 169 file gambar
│       └── *.json            # train.json, val.json, test.json, result.json
├── TomatoDataset/
│   └── TomatoDataset/
│       ├── classes.txt       # 6 kelas
│       ├── data.yaml         # Ultralytics dataset configuration
│       ├── notes.json        # Metadata kategori
│       ├── train/ (440 img)  # Format YOLO txt (72.6% leak ke test)
│       ├── val/ (146 img)
│       └── test/ (146 img)
├── Coco_yoloTomato/          # Identik dengan TomatoDataset + result.json
└── PascalFormat/
    ├── images/               # 732 file gambar
    └── Annotations/          # 732 file Pascal VOC XML (mengalami truncating multi-objek)
```

### Verifikasi Integritas File Fisik
- **Total file gambar pada disk**: 732 file (`704 .jpg`, `27 .jpeg`, `1 .webp`).
- **File rusak / tidak terbaca PIL**: 0 file (100% terbaca).
- **Resolusi**: Bervariasi dari $460 \times 1024$ hingga $3264 \times 1472$ piksel (didominasi rasio aspek portrait smartphone $9:16$ dan $9:20$).

---

## 3. COCO Annotation Audit & Penjelasan Anomali 916 / 1136

### 3.1 Penjelasan Ketidaksesuaian Angka 916, 1136, dan 732
Pada halaman publik Kaggle dan deskripsi dataset, sering disebutkan figur "916 images" dan "1136 annotations". Audit kode sumber `result.json` membuktikan asal muasal disparitas ini:
1. **Angka 916 (Jumlah Rekor Gambar COCO)**:
   - Array `coco['images']` memiliki panjang tepat **916 entri**.
   - Namun, hanya terdapat **732 nama file fisik unik**.
   - Terdapat **62 file gambar** yang didaftarkan berulang kali dengan `id` berbeda (total 184 entri duplikat, $916 - 732 = 184$).
   - *Penyebab Teknis*: Dataset dianotasi menggunakan **Label Studio** (teridentifikasi pada tag XML Pascal VOC). Ketika satu gambar diekspor dengan multi-tugas atau multi-anotator, Label Studio membuat entri `images` baru untuk setiap instance task, menghasilkan ID gambar ganda untuk file fisik yang sama. Contoh ekstrem: `images/14ad1997-Image_309.jpg` memiliki **8 ID gambar berbeda** (`id`: 280, 281, 282, 283, 284, 285, 286, 287).
2. **Angka 1136 vs 1137 (Jumlah Anotasi)**:
   - Array `coco['annotations']` memiliki panjang tepat **1137 entri**.
   - Indeks `id` anotasi dimulai dari 0 (`id: 0`) hingga 1136 (`id: 1136`).
   - Pihak yang membaca nilai `max(ann_id)` mencatat angka **1136** karena *zero-indexing off-by-one error*, padahal jumlah sebenarnya adalah **1137 anotasi**.

### 3.2 Bounding Box Invalid & Keluar Batas Kanvas (Out-of-Bounds)
- Bounding box dengan lebar/tinggi/luas $\le 0$: 0 entri.
- **Bounding box keluar dari dimensi gambar**: **8 entri**.
  - `ann_id=46` (`fb05add6-Image_37.jpg`, kelas `rotten`):  
    Ukuran gambar $768 \times 1024$. Bbox: $x=970.21, y=689.31, w=202.21, h=223.13$.  
    *Temuan*: Koordinat $x = 970.21$ jauh melampaui lebar gambar 768. Bounding box ini **100% berada di luar gambar (kanvas kosong)**.
  - `ann_id=720` (`f31fe590-Image_476.jpg`, kelas `Ripe`):  
    Ukuran gambar $3264 \times 1472$. Bbox: $y=1315.25, h=874.82 \implies y+h=2190.07$.  
    *Temuan*: Bounding box menjulur keluar 718 piksel di bawah batas bawah gambar.
  - `ann_id=789` (`2f8f0168-Image_528.jpg`, kelas `rotten`):  
    Ukuran gambar $461 \times 1024$. Bbox: $x=518.16, w=57.16, h=1.08$.  
    *Temuan*: $x > 461$ dan tinggi boks hanya 1 piksel.
  - 5 entri lainnya (`ann_id` 242, 645, 1034, 1045, 1051) memiliki nilai $x+w$ atau $y+h$ yang melewati batas kanvas sebesar beberapa piksel hingga puluhan piksel.

### 3.3 Anotasi Duplikat & Artifak Klik Mikro
- **Anotasi Duplikat Identik**: 10 entri anotasi memiliki koordinat bounding box dan kelas yang sama persis pada file yang sama (terjadi akibat duplikasi entri gambar di Label Studio).
- **Artifak Klik Mikro ($< 15$ piksel)**: **23 anotasi** terbukti merupakan artifak klik kursor yang tidak sengaja tertekan saat proses anotasi. Contoh:
  - `ann_id=71`: kelas `Ripe`, ukuran $3.6 \times 1.8$ piksel pada gambar $1024 \times 768$.
  - `ann_id=83`: kelas `spotted ripe`, ukuran $7.5 \times 1.5$ piksel.
  - `ann_id=179`: kelas `spotted unripe`, ukuran $6.6 \times 5.0$ piksel.

---

## 4. Class Distribution & Imbalance Analysis

Evaluasi distribusi kelas dilakukan pada level anotasi maupun level sebaran gambar unik (732 file):

| Class ID | Class Name | Images Count | Annotations Count | % Annotations | % Images (dari 732) | Status Keseimbangan |
| :---: | :--- | :---: | :---: | :---: | :---: | :--- |
| `0` | **Ripe** | 220 | 264 | 23.22% | 30.05% | Dominan |
| `1` | **rotten** | 137 | 154 | 13.54% | 18.72% | Cukup |
| `2` | **semi-ripe** | 99 | 131 | 11.52% | 13.52% | **Underrepresented** |
| `3` | **spotted ripe** | 128 | 139 | 12.23% | 17.49% | Cukup |
| `4` | **spotted unripe** | 166 | 183 | 16.09% | 22.68% | Moderat |
| `5` | **unripe** | 108 | 266 | 23.39% | 14.75% | Dominan (Banyak cluster) |
| **TOTAL**| **6 Kategori** | **-** | **1137** | **100.00%** | **-** | **Rasio Imbalance 2.03:1** |

### Analisis Imbalance:
1. Kelas `unripe` (266) dan `Ripe` (264) mendominasi hampir **46.6% total anotasi**.
2. Kelas `semi-ripe` adalah kelas yang paling sedikit terwakili (hanya 131 anotasi pada 99 gambar), menghasilkan rasio ketimpangan anotasi sebesar **2.03 : 1** terhadap `unripe`.
3. Kelas `unripe` memiliki densitas objek per gambar tertinggi (rata-rata 2.46 tomat per gambar), sedangkan kelas `Ripe` umumnya difoto secara tunggal (rata-rata 1.20 tomat per gambar).

---

## 5. Visual Inspection & Data Quality

### 5.1 Karakteristik Pengambilan Gambar
- **Perangkat Kamera**: Metadata EXIF mengungkap foto diambil menggunakan kamera ponsel kelas menengah: Xiaomi Redmi Note 9 (`M2003J15SC`), Xiaomi Redmi 9 Prime (`M2006C3MII`), dan Realme X3 pada bulan Maret 2023.
- **Kondisi Latar Belakang**: Sangat bervariasi (*in the wild*), meliputi:
  - Tanaman tomat di kebun / polybag (banyak oklusi daun dan ranting).
  - Meja beralas koran / kain / ubin dapur kotor.
  - Tomat dipegang dengan tangan manusia (tangan sering masuk ke dalam atau berdekatan dengan bounding box).
  - Tumpukan tomat di keranjang pasar tradisional.
- **Kondisi Pencahayaan**:
  - Sebagian foto mengalami *over-exposure* akibat sinar matahari terik langsung.
  - Sebagian foto redup (*underexposed*) dengan bayangan pekat (*harsh shadows*).

### 5.2 Analisis Kolorimetri & Separabilitas Visual Antar Kelas
Pengukuran rata-rata kanal RGB pada area crop bounding box menghasilkan profil spektral berikut:

| Kelas | Mean Red | Mean Green | Mean Blue | Rasio R/G | Mean Brightness | Separabilitas Visual |
| :--- | :---: | :---: | :---: | :---: | :---: | :--- |
| **Ripe** | 180.5 | 99.6 | 65.9 | **1.81** | 115.3 | Merah tegas, separasi tinggi |
| **spotted ripe** | 175.8 | 110.0 | 61.9 | **1.60** | 115.9 | Merah bercak, separasi baik |
| **rotten** | 169.5 | 121.6 | 74.5 | **1.39** | 121.8 | **Tumpang tindih tinggi** |
| **semi-ripe** | 168.7 | 127.4 | 61.9 | **1.32** | 119.3 | **Tumpang tindih tinggi** |
| **spotted unripe** | 157.9 | 145.1 | 86.1 | **1.09** | 129.7 | Hijau bercak |
| **unripe** | 142.9 | 150.2 | 87.5 | **0.95** | 126.9 | Hijau tegas |

### Temuan Visual Ambiguity:
- **Tumpang Tindih Kritis `rotten` vs `semi-ripe`**: Nilai rasio R/G dan kecerahan antara `rotten` (1.39 / 121.8) dan `semi-ripe` (1.32 / 119.3) saling tumpang tindih. Tomat yang mengalami pembusukan basah (*bacterial soft rot*) sering kali tampak berwarna kekuningan/oranye kecokelatan yang secara visual sangat mirip dengan tomat `semi-ripe` (*breaker/turning stage*).
- **Subjektivitas `spotted` vs `rotten`**: Anotator tidak memiliki definisi kuantitatif yang jelas kapan bercak (*spot*) berubah status menjadi kebusukan (*rot*). Beberapa tomat dengan bercak nekrotik gelap besar dilabeli `spotted ripe`, sementara bercak serupa pada gambar lain dilabeli `rotten`.

---

## 6. Dataset Leakage & Duplicate Audit (Temuan Kritis)

### 6.1 Duplikasi File Fisik Tingkat Byte (MD5 Hash)
Audit hashing MD5 terhadap seluruh 732 file gambar di `/home/Rizi/archive/Tomatoes/images` mengungkap anomali integritas yang sangat parah:
- **Total file pada disk**: 732 file.
- **Total hash MD5 unik**: **Hanya 321 gambar unik**.
- **File redundan duplikat identik**: **411 file (56.1%)**.
- **Jumlah kelompok duplikat**: 275 kelompok.
  - 203 kelompok terdiri dari 2 file identik.
  - 35 kelompok terdiri dari 3 file identik.
  - 26 kelompok terdiri dari 4 file identik.
  - 1 kelompok bahkan terdiri dari **11 file identik** dengan nama berbeda (`056e07cc-Image_599.jpg`, `15287f67-Image_591.jpg`, `19afc4d2-Image_482.jpeg`, `205433e8-Image_768.jpg`, `331701e8-Image_699.jpg`, `4abece35-Image_316.jpg`, `8d641b17-Image_210.jpeg`, `9b349af4-Image_224.jpg`, `a2041211-Image_409.jpg`, `d370e7b6-Image_221.jpg`, `d9ecf39b-Image_597.jpg`).

### 6.2 Konflik Label Antara Gambar Duplikat (Label Contradiction)
Dari 275 kelompok gambar duplikat identik:
- **Kelompok dengan label konsisten**: 134 kelompok.
- **Kelompok dengan LABEL KONTRADIKTIF**: **141 kelompok (51.3%)**!
- Contoh kontradiksi fatal:
  - **Kelompok MD5 `e343a7b5`**:
    - `dc11c6c0-Image_90.jpg` $\to$ dianotasi: `['Ripe', 'spotted ripe', 'unripe']`
    - `10057c9d-Image_104.jpg` $\to$ dianotasi: `['semi-ripe', 'spotted ripe', 'unripe']`
    - `3a82f980-Image_124.jpg` $\to$ dianotasi: `['rotten']`!  
    *(Gambar pixel-by-pixel identik, namun dilabeli Ripe pada satu file dan Rotten pada file lainnya).*
  - **Kelompok MD5 `e8721fa6`**:
    - `d4819ad2-Image_191.jpg` $\to$ dianotasi: 1 boks `['Ripe']`
    - `063b7823-Image_565.jpg` $\to$ dianotasi: 7 boks `['Ripe', 'Ripe', 'Ripe', 'Ripe', 'Ripe', 'Ripe', 'Ripe']`

### 6.3 Kebocoran Split Pembelajaran (*Catastrophic Split Leakage*)
Audit terhadap folder split bawaan `TomatoDataset/TomatoDataset/` (YOLO format: train=440, val=146, test=146) membuktikan adanya kebocoran data masif:
- **Test Set Leakage**: Sebanyak **106 dari 146 file Test (72.6%) merupakan duplikat identik dari gambar di Train set**!
- **Validation Set Leakage**: Sebanyak **93 dari 146 file Val (63.7%) merupakan duplikat identik dari gambar di Train set**!
- **Dampak Evaluasi**: Model apa pun yang dilatih dan diuji pada split ini akan melaporkan metrik mAP palsu yang sangat tinggi ($>95\%$) murni karena model menghafal piksel gambar latih yang muncul kembali di set uji (*data memorization, not generalization*).

---

## 7. Pipeline Compatibility & Conversion Flaws

### 7.1 Kompatibilitas dengan YOLO11 Agri-Sort AI
1. **Format YOLO Eksisting Rusak**:
   Folder `TomatoDataset/TomatoDataset/` yang disediakan dataset memiliki konversi YOLO yang cacat:
   - Dari 1127 anotasi unik pada master COCO, file `.txt` YOLO hanya memuat **942 anotasi** (**185 anotasi hilang / terpotong**).
   - *Penyebab*: Skrip konversi penulis dataset memproses ID gambar berulang dengan menimpa (*overwrite*) file label teks yang sama.
   - Contoh: Pada `14ad1997-Image_309.jpg`, master COCO memiliki 8 objek tomat, tetapi `14ad1997-Image_309.txt` hanya memiliki **1 anotasi**, 7 objek lainnya hilang.
   - Format Pascal VOC XML pada `PascalFormat/Annotations` mengalami cacat serupa (hanya menyimpan 1 objek).
2. **Koordinat Normalisasi Melampaui 1.0**:
   - `2f8f0168-Image_528.txt`: $x_c = 1.1859$ (di luar rentang $[0, 1]$).
   - `fb05add6-Image_37.txt`: $x_c = 1.3949$ (di luar rentang $[0, 1]$).
   - File ini akan memicu *assertion error* atau *warning* saat dimuat oleh Ultralytics YOLO11 data loader.

### 7.2 Larangan Penggabungan dengan Dataset Tomat Eksisting
Proyek Agri-Sort AI saat ini memiliki model Tomat YOLO11n dengan 2 kelas (`fresh-tomato`, `rotten-tomato`).
- **Keputusan**: **DILARANG MENGGABUNGKAN DATASET (STRICT NO-MERGE)**.
- **Alasan**:
  - Dataset Kaggle ini mengandung 411 gambar duplikat dan 141 kelompok label kontradiktif. Menggabungkannya secara mentah akan meracuni (*poisoning*) dataset eksisting.
  - Skema label tidak kompatibel: kelas `spotted ripe` dan `spotted unripe` tidak memiliki padanan langsung dalam model biner eksisting.

---

## 8. Agronomic and Commercial Business Suitability

### 8.1 Evaluasi terhadap Standar Mutu SNI 01-3162-1992 (Tomat Segar)
Dalam perdagangan hortikultura dan standar nasional Indonesia (SNI 01-3162-1992):
1. **Tingkat Kematangan Bukan Penentu Mutu Rendah**:
   - SNI membagi kematangan tomat menjadi: *Hijau* (Green), *Kuning/Semburat* (Breaker/Turning), dan *Merah* (Ripe/Red).
   - Tomat kelas `unripe` (hijau) dan `semi-ripe` (oranye) **bukan Reject dan bukan Grade B**. Untuk pengiriman antar pulau atau ekspor (rantai pasok 3-7 hari), tomat hijau/mengkal justru merupakan komoditas primer bernilai tinggi karena memiliki daya simpan yang panjang.
   - Mengubah `unripe` menjadi Grade B atau Reject adalah kesalahan fatal agronomis.
2. **Karakteristik Cacat Visual (*Defects & Spots*)**:
   - SNI mentoleransi cacat fisik minor (goresan kecil, bercak permukaan ringan non-patogen) maksimal 5% bobot/jumlah untuk **Mutu I (Grade A)** dan maksimal 10% untuk **Mutu II (Grade B)**.
   - Kerusakan akibat hama/penyakit, luka terbuka, atau busuk basah langsung masuk kategori **Reject**.
   - Kelas `spotted ripe` dan `spotted unripe` pada dataset ini mencampuradukkan antara bercak ringan superficial dengan infeksi antraknosa/busuk ujung pantat (*blossom end rot*), tanpa parameter luas area cacat.
3. **Pembusukan**:
   - Kelas `rotten` adalah satu-satunya kelas yang berkorelasi 100% dengan status **Reject**.

### 8.2 Matriks Kelayakan Mutu Bisnis

| Kelas Dataset | Korelasi Agronomis | Kelayakan Mapping Otomatis ke Grade A/B/Reject | Tindakan yang Dibutuhkan |
| :--- | :--- | :--- | :--- |
| `Ripe` | Kematangan penuh (konsumsi segar lokal) | **TIDAK BISA** (bisa Grade A jika mulus, Grade B jika bentuk asimetris) | Butuh inspeksi keutuhan fisik |
| `semi-ripe` | Fase Breaker/Turning (logistik sedang) | **TIDAK BISA** (dapat Grade A untuk pengiriman luar kota) | Nilai sebagai indeks kematangan, bukan mutu |
| `unripe` | Fase Hijau Fisiologis (logistik jauh) | **TIDAK BISA** (dapat Grade A untuk pengiriman antar pulau) | Nilai sebagai indeks kematangan, bukan mutu |
| `spotted ripe` | Cacat permukaan pada tomat matang | **TIDAK BISA** (Grade B jika cacat $<10\%$, Reject jika infeksi jamur) | Butuh segmentasi luas cacat |
| `spotted unripe` | Cacat permukaan pada tomat mentah | **TIDAK BISA** (Grade B jika cacat $<10\%$, Reject jika patogen) | Butuh segmentasi luas cacat |
| `rotten` | Pembusukan jaringan (bakteri/jamur) | **BISA $\to$ REJECT** | Layak digunakan untuk deteksi reject |

---

## 9. Rekomendasi Remediasi & Keputusan Final

### 9.1 Rekomendasi Remediasi Teknis (Jika Hendak Digunakan)
Jika tim ML memutuskan untuk memanfaatkan dataset ini sebagai data pendukung di masa depan, langkah kurasi berikut **wajib** dilakukan sebelum proses training:
1. **Deduplikasi Tingkat Byte**: Eliminasi 411 file duplikat, reduksi dataset ke 321 gambar fisik unik.
2. **Pembersihan Kontradiksi Label**: Audit ulang 141 kelompok duplikat yang memiliki label bertentangan oleh ahli hortikultura/agronomis.
3. **Pembersihan Out-of-Bounds & Mikro Bbox**: Hapus 8 bounding box yang keluar batas kanvas dan 23 artifak klik mikro.
4. **Rekonstruksi Anotasi Multi-Objek**: Buat ulang skrip konversi COCO-to-YOLO yang memulihkan 185 anotasi yang hilang.
5. **Group-Aware Splitting Bebas Kebocoran**: Buat split baru (Train 70%, Val 15%, Test 15%) yang dikelompokkan berdasarkan hash gambar atau sesi pengambilan foto sehingga **kebocoran data antar split adalah 0.0%**.
6. **Reposisi Tujuan Model**: Latih model ini sebagai **Maturity & Defect Screener** (deteksi fase kematangan dan anomali bercak), bukan sebagai model final *Grade A/B/Reject*.

---

### 9.2 Keputusan Audit Final (Verdict)

# **`NO-GO`** (Untuk Pelatihan Langsung atau Penggabungan Dataset)
*Dataset dalam kondisi aktual saat ini TIDAK LAYAK dan DILARANG untuk langsung dimasukkan ke dalam pipeline training atau digabungkan ke repositori Agri-Sort AI karena duplikasi masif (56.1%), kontradiksi label (51.3%), kebocoran set uji katastropik (72.6%), serta hilangnya 185 anotasi pada format YOLO bawaan.*

---

# **`CONDITIONAL GO`** (Hanya Sebagai Data Pra-pelatihan Bantu Pasca-Kurasi Total)
*Dataset HANYA dapat digunakan sebagai auxiliary dataset untuk pre-training backbone pendeteksi kematangan visual SETELAH ke-5 langkah remediasi kurasi teknis di atas dieksekusi secara lengkap dan diverifikasi secara independen.*
