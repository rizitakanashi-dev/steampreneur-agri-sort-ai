"""
PriceQueryService (isu #42) — jalur baca `/api/v1/prices/*`.

Status akses `unconfirmed` (temuan #38/#39):
  * Sumber mati => `data_status=unavailable`, `price_value=        observed_iso = row.get("observed_at")
        observed_at = datetime.fromisoformat(observed_iso) if observed_iso else None
        state, age, max_age = compute_freshness(observed_at, meta.id)
        max_age = max_age if max_age is not None else 172800

        if state == "stale" and WarningCode.STALE_OBSERVATION not in warnings:
            warnings.append(WarningCode.STALE_OBSERVATION)

        data_status = row.get("data_status", "historical")
        if state == "stale" and data_status == "actual":
            data_status = "cached"  # disajikan hanya dengan label stale + timestamp asli

        return PriceObservation(`, warning eksplisit.
  * TIDAK ada fallback ke data statis/simulasi yang menyamar jadi harga terkini.
  * `simulated` hanya muncul bila panggilan membawa flag demo EKSPLISIT (mode demo),
    dan tetap diberi label simulated — tidak pernah default.
"""

import uuid
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional, Tuple

from server.integrations.base import SourceRegistry
from server.models.price import (
    CommodityCatalogEntry,
    CommoditySourceAvailability,
    CommodityRef,
    Freshness,
    NormalizationInfo,
    PriceObservation,
    PriceSourceMeta,
    Provenance,
    Region,
    SourceHealth,
    WarningCode,
)
from server.repositories.price_repository import PriceRepository
from server.services.price_freshness import compute_freshness
from server.services.price_normalization import (
    CANONICAL_COMMODITIES,
    SOURCE_LABEL_MAP,
    is_known_non_mass_unit,
    normalize_unit,
)

# Ketersediaan komoditas per sumber dari EVIDENCE #38/#39 (bukan asumsi):
SOURCE_COMMODITY_SUPPORT: Dict[str, Dict[str, Optional[str]]] = {
    "sp2kp": {
        "cabai_rawit_hijau": None,
        "cabai_merah_keriting": "Daftar komoditas nasional SP2KP tidak memuat komoditas ini (#39).",
        "cabai_rawit_merah": "Daftar komoditas nasional SP2KP tidak memuat komoditas ini (#39).",
        "tomat": None,
        "terung": "Daftar komoditas nasional SP2KP tidak memuat Terung (#39).",
    },
    "sipashorti": {
        commodity_id: "Akses sumber belum terkonfirmasi (#38)."
        for commodity_id in CANONICAL_COMMODITIES
    },
}

UNCONFIRMED_NOTE = "Akses provider belum terkonfirmasi — adapter nonaktif (#38/#39)."


def new_request_id() -> str:
    return f"req_{uuid.uuid4().hex[:20]}"


def _wib_now_iso() -> str:
    # fetched_at selalu UTC (Z)
    return datetime.now(timezone.utc).isoformat().replace("+00:00", "Z")


