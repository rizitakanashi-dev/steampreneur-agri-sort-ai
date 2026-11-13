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
    """Normalisasi nama komoditas untuk pencarian toleran spasi, ejaan lokal, dan huruf besar/kecil."""
    if not name:
        return ""
    # Menggabungkan spasi ganda menjadi spasi tunggal dan mengubah huruf kecil
    key = " ".join(name.strip().lower().split())
    if key == "terong":
        return "terung"
    if "cabai rawit hijau" in key:
        return "cabai rawit hijau"
    if "cabai rawit merah" in key:
        return "cabai rawit merah"
    if "cabai merah keriting" in key or "cabai merah" in key:
        return "cabai merah keriting"
    if key in ["cabai", "cabe", "chili", "chilli"]:
        return "cabai merah keriting"
    return key


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


def calculate_eggplant_economic_projection(
    weight_kg: Optional[float],
    extra_count: int = 0,
    class1_count: int = 0,
    class2_count: int = 0,
    reject_count: int = 0,
    region: str = "Sumatera Barat",
    grade_a_count: int = 0,
    grade_b_count: int = 0,
) -> Dict[str, Any]:
    """
    Menghitung estimasi nilai ekonomi Terung (Mendukung 3-Grade v2 maupun 4-Kelas v1):
    - Grade A / Extra Class: Multiplier 1.15 (+15% premi kualitas)
    - Class 1: Multiplier 1.00
    - Grade B / Class 2: Multiplier 0.80 (-20% diskon toleransi)
    - Reject: Multiplier 0.00
    """
    # Harmonisasi input 3-Grade (Grade A, Grade B, Reject) dengan format 4-Kelas
    is_3grade_mode = (grade_a_count > 0 or grade_b_count > 0) and extra_count == 0 and class1_count == 0 and class2_count == 0
    if is_3grade_mode:
        extra_count = grade_a_count
        class1_count = 0
        class2_count = grade_b_count

    pricing = get_commodity_pricing("terung", region)
    base_price = pricing["price_per_kg"]

    total_samples = max(0, extra_count + class1_count + class2_count + reject_count)

    # Validasi dan sanitasi bobot fisik input
    valid_weight: Optional[float] = None
    try:
        if weight_kg is not None:
            w = float(weight_kg)
            if not math.isnan(w) and not math.isinf(w) and w > 0:
                valid_weight = w
    except (TypeError, ValueError):
        valid_weight = None

    if total_samples > 0:
        extra_ratio = round((extra_count / total_samples) * 100, 2)
        class1_ratio = round((class1_count / total_samples) * 100, 2)
        class2_ratio = round((class2_count / total_samples) * 100, 2)
        reject_ratio = round((reject_count / total_samples) * 100, 2)
    else:
        extra_ratio = class1_ratio = class2_ratio = reject_ratio = 0.0

    marketable_ratio = round(extra_ratio + class1_ratio + class2_ratio, 2)

    estimated_value: Optional[int] = None
    potential_loss: Optional[int] = None
    max_potential_value: Optional[int] = None

    if valid_weight is not None:
        if total_samples > 0:
            w_extra = valid_weight * (extra_count / total_samples)
            w_class1 = valid_weight * (class1_count / total_samples)
            w_class2 = valid_weight * (class2_count / total_samples)
            w_reject = valid_weight * (reject_count / total_samples)

            val_extra = w_extra * (base_price * 1.15)
            val_class1 = w_class1 * (base_price * 1.00)
            val_class2 = w_class2 * (base_price * 0.80)

            estimated_value = round(val_extra + val_class1 + val_class2)
            potential_loss = round(w_reject * base_price)
        else:
            estimated_value = 0
            potential_loss = 0

        max_potential_value = round(valid_weight * (base_price * 1.15))

    # Rekomendasi tindakan komersial
    if total_samples == 0:
        rec_note = (
            "Tidak ada objek terung yang terdeteksi dengan ambang batas keyakinan saat ini. "
            "Pastikan pencahayaan cukup dan foto keranjang fokus pada permukaan terung."
        )
    elif is_3grade_mode:
        if reject_count > 0:
            rec_note = (
                f"Mutu Terdistribusi 3-Kelas: {marketable_ratio}% terung layak jual "
                f"(Grade A: {extra_ratio}%, Grade B: {class2_ratio}%). "
                f"Segera pisahkan {reject_count} butir reject untuk menjaga standar mutu dan menyelamatkan potensi Rp {estimated_value or 0:,}."
            )
        else:
            rec_note = (
                f"Mutu Sangat Baik: 100% sampel terung tergolong mutu komersial tanpa reject "
                f"(Grade A: {extra_ratio}%, Grade B: {class2_ratio}%). "
                f"Potensi pendapatan mencapai Rp {estimated_value or 0:,}."
            )
    elif reject_count > 0:
        rec_note = (
            f"Mutu Terdistribusi 4-Kelas: {marketable_ratio}% terung layak jual "
            f"(Extra: {extra_ratio}%, Class 1: {class1_ratio}%, Class 2: {class2_ratio}%). "
            f"Segera pisahkan {reject_count} butir reject untuk menjaga standar mutu dan menyelamatkan potensi Rp {estimated_value or 0:,}."
        )
    else:
        rec_note = (
            f"Mutu Sangat Baik: 100% sampel terung tergolong mutu komersial tanpa reject "
            f"(Extra Class: {extra_ratio}%, Class 1: {class1_ratio}%, Class 2: {class2_ratio}%). "
            f"Potensi pendapatan mencapai Rp {estimated_value or 0:,}."
        )

    tier_breakdown = {
        "grade_a": {
            "ratio_percent": round(extra_ratio + class1_ratio, 2),
            "weight_kg": round((w_extra or 0) + (w_class1 or 0), 2) if (valid_weight is not None and total_samples > 0) else None,
            "price_per_kg": round(base_price * 1.15),
            "subtotal_value": round((val_extra or 0) + (val_class1 or 0)) if (valid_weight is not None and total_samples > 0) else None,
        },
        "grade_b": {
            "ratio_percent": class2_ratio,
            "weight_kg": round(w_class2, 2) if (valid_weight is not None and total_samples > 0) else None,
            "price_per_kg": round(base_price * 0.80),
            "subtotal_value": round(val_class2) if (valid_weight is not None and total_samples > 0) else None,
        },
        "extra_class": {
            "ratio_percent": extra_ratio,
            "weight_kg": round(w_extra, 2) if (valid_weight is not None and total_samples > 0) else None,
            "price_per_kg": round(base_price * 1.15),
            "subtotal_value": round(val_extra) if (valid_weight is not None and total_samples > 0) else None,
        },
        "class_1": {
            "ratio_percent": class1_ratio,
            "weight_kg": round(w_class1, 2) if (valid_weight is not None and total_samples > 0) else None,
            "price_per_kg": round(base_price * 1.00),
            "subtotal_value": round(val_class1) if (valid_weight is not None and total_samples > 0) else None,
        },
        "class_2": {
            "ratio_percent": class2_ratio,
            "weight_kg": round(w_class2, 2) if (valid_weight is not None and total_samples > 0) else None,
            "price_per_kg": round(base_price * 0.80),
            "subtotal_value": round(val_class2) if (valid_weight is not None and total_samples > 0) else None,
        },
        "reject": {
            "ratio_percent": reject_ratio,
            "weight_kg": round(w_reject, 2) if (valid_weight is not None and total_samples > 0) else None,
            "price_per_kg": 0,
            "subtotal_value": 0,
        },
    }

    return {
        "commodity": "Terung",
        "reference_price_per_kg": base_price,
        "currency": pricing["currency"],
        "price_unit": pricing["price_unit"],
        "region": pricing["region"],
        "price_source": pricing["price_source"],
        "data_date": pricing["data_date"],
        "data_status": pricing["data_status"],
        "estimated_economic_value": estimated_value,
        "potential_loss_value": potential_loss,
        "max_potential_value": max_potential_value,
        "tier_breakdown": tier_breakdown,
        "grade_multipliers": {
            "extra_class": 1.15,
            "class_1": 1.00,
            "class_2": 0.80,
            "reject": 0.00,
        },
        "condition_ratios": {
            "extra_class_percent": extra_ratio,
            "class_1_percent": class1_ratio,
            "class_2_percent": class2_ratio,
            "reject_percent": reject_ratio,
            "marketable_percent": marketable_ratio,
            "grade_a_percent": round(extra_ratio + class1_ratio, 2),
            "grade_b_percent": class2_ratio,
        },
        "value_calculation_method": (
            "Kalkulasi multi-grade Terung: Bobot x Rasio Kelas x Harga Acuan x Bobot Mutu (STEAM 4-Class Model)"
        ),
        "recommendation_note": rec_note,
        "is_known_commodity": True,
    }


