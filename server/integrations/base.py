"""
Protokol provider harga (isu #42) — DTO provider tidak boleh bocor keluar layer ini.

Gerbang akses (#38/#39):
  * `enabled=False` (default) => provider TIDAK BOLEH melakukan panggilan jaringan.
    `fetch()` mengembalikan `AccessUnconfirmed` — bukan nilai karangan, bukan scraping.
  * HTTP client (`httpx`) hanya di-import ketika adapter benar-benar aktif, sehingga
    jalur disabled tetap bebas dependency jaringan saat test.
"""

from dataclasses import dataclass, field
from typing import Callable, Dict, List, Optional, Protocol, runtime_checkable

from server.config.price_config import PriceIntegrationConfig
from server.models.price import ErrorCategory, PriceSourceMeta, SOURCE_ID


@dataclass(frozen=True)
class PriceQuery:
    """Permintaan baca (sudah ternormalisasi; tanpa kredensial)."""

    commodity_id: str
    price_type: str
    region_level: str
    region_code: Optional[str] = None
    market: Optional[str] = None
    from_date: Optional[str] = None
    to_date: Optional[str] = None
    limit: int = 90
    cursor: Optional[str] = None


@dataclass(frozen=True)
class AccessUnconfirmed:
    """Keputusan akses belum ada (temuan #38/#39) — adapter mati, tanpa panggilan jaringan."""

    source_id: str
    reason: str = "Akses provider belum terkonfirmasi (lihat isu #38/#39)."


@dataclass(frozen=True)
class ProviderObservation:
    """Rekaman mentah+ternormalisasi dari satu provider (DTO internal adapter)."""

    source_record_id: str
    commodity_raw: str
    commodity_id: str
    price_type: str
    price_value: Optional[float]
    unit_raw: str
    normalized_price_per_kg: Optional[float]
    region_level: str
    region_code: Optional[str]
    region_raw: str
    observed_at: Optional[str]  # ISO-8601 +07:00
    published_at: Optional[str]  # ISO-8601 +07:00
    data_status: str  # actual | historical
    is_official: bool = True
    license: Optional[str] = None
    payload_hash: Optional[str] = None


@dataclass(frozen=True)
class PriceFetchResult:
    """Hasil fetch adapter. `observations` kosong + error_category => provider gagal."""

    source_id: str
    observations: List[ProviderObservation] = field(default_factory=list)
    error_category: Optional[ErrorCategory] = None
    request_id: Optional[str] = None
    access: Optional[AccessUnconfirmed] = None


@runtime_checkable
class PriceProvider(Protocol):
    """Kontrak minimal tiap provider: `source_id`, `fetch(query)`, `health()`."""

    source_id: SOURCE_ID

    def fetch(self, query: PriceQuery) -> PriceFetchResult: ...

    def health(self) -> Dict[str, object]: ...


# Metadata sumber statis — konsisten dengan tabel "Sumber & migrasi" kontrak #41.
SOURCE_REGISTRY: Dict[str, PriceSourceMeta] = {
    "sp2kp": PriceSourceMeta(
        id="sp2kp",
        name="SP2KP — Kementerian Perdagangan RI",
        url="https://sp2kp.kemendag.go.id/",
        access_status="unconfirmed",
        license=None,
        attribution="Sumber: SP2KP Kemendag RI",
        expected_cadence="daily",
    ),
    "sipashorti": PriceSourceMeta(
        id="sipashorti",
        name="SIPASHORTI — Ditjen Hortikultura, Kementerian Pertanian",
        url="https://11ap.pertanian.go.id/sipashorti/",
        access_status="unconfirmed",
        license=None,
        attribution="Sumber: SIPASHORTI Ditjen Hortikultura",
        expected_cadence="daily",
    ),
}


@dataclass
class SourceRegistry:
    """Daftar provider aktif per konfigurasi. Adapter mati tetap terdaftar (health-nya jujur)."""

    config: PriceIntegrationConfig
    transport_factory: Optional[Callable[[], object]] = None

    def is_enabled(self, source_id: str) -> bool:
        if source_id == "sp2kp":
            return bool(self.config.sp2kp_enabled)
        if source_id == "sipashorti":
            return bool(self.config.sipashorti_enabled)
        return False

    def build_provider(self, source_id: str) -> Optional[PriceProvider]:
        if source_id == "sp2kp":
            provider: PriceProvider = Sp2kpPriceProvider(self.config)
        elif source_id == "sipashorti":
            provider = SipashortiPriceProvider(self.config)
        else:
            return None
        return provider

    def meta(self, source_id: str) -> Optional[PriceSourceMeta]:
        return SOURCE_REGISTRY.get(source_id)

    def all_meta(self) -> List[PriceSourceMeta]:
        return list(SOURCE_REGISTRY.values())
