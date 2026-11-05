"""
Modul Layanan Smart Pricing & Metadata Harga Acuan — Agri-Sort AI Backend
Tanggung Jawab: Fullstack Developer (Backend Services)
Dokumen Acuan: docs/rencana-kerja-fullstack.md (Task FS-BE-04)

Menyediakan data harga referensi hortikultura terstruktur dengan transparansi metadata
tanpa klaim palsu API BAPANAS, serta kalkulator estimasi nilai ekonomi panen (STEAM Math).
"""

from copy import deepcopy
import math
from typing import Any, Dict, List, Optional

# Basis data acuan harga lokal terstruktur dengan transparansi penuh (Ground-Truth Baseline)
COMMODITY_PRICING_TABLE: Dict[str, Dict[str, Any]] = {
    "tomat": {
        "canonical_name": "Tomat",
        "price_per_kg": 12000,
        "currency": "IDR",
        "price_unit": "kg",
        "region": "Sumatera Barat",
        "price_source": "Tabel Tetap Lokal (Simulasi)",
        "data_date": "2026-10-13",
        "data_status": "simulasi",
        "notes": "Acuan simulasi harga pasar lokal. Bukan data live API BAPANAS.",
        "price_history": [
            {"label": "22 Sep", "price_per_kg": 10800},
            {"label": "29 Sep", "price_per_kg": 11400},
            {"label": "06 Okt", "price_per_kg": 11700},
            {"label": "13 Okt", "price_per_kg": 12000},
        ],
    },
    "cabai rawit hijau": {
        "canonical_name": "Cabai Rawit Hijau",
        "price_per_kg": 30000,
        "currency": "IDR",
        "price_unit": "kg",
        "region": "Sumatera Barat",
        "price_source": "Tabel Tetap Lokal (Simulasi)",
        "data_date": "2026-10-13",
        "data_status": "simulasi",
        "notes": "Acuan simulasi harga pasar lokal. Bukan data live API BAPANAS.",
        "price_history": [
            {"label": "22 Sep", "price_per_kg": 27500},
            {"label": "29 Sep", "price_per_kg": 28200},
            {"label": "06 Okt", "price_per_kg": 29400},
            {"label": "13 Okt", "price_per_kg": 30000},
        ],
    },
    "cabai merah keriting": {
        "canonical_name": "Cabai Merah Keriting",
        "price_per_kg": 45000,
        "currency": "IDR",
        "price_unit": "kg",
        "region": "Sumatera Barat",
        "price_source": "Tabel Tetap Lokal (Simulasi)",
        "data_date": "2026-10-13",
        "data_status": "simulasi",
        "notes": "Acuan simulasi harga komoditas strategis nasional BPS. Bukan data live API BAPANAS.",
        "price_history": [
            {"label": "22 Sep", "price_per_kg": 41000},
            {"label": "29 Sep", "price_per_kg": 42500},
            {"label": "06 Okt", "price_per_kg": 43800},
            {"label": "13 Okt", "price_per_kg": 45000},
        ],
    },
    "cabai rawit merah": {
        "canonical_name": "Cabai Rawit Merah",
        "price_per_kg": 42000,
        "currency": "IDR",
        "price_unit": "kg",
        "region": "Sumatera Barat",
        "price_source": "Tabel Tetap Lokal (Simulasi)",
        "data_date": "2026-10-13",
        "data_status": "simulasi",
        "notes": "Acuan simulasi harga komoditas strategis nasional BPS. Bukan data live API BAPANAS.",
        "price_history": [
            {"label": "22 Sep", "price_per_kg": 38000},
            {"label": "29 Sep", "price_per_kg": 39500},
            {"label": "06 Okt", "price_per_kg": 40800},
            {"label": "13 Okt", "price_per_kg": 42000},
        ],
    },
    "terung": {
        "canonical_name": "Terung",
        "price_per_kg": 10000,
        "currency": "IDR",
        "price_unit": "kg",
        "region": "Sumatera Barat",
        "price_source": "Tabel Tetap Lokal (Simulasi)",
        "data_date": "2026-10-13",
        "data_status": "simulasi",
        "notes": "Acuan simulasi harga pasar lokal. Bukan data live API BAPANAS.",
        "price_history": [
            {"label": "22 Sep", "price_per_kg": 9200},
            {"label": "29 Sep", "price_per_kg": 9500},
            {"label": "06 Okt", "price_per_kg": 9800},
            {"label": "13 Okt", "price_per_kg": 10000},
        ],
    },
}


def normalize_commodity_key(name: str) -> str:
    """Normalisasi nama komoditas untuk pencarian toleran spasi dan huruf besar/kecil."""
    if not name:
        return ""
    # Menggabungkan spasi ganda menjadi spasi tunggal dan mengubah huruf kecil
    return " ".join(name.strip().lower().split())


