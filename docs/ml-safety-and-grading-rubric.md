# LAPORAN ML SAFETY & VALIDASI RUBRIK MUTU HORTIKULTURA
## Agri-Sort AI: Pengamanan Hasil Inferensi & Validasi Taksonomi Kualitas
### Tahap Pra-Retraining Model: Terung, Tomat, dan Cabai Rawit Hijau

> **Status Dokumen:** FINAL & TERVERIFIKASI  
> **Tanggal Pelaksanaan:** 9 November 2026  
> **Peran:** Senior Machine Learning Engineer, Computer Vision Engineer & Software Architect  
> **Metode Pemeriksaan:** Static Code Analysis, Empirical Contract Tracing, Dataset Integrity Profiling, and Cross-System Safety Audit (Read-Only)  
> **Lokasi Repositori:** `/home/Rizi/agri-sort-ai` (Commit `b37a9c8`, Branch `main`)  
> **Tujuan Utama:** Mengamankan keluaran sistem agar tidak menghasilkan grading yang menyesatkan (*anti-misleading quality control*), memvalidasi pemetaan kelas komersial, dan menetapkan fondasi rubrik mutu sebelum tahap penyiapan dataset dan pelatihan ulang (*retraining*).

---

## 1. EXECUTIVE SUMMARY

Laporan ini merupakan mandat fase pra-retraining dalam rekayasa kecerdasan artifisial Agri-Sort AI. Sebelum sumber daya komputasi dan anotasi dikerahkan untuk melatih ulang model, evaluasi mendalam wajib dilakukan terhadap **keamanan inferensi (ML Safety)** dan **validitas rubrik mutu (Grading Rubric)**.

### Ringkasan Kondisi & Temuan Utama
1. **Defisit Taksonomi Grading Tomat:** Model Tomat aktual hanya mengenali 2 kelas biner (`fresh-tomato` dan `rotten-tomato`). Kode backend dan frontend memaksakan pemetaan sepihak: `Fresh` $\to$ `Grade A` (100%), `Grade B` dikunci $0.0\%$, dan `Rotten` $\to$ `Reject`. Ini merupakan **kesalahan konseptual serius** karena tomat segar dengan cacat bentuk atau bercak ringan otomatis dinilai sebagai Grade A prima, mendistorsi valuasi finansial petani dan pembeli.
2. **Ketiadaan Aset Cabai Rawit Hijau:** Repositori maupun mesin lokal **sama sekali tidak memiliki citra, label, berkas konfigurasi, maupun bobot model cabai** (`NOT AVAILABLE`). Seluruh hasil pemindaian cabai berjalan di atas fallback simulasi manual. Namun, antarmuka sertifikat cetak mengklaim evaluasi dilakukan oleh *"Agri-Sort AI Autonomous Engine"* berbasis *"Ultralytics YOLO11 Vision Engine"*, yang berpotensi menyesatkan pengguna (*misleading claims*).
3. **Ilusi Deteksi AI pada Fallback & Mock:** Saat model gagal dimuat atau mode mock aktif, backend mengembalikan `is_simulated = True`. Namun, kode frontend (`QCResults.jsx` dan `BatchQCScanner.jsx`) hanya memeriksa keberadaan objek `inference_result`. Akibatnya, hasil sintetis/simulasi tetap dilabeli dengan lencana mentereng **`✨ AI Computer Vision`** dan dapat diterbitkan sertifikatnya tanpa peringatan transparansi.
4. **Kebocoran Spesimen (*Specimen Leakage*):** Terverifikasi 175 spesimen bocor antara data latih, validasi, dan uji pada dataset Tomat asal Roboflow (`test.v2i.yolov11.zip`), membuktikan bahwa metrik akurasi $mAP = 97,12\%$ terinflasi secara semu.
5. **Kesiapan Model Terung:** Model Terung 4-kelas (`Extra Class`, `Class I`, `Class II`, `Reject`) memiliki taksonomi yang paling selaras dengan Grade A/B/Reject. Namun, terdapat ambiguitas $19\%$ antara `Class II` dan `Reject` yang membutuhkan aturan penanganan khusus dan retraining berbasis data keranjang panen padat.

---

## 2. KONDISI AKTUAL MASING-MASING MODEL & DATASET

Audit memverifikasi kondisi fisik model dan dataset secara independen:

