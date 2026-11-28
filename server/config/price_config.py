"""
Konfigurasi sisi-server untuk integrasi harga hortikultura (isu #42).

Aturan keras:
  * Semua variabel ini SERVER-ONLY. Tidak ada padanan VITE_* — kredensial provider
    tidak boleh pernah sampai ke browser.
  * Flag default OFF (access unconfirmed sesuai temuan #38/#39): adapter tidak boleh
    memanggil provider sebelum akses resmi disetujui.
"""

import os
from dataclasses import dataclass, field
from typing import Optional


def _env_bool(name: str, default: bool = False) -> bool:
    raw = os.environ.get(name)
    if raw is None or raw.strip() == "":
        return default
    return raw.strip().lower() in {"1", "true", "yes", "on"}


def _env_int(name: str, default: int, minimum: int = 1, maximum: int = 55) -> int:
    raw = os.environ.get(name)
    try:
        value = int(raw) if raw not in (None, "") else default
    except ValueError:
        return default
    return max(minimum, min(maximum, value))


@dataclass(frozen=True)
class PriceIntegrationConfig:
    """Seluruh setting integrasi harga. Frozen agar tidak bisa diubah runtime."""

    sp2kp_enabled: bool = False
    sipashorti_enabled: bool = False
    ingest_enabled: bool = False

    sp2kp_base_url: Optional[str] = None
    sp2kp_api_key: Optional[str] = None
    sipashorti_base_url: Optional[str] = None
    sipashorti_api_key: Optional[str] = None

    # Importer dataset resmi SP2KP (data.go.id "Tingkat Harga Daerah"):
    # resource XLSX bulanan api-sp2kp.kemendag.go.id/kld/api/list-harga-harian.
    # Tidak ada kredensial — unduhan publik. months_back = berapa bulan lampau
    # ikut diunduh (selain bulan berjalan); 0 = bulan berjalan saja.
    sp2kp_dataset_base_url: Optional[str] = None
    sp2kp_dataset_months_back: int = 1
    sp2kp_dataset_province: str = "13"  # Sumatera Barat (Payakumbuh = 1376)

    http_timeout_seconds: int = 8
    http_max_retries: int = 2
    # Total anggaran waktu per panggilan provider — harus di bawah limit Vercel 60s
    http_total_budget_seconds: int = field(default_factory=lambda: 45)

    # Isu #43: kredensial scheduler (server-only), dipakai cron endpoint dengan
    # perbandingan konstanta-waktu; kosong => endpoint cron menolak semua pemanggil.
    cron_secret: Optional[str] = None
    # Negative cache kegagalan: tahan fetch ulang setelah provider gagal
    failure_cooldown_seconds: int = 300

    @property
    def total_budget_seconds(self) -> int:
        return min(self.http_total_budget_seconds, 55)


def load_price_config() -> PriceIntegrationConfig:
    """Baca env server-only. Dipanggil per request-batch, murah, dan stateless."""
    return PriceIntegrationConfig(
        sp2kp_enabled=_env_bool("PRICE_SP2KP_ENABLED"),
        sipashorti_enabled=_env_bool("PRICE_SIPASHORTI_ENABLED"),
        ingest_enabled=_env_bool("PRICE_INGEST_ENABLED"),
        sp2kp_base_url=os.environ.get("SP2KP_BASE_URL") or None,
        sp2kp_api_key=os.environ.get("SP2KP_API_KEY") or None,
        sipashorti_base_url=os.environ.get("SIPASHORTI_BASE_URL") or None,
        sipashorti_api_key=os.environ.get("SIPASHORTI_API_KEY") or None,
        http_timeout_seconds=_env_int("PRICE_HTTP_TIMEOUT_SECONDS", 8, minimum=1, maximum=20),
        http_max_retries=_env_int("PRICE_MAX_RETRIES", 2, minimum=0, maximum=5),
        http_total_budget_seconds=_env_int("PRICE_TOTAL_BUDGET_SECONDS", 45, minimum=5, maximum=55),
        sp2kp_dataset_base_url=os.environ.get("SP2KP_DATASET_BASE_URL") or None,
        sp2kp_dataset_months_back=_env_int("SP2KP_DATASET_MONTHS_BACK", 1, minimum=0, maximum=3),
        sp2kp_dataset_province=(os.environ.get("SP2KP_DATASET_PROVINCE") or "13").strip(),
        cron_secret=os.environ.get("PRICE_CRON_SECRET") or None,
        failure_cooldown_seconds=_env_int("PRICE_FAILURE_COOLDOWN_SECONDS", 300, minimum=30, maximum=3600),
    )