def get_commodity_pricing(commodity_name: str, region: str = "Sumatera Barat") -> Dict[str, Any]:
    """
    Mengambil data harga referensi dan metadata komoditas.
    Jika komoditas tidak ditemukan, mengembalikan struktur fallback aman tanpa melempar crash.
    """
    key = normalize_commodity_key(commodity_name)
    if key in COMMODITY_PRICING_TABLE:
        data = deepcopy(COMMODITY_PRICING_TABLE[key])
        data["is_known"] = True
        return data

    # Fallback aman jika komoditas belum terdaftar
    return {
        "canonical_name": commodity_name.strip() if commodity_name else "Tidak Diketahui",
        "price_per_kg": 0,
        "currency": "IDR",
        "price_unit": "kg",
        "region": region,
        "price_source": "Tidak Ditemukan",
        "data_date": None,
        "data_status": "tidak_ditemukan",
        "notes": f"Komoditas '{commodity_name}' belum memiliki tabel harga acuan.",
        "price_history": [],
        "is_known": False,
    }


def list_supported_commodities() -> List[Dict[str, Any]]:
    """Mengembalikan daftar seluruh komoditas yang didukung beserta harga acuan dan metadatanya."""
    return [deepcopy(entry) for entry in COMMODITY_PRICING_TABLE.values()]


def calculate_economic_projection(
    commodity_name: str,
    weight_kg: Optional[float],
    fresh_ratio_percent: float,
    rotten_count: int = 0,
    fresh_count: int = 0,
    region: str = "Sumatera Barat",
) -> Dict[str, Any]:
    """
    Menghitung estimasi nilai ekonomi panen berdasarkan:
    1. Harga referensi komoditas
    2. Berat fisik aktual input pengguna (kg)
    3. Rasio kesegaran sampel dari Computer Vision (%)

    Menerapkan prinsip STEAM Math & transparansi metode perhitungan.
    """
    pricing = get_commodity_pricing(commodity_name, region)
    price_per_kg = pricing["price_per_kg"]

    # Penanganan aman untuk nilai NaN, Inf, atau tipe tidak valid (Anti-Crash Guard)
    try:
        val = float(fresh_ratio_percent)
        if math.isnan(val) or math.isinf(val):
            val = 0.0
    except (TypeError, ValueError):
        val = 0.0

    # Clamp rasio kesegaran antara 0.0 - 100.0%
    clamped_fresh = max(0.0, min(100.0, val))
    rotten_ratio = round(100.0 - clamped_fresh, 2)
    total_samples = fresh_count + rotten_count

    # Penanganan aman untuk input berat (kg)
    valid_weight: Optional[float] = None
    try:
        if weight_kg is not None:
            w = float(weight_kg)
            if not math.isnan(w) and not math.isinf(w) and w > 0:
                valid_weight = w
    except (TypeError, ValueError):
        valid_weight = None

    estimated_value: Optional[int] = None
    potential_loss: Optional[int] = None
    max_potential_value: Optional[int] = None

    if valid_weight is not None:
        # Nilai Ekonomi = Berat Aktual x Harga Acuan x (Rasio Segar / 100)
        estimated_value = round(valid_weight * price_per_kg * (clamped_fresh / 100.0))
        # Potensi kerugian dari buah rusak/busuk
        potential_loss = round(valid_weight * price_per_kg * (rotten_ratio / 100.0))
        # Nilai maksimal jika seluruh panen 100% segar
        max_potential_value = round(valid_weight * price_per_kg)

    # Susun catatan rekomendasi cerdas berbasis kondisi aktual
    if total_samples == 0:
        recommendation_note = (
            "Tidak ada objek sampel yang terdeteksi dengan ambang batas keyakinan saat ini. "
            "Pastikan foto keranjang cukup terang dan fokus, atau sesuaikan nilai ambang keyakinan."
        )
    elif fresh_count == 0:
        recommendation_note = (
            f"Peringatan Mutu Kritis: Seluruh sampel ({rotten_count} butir) terdeteksi rusak/busuk. "
            f"Seluruh keranjang ({weight_kg or 0} kg) berisiko kehilangan nilai ekonomi hingga Rp {potential_loss or 0:,}. "
            "Lakukan pemilahan total sebelum dipasarkan."
        )
    elif rotten_count > 0:
        recommendation_note = (
            f"Mutu Baik: {clamped_fresh}% sampel segar terdeteksi. "
            f"Segera pisahkan {rotten_count} butir tomat rusak untuk menyelamatkan potensi nilai Rp {estimated_value or 0:,} "
            f"dan mencegah pembusukan menular (potensi risiko susut: Rp {potential_loss or 0:,})."
        )
    else:
        recommendation_note = (
            f"Mutu Prima: Seluruh sampel ({fresh_count} butir) terdeteksi segar tanpa tanda cacat/busuk. "
            f"Potensi nilai jual optimal mencapai Rp {estimated_value or 0:,}."
        )

    return {
        "commodity": pricing["canonical_name"],
        "reference_price_per_kg": price_per_kg,
        "currency": pricing["currency"],
        "price_unit": pricing["price_unit"],
        "region": pricing["region"],
        "price_source": pricing["price_source"],
        "data_date": pricing["data_date"],
        "data_status": pricing["data_status"],
        "estimated_economic_value": estimated_value,
        "potential_loss_value": potential_loss,
        "max_potential_value": max_potential_value,
        "value_calculation_method": (
            "Berdasarkan berat aktual input pengguna dikalikan rasio sampel segar terdeteksi "
            "dan harga referensi pasar lokal (STEAM Math Model)"
        ),
        "recommendation_note": recommendation_note,
        "is_known_commodity": pricing["is_known"],
    }
