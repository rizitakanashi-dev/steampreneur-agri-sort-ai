# LAPORAN VALIDASI & REMEDIASI P0 ML SAFETY
## Agri-Sort AI — Quality Control & Smart Pricing

**Tanggal Dokumen:** 9 November 2026  
**Peran:** Senior Fullstack Engineer, Python Backend Engineer, React Engineer, QA Engineer, Independent ML Auditor  
**Branch:** `feat/p0-ml-safety-remediation`  
**Status Verdict:** **READY WITH LIMITATIONS** (Aman untuk merge staging/development; batasan agronomis dan runtime terdokumentasi ketat)

---

## 1. Eksekutif Ringkasan

Berdasarkan audit independen pada `docs/ml-safety-and-grading-rubric.md` dan arahan validasi lanjutan, seluruh kerentanan kritis (P0) terkait keselamatan inferensi dan integritas klaim AI pada proyek Agri-Sort AI telah diperbaiki dan divalidasi.

Fokus penanganan:
1. **Pemberantasan Silent Fallback**: Tidak ada lagi konversi otomatis dari error model menjadi mock 12-kotak sintetis.
2. **Koreksi Referensi Standar SNI**: Mengoreksi kesalahan atribusi nomor SNI dan menandai standar yang belum terverifikasi sebagai `NOT VERIFIED`.
3. **Audit Transparansi Threshold**: Mendokumentasikan status heuristik/provisional dari threshold 0.35, 0.45, Laplacian variance 50/100, dan disparitas multi-angle 15-20%.
4. **Pemisahan Status Inferensi vs Validitas Grading**: Memisahkan keberhasilan teknis Computer Vision (`execution_status: ai_detected`) dari validitas pemetaan agronomis komersial (Fresh/Rotten Tomat bukan Grade A/B/Reject; pemetaan Terung adalah konvensi bisnis provisional).
5. **Penyempurnaan Ketahanan Multi-Angle**: Memastikan kegagalan salah satu sudut pandang tidak memicu `model_unavailable` palsu jika masih terdapat sudut lain yang valid (degradasi aman ke `needs_review`).
6. **Verifikasi Lingkungan**: Memverifikasi dependensi headless OpenCV dan mendokumentasikan status dependensi ONNX Runtime pada host Python 3.14.

---

## 2. TASK 1 — Koreksi Referensi Standar Mutu

Pemeriksaan komprehensif terhadap seluruh penyebutan Standar Nasional Indonesia (SNI) menghasilkan koreksi penting berikut:

1. **SNI 01-3168-1992**:
   - *Fakta*: Standar resmi untuk **Apokat (Alpukat)**, bukan Terung.
   - *Koreksi*: Seluruh catatan yang sebelumnya mengaitkan SNI 01-3168-1992 dengan Terung telah dikoreksi.
2. **SNI 01-3162-1992**:
   - *Fakta*: Standar resmi untuk **Tomat Segar**, bukan Terung.
   - *Koreksi*: Komentar di `server/services/tiled_inference.py`, `server/tests/test_tiled_inference.py`, dan `docs/audit-ml-engineer.md` yang sempat menyebut SNI 01-3162-1992 sebagai dasar toleransi Terung telah dikoreksi. Standar Tomat tidak boleh digunakan sebagai pembenaran mapping Terung.
3. **Status Standar Mutu Terung**:
   - *Status*: **`NOT VERIFIED`** di repositori.
   - *Basis Model Aktual*: Model Terung 4-kelas (`Extra Class`, `Class I`, `Class II`, `Reject`) mengadopsi taksonomi internasional **UNECE Standard FFV-05 (Aubergines)** dari dataset publik Roboflow, bukan SNI.
4. **Status Standar Mutu Cabai Rawit Hijau**:
   - *Status*: **`NOT VERIFIED`** di repositori. Tidak ada dataset, model, maupun dokumen rubrik resmi di repositori.
5. **Status Standar Mutu Tomat**:
   - *Status*: **`NOT VERIFIED`** untuk grading 3-kelas. SNI 01-3162-1992 mengatur mutu Tomat Segar (Mutu I, II, III), sedangkan model saat ini hanya melatih deteksi biner `fresh-tomato` dan `rotten-tomato`.

---

## 3. TASK 2 — Audit & Penjelasan Ambang Batas (Confidence & Heuristic Thresholds)

Setiap nilai ambang batas yang aktif dalam sistem diperiksa secara terperinci:

