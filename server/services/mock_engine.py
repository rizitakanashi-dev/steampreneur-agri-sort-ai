"""
Mock Inference Engine — Agri-Sort AI Backend
Tanggung Jawab: Fullstack Developer (Backend Services)
Dokumen Acuan: docs/rencana-kerja-fullstack.md (Task FS-BE-03 & Revisi Model Terung 4-Kelas 7 Nov 2026)

Menyediakan simulasi inferensi Computer Vision deterministik untuk:
1. Tomat: 2 kelas (fresh-tomato, rotten-tomato)
2. Terung: 4 kelas (extra-class, class-1, class-2, reject) — Standar Mutu Komersial FFV-05 / SNI
"""

import asyncio
import time
from typing import Any, Dict, List


# Kandidat deteksi sintetis untuk Tomat (2 kelas: fresh-tomato vs rotten-tomato)
TOMATO_CANDIDATES = [
    # Baris 1
    {"class_id": 0, "name": "fresh-tomato", "conf": 0.94, "rel_box": (0.12, 0.10, 0.28, 0.28)},
    {"class_id": 0, "name": "fresh-tomato", "conf": 0.91, "rel_box": (0.33, 0.08, 0.49, 0.27)},
    {"class_id": 0, "name": "fresh-tomato", "conf": 0.88, "rel_box": (0.54, 0.11, 0.70, 0.29)},
    {"class_id": 0, "name": "fresh-tomato", "conf": 0.86, "rel_box": (0.73, 0.14, 0.89, 0.31)},
    # Baris 2
    {"class_id": 0, "name": "fresh-tomato", "conf": 0.95, "rel_box": (0.10, 0.35, 0.27, 0.53)},
    {"class_id": 1, "name": "rotten-tomato", "conf": 0.89, "rel_box": (0.31, 0.34, 0.48, 0.52)},  # Cacat/busuk 1
    {"class_id": 0, "name": "fresh-tomato", "conf": 0.92, "rel_box": (0.52, 0.36, 0.69, 0.54)},
    {"class_id": 0, "name": "fresh-tomato", "conf": 0.84, "rel_box": (0.72, 0.38, 0.88, 0.56)},
    # Baris 3
    {"class_id": 0, "name": "fresh-tomato", "conf": 0.90, "rel_box": (0.15, 0.62, 0.31, 0.80)},
    {"class_id": 0, "name": "fresh-tomato", "conf": 0.93, "rel_box": (0.35, 0.60, 0.51, 0.79)},
    {"class_id": 1, "name": "rotten-tomato", "conf": 0.78, "rel_box": (0.55, 0.63, 0.71, 0.81)},  # Cacat/busuk 2
    {"class_id": 0, "name": "fresh-tomato", "conf": 0.87, "rel_box": (0.74, 0.65, 0.90, 0.83)},
]

# Kandidat deteksi sintetis untuk Terung (4 kelas: extra-class, class-1, class-2, reject)
# Proporsi representatif: 5 Extra Class, 4 Class 1, 2 Class 2, 1 Reject = 12 butir/buah
EGGPLANT_CANDIDATES = [
    # Baris 1: Buah lonjong memanjang
    {"class_id": 0, "name": "extra-class", "conf": 0.94, "rel_box": (0.08, 0.08, 0.26, 0.42)},
    {"class_id": 0, "name": "extra-class", "conf": 0.92, "rel_box": (0.30, 0.06, 0.48, 0.40)},
    {"class_id": 1, "name": "class-1", "conf": 0.88, "rel_box": (0.52, 0.09, 0.70, 0.43)},
    {"class_id": 0, "name": "extra-class", "conf": 0.95, "rel_box": (0.73, 0.07, 0.92, 0.41)},
    # Baris 2: Lapisan tengah
    {"class_id": 1, "name": "class-1", "conf": 0.87, "rel_box": (0.09, 0.44, 0.28, 0.78)},
    {"class_id": 2, "name": "class-2", "conf": 0.84, "rel_box": (0.31, 0.42, 0.49, 0.76)},
    {"class_id": 0, "name": "extra-class", "conf": 0.89, "rel_box": (0.53, 0.45, 0.71, 0.79)},
    {"class_id": 3, "name": "reject", "conf": 0.79, "rel_box": (0.74, 0.43, 0.93, 0.77)},  # Cacat/busuk 1
    # Baris 3: Lapisan bawah
    {"class_id": 0, "name": "extra-class", "conf": 0.91, "rel_box": (0.14, 0.65, 0.34, 0.94)},
    {"class_id": 1, "name": "class-1", "conf": 0.90, "rel_box": (0.36, 0.63, 0.55, 0.93)},
    {"class_id": 1, "name": "class-1", "conf": 0.86, "rel_box": (0.57, 0.66, 0.75, 0.95)},
    {"class_id": 2, "name": "class-2", "conf": 0.82, "rel_box": (0.76, 0.64, 0.94, 0.92)},
]


