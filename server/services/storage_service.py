"""
Modul Layanan Persistensi Riwayat Scan (Persistence Layer) — Agri-Sort AI Backend
Tanggung Jawab: Fullstack Developer (Backend Services)
Dokumen Acuan: docs/rencana-kerja-fullstack.md (Task FS-BE-05)

Menyediakan penyimpanan data riwayat pemindaian panen dengan format terstandarisasi,
mendukung fallback lokal (JSON storage) dan siap diintegrasikan dengan Supabase/PostgreSQL.
"""

from datetime import datetime, timezone
import json
import logging
import math
import os
from pathlib import Path
import threading
from typing import Any, Dict, List, Optional
import urllib.error
import urllib.parse
import urllib.request
import uuid

logger = logging.getLogger("agrisort.storage")

# Direktori data lokal untuk persistensi lokal (development) atau /tmp pada Vercel Serverless
DATA_DIR = (
    Path("/tmp/agri-sort-data")
    if os.environ.get("VERCEL")
    else Path(__file__).parent.parent / "data"
)
DEFAULT_STORAGE_PATH = DATA_DIR / "scans.json"

_storage_lock = threading.Lock()


def get_supabase_ddl() -> str:
    """
    Menghasilkan skema DDL PostgreSQL / Supabase lengkap dengan Row Level Security (RLS)
    dan indeks performa untuk integrasi cloud jangka panjang (Sprint 3 / P2).
    """
    return """-- Skema Database Agri-Sort AI (PostgreSQL / Supabase)
-- Tanggal: 5 November 2026
-- Tanggung Jawab: Fullstack Developer

CREATE TABLE IF NOT EXISTS public.scans (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    scan_id VARCHAR(64) UNIQUE NOT NULL,
    commodity VARCHAR(100) NOT NULL,
    ai_supported BOOLEAN NOT NULL DEFAULT true,
    actual_weight_kg NUMERIC(8, 2),
    total_objects INTEGER NOT NULL DEFAULT 0,
    fresh_count INTEGER NOT NULL DEFAULT 0,
    rotten_count INTEGER NOT NULL DEFAULT 0,
    fresh_ratio_percent NUMERIC(5, 2) NOT NULL DEFAULT 0.0,
    rotten_ratio_percent NUMERIC(5, 2) NOT NULL DEFAULT 0.0,
    reference_price_per_kg INTEGER NOT NULL DEFAULT 0,
    estimated_economic_value BIGINT,
    potential_loss_value BIGINT,
    recommendation_note TEXT,
    is_simulated BOOLEAN NOT NULL DEFAULT false,
    model_version VARCHAR(50),
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

-- Indeks untuk pencarian dan filter cepat
CREATE INDEX IF NOT EXISTS idx_scans_commodity ON public.scans (commodity);
CREATE INDEX IF NOT EXISTS idx_scans_created_at ON public.scans (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_scans_scan_id ON public.scans (scan_id);

-- Aktifkan Row Level Security (RLS)
ALTER TABLE public.scans ENABLE ROW LEVEL SECURITY;

-- Kebijakan akses anonim baca/tulis untuk proto lomba (dapat dibatasi auth pada produksi)
CREATE POLICY "Akses publik baca riwayat scan"
    ON public.scans FOR SELECT
    USING (true);

CREATE POLICY "Akses publik simpan riwayat scan"
    ON public.scans FOR INSERT
    WITH CHECK (true);
"""


_SUPABASE_SCAN_COLUMNS = (
    "id",
    "scan_id",
    "commodity",
    "ai_supported",
    "actual_weight_kg",
    "total_objects",
    "fresh_count",
    "rotten_count",
    "fresh_ratio_percent",
    "rotten_ratio_percent",
    "reference_price_per_kg",
    "estimated_economic_value",
    "potential_loss_value",
    "recommendation_note",
    "is_simulated",
    "model_version",
    "created_at",
    "updated_at",
)


