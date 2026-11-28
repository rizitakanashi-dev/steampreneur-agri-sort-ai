"""
Repository harga (isu #42) — akses persistensi `price_observations` & `price_ingest_runs`.

Dua implementasi:
  * `InMemoryPriceRepository` — untuk test & dev tanpa DB; semantik upsert identik.
  * `SupabasePriceRepository` — PostgREST + service role key (SERVER-ONLY); hanya aktif
    ketika env `PRICE_DB_ENABLED` + `SUPABASE_URL` + service key tersedia dan migration
    `20261127000100_price_observations.sql` sudah diterapkan. Gagal koneksi tidak
    pernah melempar ke router — query service akan menjawab `unavailable`.

Semua upsert idempoten: unik pada (source_id, source_record_id) dan kunci logis.
"""

import hashlib
import json
import uuid
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional, Protocol

from server.models.price import PriceObservation


def payload_hash_of(record: Dict[str, Any]) -> str:
    """Hash kanonik rekaman untuk audit — tanpa kredensial, tanpa data personal."""
    canonical = json.dumps(record, sort_keys=True, default=str, separators=(",", ":"))
    return hashlib.sha256(canonical.encode("utf-8")).hexdigest()


class PriceRepository(Protocol):
    """Kontrak penyimpanan. Observasi idempoten; ingest run diaudit tanpa kredensial."""

    def upsert_observations(self, observations: List[Dict[str, Any]], run_id: str) -> int: ...

    def latest(
        self,
        commodity_id: str,
        price_type: str,
        region_level: str,
        region_code: Optional[str],
        source_id: Optional[str] = None,
    ) -> Optional[Dict[str, Any]]: ...

    def history(
        self,
        commodity_id: str,
        price_type: str,
        region_level: str,
        region_code: Optional[str],
        source_id: Optional[str] = None,
        from_date: Optional[str] = None,
        to_date: Optional[str] = None,
        limit: int = 90,
        cursor: Optional[str] = None,
    ) -> Dict[str, Any]: ...

    def record_ingest_run(self, source_id: str, status: str, notes: Optional[str] = None) -> str: ...

    def try_begin_ingest_run(self, source_id: str) -> Optional[str]: ...

    def last_success(self, source_id: str) -> Optional[Dict[str, Any]]: ...

    def last_failure(self, source_id: str) -> Optional[Dict[str, Any]]: ...