def generate_mock_detections(
    width: int,
    height: int,
    confidence_threshold: float = 0.35,
    commodity: str = "Tomat",
) -> List[Dict[str, Any]]:
    """
    Menghasilkan daftar deteksi objek sintetis yang terdistribusi realistis
    di dalam area citra keranjang panen berdasarkan komoditas yang diminta.
    """
    if width <= 0 or height <= 0:
        raise ValueError(f"Dimensi citra harus berupa bilangan positif: {width}x{height}")

    if not (0.0 <= confidence_threshold <= 1.0):
        raise ValueError(f"Confidence threshold harus berada pada rentang 0.0 hingga 1.0: {confidence_threshold}")

    comm_norm = commodity.strip().lower()
    if "terung" in comm_norm or "terong" in comm_norm or "eggplant" in comm_norm:
        raw_candidates = EGGPLANT_CANDIDATES
    else:
        # Default komoditas Tomat
        raw_candidates = TOMATO_CANDIDATES

    detections = []
    det_id = 1

    for cand in raw_candidates:
        conf = cand["conf"]
        if conf < confidence_threshold:
            continue

        rx1, ry1, rx2, ry2 = cand["rel_box"]
        # Konversi koordinat relatif ke piksel aktual gambar (dengan clamping batas gambar)
        x1 = round(max(0.0, min(float(width), rx1 * width)), 1)
        y1 = round(max(0.0, min(float(height), ry1 * height)), 1)
        x2 = round(max(0.0, min(float(width), rx2 * width)), 1)
        y2 = round(max(0.0, min(float(height), ry2 * height)), 1)

        detections.append(
            {
                "id": det_id,
                "class_id": cand["class_id"],
                "class_name": cand["name"],
                "confidence": conf,
                "box": {"x1": x1, "y1": y1, "x2": x2, "y2": y2},
            }
        )
        det_id += 1

    return detections


async def predict_harvest_image_mock(
    image_bytes: bytes,
    width: int,
    height: int,
    confidence_threshold: float = 0.35,
    simulate_delay: bool = True,
    commodity: str = "Tomat",
) -> Dict[str, Any]:
    """
    Mensimulasikan eksekusi pipeline inferensi YOLO11 ONNX (Task FS-BE-03).
    Mendukung deteksi 2 kelas (Tomat) dan 4 kelas (Terung).
    """
    start_time = time.perf_counter()

    # Simulasi latensi terukur 250 - 320 ms
    if simulate_delay:
        await asyncio.sleep(0.28)

    detections = generate_mock_detections(
        width=width,
        height=height,
        confidence_threshold=confidence_threshold,
        commodity=commodity,
    )

    comm_norm = commodity.strip().lower()
    is_eggplant = "terung" in comm_norm or "terong" in comm_norm or "eggplant" in comm_norm
    model_name = "yolo11n-terung" if is_eggplant else "yolo11n-agrisort"
    model_version = "2026.11.07-eggplant-mock" if is_eggplant else "2026.11.02-mock"

    # Inisialisasi default 0 untuk setiap kelas terdaftar agar aman dari KeyError saat 0 objek terdeteksi
    if is_eggplant:
        class_counts: Dict[str, int] = {
            "extra-class": 0,
            "class-1": 0,
            "class-2": 0,
            "reject": 0,
        }
    else:
        class_counts = {
            "fresh-tomato": 0,
            "rotten-tomato": 0,
        }

    for d in detections:
        cname = d["class_name"]
        class_counts[cname] = class_counts.get(cname, 0) + 1

    total_objects = len(detections)
    elapsed_ms = round((time.perf_counter() - start_time) * 1000, 1)

    return {
        "contract_version": "1.0.0",
        "model_name": model_name,
        "model_version": model_version,
        "inference_time_ms": elapsed_ms,
        "image_dimensions": {"width": width, "height": height},
        "detections": detections,
        "detection_summary": {
            "total_objects": total_objects,
            "class_counts": class_counts,
        },
    }
