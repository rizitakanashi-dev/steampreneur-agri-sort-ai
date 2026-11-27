"""
Adapter SP2KP (Kementerian Perdagangan RI) — MATI secara default (isu #39).

Status akses: unconfirmed. Tidak ada API publik terdokumentasi; jalur data.go.id
adalah dataset historis (bukan feed live) dan lisensinya belum dikonfirmasi.
Adapter ini tidak boleh memanggil, scraping, atau mengarang nilai sampai #39
memutuskan akses resmi. Ketika diaktifkan (flag + akses approved), implementasi
fetch yang sebenarnya menggantikan `AccessUnconfirmed` ini.
"""

from typing import Dict, Optional

from server.config.price_config import PriceIntegrationConfig
from server.integrations.base import AccessUnconfirmed, PriceFetchResult, PriceQuery
from server.models.price import SOURCE_ID


class Sp2kpPriceProvider:
    """PriceProvider untuk SP2KP — disabled by default, tanpa panggilan jaringan."""

    source_id: SOURCE_ID = "sp2kp"

    def __init__(self, config: PriceIntegrationConfig) -> None:
        self._config = config

    @property
    def enabled(self) -> bool:
        return bool(self._config.sp2kp_enabled)

    def fetch(self, query: PriceQuery) -> PriceFetchResult:
        # GERBANG AKSES: jangan pernah memanggil jaringan saat akses belum resmi.
        return PriceFetchResult(
            source_id=self.source_id,
            observations=[],
            error_category=None,
            request_id=None,
            access=AccessUnconfirmed(self.source_id),
        )

    def health(self) -> Dict[str, object]:
        return {
            "source": self.source_id,
            "state": "never_fetched",
            "last_error_category": None,
            "last_success_age_seconds": None,
            "last_success_at": None,
        }
