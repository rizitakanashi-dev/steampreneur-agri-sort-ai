"""
Layanan Agregasi Inferensi Multi-Sudut (Multi-Angle / Multi-Shot Aggregation) — Agri-Sort AI Backend
Tanggung Jawab: Machine Learning (ML) Engineer (Faris Al Farizi)
Dokumen Acuan: docs/rencana-kerja-ml-engineer.md (Bab 8B Poin 1)

Mengatasi kelemahan Single-View Occlusion Bias pada inspeksi pascapanen:
1. Agregasi Rata-Rata Tertimbang (Weighted Defect Aggregation):
   - Menghitung proporsi mutu komprehensif dari 2 sudut pandang (Sisi Depan & Sisi Belakang/Balik).
2. Deteksi Bias Oklusi (Single-View Occlusion Bias Detection):
   - Mendeteksi disparitas signifikan jika sisi belakang menyembunyikan buah busuk/cacat.
3. Indeks Konsistensi Lot Panen (Consistency Index):
   - Mengukur tingkat keseragaman kualitas panen antar sudut pandang.
4. Integrasi Penentuan Nilai Ekonomis & Grade Komersial (STEAM Math & Business Integration).
"""

from typing import Any, Dict, Optional
from server.services.pricing_service import (
    calculate_business_grading,
    calculate_economic_projection,
    calculate_eggplant_economic_projection,
    calculate_chili_economic_projection,
    calculate_tomato_economic_projection,
)


