"""
Normalisasi harga hortikultura (isu #42) — pemetaan EKSAK, tanpa fuzzy matching.

Aturan:
  * Label sumber -> ID kanonik hanya lewat tabel pemetaan eksak (kapitalisasi/spasi
    dinormalisasi, kata tidak).
  * Label yang tidak ada di pemetaan => tidak didukung (None), BUKAN diganti komoditas lain.
  * `cabai rawit merah` dan `cabai rawit hijau` HARUS tetap terpisah.
  * Normalisasi ke Rp/kg hanya untuk unit massa yang diketahui; selain itu None —
    dilarang mengarang asumsi berat jenis.
  * Terung hanya masuk bila sumber menerbitkan rekaman Terung eksplisit.
"""

from typing import Dict, Optional, Set, Tuple

from server.models.price import PRICE_TYPE, REGION_LEVEL

# Katalog kanonik Agri-Sort (ID bergaya snake sesuai isu #42)
CANONICAL_COMMODITIES: Dict[str, str] = {
    "cabai_rawit_hijau": "Cabai Rawit Hijau",
    "cabai_merah_keriting": "Cabai Merah Keriting",
    "cabai_rawit_merah": "Cabai Rawit Merah",
    "tomat": "Tomat",
    "terung": "Terung (Eggplant)",
}

# Pemetaan EKSAK label sumber -> (commodity_id, price_type) per sumber.
# Label SP2KP di bawah ini DIVERIFIKASI LANGSUNG dari kolom `Nama Varian` berkas
# XLSX resmi bulanan dataset SP2KP "Tingkat Harga Daerah" (data.go.id, Sep 2025):
# daftar varian memuat 'Cabai Rawit Hijau', 'Cabai Rawit Merah',
# 'Cabai Merah Keriting', 'Tomat' — dan TIDAK memuat 'Terung'.
SOURCE_LABEL_MAP: Dict[str, Dict[str, Tuple[str, PRICE_TYPE]]] = {
    "sp2kp": {
        "c rawit hijau": ("cabai_rawit_hijau", "consumer"),
        "cabai rawit hijau": ("cabai_rawit_hijau", "consumer"),
        "cabai rawit merah": ("cabai_rawit_merah", "consumer"),
        "cabai merah keriting": ("cabai_merah_keriting", "consumer"),
        "tomat": ("tomat", "consumer"),
    },
    "sipashorti": {
        # Kosong sampai #38 mengkonfirmasi label eksak — dilarang menebak.
    },
}

# Unit massa yang konversinya TERDOKUMENTASI ke kg.
MASS_UNITS_TO_KG: Dict[str, float] = {
    "kg": 1.0,
    "kilogram": 1.0,
    "kilograms": 1.0,
}

# Unit non-massa yang dikenal tapi TIDAK boleh dinormalisasi tanpa bukti.
KNOWN_NON_MASS_UNITS: Set[str] = {"liter", "ikat", "boks", "gram"}

UNIT_RAW_MAX_LEN = 24


def normalize_text(value: Optional[str]) -> str:
    """Rapikan spasi & kapital untuk pemetaan eksak; tidak mengubah kata."""
    if not value:
        return ""
    return " ".join(str(value).split()).strip().lower()


def resolve_commodity(
    raw_label: Optional[str], source_id: str
) -> Tuple[Optional[str], Optional[PRICE_TYPE], bool]:
    """
    Resolusi EKSAK label sumber.

    Returns: (commodity_id | None, price_type | None, is_supported_source_label)
    - Label tidak terdaftar => (None, None, False) — penelepon wajib menolak rekaman,
      bukan mengganti komoditas.
    """
    label = normalize_text(raw_label)
    if not label:
        return None, None, False
    mapping = SOURCE_LABEL_MAP.get(source_id)
    if mapping is None:
        return None, None, False
    hit = mapping.get(label)
    if hit is None:
        return None, None, False
    commodity_id, price_type = hit
    return commodity_id, price_type, True


def resolve_commodity_query(value: Optional[str]) -> Optional[str]:
    """
    Terima parameter query `commodity`: ID kanonik atau nama kanonik (eksak).
    Tanpa fuzzy matching — 'tomat merah' tidak pernah menjadi 'tomat'.
    """
    key = normalize_text(value)
    if not key:
        return None
    if key in CANONICAL_COMMODITIES:
        return key
    for commodity_id, name in CANONICAL_COMMODITIES.items():
        if normalize_text(name) == key:
            return commodity_id
    return None


def normalize_unit(
    unit_raw: Optional[str], price_value: Optional[float]
) -> Optional[Tuple[float, Dict[str, float]]]:
    """
    Normalisasi ke Rp/kg HANYA bila unit sumber adalah unit massa terdokumentasi.

    Returns: (faktor, info) atau None bila tidak bisa dinormalisasi.
    Dilarang mengarang berat jenis untuk liter/ikat/boks.
    """
    if unit_raw is None or price_value is None:
        return None
    unit = normalize_text(unit_raw)[:UNIT_RAW_MAX_LEN]
    factor = MASS_UNITS_TO_KG.get(unit)
    if factor is None:
        return None
    return factor, {"method": "unit_factor", "factor": factor, "source_unit": unit}


def is_known_non_mass_unit(unit_raw: Optional[str]) -> bool:
    unit = normalize_text(unit_raw)[:UNIT_RAW_MAX_LEN]
    return unit in KNOWN_NON_MASS_UNITS


def resolve_region(
    region_level: Optional[REGION_LEVEL], region_code: Optional[str], market: Optional[str] = None
) -> Optional[Dict[str, object]]:
    """
    Susun objek region kontrak. Region code di-validate bentuk saja (digit),
    TANPA memverifikasi isi wilayah — verifikasi wilayah adalah tanggung jawab sumber.
    """
    if region_level is None:
        return None
    if region_level == "nasional":
        return {"level": "nasional", "code": None, "name": "Nasional", "parent": None}
    code = (region_code or "").strip()
    if not code.isdigit() or len(code) > 8:
        return None
    if region_level == "provinsi":
        return {
            "level": "provinsi",
            "code": code,
            "name": f"Provinsi {code}",
            "parent": None,
        }
    # kabupaten: provinsi induk = 2 digit pertama (standar kode Kemendagri)
    parent_code = code[:2]
    return {
        "level": "kabupaten",
        "code": code,
        "name": f"Kabupaten/Kota {code}" + (f" — {market}" if market else ""),
        "parent": {"level": "provinsi", "code": parent_code, "name": f"Provinsi {parent_code}"},
    }
