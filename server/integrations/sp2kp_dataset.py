"""
SP2KP Authorized Dataset Importer — akses RESMI terkonfirmasi (isu #39).

Basis akses (diverifikasi langsung, bukan asumsi):
  * Dataset "Tingkat Harga Daerah" di Satu Data Indonesia (data.go.id), kurator
    Kementerian Perdagangan, mempublikasikan resource bulanan yang menunjuk ke
    endpoint resmi:
        {base}/kld/api/list-harga-harian/{YYYY}/{MM}
    Berkasnya XLSX harian per kabupaten/kota se-Indonesia:
    kolom `Kode Provinsi, Nama Provinsi, Kode Kab/Kota, Nama Kab/Kota,
    Nama Varian, Tanggal, Harga, Kuantitas Satuan, Satuan`.
  * Unduhan publik: tanpa login, tanpa CAPTCHA, tanpa sesi. Hanya butuh header
    Referer/Origin standar (sesuai halaman dataset resmi). BUKAN scraping SPA —
    ini resource dataset yang dipublikasikan pemerintah secara resmi.
  * PUBLIKASI RETROSPEKTIF BULANAN — BUKAN feed live. Karena itu SEMUA observasi
    dari importer ini berlabel `data_status='historical'` (kontrak #41 melarang
    backfill/impor dataset berlabel `actual`). Label "Live" tidak pernah dipakai.

SIPASHORTI TIDAK termasuk: butuh kredensial operator resmi (isu #38) dan tetap
terkunci sampai akses operator diberikan. Adapter ini tidak mengotomasi login.
"""

import hashlib
import re
import time
import zipfile
from datetime import datetime, timezone
from typing import Callable, Dict, List, Optional, Tuple

from server.config.price_config import PriceIntegrationConfig
from server.integrations.base import (
    AccessUnconfirmed,
    PriceFetchResult,
    PriceQuery,
    ProviderObservation,
)
from server.models.price import SOURCE_ID