def aggregate_multi_view_qc(
    front_raw: Dict[str, Any],
    back_raw: Dict[str, Any],
    commodity: str = "Terung",
    weight_kg: Optional[float] = None,
    weight_front: float = 0.50,
    weight_back: float = 0.50,
) -> Dict[str, Any]:
    """
    Menggabungkan hasil inferensi dari dua sudut pandang (Depan & Belakang).

    Parameter:
        front_raw: Hasil inferensi raw AI untuk foto sisi depan/atas
        back_raw: Hasil inferensi raw AI untuk foto sisi belakang/balik
        commodity: Jenis komoditas ("Terung" atau "Tomat")
        weight_kg: Total bobot panen fisik (kg)
        weight_front: Bobot penimbang sudut depan (default 0.50)
        weight_back: Bobot penimbang sudut belakang (default 0.50)

    Mengembalikan:
        Dictionary agregasi lengkap mencakup rasio tertimbang, analisis oklusi,
        grade komersial, dan proyeksi nilai ekonomis.
    """
    comm_lower = commodity.strip().lower()
    is_eggplant = "terung" in comm_lower or "terong" in comm_lower or "eggplant" in comm_lower
    is_chili = "cabai" in comm_lower or "chili" in comm_lower or "cabe" in comm_lower

    # 1. Ekstraksi Hitungan Objek Sisi Depan dan Belakang
    f_summary = front_raw.get("detection_summary", {})
    b_summary = back_raw.get("detection_summary", {})
    f_counts = f_summary.get("class_counts", {})
    b_counts = b_summary.get("class_counts", {})
    f_total = max(0, f_summary.get("total_objects", 0))
    b_total = max(0, b_summary.get("total_objects", 0))

    is_tomato_3grade = (
        not is_eggplant
        and not is_chili
        and any(k in f_counts or k in b_counts for k in ("Grade A", "grade-a", "grade_a", "Grade B", "grade-b", "grade_b"))
        and not any(k in f_counts or k in b_counts for k in ("fresh-tomato", "rotten-tomato", "fresh_tomato", "rotten_tomato"))
    )

    # 2. Normalisasi Bobot Sudut Pandang
    if f_total > 0 and b_total == 0:
        w_f = 1.0
        w_b = 0.0
    elif f_total == 0 and b_total > 0:
        w_f = 0.0
        w_b = 1.0
    else:
        w_sum = max(0.001, weight_front + weight_back)
        w_f = weight_front / w_sum
        w_b = weight_back / w_sum

    if is_eggplant:
        # Ekstraksi hitungan Terung: Dukung 3-Grade v2 (Grade A, Grade B, Reject) & 4-Class v1
        ga_f = f_counts.get("Grade A", 0) or f_counts.get("grade-a", 0) or f_counts.get("grade_a", 0)
        gb_f = f_counts.get("Grade B", 0) or f_counts.get("grade-b", 0) or f_counts.get("grade_b", 0)
        ga_b = b_counts.get("Grade A", 0) or b_counts.get("grade-a", 0) or b_counts.get("grade_a", 0)
        gb_b = b_counts.get("Grade B", 0) or b_counts.get("grade-b", 0) or b_counts.get("grade_b", 0)

        ef = f_counts.get("extra-class", 0) or f_counts.get("Extra Class", 0)
        c1f = f_counts.get("class-1", 0) or f_counts.get("Class I", 0) or f_counts.get("Class 1", 0)
        c2f = f_counts.get("class-2", 0) or f_counts.get("Class II", 0) or f_counts.get("Class 2", 0)
        rf = f_counts.get("reject", 0) or f_counts.get("Reject", 0)

        eb = b_counts.get("extra-class", 0) or b_counts.get("Extra Class", 0)
        c1b = b_counts.get("class-1", 0) or b_counts.get("Class I", 0) or b_counts.get("Class 1", 0)
        c2b = b_counts.get("class-2", 0) or b_counts.get("Class II", 0) or b_counts.get("Class 2", 0)
        rb = b_counts.get("reject", 0) or b_counts.get("Reject", 0)

        is_3grade = (ga_f > 0 or gb_f > 0 or ga_b > 0 or gb_b > 0) and ef == 0 and c1f == 0 and c2f == 0 and eb == 0 and c1b == 0 and c2b == 0
        if is_3grade:
            ef = ga_f
            c1f = 0
            c2f = gb_f
            eb = ga_b
            c1b = 0
            c2b = gb_b

        # Rasio per sudut (%)
        r_ef = (ef / f_total * 100.0) if f_total > 0 else 0.0
        r_c1f = (c1f / f_total * 100.0) if f_total > 0 else 0.0
        r_c2f = (c2f / f_total * 100.0) if f_total > 0 else 0.0
        r_rf = (rf / f_total * 100.0) if f_total > 0 else 0.0

        r_eb = (eb / b_total * 100.0) if b_total > 0 else 0.0
        r_c1b = (c1b / b_total * 100.0) if b_total > 0 else 0.0
        r_c2b = (c2b / b_total * 100.0) if b_total > 0 else 0.0
        r_rb = (rb / b_total * 100.0) if b_total > 0 else 0.0

        # Rata-rata tertimbang
        w_extra = round(w_f * r_ef + w_b * r_eb, 2)
        w_class1 = round(w_f * r_c1f + w_b * r_c1b, 2)
        w_class2 = round(w_f * r_c2f + w_b * r_c2b, 2)
        w_reject = round(w_f * r_rf + w_b * r_rb, 2)

        # Normalisasi pembulatan agar total tepat 100% jika ada objek
        r_sum = w_extra + w_class1 + w_class2 + w_reject
        if r_sum > 0 and abs(r_sum - 100.0) > 0.01:
            diff = 100.0 - r_sum
            w_class2 = round(w_class2 + diff, 2)

        # Indeks Cacat untuk Analisis Oklusi: Reject penuh + 50% Class II
        front_defect_index = r_rf + (0.5 * r_c2f)
        back_defect_index = r_rb + (0.5 * r_c2b)
        defect_delta = round(back_defect_index - front_defect_index, 2)

        # Evaluasi Bias Oklusi (Sisi belakang lebih rusak dari sisi depan)
        if f_total == 0 or b_total == 0:
            occlusion_bias_detected = False
            occlusion_severity = "INCOMPLETE"
            warning_msg = "Pemeriksaan oklusi 2-sisi tidak lengkap: salah satu sudut pandang tidak mendeteksi objek panen."
        else:
            occlusion_bias_detected = defect_delta >= 15.0
            if defect_delta >= 30.0:
                occlusion_severity = "HIGH"
                warning_msg = (
                    f"Peringatan Kritis Oklusi: Sisi belakang memiliki disparitas cacat signifikan (+{defect_delta}%). "
                    "Potensi kuat buah busuk/cacat disembunyikan di bagian bawah nampan."
                )
            elif defect_delta >= 15.0:
                occlusion_severity = "MODERATE"
                warning_msg = (
                    f"Perhatian: Terdeteksi tingkat cacat lebih tinggi (+{defect_delta}%) pada sisi belakang/balik. "
                    "Hasil agregasi menggunakan prinsip kehati-hatian QC."
                )
            else:
                occlusion_severity = "NONE"
                warning_msg = None

        consistency_index = round(max(0.0, 100.0 - abs(back_defect_index - front_defect_index)), 2)

        # Estimasi jumlah buah efektif untuk kalkulasi pricing
        eff_total = max(f_total, b_total) or 1
        eff_extra = int(round((w_extra / 100.0) * eff_total))
        eff_c1 = int(round((w_class1 / 100.0) * eff_total))
        eff_c2 = int(round((w_class2 / 100.0) * eff_total))
        eff_rej = max(0, eff_total - (eff_extra + eff_c1 + eff_c2))

        # Kalkulasi nilai ekonomi & grade bisnis
        pricing_info = calculate_eggplant_economic_projection(
            weight_kg=weight_kg,
            extra_count=eff_extra,
            class1_count=eff_c1,
            class2_count=eff_c2,
            reject_count=eff_rej,
        )
        # Gunakan rasio tertimbang riil
        pricing_info["condition_ratios"] = {
            "extra_class_percent": w_extra,
            "class_1_percent": w_class1,
            "class_2_percent": w_class2,
            "reject_percent": w_reject,
        }
        if is_3grade:
            pricing_info["condition_ratios"]["grade_a_percent"] = w_extra
            pricing_info["condition_ratios"]["grade_b_percent"] = w_class2

        business_grading = calculate_business_grading(
            commodity="Terung",
            weight_kg=weight_kg,
            ratios=pricing_info["condition_ratios"],
        )

        condition_ratios = pricing_info["condition_ratios"]
        combined_counts = {
            "total_samples_observed": f_total + b_total,
            "front_view_total": f_total,
            "back_view_total": b_total,
            "grade_a_combined": (ga_f + ga_b) if is_3grade else (ef + eb + c1f + c1b),
            "grade_b_combined": (gb_f + gb_b) if is_3grade else (c2f + c2b),
            "extra_class_combined": ef + eb,
            "class_1_combined": c1f + c1b,
            "class_2_combined": c2f + c2b,
            "reject_combined": rf + rb,
        }

    elif is_chili or is_tomato_3grade:
        item_label = "cabai" if is_chili else "tomat"
        item_title = "Cabai" if is_chili else "Tomat"

        af = f_counts.get("Grade A", 0) or f_counts.get("grade-a", 0) or f_counts.get("grade_a", 0)
        bf = f_counts.get("Grade B", 0) or f_counts.get("grade-b", 0) or f_counts.get("grade_b", 0)
        rf = f_counts.get("reject", 0) or f_counts.get("Reject", 0)

        ab = b_counts.get("Grade A", 0) or b_counts.get("grade-a", 0) or b_counts.get("grade_a", 0)
        bb = b_counts.get("Grade B", 0) or b_counts.get("grade-b", 0) or b_counts.get("grade_b", 0)
        rb = b_counts.get("reject", 0) or b_counts.get("Reject", 0)

        r_af = (af / f_total * 100.0) if f_total > 0 else 0.0
        r_bf = (bf / f_total * 100.0) if f_total > 0 else 0.0
        r_rf = (rf / f_total * 100.0) if f_total > 0 else 0.0

        r_ab = (ab / b_total * 100.0) if b_total > 0 else 0.0
        r_bb = (bb / b_total * 100.0) if b_total > 0 else 0.0
        r_rb = (rb / b_total * 100.0) if b_total > 0 else 0.0

        w_a = round(w_f * r_af + w_b * r_ab, 2)
        w_b_pct = round(w_f * r_bf + w_b * r_bb, 2)
        w_reject = round(w_f * r_rf + w_b * r_rb, 2)

        r_sum = w_a + w_b_pct + w_reject
        if r_sum > 0 and abs(r_sum - 100.0) > 0.01:
            diff = 100.0 - r_sum
            w_b_pct = round(w_b_pct + diff, 2)

        front_defect_index = r_rf + (0.5 * r_bf)
        back_defect_index = r_rb + (0.5 * r_bb)
        defect_delta = round(back_defect_index - front_defect_index, 2)

        if f_total == 0 or b_total == 0:
            occlusion_bias_detected = False
            occlusion_severity = "INCOMPLETE"
            warning_msg = f"Pemeriksaan oklusi 2-sisi tidak lengkap: salah satu sudut pandang tidak mendeteksi objek {item_label}."
        else:
            occlusion_bias_detected = defect_delta >= 15.0
            if defect_delta >= 30.0:
                occlusion_severity = "HIGH"
                warning_msg = (
                    f"Peringatan Kritis Oklusi {item_title}: Sisi belakang memiliki disparitas cacat signifikan (+{defect_delta}%). "
                    f"Potensi kuat {item_label} busuk disembunyikan di bagian bawah nampan."
                )
            elif defect_delta >= 15.0:
                occlusion_severity = "MODERATE"
                warning_msg = (
                    f"Perhatian: Terdeteksi tingkat cacat lebih tinggi (+{defect_delta}%) pada sisi belakang/balik {item_label}."
                )
            else:
                occlusion_severity = "NONE"
                warning_msg = None

        consistency_index = round(max(0.0, 100.0 - abs(back_defect_index - front_defect_index)), 2)

        eff_total = max(f_total, b_total) or 1
        eff_a = int(round((w_a / 100.0) * eff_total))
        eff_b = int(round((w_b_pct / 100.0) * eff_total))
        eff_rej = max(0, eff_total - (eff_a + eff_b))

        pricing_fn = calculate_chili_economic_projection if is_chili else calculate_tomato_economic_projection
        pricing_info = pricing_fn(
            weight_kg=weight_kg,
            grade_a_count=eff_a,
            grade_b_count=eff_b,
            reject_count=eff_rej,
            commodity_name=commodity,
        )
        pricing_info["condition_ratios"] = {
            "grade_a_percent": w_a,
            "grade_b_percent": w_b_pct,
            "reject_percent": w_reject,
            "marketable_percent": round(w_a + w_b_pct, 2),
        }

        business_grading = calculate_business_grading(
            commodity=commodity,
            weight_kg=weight_kg,
            ratios=pricing_info["condition_ratios"],
        )

        condition_ratios = pricing_info["condition_ratios"]
        combined_counts = {
            "total_samples_observed": f_total + b_total,
            "front_view_total": f_total,
            "back_view_total": b_total,
            "grade_a_combined": af + ab,
            "grade_b_combined": bf + bb,
            "reject_combined": rf + rb,
        }

    else:
        # Ekstraksi hitungan Tomat 2-Class
        ff = f_counts.get("fresh-tomato", 0) or f_counts.get("fresh", 0)
        rf = f_counts.get("rotten-tomato", 0) or f_counts.get("rotten", 0)

        fb = b_counts.get("fresh-tomato", 0) or b_counts.get("fresh", 0)
        rb = b_counts.get("rotten-tomato", 0) or b_counts.get("rotten", 0)

        r_ff = (ff / f_total * 100.0) if f_total > 0 else 0.0
        r_rf = (rf / f_total * 100.0) if f_total > 0 else 0.0

        r_fb = (fb / b_total * 100.0) if b_total > 0 else 0.0
        r_rb = (rb / b_total * 100.0) if b_total > 0 else 0.0

        w_fresh = round(w_f * r_ff + w_b * r_fb, 2)
        w_rotten = round(w_f * r_rf + w_b * r_rb, 2)

        # Normalisasi
        if (w_fresh + w_rotten) > 0 and abs((w_fresh + w_rotten) - 100.0) > 0.01:
            w_rotten = round(100.0 - w_fresh, 2)

        defect_delta = round(r_rb - r_rf, 2)
        if f_total == 0 or b_total == 0:
            occlusion_bias_detected = False
            occlusion_severity = "INCOMPLETE"
            warning_msg = "Pemeriksaan oklusi 2-sisi tidak lengkap: salah satu sudut pandang tidak mendeteksi objek tomat."
        else:
            occlusion_bias_detected = defect_delta >= 15.0
            if defect_delta >= 30.0:
                occlusion_severity = "HIGH"
                warning_msg = (
                    f"Peringatan Kritis Oklusi Tomat: Sisi belakang memiliki tingkat tomat busuk (+{defect_delta}%) "
                    "lebih banyak dibandingkan sisi depan."
                )
            elif defect_delta >= 15.0:
                occlusion_severity = "MODERATE"
                warning_msg = (
                    f"Perhatian: Terdeteksi disparitas tomat busuk (+{defect_delta}%) pada sisi belakang."
                )
            else:
                occlusion_severity = "NONE"
                warning_msg = None

        consistency_index = round(max(0.0, 100.0 - abs(defect_delta)), 2)

        eff_total = max(f_total, b_total) or 1
        eff_fresh = int(round((w_fresh / 100.0) * eff_total))
        eff_rotten = max(0, eff_total - eff_fresh)

        pricing_info = calculate_economic_projection(
            commodity_name="Tomat",
            weight_kg=weight_kg,
            fresh_ratio_percent=w_fresh,
            rotten_count=eff_rotten,
            fresh_count=eff_fresh,
        )

        business_grading = calculate_business_grading(
            commodity="Tomat",
            weight_kg=weight_kg,
            ratios={"fresh_ratio_percent": w_fresh, "rotten_ratio_percent": w_rotten},
        )

        condition_ratios = {
            "fresh_ratio_percent": w_fresh,
            "rotten_ratio_percent": w_rotten,
        }
        combined_counts = {
            "total_samples_observed": f_total + b_total,
            "front_view_total": f_total,
            "back_view_total": b_total,
            "fresh_tomato_combined": ff + fb,
            "rotten_tomato_combined": rf + rb,
        }

    return {
        "aggregation_weights": {
            "front_view_weight": round(w_f, 2),
            "back_view_weight": round(w_b, 2),
        },
        "weighted_condition_ratios": condition_ratios,
        "combined_object_counts": combined_counts,
        "occlusion_analysis": {
            "occlusion_bias_detected": occlusion_bias_detected,
            "occlusion_severity": occlusion_severity,
            "defect_delta_percent": defect_delta,
            "consistency_index_percent": consistency_index,
            "warning_message": warning_msg,
        },
        "business_grading": business_grading,
        "smart_pricing": pricing_info,
    }
