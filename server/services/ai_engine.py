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

from server.services.tiled_inference import run_sliced_yolo_inference

logger = logging.getLogger("agrisort.ai_engine")

# Nonaktifkan autoinstall otomatis Ultralytics di lingkungan Linux terkelola
os.environ.setdefault("YOLO_AUTOINSTALL", "False")

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
            if not cfg:
                raise FileNotFoundError(f"Konfigurasi model untuk komoditas '{comm_key}' tidak ditemukan.")

            model_path = cfg["path"]
            if not os.path.exists(model_path) and comm_key == "terung":
                # Fallback ke server/models/terung/best.pt jika direktori terung lain tidak ditemukan
                alt_path = os.path.join(self.base_dir, "server", "models", "terung", "best.pt")
                if os.path.exists(alt_path):
                    model_path = alt_path

            if not os.path.exists(model_path):
                raise FileNotFoundError(
                    f"Berkas model untuk komoditas '{comm_key}' tidak ditemukan di lokasi: {model_path}"
                )
            logger.info("Memuat bobot model YOLO11 %s dari: %s", comm_key, model_path)
            self._models[comm_key] = YOLO(model_path)

        return self._models[comm_key], comm_key

    def predict(
        self,
        image_bytes: bytes,
        commodity: str = "Terung",
        confidence_threshold: float = 0.25,
        iou_threshold: float = 0.40,
        enable_slicing: bool = True,
        disambiguate_grades: bool = True,
    ) -> Dict[str, Any]:
        """
        Mengeksekusi inferensi pada citra panen menggunakan Sliced SAHI & Grade Disambiguation.
        Parameter:
            image_bytes: Buffer byte gambar (JPEG/PNG/WebP)
            commodity: Jenis komoditas ("Terung" atau "Tomat")
            confidence_threshold: Batas ambang keyakinan minimum (default 0.25 untuk Terung)
            iou_threshold: Batas Non-Maximum Suppression (default 0.40)
            enable_slicing: Mengaktifkan pemotongan grid dinamis (SAHI) untuk objek bertumpuk
            disambiguate_grades: Menjalankan kalibrasi diskriminasi mutu (Class II vs Reject)
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

        # 3. Jalankan inferensi Ultralytics YOLO dengan Tiled SAHI & Grade Disambiguation
        sliced_res = run_sliced_yolo_inference(
            image=image,
            model=model,
            commodity=comm_key,
            confidence_threshold=confidence_threshold,
            iou_threshold=iou_threshold,
            enable_slicing=enable_slicing,
            disambiguate_grades=disambiguate_grades,
        )

        detections: List[Dict[str, Any]] = []
        class_counts: Dict[str, int] = {}

        # Inisialisasi hitungan kelas yang diharapkan dengan nilai nol
        for exp_cls in cfg["expected_classes"]:
            class_counts[exp_cls] = 0
            class_counts[self._normalize_class_slug(exp_cls)] = 0

        # 4. Format hasil deteksi
        for idx, item in enumerate(sliced_res["detections"]):
            raw_name = item["class_name"]
            conf = item["confidence"]
            box = item["box"]
            name_slug = self._normalize_class_slug(raw_name)

            det_obj = {
                "id": idx + 1,
                "class_id": item["class_id"],
                "class_name": raw_name,
                "class_slug": name_slug,
                "confidence": conf,
                "box": box,
            }
            if item.get("disambiguated"):
                det_obj["disambiguated"] = True
                det_obj["disambiguation_reason"] = item.get("disambiguation_reason")

            detections.append(det_obj)
            class_counts[raw_name] = class_counts.get(raw_name, 0) + 1
            if name_slug != raw_name:
                class_counts[name_slug] = class_counts.get(name_slug, 0) + 1

        elapsed_ms = round((time.perf_counter() - start_time) * 1000, 2)

        return {
            "contract_version": "1.2.0",
            "model_name": cfg["name"],
            "model_version": cfg["version"],
            "commodity": cfg["expected_classes"],
            "inference_time_ms": elapsed_ms,
            "image_dimensions": {"width": width, "height": height},
            "detections": detections,
            "detection_summary": {
                "total_objects": len(detections),
                "class_counts": class_counts,
                "slicing_applied": sliced_res["is_sliced"],
                "dense_box_suppressed": sliced_res["dense_box_suppressed"],
                "tiles_processed": sliced_res["tiles_processed"],
                "disambiguated_count": sliced_res["disambiguated_count"],
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
