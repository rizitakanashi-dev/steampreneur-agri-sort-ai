"""
Router `/api/v1/prices/*` — implementasi kontrak isu #41 (isu #42).

Gerbang akses: seluruh sumber default OFF (temuan #38/#39). Respons selalu jujur:
`data_status=unavailable` + warning eksplisit, BUKAN data statis yang menyamar live.
Envelope: {data, meta.request_id}; error: {error: {code, message, details, request_id}}.
"""

from typing import Optional

from fastapi import APIRouter, Depends, Query, Request, status
from fastapi.responses import JSONResponse

from server.config.price_config import load_price_config
from server.integrations.base import SourceRegistry
from server.models.price import ErrorResponse, WarningCode
from server.repositories.price_repository import build_default_repository
from server.services.price_ingestion_service import IngestionRefused, PriceIngestionService
from server.services.price_normalization import (
    CANONICAL_COMMODITIES,
    resolve_commodity_query,
    resolve_region,
)
from server.services.price_query_service import PriceQueryService, new_request_id
from server.utils.authorization import require_permission

router = APIRouter(prefix="/api/v1/prices", tags=["Horticultural Prices (contract #41)"])


def _error(request: Request, http_status: int, code: str, message: str, details=None) -> JSONResponse:
    body = ErrorResponse(
        error={
            "code": code,
            "message": message,
            "details": details,
            "request_id": getattr(request.state, "request_id", None) or new_request_id(),
        }
    )
    return JSONResponse(status_code=http_status, content=body.model_dump(mode="json"))


def _service() -> PriceQueryService:
    config = load_price_config()
    registry = SourceRegistry(config=config)
    return PriceQueryService(registry=registry, repository=build_default_repository())


def _stamp_request_id(request: Request) -> str:
    request_id = new_request_id()
    request.state.request_id = request_id
    return request_id


def _envelope(request: Request, data, cache_policy: str = "no-store") -> JSONResponse:
    # Kebijakan cache #43: hanya respons yang aman dibagi yang boleh di-cache publik;
    # error & respons per-user TIDAK PERNAH di-cache.
    return JSONResponse(
        content={"data": data, "meta": {"request_id": request.state.request_id}},
        headers={"Cache-Control": cache_policy},
    )


@router.get("/commodities")
async def list_commodities(request: Request) -> JSONResponse:
    _stamp_request_id(request)
    service = _service()
    # Katalog & metadata sumber aman dibagi => boleh cache publik singkat (#43).
    return _envelope(request, [entry.model_dump(mode="json") for entry in service.list_commodities()], cache_policy="public, max-age=300")


@router.get("/sources")
async def list_sources(request: Request) -> JSONResponse:
    _stamp_request_id(request)
    service = _service()
    # Metadata sumber aman dibagi => cache publik singkat (#43).
    return _envelope(request, [s.model_dump(mode="json") for s in service.list_sources()], cache_policy="public, max-age=300")


@router.get("/sources/{source_id}/health")
async def source_health(request: Request, source_id: str) -> JSONResponse:
    _stamp_request_id(request)
    service = _service()
    try:
        health = service.source_health(source_id)
    except KeyError:
        return _error(request, status.HTTP_404_NOT_FOUND, "COMMODITY_NOT_FOUND", "Sumber tidak dikenal.")
    return _envelope(request, health.model_dump(mode="json"))