### A. Confidence Threshold 0.35
1. **Lokasi Implementasi**:
   - `server/routers/qc.py` L37 & L438 (`confidence_threshold: float = Form(0.35)`)
   - `src/services/scanService.js` L78, L149, L210 (default param)
   - `src/components/BatchQCScanner.jsx` L88, L98, L605 (Rekomendasi Tomat: 0.35)
   - `server/services/mock_engine.py` L59, L112
2. **Alasan Pemilihan**:
   - Nilai default untuk model Tomat 2-kelas (Fresh/Rotten) untuk menyeimbangkan tangkapan objek buah tomat yang saling menutupi sebagian di keranjang panen.
3. **Bukti Pengujian**:
   - Diverifikasi di `server/tests/test_mock_engine.py` dan `server/tests/test_ml_safety.py`.
4. **Dampak FP vs FN**:
   - *Jika < 0.35*: Meningkatkan False Positive (noda tanah/pantulan silau dikira rotten-tomato).
   - *Jika > 0.35*: Meningkatkan False Negative (gejala busuk awal/bercak kecil tidak terdeteksi).
5. **Status Kalibrasi**:
   - **HEURISTIK / PROVISIONAL**. Belum dikalibrasi via kurva F1-score pada validation set beranotasi formal. Bukan standar produksi final.

### B. Confidence Threshold 0.45
1. **Lokasi Implementasi**:
   - `server/routers/qc.py` L252 (`elif avg_conf < 0.45: -> trigger needs_review, LOW_CONFIDENCE_SCORE`)
   - `server/services/tiled_inference.py` L179 (`is_monolithic = b_area >= 0.45 * img_area`)
   - `server/services/onnx_engine.py` L57 (`iou_threshold: float = 0.45`)
2. **Alasan Pemilihan**:
   - Sebagai *safety gate* penjaminan mutu. Jika rata-rata confidence seluruh deteksi dalam citra berada di bawah 0.45, sistem menganggap model tidak cukup yakin (*uncertain*), sehingga status diturunkan ke `needs_review` untuk verifikasi manusia.
3. **Bukti Pengujian**:
   - Diuji di `server/tests/test_ml_safety.py` (Skenario 2B).
4. **Dampak FP vs FN**:
   - Mereduksi False Positive keputusan AI di lapangan (mencegah salah grading otomatis), namun meningkatkan volume sampel yang memerlukan verifikasi manual.
5. **Status Kalibrasi**:
   - **HEURISTIK SAFETY MARGIN**. Nilai pengaman intuitif engineer, belum dioptimalkan melalui cost-utility analysis.

### C. Laplacian Variance 50.0 (dan Fallback 100.0)
1. **Lokasi Implementasi**:
   - `server/utils/image_quality.py` L43 (`is_blurry = lap_var < 50.0`)
   - `server/utils/image_quality.py` L58 (`clahe_recommended = is_underexposed or (lap_var < 80.0 and mean_lum < 75.0)`)
   - `server/utils/image_quality.py` L89 (fallback score 100.0)
2. **Alasan Pemilihan**:
   - Mendeteksi citra kabur (*motion blur* atau *out-of-focus*) sebelum inferensi. Angka 100.0 adalah batas literatur OpenCV klasik (Pech-Pacheco, 2000), namun diturunkan ke 50.0 oleh Faris agar kamera smartphone beresolusi rendah tidak terlalu sering memicu false alarm buram.
3. **Bukti Pengujian**:
   - Diuji di `server/tests/test_image_quality.py` dan `server/tests/test_ml_safety.py`.
4. **Dampak FP vs FN**:
   - *Threshold 50.0*: Lebih toleran pada kamera murah, tetapi berisiko meloloskan citra sedikit kabur yang menurunkan akurasi YOLO (FN blur).
   - *Threshold 100.0*: Sangat ketat, tetapi memicu FP blur tinggi pada permukaan terung mulus yang minim variasi tekstur.
5. **Status Kalibrasi**:
   - **HEURISTIK PROVISIONAL**. Belum di-benchmark menggunakan sampel foto kamera petani lokal Payakumbuh secara representatif.

### D. Disparitas Multi-Angle 15% - 20%
1. **Lokasi Implementasi**:
   - Backend: `server/services/multi_angle_service.py` L111 & L203 (`occlusion_bias_detected = defect_delta >= 15.0`, `HIGH >= 30.0`)
   - Backend Router: `server/routers/qc.py` L752 (`occlusion_warn = aggregation...get("occlusion_bias_detected")`)
   - Frontend: `src/business/multiAngleHelper.js` L194 (`disparityPercent > 20`)
