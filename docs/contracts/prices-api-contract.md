# Kontrak Harga Hortikultura Agri-Sort AI (isu #41)

> Status: **DRAFT** — proposal kontrak, **belum diimplementasikan**. Implementasi = #42,
> cache/freshness = #43, koneksi frontend = #44. Spesifikasi lengkap:
> [`prices-api.openapi.yaml`](./prices-api.openapi.yaml) (OpenAPI 3.1).

## Prinsip kontrak

1. Browser hanya memanggil backend Agri-Sort AI. URL provider & kredensial tidak pernah
   muncul di kontrak frontend.
2. Satu respons = satu jenis harga dari satu sumber. SP2KP (tingkat konsumen) tidak boleh
   dilabel produsen/grosir; SIPASHORTI `produsen`/`eceran`/`grosir` adalah deret terpisah.
3. Data hilang = `null` + `data_status` eksplisit. **Dilarang** memakai `0` untuk "tidak
   ada data", interpolasi, atau fallback simulasi diam-diam.
4. Nilai asli (`price_value` + `unit_raw`) dan ternormalisasi (`normalized_price_per_kg`)
   dipertahankan; normalisasi hanya bila unit sumber & faktor konversi diketahui.
5. Tiga cap waktu berbeda: `observed_at` (provider mengamati), `published_at` (sumber
   menerbitkan, bila diketahui), `fetched_at` (Agri-Sort menarik).
6. Zona waktu: `observed_at`/`published_at` = ISO-8601 offset **Asia/Jakarta (+07:00)**;
   `fetched_at` = **UTC (Z)**.

## Endpoint

| Method & path | Tujuan | Auth |
|---|---|---|
| `GET /api/v1/prices/commodities` | Komoditas kanonik + sumber yang menerbitkannya (Terung: `available: false` di SP2KP) | publik |
| `GET /api/v1/prices/latest` | Observasi terbaru satu komoditas/region/sumber/jenis harga | publik |
| `GET /api/v1/prices/history` | Deret waktu dengan `from`/`to` + paginasi kursor | publik |
| `GET /api/v1/prices/sources` | Metadata sumber: URL resmi, status akses, lisensi/attribution, cadence | publik |
| `GET /api/v1/prices/sources/{source_id}/health` | Kesehatan sumber + kategori error terakhir (tanpa kredensial) | publik |
| `POST /api/v1/prices/refresh` | Pemicu operasional, idempoten | token internal |

Parameter wajib `latest` & `history`: `commodity`, `price_type`, dan pasangan
`region_level` + `region_code` (atau cakupan nasional yang terdokumentasi).
Opsional: `source_id`, `market`, `from`, `to`, `limit`, `cursor`.

## Semantik status

| `data_status` | Makna | Boleh dilabel harga terkini? |
|---|---|---|
| `actual` | Observasi terkini dari respons provider berizin | Ya, dengan sumber & waktu |
| `historical` | Catatan historis provider, bukan terkini | Tidak — label historis |
| `cached` | Nilai sebelumnya sesuai policy cache | Hanya dengan freshness + timestamp; tidak pernah "live" |
| `simulated` | Nilai demo/tes yang diminta eksplisit di mode demo | Tidak pernah di mode live |
| `unavailable` | Tidak ada observasi / sumber tidak bisa memberi | Tidak — tampilkan alasannya |

`freshness.state`: `fresh` (dalam cadence + grace), `stale` (hanya periode terbatas saat
sumber tak terjangkau; respons harus menyebut `stale` + waktu observasi), `expired`
(**tidak** boleh disajikan sebagai harga terkini → `503` / `unavailable`), `unknown`.

## Kontrak error

| HTTP | `code` | Kapan |
|---|---|---|
| 400 | `INVALID_QUERY` | Rentang tanggal salah / kombinasi parameter tak didukung |
| 404 | `COMMODITY_NOT_FOUND` | Komoditas tidak ada di katalog Agri-Sort |
| 422 | `INVALID_REGION` / `INVALID_PRICE_TYPE` | region atau price_type tidak valid |
| 503 | `SOURCE_UNAVAILABLE` / `NO_ACCEPTABLE_DATA` | Tidak ada sumber & cache yang layak (`Retry-After` bila diketahui) |
| 429 | `RATE_LIMITED` | Batas laju terdokumentasi terlampaui |
| 500 | `INTERNAL_ERROR` | Kegagalan tak terduga — **tanpa** kredensial/cookie/hostname internal/stack trace mentah |

