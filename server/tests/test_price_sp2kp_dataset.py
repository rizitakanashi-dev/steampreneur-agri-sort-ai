"""
Test importer dataset resmi SP2KP (XLSX bulanan via data.go.id resource).

Semua test TANPA jaringan: berkas XLSX dibangun sintetis in-memory
(zipfile + sheet XML) meniru struktur dataset asli: sharedStrings +
worksheets dengan referensi index. Distribusi verifikasi:
  * flag OFF -> AccessUnconfirmed, TANPA panggilan fetch_bytes
  * flag ON -> parse & filter provinsi/varian, tanggal WIB, harga valid
  * baris tanpa harga/0/harga negatif/tanggal rusak DITOLAK (bukan ditebak)
  * data_status SELALU 'historical' (impor dataset, kontrak #41)
  * kegagalan semua bulan -> ProviderFetchError upstream_unavailable
  * anggaran waktu: fetch kedua tidak dijalankan bila deadline lewat
"""

import io
import unittest
import zipfile
from datetime import datetime, timezone

from server.config.price_config import PriceIntegrationConfig
from server.integrations.base import AccessUnconfirmed, PriceQuery
from server.integrations.sp2kp_dataset import (
    Sp2kpDatasetPriceProvider,
    month_urls,
    parse_month_xlsx,
)
from server.services.price_ingestion_service import ProviderFetchError

VARIETIES = ("Cabai Rawit Hijau", "Cabai Rawit Merah", "Cabai Merah Keriting", "Tomat")

HEADER = ["Kode Provinsi", "Nama Provinsi", "Kode Kab/Kota", "Nama Kab/Kota",
          "Nama Varian", "Tanggal", "Harga", "Kuantitas Satuan", "Satuan"]


def _build_xlsx(rows, strings=None):
    """Bundel minimal XLSX: sharedStrings.xml + satu sheet XML."""
    all_strings = list(strings or []) + HEADER
    def s_idx(value):
        if value not in all_strings:
            all_strings.append(value)
        return all_strings.index(value)
    parts = ['<?xml version="1.0"?><worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">']
    parts.append('<row r="1">' + "".join(
        f'<c r="{chr(65+i)}1" t="s"><v>{s_idx(h)}</v></c>' for i, h in enumerate(HEADER)) + "</row>")
    for n, row in enumerate(rows, start=2):
        cells = []
        for i, value in enumerate(row):
            col = chr(65 + i)
            if isinstance(value, (int, float)):
                cells.append(f'<c r="{col}{n}"><v>{value}</v></c>')
            else:
                cells.append(f'<c r="{col}{n}" t="s"><v>{s_idx(value)}</v></c>')
        parts.append(f'<row r="{n}">' + "".join(cells) + "</row>")
    parts.append("</worksheet>")
    sheet = "".join(parts)
    shared = ('<sst count="%d" uniqueCount="%d">' % (len(all_strings), len(all_strings))) + "".join(
        f"<si><t>{v}</t></si>" for v in all_strings) + "</sst>"
    buf = io.BytesIO()
    with zipfile.ZipFile(buf, "w") as zf:
        zf.writestr("xl/sharedStrings.xml", shared)
        zf.writestr("xl/worksheets/sheet1.xml", sheet)
    return buf.getvalue()


def _row(kab="1376", kab_name="Kota Payakumbuh", variety="Cabai Rawit Hijau",
         tanggal="01-09-2025", harga=41000, prov="13", prov_name="Sumatera Barat",
         kuantitas=1, satuan="kg"):
    return [prov, prov_name, kab, kab_name, variety, tanggal, harga, kuantitas, satuan]


def _config(enabled=True, **kw):
    return PriceIntegrationConfig(sp2kp_enabled=enabled, **kw)


class TestParseMonth(unittest.TestCase):
    def test_parse_filters_province_and_varieties(self):
        data = _build_xlsx([
            _row(),                                                      # target
            _row(kab="3175", kab_name="Kota Jakarta Pusat", variety="Tomat",
                 prov="31", prov_name="DKI Jakarta"),  # provinsi lain
            _row(variety="Gula Pasir Kemasan"),                          # varian di luar daftar
            _row(kab="1371", kab_name="Kab. Pesisir Selatan", variety="Tomat"),  # provinsi sama, kab lain
        ])
        rows = parse_month_xlsx(data, province_code="13", varieties=VARIETIES)
        codes = {(r["kab_code"], r["variety"]) for r in rows}
        self.assertIn(("1376", "Cabai Rawit Hijau"), codes)
        self.assertIn(("1371", "Tomat"), codes)
        self.assertNotIn(("3175", "Tomat"), codes)
        self.assertNotIn(("1376", "Gula Pasir Kemasan"), codes)
        self.assertEqual(rows[0]["harga"], "41000")
        self.assertEqual(rows[0]["satuan"], "kg")

    def test_parse_malformed_xlsx_raises_category(self):
        with self.assertRaises(Exception) as ctx:
            parse_month_xlsx(b"bukan xlsx", province_code="13", varieties=VARIETIES)
        self.assertEqual(getattr(ctx.exception, "category", None), "malformed_payload")