def calculate_3grade_economic_projection(
    weight_kg: Optional[float],
    grade_a_count: int = 0,
    grade_b_count: int = 0,
    reject_count: int = 0,
    region: str = "Sumatera Barat",
    commodity_name: str = "cabai",
    default_base_price: int = 45000,
    item_label: str = "cabai",
) -> Dict[str, Any]:
    """
    Menghitung estimasi nilai ekonomi komoditas 3-Grade (Grade A, Grade B, Reject):
    - Grade A: Multiplier 1.15 (+15% premi kualitas)
    - Grade B: Multiplier 0.80 (-20% diskon toleransi fisik)
    - Reject: Multiplier 0.00
    """
    pricing = get_commodity_pricing(commodity_name, region)
    base_price = pricing["price_per_kg"] if pricing.get("price_per_kg", 0) > 0 else default_base_price

    total_samples = max(0, grade_a_count + grade_b_count + reject_count)

    valid_weight: Optional[float] = None
    try:
        if weight_kg is not None:
            w = float(weight_kg)
            if not math.isnan(w) and not math.isinf(w) and w > 0:
                valid_weight = w
    except (TypeError, ValueError):
        valid_weight = None

    if total_samples > 0:
        a_ratio = round((grade_a_count / total_samples) * 100, 2)
        b_ratio = round((grade_b_count / total_samples) * 100, 2)
        rej_ratio = round((reject_count / total_samples) * 100, 2)
    else:
        a_ratio = b_ratio = rej_ratio = 0.0

    marketable_ratio = round(a_ratio + b_ratio, 2)

    estimated_value: Optional[int] = None
    potential_loss: Optional[int] = None
    max_potential_value: Optional[int] = None

    w_a = w_b = w_rej = 0.0
    val_a = val_b = 0.0

    if valid_weight is not None:
        if total_samples > 0:
            w_a = valid_weight * (grade_a_count / total_samples)
            w_b = valid_weight * (grade_b_count / total_samples)
            w_rej = valid_weight * (reject_count / total_samples)

            val_a = w_a * (base_price * 1.15)
            val_b = w_b * (base_price * 0.80)

            estimated_value = round(val_a + val_b)
            potential_loss = round(w_rej * base_price)
        else:
            estimated_value = 0
            potential_loss = 0

        max_potential_value = round(valid_weight * (base_price * 1.15))

    if total_samples == 0:
        rec_note = (
            f"Tidak ada objek {pricing['canonical_name']} yang terdeteksi dengan ambang batas keyakinan saat ini. "
            f"Pastikan pencahayaan cukup dan foto nampan fokus pada permukaan {item_label}."
        )
    elif reject_count > 0:
        rec_note = (
            f"Mutu Terdistribusi 3-Kelas: {marketable_ratio}% {item_label} layak jual "
            f"(Grade A: {a_ratio}%, Grade B: {b_ratio}%). "
            f"Segera pisahkan {reject_count} butir reject untuk menjaga standar mutu dan menyelamatkan potensi Rp {estimated_value or 0:,}."
        )
    else:
        rec_note = (
            f"Mutu Sangat Baik: 100% sampel {item_label} tergolong mutu komersial tanpa reject "
            f"(Grade A: {a_ratio}%, Grade B: {b_ratio}%). "
            f"Potensi pendapatan mencapai Rp {estimated_value or 0:,}."
        )

    tier_breakdown = {
        "grade_a": {
            "ratio_percent": a_ratio,
            "weight_kg": round(w_a, 2) if (valid_weight is not None and total_samples > 0) else None,
            "price_per_kg": round(base_price * 1.15),
            "subtotal_value": round(val_a) if (valid_weight is not None and total_samples > 0) else None,
        },
        "grade_b": {
            "ratio_percent": b_ratio,
            "weight_kg": round(w_b, 2) if (valid_weight is not None and total_samples > 0) else None,
            "price_per_kg": round(base_price * 0.80),
            "subtotal_value": round(val_b) if (valid_weight is not None and total_samples > 0) else None,
        },
        "reject": {
            "ratio_percent": rej_ratio,
            "weight_kg": round(w_rej, 2) if (valid_weight is not None and total_samples > 0) else None,
            "price_per_kg": 0,
            "subtotal_value": 0,
        },
    }

    return {
        "commodity": pricing["canonical_name"],
        "reference_price_per_kg": base_price,
        "currency": pricing["currency"],
        "price_unit": pricing["price_unit"],
        "region": pricing["region"],
        "price_source": pricing["price_source"],
        "data_date": pricing["data_date"],
        "data_status": pricing["data_status"],
        "estimated_economic_value": estimated_value,
        "potential_loss_value": potential_loss,
        "max_potential_value": max_potential_value,
        "tier_breakdown": tier_breakdown,
        "grade_multipliers": {
            "grade_a": 1.15,
            "grade_b": 0.80,
            "reject": 0.00,
        },
        "condition_ratios": {
            "grade_a_percent": a_ratio,
            "grade_b_percent": b_ratio,
            "reject_percent": rej_ratio,
            "marketable_percent": marketable_ratio,
        },
        "value_calculation_method": (
            f"Kalkulasi 3-Grade {pricing['canonical_name']}: Bobot x Rasio Kelas x Harga Acuan x Bobot Mutu (STEAM 3-Class Model)"
        ),
        "recommendation_note": rec_note,
        "is_known_commodity": True,
    }


