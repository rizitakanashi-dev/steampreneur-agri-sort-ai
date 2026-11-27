# Runbook Cache & Freshness Harga (isu #43)

> Status: DRAFT operasional. Eksekusi scheduler ke produksi **menunggu** keputusan
> akses #38/#39. Semua state harga bersumber dari **Postgres (Supabase)** — `/tmp`
> bukan lagi sumber kebenaran.

## Arsitektur singkat

| Komponen | Peran |
|---|---|
| `price_observations` (Supabase) | Sumber kebenaran observasi ternormalisasi (idempoten, migrasi #42) |
| `price_sources.freshness` (migrasi #43) | `expected_cadence_seconds` (86400), `grace_period_seconds` (21600), `max_stale_age_seconds` (259200), `documented_extension_seconds` |
| `price_ingest_runs` + unique partial index | Single-flight: maksimum 1 run `running` per sumber di level DB |
| `server/services/price_freshness.py` | Kalkulasi state `fresh/stale/expired/unknown` per sumber |
| `server/services/price_single_flight.py` | Kunci single-flight (memori untuk dev, DB untuk produksi) |
| `POST /api/v1/prices/cron/refresh` | Endpoint scheduler — secret server-only (`PRICE_CRON_SECRET`, compare konstanta-waktu) + rate limit 5/menit/IP |

## Freshness per sumber (bukan TTL global)

| Sumber | Cadence | Grace | Max stale | Ekstensi terdokumentasi |
|---|---|---|---|---|
| `sp2kp` | 1 hari | 6 jam (lag publikasi) | 3 hari | +1 hari (pasar tidak menerbitkan hari Minggu) |
| `sipashorti` | 1 hari | 6 jam | 2 hari | — (belum relevan sampai akses disetujui) |

Aturan penyajian:
- `fresh` → respons normal, `data_status` apa adanya.
- `stale` → **hanya** disajikan dengan `data_status=cached`, `freshness.state=stale`,
  timestamp asli, dan warning `STALE_OBSERVATION`.
- `expired` → **tidak pernah** disajikan sebagai current: `data_status=unavailable`
  + alasan. Hari libur tidak membuat data lama jadi fresh; hanya memperpanjang
  jendela yang terdokumentasi.

## Prosedur refresh

1. Scheduler eksternal memanggil `POST /api/v1/prices/cron/refresh?source_id=sp2kp`
   dengan header `X-Price-Cron-Secret: <PRICE_CRON_SECRET>`.
2. Satu job per sumber. Kalau sudah ada run `running` → respons
   `single_flight_skipped` (tidak merembes ke provider).
3. Gagal provider → run `failed` + kategori error; negative cache menahan retry
   `PRICE_FAILURE_COOLDOWN_SECONDS` (default 300s). Kegagalan **tidak pernah**
   di-cache sebagai data sukses.
4. `PRICE_INGEST_ENABLED=false` (default) → 403 FORBIDDEN untuk semua pemanggil.

## Backfill (hanya dari dataset berizin)

- Import historis wajib berlabel `data_status=historical` — tidak pernah `actual`.
- Idempoten: unik `(source_id, source_record_id)` — re-run tidak menduplikasi.
- Dilarang memundurkan `observed_at` ke waktu ingest.

## Rollback

- Matikan scheduler (berhenti memanggil cron) — data cache tidak berbahaya karena
  expired otomatis tidak disajikan.
- Matikan flag: `PRICE_INGEST_ENABLED=false`, `PRICE_*_ENABLED=false`.
- Rollback migrasi: tabel `price_*` dapat di-drop tanpa memengaruhi fitur lain
  (frontend tetap jalan dengan acuan lokal berlabel jujur).

## Retensi & penghapusan

- Observasi > 400 hari boleh dihapus oleh job pembersihan (belum terjadwal —
  jalankan manual saat diperlukan): `DELETE FROM price_observations WHERE observed_at < now() - interval '400 days';`
- Raw payload hanya disimpan jika lisensi mengizinkan dan tidak ada data personal;
  selain itu cukup `payload_hash`.

## Insiden

| Gejala | Diagnosis | Aksi |
|---|---|---|
| `data_status=unavailable` di semua komoditas | Provider down / secret hilang | Cek `GET /prices/sources/{id}/health` (kategori error), cek flag & secret |
| Semua `stale` berhari-hari | Scheduler tidak berjalan | Cek log cron, `PRICE_INGEST_ENABLED`, secret cron |
| Duplikasi observasi | Dugaan pelanggaran idempotensi | Cek unique index migrasi; re-run ingest (idempoten) |
| 403 terus pada cron | Secret mismatch / flag off | Cocokkan `PRICE_CRON_SECRET`, nyalakan ingest hanya setelah akses resmi |

## Checklist kriteria penerimaan #43

- [x] Migrasi Supabase: tabel, constraint, index, RLS service-role (#42 + #43)
- [x] Cold start / instance baru → observasi & freshness identik (state lewat DB)
- [x] Refresh concurrent → satu fetch / satu ingest idempoten (single-flight)
- [x] Stale hanya berlabel cached + timestamp asli (test)
- [x] Expired tidak disajikan sebagai current (test)
- [x] `/tmp` bukan sumber kebenaran (repository memori hanya fallback dev/test)
- [x] Test: cold cache, warm cache, concurrent refresh, outage, malformed, transisi stale/expired
- [x] Health sumber + last success/failure + umur observasi teramati tanpa kredensial
- [x] Runbook ini