```
+----------------------------------------------------------------------------------------------------+
|                                    RINGKASAN STATUS MODEL AKTUAL                                   |
+-------------------+----------------------------+-----------------------+---------------------------+
| Komoditas         | Status Model & Bobot       | Kelas Faktual Model   | Kesesuaian Taksonomi QC   |
+-------------------+----------------------------+-----------------------+---------------------------+
| Terung            | VERIFIED AKTIF             | 4 Kelas:              | PARTIALLY COMPLIANT       |
| (Solanum          | - best.pt (5,49 MB)        | - Extra Class         | Kompatibel dengan Grade   |
| melongena)        | - best.onnx (10,67 MB)     | - Class I             | A/B/Reject, namun ada     |
|                   | server/models/terung/      | - Class II            | ambiguitas Class II vs    |
|                   |                            | - Reject              | Reject sebesar 19%.       |
+-------------------+----------------------------+-----------------------+---------------------------+
| Tomat             | VERIFIED AKTIF             | 2 Kelas Biner:        | NOT COMPLIANT             |
| (Solanum          | - best.pt (5,51 MB)        | - fresh-tomato        | Gagal grading 3-tingkat.  |
| lycopersicum)     | - best.onnx (10,66 MB)     | - rotten-tomato       | Tidak memiliki kelas      |
|                   | model-export/weights/      |                       | Grade B (cacat kosmetik). |
+-------------------+----------------------------+-----------------------+---------------------------+
| Cabai Rawit Hijau | NOT AVAILABLE              | 0 Kelas               | NOT APPLICABLE            |
| (Capsicum         | - Tidak ada berkas model   | (Tidak ada model      | Berjalan di atas fallback |
| frutescens)       | - Tidak ada dataset        | dan dataset)          | slider pricing manual.    |
+-------------------+----------------------------+-----------------------+---------------------------+
```

### 2.1. Terung (*Solanum melongena*)
- **Artefak:** `server/models/terung/best.pt` (5.489.626 byte) dan `best.onnx` (10.666.390 byte).
- **Arsitektur:** Ultralytics YOLO11n (Nano Object Detection), input $640 \times 640 \times 3$.
- **Taksonomi Kelas:** 4 kelas terdaftar pada `server/models/terung/data.yaml`:
  `names: ['Class I', 'Class II', 'Extra Class', 'Reject']`
- **Distribusi Data Uji:** 311 gambar, 312 anotasi ($1,003$ objek/gambar).
- **Kondisi Faktual:**
  - Model benar-benar dilatih menggunakan foto terung ungu lonjong.
  - Namun, data latih didominasi oleh gambar satu butir terung terisolasi di atas latar belakang bersih (*studio setup*). Model tidak memiliki pemahaman spasial terhadap keranjang panen bertumpuk (*dense crate occlusion*).
  - Terjadi kebingungan klasifikasi (*cross-class confusion*) signifikan: $19\%$ objek aktual `Class II` diprediksi sebagai `Reject`, dan $18\%$ `Reject` diprediksi sebagai `Class II`.

### 2.2. Tomat (*Solanum lycopersicum*)
- **Artefak:** `model-export/weights/best.pt` (5.505.562 byte) dan `best.onnx` (10.663.419 byte).
- **Arsitektur:** Ultralytics YOLO11n, input $640 \times 640 \times 3$, 50 epoch selesai (`model-export/config/results.csv`).
- **Taksonomi Kelas:** 2 kelas terdaftar pada `model-export/config/data.yaml`:
  `names: ['fresh-tomato', 'rotten-tomato']`
- **Kondisi Faktual:**
  - Model hanya membedakan kesegaran umum (*freshness*) vs pembusukan berat (*decay/rotten*).
  - Model **tidak memiliki kemampuan diskriminasi cacat kosmetik ringan**, seperti bekas goresan daun, luka tertutup (*healed scars*), deviasi bentuk (*catfacing*), maupun ukuran/diameter buah.
  - Dataset asal (`test.v2i.yolov11.zip`) memiliki ketidakseimbangan kelas ekstrem ($83,1\%$ segar vs $16,9\%$ busuk) dan menderita **175 kebocoran spesimen antar-split** akibat augmentasi citra yang dilakukan sebelum pemisahan data uji.

### 2.3. Cabai Rawit Hijau (*Capsicum frutescens*)
- **Kondisi Faktual:**
  - **Nol aset.** Repositori, subdirektori, arsip zip, maupun sistem berkas lokal tidak memiliki dataset cabai rawit hijau.
  - Tidak ada berkas anotasi, tidak ada script pelatihan, dan tidak ada bobot model.
  - Penanganan komoditas ini di backend (`server/routers/qc.py` baris 80-94) mengembalikan `ai_supported: False` dan mengandalkan rumus STEAM Math statis berdasarkan input slider manual pengguna.

---

## 3. AUDIT KEAMANAN HASIL INFERENCE (TASK A)

Audit mendalam terhadap kode backend dan frontend mengungkapkan 7 celah keamanan inferensi yang berpotensi menghasilkan penyesatan mutu (*misleading QC results*):

