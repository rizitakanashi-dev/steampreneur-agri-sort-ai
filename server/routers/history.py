"""
Router Riwayat Pemindaian & Skema Database (History & Persistence) — Agri-Sort AI Backend
Tanggung Jawab: Fullstack Developer (Backend API)
Dokumen Acuan: docs/rencana-kerja-fullstack.md (Task FS-BE-05)
"""

from typing import Any, Dict, Optional
from fastapi import APIRouter, Depends, HTTPException, Query, status
from fastapi.responses import PlainTextResponse

from server.services.storage_service import get_supabase_ddl, storage_service
from server.utils.authorization import get_authorized_current_user, get_authenticated_context, require_permission
from server.services.authorization_service import AuthorizationError

router = APIRouter(prefix="/api/v1/qc", tags=["Quality Control History"])


@router.get("/history")
async def get_scan_history(
    limit: int = Query(50, ge=1, le=200, description="Jumlah data per halaman"),
    offset: int = Query(0, ge=0, description="Indeks offset data"),
    commodity: Optional[str] = Query(None, description="Filter berdasarkan nama komoditas"),
    current_user: Dict[str, Any] = Depends(get_authorized_current_user("scans.read")),
) -> Dict[str, Any]:
    """
    Mengambil riwayat hasil pemindaian kualitas panen dengan filter dan paginasi.
    Menyertakan ringkasan akumulasi berat total dan estimasi nilai ekonomi.
    """
    history_data = storage_service.get_scans(limit=limit, offset=offset, commodity=commodity, user_id=current_user["id"], access_token=current_user["_access_token"])
    return {
        "status": "success",
        "data": history_data,
    }


@router.post("/history", status_code=status.HTTP_201_CREATED)
async def create_scan_history_record(
    payload: Dict[str, Any], current_user: Dict[str, Any] = Depends(get_authorized_current_user("scans.create"))
) -> Dict[str, Any]:
    """
    Menyimpan hasil scan baru ke lapisan persistensi (Task FS-BE-05).
    Dapat dipanggil oleh klien untuk menyimpan sesi pemindaian.
    """
    if "user_id" in payload:
        raise HTTPException(status_code=400, detail={"code": "OWNER_ID_NOT_ACCEPTED", "message": "user_id tidak dapat ditentukan oleh klien."})
    if not payload:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail={
                "code": "EMPTY_PAYLOAD",
                "message": "Data pemindaian tidak boleh kosong.",
                "details": {},
            },
        )

    saved_record = storage_service.save_scan(payload, user_id=current_user["id"], access_token=current_user["_access_token"])
    return {
        "status": "success",
        "message": "Catatan pemindaian berhasil disimpan.",
        "data": saved_record,
    }


@router.get("/history/{scan_id}")
async def get_scan_history_by_id(
    scan_id: str, current_user: Dict[str, Any] = Depends(get_authenticated_context)
) -> Dict[str, Any]:
    """Mencari satu catatan pemindaian spesifik berdasarkan scan_id."""
    try:
        current_user["_authorization_service"].require_resource_access(current_user["_principal"], "scan", scan_id, "scans.read")
    except AuthorizationError as exc:
        if exc.status_code == 404:
            raise HTTPException(status_code=404, detail={"code": "SCAN_RECORD_NOT_FOUND", "message": "Catatan pemindaian tidak ditemukan."}) from exc
        raise HTTPException(status_code=403, detail={"code": "FORBIDDEN", "message": str(exc)}) from exc
    record = storage_service.get_scan_by_id(scan_id, user_id=current_user["id"], access_token=current_user["_access_token"])
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
async def delete_scan_history_record(
    scan_id: str, current_user: Dict[str, Any] = Depends(get_authenticated_context)
) -> Dict[str, Any]:
    """Menghapus satu catatan pemindaian berdasarkan scan_id."""
    try:
        current_user["_authorization_service"].require_resource_access(current_user["_principal"], "scan", scan_id, "scans.delete")
    except AuthorizationError as exc:
        if exc.status_code == 404:
            raise HTTPException(status_code=404, detail={"code": "SCAN_RECORD_NOT_FOUND", "message": "Catatan pemindaian tidak ditemukan."}) from exc
        raise HTTPException(status_code=403, detail={"code": "FORBIDDEN", "message": str(exc)}) from exc
    deleted = storage_service.delete_scan(scan_id, user_id=current_user["id"], access_token=current_user["_access_token"])
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
async def clear_all_scan_history(current_user: Dict[str, Any] = Depends(get_authorized_current_user("scans.delete"))) -> Dict[str, Any]:
    """Mengosongkan seluruh riwayat pemindaian."""
    deleted_count = storage_service.clear_scans(user_id=current_user["id"], access_token=current_user["_access_token"])
    return {
        "status": "success",
        "message": f"Seluruh riwayat pemindaian ({deleted_count} data) berhasil dibersihkan.",
        "deleted_count": deleted_count,
    }


@router.get("/schema", response_class=PlainTextResponse)
async def get_database_migration_schema(_: Any = Depends(require_permission("organizations.read"))) -> str:
    """
    Mengunduh skema DDL PostgreSQL / Supabase lengkap dengan RLS
    untuk migrasi ke database cloud produksi (Sprint 3 / P2).
    """
    return get_supabase_ddl()

