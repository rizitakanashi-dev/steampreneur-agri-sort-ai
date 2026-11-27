"""
Adapter SIPASHORTI (Ditjen Hortikultura, Kementerian Pertanian) — MATI secara default (isu #38).

Status akses: unconfirmed. Halaman harga butuh login operator dan tidak ada API publik
terdokumentasi; registrasi mandiri tidak tersedia. Dilarang otomatisasi login, reuse
cookie, CAPTCHA bypass, atau panggil endpoint SPA tak resmi. Implementasi fetch nyata
hanya setelah #38 memutuskan akses resmi.
"""

from typing import Dict

from server.config.price_config import PriceIntegrationConfig
from server.integrations.base import AccessUnconfirmed, PriceFetchResult, PriceQuery
from server.models.price import SOURCE_ID


class SipashortiPriceProvider:
    """PriceProvider untuk SIPASHORTI — disabled by default, tanpa panggilan jaringan."""

    source_id: SOURCE_ID = "sipashorti"

    def __init__(self, config: PriceIntegrationConfig) -> None:
        self._config = config

    @property
    def enabled(self) -> bool:
        return bool(self._config.sipashorti_enabled)

    def fetch(self, query: PriceQuery) -> PriceFetchResult:
        # GERBANG AKSES: dilarang mengotomatiskan login/sesi operator.
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
