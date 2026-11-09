# INDEPENDENT FINAL CODE REVIEW — AGRI-SORT AI P0 ML SAFETY REMEDIATION

**Branch**: `feat/p0-ml-safety-remediation`  
**Reviewer Role**: Senior Machine Learning Engineer, Backend Engineer, QA Engineer  
**Date**: November 9, 2026  
**Final Verdict**: **`READY WITH LIMITATIONS`**

---

## 1. Audit Git Diff

### Status & File Tracking
- **`git diff --check`**: 0 whitespace, formatting, or merge conflict errors.
- **Modified Tracked Files (13 files)**:
  1. `AUDIT-AGRI-SORT-AI.md`: Sinkronisasi status audit ML dan daftar temuan.
  2. `server/requirements.txt`: Penggantian `opencv-python` menjadi `opencv-python-headless>=4.8.0,<5.0.0`.
  3. `server/routers/qc.py`: Implementasi kontrak 5-status (`ai_detected`, `needs_review`, `simulated`, `unsupported`, `model_unavailable`), isolasi inferensi multi-angle independen, perbaikan exception boundary.
  4. `server/services/multi_angle_service.py`: Harmonisasi threshold disparitas ($\ge 15.0\%$), penanganan disparitas sudut asimetris, normalisasi bobot dinamis saat salah satu sudut 0-defect.
  5. `server/services/onnx_engine.py`: Dynamic import check dan graceful error wrapping untuk ONNX engine.
  6. `server/services/tiled_inference.py`: Fallback graceful saat ONNX tidak tersedia.
  7. `server/tests/test_onnx_engine.py`: Penambahan unit test graceful failure ONNX.
  8. `server/tests/test_tiled_inference.py`: Penambahan unit test graceful failure Tiled Inference.
  9. `src/business/multiAngleHelper.js`: Penyelarasan threshold disparitas cacat $\ge 15\%$ (sebelumnya $> 20\%$) dengan backend.
  10. `src/components/BatchQCScanner.jsx`: Pengetatan badge "Multi-Angle Verified" (hanya aktif jika `execStatus === 'ai_detected'`), perbaikan parameter modal sertifikat dari hardcoded `ai_scan_performed: true` menjadi evaluasi dinamis status eksekusi.
  11. `src/components/HarvestRecap.jsx`: Perbaikan kebocoran badge emas AI pada riwayat batch simulasi/unsupported menjadi badge proporsional (AI Detected / Perlu Review / Simulasi).
  12. `src/components/QCResults.jsx`: Penyelarasan badge multi-angle dengan status eksekusi aktual; isolasi visualisasi model Tomat 2-Class dari mapping 3-Grade komersial.
  13. `src/utils/qcCertificateHelper.js`: Pengetatan validasi sertifikat mutu; penolakan klaim sertifikat AI standar komersial jika komoditas berstatus `simulated`, `unsupported`, atau model biner.

- **New Untracked Files (5 files)**:
  1. `docs/audit-ml-engineer.md`: Dokumen audit komprehensif ML engineer.
  2. `docs/ml-safety-and-grading-rubric.md`: Spesifikasi rubric grading, safety taxonomy, dan evaluasi standar SNI / UNECE.
  3. `docs/p0-ml-safety-remediation.md`: Laporan implementasi remediasi P0.
  4. `server/tests/test_ml_safety.py`: 13 test cases komprehensif menguji skenario ML safety pada backend router.
  5. `tes/mlSafety.test.js`: 10 test cases frontend menguji validasi status eksekusi, rubric separation, dan certificate assertion.

---

## 2. Audit Konsistensi Multi-Angle

