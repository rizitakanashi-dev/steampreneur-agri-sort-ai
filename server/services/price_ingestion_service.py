"""
PriceIngestionService (isu #42) — jalur tulis ke `price_observations`.

Gerbang:
  * `PRICE_INGEST_ENABLED=false` (default) => 403/`refused`, tidak ada run jaringan.
  * Adapter akses unconfirmed => run 'skipped' dengan `SOURCE_ACCESS_UNCONFIRMED`.
  * Observasi yang di-upsert TIDAK PERNAH berlabel `actual` kecuali benar-benar
    berasal dari respons provider berizin; impor historis selalu `historical`.
"""

from datetime import datetime, timezone
from typing import Any, Dict, List

from server.integrations.base import SourceRegistry
from server.repositories.price_repository import PriceRepository
from server.services.price_normalization import resolve_commodity
from server.services.price_query_service import new_request_id


class IngestionRefused(Exception):
    """Ingest dinolak karena flag/konfigurasi — bukan error provider."""

    def __init__(self, reason: str) -> None:
        super().__init__(reason)
        self.reason = reason


class PriceIngestionService:
    def __init__(self, registry: SourceRegistry, repository: PriceRepository, ingest_enabled: bool) -> None:
        self._registry = registry
        self._repo = repository
        self._ingest_enabled = ingest_enabled

    def run_ingest(self, source_id: str) -> Dict[str, Any]:
        if not self._ingest_enabled:
            raise IngestionRefused("PRICE_INGEST_ENABLED=false — ingest dinonaktifkan.")
        provider = self._registry.build_provider(source_id)
        if provider is None:
            raise IngestionRefused(f"Sumber tidak dikenal: {source_id}")
        if not self._registry.is_enabled(source_id):
            run_id = self._repo.record_ingest_run(
                source_id, "skipped", notes="SOURCE_ACCESS_UNCONFIRMED — adapter nonaktif."
            )
            return {"accepted": True, "run_id": run_id, "status": "skipped", "inserted": 0}

        from server.integrations.base import PriceQuery  # import lokal agar siklus bebas

        run_id = self._repo.record_ingest_run(source_id, "running")
        try:
            result = provider.fetch(PriceQuery(commodity_id="", price_type="", region_level="nasional"))
            if result.access is not None:
                self._repo.record_ingest_run(
                    source_id, "skipped", notes="SOURCE_ACCESS_UNCONFIRMED — adapter menolak."
                )
                return {"accepted": True, "run_id": run_id, "status": "skipped", "inserted": 0}
            observations = self._normalize_batch(source_id, result)
            inserted = self._repo.upsert_observations(observations, run_id)
            self._repo.record_ingest_run(source_id, "success", notes=f"inserted={inserted}")
            return {"accepted": True, "run_id": run_id, "status": "success", "inserted": inserted}
        except Exception as exc:  # noqa: BLE001 — kategori saja, tanpa kredensial
            category = getattr(exc, "category", None) or "server_error"
            self._repo.record_ingest_run(
                source_id, "failed", notes=f"error_category={category}"
            )
            raise

    def _normalize_batch(self, source_id: str, result: Any) -> List[Dict[str, Any]]:
        """Resolusi EKSAK per rekaman; rekaman tak dikenal DITOLAK, bukan ditebak."""
        from server.services.price_normalization import normalize_unit

        rows: List[Dict[str, Any]] = []
        for obs in result.observations:
            commodity_id, price_type, supported = resolve_commodity(obs.commodity_raw, source_id)
            if not supported:
                # Rekaman di luar pemetaan disetujui => tolak rekaman ini saja.
                continue
            norm = normalize_unit(obs.unit_raw, obs.price_value)
            rows.append(
                {
                    "source_id": source_id,
                    "source_record_id": obs.source_record_id,
                    "commodity_id": commodity_id,
                    "commodity_raw": obs.commodity_raw,
                    "price_type": obs.price_type,
                    "price_value": obs.price_value,
                    "currency": "IDR",
                    "unit_raw": obs.unit_raw,
                    "normalized_price_per_kg": (
                        round(obs.price_value * norm[0], 2) if norm else None
                    ),
                    "normalization_method": (norm[1]["method"] if norm else None),
                    "region_level": obs.region_level,
                    "region_code": obs.region_code,
                    "region_name": obs.region_raw,
                    "market_name": None,
                    "observed_at": obs.observed_at,
                    "published_at": obs.published_at,
                    "fetched_at": datetime.now(timezone.utc).isoformat(),
                    "data_status": obs.data_status,
                    "is_live": obs.data_status == "actual",
                    "is_official": obs.is_official,
                    "provenance_method": "official_api",
                    "provenance_reference": obs.license,
                    "license": obs.license,
                    "payload_hash": obs.payload_hash,
                }
            )
        return rows
