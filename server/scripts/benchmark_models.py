"""
Skrip Benchmark Otomatis Performa Model Komputer Visi — Agri-Sort AI
Tanggung Jawab: Machine Learning (ML) Engineer (Faris Al Farizi)
Dokumen Acuan: ml_engineer_next_steps_plan.md (Milestone 6 & Opsi 3)

Fungsi Utama:
1. Mengukur Latensi Inferensi (P50, P95, P99, Mean, Min, Max, Standar Deviasi).
2. Membandingkan Throughput & Efisiensi: ONNX Runtime CPU vs PyTorch Ultralytics CPU.
3. Mengukur Overhead Tiled Inference (SAHI) untuk foto keranjang padat.
4. Mengekspor Ringkasan Statistik Resmi ke 'server/data/benchmark_report.json'
   sebagai bukti empiris (Pilar Math & Engineering) untuk dewan juri STEAMPreneur.
"""

from datetime import datetime, timezone
import json
import os
import platform
import statistics
import sys
import time
from typing import Any, Dict, List
import numpy as np
from PIL import Image

# Setup path agar modul server dapat diimpor langsung saat skrip dijalankan
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))))

from server.services.ai_engine import ai_engine
from server.services.onnx_engine import is_onnx_available


def run_latency_trials(
    image_bytes: bytes,
    commodity: str = "Terung",
    runtime: str = "onnx",
    enable_slicing: bool = False,
    num_trials: int = 25,
    warmup_trials: int = 3,
) -> Dict[str, Any]:
    """
    Menjalankan serangkaian uji inferensi berulang untuk menghitung statistik latensi.
    """
    # 1. Warm-up passes (mengeliminasi overhead inisialisasi awal)
    for _ in range(warmup_trials):
        _ = ai_engine.predict(
            image_bytes=image_bytes,
            commodity=commodity,
            runtime=runtime,
            enable_slicing=enable_slicing,
        )

    # 2. Benchmark trials
    latencies: List[float] = []
    for _ in range(num_trials):
        start = time.perf_counter()
        _ = ai_engine.predict(
            image_bytes=image_bytes,
            commodity=commodity,
            runtime=runtime,
            enable_slicing=enable_slicing,
        )
        elapsed_ms = (time.perf_counter() - start) * 1000.0
        latencies.append(elapsed_ms)

    latencies.sort()
    mean_val = statistics.mean(latencies)
    median_val = statistics.median(latencies)
    p95_val = float(np.percentile(latencies, 95))
    p99_val = float(np.percentile(latencies, 99))
    std_val = statistics.stdev(latencies) if len(latencies) > 1 else 0.0
    fps_val = round(1000.0 / mean_val, 2) if mean_val > 0 else 0.0

    return {
        "trials_count": num_trials,
        "min_ms": round(latencies[0], 2),
        "max_ms": round(latencies[-1], 2),
        "mean_ms": round(mean_val, 2),
        "median_p50_ms": round(median_val, 2),
        "p95_ms": round(p95_val, 2),
        "p99_ms": round(p99_val, 2),
        "std_dev_ms": round(std_val, 2),
        "throughput_fps": fps_val,
    }


