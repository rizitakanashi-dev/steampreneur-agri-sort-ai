"""
Router Smart Pricing & Referensi Harga — Agri-Sort AI Backend
Tanggung Jawab: Fullstack Developer (Backend API)
Dokumen Acuan: docs/rencana-kerja-fullstack.md (Task FS-BE-04)
"""

from typing import Any, Dict
from fastapi import APIRouter, HTTPException, Query, status

from server.services.bapanas_service import bapanas_service
from server.services.pricing_service import (
    get_commodity_pricing,
    list_supported_commodities,
)

router = APIRouter(prefix="/api/v1/pricing", tags=["Pricing & Market Reference"])


@router.get("/bapanas/live")
async def get_bapanas_live() -> Dict[str, Any]:
    """
    Mengambil data harga pangan harian resmi langsung dari Panel Harga BAPANAS (Sumatera Barat).
    """
    data = bapanas_service.get_all_prices()
    return {
        "status": "success",
        "data": data,
    }


@router.get("/bapanas/commodities/{commodity}")
async def get_bapanas_commodity(commodity: str) -> Dict[str, Any]:
    """
    Mengambil harga resmi BAPANAS untuk komoditas tertentu (Cabai, Tomat, Terung).
    """
    data = bapanas_service.get_commodity_price(commodity)
    if not data:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail={
                "code": "BAPANAS_COMMODITY_NOT_FOUND",
                "message": f"Komoditas '{commodity}' tidak terdaftar dalam data Panel Harga BAPANAS.",
            },
        )
    return {
        "status": "success",
        "data": data,
    }


@router.post("/bapanas/sync")
async def sync_bapanas() -> Dict[str, Any]:
    """
    Memicu pembaruan sinkronisasi feed BAPANAS secara instan.
    """
    updated = bapanas_service.sync_feed(force=True)
    return {
        "status": "success",
        "message": "Data Panel Harga BAPANAS berhasil disinkronkan ke versi terbaru.",
        "data": updated,
    }


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

