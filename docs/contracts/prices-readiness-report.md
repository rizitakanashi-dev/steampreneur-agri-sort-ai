# Readiness Report — Integrasi Harga Agri-Sort AI (isu #45)

> Tanggal: 2026-11-27 · **Status: SIAP-DI-REVIEW, TIDAK SIAP-PRODUKSI.**
> Akses provider **unconfirmed** (#38/#39) ⇒ sesuai gerbang isu #45: **tidak ada
> deployment produksi live**. Integrasi tetap dalam mode `off`/demo, label jujur.

## Status per isu

| Isu | Deliverable | Status |
|---|---|---|
| #38 | Investigasi SIPASHORTI | Selesai (keputusan: tidak ada API publik; butuh akses resmi) |
| #39 | Investigasi SP2KP | Selesai → **akses terkonfirmasi (28 Nov 2026)**: dataset "Tingkat Harga Daerah" di data.go.id menerbitkan resource XLSX harian resmi `api-sp2kp.kemendag.go.id/kld/api/list-harga-harian/{YYYY}/{MM}` (publik, tanpa login). Terung tak diterbitkan dataset |
| #40 | Arsitektur | Selesai (`03aca83` — extend FastAPI existing, dokumentasi di isu) |
| #41 | Kontrak API | Selesai (`03aca83` — OpenAPI + pemetaan frontend) |
| #42 | Adapter + API | Selesai (`b0938ce` — adapter terkunci access-unconfirmed, migrasi SQL, 53 test) |
| #43 | Cache & freshness | Selesai (freshness per sumber, single-flight DB, cron bersecret, runbook) |
| #44 | Frontend | Selesai (client kontrak + mode live/demo/off + 5 state + Terung jujur) |
| #45 | Matriks & deploy | **Dokumen ini** — matriks dieksekusi; deploy produksi DIBLOKIR sampai akses resmi |

## Hasil matriks test (dieksekusi 2026-11-27)

### 1. Test unit/integrasi Python (harga) — `server/tests/test_price_*.py`

```
python -m unittest test_price_normalization test_price_adapters
                test_price_repository test_prices_api
                test_price_freshness test_price_migrations test_price_secrets
Ran 82 tests — OK
```

Cakupan wajib matriks:

| Lapisan | Requirement | Status |
|---|---|---|
| Adapter | mapping eksak, raw label, pemisahan price-type, unit, tanpa fuzzy | ✓ `test_price_normalization` (rawit merah ≠ hijau, Terung ditolak, unit non-massa null) |
| Provider failure | auth/404/429/5xx/timeout/malformed | ⚠️ teruji via fixture (`ProviderFetchError` timeout/server_error, malformed → 0 ingest); failure HTTP nyata menunggu adapter live (terkunci akses) |
| Kontrak | envelope, `data_status`, error code, null vs 0 | ✓ `test_prices_api` (19 test: 404/422/400/403, envelope + request_id) |
| Cache/freshness | cold/warm/concurrent/stale/expired/outage | ✓ `test_price_freshness` (21 test: single-flight, negative cache, cold→unavailable, stale→`cached` berlabel, expired→tidak disajikan) |
| Migrasi DB | diterapkan & di-rollback | ✓ `test_price_migrations` (8 test: Postgres sementara nyata — tabel/index/RLS, enum menolak `data_status`/komoditas/jenis harga liar, upsert idempoten via `ON CONFLICT`, single-flight `running` unik per sumber, RLS memblokir peran anon, rollback bersih + re-apply) |
| Data quality | idempoten, Terung, wilayah | ✓ `test_price_repository` (batch sama 2× → 0 duplikat) |
| Kontrak smoke | 5 state + Terung, endpoint nyata | ✓ `tools/prices_smoke.py` — **16/16 PASS** terhadap server lokal (`localhost:8000`, output di bawah) |
| Security | tanpa kredensial di src/dist/log/error | ✓ `test_price_secrets` + scan `dist/assets/*.js` → **0 kecocokan** marker kredensial |
| Regresi | test yang ada tetap jalan | ✓ build Vite ✓ · `node --test` **168/168 ✓** · suite Python 409 test: hanya 20 failure + 1 error **bawaan** (test ML merujuk path mesin lain `/home/Rizi/...`; dibuktikan via `git stash` baseline) |
| UI tests (Vitest) | admin tests | ⚠️ `npm run test:ui`: adminApi 9 ✓; adminDashboard **3 failure bawaan** (dibuktikan baseline via stash; bukan sentuhan #44) |

### 2. Smoke kontrak nyata (`python tools/prices_smoke.py`)

```
PASS - commodities 200 + envelope
PASS - Terung first-class + available:false di SP2KP
PASS - sources 200 + 2 sumber
PASS - semua access_status unconfirmed
PASS - health sp2kp never_fetched
PASS - latest terung 200 unavailable
PASS - price_value null (bukan 0)
PASS - warning SOURCE_DOES_NOT_PUBLISH_COMMODITY
PASS - warning SOURCE_ACCESS_UNCONFIRMED
PASS - latest tomat unavailable (flag off)
PASS - 404 COMMODITY_NOT_FOUND
PASS - 422 INVALID_PRICE_TYPE
PASS - 400 INVALID_QUERY (from>to)
PASS - history rows kosong + warning
PASS - refresh ditolak tanpa otorisasi (401/403)
PASS - tidak ada marker kredensial
Smoke: 16/16 checks passed against http://localhost:8000
```

State `actual/historical/cached` via smoke **nyata** akan tersedia setelah:
(1) migrasi SQL diterapkan ke Supabase, (2) akses provider resmi, (3) adapter
diaktifkan lewat flag. State tersebut sudah tercakup test fixture (#43).

## Pembaruan 28 Nov 2026 — SP2KP importer dataset resmi

- Akses SP2KP terkonfirmasi (dataset resmi data.go.id — bukan scraping, bukan
  login otomatis); importer `sp2kp_dataset.py` + 9 test baru, total harga 91 test ✓.
- **End-to-end nyata terverifikasi**: cron refresh lokal mengunduh dataset asli
  → 1.280–2.688 observasi Sumbar; kontrak `/latest` mengembalikan
  **Cabai Rawit Hijau Rp 58.000/kg — Kota Payakumbuh (1376), observed 27 Nov 2026**
  berlabel `historical` + provenance `official_api`; Terung tetap `unavailable`.
- UI mode live terverifikasi (screenshot): "Data historis — bukan harga hari ini",
  observed ≠ fetched, tren 20 titik tanpa interpolasi, health `healthy`.
- Koreksi wilayah: kode BPS Kota Payakumbuh **1376** (bukan 1375 = Sawahlunto)
  — kontrak, frontend, dan smoke ikut diperbaiki.
- SIPASHORTI tetap BLOKIR: butuh kredensial operator resmi (#38).

## Checklist blocked (deploy produksi)

- [x] **Keputusan akses SP2KP (#39)** — terkonfirmasi via dataset resmi; importer aktif di belakang flag
- [ ] **BLOKIR — keputusan akses SIPASHORTI (#38)** — masih butuh akses operator resmi
- [ ] Migrasi `20261127000100_price_observations.sql` + `20261127000200_price_freshness.sql`: **diterapkan & di-rollback di staging-lokal** (`test_price_migrations`, cluster Postgres disposable) — eksekusi di staging Supabase nyata masih menunggu akses dashboard
- [ ] Sandbox credentials opt-in + smoke `actual/historical/cached/stale/unavailable` end-to-end (state fixture sudah tercakup test #43)
- [ ] Monitoring/alerting produksi (runbook #43 ada; alert channel belum terpasang)
- [ ] Persetujuan eksplisit produksi + bundle bukti bertanggal

Yang TIDAK diblokir:
- [x] Rollback ke demo/off **sudah didemonstrasikan**: frontend default `VITE_PRICE_DATA_MODE=off` → halaman Harga Pasar menampilkan state integrasi nonaktif + kalkulator berlabel demo (dicek di preview); API menjawab `unavailable` jujur (smoke).
- [x] Tidak ada kredensial provider di bundle/log/error (test + scan).

## Rencana deploy bertahap (saat akses disetujui)

1. Terapkan kedua migrasi di staging Supabase → verifikasi constraint/index/RLS → uji rollback (drop tabel).
2. Deploy backend+frontend ke Vercel preview dengan flag **OFF** — smoke `16/16` harus tetap hijau.
3. Nyalakan **satu sumber** lewat flag + bukti akses → smoke `actual/historical/cached/stale` end-to-end → baru sumber berikutnya.
4. Aktifkan `VITE_PRICE_DATA_MODE=live` setelah kontrak terverifikasi; demo/off tetap mode rollback.
5. Sign-off produksi dengan bundle bukti bertanggal.

## Risiko terbuka

| Risiko | Mitigasi |
|---|---|
| Data.go.id lisensi belum dikonfirmasi (#39) | Jangan ingesti sebelum lisensi jelas; historis selalu berlabel |
| Limit 60s Vercel untuk ingest besar | Budget `PRICE_TOTAL_BUDGET_SECONDS=45s`; scheduler eksternal bila perlu |
| 3 failure Vitest adminDashboard (bawaan) | Dilacak terpisah, bukan bagian epic harga |
| 20 failure test Python ML (path mesin lain) | Jalankan di mesin pelatihan ML; bukan bagian epic harga |
