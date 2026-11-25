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


def _load_local_storage_config() -> None:
    """Load server-side Supabase settings from .env without overriding deployment env."""
    env_path = Path(__file__).resolve().parents[2] / ".env"
    try:
        with open(env_path, encoding="utf-8") as env_file:
            for raw_line in env_file:
                line = raw_line.strip()
                if not line or line.startswith("#") or "=" not in line:
                    continue
                key, value = line.split("=", 1)
                key = key.strip()
                if key in {"SUPABASE_URL", "SUPABASE_ANON_KEY"} and key not in os.environ:
                    os.environ[key] = value.strip().strip('"').strip("'")
    except OSError:
        pass


_load_local_storage_config()

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
    return """-- Scans schema and owner-only RLS policy migration.
-- This is a reviewed local/manual DDL artifact, not an automatic startup migration.
-- It preserves existing constraints and records, and aborts on unknown policies.
BEGIN;

CREATE TABLE IF NOT EXISTS public.scans (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES auth.users(id) ON DELETE RESTRICT,
    scan_id VARCHAR(64) NOT NULL,
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

-- Add only the ownership column when absent. Never reassign legacy rows.
ALTER TABLE public.scans ADD COLUMN IF NOT EXISTS user_id UUID;

DO $$
DECLARE expected_column record;
DECLARE fk_count integer;
DECLARE user_id_attnum smallint;
BEGIN
    FOR expected_column IN SELECT * FROM (VALUES
        ('id','uuid'), ('user_id','uuid'), ('scan_id','character varying'), ('commodity','character varying'),
        ('ai_supported','boolean'), ('actual_weight_kg','numeric'), ('total_objects','integer'),
        ('fresh_count','integer'), ('rotten_count','integer'), ('fresh_ratio_percent','numeric'),
        ('rotten_ratio_percent','numeric'), ('reference_price_per_kg','integer'),
        ('estimated_economic_value','bigint'), ('potential_loss_value','bigint'),
        ('recommendation_note','text'), ('is_simulated','boolean'), ('model_version','character varying'),
        ('created_at','timestamp with time zone'), ('updated_at','timestamp with time zone')
    ) AS columns(column_name, type_name)
    LOOP
        IF NOT EXISTS (
            SELECT 1 FROM pg_attribute a
            WHERE a.attrelid='public.scans'::regclass AND a.attname=expected_column.column_name
              AND a.atttypid=to_regtype(expected_column.type_name) AND NOT a.attisdropped
        ) THEN
            RAISE EXCEPTION 'scans migration stopped: public.scans.% must exist with type %', expected_column.column_name, expected_column.type_name;
        END IF;
    END LOOP;
    IF EXISTS (
        SELECT 1 FROM pg_attribute a
        WHERE a.attrelid='public.scans'::regclass AND a.attname IN
            ('id','scan_id','commodity','ai_supported','total_objects','fresh_count','rotten_count',
             'fresh_ratio_percent','rotten_ratio_percent','reference_price_per_kg','is_simulated','created_at','updated_at')
          AND NOT a.attnotnull AND NOT a.attisdropped
    ) OR NOT EXISTS (
        SELECT 1 FROM pg_constraint c
        WHERE c.conrelid='public.scans'::regclass AND c.contype='p'
          AND c.conkey=ARRAY[(SELECT attnum FROM pg_attribute WHERE attrelid='public.scans'::regclass AND attname='id' AND NOT attisdropped)]::smallint[]
    ) THEN
        RAISE EXCEPTION 'scans migration stopped: required NOT NULL columns or id primary key are incompatible';
    END IF;
    SELECT attnum INTO user_id_attnum FROM pg_attribute
    WHERE attrelid='public.scans'::regclass AND attname='user_id' AND NOT attisdropped;
    SELECT count(*) INTO fk_count FROM pg_constraint c
    WHERE c.conrelid = 'public.scans'::regclass AND c.contype = 'f'
      AND user_id_attnum = ANY(c.conkey);
    IF fk_count > 0 AND NOT EXISTS (
        SELECT 1 FROM pg_constraint c
        WHERE c.conrelid = 'public.scans'::regclass AND c.contype = 'f'
          AND c.conkey = ARRAY[user_id_attnum]::smallint[]
          AND c.confrelid = 'auth.users'::regclass
          AND c.confkey = ARRAY[(SELECT attnum FROM pg_attribute WHERE attrelid='auth.users'::regclass AND attname='id' AND NOT attisdropped)]::smallint[]
    ) THEN
        RAISE EXCEPTION 'scans migration stopped: existing user_id foreign key does not reference auth.users(id); inspect before reconciliation';
    END IF;
    IF fk_count = 0 THEN
        IF EXISTS (SELECT 1 FROM pg_constraint WHERE conrelid='public.scans'::regclass AND conname='scans_user_id_fkey') THEN
            RAISE EXCEPTION 'scans migration stopped: constraint name scans_user_id_fkey is already used; inspect before reconciliation';
        END IF;
        ALTER TABLE public.scans ADD CONSTRAINT scans_user_id_fkey
            FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE RESTRICT;
    END IF;
END;
$$;

-- Validate same-name indexes rather than trusting IF NOT EXISTS object names.
-- Existing constraints/indexes are preserved; incompatible names stop this transaction.
DO $$
DECLARE expected record;
DECLARE index_oid oid;
DECLARE actual_columns text[];
DECLARE actual_unique boolean;
DECLARE actual_valid boolean;
DECLARE actual_ready boolean;
DECLARE actual_predicate text;
DECLARE actual_method text;
DECLARE actual_keys text[];
DECLARE actual_options integer[];
BEGIN
    FOR expected IN SELECT * FROM (VALUES
        ('idx_scans_commodity', ARRAY['commodity']::text[], ARRAY['commodity']::text[], ARRAY[0]::integer[], false),
        ('idx_scans_created_at', ARRAY['created_at']::text[], ARRAY['created_at DESC']::text[], ARRAY[1]::integer[], false),
        ('idx_scans_scan_id', ARRAY['scan_id']::text[], ARRAY['scan_id']::text[], ARRAY[0]::integer[], false),
        ('idx_scans_user_created_at', ARRAY['user_id','created_at']::text[], ARRAY['user_id','created_at DESC']::text[], ARRAY[0,1]::integer[], false),
        ('idx_scans_user_scan_id', ARRAY['user_id','scan_id']::text[], ARRAY['user_id','scan_id']::text[], ARRAY[0,0]::integer[], true)
    ) AS expected(index_name, index_keys, create_keys, sort_options, is_unique)
    LOOP
        SELECT c.oid INTO index_oid FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
        WHERE n.nspname='public' AND c.relname=expected.index_name AND c.relkind='i';
        IF index_oid IS NULL THEN
            EXECUTE format('CREATE %s INDEX %I ON public.scans (%s)',
                CASE WHEN expected.is_unique THEN 'UNIQUE' ELSE '' END,
                expected.index_name, array_to_string(expected.create_keys, ', '));
        ELSE
            SELECT i.indisunique, i.indisvalid, i.indisready, pg_get_expr(i.indpred, i.indrelid), am.amname,
                   ARRAY(SELECT pg_get_indexdef(i.indexrelid, position, true)
                         FROM generate_series(1, i.indnkeyatts) AS position ORDER BY position),
                   ARRAY(SELECT (i.indoption[position - 1] & 1)::integer
                         FROM generate_series(1, i.indnkeyatts) AS position ORDER BY position)
              INTO actual_unique, actual_valid, actual_ready, actual_predicate, actual_method, actual_keys, actual_options
            FROM pg_index i JOIN pg_class table_class ON table_class.oid=i.indrelid
            JOIN pg_am am ON am.oid=(SELECT relam FROM pg_class WHERE oid=i.indexrelid)
            WHERE i.indexrelid=index_oid AND table_class.oid='public.scans'::regclass;
            IF NOT FOUND OR actual_unique IS DISTINCT FROM expected.is_unique
               OR NOT actual_valid OR NOT actual_ready OR actual_predicate IS NOT NULL
               OR actual_method <> 'btree' OR actual_keys IS DISTINCT FROM expected.index_keys
               OR actual_options IS DISTINCT FROM expected.sort_options THEN
                RAISE EXCEPTION 'scans migration stopped: index public.% has an incompatible definition (keys %, unique %, predicate %, method %)', expected.index_name, actual_keys, actual_unique, actual_predicate, actual_method;
            END IF;
            IF (SELECT indnatts <> indnkeyatts FROM pg_index WHERE indexrelid=index_oid) THEN
                RAISE EXCEPTION 'scans migration stopped: index public.% has unexpected included columns', expected.index_name;
            END IF;
        END IF;
        index_oid := NULL;
    END LOOP;
END;
$$;

ALTER TABLE public.scans ENABLE ROW LEVEL SECURITY;

DO $$
DECLARE p record;
BEGIN
    FOR p IN SELECT policyname, roles, cmd, qual, with_check FROM pg_policies
             WHERE schemaname='public' AND tablename='scans'
    LOOP
        IF p.policyname = 'Akses publik baca riwayat scan' THEN
            IF p.cmd <> 'SELECT' OR p.qual <> 'true' OR p.with_check IS NOT NULL OR p.roles <> ARRAY['public']::name[] THEN
                RAISE EXCEPTION 'scans migration stopped: legacy read policy has an unexpected definition';
            END IF;
            EXECUTE 'DROP POLICY "Akses publik baca riwayat scan" ON public.scans';
        ELSIF p.policyname = 'Akses publik simpan riwayat scan' THEN
            IF p.cmd <> 'INSERT' OR p.with_check <> 'true' OR p.qual IS NOT NULL OR p.roles <> ARRAY['public']::name[] THEN
                RAISE EXCEPTION 'scans migration stopped: legacy insert policy has an unexpected definition';
            END IF;
            EXECUTE 'DROP POLICY "Akses publik simpan riwayat scan" ON public.scans';
        ELSIF p.policyname = 'Users read own scan history' THEN
            IF p.cmd <> 'SELECT' OR p.qual <> '(auth.uid() = user_id)' OR p.with_check IS NOT NULL OR p.roles <> ARRAY['authenticated']::name[] THEN
                RAISE EXCEPTION 'scans migration stopped: owner SELECT policy has an unexpected definition';
            END IF;
        ELSIF p.policyname = 'Users insert own scan history' THEN
            IF p.cmd <> 'INSERT' OR p.qual IS NOT NULL OR p.with_check <> '(auth.uid() = user_id)' OR p.roles <> ARRAY['authenticated']::name[] THEN
                RAISE EXCEPTION 'scans migration stopped: owner INSERT policy has an unexpected definition';
            END IF;
        ELSIF p.policyname = 'Users update own scan history' THEN
            IF p.cmd <> 'UPDATE' OR p.qual <> '(auth.uid() = user_id)' OR p.with_check <> '(auth.uid() = user_id)' OR p.roles <> ARRAY['authenticated']::name[] THEN
                RAISE EXCEPTION 'scans migration stopped: owner UPDATE policy has an unexpected definition';
            END IF;
        ELSIF p.policyname = 'Users delete own scan history' THEN
            IF p.cmd <> 'DELETE' OR p.qual <> '(auth.uid() = user_id)' OR p.with_check IS NOT NULL OR p.roles <> ARRAY['authenticated']::name[] THEN
                RAISE EXCEPTION 'scans migration stopped: owner DELETE policy has an unexpected definition';
            END IF;
        ELSE
            RAISE EXCEPTION 'scans migration stopped: unrecognized existing scans policy "%"; inspect before reconciliation', p.policyname;
        END IF;
    END LOOP;

    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='scans' AND policyname='Users read own scan history') THEN
        EXECUTE 'CREATE POLICY "Users read own scan history" ON public.scans FOR SELECT TO authenticated USING (auth.uid() = user_id)';
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='scans' AND policyname='Users insert own scan history') THEN
        EXECUTE 'CREATE POLICY "Users insert own scan history" ON public.scans FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id)';
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='scans' AND policyname='Users update own scan history') THEN
        EXECUTE 'CREATE POLICY "Users update own scan history" ON public.scans FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id)';
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='scans' AND policyname='Users delete own scan history') THEN
        EXECUTE 'CREATE POLICY "Users delete own scan history" ON public.scans FOR DELETE TO authenticated USING (auth.uid() = user_id)';
    END IF;
END;
$$;

COMMIT;
"""


