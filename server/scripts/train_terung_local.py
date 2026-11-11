import os
import shutil
import sys
import torch
import yaml
from roboflow import Roboflow
from ultralytics import YOLO

# ==============================================================================
# KONFIGURASI API KEY ROBOFLOW
# ==============================================================================
ROBOFLOW_API_KEY = os.environ.get("ROBOFLOW_API_KEY", "AgwKkIfXgpwXhgLOP8p6")

# Verifikasi GPU NVIDIA
if not torch.cuda.is_available():
    print("❌ ERROR: CUDA tidak terdeteksi! Pastikan driver NVIDIA dan PyTorch CUDA terpasang.")
    sys.exit(1)

gpu_name = torch.cuda.get_device_name(0)
total_vram_gb = torch.cuda.get_device_properties(0).total_memory / (1024**3)

print("=" * 65)
print(f"🚀 HARDWARE AKSELERATOR: {gpu_name}")
print(f"📦 TOTAL VRAM           : {total_vram_gb:.2f} GB")
print("=" * 65)

# 1. Periksa Ketersediaan Dataset v2
yaml_path = os.path.join(os.path.abspath(os.path.dirname(__file__)), "Eggplant-Quality-Grades-2", "data.yaml")

if os.path.exists(yaml_path):
    print(f"\n[1/4] ✅ Dataset v2 sudah terunduh dan siap di: {yaml_path}")
else:
    print("\n[1/4] Mengunduh dataset v2 dari Roboflow...")
    rf = Roboflow(api_key=ROBOFLOW_API_KEY)
    project = rf.workspace("rizi-takanashi").project("eggplant-quality-grades-hgdr1-oooww")
    dataset = project.version(2).download("yolov11", overwrite=True)
    yaml_path = os.path.join(dataset.location, "data.yaml")

    if not os.path.exists(yaml_path):
        print(f"❌ ERROR: Berkas data.yaml tidak ditemukan di {yaml_path}")
        sys.exit(1)
    print(f"✅ Dataset berhasil disiapkan di: {yaml_path}")

# Baca informasi kelas dari data.yaml
with open(yaml_path, "r") as f:
    yaml_data = yaml.safe_load(f)

classes = yaml_data.get("names", [])
num_classes = yaml_data.get("nc", len(classes))
print(f"📋 Konfigurasi Kelas ({num_classes} kelas): {classes}")

# 2. Mulai Training YOLO11n di GPU RTX 3050
print("\n[2/4] Memulai pelatihan YOLO11n dengan Tensor Core Ampere (FP16)...")
model = YOLO("yolo11n.pt")

results = model.train(
    data=yaml_path,
    epochs=50,             # 50 epoch optimal
    imgsz=640,             # Resolusi standar 640x640
    batch=16,              # Pas untuk 6GB VRAM
    device=0,              # Gunakan RTX 3050 GPU
    amp=True,              # Automatic Mixed Precision FP16 (lebih cepat & hemat VRAM)
    workers=4,             # Multi-thread data loading
    patience=15,           # Early stopping jika akurasi sudah jenuh
    save=True,
    plots=True,
    name="terung_v2_rtx3050",
    exist_ok=True
)

# 3. Ekspor Bobot Terbaik ke Format ONNX (Untuk Server Backend CPU)
print("\n[3/4] Mengekspor bobot terbaik ke ONNX...")
best_pt_path = "runs/detect/terung_v2_rtx3050/weights/best.pt"
best_model = YOLO(best_pt_path)
exported_onnx = best_model.export(
    format="onnx",
    imgsz=640,
    simplify=True,
    dynamic=False
)
print(f"✅ Model ONNX berhasil diekspor ke: {exported_onnx}")

# 4. Salin Otomatis ke Folder Model Server Agri-Sort AI
print("\n[4/4] Memperbarui model produksi di backend Agri-Sort AI...")
dest_onnx = "server/models/terung/best.onnx"
dest_pt = "server/models/terung/best.pt"
dest_yaml = "server/models/terung/data.yaml"

os.makedirs("server/models/terung", exist_ok=True)
shutil.copy("runs/detect/terung_v2_rtx3050/weights/best.onnx", dest_onnx)
shutil.copy(best_pt_path, dest_pt)
shutil.copy(yaml_path, dest_yaml)

print("\n" + "=" * 65)
print("🎉 TRAINING SELESAI DENGAN SUKSES!")
print(f"📁 Bobot ONNX : {dest_onnx}")
print(f"📁 Bobot PT   : {dest_pt}")
print(f"📁 data.yaml  : {dest_yaml}")
print(f"📋 Kelas Mutu : {classes}")
print("=" * 65)