class PriceQueryService:
    """Jalur baca + penyusunan respons kontrak. Tanpa kredensial provider di respons."""

    def __init__(self, registry: SourceRegistry, repository: PriceRepository) -> None:
        self._registry = registry
        self._repo = repository

    # ---------- catalog ----------

    def list_commodities(self) -> List[CommodityCatalogEntry]:
        entries: List[CommodityCatalogEntry] = []
        for commodity_id, name in CANONICAL_COMMODITIES.items():
            sources: List[CommoditySourceAvailability] = []
            for source_id in ("sp2kp", "sipashorti"):
                note = SOURCE_COMMODITY_SUPPORT[source_id].get(commodity_id)
                price_types = (
                    sorted({pt for (_cid, pt) in SOURCE_LABEL_MAP.get(source_id, {}).values()})
                    if note is None
                    else []
                )
                sources.append(
                    CommoditySourceAvailability(
                        source_id=source_id,  # type: ignore[arg-type]
                        available=note is None,
                        price_types=price_types,  # type: ignore[arg-type]
                        note=note,
                    )
                )
            entries.append(CommodityCatalogEntry(id=commodity_id, name=name, sources=sources))
        return entries

    def list_sources(self) -> List[PriceSourceMeta]:
        return self._registry.all_meta()

    def source_health(self, source_id: str) -> SourceHealth:
        meta = self._registry.meta(source_id)
        if meta is None:
            raise KeyError(source_id)
        last = self._repo.last_success(source_id)
        if not last:
            return SourceHealth(
                source=source_id,  # type: ignore[arg-type]
                state="never_fetched",
                last_error_category=None,
                last_success_age_seconds=None,
                last_success_at=None,
            )
        started_at = datetime.fromisoformat(last["started_at"].replace("Z", "+00:00"))
        age = int((datetime.now(timezone.utc) - started_at).total_seconds())
        return SourceHealth(
            source=source_id,  # type: ignore[arg-type]
            state="healthy" if age < 172800 else "degraded",
            last_error_category=None,
            last_success_age_seconds=max(0, age),
            last_success_at=started_at,
        )

    # ---------- read path ----------

    def latest(
        self,
        commodity_id: str,
        price_type: str,
        region_level: str,
        region_code: Optional[str],
        market: Optional[str],
        source_id: Optional[str],
    ) -> PriceObservation:
        region = Region(
            level=region_level,  # type: ignore[arg-type]
            code=region_code if region_level != "nasional" else None,
            name="Nasional" if region_level == "nasional" else f"Wilayah {region_code}",
        )
        commodity_ref = CommodityRef(id=commodity_id, name=CANONICAL_COMMODITIES.get(commodity_id, commodity_id))
        source_ids = [source_id] if source_id else ["sp2kp", "sipashorti"]

        best: Optional[Tuple[Dict[str, Any], PriceSourceMeta]] = None
        access_unconfirmed = False
        for sid in source_ids:
            meta = self._registry.meta(sid)
            if meta is None:
                continue
            if not self._registry.is_enabled(sid):
                access_unconfirmed = True
                continue
            row = self._repo.latest(commodity_id, price_type, region_level, region_code, sid)
            if row and (best is None or (row.get("observed_at") or "") > (best[0].get("observed_at") or "")):
                best = (row, meta)

        if best is None:
            warnings: List[WarningCode] = []
            if access_unconfirmed:
                warnings.append(WarningCode.SOURCE_ACCESS_UNCONFIRMED)
            # Komoditas yang tidak diterbitkan sumber juga diberi tahu eksplisit.
            for sid in source_ids:
                note = SOURCE_COMMODITY_SUPPORT.get(sid, {}).get(commodity_id)
                if note and sid in SOURCE_COMMODITY_SUPPORT:
                    if WarningCode.SOURCE_DOES_NOT_PUBLISH_COMMODITY not in warnings:
                        warnings.append(WarningCode.SOURCE_DOES_NOT_PUBLISH_COMMODITY)
            first_source = self._registry.meta(source_ids[0])
            return PriceObservation(
                commodity=commodity_ref,
                region=region,
                price_type=price_type,  # type: ignore[arg-type]
                unit_raw="kg",
                price_value=None,
                normalized_price_per_kg=None,
                normalization=None,
                data_status="unavailable",
                is_live=False,
                is_official=bool(first_source and first_source.access_status == "authorized"),
                source=first_source,  # type: ignore[arg-type]
                observed_at=None,
                published_at=None,
                fetched_at=datetime.now(timezone.utc),
                freshness=Freshness(state="unknown", expected_cadence="daily"),
                provenance=Provenance(
                    method="manual_reference",
                    reference=None,
                    notes=UNCONFIRMED_NOTE if access_unconfirmed else "Tidak ada observasi tersimpan.",
                ),
                warnings=warnings,  # type: ignore[arg-type]
            )

        row, meta = best
        observation = self._assemble_observation(row, meta, region, commodity_ref)
        # Kebijakan penyajian #43: expired TIDAK pernah disajikan sebagai current —
        # respons dibungkus `unavailable` dengan alasan; stale hanya berlabel `cached`.
        if observation.freshness.state == "expired":
            return self._unavailable(
                region, commodity_ref, observation.price_type, observation.source,
                notes="Observasi melewati max_stale_age sumber — tidak disajikan sebagai harga terkini.",
                warnings=[WarningCode.STALE_OBSERVATION],
            )
        if observation.freshness.state == "stale" and observation.data_status == "actual":
            observation = observation.model_copy(
                update={"data_status": "cached", "is_live": False}, deep=False
            )
        return observation

    def _assemble_observation(
        self,
        row: Dict[str, Any],
        meta: PriceSourceMeta,
        region: Region,
        commodity_ref: CommodityRef,
    ) -> PriceObservation:
        price_value = row.get("price_value")
        norm = normalize_unit(row.get("unit_raw"), price_value)
        normalization = NormalizationInfo(**norm[1]) if norm else None
        normalized = round(price_value * norm[0], 2) if norm else None

        warnings: List[WarningCode] = []
        if normalized is None and price_value is not None:
            warnings.append(WarningCode.UNIT_NOT_NORMALIZABLE if not is_known_non_mass_unit(row.get("unit_raw")) else WarningCode.UNIT_NOT_NORMALIZABLE)

        observed_iso = row.get("observed_at")
        observed_at = datetime.fromisoformat(observed_iso) if observed_iso else None
        state, age, max_age = compute_freshness(observed_at, meta.id)
        max_age = max_age if max_age is not None else 172800

        if state == "stale" and WarningCode.STALE_OBSERVATION not in warnings:
            warnings.append(WarningCode.STALE_OBSERVATION)

        data_status = row.get("data_status", "historical")
        if state == "stale" and data_status == "actual":
            data_status = "cached"  # disajikan hanya dengan label stale + timestamp asli

        return PriceObservation(
            commodity=commodity_ref,
            region=region,
            price_type=row["price_type"],
            unit_raw=row.get("unit_raw") or "kg",
            price_value=price_value,
            normalized_price_per_kg=normalized,
            normalization=normalization,
            data_status=row.get("data_status", "historical"),
            is_live=False,
            is_official=meta.access_status == "authorized",
            source=meta,
            observed_at=observed_at,
            published_at=None,
            fetched_at=datetime.now(timezone.utc),
            freshness=Freshness(state=state, age_seconds=age, max_age_seconds=max_age, expected_cadence="daily"),
            provenance=Provenance(
                method="official_api" if row.get("provenance_method") == "official_api" else "authorized_dataset",
                reference=row.get("provenance_reference"),
                notes=None,
            ),
            warnings=warnings,  # type: ignore[arg-type]
        )

    def _unavailable(
        self,
        region: Region,
        commodity_ref: CommodityRef,
        price_type: str,
        meta: PriceSourceMeta,
        notes: str,
        warnings: List[WarningCode],
    ) -> PriceObservation:
        return PriceObservation(
            commodity=commodity_ref,
            region=region,
            price_type=price_type,  # type: ignore[arg-type]
            unit_raw="kg",
            price_value=None,
            normalized_price_per_kg=None,
            normalization=None,
            data_status="unavailable",
            is_live=False,
            is_official=bool(meta and meta.access_status == "authorized"),
            source=meta,  # type: ignore[arg-type]
            observed_at=None,
            published_at=None,
            fetched_at=datetime.now(timezone.utc),
            freshness=Freshness(state="unknown", expected_cadence="daily"),
            provenance=Provenance(method="manual_reference", reference=None, notes=notes),
            warnings=warnings,  # type: ignore[arg-type]
        )

    def history(
        self,
        commodity_id: str,
        price_type: str,
        region_level: str,
        region_code: Optional[str],
        source_id: Optional[str],
        from_date: Optional[str],
        to_date: Optional[str],
        limit: int,
        cursor: Optional[str],
    ) -> Dict[str, Any]:
        # Dengan akses unconfirmed, history juga jujur: kosong (bukan deret simulasi).
        result: Dict[str, Any] = {
            "rows": [],
            "next_cursor": None,
            "data_status": "unavailable",
            "warnings": [WarningCode.SOURCE_ACCESS_UNCONFIRMED],
        }
        active_sources = [s for s in (["sp2kp", "sipashorti"] if not source_id else [source_id]) if self._registry.is_enabled(s)]
        if not active_sources:
            return result
        for sid in active_sources:
            page = self._repo.history(
                commodity_id, price_type, region_level, region_code,
                sid, from_date, to_date, limit, cursor,
            )
            if page["rows"]:
                result["rows"].extend(page["rows"])
        result["rows"].sort(key=lambda o: o.get("observed_at") or "")
        result["data_status"] = "historical" if result["rows"] else "unavailable"
        if not result["rows"]:
            result["warnings"] = [WarningCode.SOURCE_ACCESS_UNCONFIRMED]
        else:
            result["warnings"] = []
        return result