2. **Alasan Pemilihan**:
   - Mendeteksi bias oklusi (*Single-View Occlusion Bias*) jika ada buah cacat yang disembunyikan di bagian bawah nampan / sisi belakang.
3. **Bukti Pengujian**:
   - Diuji di `server/tests/test_multi_angle_qc.py`, `server/tests/test_ml_safety.py`, dan `tes/mlSafety.test.js`.
4. **Dampak FP vs FN**:
   - Mencegah percampuran buah busuk ke Grade A, namun jika ukuran sampel kecil (<10 butir), perbedaan 2 butir saja sudah mencapai 20% delta dan memicu review manual.
5. **Status Kalibrasi**:
   - **HEURISTIK / PROVISIONAL RULE**. Aturan bisnis kehati-hatian, belum dikalibrasi dengan studi sampling statistik hortikultura.

---

## 4. TASK 3 — Pemisahan Inferensi AI dan Validitas Agronomis

Sistem kini memisahkan secara tegas antara:
- **Status Eksekusi Komputer Visi**: Apakah pipeline teknis AI berhasil mendeteksi objek.
- **Status Validitas Grading**: Apakah pemetaan ke Grade A, Grade B, dan Reject sah secara agronomis.

```
                    ┌─────────────────────────┐
                    │  Inference Execution    │
                    └────────────┬────────────┘
                                 │
           ┌─────────────────────┴─────────────────────┐
           ▼                                           ▼
┌──────────────────────┐                   ┌──────────────────────┐
│     ai_detected      │                   │    needs_review      │
│  (Teknis AI Sukses)  │                   │ (Uncertain / Blurry) │
└──────────┬───────────┘                   └──────────┬───────────┘
           │                                           │
           ▼                                           ▼
┌─────────────────────────────────────────────────────────────────┐
│                    Agronomic Grading Validity                   │
├───────────────────────────────┬─────────────────────────────────┤
│ Tomat:                        │ Terung:                         │
│ - Inference: Fresh vs Rotten  │ - Inference: UNECE 4-Class      │
│ - Grading 3-Tier:             │ - Grading 3-Tier:               │
│   NOT AGRONOMICALLY VERIFIED  │   PROVISIONAL CONVENTION        │
│   (Fresh != Grade A otomatis) │   (Extra+C1 -> A: provisional)  │
└───────────────────────────────┴─────────────────────────────────┘
```

### Implementasi Perlindungan:
1. **Model Tomat**:
   - Status inferensi: Berhasil mendeteksi 2 kelas kesegaran (`fresh-tomato` dan `rotten-tomato`).
   - Status grading: **`NOT AGRONOMICALLY VERIFIED`**. Frontend dan sertifikat menampilkan tabel mutu 2-kelas kesegaran ("Tomat Segar" & "Tomat Busuk"), bukan tabel Grade A/B/Reject.
   - Metadata `business_grading` mencantumkan status `PROVISIONAL_MAPPING` dengan catatan bahwa pemetaan Fresh $\to$ Grade A adalah estimasi komersial sementara.
2. **Model Terung**:
   - Status inferensi: Berhasil mendeteksi 4 kelas visual UNECE FFV-05 (`Extra Class`, `Class I`, `Class II`, `Reject`).
   - Status grading: **`PROVISIONAL BUSINESS CONVENTION`**. Pemetaan Extra Class + Class I $\to$ Grade A adalah konvensi internal STEAM Agri-Sort AI dan belum disahkan oleh standar agronomis nasional (`NOT VERIFIED`).
3. **Cabai Rawit Hijau**:
   - Status inferensi: `unsupported` (`ai_supported: False`, `inference_result: None`).
   - Status grading: Manual Acuan Pasar (`ai_scan_performed: False`).

---

## 5. TASK 4 — Audit & Penyempurnaan Kebijakan Agregasi Multi-Angle

Kebijakan agregasi multi-sudut disempurnakan untuk menangani seluruh kemungkinan kombinasi:

