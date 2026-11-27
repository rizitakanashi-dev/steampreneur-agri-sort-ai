# Model AI dan status evaluasi

**Status audit: 23 November 2026; provenance diperbarui 27 November 2026.** Model Terung, Tomat, dan Cabai memakai kontrak output kanonis `0: Grade A`, `1: Grade B`, `2: Reject`. Kontrak ini hanya menjamin konsistensi ID output—bukan bahwa anotasi dataset mengandung makna grade komersial yang tepat.

Ketiga manifest berada pada status `candidate`; semantik dataset ditandai `needs_data`. Model runtime menolak candidate untuk scan produksi dan hanya evaluator yang dapat meminta akses candidate secara eksplisit. Kegagalan model tidak boleh berubah menjadi prediksi/mock yang tampak berhasil.

| Komoditas | Status artefak | Hasil pemeriksaan data lokal | Batasan utama |
|---|---|---|---|
| Terung | `candidate`; semantik `needs_data` | Export lokal `Eggplant-Quality-Grades-2` v2: 16,168/1,028/1,022 image train/valid/test; 50,929 box valid; 4 baris train non-box (21/23/41/59 field); 37 label train kosong; 1 grup hash duplikat intra-train; 0 lintas split. | Export ini kemungkinan sumber training, tetapi export `/tmp/terung_calib` tidak tersedia sehingga identitas byte belum terbukti. Rubrik komersial belum diverifikasi. |
| Tomat | `candidate`; semantik `needs_data` | Export lokal `tomato-freshness` v1: 2,100/425/280 image; 2,418/445/305 box; 2 grup hash duplikat intra-train; 0 lintas split. | Ini **bukan** dataset training. Checkpoint memakai `tomato-thesis-e4` v1 yang export-nya tidak tersedia. `tomato-freshness` hanya kandidat external-domain test. |
| Cabai | `candidate`; semantik `needs_data` | Export lokal `Smart Conveyor Cabai Rawit` v1: 1,266/353/181 image; 1,818 baris non-box; **0 box valid**; 0 duplikat. | Ini **bukan** dataset training dan tidak dapat dipakai sebagai ground truth. Checkpoint memakai `Chili-Data-set-v4` v2 yang export-nya tidak tersedia. |

Hitungan di atas berasal dari export lokal yang tersedia dan tidak mencakup gambar di repo atau laporan publik. Hanya Terung yang mungkin merupakan training export; Tomat dan Cabai adalah export eksternal yang berbeda dari sumber training checkpoint. Angka objek hanya menghitung box lima kolom yang valid; baris polygon tidak ikut dihitung. Audit hash hanya mendeteksi duplikat byte-identik; bukan near-duplicates, sesi pengambilan gambar, spesimen yang sama, atau kebocoran grup. Rubrik dan label memerlukan tinjauan agronom independen. Detail ada pada `docs/model-evaluation/provenance-matrix.md`, `docs/model-evaluation/dataset-integrity-audit.md`, dan tool `server/scripts/audit_yolo_dataset.py`.

## Metrik dan kesiapan

Belum ada threshold per komoditas yang dikalibrasi, evaluasi hold-out test penuh, atau bukti independen yang membuat model layak disebut tervalidasi. Smoke test satu gambar Terung melalui ONNX berakhir `needs_review` dengan nol deteksi; itu hanya membuktikan jalur evaluator dapat berjalan, bukan mengukur kualitas model. Karena itu dokumen ini sengaja tidak mencantumkan klaim akurasi atau metrik performa komersial.

Untuk pengujian eksploratori pada data eksternal, gunakan `server/scripts/evaluate_models.py`. Kalibrasi dibatasi pada split `valid`; evaluasi test harus memakai threshold yang sudah dibekukan, dan tidak dilakukan selama gate semantik belum lolos. Semua laporan harus menyatakan split, hash konfigurasi/manifest, akses candidate, kegagalan pipeline, dan status `rubric_status: unverified`.
