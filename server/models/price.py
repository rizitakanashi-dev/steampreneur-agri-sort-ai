"""
Model Pydantic kontrak harga (isu #41) — dipakai router `/api/v1/prices/*` (#42).

Semua field mengikuti `docs/contracts/prices-api.openapi.yaml`.
Dilarang menambahkan field yang menyebut URL/kredensial provider di luar `PriceSource`.
"""

from datetime import datetime
from enum import Enum
from typing import List, Literal, Optional

from pydantic import BaseModel, Field

PRICE_TYPE = Literal["producer", "wholesale", "retail", "consumer", "unknown"]
DATA_STATUS = Literal["actual", "historical", "cached", "simulated", "unavailable"]
FRESHNESS_STATE = Literal["fresh", "stale", "expired", "unknown"]
REGION_LEVEL = Literal["nasional", "provinsi", "kabupaten"]
PROVENANCE_METHOD = Literal["official_api", "authorized_dataset", "manual_reference"]
SOURCE_ID = Literal["sipashorti", "sp2kp"]


class WarningCode(str, Enum):
    SOURCE_DOES_NOT_PUBLISH_COMMODITY = "SOURCE_DOES_NOT_PUBLISH_COMMODITY"
    SOURCE_ACCESS_UNCONFIRMED = "SOURCE_ACCESS_UNCONFIRMED"
    STALE_OBSERVATION = "STALE_OBSERVATION"
    UNIT_NOT_NORMALIZABLE = "UNIT_NOT_NORMALIZABLE"


class ErrorCategory(str, Enum):
    AUTH = "auth"
    NOT_FOUND = "not_found"
    RATE_LIMITED = "rate_limited"
    SERVER_ERROR = "server_error"
    TIMEOUT = "timeout"
    MALFORMED_PAYLOAD = "malformed_payload"


class Meta(BaseModel):
    request_id: str


class Region(BaseModel):
    level: REGION_LEVEL
    code: Optional[str] = None
    name: str
    parent: Optional["Region"] = None


class NormalizationInfo(BaseModel):
    method: str
    factor: float
    source_unit: str


class PriceSourceMeta(BaseModel):
    id: SOURCE_ID
    name: str
    url: str
    access_status: Literal["authorized", "unconfirmed", "denied"]
    license: Optional[str] = None
    attribution: Optional[str] = None
    expected_cadence: Optional[str] = None


class Freshness(BaseModel):
    state: FRESHNESS_STATE = "unknown"
    age_seconds: Optional[int] = Field(default=None, ge=0)
    max_age_seconds: Optional[int] = Field(default=None, ge=0)
    expected_cadence: Optional[str] = None


class Provenance(BaseModel):
    method: PROVENANCE_METHOD
    reference: Optional[str] = None
    notes: Optional[str] = None


class PriceObservation(BaseModel):
    """Satu harga = satu jenis dari satu sumber. `null` selalu bermakna 'tidak ada data'."""

    commodity: "CommodityRef"
    region: Region
    price_type: PRICE_TYPE
    currency: Literal["IDR"] = "IDR"
    unit_raw: str
    price_value: Optional[float] = None
    normalized_price_per_kg: Optional[float] = None
    normalization: Optional[NormalizationInfo] = None
    data_status: DATA_STATUS
    is_live: bool = False
    is_official: bool = False
    source: PriceSourceMeta
    observed_at: Optional[datetime] = None
    published_at: Optional[datetime] = None
    fetched_at: Optional[datetime] = None
    freshness: Freshness = Freshness()
    provenance: Provenance
    warnings: List[WarningCode] = []


class CommodityRef(BaseModel):
    id: str
    name: str
    raw_label: Optional[str] = None


class CommodityCatalogEntry(BaseModel):
    id: str
    name: str
    sources: List["CommoditySourceAvailability"]


class CommoditySourceAvailability(BaseModel):
    source_id: SOURCE_ID
    available: bool
    price_types: List[PRICE_TYPE] = []
    note: Optional[str] = None


class SourceHealth(BaseModel):
    source: SOURCE_ID
    state: Literal["healthy", "degraded", "down", "never_fetched"] = "never_fetched"
    last_error_category: Optional[ErrorCategory] = None
    last_success_age_seconds: Optional[int] = Field(default=None, ge=0)
    last_success_at: Optional[datetime] = None


class ContractError(BaseModel):
    code: str
    message: str
    details: Optional[dict] = None
    request_id: str


class ErrorResponse(BaseModel):
    error: ContractError


CommodityRef.model_rebuild()
Region.model_rebuild()