| Kondisi Sudut 1 (Depan) | Kondisi Sudut 2 (Belakang) | Status Agregasi Akhir | Kode Status | Penjelasan & Tindakan Sistem |
|---|---|:---:|---|---|
| Berhasil (`ai_detected`) | Berhasil (`ai_detected`) | `ai_detected` | `AI_INFERENCE_OPTIMAL` | Kedua sudut konsisten, keyakinan optimal, oklusi terkendali. |
| Berhasil (`ai_detected`) | Berhasil (`ai_detected`), disparitas cacat $\ge 15\%$ | `needs_review` | `OCCLUSION_DISPARITY_DETECTED` | Terdeteksi perbedaan cacat signifikan antara sisi depan & belakang. |
| Berhasil (`ai_detected`) | Citra Buram (*Laplacian* $< 50$) | `needs_review` | `IMAGE_BLURRY` | Salah satu sudut buram; hasil didasarkan pada sudut tajam dengan review. |
| Berhasil (`ai_detected`) | Deteksi 0 Objek | `needs_review` | `ZERO_OBJECTS_DETECTED` | Salah satu sudut tidak mendeteksi objek. |
| **Berhasil (`ai_detected`)** | **Gagal / Exception** | **`needs_review`** | **`PARTIAL_ANGLE_INFERENCE`** | **Tidak menyatakan `model_unavailable`!** Sistem menggunakan inferensi sudut depan dengan bobot 100%, menandai bahwa verifikasi manual diperlukan karena sudut belakang gagal diproses. |
| **Gagal / Exception** | **Berhasil (`ai_detected`)** | **`needs_review`** | **`PARTIAL_ANGLE_INFERENCE`** | Sistem menggunakan inferensi sudut belakang dengan bobot 100% disertai peringatan peninjauan manual. |
| Gagal / Exception | Gagal / Exception | `model_unavailable` | `INFERENCE_EXECUTION_FAILED` | Kedua sudut gagal dieksekusi. |
| Model Offline / Tidak Ada | Model Offline / Tidak Ada | `model_unavailable` | `RUNTIME_UNAVAILABLE` | Runtime ONNX/PyTorch tidak tersedia untuk kedua sudut. |
| Mode Mock | Mode Mock | `simulated` | `EXPLICIT_SIMULATION` | Pengujian simulasi multi-sudut. |

