-- ============================================================
-- Isu #42 — Persistensi harga hortikultura (kontrak #41)
-- Tabel: price_sources, price_observations, price_ingest_runs
-- Prinsip:
--   * RLS diaktifkan TANPA policy peran publik — hanya service role
--     (backend Agri-Sort) yang boleh membaca/menulis.
--   * Idempoten: unik pada (source_id, source_record_id) dan
--     kunci observasi logis (source, commodity, price_type, region, observed_at).
--   * data_status / price_type dibatasi enum kontrak #41.
-- ============================================================

create table if not exists price_sources (
  source_id        text primary key check (source_id in ('sipashorti', 'sp2kp')),
  name             text not null,
  official_url     text not null,
  access_status    text not null default 'unconfirmed' check (access_status in ('authorized', 'unconfirmed', 'denied')),
  license          text,
  attribution      text,
  expected_cadence text default 'daily',
  last_success_at  timestamptz,
  last_error_category text check (last_error_category in ('auth', 'not_found', 'rate_limited', 'server_error', 'timeout', 'malformed_payload')),
  updated_at       timestamptz not null default now()
);

create table if not exists price_ingest_runs (
  id           uuid primary key default gen_random_uuid(),
  source_id    text not null references price_sources (source_id),
  status       text not null check (status in ('running', 'success', 'failed', 'skipped')),
  started_at   timestamptz not null default now(),
  finished_at  timestamptz,
  observation_count integer not null default 0,
  error_category  text check (error_category in ('auth', 'not_found', 'rate_limited', 'server_error', 'timeout', 'malformed_payload')),
  -- Tidak ada kredensial/cookie yang boleh masuk kolom ini
  notes        text
);

create table if not exists price_observations (
  id                 uuid primary key default gen_random_uuid(),
  source_id          text not null references price_sources (source_id),
  source_record_id   text not null,
  commodity_id       text not null check (commodity_id in ('cabai_rawit_hijau', 'cabai_merah_keriting', 'cabai_rawit_merah', 'tomat', 'terung')),
  commodity_raw      text,
  price_type         text not null check (price_type in ('producer', 'wholesale', 'retail', 'consumer', 'unknown')),
  price_value        numeric(14, 2),
  currency           text not null default 'IDR',
  unit_raw           text,
  normalized_price_per_kg numeric(14, 2),
  normalization_method  text,
  region_level       text not null check (region_level in ('nasional', 'provinsi', 'kabupaten')),
  region_code        text,
  region_name        text,
  market_name        text,
  observed_at        timestamptz,
  published_at       timestamptz,
  fetched_at         timestamptz not null default now(),
  data_status        text not null check (data_status in ('actual', 'historical', 'cached', 'simulated', 'unavailable')),
  is_live            boolean not null default false,
  is_official        boolean not null default false,
  provenance_method  text not null check (provenance_method in ('official_api', 'authorized_dataset', 'manual_reference')),
  provenance_reference text,
  license            text,
  payload_hash       text,
  ingest_run_id      uuid references price_ingest_runs (id),
  created_at         timestamptz not null default now()
);

-- Idempotensi #1: identitas rekaman sumber (re-ingest batch sama tidak menduplikasi)
create unique index if not exists price_observations_source_record_uq
  on price_observations (source_id, source_record_id);

-- Idempotensi #2: kunci observasi logis (satu harga per sumber/komoditas/jenis/region/waktu)
create unique index if not exists price_observations_logical_uq
  on price_observations (
    source_id, commodity_id, price_type, region_level,
    coalesce(region_code, ''), coalesce(market_name, ''),
    coalesce(observed_at, '9999-12-31'::timestamptz)
  );

-- Kueri baca: latest & history
create index if not exists price_observations_query_idx
  on price_observations (commodity_id, price_type, region_level, observed_at desc);

alter table price_sources        enable row level security;
alter table price_observations   enable row level security;
alter table price_ingest_runs    enable row level security;

-- Sengaja TANPA policy: hanya kredensial service_role (backend) yang lolos RLS.