_SUPABASE_SCAN_COLUMNS = (
    "id",
    "user_id",
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


def _normalize_scan_record(scan_data: Dict[str, Any], user_id: Optional[str] = None) -> Dict[str, Any]:
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
        "user_id": user_id or scan_data.get("user_id"),
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

    def save_scan(self, scan_data: Dict[str, Any], user_id: Optional[str] = None, access_token: Optional[str] = None) -> Dict[str, Any]:
        """
        Menyimpan hasil pemindaian ke storage lokal.
        Menghasilkan scan_id dan created_at otomatis jika belum tersedia.
        """
        with _storage_lock:
            records = self._read_all()
            record = _normalize_scan_record(scan_data, user_id=user_id)

            # Masukkan di awal daftar (urutan terbaru di atas)
            # Jika scan_id sudah ada, perbarui record lama
            existing_idx = next(
                (
                    i
                    for i, existing in enumerate(records)
                    if existing.get("scan_id") == record["scan_id"]
                    and existing.get("user_id") == record.get("user_id")
                ),
                None,
            )
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
        user_id: Optional[str] = None,
        access_token: Optional[str] = None,
    ) -> Dict[str, Any]:
        """
        Mengambil daftar riwayat scan dengan fitur filter komoditas dan paginasi.
        """
        with _storage_lock:
            records = self._read_all()
            if user_id:
                records = [r for r in records if r.get("user_id") == user_id]

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

    def get_scan_by_id(self, scan_id: str, user_id: Optional[str] = None, access_token: Optional[str] = None) -> Optional[Dict[str, Any]]:
        """Mencari satu catatan pemindaian berdasarkan scan_id."""
        with _storage_lock:
            records = self._read_all()
            return next((r for r in records if r.get("scan_id") == scan_id and (not user_id or r.get("user_id") == user_id)), None)

    def delete_scan(self, scan_id: str, user_id: Optional[str] = None, access_token: Optional[str] = None) -> bool:
        """Menghapus satu catatan pemindaian berdasarkan scan_id."""
        with _storage_lock:
            records = self._read_all()
            initial_len = len(records)
            filtered = [r for r in records if r.get("scan_id") != scan_id or (user_id and r.get("user_id") != user_id)]
            if len(filtered) < initial_len:
                self._write_all(filtered)
                return True
            return False

    def clear_scans(self, user_id: Optional[str] = None, access_token: Optional[str] = None) -> int:
        """Mengosongkan riwayat pemindaian untuk pengguna tertentu."""
        with _storage_lock:
            records = self._read_all()
            if user_id:
                remaining = [record for record in records if record.get("user_id") != user_id]
                count = len(records) - len(remaining)
                self._write_all(remaining)
            else:
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
        base = supabase_url.strip().rstrip("/")
        if base.endswith("/rest/v1"):
            base = base[: -len("/rest/v1")]
        self.base_url = base
        self.api_key = supabase_key
        self.fallback = fallback or LocalScanStorage()
        self.timeout_seconds = timeout_seconds

    def _request(
        self,
        method: str,
        query: str = "",
        payload: Optional[Any] = None,
        prefer: Optional[str] = None,
        access_token: Optional[str] = None,
    ) -> tuple[Any, Dict[str, str]]:
        url = f"{self.base_url}/rest/v1/scans{query}"
        headers = {
            "apikey": self.api_key,
            "Content-Type": "application/json",
        }
        # New Supabase opaque keys (sb_secret_ / sb_publishable_) are not JWTs and must NOT be sent as Bearer tokens
        if access_token:
            headers["Authorization"] = f"Bearer {access_token}"
        elif not self.api_key.startswith(("sb_secret_", "sb_publishable_")):
            headers["Authorization"] = f"Bearer {self.api_key}"
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

    def save_scan(self, scan_data: Dict[str, Any], user_id: Optional[str] = None, access_token: Optional[str] = None) -> Dict[str, Any]:
        record = _normalize_scan_record(scan_data, user_id=user_id)
        db_row = self._to_db_row(record)
        try:
            rows, _ = self._request(
                "POST",
                query="?on_conflict=user_id,scan_id",
                payload=db_row,
                prefer="resolution=merge-duplicates,return=representation",
                access_token=access_token,
            )
            if isinstance(rows, list) and rows:
                return self._from_db_row(rows[0])
            return record
        except (urllib.error.URLError, urllib.error.HTTPError, TimeoutError, json.JSONDecodeError) as exc:
            if access_token:
                raise RuntimeError("Penyimpanan riwayat gagal; data tidak disimpan.") from exc
            logger.warning("Gagal menyimpan ke Supabase, menggunakan fallback lokal: %s", exc)
            return self.fallback.save_scan(scan_data, user_id=user_id)

    def get_scans(
        self,
        limit: int = 50,
        offset: int = 0,
        commodity: Optional[str] = None,
        user_id: Optional[str] = None,
        access_token: Optional[str] = None,
    ) -> Dict[str, Any]:
        filter_q = ""
        if commodity:
            encoded_comm = urllib.parse.quote(commodity.strip(), safe="")
            filter_q = f"&commodity=ilike.{encoded_comm}"
        if user_id:
            encoded_user = urllib.parse.quote(user_id, safe="")
            filter_q += f"&user_id=eq.{encoded_user}"

        try:
            rows, headers = self._request(
                "GET",
                query=f"?select=*&order=created_at.desc&limit={int(limit)}&offset={int(offset)}{filter_q}",
                prefer="count=exact",
                access_token=access_token,
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
                access_token=access_token,
            )
            return {
                "total_count": total_count,
                "offset": offset,
                "limit": limit,
                "records": paged_records,
                "summary": _build_scans_summary(agg_rows or [], total_count=total_count),
            }
        except (urllib.error.URLError, urllib.error.HTTPError, TimeoutError, json.JSONDecodeError) as exc:
            if access_token:
                raise RuntimeError("Riwayat gagal diambil dari penyimpanan terverifikasi.") from exc
            logger.warning("Gagal membaca riwayat dari Supabase, menggunakan fallback lokal: %s", exc)
            return self.fallback.get_scans(limit=limit, offset=offset, commodity=commodity, user_id=user_id)

    def get_scan_by_id(self, scan_id: str, user_id: Optional[str] = None, access_token: Optional[str] = None) -> Optional[Dict[str, Any]]:
        try:
            encoded_id = urllib.parse.quote(scan_id, safe="")
            owner_filter = f"&user_id=eq.{urllib.parse.quote(user_id, safe='')}" if user_id else ""
            rows, _ = self._request("GET", query=f"?select=*&scan_id=eq.{encoded_id}{owner_filter}&limit=1", access_token=access_token)
            if isinstance(rows, list) and rows:
                return self._from_db_row(rows[0])
            return None
        except (urllib.error.URLError, urllib.error.HTTPError, TimeoutError, json.JSONDecodeError) as exc:
            if access_token:
                raise RuntimeError("Riwayat gagal diambil dari penyimpanan terverifikasi.") from exc
            logger.warning("Gagal mengambil scan_id dari Supabase, menggunakan fallback lokal: %s", exc)
            return self.fallback.get_scan_by_id(scan_id, user_id=user_id)

    def delete_scan(self, scan_id: str, user_id: Optional[str] = None, access_token: Optional[str] = None) -> bool:
        try:
            encoded_id = urllib.parse.quote(scan_id, safe="")
            owner_filter = f"&user_id=eq.{urllib.parse.quote(user_id, safe='')}" if user_id else ""
            rows, _ = self._request(
                "DELETE",
                query=f"?scan_id=eq.{encoded_id}{owner_filter}",
                prefer="return=representation",
                access_token=access_token,
            )
            return bool(isinstance(rows, list) and len(rows) > 0)
        except (urllib.error.URLError, urllib.error.HTTPError, TimeoutError, json.JSONDecodeError) as exc:
            if access_token:
                raise RuntimeError("Riwayat gagal dihapus dari penyimpanan terverifikasi.") from exc
            logger.warning("Gagal menghapus scan dari Supabase, menggunakan fallback lokal: %s", exc)
            return self.fallback.delete_scan(scan_id, user_id=user_id)

    def clear_scans(self, user_id: Optional[str] = None, access_token: Optional[str] = None) -> int:
        try:
            if user_id:
                query = f"?user_id=eq.{urllib.parse.quote(user_id, safe='')}"
            else:
                query = "?scan_id=neq."
            rows, _ = self._request(
                "DELETE",
                query=query,
                prefer="return=representation",
                access_token=access_token,
            )
            return len(rows) if isinstance(rows, list) else 0
        except (urllib.error.URLError, urllib.error.HTTPError, TimeoutError, json.JSONDecodeError) as exc:
            if access_token:
                raise RuntimeError("Riwayat gagal dihapus dari penyimpanan terverifikasi.") from exc
            logger.warning("Gagal mengosongkan riwayat di Supabase, menggunakan fallback lokal: %s", exc)
            return self.fallback.clear_scans(user_id=user_id)


def create_storage_service():
    """
    Memilih backend persistensi:
    - SupabaseScanStorage jika SUPABASE_URL dan SUPABASE_ANON_KEY tersedia.
    - LocalScanStorage sebagai fallback lokal/pengujian.
    """
    supabase_url = os.environ.get("SUPABASE_URL", "").strip()
    supabase_key = os.environ.get("SUPABASE_ANON_KEY", "").strip()
    if supabase_url and supabase_key:
        return SupabaseScanStorage(supabase_url=supabase_url, supabase_key=supabase_key)
    return LocalScanStorage()


# Singleton instance bawaan untuk penggunaan global di router
storage_service = create_storage_service()