```
+----------------------------------------------------------------------------------------------------+
|                                    ML SAFETY VULNERABILITY TRACE                                   |
+-------------------+------------------------------------------+-------------------------------------+
| Titik Kode        | Lokasi Berkas Faktual                    | Celah Keamanan & Potensi Penyesatan |
+-------------------+------------------------------------------+-------------------------------------+
| Backend QC Router | server/routers/qc.py L123-127            | Silent Exception Catching: Error AI |
|                   |                                          | ditelan diam-diam lalu dialihkan    |
|                   |                                          | ke mock sintetis tanpa log teliti.  |
| Backend Pricing   | server/services/pricing_service.py L435  | Forced Grade B = 0.0%: Tomat segar  |
|                   |                                          | otomatis dipaksakan 100% Grade A.   |
| Frontend Scanner  | src/components/BatchQCScanner.jsx L456   | Non-eggplant commodities hardcoded  |
|                   |                                          | ke formula Tomat (Grade B = 0).     |
| Frontend UI Card  | src/components/BatchQCScanner.jsx L1440  | Cabai ditampilkan dalam kartu mutu  |
|                   |                                          | "Tomat Segar" & "Tomat Busuk".      |
| Frontend Results  | src/components/QCResults.jsx L173, L256  | hasAiScan hanya mengecek ada        |
|                   |                                          | inference_result; mock dilabeli AI. |
| QC Certificate    | src/utils/qcCertificateHelper.js L326    | Cabai/mock dicetak sebagai evaluasi |
|                   |                                          | "Ultralytics YOLO11 Vision Engine". |
| Confidence Gate   | server/routers/qc.py L35, L64-69         | Rentang 0.05-0.95 terlalu permisif; |
|                   |                                          | skor 0.10 lolos sebagai deteksi AI. |
+-------------------+------------------------------------------+-------------------------------------+
```

### 3.1. Analisis Detail Celah Keamanan

#### A. Pembungkaman Eksepsi & Fallback Siluman (Silent Mock Fallback)
Pada `server/routers/qc.py` baris 113-137:
```python
if mode == "production" and ai_engine.is_available():
    try:
        raw_detection = ai_engine.predict(...)
        is_simulated = False
    except Exception:
        raw_detection = None
        is_simulated = True

if raw_detection is None:
    is_simulated = True
    raw_detection = await predict_harvest_image_mock(...)
```
- **Masalah:** Jika runtime ONNX crash, memori habis, atau terjadi galat tensor, backend **menelan eksepsi secara diam-diam (*silent failure*)** dan menggantikannya dengan 12 butir objek palsu dari `predict_harvest_image_mock()`.
- **Bahaya:** Pengguna mengira sistem mendeteksi buah di keranjang mereka, padahal sistem hanya menampilkan koordinat bounding box sintetis yang sama berulang-ulang.

#### B. Pemalsuan Label AI di Antarmuka Pengguna (*UI Misleading Badge*)
Pada `src/components/QCResults.jsx` baris 173 dan baris 253-259:
```javascript
const hasAiScan = Boolean(scanResult?.inference_result)
...
<Chip
  color={hasAiScan ? 'primary' : 'default'}
  icon={hasAiScan ? <AutoAwesomeRoundedIcon /> : <AssessmentRoundedIcon />}
  label={hasAiScan ? 'AI Computer Vision' : 'Manual Calculation'}
/>
```
- **Masalah:** Karena `raw_detection` dari mock tetap menyertakan struktur `inference_result`, frontend mengevaluasi `hasAiScan = true`.
- **Dampak:** Hasil simulasi/mock ditampilkan dengan lencana resmi **"AI Computer Vision"** berikon kilau emas (`AutoAwesomeRoundedIcon`). Properti `is_simulated: true` yang dikirim backend diabaikan sepenuhnya oleh frontend.

#### C. Distorsi Sertifikat Mutu Resmi (*Misleading QC Certificate*)
Pada `src/utils/qcCertificateHelper.js` baris 325-344:
```javascript
const modelEngineName = isEggplant
  ? 'Ultralytics YOLO11n (4-Class Commercial Quality)'
  : commodity.toLowerCase().includes('tomat')
    ? 'Ultralytics YOLO11 (2-Class Fresh/Rotten)'
    : hasInference
      ? 'Ultralytics YOLO11 Vision Engine'
      : 'Sistem Analisis Panen SMKN 4 Payakumbuh'
...
evaluator: hasInference ? 'Agri-Sort AI Autonomous Engine' : 'Sistem Analisis Panen SMKN 4 Payakumbuh'
```
- **Masalah:** Lembar PDF/cetak sertifikat menyatakan bahwa inspeksi dilakukan secara otonom oleh *"Agri-Sort AI Autonomous Engine"* menggunakan *"Ultralytics YOLO11 Vision Engine"*, bahkan ketika komoditas yang dipindai adalah Cabai Rawit Hijau (yang tidak memiliki model) atau hasil fallback mock.
- **Bahaya Hukum & Reputasi:** Klaim sertifikasi mutu ini cacat integritas dan dapat dituntut oleh asosiasi pedagang/petani karena mencantumkan verifikasi kecerdasan buatan fiktif.