class TestObservations(unittest.TestCase):
    def _fetch(self, fetch_bytes, config=None, months_back=1):
        cfg = config or _config(sp2kp_dataset_months_back=months_back)
        provider = Sp2kpDatasetPriceProvider(cfg, fetch_bytes=fetch_bytes)
        return provider.fetch(PriceQuery(commodity_id="", price_type="", region_level="nasional"))

    def test_flag_off_returns_access_unconfirmed_without_network(self):
        calls = []
        def fetch_bytes(url, timeout):
            calls.append(url)
            return _build_xlsx([_row()])
        result = self._fetch(fetch_bytes, config=_config(enabled=False))
        self.assertIsNotNone(result.access)
        self.assertIsInstance(result.access, AccessUnconfirmed)
        self.assertEqual(result.observations, [])
        self.assertEqual(calls, [])  # NOL panggilan jaringan saat mati

    def test_all_observations_historical_with_wib_dates(self):
        def fetch_bytes(url, timeout):
            return _build_xlsx([_row(tanggal="15-09-2025", harga=45000)])
        result = self._fetch(fetch_bytes, months_back=0)
        self.assertIsNone(result.access)
        self.assertEqual(len(result.observations), 1)
        obs = result.observations[0]
        self.assertEqual(obs.data_status, "historical")  # TIDAK PERNAH actual
        self.assertEqual(obs.observed_at, "2025-09-15T00:00:00+07:00")
        self.assertEqual(obs.price_type, "consumer")
        self.assertEqual(obs.region_level, "kabupaten")
        self.assertEqual(obs.region_code, "1376")
        self.assertEqual(obs.region_raw, "Kota Payakumbuh")
        self.assertTrue(obs.is_official)
        self.assertIn("Satu Data Indonesia", obs.license or "")

    def test_bad_rows_rejected_not_guessed(self):
        def fetch_bytes(url, timeout):
            return _build_xlsx([
                _row(tanggal="32-13-2025", harga=45000),   # tanggal rusak
                _row(tanggal="16-09-2025", harga=0),       # harga 0 (kontrak: null, bukan 0)
                _row(tanggal="16-09-2025", harga=-5000),   # harga negatif
                _row(tanggal="16-09-2025", harga="x"),     # harga bukan angka
                _row(tanggal="16-09-2025", harga=46000),   # valid
            ])
        result = self._fetch(fetch_bytes, months_back=0)
        self.assertEqual(len(result.observations), 1)
        self.assertEqual(result.observations[0].price_value, 46000.0)

    def test_source_record_id_stable_and_unique(self):
        def fetch_bytes(url, timeout):
            return _build_xlsx([
                _row(tanggal="01-09-2025", harga=41000),
                _row(tanggal="02-09-2025", harga=42000),
                _row(variety="Tomat", tanggal="02-09-2025", harga=12000),
            ])
        result = self._fetch(fetch_bytes, months_back=0)
        ids = [o.source_record_id for o in result.observations]
        self.assertEqual(len(ids), len(set(ids)))
        self.assertTrue(all(i.startswith("sp2kp-ds-") for i in ids))

    def test_all_months_fail_raises_upstream_unavailable(self):
        def fetch_bytes(url, timeout):
            raise FileNotFoundError(url)
        with self.assertRaises(ProviderFetchError) as ctx:
            self._fetch(fetch_bytes, months_back=1)
        self.assertEqual(ctx.exception.category, "upstream_unavailable")

    def test_budget_skips_second_month(self):
        """Bila anggaran waktu habis setelah bulan pertama, bulan kedua di-skip."""
        calls = []
        def fetch_bytes(url, timeout):
            calls.append(url)
            return _build_xlsx([_row(tanggal="01-09-2025", harga=41000)])
        cfg = PriceIntegrationConfig(
            sp2kp_enabled=True, sp2kp_dataset_months_back=1, http_total_budget_seconds=45,
        )
        import server.integrations.sp2kp_dataset as ds_mod
        real_monotonic = ds_mod.time.monotonic
        state = {"n": 0}
        def fake_monotonic():
            # panggilan 1 (deadline) & 2 (cek bulan-1) = waktu nyata;
            # panggilan 3+ (cek bulan ke-2) = jauh melewati deadline
            state["n"] += 1
            if state["n"] <= 2:
                return real_monotonic()
            return real_monotonic() + 999
        import unittest.mock as mock
        with mock.patch.object(ds_mod.time, "monotonic", fake_monotonic):
            provider = Sp2kpDatasetPriceProvider(cfg, fetch_bytes=fetch_bytes)
            result = provider.fetch(PriceQuery(commodity_id="", price_type="", region_level="nasional"))
        self.assertEqual(len(calls), 1)  # bulan kedua tidak diunduh — anggaran habis
        self.assertGreater(len(result.observations), 0)

    def test_month_urls_order(self):
        urls = month_urls("https://x", 1, now=datetime(2026, 1, 1, tzinfo=timezone.utc))
        self.assertEqual(urls, [
            "https://x/kld/api/list-harga-harian/2026/01",
            "https://x/kld/api/list-harga-harian/2025/12",
        ])


if __name__ == "__main__":
    unittest.main()