async def _validate_query(
    request: Request,
    commodity: str,
    price_type: str,
    region_level: str,
    region_code: Optional[str],
    source_id: Optional[str],
    market: Optional[str],
):
    if resolve_commodity_query(commodity) is None:
        return _error(
            request,
            status.HTTP_404_NOT_FOUND,
            "COMMODITY_NOT_FOUND",
            "Komoditas tidak ada di katalog Agri-Sort (pemetaan eksak, tanpa tebak-tebakan).",
            {"commodity": commodity},
        )
    if price_type not in {"producer", "wholesale", "retail", "consumer", "unknown"}:
        return _error(
            request,
            status.HTTP_422_UNPROCESSABLE_ENTITY,
            "INVALID_PRICE_TYPE",
            "price_type harus salah satu dari producer|wholesale|retail|consumer|unknown.",
            {"price_type": price_type},
        )
    if region_level not in {"nasional", "provinsi", "kabupaten"}:
        return _error(
            request,
            status.HTTP_422_UNPROCESSABLE_ENTITY,
            "INVALID_REGION",
            "region_level harus nasional|provinsi|kabupaten.",
            {"region_level": region_level},
        )
    if region_level != "nasional" and resolve_region(region_level, region_code, market) is None:
        return _error(
            request,
            status.HTTP_422_UNPROCESSABLE_ENTITY,
            "INVALID_REGION",
            "region_code wajib angka wilayah untuk level provinsi/kabupaten.",
            {"region_level": region_level, "region_code": region_code},
        )
    if source_id is not None and source_id not in {"sp2kp", "sipashorti"}:
        return _error(
            request,
            status.HTTP_400_BAD_REQUEST,
            "INVALID_QUERY",
            "source_id tidak dikenal.",
            {"source_id": source_id},
        )
    return None


@router.get("/latest")
async def get_latest_price(
    request: Request,
    commodity: str = Query(...),
    price_type: str = Query(...),
    region_level: str = Query(...),
    region_code: Optional[str] = Query(None),
    market: Optional[str] = Query(None),
    source_id: Optional[str] = Query(None),
) -> JSONResponse:
    _stamp_request_id(request)
    invalid = await _validate_query(request, commodity, price_type, region_level, region_code, source_id, market)
    if invalid is not None:
        return invalid
    service = _service()
    observation = service.latest(
        resolve_commodity_query(commodity),
        price_type,
        region_level,
        region_code if region_level != "nasional" else None,
        market,
        source_id,
    )
    return _envelope(request, observation.model_dump(mode="json"))


def _parse_date_range(
    from_date: Optional[str], to_date: Optional[str]
) -> Optional[JSONResponse]:
    if from_date and to_date:
        try:
            if from_date > to_date:
                return from_date, to_date  # sinyal invalid; ditangani pemanggil
        except TypeError:
            pass
    return None


@router.get("/history")
async def get_price_history(
    request: Request,
    commodity: str = Query(...),
    price_type: str = Query(...),
    region_level: str = Query(...),
    region_code: Optional[str] = Query(None),
    market: Optional[str] = Query(None),
    source_id: Optional[str] = Query(None),
    from_date: Optional[str] = Query(None, alias="from"),
    to_date: Optional[str] = Query(None, alias="to"),
    limit: int = Query(90, ge=1, le=200),
    cursor: Optional[str] = Query(None),
) -> JSONResponse:
    _stamp_request_id(request)
    if from_date and to_date and from_date > to_date:
        return _error(
            request,
            status.HTTP_400_BAD_REQUEST,
            "INVALID_QUERY",
            "Rentang tanggal tidak valid: from > to.",
            {"from": from_date, "to": to_date},
        )
    invalid = await _validate_query(request, commodity, price_type, region_level, region_code, source_id, market)
    if invalid is not None:
        return invalid
    service = _service()
    result = service.history(
        resolve_commodity_query(commodity),
        price_type,
        region_level,
        region_code if region_level != "nasional" else None,
        source_id,
        from_date,
        to_date,
        limit,
        cursor,
    )
    payload = {
        "rows": result["rows"],
        "data_status": result["data_status"],
        "warnings": result["warnings"],
    }
    response = _envelope(request, payload)
    return response


def _build_ingestion_service(config=None) -> PriceIngestionService:
    cfg = config or load_price_config()
    registry = SourceRegistry(config=cfg)
    return PriceIngestionService(
        registry=registry,
        repository=build_default_repository(),
        ingest_enabled=cfg.ingest_enabled,
        failure_cooldown_seconds=cfg.failure_cooldown_seconds,
    )


