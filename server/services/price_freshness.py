"""
Model freshness SPESIFIK PER SUMBER (isu #43) — bukan TTL global.

| state    | Aturan                                                        | Perilaku API |
|----------|---------------------------------------------------------------|--------------|
| fresh    | now - observed_at <= cadence + grace, dan fetch sukses        | respons normal |
| stale    | lebih tua dari fresh tapi dalam max_stale_age                 | hanya disajikan dengan data_status=cached + timestamp asli |
| expired  | lebih tua dari max_stale_age / tak ada fetch sukses           | TIDAK disajikan sebagai current (unavailable/503) |
| unknown  | timestamp/cadence/kesehatan sumber hilang                     | jangan dilabel fresh |

Lag publikasi, akhir pekan, dan hari libur dimodelkan per sumber. Hari libur tidak
membuat observasi lama jadi "fresh" — hanya memperpanjang jendela yang
TERDOKUMENTASI (`documented_extension_seconds`).
"""

from dataclasses import dataclass
from datetime import datetime, timezone
from typing import Optional

MAX_FRESHNESS_STATE = ("fresh", "stale", "expired", "unknown")


@dataclass(frozen=True)
class SourceFreshnessPolicy:
    """Policy freshness satu sumber. Nilai default konsisten migrasi #43."""

    expected_cadence_seconds: int = 86400
    grace_period_seconds: int = 21600
    max_stale_age_seconds: int = 172800
    documented_extension_seconds: int = 0

    def fresh_window(self) -> int:
        return self.expected_cadence_seconds + self.grace_period_seconds

    def __post_init__(self) -> None:
        if self.max_stale_age_seconds < self.fresh_window():
            raise ValueError("max_stale_age harus >= cadence + grace")


# Policy per sumber. SP2KP harian: lag publikasi 6 jam, maksimum disajikan stale
# 2 hari, dan perpanjangan akhir pekan TERDOKUMENTASI 1 hari (pasar tidak menerbitkan
# tiap hari Minggu). SIPASHORTI: nilai sama tapi tetap tidak berarti sampai akses disetujui.
FRESHNESS_POLICIES = {
    # SP2KP harian: lag publikasi 6 jam; maksimum disajikan stale 3 hari;
    # ekstensi akhir pekan TERDOKUMENTASI 1 hari (pasar tidak menerbitkan hari Minggu).
    "sp2kp": SourceFreshnessPolicy(
        expected_cadence_seconds=86400,
        grace_period_seconds=21600,
        max_stale_age_seconds=259200,
        documented_extension_seconds=86400,
    ),
    "sipashorti": SourceFreshnessPolicy(),
}


def policy_for(source_id: str) -> SourceFreshnessPolicy:
    return FRESHNESS_POLICIES.get(source_id, SourceFreshnessPolicy())


def compute_freshness(
    observed_at: Optional[datetime],
    source_id: str,
    now: Optional[datetime] = None,
    last_fetch_succeeded: bool = True,
) -> tuple:
    """
    Hitung state freshness. Returns: (state, age_seconds, max_age_effective)

    `now` di UTC. observed_at tanpa timezone dianggap UTC (dipakai ujung test saja).
    """
    policy = policy_for(source_id)
    if now is None:
        now = datetime.now(timezone.utc)
    if observed_at is None or not last_fetch_succeeded:
        return "unknown", None, None

    observed = observed_at
    if observed.tzinfo is None:
        observed = observed.replace(tzinfo=timezone.utc)
    age = int((now - observed).total_seconds())
    if age < 0:
        # Jam sumber maju dari server: treat sebagai fresh dengan age 0.
        age = 0

    fresh_window = policy.fresh_window() + policy.documented_extension_seconds
    if age <= fresh_window:
        return "fresh", age, fresh_window
    if age <= policy.max_stale_age_seconds:
        return "stale", age, policy.max_stale_age_seconds
    return "expired", age, policy.max_stale_age_seconds


def may_serve_as_current(state: str, data_status: str) -> bool:
    """Kebijakan penyajian: expired tidak pernah current; stale hanya berlabel cached."""
    if state == "expired":
        return False
    if state == "stale":
        return data_status in {"cached", "historical"}
    return data_status in {"actual", "cached"}
