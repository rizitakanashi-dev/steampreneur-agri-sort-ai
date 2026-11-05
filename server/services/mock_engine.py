"""
Mock Inference Engine — Agri-Sort AI Backend
Tanggung Jawab: Fullstack Developer (Backend Services)
Dokumen Acuan: docs/rencana-kerja-fullstack.md (Task FS-BE-03)

Menyediakan simulasi inferensi Computer Vision deterministik agar frontend
dapat diuji secara mandiri sebelum ML Engine terhubung secara fisik.
"""

import asyncio
import time
from typing import Any, Dict, List


def generate_mock_detections(
    width: int,
    height: int,
    confidence_threshold: float = 0.35,
) -> List[Dict[str, Any]]:
    """
    Menghasilkan daftar deteksi tomat (segar & busuk) sintetis yang terdistribusi
    realistis di dalam area gambar (top-down view keranjang panen).
    Seluruh koordinat terukur dan dipastikan berada di dalam dimensi gambar.
    """
    if width <= 0 or height <= 0:
        raise ValueError(f"Dimensi citra harus berupa bilangan positif: {width}x{height}")

    if not (0.0 <= confidence_threshold <= 1.0):
        raise ValueError(f"Confidence threshold harus berada pada rentang 0.0 hingga 1.0: {confidence_threshold}")

    # Grid 4x3 buah tomat sintetis (relatif terhadap lebar & tinggi)
    # class_id: 0 = 'fresh-tomato', 1 = 'rotten-tomato'
    raw_candidates = [
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
) -> Dict[str, Any]:
    """
    Mensimulasikan eksekusi pipeline inferensi YOLO11 ONNX (Task FS-BE-03).
    Mengembalikan format kontrak raw detection yang persis sama dengan ML Engine aktual.
    """
    start_time = time.perf_counter()

    # Simulasi latensi terukur 250 - 320 ms (di bawah batas target 500 ms proposal)
    if simulate_delay:
        await asyncio.sleep(0.28)

    detections = generate_mock_detections(width, height, confidence_threshold)

    fresh_count = sum(1 for d in detections if d["class_name"] == "fresh-tomato")
    rotten_count = sum(1 for d in detections if d["class_name"] == "rotten-tomato")
    total_objects = len(detections)

    elapsed_ms = round((time.perf_counter() - start_time) * 1000, 1)

    return {
        "contract_version": "1.0.0",
        "model_name": "yolo11n-agrisort",
        "model_version": "2026.11.02-mock",
        "inference_time_ms": elapsed_ms,
        "image_dimensions": {"width": width, "height": height},
        "detections": detections,
        "detection_summary": {
            "total_objects": total_objects,
            "class_counts": {
                "fresh-tomato": fresh_count,
                "rotten-tomato": rotten_count,
            },
        },
    }