Objek error stabil: `{code, message, details, request_id}`. Semua respons sukses memakai
envelope `{data, meta.request_id}`.

## Pemetaan frontend (untuk #44)

| Field kontrak | Peran di UI |
|---|---|
| `data_status` | **Menggerakkan state utama**: `actual/cached` → kartu harga; `historical` → label "Historis"; `simulated` → label "Demo" (tolak di mode live); `unavailable` → kartu "Tidak tersedia" + alasan |
| `freshness.state` + `age_seconds` | Badge umur data ("Hari ini", "1 hari lalu", "Kedaluwarsa"); `stale` → badge kuning + waktu observasi; `expired` → perlakukan sebagai tidak tersedia |
| `price_value` + `unit_raw` | Angka tampilan utama — **hanya** tampil saat bukan `unavailable` |
| `normalized_price_per_kg` | Perbandingan antar-sumber; `null` → sembunyikan kolom banding |
| `warnings` | Teks alasan: `SOURCE_DOES_NOT_PUBLISH_COMMODITY` → "Sumber tidak menerbitkan komoditas ini"; `STALE_OBSERVATION` → "Data tidak terbaru"; `UNIT_NOT_NORMALIZABLE` → sembunyikan banding (display-only + state) |
| `is_live`, `is_official` | **Display-only** (chip/badge) — tidak pernah menggerakkan logika state |
| `source.name` + `attribution` | Teks atribusi wajib di bawah kartu harga |
| `observed_at` / `published_at` / `fetched_at` | Tooltip/detail "data per tanggal X (diterbitkan Y, ditarik Z)" — display-only |
| `price_type` | Label jenis harga; **tidak boleh** dipakai untuk menyamakan deret berbeda |

Field yang menggerakkan state: `data_status`, `freshness.state`, `price_value`,
`warnings`. Sisanya display-only.

## Kompatibilitas & deprecation (endpoint lama)

- `/api/v1/pricing/bapanas/live`, `/sp2kp/live`, `/government/comparison` **tetap berjalan
  sementara** demi UI sekarang, tetapi berstatus **static/demo compatibility paths** —
  nilainya baseline statis, bukan feed live (label UI sudah menyesuaikan, komit
  `31db630`).
- Setelah #44 selesai dan frontend sepenuhnya memakai `/api/v1/prices/*`: beri
  deprecation (`Sunset` header) pada ketiga path lama selama **1 rilis**, lalu hapus
  penamaan `live` yang menyesatkan bersama pergantian komit berikutnya.
- Frontend baru **hanya** memakai `/api/v1/prices/*`.

## Metadana sumber (dari temuan #38/#39)

| Sumber | URL resmi | Status akses | Cadence | Lisensi/attribution |
|---|---|---|---|---|
| `sp2kp` | https://sp2kp.kemendag.go.id/ | `unconfirmed` (tidak ada API publik terdokumentasi; jalur data.go.id historis perlu cek lisensi) | harian | "Sumber: SP2KP Kemendag RI" |
| `sipashorti` | https://11ap.pertanian.go.id/sipashorti/ | `unconfirmed` (harga butuh login operator; tidak ada registrasi mandiri) | harian | "Sumber: SIPASHORTI Ditjen Hortikultura, Kementan" |

`access_status=unconfirmed/denied` ⇒ adapter tidak boleh aktif (#42 hanya boleh
mengimplementasikan interface + feature flag + test fixture).

## Checklist kriteria penerimaan #41

- [x] Dokumen OpenAPI 3 mendefinisikan setiap endpoint, parameter, respons, dan kode error (`prices-api.openapi.yaml`)
- [x] Contoh kontrak untuk setiap `data_status` + Terung `unavailable` (5 contoh di spec)
- [ ] Kontrak test memvalidasi skema & menolak ambiguitas `0`/`null`, pencampuran price_type, provenance hilang → **bagian #42** (implementasi)
- [x] Pemetaan frontend tiap field terdokumentasi (tabel di atas; field penggerak state vs display-only)
- [x] Metadata sumber memuat status akses, lisensi/attribution, cadence
- [x] Kompatibilitas mundur & deprecation endpoint statis terdokumentasi
- [x] Tidak ada kredensial provider atau endpoint tak resmi di kontrak publik