# Endpoint resource dataset resmi (dipublikasikan di data.go.id).
SP2KP_DATASET_BASE_URL = "https://api-sp2kp.kemendag.go.id"
# Header standar unduhan dataset publik (bukan kredensial — hanya atribusi asal).
DATASET_REFERER = "https://data.go.id/dataset/dataset/tingkat-harga-daerah"
DATASET_HEADERS = {
    "Accept": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet, */*",
    "Referer": DATASET_REFERER,
    "User-Agent": "AgriSortAI/1.0 (+https://data.go.id dataset importer)",
}

# Kolom XLSX (A..I) sesuai dokumentasi dataset.
_COL_CODE = {"A": "prov_code", "B": "prov_name", "C": "kab_code", "D": "kab_name",
             "E": "variety", "F": "tanggal", "G": "harga", "H": "kuantitas", "I": "satuan"}

_CELL_SHARED_RE = re.compile(r'<c r="([A-I])\d+" t="s"[^>]*?><v>(\d+)</v></c>')
# sel numerik: HARUS bukan t="s" (kolom tanggal F juga bisa berupa string)
_CELL_NUMBER_RE = re.compile(r'<c r="([A-I])\d+"(?![^>]*t="s")[^>]*><v>([\d.]+)</v></c>')
_ROW_RE = re.compile(r"<row[ >](.*?)</row>", re.S)
_SHARED_SI_RE = re.compile(r"<si>(.*?)</si>", re.S)
_SHARED_T_RE = re.compile(r"<t[^>]*>([^<]*)</t>")
_DATE_RE = re.compile(r"^\s*(\d{2})-(\d{2})-(\d{4})\s*$")


class Sp2kpDatasetError(Exception):
    """Kegagalan importer dataset dengan kategori kontrak."""

    def __init__(self, category: str, message: str) -> None:
        super().__init__(message)
        self.category = category


def _default_fetch_bytes(url: str, timeout_seconds: float) -> bytes:
    """Unduhan resource dataset publik. httpx hanya di-import saat adapter aktif."""
    import httpx  # lokal: jalur disabled tetap bebas dependency jaringan

    headers = dict(DATASET_HEADERS)
    headers["Origin"] = "https://data.go.id"
    with httpx.Client(timeout=timeout_seconds, follow_redirects=True) as client:
        resp = client.get(url, headers=headers)
        if resp.status_code == 404:
            raise FileNotFoundError(url)
        if resp.status_code in (502, 503, 504):
            raise Sp2kpDatasetError("upstream_unavailable", f"HTTP {resp.status_code} dari gateway dataset.")
        resp.raise_for_status()
        return resp.content


def parse_month_xlsx(
    data: bytes,
    *,
    province_code: str,
    varieties: Tuple[str, ...],
) -> List[Dict[str, str]]:
    """
    Parse satu berkas XLSX bulanan menjadi baris mentah (kolom -> nilai string).

    Hanya baris provinsi target + varian terdaftar yang dikembalikan; baris lain
    di-skip (bukan ditolak sebagai error — dataset nasional memang berisi semua
    provinsi). Tanpa ketergantungan openpyxl: zipfile + regex pada sheet XML.
    """
    variety_set = set(varieties)
    try:
        zf = zipfile.ZipFile(__import__("io").BytesIO(data))
        shared_raw = zf.read("xl/sharedStrings.xml").decode("utf8", "replace")
        # pilih sheet XML terbesar (dataset asli: Sheet1 indeks kosong, data di sheet kedua)
        sheet_name = max(
            (n for n in zf.namelist() if re.fullmatch(r"xl/worksheets/sheet\d+\.xml", n)),
            key=lambda n: len(zf.read(n)),
        )
        sheet = zf.read(sheet_name).decode("utf8", "replace")
    except (KeyError, zipfile.BadZipFile, StopIteration) as exc:
        raise Sp2kpDatasetError("malformed_payload", f"Berkas XLSX dataset tidak dapat dibaca: {exc}") from exc

    strings = ["".join(_SHARED_T_RE.findall(si)) for si in _SHARED_SI_RE.findall(shared_raw)]

    variety_idx = {i for i, s in enumerate(strings) if s in variety_set}
    prov_idx = {i for i, s in enumerate(strings) if s == province_code}
    rows: List[Dict[str, str]] = []
    for row_match in _ROW_RE.finditer(sheet):
        row_xml = row_match.group(1)
        shared = {c: int(v) for c, v in _CELL_SHARED_RE.findall(row_xml)}
        if "E" not in shared or shared["E"] not in variety_idx:
            continue
        if shared.get("A") not in prov_idx:
            continue
        numbers = {c: v for c, v in _CELL_NUMBER_RE.findall(row_xml)}
        values: Dict[str, str] = {}
        for col in ("A", "B", "C", "D", "E", "F", "I"):
            if col in shared:
                values[_COL_CODE[col]] = strings[shared[col]]
        for col in ("G", "H"):  # harga & kuantitas numerik; tanggal sudah dari shared
            if col in numbers:
                values[_COL_CODE[col]] = numbers[col]
        rows.append(values)
    return rows


def _to_iso_wib(tanggal_raw: Optional[str]) -> Optional[str]:
    m = _DATE_RE.match(tanggal_raw or "")
    if not m:
        return None
    d, mo, y = m.group(1), m.group(2), m.group(3)
    try:
        datetime(int(y), int(mo), int(d))
    except ValueError:
        return None
    return f"{y}-{mo}-{d}T00:00:00+07:00"


def month_urls(base_url: str, months_back: int, now: Optional[datetime] = None) -> List[str]:
    """Daftar URL resource bulanan: dari bulan (now - months_back) s.d. bulan berjalan."""
    ref = now or datetime.now(timezone.utc)
    urls: List[str] = []
    year, month = ref.year, ref.month
    for _ in range(max(0, months_back) + 1):
        urls.append(f"{base_url.rstrip('/')}/kld/api/list-harga-harian/{year:04d}/{month:02d}")
        month -= 1
        if month == 0:
            month = 12
            year -= 1
    return urls  # urutan: terbaru -> terlama (loop budget menghentikan sisa)


class Sp2kpDatasetPriceProvider:
    """
    PriceProvider SP2KP via resource dataset resmi.

    * Flag OFF -> `AccessUnconfirmed` tanpa panggilan jaringan (gerbang #42).
    * Flag ON  -> unduh XLSX bulanan resmi, filter provinsi + varian terdaftar,
      semua observasi `historical`. `fetch_bytes` dapat diinjeksi untuk test.
    """

    source_id: SOURCE_ID = "sp2kp"

    def __init__(
        self,
        config: PriceIntegrationConfig,
        fetch_bytes: Optional[Callable[[str, float], bytes]] = None,
    ) -> None:
        self._config = config
        self._fetch_bytes = fetch_bytes or _default_fetch_bytes

    @property
    def enabled(self) -> bool:
        return bool(self._config.sp2kp_enabled)

    def fetch(self, query: PriceQuery) -> PriceFetchResult:
        if not self.enabled:
            # GERBANG AKSES: flag OFF tetap tanpa panggilan jaringan.
            return PriceFetchResult(
                source_id=self.source_id,
                observations=[],
                error_category=None,
                request_id=None,
                access=AccessUnconfirmed(self.source_id),
            )

        base_url = (self._config.sp2kp_dataset_base_url or SP2KP_DATASET_BASE_URL).rstrip("/")
        province = self._config.sp2kp_dataset_province or "13"
        varieties: Tuple[str, ...] = (
            "Cabai Rawit Hijau",
            "Cabai Rawit Merah",
            "Cabai Merah Keriting",
            "Tomat",
        )
        timeout = min(float(self._config.http_timeout_seconds) * 3, 20.0)
        deadline = time.monotonic() + max(5, self._config.total_budget_seconds)

        observations: List[ProviderObservation] = []
        fetched_months: List[str] = []
        last_error: Optional[str] = None
        for url in month_urls(base_url, self._config.sp2kp_dataset_months_back):
            remaining = deadline - time.monotonic()
            if remaining <= 1.0:
                break  # anggaran habis — bulan berikutnya tidak diunduh
            try:
                # timeout unduhan dibatasi sisa anggaran agar tak melewati deadline
                data = self._fetch_bytes(url, min(timeout, remaining))
            except FileNotFoundError:
                # Bulan berjalan belum dipublikasikan — wajar, bukan kegagalan.
                last_error = f"belum_dipublikasikan {url.rsplit('/', 2)[-2]}/{url.rsplit('/', 2)[-1]}"
                continue
            except Sp2kpDatasetError:
                raise
            except Exception as exc:  # noqa: BLE001 — kategori kontrak, tanpa detail kredensial
                from server.services.price_ingestion_service import ProviderFetchError

                raise ProviderFetchError(
                    "upstream_unavailable", f"Gagal mengunduh dataset SP2KP: {type(exc).__name__}"
                ) from exc

            # Unduhan sudah dibatasi sisa anggaran (clamp timeout) — parse tetap
            # dijalankan; sisa iterasi dihentikan oleh cek `remaining` di atas.
            fetched_months.append(url.rsplit("/", 2)[-2] + "/" + url.rsplit("/", 2)[-1])
            for raw in parse_month_xlsx(data, province_code=province, varieties=varieties):
                obs = self._to_observation(raw)
                if obs is not None:
                    observations.append(obs)

        if not fetched_months and last_error is not None and not observations:
            from server.services.price_ingestion_service import ProviderFetchError

            raise ProviderFetchError(
                "upstream_unavailable",
                "Tidak ada satu pun bulan dataset SP2KP yang berhasil diunduh.",
            )

        return PriceFetchResult(
            source_id=self.source_id,
            observations=observations,
            error_category=None,
            request_id=None,
            access=None,
        )

    def _to_observation(self, raw: Dict[str, str]) -> Optional[ProviderObservation]:
        tanggal = _to_iso_wib(raw.get("tanggal"))
        harga_raw = raw.get("harga")
        if tanggal is None or harga_raw in (None, ""):
            return None  # baris tanpa tanggal/harga eksplisit ditolak, bukan ditebak
        try:
            price_value = float(harga_raw)
        except ValueError:
            return None
        if price_value <= 0:
            return None  # harga 0/negatif tidak pernah masuk (kontrak: null, bukan 0)

        kab_code = (raw.get("kab_code") or "").strip()
        kab_name = (raw.get("kab_name") or "").strip()
        variety = (raw.get("variety") or "").strip()
        if not kab_code.isdigit():
            return None

        canonical = f"{kab_code}|{tanggal}|{variety}"
        digest = hashlib.sha256(canonical.encode("utf8")).hexdigest()
        return ProviderObservation(
            source_record_id=f"sp2kp-ds-{digest[:32]}",
            commodity_raw=variety,
            commodity_id="",  # diisi oleh normalisasi eksak di lapisan ingestion
            price_type="consumer",
            price_value=price_value,
            unit_raw=(raw.get("satuan") or "").strip() or "kg",
            normalized_price_per_kg=None,
            region_level="kabupaten",
            region_code=kab_code,
            region_raw=kab_name or f"Kabupaten/Kota {kab_code}",
            observed_at=tanggal,
            published_at=None,  # dataset retrospektif tidak mencantumkan waktu publikasi
            data_status="historical",  # IMPOR DATASET — tidak pernah 'actual'
            is_official=True,
            license="Satu Data Indonesia — dataset 'Tingkat Harga Daerah' (Kementerian Perdagangan)",
            payload_hash=hashlib.sha256(
                (canonical + f"|{price_value}|{raw.get('satuan')}").encode("utf8")
            ).hexdigest(),
        )

    def health(self) -> Dict[str, object]:
        return {
            "source": self.source_id,
            "state": "enabled_dataset_importer" if self.enabled else "never_fetched",
            "last_error_category": None,
            "last_success_age_seconds": None,
            "last_success_at": None,
        }