def calculate_chili_economic_projection(
    weight_kg: Optional[float],
    grade_a_count: int = 0,
    grade_b_count: int = 0,
    reject_count: int = 0,
    region: str = "Sumatera Barat",
    commodity_name: str = "cabai",
) -> Dict[str, Any]:
    """Menghitung estimasi nilai ekonomi Cabai 3-Grade (Grade A, Grade B, Reject)."""
    return calculate_3grade_economic_projection(
        weight_kg=weight_kg,
        grade_a_count=grade_a_count,
        grade_b_count=grade_b_count,
        reject_count=reject_count,
        region=region,
        commodity_name=commodity_name,
        default_base_price=45000,
        item_label="cabai",
    )


def calculate_tomato_economic_projection(
    weight_kg: Optional[float],
    grade_a_count: int = 0,
    grade_b_count: int = 0,
    reject_count: int = 0,
    region: str = "Sumatera Barat",
    commodity_name: str = "tomat",
) -> Dict[str, Any]:
    """Menghitung estimasi nilai ekonomi Tomat 3-Grade (Grade A, Grade B, Reject)."""
    return calculate_3grade_economic_projection(
        weight_kg=weight_kg,
        grade_a_count=grade_a_count,
        grade_b_count=grade_b_count,
        reject_count=reject_count,
        region=region,
        commodity_name=commodity_name,
        default_base_price=12000,
        item_label="tomat",
    )


