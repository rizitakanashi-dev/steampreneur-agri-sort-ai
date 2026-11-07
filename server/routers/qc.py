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

from server.services.ai_engine import ai_engine
from server.services.mock_engine import predict_harvest_image_mock
from server.services.pricing_service import (
    calculate_business_grading,
    calculate_economic_projection,
    calculate_eggplant_economic_projection,
    get_commodity_pricing,
)
from server.services.storage_service import storage_service
from server.utils.security import ImageValidationError, validate_upload_image

router = APIRouter(prefix="/api/v1/qc", tags=["Quality Control"])


@router.post("/scan")
async def scan_harvest_batch(
    image: UploadFile = File(..., description="Berkas citra keranjang panen (JPG, PNG, WebP)"),
    commodity: str = Form("Tomat", description="Jenis komoditas hortikultura"),
    weight_kg: Optional[float] = Form(None, description="Estimasi berat fisik total dari timbangan (kg)"),
    confidence_threshold: float = Form(0.35, description="Batas ambang confidence deteksi (0.05 - 0.95)"),
    mode: str = Form("production", description="Mode eksekusi: 'production' atau 'mock'"),
    enable_slicing: bool = Form(True, description="Aktifkan Tiled Inference (SAHI) untuk objek bertumpuk"),
    disambiguate_grades: bool = Form(True, description="Aktifkan kalibrasi diskriminasi mutu Class II vs Reject"),
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
        is_eggplant = "terung" in comm_key or "terong" in comm_key or "eggplant" in comm_key
        width = file_info["dimensions"]["width"]
        height = file_info["dimensions"]["height"]

        scan_id = f"scan_{datetime.now(timezone.utc).strftime('%Y%m%d')}_{uuid.uuid4().hex[:6]}"
        timestamp = datetime.now(timezone.utc).isoformat()

        # 4. Cabang Deteksi: Model saat ini mendukung Tomat (2-kelas) dan Terung (4-kelas)
        if not (is_tomato or is_eggplant):
            # Komoditas non-AI: kembalikan transparansi batas model AI & smart pricing manual
            pricing_info = calculate_economic_projection(
                commodity_name=commodity,
                weight_kg=weight_kg,
                fresh_ratio_percent=100.0,
                rotten_count=0,
                fresh_count=0,
            )
            pricing_info["recommendation_note"] = (
                "Komoditas ini belum didukung deteksi citra otomatis. "
                "Gunakan slider mutu manual untuk memproyeksikan estimasi nilai ekonomis."
            )
            return {
                "status": "success",
                "data": {
                    "scan_id": scan_id,
                    "timestamp": timestamp,
                    "is_simulated": True,
                    "commodity": commodity,
                    "ai_supported": False,
                    "actual_weight_kg": weight_kg,
                    "message": "Model AI Computer Vision saat ini mendukung komoditas Tomat dan Terung. Komoditas ini menggunakan pencatatan mutu manual.",
                    "inference_result": None,
                    "smart_pricing": pricing_info,
                },
            }

        # 5. Jalankan Inferensi Berdasarkan Komoditas (Real AI vs Mock Fallback)
        is_simulated = False
        raw_detection = None

        if mode == "production" and ai_engine.is_available():
            try:
                raw_detection = ai_engine.predict(
                    image_bytes=image_bytes,
                    commodity=commodity,
                    confidence_threshold=confidence_threshold,
                    enable_slicing=enable_slicing,
                    disambiguate_grades=disambiguate_grades,
                )
                is_simulated = False
            except Exception:
                # Fallback aman jika model belum dimuat atau terjadi kendala
                raw_detection = None
                is_simulated = True

        if raw_detection is None:
            is_simulated = True
            raw_detection = await predict_harvest_image_mock(
                image_bytes=image_bytes,
                width=width,
                height=height,
                confidence_threshold=confidence_threshold,
                simulate_delay=(mode != "test"),
                commodity=commodity,
            )

        if is_eggplant:
            class_counts = raw_detection["detection_summary"]["class_counts"]
            total_objs = raw_detection["detection_summary"]["total_objects"]
            extra_count = class_counts.get("extra-class", 0) or class_counts.get("Extra Class", 0)
            class1_count = class_counts.get("class-1", 0) or class_counts.get("Class I", 0) or class_counts.get("Class 1", 0)
            class2_count = class_counts.get("class-2", 0) or class_counts.get("Class II", 0) or class_counts.get("Class 2", 0)
            reject_count = class_counts.get("reject", 0) or class_counts.get("Reject", 0)

            pricing_info = calculate_eggplant_economic_projection(
                weight_kg=weight_kg,
                extra_count=extra_count,
                class1_count=class1_count,
                class2_count=class2_count,
                reject_count=reject_count,
            )

            # Business grading mapping sesuai kontrak Faris (docs/rencana-kerja-fullstack.md Bab 3.2)
            business_grading = calculate_business_grading(
                commodity="Terung",
                weight_kg=weight_kg,
                ratios=pricing_info["condition_ratios"],
            )

            result_data = {
                "status": "success",
                "data": {
                    "scan_id": scan_id,
                    "timestamp": timestamp,
                    "is_simulated": is_simulated,
                    "commodity": "Terung",
                    "ai_supported": True,
                    "actual_weight_kg": weight_kg,
                    "grading_system": "4-class (Extra Class, Class I, Class II, Reject)",
                    "inference_result": {
                        "model_version": raw_detection["model_version"],
                        "inference_time_ms": raw_detection["inference_time_ms"],
                        "image_dimensions": {"width": width, "height": height},
                        "detections": raw_detection["detections"],
                        "slicing_applied": raw_detection["detection_summary"].get("slicing_applied", False),
                        "dense_box_suppressed": raw_detection["detection_summary"].get("dense_box_suppressed", False),
                        "disambiguated_count": raw_detection["detection_summary"].get("disambiguated_count", 0),
                        "object_counts": {
                            "total": total_objs,
                            "extra_class": extra_count,
                            "class_1": class1_count,
                            "class_2": class2_count,
                            "reject": reject_count,
                        },
                        "condition_ratios": pricing_info["condition_ratios"],
                    },
                    "business_grading": business_grading,
                    "smart_pricing": pricing_info,
                },
            }

        else:
            class_counts = raw_detection["detection_summary"]["class_counts"]
            total_objs = raw_detection["detection_summary"]["total_objects"]
            fresh_count = class_counts.get("fresh-tomato", 0) or class_counts.get("fresh", 0)
            rotten_count = class_counts.get("rotten-tomato", 0) or class_counts.get("rotten", 0)

            # Mitigasi ZeroDivisionError jika tidak ada objek terdeteksi
            fresh_ratio = round((fresh_count / total_objs) * 100, 2) if total_objs > 0 else 0.0
            rotten_ratio = round((rotten_count / total_objs) * 100, 2) if total_objs > 0 else 0.0

            pricing_info = calculate_economic_projection(
                commodity_name=commodity,
                weight_kg=weight_kg,
                fresh_ratio_percent=fresh_ratio,
                rotten_count=rotten_count,
                fresh_count=fresh_count,
            )

            # Business grading mapping untuk Tomat 2-Class
            business_grading = calculate_business_grading(
                commodity=commodity,
                weight_kg=weight_kg,
                ratios={"fresh_ratio_percent": fresh_ratio, "rotten_ratio_percent": rotten_ratio},
            )

            result_data = {
                "status": "success",
                "data": {
                    "scan_id": scan_id,
                    "timestamp": timestamp,
                    "is_simulated": is_simulated,
                    "commodity": commodity,
                    "ai_supported": True,
                    "actual_weight_kg": weight_kg,
                    "grading_system": "2-class (Fresh, Rotten)",
                    "inference_result": {
                        "model_version": raw_detection["model_version"],
                        "inference_time_ms": raw_detection["inference_time_ms"],
                        "image_dimensions": {"width": width, "height": height},
                        "detections": raw_detection["detections"],
                        "slicing_applied": raw_detection["detection_summary"].get("slicing_applied", False),
                        "dense_box_suppressed": raw_detection["detection_summary"].get("dense_box_suppressed", False),
                        "disambiguated_count": raw_detection["detection_summary"].get("disambiguated_count", 0),
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
                    "business_grading": business_grading,
                    "smart_pricing": pricing_info,
                },
            }

        # Simpan otomatis ke lapisan persistensi (Task FS-BE-05)
        try:
            storage_service.save_scan(result_data["data"])
        except Exception:
            pass

        return result_data

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