#### D. Penanganan Confidence Rendah & Gambar Tidak Layak Uji
- **Ambang Batas Terlalu Rendah:** Endpoint `/api/v1/qc/scan` mengizinkan parameter `confidence_threshold` serendah $0.05$ (5%). Pada batas ini, *noise* latar belakang, kerutan daun, dan bayangan nampan akan terdeteksi sebagai buah tomat segar atau terung afkir.
- **Penanganan Gambar Buram / Gelap:** Modul `server/utils/image_quality.py` telah mendeteksi blur ($\sigma^2 < 100$) dan exposure ekstrem. Namun, router `server/routers/qc.py` belum menggunakan status tersebut untuk memblokir inferensi atau menandai status khusus. Gambar buram tetap diproses dan menghasilkan prediksi acak ber-confidence marginal.

### 3.2. Usulan Mekanisme Status Eksekusi Terstruktur (Standardized Execution Status Contract)

Untuk menghentikan penyesatan hasil dan memastikan arsitektur yang aman dan transparan, diusulkan penerapan 5 status eksekusi mutlak pada kontrak respons API:

```
+----------------------------------------------------------------------------------------------------+
|                             PROPOSED EXECUTION STATUS TAXONOMY                                     |
+---------------------+-------------------------------------------------------+---------------------+
| Kode Status         | Kondisi Pemicu & Aturan Operasional                   | Perilaku Frontend   |
+---------------------+-------------------------------------------------------+---------------------+
| `ai_detected`       | Model resmi komoditas tersedia, bobot ONNX/PyTorch    | Lencana Hijau:      |
|                     | berhasil memproses citra, confidence memenuhi batas   | "AI Verified Scan"  |
|                     | aman (>= 0.35), citra lolos uji blur & exposure.      | Bounding box aktif. |
+---------------------+-------------------------------------------------------+---------------------+
| `needs_review`      | Model resmi berjalan, TETAPI terdeteksi anomali:      | Lencana Oranye:     |
|                     | - Rata-rata confidence rendah (< 0.45)                | "Perlu Verifikasi   |
|                     | - Ambiguitas Class II vs Reject > 20%                 | Manual Petugas"     |
|                     | - Citra buram (Laplacian var < 100) atau bayangan     | Peringatan visual.  |
|                     | - Zero objects detected (keranjang kosong/gelap)      |                     |
+---------------------+-------------------------------------------------------+---------------------+
| `simulated`         | Pengguna secara eksplisit meminta mode simulasi       | Lencana Biru Abu:   |
|                     | (`mode="mock"`), atau sistem dalam lingkungan uji     | "Simulasi Edukasi / |
|                     | otomatis (automated testing).                         | Non-AI"             |
+---------------------+-------------------------------------------------------+---------------------+
| `unsupported`       | Komoditas yang diminta belum memiliki model computer  | Lencana Abu-abu:    |
|                     | vision resmi (Cabai Rawit Hijau, Cabai Merah, dll).   | "Estimasi Manual    |
|                     | Output diarahkan ke kalkulasi formula harga manual.   | (Model Belum Ada)"  |
+---------------------+-------------------------------------------------------+---------------------+
| `model_unavailable` | Komoditas didukung kode, tetapi berkas bobot model    | Alert Merah:        |
|                     | `.onnx`/`.pt` tidak ditemukan di server atau engine   | "Model AI Tidak     |
|                     | inferensi mengalami kegagalan inisialisasi runtime.   | Dapat Dimuat"       |
+---------------------+-------------------------------------------------------+---------------------+
```

#### Spesifikasi Kontrak Respons API Baru (`POST /api/v1/qc/scan` & `/scan-multi`):
```json
{
  "status": "success",
  "data": {
    "scan_id": "scan_20261109_a1b2c3",
    "timestamp": "2026-11-09T09:45:00Z",
    "commodity": "Terung",
    "execution_status": "needs_review",
    "status_details": {
      "code": "HIGH_GRADE_AMBIGUITY",
      "message": "Terdeteksi 3 sampel dengan ambiguitas tinggi antara Class II dan Reject. Verifikasi manual disarankan.",
      "is_ai_generated": true,
      "requires_human_confirmation": true
    },
    "image_quality": {
      "is_valid": true,
      "blur_score": 142.5,
      "exposure": "normal",
      "clahe_applied": true
    },
    "business_grading": {
      "grading_status": "provisional",
      "grade_breakdown": {
        "grade_a_percent": 65.0,
        "grade_b_percent": 20.0,
        "reject_percent": 15.0
      }
    }
  }
}
```

---

## 4. VALIDASI GRADING RUBRIC (TASK B)

Audit memeriksa ketersediaan standar mutu resmi, definisi dataset, dan validitas pemetaan untuk masing-masing komoditas.

### 4.1. Tabel Validasi Rubrik Mutu Terung (*Solanum melongena*)