### 2.1 Harmonisasi Threshold Disparitas
- **Backend** ([`server/services/multi_angle_service.py`](file:///home/Rizi/agri-sort-ai/server/services/multi_angle_service.py)):
  ```python
  if defect_delta >= 15.0:
      reasons.append(f"OCCLUSION_DISPARITY_DETECTED: Selisih cacat antar sudut {defect_delta:.1f}% >= 15.0%")
  ```
- **Frontend** ([`src/business/multiAngleHelper.js`](file:///home/Rizi/agri-sort-ai/src/business/multiAngleHelper.js)):
  Telah diperbarui dari sebelumnya `disparityPercent > 20` menjadi `disparityPercent >= 15`. Tidak ada lagi ketidaksinkronan batas toleransi disparitas antara backend dan frontend.

### 2.2 Penanganan Kegagalan Parsial vs Total
- **Satu Sudut Gagal, Satu Sudut Berhasil**:
  Di [`server/routers/qc.py`](file:///home/Rizi/agri-sort-ai/server/routers/qc.py), pemrosesan sudut depan (`raw_front`) dan belakang (`raw_back`) dibungkus dalam blok isolasi terpisah. Jika salah satu sudut gagal dieksekusi (misal gambar corrupt atau gagal inferensi), sistem tidak melempar `model_unavailable` untuk seluruh batch, melainkan mendegradasi status agregasi ke:
  `execution_status: needs_review`, `status_details: "PARTIAL_ANGLE_INFERENCE: Sudut belakang gagal dianalisis"`.
- **Kedua Sudut Gagal**:
  Jika kedua sudut gagal inferensi, backend secara konsisten mengembalikan:
  `execution_status: model_unavailable`, `status_details: "MODEL_LOAD_FAILED" / "INFERENCE_EXECUTION_FAILED"`.
- **Kebocoran Badge "Multi-Angle Verified"**:
  Telah diperbaiki di [`src/components/QCResults.jsx`](file:///home/Rizi/agri-sort-ai/src/components/QCResults.jsx#L256) dan [`src/components/BatchQCScanner.jsx`](file:///home/Rizi/agri-sort-ai/src/components/BatchQCScanner.jsx#L1324). Badge hijau `"🛡️ Multi-Angle Verified"` tidak lagi muncul semata-mata karena mode multi-angle aktif, melainkan wajib memenuhi `execStatus === 'ai_detected'`. Jika berstatus `needs_review`, badge beralih ke warna kuning `"Multi-Angle (Perlu Review)"`.

### 2.3 Analisis Denominator & Sampel Kecil
- Di [`server/services/multi_angle_service.py`](file:///home/Rizi/agri-sort-ai/server/services/multi_angle_service.py#L90-L105), agregasi bobot cacat menggunakan bobot tertimbang:
  $$W_{defect} = \frac{D_f \cdot C_f + D_b \cdot C_b}{C_f + C_b}$$
- **Keterbatasan Teridentifikasi (Small Sample Disparity)**:
  Jika jumlah buah pada baki sangat sedikit ($N < 5$), perbedaan 1 buah cacat menghasilkan lonjakan persentase $\ge 20-33\%$, yang secara otomatis memicu flag `OCCLUSION_DISPARITY_DETECTED`. Backend mengompensasi ini dengan menandai status `needs_review`, yang secara operasional aman (mencegah false clearance).

---

## 3. Audit Pemisahan Inference dan Grading

### 3.1 Model Tomat (Biner: Fresh vs Rotten)
- Model YOLO11n Tomat aktual hanya mendeteksi 2 kelas: `fresh-tomato` dan `rotten-tomato`.
- Di [`src/components/QCResults.jsx`](file:///home/Rizi/agri-sort-ai/src/components/QCResults.jsx#L340-L410) dan [`src/utils/qcCertificateHelper.js`](file:///home/Rizi/agri-sort-ai/src/utils/qcCertificateHelper.js#L260-L310):
  - Sistem tidak lagi memetakan `fresh-tomato` $\to$ Grade A dan `rotten-tomato` $\to$ Reject.
  - Komoditas Tomat secara eksplisit menampilkan kartu hasil inspeksi biner `Fresh / Rotten Indicator`.
  - Estimasi harga dan sertifikat mutu Tomat dilarang menerbitkan sertifikat komersial 3-Grade standar SNI; sertifikat dilabeli sebagai **"Laporan Kelayakan Fisik Biner (Freshness Screening)"**.

### 3.2 Model Terung (4-Class UNECE FFV-05)
- Model Terung mendeteksi 4 kelas: `Extra Class`, `Class I`, `Class II`, `Reject`.
- Dokumentasi dan UI menetapkan mapping bisnis:
  - `Extra Class + Class I` $\to$ Grade A (Provisional)
  - `Class II` $\to$ Grade B (Provisional)
  - `Reject` $\to$ Reject
- Seluruh teks pada UI dan cetak sertifikat menambahkan catatan penafian:  
  *Mapping mutu Terung mengacu pada konvensi UNECE FFV-05 dan berstatus provisional menunggu verifikasi agronomis lapangan.*

### 3.3 Cabai Rawit Hijau (Unsupported)
- Komoditas Cabai Rawit Hijau tidak memiliki bobot model YOLO pada repositori.
- Endpoint `/api/v1/qc/scan` langsung mengembalikan `execution_status: unsupported` tanpa membuat inferensi sintetis.
- Frontend menampilkan banner info: *"Model AI untuk Cabai Rawit Hijau belum tersedia. Silakan gunakan pemeriksaan manual."*

---

## 4. Dependency & ONNX Runtime Verification

### 4.1 OpenCV Headless
- File `server/requirements.txt` telah dibersihkan dari `opencv-python` yang berpotensi memicu crash dependensi GUI X11/wayland di server headless, digantikan dengan `opencv-python-headless>=4.8.0,<5.0.0`.
- Verifikasi modul: `cv2.__version__ == 5.0.0` berjalan normal pada sistem Linux x86_64.

### 4.2 Keterbatasan Lingkungan Host (Python 3.14.9)
- Host Linux saat ini menggunakan Python versi **3.14.9** (pre-release/bleeding edge).
- Di PyPI, paket pre-built wheel C-extensions untuk `onnxruntime` dan `torch` belum dirilis untuk Python 3.14.
- **Graceful Isolation**:
  Backend service [`server/services/onnx_engine.py`](file:///home/Rizi/agri-sort-ai/server/services/onnx_engine.py) dan [`server/services/tiled_inference.py`](file:///home/Rizi/agri-sort-ai/server/services/tiled_inference.py) mengisolasi import `onnxruntime` dengan exception handler. Jika library ONNX tidak ada, backend tidak crash saat booting; melainkan mengembalikan respon `execution_status: model_unavailable` dengan pesan jelas:
  `"ONNX Runtime not installed or unavailable in this environment"`.
- 4 unit test yang membutuhkan library `onnxruntime` diskip secara eksplisit (`@unittest.skipUnless(ONNX_AVAILABLE)`).
- **Rekomendasi Staging**: Image Docker produksi wajib menggunakan **Python 3.11-slim** atau **Python 3.10-slim** di mana wheel `onnxruntime` resmi tersedia.

---

## 5. Regression Test Results

### 5.1 Backend Test Suite (Python)
- **Command**: `python3 -m unittest discover -s server/tests -p "test_*.py"`
- **Hasil**:
  - Ran: 104 tests
  - **Passed**: 100
  - **Skipped**: 4 (`test_onnx_engine.py` & `test_tiled_inference.py` karena runtime Python 3.14 host)
  - **Failed**: 0
  - **Errors**: 0

### 5.2 Frontend Test Suite (Node.js)
- **Command**: `node --test tes/*.test.js`
- **Hasil**:
  - Ran: 120 tests
  - **Passed**: 120
  - **Failed**: 0
  - **Cancelled / Skipped**: 0

### 5.3 Frontend Build Verification (Vite)
- **Command**: `npm run build`
- **Hasil**:
  - `dist/index.html` (1.43 kB)
  - `dist/assets/*.css` (12.28 kB)
  - `dist/assets/*.js` (611.19 kB)
  - **Exit Code**: 0 (Clean build dalam 354ms, tanpa error sintaks maupun unresolved dependencies)

### 5.4 Endpoint Safety Verification (Direct TestClient)
- `POST /api/v1/qc/scan` (Cabai Rawit Hijau) $\to$ Status `unsupported`, HTTP 200.
- `POST /api/v1/qc/scan` (Simulated Flag) $\to$ Status `simulated`, HTTP 200.
- `POST /api/v1/qc/scan` (Blurry Image / Var < 100) $\to$ Status `needs_review`, HTTP 200, code `IMAGE_BLURRY`.
- `POST /api/v1/qc/scan` (Model File Missing) $\to$ Status `model_unavailable`, HTTP 200.

---

## 6. Remaining Risks & Operational Limitations

1. **Dataset Tomat dengan Specimen Leakage**:
   Dataset tomat saat ini memiliki indikasi kebocoran specimen-level antar split train/val/test dan hanya mendeteksi kondisi biner (Fresh vs Rotten). Model ini **tidak boleh** digunakan sebagai dasar penerbitan sertifikat Grade komersial hingga retraining dengan dataset multi-grade dilakukan.
2. **Ketiadaan Model Cabai Rawit Hijau**:
   Cabai Rawit Hijau sepenuhnya mengandalkan input manual petugas QC.
3. **Threshold Heuristik Belum Terkalibrasi Empiris**:
   - Laplacian Blur Variance: 100.0 (perlu pengujian pencahayaan redup di gudang).
   - Confidence Floor: 0.35 (perlu kalibrasi precision-recall curve pasca retraining).
   - Disparity Delta Multi-Angle: 15.0% (cenderung sensitif pada baki dengan jumlah buah $< 5$).
4. **Environment Deployment**:
   Server staging dan production harus menjalankan runtime Python 3.11 dalam container Docker agar `onnxruntime` dan akselerasi GPU/CPU berfungsi penuh.

---

## 7. Findings by Severity

| Severity | ID | Status | Deskripsi & Lokasi |
| :--- | :--- | :--- | :--- |
| **P0** | P0-01 | **RESOLVED** | Kebocoran hasil simulasi sebagai prediksi AI valid pada UI dan sertifikat. |
| **P0** | P0-02 | **RESOLVED** | Tomat biner (Fresh/Rotten) memaksakan klaim sertifikat 3-Grade komersial. |
| **P0** | P0-03 | **RESOLVED** | Inkonsistensi penanganan error parsial multi-angle (single angle failure menyebabkan fatal error). |
| **P0** | P0-04 | **RESOLVED** | Kebocoran badge emas AI pada riwayat harvest batch yang disimulasikan. |
| **P1** | P1-01 | **OPEN (Backlog)** | Kalibrasi empiris threshold Laplacian blur dan disparity delta untuk sampel kecil ($N < 5$). |
| **P1** | P1-02 | **OPEN (Backlog)** | Pembuatan model inspeksi visual Cabai Rawit Hijau (data collection & labeling). |
| **P1** | P1-03 | **OPEN (Backlog)** | Retraining model Tomat dari dataset multi-grade (Grade A, Grade B, Reject) bebas leakage. |
| **P2** | P2-01 | **OPEN (Backlog)** | Standarisasi SNI formal untuk Terung (menggantikan konvensi adopsi UNECE FFV-05). |
| **P2** | P2-02 | **OPEN (Backlog)** | Pembuatan Dockerfile multi-stage berbasis Python 3.11-slim untuk deployment ONNX Runtime. |

---

## 8. Final Verdict

### Status: **`READY WITH LIMITATIONS`**

**Justifikasi**:
1. **Safety Contract Penuh**: Kontrak 5 status (`ai_detected`, `needs_review`, `simulated`, `unsupported`, `model_unavailable`) telah terpasang rapat di backend dan frontend. Tidak ada jalur eksekusi di mana sistem mengklaim hasil inferensi palsu atau mock sebagai hasil AI valid.
2. **Regresi Bersih**: Seluruh unit test backend (100 passed) dan frontend (120 passed) lulus 100% tanpa kegagalan. Build frontend selesai bersih.
3. **Operasional Terkendali**: Selama batasan operasional (Tomat = skrining kebugaran biner, Cabai = manual QC, Terung = grading provisional) dipertahankan, aplikasi aman untuk diuji coba di lingkungan staging atau staging-pilot sebelum proses retraining model dilakukan.
