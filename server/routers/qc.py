"""
Router Quality Control (QC) & Scanner API — Agri-Sort AI Backend
Tanggung Jawab: Fullstack Developer (Backend API)
Dokumen Acuan: docs/rencana-kerja-fullstack.md (Task FS-BE-02 & FS-BE-03)
"""

import logging
from datetime import datetime, timezone
from typing import Optional
import uuid

from fastapi import APIRouter, File, Form, HTTPException, UploadFile, status
from fastapi.responses import JSONResponse

from server.services.ai_engine import ai_engine
from server.services.mock_engine import predict_harvest_image_mock
from server.services.multi_angle_service import aggregate_multi_view_qc
from server.services.pricing_service import (
    calculate_business_grading,
    calculate_economic_projection,
    calculate_eggplant_economic_projection,
    get_commodity_pricing,
)
from server.services.storage_service import storage_service
from server.utils.image_quality import analyze_image_quality, apply_clahe_enhancement
from server.utils.security import ImageValidationError, validate_upload_image

logger = logging.getLogger("agrisort.qc_router")
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

        # 3. Analisis Kualitas Citra (Blur & Exposure)
        quality_info = analyze_image_quality(image_bytes)
        is_blurry = quality_info.get("is_blurry", False)
        is_extreme_exp = quality_info.get("is_overexposed", False) or quality_info.get("is_underexposed", False)

        # 4. Validasi Komoditas: Model saat ini mendukung Tomat (2-kelas) dan Terung (4-kelas)
        if not (is_tomato or is_eggplant):
            execution_status = "unsupported"
            status_details = {
                "code": "COMMODITY_UNSUPPORTED",
                "message": f"Komoditas '{commodity}' belum memiliki model Computer Vision resmi. Menggunakan estimasi acuan pasar & pencatatan mutu manual.",
                "is_ai_generated": False,
                "requires_human_confirmation": True,
            }
            pricing_info = calculate_economic_projection(
                commodity_name=commodity,
                weight_kg=weight_kg,
                fresh_ratio_percent=100.0,
                rotten_count=0,
                fresh_count=0,
            )
            pricing_info["recommendation_note"] = (
                f"Komoditas '{commodity}' belum didukung deteksi citra otomatis. "
                "Gunakan pencatatan mutu manual untuk memproyeksikan estimasi nilai ekonomis."
            )
            return {
                "status": "success",
                "data": {
                    "scan_id": scan_id,
                    "timestamp": timestamp,
                    "execution_status": execution_status,
                    "status_details": status_details,
                    "is_simulated": False,
                    "commodity": commodity,
                    "ai_supported": False,
                    "actual_weight_kg": weight_kg,
                    "message": f"Model AI Computer Vision saat ini mendukung komoditas Tomat dan Terung. Komoditas '{commodity}' menggunakan pencatatan mutu manual.",
                    "image_quality": quality_info,
                    "inference_result": None,
                    "business_grading": None,
                    "smart_pricing": pricing_info,
                },
            }

        # 5. Jalankan Inferensi Berdasarkan Mode & Ketersediaan Model (Anti-Silent Mock Fallback)
        raw_detection = None
        execution_status = "ai_detected"
        status_details = {
            "code": "AI_INFERENCE_OPTIMAL",
            "message": "Inferensi AI berhasil dengan tingkat keyakinan optimal.",
            "is_ai_generated": True,
            "requires_human_confirmation": False,
        }

        if mode == "mock":
            execution_status = "simulated"
            status_details = {
                "code": "EXPLICIT_SIMULATION",
                "message": "Mode simulasi diminta secara eksplisit. Hasil deteksi disintesis untuk keperluan demonstrasi/pengujian non-AI.",
                "is_ai_generated": False,
                "requires_human_confirmation": True,
            }
            raw_detection = await predict_harvest_image_mock(
                image_bytes=image_bytes,
                width=width,
                height=height,
                confidence_threshold=confidence_threshold,
                simulate_delay=False,
                commodity=commodity,
            )
        else:
            if not ai_engine.is_available():
                logger.warning("Runtime AI tidak tersedia saat request pemindaian %s", commodity)
                execution_status = "model_unavailable"
                status_details = {
                    "code": "RUNTIME_UNAVAILABLE",
                    "message": f"Runtime AI (ONNX Runtime / Ultralytics) tidak tersedia di server untuk komoditas '{commodity}'.",
                    "is_ai_generated": False,
                    "requires_human_confirmation": True,
                }
                raw_detection = None
            else:
                try:
                    raw_detection = ai_engine.predict(
                        image_bytes=image_bytes,
                        commodity=commodity,
                        confidence_threshold=confidence_threshold,
                        enable_slicing=enable_slicing,
                        disambiguate_grades=disambiguate_grades,
                    )
                except Exception as exc:
                    logger.exception("Inferensi AI gagal untuk komoditas %s: %s", commodity, exc)
                    execution_status = "model_unavailable"
                    status_details = {
                        "code": "INFERENCE_EXECUTION_FAILED",
                        "message": f"Gagal mengeksekusi inferensi AI untuk komoditas '{commodity}'. Silakan periksa server atau gunakan input manual.",
                        "is_ai_generated": False,
                        "requires_human_confirmation": True,
                    }
                    raw_detection = None

        # 6. Tangani Jika Model Tidak Tersedia / Eksekusi Gagal (Tanpa Mock Siluman)
        if raw_detection is None:
            pricing_info = calculate_economic_projection(
                commodity_name=commodity,
                weight_kg=weight_kg,
                fresh_ratio_percent=100.0,
                rotten_count=0,
                fresh_count=0,
            )
            pricing_info["recommendation_note"] = (
                f"Model AI untuk {commodity} tidak dapat memproses citra saat ini. "
                "Estimasi harga dihitung berdasarkan acuan standar pasar lokal."
            )
            result_data = {
                "status": "success",
                "data": {
                    "scan_id": scan_id,
                    "timestamp": timestamp,
                    "execution_status": execution_status,
                    "status_details": status_details,
                    "is_simulated": False,
                    "commodity": commodity,
                    "ai_supported": True,
                    "actual_weight_kg": weight_kg,
                    "message": status_details["message"],
                    "image_quality": quality_info,
                    "inference_result": None,
                    "business_grading": None,
                    "smart_pricing": pricing_info,
                },
            }
            try:
                storage_service.save_scan(result_data["data"])
            except Exception:
                pass
            return result_data

        # 7. Evaluasi Mutu Deteksi Riil (ai_detected vs needs_review)
        if execution_status != "simulated":
            total_objs = raw_detection["detection_summary"]["total_objects"]
            detections = raw_detection.get("detections", [])
            avg_conf = (sum(d["confidence"] for d in detections) / total_objs) if total_objs > 0 else 0.0
            dense_suppressed = raw_detection["detection_summary"].get("dense_box_suppressed", False)
            disambiguated = raw_detection["detection_summary"].get("disambiguated_count", 0)

            if total_objs == 0:
                execution_status = "needs_review"
                status_details = {
                    "code": "ZERO_OBJECTS_DETECTED",
                    "message": "Tidak ada buah/objek yang terdeteksi dengan ambang batas keyakinan saat ini. Verifikasi manual diperlukan.",
                    "is_ai_generated": True,
                    "requires_human_confirmation": True,
                }
            elif is_blurry:
                execution_status = "needs_review"
                status_details = {
                    "code": "IMAGE_BLURRY",
                    "message": "Citra terdeteksi buram atau tidak fokus. Deteksi mungkin kurang akurat, verifikasi manual diperlukan.",
                    "is_ai_generated": True,
                    "requires_human_confirmation": True,
                }
            elif is_extreme_exp:
                execution_status = "needs_review"
                status_details = {
                    "code": "IMAGE_EXPOSURE_EXTREME",
                    "message": "Pencahayaan citra terdeteksi ekstrem (terlalu gelap atau silau). Verifikasi manual diperlukan.",
                    "is_ai_generated": True,
                    "requires_human_confirmation": True,
                }
            elif avg_conf < 0.45:
                execution_status = "needs_review"
                status_details = {
                    "code": "LOW_CONFIDENCE_SCORE",
                    "message": f"Rata-rata tingkat keyakinan model rendah ({round(avg_conf * 100, 1)}%). Verifikasi manual disarankan.",
                    "is_ai_generated": True,
                    "requires_human_confirmation": True,
                }
            elif dense_suppressed:
                execution_status = "needs_review"
                status_details = {
                    "code": "DENSE_CRATE_OCCLUSION",
                    "message": "Terdeteksi tumpukan keranjang padat dengan supresi kotak monolitik. Disarankan meninjau sampel.",
                    "is_ai_generated": True,
                    "requires_human_confirmation": True,
                }
            elif disambiguated > 0:
                execution_status = "needs_review"
                status_details = {
                    "code": "HIGH_GRADE_AMBIGUITY",
                    "message": f"Terdeteksi {disambiguated} butir dengan ambiguitas mutu Class II vs Reject yang telah disesuaikan via heuristik. Verifikasi manual disarankan.",
                    "is_ai_generated": True,
                    "requires_human_confirmation": True,
                }

        is_simulated = (execution_status == "simulated")

        if is_eggplant:
            class_counts = raw_detection["detection_summary"]["class_counts"]
            total_objs = raw_detection["detection_summary"]["total_objects"]
            grade_a_count = class_counts.get("Grade A", 0) or class_counts.get("grade-a", 0)
            grade_b_count = class_counts.get("Grade B", 0) or class_counts.get("grade-b", 0)
            extra_count = class_counts.get("extra-class", 0) or class_counts.get("Extra Class", 0)
            class1_count = class_counts.get("class-1", 0) or class_counts.get("Class I", 0) or class_counts.get("Class 1", 0)
            class2_count = class_counts.get("class-2", 0) or class_counts.get("Class II", 0) or class_counts.get("Class 2", 0)
            reject_count = class_counts.get("reject", 0) or class_counts.get("Reject", 0)

            # Jika model terung yang aktif adalah 3-Grade v2 (Grade A, Grade B, Reject):
            if (grade_a_count > 0 or grade_b_count > 0) and extra_count == 0 and class1_count == 0 and class2_count == 0:
                extra_count = grade_a_count
                class1_count = 0
                class2_count = grade_b_count

            pricing_info = calculate_eggplant_economic_projection(
                weight_kg=weight_kg,
                extra_count=extra_count,
                class1_count=class1_count,
                class2_count=class2_count,
                reject_count=reject_count,
                grade_a_count=grade_a_count,
                grade_b_count=grade_b_count,
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
                    "execution_status": execution_status,
                    "status_details": status_details,
                    "is_simulated": is_simulated,
                    "commodity": "Terung",
                    "ai_supported": True,
                    "actual_weight_kg": weight_kg,
                    "image_quality": quality_info,
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
                            "grade_a": grade_a_count if (grade_a_count > 0 or grade_b_count > 0) else extra_count + class1_count,
                            "grade_b": grade_b_count if (grade_a_count > 0 or grade_b_count > 0) else class2_count,
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
                    "execution_status": execution_status,
                    "status_details": status_details,
                    "is_simulated": is_simulated,
                    "commodity": commodity,
                    "ai_supported": True,
                    "actual_weight_kg": weight_kg,
                    "image_quality": quality_info,
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


@router.post("/scan-multi")
async def scan_multi_angle_harvest_batch(
    image_front: UploadFile = File(..., description="Foto panen Sisi Depan / Atas (JPG, PNG, WebP)"),
    image_back: UploadFile = File(..., description="Foto panen Sisi Belakang / Balik (JPG, PNG, WebP)"),
    commodity: str = Form("Terung", description="Jenis komoditas hortikultura"),
    weight_kg: Optional[float] = Form(None, description="Estimasi berat fisik total dari timbangan (kg)"),
    confidence_threshold: float = Form(0.35, description="Batas ambang confidence deteksi (0.05 - 0.95)"),
    weight_front: float = Form(0.50, description="Bobot sudut pandang depan (0.01 - 1.0)"),
    weight_back: float = Form(0.50, description="Bobot sudut pandang belakang (0.01 - 1.0)"),
    mode: str = Form("production", description="Mode eksekusi: 'production' atau 'mock'"),
    enable_slicing: bool = Form(True, description="Aktifkan Tiled Inference (SAHI) untuk objek bertumpuk"),
    disambiguate_grades: bool = Form(True, description="Aktifkan kalibrasi diskriminasi mutu Class II vs Reject"),
    auto_clahe: bool = Form(True, description="Aktifkan adaptif CLAHE otomatis jika citra remang-remang"),
):
    """
    Endpoint pemindaian kualitas panen Multi-Angle / Multi-Shot (POST /api/v1/qc/scan-multi).
    Mengatasi kelemahan Single-View Occlusion Bias dengan mengagregasi 2 berkas foto
    (Sisi Depan & Sisi Belakang) dan menghitung rata-rata tertimbang (weighted defect ratio).
    """
    try:
        front_bytes = await image_front.read()
        back_bytes = await image_back.read()

        # 1. Validasi Keamanan Citra untuk kedua foto
        file_info_front = validate_upload_image(
            image_bytes=front_bytes,
            claimed_filename=image_front.filename or "front.jpg",
            claimed_content_type=image_front.content_type,
        )
        file_info_back = validate_upload_image(
            image_bytes=back_bytes,
            claimed_filename=image_back.filename or "back.jpg",
            claimed_content_type=image_back.content_type,
        )

        # 1b. Validasi Anti-Kecurangan Berkas Kembar (Duplicate Image Prevention)
        import hashlib
        if hashlib.sha256(front_bytes).hexdigest() == hashlib.sha256(back_bytes).hexdigest():
            raise ImageValidationError(
                "Berkas foto Sisi 1 dan Sisi 2 identik (file kembar terdeteksi). "
                "Untuk verifikasi multi-sudut yang sah, goyang nampan secara merata dan unggah foto sisi yang berbeda.",
                code="DUPLICATE_MULTI_ANGLE_IMAGES",
            )

        # 2. Validasi Parameter Bobot & Penimbang
        if weight_kg is not None and weight_kg <= 0:
            raise ImageValidationError(
                "Berat total harus bernilai lebih dari 0 kg.",
                code="INVALID_WEIGHT_VALUE",
                details={"weight_kg": weight_kg},
            )

        if not (0.05 <= confidence_threshold <= 0.95):
            raise ImageValidationError(
                "Batas confidence threshold harus berada pada rentang 0.05 hingga 0.95.",
                code="INVALID_CONFIDENCE_THRESHOLD",
                details={"confidence_threshold": confidence_threshold},
            )

        if weight_front <= 0 or weight_back <= 0:
            raise ImageValidationError(
                "Bobot sudut pandang depan dan belakang harus bernilai lebih besar dari 0.",
                code="INVALID_VIEW_WEIGHTS",
                details={"weight_front": weight_front, "weight_back": weight_back},
            )

        # 3. Analisis Kualitas Optik (Laplacian Blur & Mean Luminance)
        front_quality = analyze_image_quality(front_bytes)
        back_quality = analyze_image_quality(back_bytes)

        # 4. Pra-pemrosesan CLAHE Adaptif jika citra terdeteksi remang-remang (Pasar Subuh)
        proc_front_bytes = front_bytes
        proc_back_bytes = back_bytes

        if auto_clahe:
            if front_quality.get("clahe_recommended"):
                proc_front_bytes = apply_clahe_enhancement(front_bytes)
                front_quality["clahe_applied"] = True
            else:
                front_quality["clahe_applied"] = False

            if back_quality.get("clahe_recommended"):
                proc_back_bytes = apply_clahe_enhancement(back_bytes)
                back_quality["clahe_applied"] = True
            else:
                back_quality["clahe_applied"] = False

        comm_key = commodity.strip().lower()
        is_tomato = "tomat" in comm_key
        is_eggplant = "terung" in comm_key or "terong" in comm_key or "eggplant" in comm_key

        scan_id = f"scan_multi_{datetime.now(timezone.utc).strftime('%Y%m%d')}_{uuid.uuid4().hex[:6]}"
        timestamp = datetime.now(timezone.utc).isoformat()

        # 5. Validasi Komoditas untuk Multi-Angle
        if not (is_tomato or is_eggplant):
            execution_status = "unsupported"
            status_details = {
                "code": "COMMODITY_UNSUPPORTED",
                "message": f"Komoditas '{commodity}' belum didukung model Computer Vision resmi. Menggunakan estimasi acuan pasar & pencatatan manual.",
                "is_ai_generated": False,
                "requires_human_confirmation": True,
            }
            pricing_info = calculate_economic_projection(
                commodity_name=commodity,
                weight_kg=weight_kg,
                fresh_ratio_percent=100.0,
                rotten_count=0,
                fresh_count=0,
            )
            pricing_info["recommendation_note"] = (
                f"Komoditas '{commodity}' belum didukung deteksi multi-sudut otomatis. "
                "Gunakan pencatatan mutu manual."
            )
            return {
                "status": "success",
                "data": {
                    "scan_id": scan_id,
                    "timestamp": timestamp,
                    "inspection_mode": "multi_angle_manual",
                    "execution_status": execution_status,
                    "status_details": status_details,
                    "is_simulated": False,
                    "commodity": commodity,
                    "ai_supported": False,
                    "actual_weight_kg": weight_kg,
                    "front_view": {
                        "image_dimensions": file_info_front["dimensions"],
                        "quality_metrics": front_quality,
                        "inference_time_ms": 0.0,
                        "detections": [],
                        "object_counts": {},
                        "total_objects": 0,
                    },
                    "back_view": {
                        "image_dimensions": file_info_back["dimensions"],
                        "quality_metrics": back_quality,
                        "inference_time_ms": 0.0,
                        "detections": [],
                        "object_counts": {},
                        "total_objects": 0,
                    },
                    "multi_angle_aggregation": None,
                    "business_grading": None,
                    "smart_pricing": pricing_info,
                },
            }

        # 6. Eksekusi Inferensi AI untuk Kedua Sudut (Anti-Silent Mock Fallback)
        raw_front = None
        raw_back = None
        execution_status = "ai_detected"
        status_details = {
            "code": "MULTI_ANGLE_OPTIMAL",
            "message": "Inspeksi multi-sudut AI berhasil dengan tingkat kepastian optimal.",
            "is_ai_generated": True,
            "requires_human_confirmation": False,
        }

        if mode == "mock":
            execution_status = "simulated"
            status_details = {
                "code": "EXPLICIT_SIMULATION",
                "message": "Mode simulasi multi-sudut diminta secara eksplisit. Hasil disintesis untuk keperluan demonstrasi non-AI.",
                "is_ai_generated": False,
                "requires_human_confirmation": True,
            }
            raw_front = await predict_harvest_image_mock(
                image_bytes=proc_front_bytes,
                width=file_info_front["dimensions"]["width"],
                height=file_info_front["dimensions"]["height"],
                confidence_threshold=confidence_threshold,
                simulate_delay=False,
                commodity=commodity,
            )
            raw_back = await predict_harvest_image_mock(
                image_bytes=proc_back_bytes,
                width=file_info_back["dimensions"]["width"],
                height=file_info_back["dimensions"]["height"],
                confidence_threshold=confidence_threshold,
                simulate_delay=False,
                commodity=commodity,
            )
        else:
            if not ai_engine.is_available():
                logger.warning("Runtime AI tidak tersedia untuk pemindaian multi-sudut %s", commodity)
                execution_status = "model_unavailable"
                status_details = {
                    "code": "RUNTIME_UNAVAILABLE",
                    "message": f"Runtime AI tidak tersedia di server untuk komoditas '{commodity}'.",
                    "is_ai_generated": False,
                    "requires_human_confirmation": True,
                }
            else:
                try:
                    raw_front = ai_engine.predict(
                        image_bytes=proc_front_bytes,
                        commodity=commodity,
                        confidence_threshold=confidence_threshold,
                        enable_slicing=enable_slicing,
                        disambiguate_grades=disambiguate_grades,
                    )
                except Exception as exc:
                    logger.exception("Inferensi sudut depan gagal untuk %s: %s", commodity, exc)
                    raw_front = None

                try:
                    raw_back = ai_engine.predict(
                        image_bytes=proc_back_bytes,
                        commodity=commodity,
                        confidence_threshold=confidence_threshold,
                        enable_slicing=enable_slicing,
                        disambiguate_grades=disambiguate_grades,
                    )
                except Exception as exc:
                    logger.exception("Inferensi sudut belakang gagal untuk %s: %s", commodity, exc)
                    raw_back = None

                if raw_front is None and raw_back is None:
                    execution_status = "model_unavailable"
                    status_details = {
                        "code": "INFERENCE_EXECUTION_FAILED",
                        "message": f"Gagal mengeksekusi inferensi AI multi-sudut untuk komoditas '{commodity}'.",
                        "is_ai_generated": False,
                        "requires_human_confirmation": True,
                    }
                elif raw_front is None or raw_back is None:
                    execution_status = "needs_review"
                    failed_side = "depan" if raw_front is None else "belakang"
                    valid_side = "belakang" if raw_front is None else "depan"
                    status_details = {
                        "code": "PARTIAL_ANGLE_INFERENCE",
                        "message": f"Inferensi sudut {failed_side} gagal; hasil didasarkan pada sudut {valid_side} dan memerlukan verifikasi manual.",
                        "is_ai_generated": True,
                        "requires_human_confirmation": True,
                    }
                    empty_side = {
                        "contract_version": "1.2.0",
                        "commodity": commodity,
                        "detections": [],
                        "detection_summary": {"total_objects": 0, "class_counts": {}},
                        "inference_time_ms": 0.0,
                        "image_dimensions": file_info_front["dimensions"] if raw_front is None else file_info_back["dimensions"],
                    }
                    if raw_front is None:
                        raw_front = empty_side
                    else:
                        raw_back = empty_side

        # 7. Tangani Kondisi Jika Model Tidak Tersedia / Kedua Sisi Gagal
        if raw_front is None and raw_back is None:
            pricing_info = calculate_economic_projection(
                commodity_name=commodity,
                weight_kg=weight_kg,
                fresh_ratio_percent=100.0,
                rotten_count=0,
                fresh_count=0,
            )
            pricing_info["recommendation_note"] = (
                f"Model AI multi-sudut untuk {commodity} tidak dapat memproses citra saat ini. "
                "Estimasi harga dihitung berdasarkan acuan standar pasar lokal."
            )
            result_data = {
                "status": "success",
                "data": {
                    "scan_id": scan_id,
                    "timestamp": timestamp,
                    "inspection_mode": "multi_angle_dual_shot",
                    "execution_status": execution_status,
                    "status_details": status_details,
                    "is_simulated": False,
                    "commodity": commodity,
                    "ai_supported": True,
                    "actual_weight_kg": weight_kg,
                    "front_view": {
                        "image_dimensions": file_info_front["dimensions"],
                        "quality_metrics": front_quality,
                        "inference_time_ms": 0.0,
                        "detections": [],
                        "object_counts": {},
                        "total_objects": 0,
                    },
                    "back_view": {
                        "image_dimensions": file_info_back["dimensions"],
                        "quality_metrics": back_quality,
                        "inference_time_ms": 0.0,
                        "detections": [],
                        "object_counts": {},
                        "total_objects": 0,
                    },
                    "multi_angle_aggregation": None,
                    "business_grading": None,
                    "smart_pricing": pricing_info,
                },
            }
            try:
                storage_service.save_scan(result_data["data"])
            except Exception:
                pass
            return result_data

        # 8. Agregasi Multi-Sudut (Weighted Defect Aggregation & Occlusion Bias Detection)
        aggregation = aggregate_multi_view_qc(
            front_raw=raw_front,
            back_raw=raw_back,
            commodity=commodity,
            weight_kg=weight_kg,
            weight_front=weight_front,
            weight_back=weight_back,
        )

        # 9. Evaluasi Mutu Multi-Sudut (ai_detected vs needs_review)
        if execution_status != "simulated" and status_details.get("code") != "PARTIAL_ANGLE_INFERENCE":
            f_objs = raw_front.get("detection_summary", {}).get("total_objects", 0)
            b_objs = raw_back.get("detection_summary", {}).get("total_objects", 0)
            f_blurry = front_quality.get("is_blurry", False)
            b_blurry = back_quality.get("is_blurry", False)
            occlusion_warn = aggregation.get("occlusion_analysis", {}).get("occlusion_bias_detected", False)

            if f_objs == 0 or b_objs == 0:
                execution_status = "needs_review"
                status_details = {
                    "code": "ZERO_OBJECTS_DETECTED",
                    "message": "Salah satu sudut pandang tidak mendeteksi objek panen. Disarankan memverifikasi posisi wadah panen.",
                    "is_ai_generated": True,
                    "requires_human_confirmation": True,
                }
            elif f_blurry or b_blurry:
                execution_status = "needs_review"
                status_details = {
                    "code": "IMAGE_BLURRY",
                    "message": "Salah satu foto sudut pandang terdeteksi buram. Verifikasi manual disarankan.",
                    "is_ai_generated": True,
                    "requires_human_confirmation": True,
                }
            elif occlusion_warn:
                execution_status = "needs_review"
                status_details = {
                    "code": "OCCLUSION_DISPARITY_DETECTED",
                    "message": aggregation["occlusion_analysis"].get("warning_message") or "Terdeteksi disparitas mutu signifikan antara sisi depan dan belakang.",
                    "is_ai_generated": True,
                    "requires_human_confirmation": True,
                }

        is_simulated = (execution_status == "simulated")

        result_data = {
            "status": "success",
            "data": {
                "scan_id": scan_id,
                "timestamp": timestamp,
                "inspection_mode": "multi_angle_dual_shot",
                "execution_status": execution_status,
                "status_details": status_details,
                "is_simulated": is_simulated,
                "commodity": commodity,
                "ai_supported": True,
                "actual_weight_kg": weight_kg,
                "front_view": {
                    "image_dimensions": file_info_front["dimensions"],
                    "quality_metrics": front_quality,
                    "inference_time_ms": raw_front.get("inference_time_ms", 0.0),
                    "detections": raw_front.get("detections", []),
                    "object_counts": raw_front.get("detection_summary", {}).get("class_counts", {}),
                    "total_objects": raw_front.get("detection_summary", {}).get("total_objects", 0),
                },
                "back_view": {
                    "image_dimensions": file_info_back["dimensions"],
                    "quality_metrics": back_quality,
                    "inference_time_ms": raw_back.get("inference_time_ms", 0.0),
                    "detections": raw_back.get("detections", []),
                    "object_counts": raw_back.get("detection_summary", {}).get("class_counts", {}),
                    "total_objects": raw_back.get("detection_summary", {}).get("total_objects", 0),
                },
                "multi_angle_aggregation": aggregation,
                "business_grading": aggregation["business_grading"],
                "smart_pricing": aggregation["smart_pricing"],
            },
        }

        # Simpan otomatis ke persistensi scans.json
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
                    "code": "MULTI_SCAN_PROCESSING_ERROR",
                    "message": f"Terjadi kesalahan saat memproses pemindaian multi-sudut: {str(exc)}",
                    "details": {},
                },
            },
        )