def _normalize_scan_record(scan_data: Dict[str, Any]) -> Dict[str, Any]:
    """Menormalisasi payload hasil pemindaian menjadi record terstandarisasi."""
    scan_id = scan_data.get("scan_id") or f"scan_{datetime.now(timezone.utc).strftime('%Y%m%d')}_{uuid.uuid4().hex[:6]}"
    now_iso = datetime.now(timezone.utc).isoformat()
    created_at = scan_data.get("timestamp") or scan_data.get("created_at") or now_iso

    inference = scan_data.get("inference_result") or {}
    pricing = scan_data.get("smart_pricing") or {}
    obj_counts = inference.get("object_counts") or {}
    condition_ratios = inference.get("condition_ratios") or {}

    raw_w = scan_data.get("actual_weight_kg")
    clean_weight: Optional[float] = None
    try:
        if raw_w is not None:
            parsed_w = float(raw_w)
            if not math.isnan(parsed_w) and not math.isinf(parsed_w) and parsed_w > 0:
                clean_weight = round(parsed_w, 2)
    except (TypeError, ValueError):
        clean_weight = None

    raw_fresh_pct = condition_ratios.get("fresh_ratio_percent", scan_data.get("fresh_ratio_percent", 0.0))
    clean_fresh_pct = 0.0
    try:
        parsed_fresh = float(raw_fresh_pct)
        if not math.isnan(parsed_fresh) and not math.isinf(parsed_fresh):
            clean_fresh_pct = round(max(0.0, min(100.0, parsed_fresh)), 2)
    except (TypeError, ValueError):
        clean_fresh_pct = 0.0

    clean_rotten_pct = round(100.0 - clean_fresh_pct, 2)

    return {
        "id": str(uuid.uuid4()),
        "scan_id": scan_id,
        "commodity": scan_data.get("commodity", "Tomat"),
        "ai_supported": bool(scan_data.get("ai_supported", True)),
        "actual_weight_kg": clean_weight,
        "total_objects": int(obj_counts.get("total", scan_data.get("total_objects", 0)) or 0),
        "fresh_count": int(obj_counts.get("fresh_tomato", scan_data.get("fresh_count", 0)) or 0),
        "rotten_count": int(obj_counts.get("rotten_tomato", obj_counts.get("reject", scan_data.get("rotten_count", 0))) or 0),
        "fresh_ratio_percent": clean_fresh_pct,
        "rotten_ratio_percent": clean_rotten_pct,
        "class_counts": obj_counts,
        "condition_ratios": condition_ratios,
        "reference_price_per_kg": int(pricing.get("reference_price_per_kg", scan_data.get("reference_price_per_kg", 0)) or 0),
        "estimated_economic_value": pricing.get("estimated_economic_value", scan_data.get("estimated_economic_value")),
        "potential_loss_value": pricing.get("potential_loss_value", scan_data.get("potential_loss_value")),
        "recommendation_note": pricing.get("recommendation_note", scan_data.get("recommendation_note", "")),
        "is_simulated": bool(scan_data.get("is_simulated", True)),
        "model_version": str(inference.get("model_version", scan_data.get("model_version", "1.0.0"))),
        "created_at": created_at,
        "updated_at": now_iso,
    }


def _build_scans_summary(records: List[Dict[str, Any]], total_count: Optional[int] = None) -> Dict[str, Any]:
    """Menghitung ringkasan agregat berat dan nilai ekonomi dari daftar record."""
    count = total_count if total_count is not None else len(records)
    total_weight = sum(float(r.get("actual_weight_kg") or 0.0) for r in records)
    total_value = sum(int(r.get("estimated_economic_value") or 0) for r in records)
    return {
        "total_batches": count,
        "total_weight_kg": round(total_weight, 2),
        "total_economic_value_idr": total_value,
    }


