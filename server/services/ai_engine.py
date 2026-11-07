"""
Service Inferensi AI Ultralytics YOLO11 — Agri-Sort AI Backend
Tanggung Jawab: Machine Learning (ML) Engineer & Backend Integration
Dokumen Acuan: docs/rencana-kerja-ml-engineer.md & docs/workflow.md

Mengelola siklus hidup model YOLO11 (Terung 4-kelas dan Tomat 2-kelas):
- Pemuatan bobot secara singleton (warm start)
- Eksekusi inferensi Ultralytics native
- Normalisasi koordinat bounding box dan slug kelas untuk kanvas visual frontend
- Pengukuran latensi komputasi (ms)
"""

from io import BytesIO
import logging
import os
import time
from typing import Any, Dict, List, Optional
from PIL import Image

logger = logging.getLogger("agrisort.ai_engine")

try:
    from ultralytics import YOLO
    ULTRALYTICS_AVAILABLE = True
except ImportError:
    YOLO = None
    ULTRALYTICS_AVAILABLE = False


class YOLOInferenceEngine:
    """
    Singleton Inference Engine untuk mengelola model YOLO11 Terung dan Tomat.
    Memastikan bobot model PyTorch (.pt) hanya dimuat satu kali ke memori.
    """

    _instance = None
    _models: Dict[str, Any] = {}

    def __new__(cls):
        if cls._instance is None:
            cls._instance = super(YOLOInferenceEngine, cls).__new__(cls)
        return cls._instance

    def __init__(self):
        # Jalur absolut direktori dasar repositori
        self.base_dir = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

        self.model_configs = {
            "terung": {
                "name": "Agri-Sort Eggplant Quality Detection",
                "version": "1.0.0",
                "path": os.path.join(
                    self.base_dir,
                    "models-20261107T170211Z-1-001",
                    "models",
                    "terung",
                    "best.pt",
                ),
                "expected_classes": ["Class I", "Class II", "Extra Class", "Reject"],
            },
            "tomat": {
                "name": "Agri-Sort Tomato Freshness Detection",
                "version": "1.0.0",
                "path": os.path.join(self.base_dir, "model-export", "weights", "best.pt"),
                "expected_classes": ["fresh-tomato", "rotten-tomato"],
            },
        }

    def is_available(self) -> bool:
        """Memeriksa apakah runtime Ultralytics terpasang."""
        return ULTRALYTICS_AVAILABLE

    def get_model(self, commodity: str = "terung"):
        """
        Pemuatan model secara lazy-loading singleton.
        Mengembalikan instance YOLO dan canonical commodity key.
        """
        comm_lower = commodity.strip().lower()
        if "terung" in comm_lower or "terong" in comm_lower or "eggplant" in comm_lower:
            comm_key = "terung"
        elif "tomat" in comm_lower or "tomato" in comm_lower:
            comm_key = "tomat"
        else:
            raise ValueError(f"Komoditas '{commodity}' tidak didukung oleh model AI saat ini.")

        if not ULTRALYTICS_AVAILABLE:
            raise RuntimeError(
                "Pustaka 'ultralytics' belum terpasang di lingkungan runtime server. "
                "Harap pasang dengan perintah: pip install ultralytics"
            )

        if comm_key not in self._models:
            cfg = self.model_configs.get(comm_key)
            if not cfg or not os.path.exists(cfg["path"]):
                raise FileNotFoundError(
                    f"Berkas model untuk komoditas '{comm_key}' tidak ditemukan di lokasi: {cfg['path'] if cfg else 'None'}"
                )
            logger.info("Memuat bobot model YOLO11 %s dari: %s", comm_key, cfg["path"])
            self._models[comm_key] = YOLO(cfg["path"])

        return self._models[comm_key], comm_key

    def predict(
        self,
        image_bytes: bytes,
        commodity: str = "Terung",
        confidence_threshold: float = 0.25,
        iou_threshold: float = 0.45,
    ) -> Dict[str, Any]:
        """
        Mengeksekusi inferensi pada citra panen.
        Parameter:
            image_bytes: Buffer byte gambar (JPEG/PNG/WebP)
            commodity: Jenis komoditas ("Terung" atau "Tomat")
            confidence_threshold: Batas ambang keyakinan minimum (default 0.25 untuk Terung)
            iou_threshold: Batas Non-Maximum Suppression (default 0.45)
        Mengembalikan:
            Dictionary terstruktur sesuai kontrak raw detection baku.
        """
        start_time = time.perf_counter()

        # 1. Decode bytes ke PIL Image RGB
        try:
            image = Image.open(BytesIO(image_bytes)).convert("RGB")
        except Exception as err:
            raise ValueError(f"Gagal memproses byte citra: {err}") from err

        width, height = image.size

        # 2. Ambil instance model singleton
        model, comm_key = self.get_model(commodity)
        cfg = self.model_configs[comm_key]

        # 3. Jalankan inferensi Ultralytics YOLO
        # imgsz=640 sesuai dengan parameter training di Google Colab
        results = model.predict(
            source=image,
            conf=confidence_threshold,
            iou=iou_threshold,
            imgsz=640,
            verbose=False,
        )

        res = results[0]
        boxes = res.boxes

        detections: List[Dict[str, Any]] = []
        class_counts: Dict[str, int] = {}

        # Inisialisasi hitungan kelas yang diharapkan dengan nilai nol
        for exp_cls in cfg["expected_classes"]:
            class_counts[exp_cls] = 0
            class_counts[self._normalize_class_slug(exp_cls)] = 0

        # 4. Ekstraksi koordinat bounding box dan skor keyakinan
        if boxes is not None and len(boxes) > 0:
            for idx, box in enumerate(boxes):
                cls_id = int(box.cls[0].item())
                raw_name = model.names.get(cls_id, f"class_{cls_id}")
                conf = round(float(box.conf[0].item()), 4)
                xyxy = box.xyxy[0].tolist()

                name_slug = self._normalize_class_slug(raw_name)

                # Clamping koordinat dalam batas lebar dan tinggi citra asli
                x1 = max(0.0, min(float(width), float(xyxy[0])))
                y1 = max(0.0, min(float(height), float(xyxy[1])))
                x2 = max(0.0, min(float(width), float(xyxy[2])))
                y2 = max(0.0, min(float(height), float(xyxy[3])))

                detections.append({
                    "id": idx + 1,
                    "class_id": cls_id,
                    "class_name": raw_name,
                    "class_slug": name_slug,
                    "confidence": conf,
                    "box": {
                        "x1": round(x1, 1),
                        "y1": round(y1, 1),
                        "x2": round(x2, 1),
                        "y2": round(y2, 1),
                    },
                })

                class_counts[raw_name] = class_counts.get(raw_name, 0) + 1
                if name_slug != raw_name:
                    class_counts[name_slug] = class_counts.get(name_slug, 0) + 1

        elapsed_ms = round((time.perf_counter() - start_time) * 1000, 2)

        return {
            "contract_version": "1.1.0",
            "model_name": cfg["name"],
            "model_version": cfg["version"],
            "commodity": cfg["expected_classes"],
            "inference_time_ms": elapsed_ms,
            "image_dimensions": {"width": width, "height": height},
            "detections": detections,
            "detection_summary": {
                "total_objects": len(detections),
                "class_counts": class_counts,
            },
        }

    @staticmethod
    def _normalize_class_slug(raw_name: str) -> str:
        """
        Menyelaraskan nama kelas asli ke slug ramah kanvas frontend.
        Contoh:
          - "Class I" -> "class-1"
          - "Class II" -> "class-2"
          - "Extra Class" -> "extra-class"
          - "Reject" -> "reject"
          - "fresh-tomato" -> "fresh-tomato"
          - "rotten-tomato" -> "rotten-tomato"
        """
        s = raw_name.strip().lower()
        if "extra" in s:
            return "extra-class"
        if "class ii" in s or "class 2" in s:
            return "class-2"
        if "class i" in s or "class 1" in s:
            return "class-1"
        if "reject" in s:
            return "reject"
        if "fresh" in s:
            return "fresh-tomato"
        if "rotten" in s:
            return "rotten-tomato"
        return s.replace(" ", "-")


# Instance singleton global yang siap diimpor oleh router backend
ai_engine = YOLOInferenceEngine()