def main():
    print("=" * 72)
    print("   AGRI-SORT AI — AUTOMATED COMPUTER VISION BENCHMARK SUITE")
    print("   Role: ML Engineer (Faris Al Farizi) | STEAMPreneur 2026")
    print("=" * 72)

    base_dir = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
    data_dir = os.path.join(base_dir, "server", "data")
    os.makedirs(data_dir, exist_ok=True)

    # 1. Siapkan Citra Sampel Uji 640x480
    test_img = Image.new("RGB", (640, 480), color=(100, 35, 120))
    import io
    buf = io.BytesIO()
    test_img.save(buf, format="JPEG", quality=90)
    image_bytes = buf.getvalue()

    print(f"\n[1/4] Lingkungan Pengujian:")
    print(f"  • Sistem Operasi    : {platform.system()} {platform.release()} ({platform.machine()})")
    print(f"  • Python Runtime    : {sys.version.split()[0]}")
    print(f"  • ONNX Runtime Ready: {'YA (Tersedia)' if is_onnx_available() else 'TIDAK'}")
    print(f"  • Ultralytics Ready : {'YA (Tersedia)' if ai_engine.is_available() else 'TIDAK'}")

    results_report: Dict[str, Any] = {
        "benchmark_timestamp": datetime.now(timezone.utc).isoformat(),
        "system_info": {
            "os": platform.system(),
            "machine": platform.machine(),
            "python_version": sys.version.split()[0],
        },
        "runtimes": {},
    }

    # 2. Benchmark ONNX Runtime (Single-Shot)
    if is_onnx_available():
        print("\n[2/4] Menjalankan Benchmark ONNX Runtime CPU (25 iterasi)...")
        onnx_stats = run_latency_trials(
            image_bytes=image_bytes,
            commodity="Terung",
            runtime="onnx",
            enable_slicing=False,
            num_trials=25,
        )
        results_report["runtimes"]["onnx_runtime_cpu"] = onnx_stats
        print(f"  ✓ Mean Latency : {onnx_stats['mean_ms']} ms | P50: {onnx_stats['median_p50_ms']} ms | P95: {onnx_stats['p95_ms']} ms")
        print(f"  ✓ Throughput   : {onnx_stats['throughput_fps']} FPS")

    # 3. Benchmark Ultralytics PyTorch (Single-Shot)
    if ai_engine.is_available():
        print("\n[3/4] Menjalankan Benchmark PyTorch Ultralytics CPU (25 iterasi)...")
        pt_stats = run_latency_trials(
            image_bytes=image_bytes,
            commodity="Terung",
            runtime="ultralytics",
            enable_slicing=False,
            num_trials=25,
        )
        results_report["runtimes"]["ultralytics_pytorch_cpu"] = pt_stats
        print(f"  ✓ Mean Latency : {pt_stats['mean_ms']} ms | P50: {pt_stats['median_p50_ms']} ms | P95: {pt_stats['p95_ms']} ms")
        print(f"  ✓ Throughput   : {pt_stats['throughput_fps']} FPS")

        if is_onnx_available():
            speedup = round(pt_stats["mean_ms"] / max(0.1, onnx_stats["mean_ms"]), 2)
            results_report["onnx_speedup_factor"] = speedup
            print(f"  ⚡ Akselerasi ONNX vs PyTorch: {speedup}x LEBIH CEPAT!")

    # 4. Benchmark Tiled Inference (SAHI)
    print("\n[4/4] Menjalankan Benchmark Tiled SAHI Multi-Scale (10 iterasi)...")
    sahi_stats = run_latency_trials(
        image_bytes=image_bytes,
        commodity="Terung",
        runtime="onnx" if is_onnx_available() else "ultralytics",
        enable_slicing=True,
        num_trials=10,
    )
    results_report["runtimes"]["sahi_tiled_inference"] = sahi_stats
    print(f"  ✓ SAHI Mean Latency : {sahi_stats['mean_ms']} ms | P95: {sahi_stats['p95_ms']} ms")
    print(f"  ✓ SAHI Throughput   : {sahi_stats['throughput_fps']} FPS (Deteksi tumpukan padat)")

    # 5. Simpan Laporan
    report_file = os.path.join(data_dir, "benchmark_report.json")
    with open(report_file, "w", encoding="utf-8") as f:
        json.dump(results_report, f, indent=2)

    print("\n" + "=" * 72)
    print(f"   LAPORAN TERSIMPAN: {report_file}")
    print("=" * 72)

    # Cetak tabel perbandingan STEAM Math
    print("\nTABEL PERBANDINGAN PERFORMA INFERENSI (UNTUK SLIDE PRESENTASI):")
    print("-" * 65)
    print(f"{'Engine Runtime':<25} | {'Mean (ms)':<10} | {'P95 (ms)':<10} | {'Throughput':<12}")
    print("-" * 65)
    for k, v in results_report["runtimes"].items():
        print(f"{k:<25} | {v['mean_ms']:<10} | {v['p95_ms']:<10} | {v['throughput_fps']} FPS")
    print("-" * 65)


if __name__ == "__main__":
    main()
