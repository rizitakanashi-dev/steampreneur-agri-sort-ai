"""
Router Smart Pricing & Referensi Harga — Agri-Sort AI Backend
Tanggung Jawab: Fullstack Developer (Backend API)
Dokumen Acuan: docs/rencana-kerja-fullstack.md (Task FS-BE-04)
"""

from typing import Any, Dict
from fastapi import APIRouter, HTTPException, Query, status

from server.services.pricing_service import (
    get_commodity_pricing,
    list_supported_commodities,
)

router = APIRouter(prefix="/api/v1/pricing", tags=["Pricing & Market Reference"])


@router.get("/commodities")
async def get_all_commodities() -> Dict[str, Any]:
    """
    Mengambil daftar seluruh komoditas yang didukung beserta harga acuan dan metadatanya.
    Memungkinkan frontend memuat data harga secara dinamis.
    """
    commodities = list_supported_commodities()
    return {
        "status": "success",
        "data": {
            "total_commodities": len(commodities),
            "commodities": commodities,
        },
    }


@router.get("/{commodity}")
async def get_commodity_by_name(
    commodity: str,
    region: str = Query("Sumatera Barat", description="Wilayah acuan harga"),
) -> Dict[str, Any]:
    """
    Mengambil harga acuan dan metadata untuk komoditas tertentu.
    Jika komoditas tidak dikenal, mengembalikan status 404 terstandarisasi.
    """
    pricing = get_commodity_pricing(commodity, region=region)
    if not pricing["is_known"]:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail={
                "code": "COMMODITY_NOT_FOUND",
                "message": f"Komoditas '{commodity}' tidak ditemukan dalam tabel acuan harga.",
                "details": {"requested_commodity": commodity, "requested_region": region},
            },
        )

    return {
        "status": "success",
        "data": pricing,
    }