| Komponen Rubrik | Status Temuan | Bukti & Lokasi Kode / Dokumen | Evaluasi Auditor |
|---|:---:|---|---|
| **Standar Mutu Resmi** | `NOT VERIFIED` | Legacy code sempat mencantumkan SNI 01-3162-1992, namun verifikasi standar menunjukkan bahwa SNI 01-3162-1992 adalah standar mutu *Tomat Segar*, bukan Terung Segar. Standar resmi SNI untuk Terung Segar berstatus `NOT VERIFIED` di repositori. Model Terung mengadopsi taksonomi 4-kelas UNECE Standard FFV-05 (Aubergines), bukan SNI. Standar Tomat tidak boleh dijadikan pembenaran mutu Terung. | Belum ada standar SNI Terung yang diverifikasi di repositori. |
| **Definisi Kelas Dataset Asli** | `VERIFIED` | `server/models/terung/data.yaml` mencantumkan 4 kelas dari Roboflow: `Class I`, `Class II`, `Extra Class`, `Reject`. | Taksonomi ini mengadopsi standar internasional UNECE Standard FFV-05 (Eggplants) yang membagi mutu menjadi Extra Class, Class I, dan Class II. |
| **Kriteria Visual Kelas** | `VERIFIED` | `docs/detail-model.md` L90-98 & `server/models/terung/model-metadata.json` L66-75. | - *Extra Class:* Bentuk lurus simetris, warna ungu mengkilap, bebas goresan.<br>- *Class I:* Kelengkungan ringan (<10%), goresan kulit mikro non-patogen.<br>- *Class II:* Kelengkungan nyata (10-25%), cacat kulit hingga 3 cm².<br>- *Reject:* Busuk basah, lubang gerekan ulat, busuk phytophthora. |
| **Pemetaan Kelas ke Grade A/B/Reject** | `PROVISIONAL (NOT VERIFIED)` | `server/services/pricing_service.py` L398-402 (`Extra + Class I -> Grade A; Class II -> Grade B; Reject -> Reject`). | **PROVISIONAL BUSINESS CONVENTION.** Pengelompokan Extra dan Class I ke Grade A adalah konvensi bisnis proposal STEAM Agri-Sort AI untuk pasar komersial, namun **belum diverifikasi secara agronomis** terhadap standar mutu nasional. |
| **Validitas Ilmiah / Agronomis** | `NOT VERIFIED` | Belum ada lembar pengesahan resmi (*expert signed rubrics*) dari ahli agronomi/hortikultura independen. | Berstatus *provisional business convention*, tidak boleh diklaim sebagai standar agronomis tervalidasi. |

### 4.2. Tabel Validasi Rubrik Mutu Tomat (*Solanum lycopersicum*)

| Komponen Rubrik | Status Temuan | Bukti & Lokasi Kode / Dokumen | Evaluasi Auditor |
|---|:---:|---|---|
| **Standar Mutu Resmi** | `NOT VERIFIED` | SNI 01-3162-1992 adalah standar *Tomat Segar*, namun naskah resmi tidak tersimpan di repositori. Model Tomat yang ada saat ini hanya membedakan biner kesegaran (*Fresh* vs *Rotten*), bukan 3-kelas mutu (Mutu I, Mutu II, Mutu III). Standar mutu grading Tomat berstatus `NOT VERIFIED`. | Tidak ada standar formal yang dijadikan acuan dalam penyusunan model Tomat saat ini. |
| **Definisi Kelas Dataset Asli** | `VERIFIED` | `model-export/config/data.yaml` L5-6 mencantumkan: `names: ['fresh-tomato', 'rotten-tomato']`. | Dataset murni biner kesegaran vs pembusukan. |
| **Kriteria Visual Kelas** | `PARTIALLY VERIFIED` | Citra `fresh-tomato` berupa buah bulat mulus; `rotten-tomato` berupa buah bercak hitam/berjamur. | Kriteria visual cacat kosmetik sedang, tingkat kematangan warna (hijau, kuning, merah), dan ukuran buah **TIDAK TERDEFINISI** dalam dataset. |
| **Pemetaan Kelas ke Grade A/B/Reject** | `FAILED` | `server/services/pricing_service.py` L434-436 (`fresh -> Grade A; Grade B = 0.0%; rotten -> Reject`). | **TIDAK VALID SECARA MUTU HORTIKULTURA.** Mengasumsikan semua tomat yang tidak busuk adalah Grade A prima adalah pelanggaran standar sortasi pasar. |
| **Validitas Ilmiah / Agronomis** | `FAILED` | Tidak ada justifikasi agronomis yang membenarkan peniadaan Grade B pada komoditas tomat meja. | Pemetaan saat ini menyesatkan valuasi ekonomi panen dan wajib dirombak sebelum rilis komersial. |

### 4.3. Tabel Validasi Rubrik Mutu Cabai Rawit Hijau (*Capsicum frutescens*)

