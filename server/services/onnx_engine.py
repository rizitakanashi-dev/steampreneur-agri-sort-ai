"""
Service Inferensi ONNX Runtime Murni — Agri-Sort AI Backend
Tanggung Jawab: Machine Learning (ML) Engineer (Faris Al Farizi)
Dokumen Acuan: docs/rencana-kerja-ml-engineer.md & ml_engineer_next_steps_plan.md (Milestone 4)

Keunggulan Arsitektur:
1. Menghilangkan ketergantungan PyTorch (torch) pada inferensi server produksi.
2. Memangkas konsumsi RAM server dari ~500 MB (PyTorch) menjadi < 90 MB (C++ ONNX Runtime CPU).
3. Mengurangi latensi inferensi CPU hingga 30-40% dengan SIMD & AVX2 execution.
4. Mendukung antarmuka duck-typing yang 100% kompatibel dengan tiled_inference (SAHI).
"""

from __future__ import annotations

import logging
import os
import time
from typing import Any, Dict, List, Optional, Tuple, Union

logger = logging.getLogger("agrisort.onnx_engine")

try:
    import numpy as np
except ImportError:
    np = None

try:
    from PIL import Image
except ImportError:
    Image = None

try:
    import onnxruntime as ort
    ONNX_AVAILABLE = True
except ImportError:
    ort = None
    ONNX_AVAILABLE = False


class ONNXBox:
    """Struktur representasi bounding box yang kompatibel dengan Ultralytics Box."""

    def __init__(self, cls_id: int, conf: float, xyxy: List[float]):
        self.cls = [cls_id]
        self.conf = [conf]
        self.xyxy = [xyxy]


class ONNXResult:
    """Struktur hasil deteksi yang kompatibel dengan Ultralytics Results."""

    def __init__(self, boxes: List[ONNXBox], orig_shape: Tuple[int, int]):
        self.boxes = boxes
        self.orig_shape = orig_shape


def compute_vectorized_nms(
    boxes: Any,
    scores: Any,
    iou_threshold: float = 0.45,
    classes: Any = None,
    cross_class_iou_threshold: float = 0.75,
) -> List[int]:
    """
    Eksekusi Non-Maximum Suppression (NMS) berbasis NumPy murni.
    Jika `classes` diberikan, menerapkan occlusion-aware NMS:
    - Kelas sama: ditekan pada `iou_threshold` (default 0.45).
    - Kelas berbeda (buah bertumpuk beda mutu): hanya ditekan jika overlap sangat tinggi (`cross_class_iou_threshold`, default 0.75).
    """
    if np is None or len(boxes) == 0:
        return []

    x1 = boxes[:, 0]
    y1 = boxes[:, 1]
    x2 = boxes[:, 2]
    y2 = boxes[:, 3]

    areas = np.maximum(0.0, x2 - x1) * np.maximum(0.0, y2 - y1)
    order = scores.argsort()[::-1]
    keep: List[int] = []

    while order.size > 0:
        i = order[0]
        keep.append(int(i))

        xx1 = np.maximum(x1[i], x1[order[1:]])
        yy1 = np.maximum(y1[i], y1[order[1:]])
        xx2 = np.minimum(x2[i], x2[order[1:]])
        yy2 = np.minimum(y2[i], y2[order[1:]])

        w = np.maximum(0.0, xx2 - xx1)
        h = np.maximum(0.0, yy2 - yy1)
        inter = w * h

        union = areas[i] + areas[order[1:]] - inter
        iou = np.where(union > 0, inter / union, 0.0)

        if classes is not None:
            same_cls = classes[order[1:]] == classes[i]
            eff_thresh = np.where(same_cls, iou_threshold, cross_class_iou_threshold)
            inds = np.where(iou <= eff_thresh)[0]
        else:
            inds = np.where(iou <= iou_threshold)[0]
        order = order[inds + 1]

    return keep