class InMemoryPriceRepository:
    """Penyimpanan sementara untuk test/dev. Semantik sama dengan versi DB."""

    def __init__(self) -> None:
        # Kunci idempotensi: (source_id, source_record_id)
        self._by_source_record: Dict[tuple, Dict[str, Any]] = {}
        self._runs: List[Dict[str, Any]] = []
        self._ingest_counts: Dict[str, int] = {}

    def upsert_observations(self, observations: List[Dict[str, Any]], run_id: str) -> int:
        inserted = 0
        for obs in observations:
            key = (obs["source_id"], obs["source_record_id"])
            if key in self._by_source_record:
                self._by_source_record[key] = {**obs, "ingest_run_id": run_id}
                continue
            self._by_source_record[key] = {**obs, "ingest_run_id": run_id}
            inserted += 1
        self._ingest_counts[run_id] = inserted
        return inserted

    def latest(
        self,
        commodity_id: str,
        price_type: str,
        region_level: str,
        region_code: Optional[str],
        source_id: Optional[str] = None,
    ) -> Optional[Dict[str, Any]]:
        candidates = [
            o
            for o in self._by_source_record.values()
            if o["commodity_id"] == commodity_id
            and o["price_type"] == price_type
            and o["region_level"] == region_level
            and (o.get("region_code") or None) == (region_code or None)
            and (source_id is None or o["source_id"] == source_id)
        ]
        if not candidates:
            return None
        candidates.sort(key=lambda o: o.get("observed_at") or "", reverse=True)
        return candidates[0]

    def history(
        self,
        commodity_id: str,
        price_type: str,
        region_level: str,
        region_code: Optional[str],
        source_id: Optional[str] = None,
        from_date: Optional[str] = None,
        to_date: Optional[str] = None,
        limit: int = 90,
        cursor: Optional[str] = None,
    ) -> Dict[str, Any]:
        rows = [
            o
            for o in self._by_source_record.values()
            if o["commodity_id"] == commodity_id
            and o["price_type"] == price_type
            and o["region_level"] == region_level
            and (o.get("region_code") or None) == (region_code or None)
            and (source_id is None or o["source_id"] == source_id)
        ]
        rows.sort(key=lambda o: o.get("observed_at") or "")
        if from_date:
            rows = [o for o in rows if (o.get("observed_at") or "") >= from_date]
        if to_date:
            rows = [o for o in rows if (o.get("observed_at") or "")[:10] <= to_date]
        start = 0
        if cursor:
            try:
                start = max(0, min(int(cursor), len(rows)))
            except ValueError:
                start = 0
        page = rows[start : start + limit]
        next_cursor = str(start + limit) if start + limit < len(rows) else None
        return {"rows": page, "next_cursor": next_cursor}

    def record_ingest_run(self, source_id: str, status: str, notes: Optional[str] = None) -> str:
        run_id = str(uuid.uuid4())
        self._runs.append(
            {
                "id": run_id,
                "source_id": source_id,
                "status": status,
                "started_at": datetime.now(timezone.utc).isoformat(),
                "notes": notes,
            }
        )
        return run_id

    def try_begin_ingest_run(self, source_id: str) -> Optional[str]:
        """Satu run 'running' per sumber — simulasi unique partial index migrasi #43."""
        for r in self._runs:
            if r["source_id"] == source_id and r["status"] == "running":
                return None
        return self.record_ingest_run(source_id, "running")

    def last_success(self, source_id: str) -> Optional[Dict[str, Any]]:
        successes = [
            r for r in self._runs if r["source_id"] == source_id and r["status"] == "success"
        ]
        if not successes:
            return None
        successes.sort(key=lambda r: r["started_at"], reverse=True)
        return successes[0]

    def last_failure(self, source_id: str) -> Optional[Dict[str, Any]]:
        failures = [
            r for r in self._runs if r["source_id"] == source_id and r["status"] == "failed"
        ]
        if not failures:
            return None
        failures.sort(key=lambda r: r["started_at"], reverse=True)
        return failures[0]