@router.post("/refresh", dependencies=[Depends(require_permission("pricing.sync"))])
async def refresh_prices(request: Request, source_id: str = Query("sp2kp")) -> JSONResponse:
    _stamp_request_id(request)
    if source_id not in {"sp2kp", "sipashorti"}:
        return _error(request, status.HTTP_400_BAD_REQUEST, "INVALID_QUERY", "source_id tidak dikenal.", {"source_id": source_id})
    config = load_price_config()
    service = _build_ingestion_service(config)
    try:
        result = service.run_ingest(source_id)
    except IngestionRefused as refused:
        return _error(
            request,
            status.HTTP_403_FORBIDDEN,
            "FORBIDDEN",
            refused.reason,
            {"source_id": source_id},
        )
    return _envelope(
        request,
        {
            "accepted": True,
            "run_id": result["run_id"],
            "status": result["status"],
            "inserted": result["inserted"],
            "warnings": [WarningCode.SOURCE_ACCESS_UNCONFIRMED] if result["status"] == "skipped" else [],
        },
    )


# ---------------- Scheduler endpoint (isu #43) ----------------
# Untuk external scheduler (mis. cron di luar Vercel). BUKAN endpoint publik:
# memakai server-only secret dengan perbandingan konstanta-waktu + rate limit
# sederhana. Deployment scheduler ke produksi tetap menunggu keputusan #38/#39.

import hmac  # noqa: E402 — modul bawaan, dipakai per endpoint
import secrets as _secrets  # noqa: E402
import time as _time

_CRON_ATTEMPTS: dict = {}
_CRON_WINDOW_SECONDS = 60
_CRON_MAX_ATTEMPTS = 5


def _rate_limited(key: str) -> bool:
    now = _time.monotonic()
    window = [t for t in _CRON_ATTEMPTS.get(key, []) if now - t < _CRON_WINDOW_SECONDS]
    if len(window) >= _CRON_MAX_ATTEMPTS:
        _CRON_ATTEMPTS[key] = window
        return True
    window.append(now)
    _CRON_ATTEMPTS[key] = window
    return False


@router.post("/cron/refresh")
async def cron_refresh(
    request: Request,
    source_id: str = Query("sp2kp"),
) -> JSONResponse:
    """Endpoint scheduler — dilindungi secret server-only (konstanta-waktu) + rate limit."""
    _stamp_request_id(request)
    config = load_price_config()
    provided = request.headers.get("X-Price-Cron-Secret") or ""
    if not config.cron_secret or not _secrets.compare_digest(provided, config.cron_secret):
        return _error(request, status.HTTP_401_UNAUTHORIZED, "UNAUTHORIZED", "Secret scheduler tidak valid.")
    if _rate_limited(request.client.host if request.client else "unknown"):
        return _error(request, status.HTTP_429_TOO_MANY_REQUESTS, "RATE_LIMITED", "Terlalu sering memanggil cron.")
    if source_id not in {"sp2kp", "sipashorti"}:
        return _error(request, status.HTTP_400_BAD_REQUEST, "INVALID_QUERY", "source_id tidak dikenal.", {"source_id": source_id})

    service = _build_ingestion_service(config)
    try:
        result = service.run_ingest(source_id)
    except IngestionRefused as refused:
        return _error(
            request,
            status.HTTP_403_FORBIDDEN,
            "FORBIDDEN",
            refused.reason,
            {"source_id": source_id},
        )
    return _envelope(
        request,
        {
            "accepted": True,
            "run_id": result["run_id"],
            "status": result["status"],
            "inserted": result["inserted"],
            "warnings": [WarningCode.SOURCE_ACCESS_UNCONFIRMED] if result["status"] == "skipped" else [],
        },
    )