| Komponen Rubrik | Status Temuan | Bukti & Lokasi Kode / Dokumen | Evaluasi Auditor |
|---|:---:|---|---|
| **Standar Mutu Resmi** | `NOT VERIFIED` | Repositori tidak memiliki dokumen acuan standar mutu cabai (SNI 01-4480-1998 / SNI 4480:2018 *Cabai Rawit Segar*). | Belum ada dokumentasi rubrik di repositori. |
| **Definisi Kelas Dataset Asli** | `NOT AVAILABLE` | Repositori dan disk lokal tidak memiliki dataset cabai. | Nol definisi kelas dataset. |
| **Kriteria Visual Kelas** | `NOT AVAILABLE` | Tidak ada kriteria visual berbasis data citra. | Hanya terdapat acuan tekstual manual di `docs/01-spesifikasi.md` L220-234. |
| **Pemetaan Kelas ke Grade A/B/Reject** | `NOT AVAILABLE` | Di backend `server/routers/qc.py` L83-93 dialihkan ke formula slider kalkulasi manual. | Tidak ada pemetaan kelas AI karena model tidak ada. |
| **Validitas Ilmiah / Agronomis** | `NOT AVAILABLE` | Tidak dapat dievaluasi karena ketiadaan model dan data. | Model berstatus belum dibangun (*uninitiated*). |

---

## 5. RENCANA PENGEMBANGAN DATASET (TASK C)

Agar sistem Agri-Sort AI memiliki performa klasifikasi mutu yang objektif, akurat, dan bebas penyesatan, disusun rencana kebutuhan dataset pra-retraining berikut:

```
+----------------------------------------------------------------------------------------------------+
|                                  DATASET RE-ENGINEERING ROADMAP                                    |
+-------------------+----------------------------+-----------------------+---------------------------+
| Komoditas         | Kelas Mutu Target          | Kebutuhan Citra Baru  | Prioritas Tindakan        |
+-------------------+----------------------------+-----------------------+---------------------------+
| Terung            | 4 Kelas (Extra, I, II, Rej)| 600 Citra Baru        | Pengambilan foto wadah    |
| (Eggplant)        | Dipertahankan              | (Keranjang Panen      | keranjang panen bertumpuk |
|                   |                            | Padat Lahan Nyata)    | & re-anotasi multi-objek. |
+-------------------+----------------------------+-----------------------+---------------------------+
| Tomat             | 3 Kelas Mutu Baru:         | 1.500 Citra Baru      | Rekonstruksi total:       |
| (Tomato)          | - Grade A (Super Prima)    | (Koleksi Mandiri /    | Buang dataset biner lama; |
|                   | - Grade B (Cacat Ringan)   | Kaggle Verified       | susun taksonomi 3-kelas   |
|                   | - Reject  (Busuk/Afkir)    | Bebas Leakage)        | bebas data leakage.       |
+-------------------+----------------------------+-----------------------+---------------------------+
| Cabai Rawit Hijau | 3 Kelas Mutu Standar SNI:  | 2.000 Citra Baru      | Akuisisi data dari nol di |
| (Chili)           | - Grade A (Lurus, >3cm)    | (Pasar Induk & Lahan  | sentra produksi cabai     |
|                   | - Grade B (Bengkok/Kusam)  | Petani Payakumbuh)    | Sumatera Barat.           |
|                   | - Reject  (Antraknosa/Layu)|                       |                           |
+-------------------+----------------------------+-----------------------+---------------------------+
```

### 5.1. Rincian Kebutuhan & Protokol Penanganan Risiko Data

#### A. Komoditas Terung
- **Masalah Saat Ini:** Dataset lama Roboflow hanya memiliki 1 objek per gambar dengan latar belakang bersih.
- **Strategi Pengayaan Data:**
  - Ambil 600 foto keranjang panen riil (keranjang plastik bolong, nampan bambu, karung) dengan pencahayaan kebun alami.
  - Setiap foto harus memuat 10 hingga 30 butir terung bertumpuk.
  - Lakukan anotasi bounding box teliti pada setiap butir terung yang tampak, menandai secara tegas mana yang `Class II` (bengkok, bercak kulit kering non-patogen) dan mana yang `Reject` (busuk basah, berlendir, lubang ulat).
- **Mitigasi Class Imbalance:** Pastikan kuota anotasi seimbang ($25\%$ Extra, $25\%$ Class I, $25\%$ Class II, $25\%$ Reject).