def calculate_business_grading(
    commodity: str,
    weight_kg: Optional[float],
    ratios: Dict[str, float],
) -> Dict[str, Any]:
    """
    Menghitung pemetaan grade mutu komersial (Business Grading Rule Engine).
    Dokumen Acuan: docs/rencana-kerja-fullstack.md (Task FS-04 & Bab 3.2)

    Formula Terung:
      - Grade A = Extra Class % + Class I % (Mutu Super & Standar Ekspor / Pasar Modern)
      - Grade B = Class II % (Mutu Pasar Tradisional & Olahan)
      - Reject  = Reject % (Afkir / Kompos)

    Formula Tomat:
      - Grade A = Fresh %
      - Grade B = 0.0%
      - Reject  = Rotten %
    """
    comm = (commodity or "").strip().lower()
    is_eggplant = "terung" in comm or "terong" in comm or "eggplant" in comm

    valid_weight = None
    if weight_kg is not None:
        try:
            w = float(weight_kg)
            if not math.isnan(w) and not math.isinf(w) and w > 0:
                valid_weight = w
        except (TypeError, ValueError):
            valid_weight = None

    if is_eggplant:
        # Jika ratios memuat pembagian 3-Grade langsung (Grade A, Grade B, Reject)
        has_direct_grades = ("grade_a_percent" in ratios or "grade_a_ratio_percent" in ratios) and (
            ratios.get("class_1_percent") in (None, 0, 0.0)
        )
        if has_direct_grades:
            grade_a_pct = round(float(ratios.get("grade_a_percent", ratios.get("grade_a_ratio_percent", 0.0))), 2)
            grade_b_pct = round(float(ratios.get("grade_b_percent", ratios.get("grade_b_ratio_percent", 0.0))), 2)
            reject_pct = round(float(ratios.get("reject_percent", ratios.get("reject_ratio_percent", 0.0))), 2)
            rule_desc = "Grade A -> Grade A, Grade B -> Grade B, Reject -> Reject"
        else:
            extra_pct = float(ratios.get("extra_class_percent", ratios.get("extra_class_ratio_percent", 0.0)))
            c1_pct = float(ratios.get("class_1_percent", ratios.get("class_1_ratio_percent", 0.0)))
            c2_pct = float(ratios.get("class_2_percent", ratios.get("class_2_ratio_percent", 0.0)))
            rej_pct = float(ratios.get("reject_percent", ratios.get("reject_ratio_percent", 0.0)))

            grade_a_pct = round(extra_pct + c1_pct, 2)
            grade_b_pct = round(c2_pct, 2)
            reject_pct = round(rej_pct, 2)
            rule_desc = "Extra Class & Class I -> Grade A, Class II -> Grade B, Reject -> Reject"
    elif "cabai" in comm or "chili" in comm or "cabe" in comm or (
        "grade_a_percent" in ratios or "grade_b_percent" in ratios
    ):
        grade_a_pct = round(float(ratios.get("grade_a_percent", 0.0)), 2)
        grade_b_pct = round(float(ratios.get("grade_b_percent", 0.0)), 2)
        reject_pct = round(float(ratios.get("reject_percent", 0.0)), 2)
        rule_desc = "Grade A -> Grade A, Grade B -> Grade B, Reject -> Reject"
    else:
        fresh_pct = float(ratios.get("fresh_ratio_percent", ratios.get("fresh_ratio", 0.0)))
        rotten_pct = float(ratios.get("rotten_ratio_percent", ratios.get("rotten_ratio", 0.0)))

        grade_a_pct = round(fresh_pct, 2)
        grade_b_pct = 0.0
        reject_pct = round(rotten_pct, 2)
        rule_desc = "Fresh Tomato -> Grade A, Rotten Tomato -> Reject"

    grade_a_kg = round(valid_weight * (grade_a_pct / 100.0), 2) if valid_weight is not None else None
    grade_b_kg = round(valid_weight * (grade_b_pct / 100.0), 2) if valid_weight is not None else None
    reject_kg = round(valid_weight * (reject_pct / 100.0), 2) if valid_weight is not None else None

    return {
        "preliminary_mapping_rule": rule_desc,
        "grade_breakdown": {
            "grade_a_percent": grade_a_pct,
            "grade_b_percent": grade_b_pct,
            "reject_percent": reject_pct,
        },
        "estimated_weights_kg": {
            "grade_a_kg": grade_a_kg,
            "grade_b_kg": grade_b_kg,
            "reject_kg": reject_kg,
        },
    }