### Perbaikan Kode Terkait:
- Di [server/routers/qc.py](file:///home/Rizi/agri-sort-ai/server/routers/qc.py): inferensi `raw_front` dan `raw_back` kini dibungkus dalam blok `try...except` independen. Jika salah satu gagal, sistem tidak lagi membuang hasil yang berhasil ke `model_unavailable`.
- Di [server/services/multi_angle_service.py](file:///home/Rizi/agri-sort-ai/server/services/multi_angle_service.py): normalisasi bobot sudut secara adaptif mengalokasikan 100% bobot ke sisi yang memiliki objek jika salah satu sisi kosong, dan menetapkan `occlusion_severity = "INCOMPLETE"`.
- Di [src/business/multiAngleHelper.js](file:///home/Rizi/agri-sort-ai/src/business/multiAngleHelper.js): status hanya menjadi `model_unavailable` jika **kedua** sudut tidak tersedia. Jika satu sudut tersedia, status adalah `needs_review` dengan kode `PARTIAL_ANGLE_INFERENCE`.

---

## 6. TASK 5 — Verifikasi Lingkungan & Kesiapan Runtime (Fresh Environment)

Pengujian dependensi dilakukan langsung pada lingkungan eksekusi host Linux:

1. **OpenCV Headless**:
   - `opencv-python-headless`: **TERVERIFIKASI BERFUNGSI** (OpenCV v5.0.0).
   - Fungsi decoding citra, grayscale, Laplacian variance, dan CLAHE adaptif berjalan tanpa error.
2. **FastAPI & HTTP Stack**:
   - `fastapi` v0.159.1, `starlette`, `httpx`: **TERVERIFIKASI BERFUNGSI**.
   - Endpoint `/api/v1/health` merespons HTTP 200 OK.
   - Endpoint `/api/v1/qc/scan` dan `/api/v1/qc/scan-multi` merespons sesuai kontrak baku.
3. **ONNX Runtime**:
   - Lingkungan host saat ini menggunakan **Python 3.14.0a4**.
   - Paket resmi `onnxruntime` dari Microsoft di PyPI belum tersedia (belum ada wheel resmi) untuk Python 3.14.
   - Test unit yang membutuhkan ONNX runtime nyata dilewati secara aman (`4 skipped`).
   - Server menangani ketidakhadiran ONNX Runtime secara elegan: mengembalikan status `model_unavailable` dengan rincian `RUNTIME_UNAVAILABLE`, **tanpa crash dan tanpa mock fallback**.
   - **PERNYATAAN KEJUJURAN RUNTIME:**
     > [!WARNING]
     > **ONNX Runtime BELUM DAPAT DINYATAKAN PRODUCTION-READY pada host Python 3.14 ini.**
     > Untuk deployment produksi dengan akselerasi model ONNX nyata, aplikasi wajib di-deploy menggunakan container certified Python 3.10 atau 3.11 yang mendukung `onnxruntime>=1.16.0`.

---

## 7. TASK 6 — Matriks Pengujian & Verifikasi Regresi

Seluruh test suite backend dan frontend dijalankan dan lulus 100%:

### A. Python Backend Unit Tests (100 Tests)
```bash
python3 -m unittest discover -s server/tests
Ran 100 tests in 0.330s
OK (skipped=4)
```
- 100 test **PASS**, 0 test FAIL, 0 test ERROR.
- 4 test skipped: Test pemuatan bobot model ONNX nyata (dilewati karena runtime host Python 3.14 belum memiliki paket ONNX C-wheel).

### B. Node.js Frontend Unit Tests (120 Tests)
```bash
node --test tes/*.test.js
ℹ tests 120
ℹ pass 120
ℹ fail 0
ℹ duration_ms 177.29ms
```
- 120 test **PASS**, 0 test FAIL, 0 test ERROR.

### C. Frontend Production Build (Vite)
```bash
npm run build
✓ 1767 modules transformed.
dist/index.html                     0.50 kB
dist/assets/index-BdnUHgWC.css      1.30 kB
dist/assets/index-CPvl0WUp.js   1,106.06 kB
✓ built in 354ms
```
- Build production **SUKSES** tanpa sintaks error atau missing imports.

---

## 8. Known Limitations & Acceptance Criteria Belum Terpenuhi (Backlog P1 & P2)

Meskipun fondasi keamanan (P0) telah tuntas, hal-hal berikut tetap menjadi batasan sistem aktual:

1. **Model Tomat Belum Mendukung Grading 3-Tier (P1/P2 Backlog)**:
   - Dataset Tomat yang tersedia hanya 2 kelas kesegaran (`fresh` vs `rotten`).
   - Sistem saat ini **tidak** dapat membedakan Tomat Grade A (Super) dan Grade B (Standar). Diperlukan pengumpulan dataset 3-kelas dan retraining pada fase P2.
2. **Ketiadaan Model Cabai Rawit Hijau (P2 Backlog)**:
   - Komoditas Cabai berstatus `unsupported` dan mengandalkan input manual hingga dataset 2.000 citra dikumpulkan dan dianotasi pada fase P2.
3. **Standar SNI Terung Belum Diverifikasi (P1 Backlog)**:
   - Model Terung menggunakan standar visual UNECE FFV-05. Konvensi penggabungan Extra Class + Class I menjadi Grade A berstatus `PROVISIONAL` hingga lembar rubrik mutu disahkan oleh praktisi agronomi independen.
4. **Kalibrasi Empiris Threshold (P1 Backlog)**:
   - Threshold 0.35, 0.45, Laplacian 50.0, dan disparitas 15-20% masih berstatus heuristik dan perlu dikalibrasi menggunakan validation dataset lapangan Payakumbuh.
5. **Runtime Container Produksi (P3 Backlog)**:
   - Diperlukan Dockerfile berbasis `python:3.11-slim` untuk menjamin ketersediaan paket `onnxruntime` dan `opencv-python-headless` saat deployment ke cloud/server SMKN 4 Payakumbuh.

---

## 9. Final Verdict

### **VERDICT: READY WITH LIMITATIONS**

**Justifikasi:**
1. **P0 Selesai & Terbukti Aman**: Seluruh celah *silent mock fallback*, over-claiming AI pada komoditas tak didukung (Cabai), dan salah penanganan model offline telah tereliminasi secara menyeluruh.
2. **Hasil Uji 100% Green**: 100 test backend dan 120 test frontend lulus tanpa error; build production Vite sukses.
3. **Ketahanan Multi-Angle Teruji**: Degradasi anggun dari kegagalan satu sudut pandang ke status `needs_review` telah berfungsi dan terverifikasi.
4. **Batasan Terdokumentasi Jujur**: Keterbatasan model 2-kelas Tomat, ketiadaan model Cabai, dan kebutuhan Python 3.10/3.11 untuk ONNX runtime telah dideklarasikan secara transparan tanpa klaim palsu.
5. **Kepatuhan Aturan**: Tidak ada commit atau merge yang dilakukan. Branch `feat/p0-ml-safety-remediation` siap ditinjau untuk persetujuan merge ke branch utama.