#### B. Komoditas Tomat
- **Masalah Saat Ini:** Dataset biner `fresh` vs `rotten` menderita 175 kebocoran spesimen antar-split.
- **Strategi Rekonstruksi Data:**
  - **Hentikan penggunaan dataset `test-urup2/2`**.
  - Bentuk dataset baru dengan taksonomi 3-kelas:
    1. `Grade A`: Tomat bulat simetris, diameter $\ge 5\text{ cm}$, kulit mulus mengkilap, bebas cacat.
    2. `Grade B`: Tomat matang dengan goresan mekanis kering, bentuk asimetris (*catfacing* ringan), atau ukuran sedang ($3,5 - 5\text{ cm}$).
    3. `Reject`: Tomat busuk berjamur, pecah berair, busuk pantat (*blossom end rot*), atau berlubang lalat buah.
  - **Protokol Pencegahan Data Leakage:** Terapkan pemisahan berbasis sesi panen / identitas pohon (*Specimen Group Split*). Citra hasil augmentasi dilarang keras disebar melintasi split Train dan Test.

#### C. Komoditas Cabai Rawit Hijau
- **Varietas Target:** Cabai Rawit Hijau lokal (*Capsicum frutescens*), bukan cabai merah keriting dan bukan paprika.
- **Kondisi Pengambilan Citra:**
  - Variasi wadah: nampan plastik biru, karung waring putih, meja kayu sortir.
  - Variasi pencahayaan: sinar matahari langsung, naungan pohon, lampu gudang neon.
  - Variasi sudut: tampak atas tegak lurus ($90^\circ$) dan sudut miring ($45^\circ$).
- **Taksonomi Anotasi:**
  - `Grade A`: Panjang $\ge 3\text{ cm}$, hijau cerah segar, tangkai utuh hijau, bebas bercak.
  - `Grade B`: Panjang $2 - 3\text{ cm}$, agak bengkok, hijau kekuningan/kusam, tangkai layu.
  - `Reject`: Terinfeksi patek/antraknosa (*Colletotrichum*), busuk basah becek, layu kering mengkerut.

---

## 6. ANALISIS RISIKO TEKNIS (TECHNICAL RISK ASSESSMENT)

Audit mengidentifikasi 4 risiko teknis utama yang harus diantisipasi tim pengembang:

```
+----------------------------------------------------------------------------------------------------+
|                                    TECHNICAL RISK MATRIX                                           |
+---------------------+-------------+-----------+----------------------------------------------------+
| Kategori Risiko     | Probabilitas| Keparahan | Skenario Dampak & Mitigasi                         |
+---------------------+-------------+-----------+----------------------------------------------------+
| Risiko Finansial    | TINGGI      | KRITIS    | Kesalahan klasifikasi Grade B Tomat menjadi Grade  |
| Petani              |             |           | A memicu penolakan retur kargo di pasar modern;    |
|                     |             |           | false reject pada Terung merugikan petani 80% harga|
+---------------------+-------------+-----------+----------------------------------------------------+
| Risiko Regulasi     | SEDANG      | TINGGI    | Menerbitkan sertifikat QC resmi dengan klaim AI    |
| & Kredibilitas      |             |           | otonom pada komoditas non-AI berpotensi melanggar  |
|                     |             |           | UU Perlindungan Konsumen & etika AI.               |
+---------------------+-------------+-----------+----------------------------------------------------+
| Risiko Stabilitas   | TINGGI      | TINGGI    | Ketiadaan `opencv-python-headless` di requirements |
| Server Produksi     |             |           | menyebabkan container backend crash saat deployment|
|                     |             |           | di lingkungan cloud baru.                          |
+---------------------+-------------+-----------+----------------------------------------------------+
| Risiko Generalisasi | TINGGI      | SEDANG    | Model terung gagal mendeteksi keranjang padat tanpa|
| Lapangan (Edge)     |             |           | modul SAHI karena bias dataset single-object.      |
+---------------------+-------------+-----------+----------------------------------------------------+
```

---

## 7. RENCANA PERBAIKAN BERDASARKAN PRIORITAS (TASK D)

Berikut adalah urutan kerja rekayasa bertahap (*actionable engineering roadmap*) sebelum retraining dilakukan:

