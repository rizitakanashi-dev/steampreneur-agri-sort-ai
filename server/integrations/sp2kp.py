"""
Adapter SP2KP (Kementerian Perdagangan RI) — MATI secara default (isu #39).

Status akses: terkonfirmasi via dataset resmi "Tingkat Harga Daerah" di
Satu Data Indonesia (data.go.id) yang menerbitkan resource unduhan XLSX harian
resmi `api-sp2kp.kemendag.go.id/kld/api/list-harga-harian/{YYYY}/{MM}` — publik,
tanpa login, tanpa CAPTCHA. Bukan scraping SPA dan bukan feed live; publikasi
retrospektif bulanan.

Gerbang tetap berlaku: flag `PRICE_SP2KP_ENABLED=false` (default) => provider
TIDAK memanggil jaringan dan mengembalikan `AccessUnconfirmed`. Saat flag ON,
implementasi `Sp2kpDatasetPriceProvider` yang menjalankan unduhan resminya
(isu #42). SIPASHORTI tetap terkunci (butuh kredensial operator, isu #38).
"""

from typing import Dict

from server.config.price_config import PriceIntegrationConfig
from server.integrations.base import AccessUnconfirmed, PriceFetchResult, PriceQuery
from server.models.price import SOURCE_ID


class Sp2kpPriceProvider:
    """PriceProvider SP2KP — gerbang flag, delegasi ke importer dataset resmi."""

    source_id: SOURCE_ID = "sp2kp"

    def __init__(self, config: PriceIntegrationConfig) -> None:
        self._config = config

    @property
    def enabled(self) -> bool:
        return bool(self._config.sp2kp_enabled)

    def fetch(self, query: PriceQuery) -> PriceFetchResult:
        # GERBANG AKSES: flag OFF => tanpa panggilan jaringan, tanpa nilai karangan.
        if not self.enabled:
            return PriceFetchResult(
                source_id=self.source_id,
                observations=[],
                error_category=None,
                request_id=None,
                access=AccessUnconfirmed(self.source_id),
            )
        # Flag ON: akses resmi dataset sudah terkonfirmasi — jalankan importer.
        from server.integrations.sp2kp_dataset import Sp2kpDatasetPriceProvider

        return Sp2kpDatasetPriceProvider(self._config).fetch(query)

    def health(self) -> Dict[str, object]:
        return {
            "source": self.source_id,
            "state": "enabled_dataset_importer" if self.enabled else "never_fetched",
            "last_error_category": None,
            "last_success_age_seconds": None,
            "last_success_at": None,
        }