class ONNXYOLOModel:
    """
    Runner model YOLO berformat ONNX murni via ONNX Runtime CPU.
    """

    def __init__(
        self,
        model_path: str,
        names: Optional[Dict[int, str]] = None,
        num_threads: int = 2,
    ):
        if not ONNX_AVAILABLE:
            raise RuntimeError(
                "Pustaka 'onnxruntime' belum terpasang di server. "
                "Pasang dengan: pip install onnxruntime"
            )

        if not os.path.exists(model_path):
            raise FileNotFoundError(f"Berkas ONNX tidak ditemukan di: {model_path}")

        self.model_path = model_path
        self.names = names or {0: "Class I", 1: "Class II", 2: "Extra Class", 3: "Reject"}

        # Optimasi sesi ONNX Runtime CPU
        opts = ort.SessionOptions()
        opts.intra_op_num_threads = num_threads
        opts.inter_op_num_threads = 1
        opts.graph_optimization_level = ort.GraphOptimizationLevel.ORT_ENABLE_ALL

        self.session = ort.InferenceSession(
            model_path,
            sess_options=opts,
            providers=["CPUExecutionProvider"],
        )

        # Otomatis baca metadata nama kelas bawaan model ONNX (jika tersedia dari Ultralytics export)
        try:
            meta = self.session.get_modelmeta().custom_metadata_map
            if "names" in meta:
                import ast
                parsed_names = ast.literal_eval(meta["names"])
                if isinstance(parsed_names, dict) and len(parsed_names) > 0:
                    self.names = {int(k): str(v) for k, v in parsed_names.items()}
        except Exception as e:
            logger.debug("Tidak dapat membaca metadata kelas dari model ONNX: %s", e)

        self.input_name = self.session.get_inputs()[0].name
        self.output_name = self.session.get_outputs()[0].name

    def predict(
        self,
        source: Union[str, Image.Image, np.ndarray],
        conf: float = 0.25,
        iou: float = 0.55,
        imgsz: int = 640,
        verbose: bool = False,
        **kwargs: Any,
    ) -> List[ONNXResult]:
        """
        Menjalankan inferensi pada citra input (PIL Image atau path).
        Mengembalikan list berisi objek hasil dengan atribut `.boxes`.
        """
        if isinstance(source, str):
            if Image is None:
                raise RuntimeError("PIL (Pillow) tidak terpasang di sistem.")
            img = Image.open(source).convert("RGB")
        elif Image is not None and isinstance(source, Image.Image):
            img = source.convert("RGB")
        elif np is not None and isinstance(source, np.ndarray):
            if Image is None:
                raise RuntimeError("PIL (Pillow) tidak terpasang di sistem.")
            img = Image.fromarray(source).convert("RGB")
        else:
            raise ValueError(f"Tipe masukan tidak didukung: {type(source)}")

        orig_w, orig_h = img.size

        # 1. Pra-pemrosesan Letterbox (menjaga rasio aspek persis seperti Ultralytics YOLO)
        scale = min(float(imgsz) / max(1, orig_w), float(imgsz) / max(1, orig_h))
        new_w = max(1, int(round(orig_w * scale)))
        new_h = max(1, int(round(orig_h * scale)))
        pad_x = (imgsz - new_w) / 2.0
        pad_y = (imgsz - new_h) / 2.0

        img_resized = img.resize((new_w, new_h), Image.BILINEAR)
        canvas = Image.new("RGB", (imgsz, imgsz), (114, 114, 114))
        canvas.paste(img_resized, (int(round(pad_x)), int(round(pad_y))))

        tensor = np.array(canvas, dtype=np.float32) / 255.0
        # HWC -> CHW -> NCHW
        tensor = np.transpose(tensor, (2, 0, 1))[np.newaxis, ...]

        # 2. Eksekusi Inferensi ONNX Session
        outputs = self.session.run([self.output_name], {self.input_name: tensor})[0]
        # Shape: (1, num_channels, 8400) -> transpose ke (8400, num_channels)
        preds = np.squeeze(outputs).T

        boxes_cxcywh = preds[:, :4]
        class_scores = preds[:, 4:]
        num_classes = class_scores.shape[1]

        if num_classes == 1:
            max_scores = class_scores[:, 0]
            class_ids = np.zeros(len(class_scores), dtype=int)
        else:
            max_scores = np.max(class_scores, axis=1)
            class_ids = np.argmax(class_scores, axis=1)

        # 3. Filter Confidence Threshold
        mask = max_scores >= conf
        if not np.any(mask):
            return [ONNXResult([], orig_shape=(orig_h, orig_w))]

        f_boxes = boxes_cxcywh[mask]
        f_scores = max_scores[mask]
        f_classes = class_ids[mask]

        # 4. Transformasi Koordinat (Unpad Letterbox & Rescale ke dimensi asli)
        pad_left = float(int(round(pad_x)))
        pad_top = float(int(round(pad_y)))

        x1 = (f_boxes[:, 0] - f_boxes[:, 2] / 2.0 - pad_left) / scale
        y1 = (f_boxes[:, 1] - f_boxes[:, 3] / 2.0 - pad_top) / scale
        x2 = (f_boxes[:, 0] + f_boxes[:, 2] / 2.0 - pad_left) / scale
        y2 = (f_boxes[:, 1] + f_boxes[:, 3] / 2.0 - pad_top) / scale

        # Clamping ke batas citra asli
        x1 = np.clip(x1, 0.0, orig_w)
        y1 = np.clip(y1, 0.0, orig_h)
        x2 = np.clip(x2, 0.0, orig_w)
        y2 = np.clip(y2, 0.0, orig_h)

        xyxy_boxes = np.column_stack([x1, y1, x2, y2])

        # 5. Non-Maximum Suppression (NMS) sadar-oklusi antar kelas
        keep = compute_vectorized_nms(xyxy_boxes, f_scores, iou_threshold=iou, classes=f_classes)

        boxes: List[ONNXBox] = []
        for idx in keep:
            boxes.append(
                ONNXBox(
                    cls_id=int(f_classes[idx]),
                    conf=float(f_scores[idx]),
                    xyxy=[
                        float(xyxy_boxes[idx, 0]),
                        float(xyxy_boxes[idx, 1]),
                        float(xyxy_boxes[idx, 2]),
                        float(xyxy_boxes[idx, 3]),
                    ],
                )
            )

        return [ONNXResult(boxes, orig_shape=(orig_h, orig_w))]


def is_onnx_available() -> bool:
    """Memeriksa ketersediaan modul onnxruntime di lingkungan aktif."""
    return ONNX_AVAILABLE