```
+----------------------------------------------------------------------------------------------------+
|                                 PRIORITIZED REMEDIATION ROADMAP                                    |
+----------------------------------------------------------------------------------------------------+

  [P0 — KESELAMATAN & KEBENARAN HASIL QC (PRA-SYARAT MUTLAK)]
  1. Perbaiki Kontrak API Backend (server/routers/qc.py):
     - Kembalikan `execution_status`: 'ai_detected' | 'simulated' | 'needs_review' | 'unsupported' | 'model_unavailable'.
     - Hentikan pembungkaman eksepsi `except Exception:`; catat stack trace error secara transparan.
     - Blokir inferensi atau set 'needs_review' jika gambar buram (Laplacian var < 100) atau confidence < 0.35.
  2. Perbaiki Tampilan Antarmuka Frontend (QCResults.jsx & BatchQCScanner.jsx):
     - Ganti lencana "AI Computer Vision" dengan "Estimasi Manual / Simulasi" jika status bukan 'ai_detected'.
     - Jangan tampilkan kartu "Tomat Segar" jika komoditas yang dipindai adalah Cabai.
  3. Amankan Sertifikat QC (src/utils/qcCertificateHelper.js):
     - Jangan cantumkan "Ultralytics YOLO11 Vision Engine" atau "AI Autonomous Engine" jika komoditas Cabai
       atau jika status pemindaian adalah simulasi/mock.
  4. Perbaiki Dependency:
     - Tambahkan `opencv-python-headless>=4.8.0` ke dalam server/requirements.txt.

  [P1 — VALIDITAS GRADING RUBRIC & HYGIENE DATASET]
  1. Hentikan pemetaan paksa Grade B = 0.0% pada komoditas Tomat di server/services/pricing_service.py.
  2. Susun dokumen formal Visual Grading Rubric untuk 3 komoditas dengan melibatkan praktisi hortikultura.
  3. Bersihkan data leakage pada dataset Tomat dengan menghapus subset yang terkontaminasi.

  [P2 — AKUISISI DATA, RETRAINING, & EVALUASI MODEL]
  1. Kumpulkan 1.500 citra Tomat 3-Tier (Grade A, Grade B, Reject) dan lakukan retraining YOLO11n.
  2. Kumpulkan 600 citra keranjang Terung padat untuk melengkapi dataset Terung 4-kelas.
  3. Kumpulkan 2.000 citra Cabai Rawit Hijau dan latih model YOLO11n Cabai perdana.
  4. Ekspor seluruh bobot model terbaik ke format ONNX Runtime CPU (opset 22).

  [P3 — OPTIMASI PERFORMA & DEPLOYMENT EDGE]
  1. Bersihkan arsip zip redundan (>54 MB) dari repositori git.
  2. Optimalkan latency SAHI pada CPU multi-threading.
  3. Uji kuantisasi INT8 untuk komputasi edge ringan.
```

---

## 8. ACCEPTANCE CRITERIA UNTUK TAHAP BERIKUTNYA

Tahap persiapan dataset dan retraining **HANYA BOLEH DIMULAI** apabila seluruh kriteria penerimaan (*acceptance criteria*) di bawah ini telah terpenuhi:

- [ ] **AC-01 (API Contract):** Endpoint `POST /api/v1/qc/scan` dan `/scan-multi` mengembalikan properti `execution_status` resmi (`ai_detected`, `simulated`, `needs_review`, `unsupported`, `model_unavailable`) dan diuji lewat automated test.
- [ ] **AC-02 (Anti-Misleading UI):** Frontend tidak lagi menampilkan lencana *"AI Computer Vision"* untuk pemindaian Cabai, mode mock, atau saat server fallback.
- [ ] **AC-03 (Certificate Integrity):** Lembar PDF / cetak Sertifikat QC secara jujur membedakan antara inspeksi AI terverifikasi dengan estimasi manual.
- [ ] **AC-04 (Dependency Cleanliness):** `opencv-python-headless` tercantum di `server/requirements.txt` dan lulus verifikasi pada container bersih tanpa error `ModuleNotFoundError`.
- [ ] **AC-05 (Rubric Documentation):** Tersedia dokumen rubrik visual grading resmi yang mendefinisikan kriteria fisik Grade A, Grade B, dan Reject untuk ketiga komoditas.
- [ ] **AC-06 (No Data Leakage Policy):** Pipeline splitting dataset baru wajib menerapkan *Group Split by Specimen ID* dengan jaminan 0 kebocoran varian augmentasi antar-split.

---

## 9. KEPUTUSAN FINAL ARSITEK SISTEM (ARCHITECTURAL DECISION)

Berdasarkan seluruh temuan audit keamanan, taksonomi rubrik mutu, dan verifikasi repositori:

> ### ⛔ STATUS KEPUTUSAN: **BELUM SIAP (NOT READY) UNTUK TAHAP RETRAINING**
>
> **Justifikasi:**  
> Repositori saat ini **belum siap memasuki tahap pelatihan ulang model (*retraining phase*)** karena celah keamanan hasil inferensi di lapisan backend dan frontend (P0) masih terbuka, taksonomi mutu Tomat masih cacat (Grade B ditiadakan), dan rubrik visual mutu resmi belum dibakukan.
>
> Melakukan pelatihan model sebelum mengamankan kontrak inferensi dan taksonomi mutu akan menghasilkan model yang sia-sia karena pipeline hilir masih mengadopsi asumsi penyesatan (*misleading assumptions*).
>
> **Rekomendasi Langkah Segera:**  
> Selesaikan seluruh item perbaikan **Prioritas 0 (P0)** dan tetapkan dokumen rubrik mutu **Prioritas 1 (P1)** terlebih dahulu. Setelah kriteria AC-01 hingga AC-06 terpenuhi, repositori baru dinyatakan layak memasuki fase pengumpulan dataset dan retraining model AI.

---
*Laporan ini disusun secara independen dan objektif oleh Senior Machine Learning Engineer, Computer Vision Engineer & Software Architect Agri-Sort AI.*
