-- ============================================================
-- Isu #43 — Freshness per sumber + single-flight ingest
--  * Freshness SPESIFIK PER SUMBER (bukan TTL global):
--    expected_cadence, grace_period, max_stale_age.
--  * Single-flight: satu baris ingest 'running' per sumber
--    (unique partial index) — panggilan concurrent/cron tidak
--    merembes ke provider secara bergelombang.
-- ============================================================

alter table price_sources
  add column if not exists expected_cadence_seconds integer default 86400,      -- 1 hari
  add column if not exists grace_period_seconds   integer default 21600,        -- toleransi lag publikasi 6 jam
  add column if not exists max_stale_age_seconds  integer default 259200,       -- 3 hari maksimum disajikan stale
  add column if not exists documented_extension_seconds integer default 0,      -- jendela ekstra TERDOKUMENTASI (mis. pasar libur), tidak membuat data lama "fresh"
  add column if not exists last_attempt_at        timestamptz;

-- Kunci observasi harga dasar tetap di tabel observations (#42).

-- Single-flight: hanya SATU run 'running' per sumber.
-- Upserter kedua akan gagal unique-violation => dijawab "already running".
create unique index if not exists price_ingest_runs_running_uq
  on price_ingest_runs (source_id) where status = 'running';

-- Indeks kesehatan sumber: last success & last attempt cepat diambil.
create index if not exists price_ingest_runs_source_time_idx
  on price_ingest_runs (source_id, started_at desc);

-- Retensi: observasi lebih tua dari 400 hari boleh dibersihkan scheduler
-- (policy di runbook; eksekusi manual/terjadwal, tidak otomatis di sini).