class LocalScanStorage:
    """
    Penyimpanan riwayat berbasis file JSON lokal yang thread-safe dan tahan terhadap file rusak.
    Mengikuti arsitektur clean data layer mirip dengan harvestStorage.js di frontend.
    """

    def __init__(self, file_path: Optional[Path] = None):
        self.file_path = file_path or DEFAULT_STORAGE_PATH

    def _ensure_dir(self) -> None:
        """Memastikan direktori penyimpanan tersedia."""
        self.file_path.parent.mkdir(parents=True, exist_ok=True)

    def _read_all(self) -> List[Dict[str, Any]]:
        """Membaca seluruh riwayat scan dari file JSON. Mengembalikan [] jika kosong atau korup."""
        if not self.file_path.exists():
            return []
        try:
            with open(self.file_path, "r", encoding="utf-8") as f:
                content = f.read().strip()
                if not content:
                    return []
                data = json.loads(content)
                if isinstance(data, list):
                    return data
                return []
        except (json.JSONDecodeError, OSError):
            # Graceful fallback jika JSON korup atau tidak terbaca
            return []

    def _write_all(self, records: List[Dict[str, Any]]) -> bool:
        """Menulis daftar riwayat ke file JSON secara atomik."""
        self._ensure_dir()
        temp_file = self.file_path.with_suffix(".tmp")
        try:
            with open(temp_file, "w", encoding="utf-8") as f:
                json.dump(records, f, indent=2, ensure_ascii=False)
            os.replace(temp_file, self.file_path)
            return True
        except OSError:
            if temp_file.exists():
                try:
                    temp_file.unlink()
                except OSError:
                    pass
            return False

    def save_scan(self, scan_data: Dict[str, Any]) -> Dict[str, Any]:
        """
        Menyimpan hasil pemindaian ke storage lokal.
        Menghasilkan scan_id dan created_at otomatis jika belum tersedia.
        """
        with _storage_lock:
            records = self._read_all()
            record = _normalize_scan_record(scan_data)

            # Masukkan di awal daftar (urutan terbaru di atas)
            # Jika scan_id sudah ada, perbarui record lama
            existing_idx = next((i for i, r in enumerate(records) if r.get("scan_id") == record["scan_id"]), None)
            if existing_idx is not None:
                records[existing_idx] = record
            else:
                records.insert(0, record)

            self._write_all(records)
            return record

    def get_scans(
        self,
        limit: int = 50,
        offset: int = 0,
        commodity: Optional[str] = None,
    ) -> Dict[str, Any]:
        """
        Mengambil daftar riwayat scan dengan fitur filter komoditas dan paginasi.
        """
        with _storage_lock:
            records = self._read_all()

            if commodity:
                comm_filter = commodity.strip().lower()
                records = [r for r in records if r.get("commodity", "").strip().lower() == comm_filter]

            total_count = len(records)
            paged_records = records[offset : offset + limit]

            return {
                "total_count": total_count,
                "offset": offset,
                "limit": limit,
                "records": paged_records,
                "summary": _build_scans_summary(records, total_count=total_count),
            }

    def get_scan_by_id(self, scan_id: str) -> Optional[Dict[str, Any]]:
        """Mencari satu catatan pemindaian berdasarkan scan_id."""
        with _storage_lock:
            records = self._read_all()
            return next((r for r in records if r.get("scan_id") == scan_id), None)

    def delete_scan(self, scan_id: str) -> bool:
        """Menghapus satu catatan pemindaian berdasarkan scan_id."""
        with _storage_lock:
            records = self._read_all()
            initial_len = len(records)
            filtered = [r for r in records if r.get("scan_id") != scan_id]
            if len(filtered) < initial_len:
                self._write_all(filtered)
                return True
            return False

    def clear_scans(self) -> int:
        """Mengosongkan seluruh riwayat pemindaian."""
        with _storage_lock:
            records = self._read_all()
            count = len(records)
            self._write_all([])
            return count


