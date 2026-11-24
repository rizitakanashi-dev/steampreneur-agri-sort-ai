# Model AI dan status evaluasi

**Status audit: 23 November 2026.** Model Terung, Tomat, dan Cabai memakai kontrak output kanonis `0: Grade A`, `1: Grade B`, `2: Reject`. Kontrak ini hanya menjamin konsistensi ID output—bukan bahwa anotasi dataset mengandung makna grade komersial yang tepat.

Ketiga manifest berada pada status `candidate`; semantik dataset ditandai `needs_data`. Model runtime menolak candidate untuk scan produksi dan hanya evaluator yang dapat meminta akses candidate secara eksplisit. Kegagalan model tidak boleh berubah menjadi prediksi/mock yang tampak berhasil.

| Komoditas | Status artefak | Hasil pemeriksaan data lokal | Batasan utama |
|---|---|---|---|
| Terung | `candidate`; semantik `needs_data` | 16,168/1,028/1,022 image train/valid/test; pasangan berjumlah sama. Audit menemukan 4 baris label train yang bukan bounding-box YOLO lima kolom, 1 grup hash duplikat intra-train, dan 0 grup hash duplikat lintas split. | Sebagian anotasi training berupa poligon/segmentation; audit/evaluator detection berbasis box tidak dapat menilainya. Rubrik komersial belum diverifikasi. |
| Tomat | `candidate`; semantik `needs_data` | 2,100/425/280 image; pasangan berjumlah sama; file label terstruktur dan kelas berurutan kanonis; 2 grup hash duplikat intra-train, 0 lintas split. | Nama kelas kanonis tidak membuktikan arti label. Dataset bernama freshness; semantik grade komersial perlu verifikasi ahli dan tinjauan anotasi. |
| Cabai | `candidate`; semantik `needs_data` | 1,266/353/181 image; pasangan berjumlah sama; 0 grup hash duplicate lintas split. | Audit menemukan semua baris label saat ini bukan format bbox lima kolom; sumber/release dan format label perlu diselesaikan sebelum evaluasi. |

Hitungan di atas berasal dari dataset lokal eksternal dan tidak mencakup gambar di repo atau laporan publik. Angka objek Terung hanya menghitung baris box yang valid; 4 baris train berformat polygon tidak ikut dihitung. Audit hash yang dilakukan hanya mendeteksi duplikat byte-identik; bukan near-duplicates, sesi pengambilan gambar, spesimen yang sama, atau kebocoran grup. Rubrik dan label memerlukan tinjauan agronom independen. Detail audit tanpa data gambar ada pada `docs/model-evaluation/grade-rubrics.md` dan tool `server/scripts/audit_yolo_dataset.py`.

## Metrik dan kesiapan

Belum ada threshold per komoditas yang dikalibrasi, evaluasi hold-out test penuh, atau bukti independen yang membuat model layak disebut tervalidasi. Smoke test satu gambar Terung melalui ONNX berakhir `needs_review` dengan nol deteksi; itu hanya membuktikan jalur evaluator dapat berjalan, bukan mengukur kualitas model. Karena itu dokumen ini sengaja tidak mencantumkan klaim akurasi atau metrik performa komersial.

Untuk pengujian eksploratori pada data eksternal, gunakan `server/scripts/evaluate_models.py`. Kalibrasi dibatasi pada split `valid`; evaluasi test harus memakai threshold yang sudah dibekukan, dan tidak dilakukan selama gate semantik belum lolos. Semua laporan harus menyatakan split, hash konfigurasi/manifest, akses candidate, kegagalan pipeline, dan status `rubric_status: unverified`.
