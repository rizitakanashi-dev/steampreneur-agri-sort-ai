"""
Router Riwayat Pemindaian & Skema Database (History & Persistence) — Agri-Sort AI Backend
Tanggung Jawab: Fullstack Developer (Backend API)
Dokumen Acuan: docs/rencana-kerja-fullstack.md (Task FS-BE-05)
"""

from typing import Any, Dict, Optional
from fastapi import APIRouter, HTTPException, Query, status
from fastapi.responses import PlainTextResponse

from server.services.storage_service import get_supabase_ddl, storage_service

router = APIRouter(prefix="/api/v1/qc", tags=["Quality Control History"])


@router.get("/history")
async def get_scan_history(
    limit: int = Query(50, ge=1, le=200, description="Jumlah data per halaman"),
    offset: int = Query(0, ge=0, description="Indeks offset data"),
    commodity: Optional[str] = Query(None, description="Filter berdasarkan nama komoditas"),
) -> Dict[str, Any]:
    """
    Mengambil riwayat hasil pemindaian kualitas panen dengan filter dan paginasi.
    Menyertakan ringkasan akumulasi berat total dan estimasi nilai ekonomi.
    """
    history_data = storage_service.get_scans(limit=limit, offset=offset, commodity=commodity)
    return {
        "status": "success",
        "data": history_data,
    }


@router.post("/history", status_code=status.HTTP_201_CREATED)
async def create_scan_history_record(payload: Dict[str, Any]) -> Dict[str, Any]:
    """
    Menyimpan hasil scan baru ke lapisan persistensi (Task FS-BE-05).
    Dapat dipanggil oleh klien untuk menyimpan sesi pemindaian.
    """
    if not payload:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail={
                "code": "EMPTY_PAYLOAD",
                "message": "Data pemindaian tidak boleh kosong.",
                "details": {},
            },
        )

    saved_record = storage_service.save_scan(payload)
    return {
        "status": "success",
        "message": "Catatan pemindaian berhasil disimpan.",
        "data": saved_record,
    }


@router.get("/history/{scan_id}")
async def get_scan_history_by_id(scan_id: str) -> Dict[str, Any]:
    """Mencari satu catatan pemindaian spesifik berdasarkan scan_id."""
    record = storage_service.get_scan_by_id(scan_id)
    if not record:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail={
                "code": "SCAN_RECORD_NOT_FOUND",
                "message": f"Catatan pemindaian dengan ID '{scan_id}' tidak ditemukan.",
                "details": {"scan_id": scan_id},
            },
        )

    return {
        "status": "success",
        "data": record,
    }


@router.delete("/history/{scan_id}")
async def delete_scan_history_record(scan_id: str) -> Dict[str, Any]:
    """Menghapus satu catatan pemindaian berdasarkan scan_id."""
    deleted = storage_service.delete_scan(scan_id)
    if not deleted:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail={
                "code": "SCAN_RECORD_NOT_FOUND",
                "message": f"Catatan pemindaian dengan ID '{scan_id}' tidak ditemukan untuk dihapus.",
                "details": {"scan_id": scan_id},
            },
        )

    return {
        "status": "success",
        "message": f"Catatan pemindaian '{scan_id}' berhasil dihapus.",
    }


@router.delete("/history")
async def clear_all_scan_history() -> Dict[str, Any]:
    """Mengosongkan seluruh riwayat pemindaian."""
    deleted_count = storage_service.clear_scans()
    return {
        "status": "success",
        "message": f"Seluruh riwayat pemindaian ({deleted_count} data) berhasil dibersihkan.",
        "deleted_count": deleted_count,
    }


@router.get("/schema", response_class=PlainTextResponse)
async def get_database_migration_schema() -> str:
    """
    Mengunduh skema DDL PostgreSQL / Supabase lengkap dengan RLS
    untuk migrasi ke database cloud produksi (Sprint 3 / P2).
    """
    return get_supabase_ddl()

