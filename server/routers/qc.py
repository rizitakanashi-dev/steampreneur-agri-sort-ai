"""
Router Quality Control (QC) & Scanner API — Agri-Sort AI Backend
Tanggung Jawab: Fullstack Developer (Backend API)
Dokumen Acuan: docs/rencana-kerja-fullstack.md (Task FS-BE-02)
"""

from typing import Optional
from fastapi import APIRouter, File, Form, HTTPException, UploadFile, status
from fastapi.responses import JSONResponse

from server.utils.security import ImageValidationError, validate_upload_image

router = APIRouter(prefix="/api/v1/qc", tags=["Quality Control"])


@router.post("/scan")
async def scan_harvest_batch(
    image: UploadFile = File(..., description="Berkas citra keranjang panen (JPG, PNG, WebP)"),
    commodity: str = Form("Tomat", description="Jenis komoditas hortikultura"),
    weight_kg: Optional[float] = Form(None, description="Estimasi berat fisik total dari timbangan (kg)"),
    confidence_threshold: float = Form(0.35, description="Batas ambang confidence deteksi (0.1 - 1.0)"),
    mode: str = Form("production", description="Mode eksekusi: 'production' atau 'mock'"),
):
    """
    Endpoint pemindaian kualitas panen (POST /api/v1/qc/scan).
    Menerapkan validasi keamanan ketat (Task FS-BE-02):
    - Validasi Magic Bytes (bukan sekadar ekstensi).
    - Batas ukuran maksimal 10 MB dan minimal 32 bytes.
    - Proteksi Decompression Bomb (maksimal 4096 x 4096 px).
    - Sanitasi nama berkas anti-Path Traversal.
    """
    try:
        image_bytes = await image.read()

        # 1. Jalankan validasi keamanan berkas citra
        validation_result = validate_upload_image(
            image_bytes=image_bytes,
            claimed_filename=image.filename or "upload.jpg",
            claimed_content_type=image.content_type,
        )

        # 2. Validasi parameter input bobot (jika diisi)
        if weight_kg is not None and weight_kg <= 0:
            raise ImageValidationError(
                "Berat total harus bernilai lebih dari 0 kg.",
                code="INVALID_WEIGHT_VALUE",
                details={"weight_kg": weight_kg},
            )

        # 3. Validasi batas confidence threshold
        if not (0.05 <= confidence_threshold <= 0.95):
            raise ImageValidationError(
                "Batas confidence threshold harus berada pada rentang 0.05 hingga 0.95.",
                code="INVALID_CONFIDENCE_THRESHOLD",
                details={"confidence_threshold": confidence_threshold},
            )

        # Pada Task FS-BE-02, respons mengonfirmasi bahwa payload aman dan tervalidasi
        # Pada Task FS-BE-03 berikutnya, ini akan disambungkan ke Mock / ML Inference Engine
        return {
            "status": "success",
            "message": "Citra tervalidasi dan aman untuk diproses.",
            "data": {
                "commodity": commodity,
                "weight_kg": weight_kg,
                "confidence_threshold": confidence_threshold,
                "mode": mode,
                "file_info": validation_result,
            },
        }

    except ImageValidationError as exc:
        return JSONResponse(
            status_code=status.HTTP_400_BAD_REQUEST,
            content={
                "status": "error",
                "error": {
                    "code": exc.code,
                    "message": exc.message,
                    "details": exc.details,
                },
            },
        )
    except Exception as exc:
        return JSONResponse(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            content={
                "status": "error",
                "error": {
                    "code": "SCAN_PROCESSING_ERROR",
                    "message": f"Terjadi kesalahan saat memproses unggahan: {str(exc)}",
                    "details": {},
                },
            },
        )

