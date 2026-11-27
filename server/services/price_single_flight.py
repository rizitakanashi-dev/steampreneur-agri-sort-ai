"""
Single-flight refresh per sumber (isu #43).

Dua implementasi:
  * `InMemorySingleFlight` — untuk repository memori (test/dev, satu proses).
  * `RepositorySingleFlight` — lewat `price_ingest_runs` status='running' dengan
    unique partial index (migrasi #43) => level DATABASE, aman lintas instance Vercel.

Kontrak: `acquire(source_id)` mengembalikan (run_id, acquired: bool); pemegang
yang gagal memperoleh lock tidak boleh memanggil provider.
"""

import uuid
from typing import Dict, Optional


class InMemorySingleFlight:
    def __init__(self) -> None:
        self._active: Dict[str, str] = {}

    def acquire(self, source_id: str) -> tuple:
        if source_id in self._active:
            return self._active[source_id], False
        run_id = str(uuid.uuid4())
        self._active[source_id] = run_id
        return run_id, True

    def release(self, source_id: str) -> None:
        self._active.pop(source_id, None)


class RepositorySingleFlight:
    """Menggunakan upsert `price_ingest_runs(status='running')` + unique partial index."""

    def __init__(self, repository) -> None:
        self._repo = repository

    def acquire(self, source_id: str) -> tuple:
        run_id = self._repo.try_begin_ingest_run(source_id)
        if run_id is None:
            return None, False
        return run_id, True

    def release(self, source_id: str) -> None:
        # Ditangani oleh record_ingest_run(status=...) — tidak perlu aksi eksplisit.
        return None