class SupabaseScanStorage:
    """
    Lapisan persistensi cloud menggunakan Supabase PostgREST (/rest/v1/scans)
    berdasarkan skema DDL pada get_supabase_ddl(), tanpa dependency eksternal tambahan.
    """

    def __init__(
        self,
        supabase_url: str,
        supabase_key: str,
        fallback: Optional[LocalScanStorage] = None,
        timeout_seconds: float = 10.0,
    ):
        self.base_url = supabase_url.rstrip("/")
        self.api_key = supabase_key
        self.fallback = fallback or LocalScanStorage()
        self.timeout_seconds = timeout_seconds

    def _request(
        self,
        method: str,
        query: str = "",
        payload: Optional[Any] = None,
        prefer: Optional[str] = None,
    ) -> tuple[Any, Dict[str, str]]:
        url = f"{self.base_url}/rest/v1/scans{query}"
        headers = {
            "apikey": self.api_key,
            "Authorization": f"Bearer {self.api_key}",
            "Content-Type": "application/json",
        }
        if prefer:
            headers["Prefer"] = prefer

        data = json.dumps(payload).encode("utf-8") if payload is not None else None
        req = urllib.request.Request(url, data=data, headers=headers, method=method)
        with urllib.request.urlopen(req, timeout=self.timeout_seconds) as resp:
            raw = resp.read().decode("utf-8").strip()
            resp_headers = {k.lower(): v for k, v in resp.headers.items()}
            return (json.loads(raw) if raw else None), resp_headers

    @staticmethod
    def _to_db_row(record: Dict[str, Any]) -> Dict[str, Any]:
        return {col: record.get(col) for col in _SUPABASE_SCAN_COLUMNS if col in record}

    @staticmethod
    def _from_db_row(row: Dict[str, Any]) -> Dict[str, Any]:
        normalized = dict(row)
        if normalized.get("actual_weight_kg") is not None:
            normalized["actual_weight_kg"] = float(normalized["actual_weight_kg"])
        if normalized.get("fresh_ratio_percent") is not None:
            normalized["fresh_ratio_percent"] = float(normalized["fresh_ratio_percent"])
        if normalized.get("rotten_ratio_percent") is not None:
            normalized["rotten_ratio_percent"] = float(normalized["rotten_ratio_percent"])
        return normalized

    def save_scan(self, scan_data: Dict[str, Any]) -> Dict[str, Any]:
        record = _normalize_scan_record(scan_data)
        db_row = self._to_db_row(record)
        try:
            rows, _ = self._request(
                "POST",
                query="?on_conflict=scan_id",
                payload=db_row,
                prefer="resolution=merge-duplicates,return=representation",
            )
            if isinstance(rows, list) and rows:
                return self._from_db_row(rows[0])
            return record
        except (urllib.error.URLError, urllib.error.HTTPError, TimeoutError, json.JSONDecodeError) as exc:
            logger.warning("Gagal menyimpan ke Supabase, menggunakan fallback lokal: %s", exc)
            return self.fallback.save_scan(scan_data)

    def get_scans(
        self,
        limit: int = 50,
        offset: int = 0,
        commodity: Optional[str] = None,
    ) -> Dict[str, Any]:
        filter_q = ""
        if commodity:
            encoded_comm = urllib.parse.quote(commodity.strip(), safe="")
            filter_q = f"&commodity=ilike.{encoded_comm}"

        try:
            rows, headers = self._request(
                "GET",
                query=f"?select=*&order=created_at.desc&limit={int(limit)}&offset={int(offset)}{filter_q}",
                prefer="count=exact",
            )
            paged_records = [self._from_db_row(r) for r in (rows or [])]

            total_count = len(paged_records)
            content_range = headers.get("content-range", "")
            if "/" in content_range:
                total_str = content_range.split("/")[-1].strip()
                if total_str.isdigit():
                    total_count = int(total_str)

            agg_rows, _ = self._request(
                "GET",
                query=f"?select=actual_weight_kg,estimated_economic_value{filter_q}",
            )
            return {
                "total_count": total_count,
                "offset": offset,
                "limit": limit,
                "records": paged_records,
                "summary": _build_scans_summary(agg_rows or [], total_count=total_count),
            }
        except (urllib.error.URLError, urllib.error.HTTPError, TimeoutError, json.JSONDecodeError) as exc:
            logger.warning("Gagal membaca riwayat dari Supabase, menggunakan fallback lokal: %s", exc)
            return self.fallback.get_scans(limit=limit, offset=offset, commodity=commodity)

    def get_scan_by_id(self, scan_id: str) -> Optional[Dict[str, Any]]:
        try:
            encoded_id = urllib.parse.quote(scan_id, safe="")
            rows, _ = self._request("GET", query=f"?select=*&scan_id=eq.{encoded_id}&limit=1")
            if isinstance(rows, list) and rows:
                return self._from_db_row(rows[0])
            return None
        except (urllib.error.URLError, urllib.error.HTTPError, TimeoutError, json.JSONDecodeError) as exc:
            logger.warning("Gagal mengambil scan_id dari Supabase, menggunakan fallback lokal: %s", exc)
            return self.fallback.get_scan_by_id(scan_id)

    def delete_scan(self, scan_id: str) -> bool:
        try:
            encoded_id = urllib.parse.quote(scan_id, safe="")
            rows, _ = self._request(
                "DELETE",
                query=f"?scan_id=eq.{encoded_id}",
                prefer="return=representation",
            )
            return bool(isinstance(rows, list) and len(rows) > 0)
        except (urllib.error.URLError, urllib.error.HTTPError, TimeoutError, json.JSONDecodeError) as exc:
            logger.warning("Gagal menghapus scan dari Supabase, menggunakan fallback lokal: %s", exc)
            return self.fallback.delete_scan(scan_id)

    def clear_scans(self) -> int:
        try:
            rows, _ = self._request(
                "DELETE",
                query="?scan_id=neq.",
                prefer="return=representation",
            )
            return len(rows) if isinstance(rows, list) else 0
        except (urllib.error.URLError, urllib.error.HTTPError, TimeoutError, json.JSONDecodeError) as exc:
            logger.warning("Gagal mengosongkan riwayat di Supabase, menggunakan fallback lokal: %s", exc)
            return self.fallback.clear_scans()


def create_storage_service():
    """
    Memilih backend persistensi:
    - SupabaseScanStorage jika SUPABASE_URL dan SUPABASE_SERVICE_ROLE_KEY / SUPABASE_ANON_KEY tersedia.
    - LocalScanStorage sebagai fallback lokal/pengujian.
    """
    supabase_url = os.environ.get("SUPABASE_URL", "").strip()
    supabase_key = (
        os.environ.get("SUPABASE_SERVICE_ROLE_KEY", "").strip()
        or os.environ.get("SUPABASE_KEY", "").strip()
        or os.environ.get("SUPABASE_ANON_KEY", "").strip()
    )
    if supabase_url and supabase_key:
        return SupabaseScanStorage(supabase_url=supabase_url, supabase_key=supabase_key)
    return LocalScanStorage()


# Singleton instance bawaan untuk penggunaan global di router
storage_service = create_storage_service()