class SupabasePriceRepository:
    """
    PostgREST + service role key (SERVER-ONLY, tanpa kredensial di frontend).
    Mengikuti pola transport injectable `auth_service` agar bisa dites tanpa jaringan.
    """

    def __init__(
        self,
        supabase_url: str,
        service_role_key: str,
        transport: Optional[Any] = None,
    ) -> None:
        import urllib.request  # import lokal: hanya saat repositori DB benar-benar dipakai

        self._url = supabase_url.rstrip("/")
        self._key = service_role_key
        self._transport = transport or self._postgrest_request
        self._urllib = urllib.request

    def _headers(self) -> Dict[str, str]:
        return {
            "apikey": self._key,
            "Authorization": f"Bearer {self._key}",
            "Content-Type": "application/json",
            "Prefer": "resolution=merge-duplicates,return=representation",
        }

    def _postgrest_request(
        self,
        method: str,
        path: str,
        query: str,
        payload: Optional[List[Dict[str, Any]]] = None,
    ) -> List[Dict[str, Any]]:
        url = f"{self._url}/rest/v1/{path}{query}"
        data = json.dumps(payload).encode("utf-8") if payload is not None else None
        req = self._urllib.Request(url, data=data, headers=self._headers(), method=method)
        with self._urllib.urlopen(req, timeout=10) as response:
            body = response.read().decode("utf-8")
            return json.loads(body) if body else []

    def upsert_observations(self, observations: List[Dict[str, Any]], run_id: str) -> int:
        rows = []
        for obs in observations:
            row = {**obs, "ingest_run_id": run_id}
            row["payload_hash"] = row.get("payload_hash") or payload_hash_of(obs)
            rows.append(row)
        result = self._postgrest_request(
            "POST",
            "price_observations",
            "?on_conflict=source_id,source_record_id",
            rows,
        )
        return len(result)

    def latest(
        self,
        commodity_id: str,
        price_type: str,
        region_level: str,
        region_code: Optional[str],
        source_id: Optional[str] = None,
    ) -> Optional[Dict[str, Any]]:
        filters = [
            f"commodity_id=eq.{commodity_id}",
            f"price_type=eq.{price_type}",
            f"region_level=eq.{region_level}",
        ]
        if region_code:
            filters.append(f"region_code=eq.{region_code}")
        else:
            filters.append("region_code=is.null")
        if source_id:
            filters.append(f"source_id=eq.{source_id}")
        query = "?" + "&".join(filters) + "&order=observed_at.desc&limit=1"
        rows = self._postgrest_request("GET", "price_observations", query)
        return rows[0] if rows else None

    def history(
        self,
        commodity_id: str,
        price_type: str,
        region_level: str,
        region_code: Optional[str],
        source_id: Optional[str] = None,
        from_date: Optional[str] = None,
        to_date: Optional[str] = None,
        limit: int = 90,
        cursor: Optional[str] = None,
    ) -> Dict[str, Any]:
        filters = [
            f"commodity_id=eq.{commodity_id}",
            f"price_type=eq.{price_type}",
            f"region_level=eq.{region_level}",
        ]
        if region_code:
            filters.append(f"region_code=eq.{region_code}")
        else:
            filters.append("region_code=is.null")
        if source_id:
            filters.append(f"source_id=eq.{source_id}")
        if from_date:
            filters.append(f"observed_at=gte.{from_date}T00:00:00+07:00")
        if to_date:
            filters.append(f"observed_at=lte.{to_date}T23:59:59+07:00")
        query = "?" + "&".join(filters) + f"&order=observed_at.asc&limit={limit}"
        rows = self._postgrest_request("GET", "price_observations", query)
        return {"rows": rows, "next_cursor": None}

    def record_ingest_run(self, source_id: str, status: str, notes: Optional[str] = None) -> str:
        rows = self._postgrest_request(
            "POST", "price_ingest_runs", "", [{"source_id": source_id, "status": status, "notes": notes}]
        )
        return rows[0]["id"] if rows else str(uuid.uuid4())

    def try_begin_ingest_run(self, source_id: str) -> Optional[str]:
        """None = sudah ada run 'running' (single-flight DB level, migrasi #43)."""
        import urllib.error  # import lokal

        try:
            return self.record_ingest_run(source_id, "running")
        except urllib.error.HTTPError as exc:
            if exc.code in (400, 409):  # unique violation pada index partial
                return None
            raise

    def last_success(self, source_id: str) -> Optional[Dict[str, Any]]:
        query = f"?source_id=eq.{source_id}&status=eq.success&order=started_at.desc&limit=1"
        rows = self._postgrest_request("GET", "price_ingest_runs", query)
        return rows[0] if rows else None

    def last_failure(self, source_id: str) -> Optional[Dict[str, Any]]:
        query = f"?source_id=eq.{source_id}&status=eq.failed&order=started_at.desc&limit=1"
        rows = self._postgrest_request("GET", "price_ingest_runs", query)
        return rows[0] if rows else None


_shared_in_memory_repo: Optional[InMemoryPriceRepository] = None


def build_default_repository() -> PriceRepository:
    """
    Pilih repository sesuai env. DB belum diterapkan => fallback memori yang jujur.

    Fallback in-memory dibagi SATU instance per proses: hasil ingest (mis. cron
    refresh) harus terbaca oleh request baca berikutnya di proses yang sama.
    Production tetap wajib DB (Supabase) — in-memory hanya dev/demo.
    """
    import os

    if os.environ.get("PRICE_DB_ENABLED", "").strip().lower() in {"1", "true", "yes", "on"}:
        url = os.environ.get("SUPABASE_URL")
        key = os.environ.get("SUPABASE_SERVICE_ROLE_KEY")
        if url and key:
            return SupabasePriceRepository(url, key)
    global _shared_in_memory_repo
    if _shared_in_memory_repo is None:
        _shared_in_memory_repo = InMemoryPriceRepository()
    return _shared_in_memory_repo


# Antisipasi type-checker: PriceObservation dipakai oleh pemanggil untuk serialisasi
_ = PriceObservation
