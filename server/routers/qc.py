"""
Router Quality Control (QC) & Scanner API — Agri-Sort AI Backend
Tanggung Jawab: Fullstack Developer (Backend API)
Dokumen Acuan: docs/rencana-kerja-fullstack.md (Task FS-BE-02 & FS-BE-03)
"""

from datetime import datetime, timezone
from typing import Optional
import uuid

from fastapi import APIRouter, File, Form, HTTPException, UploadFile, status
from fastapi.responses import JSONResponse

from server.services.mock_engine import predict_harvest_image_mock
from server.utils.security import ImageValidationError, validate_upload_image

router = APIRouter(prefix="/api/v1/qc", tags=["Quality Control"])

# Acuan harga simulasi lokal transparan (sesuai kontrak Ground-Truth)
REFERENCE_PRICES = {
    "tomat": 12000,
    "cabai rawit hijau": 30000,
    "cabai merah keriting": 45000,
    "cabai rawit merah": 42000,
    "terung": 10000,
}


@router.post("/scan")
async def scan_harvest_batch(
    image: UploadFile = File(..., description="Berkas citra keranjang panen (JPG, PNG, WebP)"),
    commodity: str = Form("Tomat", description="Jenis komoditas hortikultura"),
    weight_kg: Optional[float] = Form(None, description="Estimasi berat fisik total dari timbangan (kg)"),
    confidence_threshold: float = Form(0.35, description="Batas ambang confidence deteksi (0.05 - 0.95)"),
    mode: str = Form("production", description="Mode eksekusi: 'production' atau 'mock'"),
):
    """
    Endpoint pemindaian kualitas panen (POST /api/v1/qc/scan).
    Menerapkan validasi keamanan ketat (FS-BE-02) dan orkestrasi inferensi (FS-BE-03).
    Mengembalikan format kontrak JSON baku sesuai spesifikasi Bagian 5.2.
    """
    try:
        image_bytes = await image.read()

        # 1. Validasi Keamanan Citra (Magic bytes, batas 10MB, anti-decompression bomb)
        file_info = validate_upload_image(
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

        comm_key = commodity.strip().lower()
        is_tomato = "tomat" in comm_key
        width = file_info["dimensions"]["width"]
        height = file_info["dimensions"]["height"]

        scan_id = f"scan_{datetime.now(timezone.utc).strftime('%Y%m%d')}_{uuid.uuid4().hex[:6]}"
        timestamp = datetime.now(timezone.utc).isoformat()
        ref_price = REFERENCE_PRICES.get(comm_key, 12000)

        # 4. Cabang Deteksi: Model saat ini hanya melatih deteksi Tomat
        if not is_tomato:
            # Komoditas non-tomat: kembalikan transparansi batas model AI
            return {
                "status": "success",
                "data": {
                    "scan_id": scan_id,
                    "timestamp": timestamp,
                    "is_simulated": True,
                    "commodity": commodity,
                    "ai_supported": False,
                    "actual_weight_kg": weight_kg,
                    "message": "Model AI Computer Vision saat ini khusus dilatih untuk komoditas Tomat. Komoditas ini menggunakan pencatatan mutu manual.",
                    "inference_result": None,
                    "smart_pricing": {
                        "commodity": commodity,
                        "reference_price_per_kg": ref_price,
                        "currency": "IDR",
                        "price_unit": "kg",
                        "region": "Sumatera Barat",
                        "price_source": "Tabel Tetap Lokal (Simulasi)",
                        "data_date": "2026-10-13",
                        "data_status": "simulasi",
                        "estimated_economic_value": round(weight_kg * ref_price) if weight_kg else None,
                        "recommendation_note": "Gunakan slider mutu manual untuk memproyeksikan harga komoditas ini.",
                    },
                },
            }

        # 5. Jalankan Inferensi Tomat (Task FS-BE-03: Mock Engine Deterministik)
        raw_detection = await predict_harvest_image_mock(
            image_bytes=image_bytes,
            width=width,
            height=height,
            confidence_threshold=confidence_threshold,
            simulate_delay=(mode != "test"),
        )

        total_objs = raw_detection["detection_summary"]["total_objects"]
        fresh_count = raw_detection["detection_summary"]["class_counts"]["fresh-tomato"]
        rotten_count = raw_detection["detection_summary"]["class_counts"]["rotten-tomato"]

        # Mitigasi ZeroDivisionError jika tidak ada objek terdeteksi
        fresh_ratio = round((fresh_count / total_objs) * 100, 2) if total_objs > 0 else 0.0
        rotten_ratio = round((rotten_count / total_objs) * 100, 2) if total_objs > 0 else 0.0

        # Perhitungan estimasi nilai ekonomi (STEAM Math)
        estimated_val = None
        if weight_kg and weight_kg > 0:
            # Nilai ekonomi = berat total x harga acuan x rasio buah segar
            estimated_val = round(weight_kg * ref_price * (fresh_ratio / 100))

        if total_objs == 0:
            rec_note = (
                "Tidak ada objek tomat yang terdeteksi dengan ambang batas keyakinan saat ini. "
                "Pastikan foto keranjang cukup terang dan fokus, atau turunkan nilai ambang batas keyakinan."
            )
        elif fresh_count == 0:
            rec_note = (
                f"Peringatan Mutu Kritis: Seluruh sampel ({rotten_count} butir) terdeteksi rusak/busuk. "
                "Seluruh keranjang perlu disortir ulang secara ketat sebelum dipasarkan."
            )
        elif rotten_count > 0:
            rec_note = (
                f"Mutu Baik: {fresh_ratio}% tomat segar dari sampel terdeteksi. "
                f"Pisahkan {rotten_count} butir tomat rusak untuk mencegah penularan pembusukan."
            )
        else:
            rec_note = f"Mutu Prima: Seluruh sampel ({fresh_count} butir) terdeteksi segar tanpa tanda pembusukan."

        return {
            "status": "success",
            "data": {
                "scan_id": scan_id,
                "timestamp": timestamp,
                "is_simulated": True,
                "commodity": commodity,
                "ai_supported": True,
                "actual_weight_kg": weight_kg,
                "inference_result": {
                    "model_version": raw_detection["model_version"],
                    "inference_time_ms": raw_detection["inference_time_ms"],
                    "image_dimensions": {"width": width, "height": height},
                    "detections": raw_detection["detections"],
                    "object_counts": {
                        "total": total_objs,
                        "fresh_tomato": fresh_count,
                        "rotten_tomato": rotten_count,
                    },
                    "condition_ratios": {
                        "fresh_ratio_percent": fresh_ratio,
                        "rotten_ratio_percent": rotten_ratio,
                    },
                },
                "smart_pricing": {
                    "commodity": commodity,
                    "reference_price_per_kg": ref_price,
                    "currency": "IDR",
                    "price_unit": "kg",
                    "region": "Sumatera Barat",
                    "price_source": "Tabel Tetap Lokal (Simulasi)",
                    "data_date": "2026-10-13",
                    "data_status": "simulasi",
                    "estimated_economic_value": estimated_val,
                    "value_calculation_method": "Berdasarkan berat aktual input pengguna dan rasio sampel segar terdeteksi",
                    "recommendation_note": rec_note,
                },
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
                    "message": f"Terjadi kesalahan saat memproses pemindaian: {str(exc)}",
                    "details": {},
                },
            },
        )
