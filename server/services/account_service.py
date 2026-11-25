'''Owner-scoped scan export and export-before-deletion account workflow.

The workflow is split in two layers: AccountWorkflow owns policy, validation,
integrity and audit ordering; ExportRepository implementations own local files
or Supabase REST/RPC. Scan bytes are always read with the caller token (RLS
owner scope). Service-role credentials are never used to read scan contents.
'''

from __future__ import annotations

from dataclasses import dataclass
from datetime import datetime, timedelta, timezone
import csv
import hashlib
import hmac
import io
import json
import os
from pathlib import Path
import re
import threading
from typing import Any, Dict, Iterable, List, Optional, Protocol, Tuple
import urllib.error
import urllib.parse
import urllib.request
import uuid
import zipfile

from server.config.auth_config import AuthProviderUnavailableError


EXPORT_SCHEMA_VERSION = 'scan-export-v1'
EXPORT_TTL_HOURS = 24
EXPORT_RECORD_TTL_DAYS = 30
MAX_EXPORT_ATTEMPTS = 3
EXPORT_RATE_LIMIT = 3
DELETE_CONFIRMATION = 'DELETE MY ACCOUNT'
WAIVER_CONFIRMATION = 'DELETE WITHOUT EXPORT'
ALLOWED_WAIVER_REASONS = frozenset({'user_choice', 'export_failed', 'no_scans'})
MAX_EXPORT_SCANS = 10000


class AccountWorkflowError(Exception):
    '''A safe, typed failure that the API can expose without internal detail.'''

    def __init__(self, code: str, message: str, status_code: int = 400):
        super().__init__(message)
        self.code = code
        self.message = message
        self.status_code = status_code


@dataclass(frozen=True)
class ExportRecord:
    id: str
    user_id: str
    state: str
    scan_count: int
    sha256: Optional[str]
    manifest: Dict[str, Any]
    storage_path: Optional[str] = None
    failure_reason: Optional[str] = None
    attempt_count: int = 0
    created_at: Optional[str] = None
    expires_at: Optional[str] = None
    ready_at: Optional[str] = None
    downloaded_at: Optional[str] = None
    consumed_at: Optional[str] = None
    snapshot_schema_version: Optional[str] = None
    snapshot_sha256: Optional[str] = None

    def public(self, download_url: Optional[str] = None) -> Dict[str, Any]:
        return {
            'export_id': self.id,
            'state': self.state,
            'scan_count': self.scan_count,
            'sha256': self.sha256,
            'snapshot_schema_version': self.snapshot_schema_version,
            'snapshot_sha256': self.snapshot_sha256,
            'created_at': self.created_at,
            'expires_at': self.expires_at,
            'downloaded_at': self.downloaded_at,
            'download_url': download_url,
        }


@dataclass(frozen=True)
class DownloadArtifact:
    content: Optional[bytes] = None
    filename: Optional[str] = None
    redirect_url: Optional[str] = None


class ExportRepository(Protocol):
    def load_scan_snapshot(self, user_id: str, access_token: str) -> Dict[str, Any]: ...
    def count_recent(self, user_id: str, since: datetime) -> int: ...
    def count_active(self, user_id: str) -> int: ...
    def has_failed_export(self, user_id: str) -> bool: ...
    def create_export(self, user_id: str, scan_count: int, sha256: str,
                      manifest: Dict[str, Any], artifact: bytes,
                      created_at: datetime, expires_at: datetime) -> Tuple[ExportRecord, str]: ...
    def get_export(self, export_id: str, user_id: Optional[str] = None) -> Optional[ExportRecord]: ...
    def mark_downloaded(self, export_id: str, user_id: str, access_token: str) -> ExportRecord: ...
    def download(self, export_id: str, user_id: str) -> DownloadArtifact: ...
    def delete_account(self, user_id: str, export_id: Optional[str],
                       allow_without_export: bool, waiver_reason_code: Optional[str],
                       access_token: str) -> Dict[str, Any]: ...
    def record_event(self, export_id: str, event_action: str,
                     reason_code: Optional[str] = None) -> None: ...


def _now() -> datetime:
    return datetime.now(timezone.utc)


def _iso(value: datetime) -> str:
    return value.astimezone(timezone.utc).isoformat().replace('+00:00', 'Z')


def _parse_iso(value: Any) -> Optional[datetime]:
    if not value:
        return None
    text = str(value)
    if text.endswith('Z'):
        text = text[:-1] + '+00:00'
    try:
        parsed = datetime.fromisoformat(text)
    except ValueError:
        return None
    if parsed.tzinfo is None:
        parsed = parsed.replace(tzinfo=timezone.utc)
    return parsed.astimezone(timezone.utc)


def _sha256_bytes(value: bytes) -> str:
    return hashlib.sha256(value).hexdigest()


def _canonical_json(value: Any) -> bytes:
    return json.dumps(value, sort_keys=True, separators=(',', ':'), ensure_ascii=False).encode('utf-8')


def _json_safe(value: Any) -> Any:
    if isinstance(value, dict):
        return {str(key): _json_safe(item) for key, item in value.items()}
    if isinstance(value, (list, tuple)):
        return [_json_safe(item) for item in value]
    if isinstance(value, datetime):
        return _iso(value)
    if isinstance(value, uuid.UUID):
        return str(value)
    if isinstance(value, (str, int, float, bool)) or value is None:
        return value
    return str(value)


def _csv_value(value: Any) -> str:
    if value is None:
        return ''
    if isinstance(value, (dict, list)):
        return json.dumps(_json_safe(value), ensure_ascii=False, sort_keys=True)
    return str(_json_safe(value))


def build_scan_snapshot(user_id: str, rows: Iterable[Dict[str, Any]]) -> Dict[str, Any]:
    '''Build a deterministic local snapshot for the local repository.

    Supabase uses public.rbac_scan_snapshot() instead; its digest is computed
    only inside PostgreSQL so Python and JSONB never compare different
    canonicalisations. This helper is for the local JSON fallback and tests.
    '''
    records = [_json_safe(row) for row in rows]
    for row in records:
        if row.get('user_id') != user_id:
            raise AccountWorkflowError('EXPORT_OWNER_MISMATCH',
                                       'Export input contains a scan owned by another user.', 403)
    records.sort(key=lambda row: (str(row.get('id') or ''), str(row.get('scan_id') or '')))
    payload = {
        'schema_version': EXPORT_SCHEMA_VERSION,
        'owner_id': user_id,
        'scan_count': len(records),
        'scans': records,
    }
    canonical = _canonical_json(payload)
    return {**payload, 'snapshot_sha256': _sha256_bytes(canonical),
            'snapshot_json': canonical.decode('utf-8')}


def build_export_artifact(user_id: str, rows: Iterable[Dict[str, Any]],
                          signing_key: bytes,
                          created_at: Optional[datetime] = None,
                          snapshot_sha256: Optional[str] = None,
                          snapshot_text: Optional[str] = None) -> Tuple[bytes, Dict[str, Any], str, int]:
    '''Build ZIP bytes, manifest, artifact SHA-256 and scan count.

    When snapshot_sha256 is supplied it must be the digest returned by the
    database snapshot function together with these exact rows. Local callers
    omit it and get a deterministic Python digest from build_scan_snapshot().
    '''
    if not signing_key:
        raise AccountWorkflowError('EXPORT_SIGNING_UNAVAILABLE', 'Export signing is not configured.', 503)
    records = [_json_safe(row) for row in rows]
    for row in records:
        if row.get('user_id') != user_id:
            raise AccountWorkflowError('EXPORT_OWNER_MISMATCH', 'Export input contains a scan owned by another user.', 403)
    if snapshot_sha256 is None:
        local_snapshot = build_scan_snapshot(user_id, records)
        snapshot_sha256 = local_snapshot['snapshot_sha256']
        snapshot_text = local_snapshot['snapshot_json']
    if not isinstance(snapshot_sha256, str) or not re.fullmatch(r'[0-9a-f]{64}', snapshot_sha256):
        raise AccountWorkflowError('EXPORT_SNAPSHOT_INVALID',
                                   'Export snapshot fingerprint is invalid.', 500)
    if snapshot_text is None:
        snapshot_text = build_scan_snapshot(user_id, records)['snapshot_json']
    if not isinstance(snapshot_text, str) or _sha256_bytes(snapshot_text.encode('utf-8')) != snapshot_sha256:
        raise AccountWorkflowError('EXPORT_SNAPSHOT_INVALID',
                                   'Export snapshot bytes do not match the fingerprint.', 500)
    created = created_at or _now()
    created_text = _iso(created)
    scans_json = (json.dumps(records, ensure_ascii=False, indent=2, sort_keys=True) + '\n').encode('utf-8')
    columns: List[str] = []
    for row in records:
        for key in row.keys():
            if key not in columns and key != 'recommendation_note':
                columns.append(key)
    if any('recommendation_note' in row for row in records):
        columns.append('recommendation_note')
    csv_buffer = io.StringIO()
    writer = csv.DictWriter(csv_buffer, fieldnames=columns or ['scan_id'],
                            extrasaction='ignore', lineterminator='\n')
    writer.writeheader()
    for row in records:
        writer.writerow({key: _csv_value(row.get(key)) for key in writer.fieldnames})
    scans_csv = csv_buffer.getvalue().encode('utf-8')
    readme = (
        'Agri-Sort AI scan export\n'
        f'Schema: {EXPORT_SCHEMA_VERSION}\n'
        f'User: {user_id}\n'
        f'Scans: {len(records)}\n'
        f'Created: {created_text}\n'
        f'Snapshot SHA-256: {snapshot_sha256}\n\n'
        'snapshot.json is the exact canonical snapshot whose SHA-256 is signed in manifest.json.\n'
        'This archive is the only copy of these private scans after account deletion.\n'
        'Verify every file against manifest.json before relying on this archive.\n'
    ).encode('utf-8')
    files: List[Tuple[str, bytes]] = [
        ('scans.json', scans_json),
        ('scans.csv', scans_csv),
        ('snapshot.json', snapshot_text.encode('utf-8')),
        ('README.txt', readme),
    ]
    manifest: Dict[str, Any] = {
        'schema_version': EXPORT_SCHEMA_VERSION,
        'created_at': created_text,
        'user_id': user_id,
        'scan_count': len(records),
        'snapshot': {
            'algorithm': 'sha256',
            'schema_version': EXPORT_SCHEMA_VERSION,
            'owner_id': user_id,
            'scan_count': len(records),
            'sha256': snapshot_sha256,
        },
        'files': [{'path': path, 'bytes': len(content), 'sha256': _sha256_bytes(content)}
                  for path, content in files],
    }
    manifest['signature'] = hmac.new(signing_key, _canonical_json(manifest), hashlib.sha256).hexdigest()
    manifest_bytes = (json.dumps(manifest, ensure_ascii=False, indent=2, sort_keys=True) + '\n').encode('utf-8')
    zip_buffer = io.BytesIO()
    with zipfile.ZipFile(zip_buffer, 'w', compression=zipfile.ZIP_DEFLATED) as archive:
        for path, content in [*files, ('manifest.json', manifest_bytes)]:
            info = zipfile.ZipInfo(path, date_time=(1980, 1, 1, 0, 0, 0))
            info.compress_type = zipfile.ZIP_DEFLATED
            info.external_attr = 0o600 << 16
            archive.writestr(info, content)
    artifact = zip_buffer.getvalue()
    return artifact, manifest, _sha256_bytes(artifact), len(records)


def verify_manifest_signature(manifest: Dict[str, Any], signing_key: bytes) -> bool:
    signature = manifest.get('signature')
    if not isinstance(signature, str):
        return False
    # export_id is assigned by the storage repository after signing, so it is
    # not part of the signed payload. Every content-bearing field is signed.
    unsigned = {key: value for key, value in manifest.items()
                if key not in {'signature', 'export_id'}}
    expected = hmac.new(signing_key, _canonical_json(unsigned), hashlib.sha256).hexdigest()
    return hmac.compare_digest(signature, expected)


def validate_manifest_snapshot(manifest: Dict[str, Any], signing_key: bytes,
                               user_id: str, scan_count: int) -> Dict[str, Any]:
    '''Verify the signed manifest and return its exact snapshot metadata.'''
    if not verify_manifest_signature(manifest, signing_key):
        raise AccountWorkflowError('EXPORT_MANIFEST_INVALID',
                                   'Export manifest signature is invalid.', 409)
    snapshot = manifest.get('snapshot')
    if not isinstance(snapshot, dict):
        raise AccountWorkflowError('EXPORT_SNAPSHOT_INVALID',
                                   'Export manifest has no snapshot integrity data.', 409)
    if snapshot.get('algorithm') != 'sha256':
        raise AccountWorkflowError('EXPORT_SNAPSHOT_INVALID',
                                   'Export snapshot algorithm is not supported.', 409)
    if snapshot.get('schema_version') != EXPORT_SCHEMA_VERSION:
        raise AccountWorkflowError('EXPORT_SNAPSHOT_INVALID',
                                   'Export snapshot schema is not supported.', 409)
    if snapshot.get('owner_id') != user_id or manifest.get('user_id') != user_id:
        raise AccountWorkflowError('EXPORT_OWNER_MISMATCH',
                                   'Export manifest belongs to another user.', 403)
    if (not isinstance(snapshot.get('scan_count'), int)
            or snapshot.get('scan_count') != scan_count
            or manifest.get('scan_count') != scan_count):
        raise AccountWorkflowError('EXPORT_SNAPSHOT_INVALID',
                                   'Export snapshot count is inconsistent.', 409)
    digest = snapshot.get('sha256')
    if not isinstance(digest, str) or not re.fullmatch(r'[0-9a-f]{64}', digest):
        raise AccountWorkflowError('EXPORT_SNAPSHOT_INVALID',
                                   'Export snapshot fingerprint is invalid.', 409)
    return snapshot


def _row_to_record(row: Dict[str, Any]) -> ExportRecord:
    manifest = row.get('manifest') or {}
    if isinstance(manifest, str):
        try:
            manifest = json.loads(manifest)
        except json.JSONDecodeError:
            manifest = {}
    def iso_field(name: str) -> Optional[str]:
        parsed = _parse_iso(row.get(name))
        return _iso(parsed) if parsed else None
    return ExportRecord(
        id=str(row.get('id')),
        user_id=str(row.get('user_id')),
        state=str(row.get('state')),
        scan_count=int(row.get('scan_count') or 0),
        sha256=row.get('sha256'),
        manifest=manifest if isinstance(manifest, dict) else {},
        storage_path=row.get('storage_path'),
        failure_reason=row.get('failure_reason'),
        attempt_count=int(row.get('attempt_count') or 0),
        created_at=iso_field('created_at'),
        expires_at=iso_field('expires_at'),
        ready_at=iso_field('ready_at'),
        downloaded_at=iso_field('downloaded_at'),
        consumed_at=iso_field('consumed_at'),
        snapshot_schema_version=(row.get('snapshot_schema_version')
                                 or (manifest.get('snapshot') or {}).get('schema_version')),
        snapshot_sha256=(row.get('snapshot_sha256')
                         or (manifest.get('snapshot') or {}).get('sha256')),
    )


class LocalExportRepository:
    '''File-backed repository for local development and disposable tests.'''

    def __init__(self, root: Path, scan_storage: Any, auth_service: Any):
        self.root = Path(root)
        self.artifacts = self.root / 'artifacts'
        self.index_path = self.root / 'index.json'
        self.audit_path = self.root / 'audit.jsonl'
        self.scan_storage = scan_storage
        self.auth_service = auth_service
        self._lock = threading.RLock()

    def _read_index(self) -> List[Dict[str, Any]]:
        if not self.index_path.exists():
            return []
        try:
            data = json.loads(self.index_path.read_text(encoding='utf-8'))
        except (OSError, json.JSONDecodeError) as exc:
            raise AccountWorkflowError('EXPORT_STORE_UNAVAILABLE', 'Export metadata is unreadable.', 503) from exc
        if not isinstance(data, list):
            raise AccountWorkflowError('EXPORT_STORE_UNAVAILABLE', 'Export metadata is invalid.', 503)
        return [item for item in data if isinstance(item, dict)]

    def _write_index(self, rows: List[Dict[str, Any]]) -> None:
        self.root.mkdir(parents=True, exist_ok=True)
        temp = self.index_path.with_suffix('.tmp')
        temp.write_text(json.dumps(rows, ensure_ascii=False, indent=2), encoding='utf-8')
        os.replace(temp, self.index_path)

    def _append_audit(self, action: str, user_id: str, metadata: Dict[str, Any]) -> None:
        self.root.mkdir(parents=True, exist_ok=True)
        entry = {'action': action, 'actor_user_id': user_id,
                 'created_at': _iso(_now()), 'metadata': metadata}
        with self._lock:
            with self.audit_path.open('a', encoding='utf-8') as handle:
                handle.write(json.dumps(entry, ensure_ascii=False, sort_keys=True) + '\n')

    def count_recent(self, user_id: str, since: datetime) -> int:
        with self._lock:
            count = 0
            for row in self._read_index():
                created = _parse_iso(row.get('created_at'))
                if row.get('user_id') == user_id and created is not None and created >= since:
                    count += 1
            return count

    def count_active(self, user_id: str) -> int:
        now = _now()
        with self._lock:
            return sum(1 for row in self._read_index()
                       if row.get('user_id') == user_id
                       and row.get('state') in {'pending', 'ready'}
                       and (_parse_iso(row.get('expires_at')) or now) > now)

    def has_failed_export(self, user_id: str) -> bool:
        with self._lock:
            return any(row.get('user_id') == user_id and row.get('state') == 'failed'
                       for row in self._read_index())

    def load_scan_snapshot(self, user_id: str, access_token: str) -> Dict[str, Any]:
        with self._lock:
            return build_scan_snapshot(user_id, self._all_scans(user_id, access_token))

    def create_export(self, user_id: str, scan_count: int, sha256: str,
                      manifest: Dict[str, Any], artifact: bytes,
                      created_at: datetime, expires_at: datetime) -> Tuple[ExportRecord, str]:
        export_id = str(uuid.uuid4())
        manifest = {**manifest, 'export_id': export_id}
        snapshot = manifest.get('snapshot') or {}
        storage_path = f'artifacts/{export_id}.zip'
        with self._lock:
            rows = self._read_index()
            stale = False
            for row in rows:
                expires = _parse_iso(row.get('expires_at'))
                if row.get('user_id') == user_id and row.get('state') in {'pending', 'ready'} \
                        and (expires is None or expires <= created_at):
                    row['state'] = 'expired'
                    stale = True
            if stale:
                self._write_index(rows)
            self.artifacts.mkdir(parents=True, exist_ok=True)
            artifact_path = self.root / storage_path
            temp = artifact_path.with_suffix('.tmp')
            temp.write_bytes(artifact)
            os.replace(temp, artifact_path)
            row = {
                'id': export_id, 'user_id': user_id, 'state': 'ready',
                'scan_count': scan_count, 'sha256': sha256, 'manifest': manifest,
                'storage_path': storage_path, 'failure_reason': None,
                'attempt_count': 1, 'created_at': _iso(created_at),
                'expires_at': _iso(expires_at), 'ready_at': _iso(created_at),
                'downloaded_at': None, 'consumed_at': None,
                'snapshot_schema_version': snapshot.get('schema_version'),
                'snapshot_sha256': snapshot.get('sha256'),
            }
            rows = self._read_index()
            rows.append(row)
            try:
                self._write_index(rows)
            except OSError:
                try:
                    artifact_path.unlink()
                except OSError:
                    pass
                raise AccountWorkflowError('EXPORT_STORE_UNAVAILABLE', 'Export metadata could not be saved.', 503)
        return _row_to_record(row), f'/api/v1/account/exports/{export_id}/download'

    def get_export(self, export_id: str, user_id: Optional[str] = None) -> Optional[ExportRecord]:
        with self._lock:
            for row in self._read_index():
                if row.get('id') == export_id and (user_id is None or row.get('user_id') == user_id):
                    return _row_to_record(row)
        return None

    def _update(self, export_id: str, **changes: Any) -> Dict[str, Any]:
        with self._lock:
            rows = self._read_index()
            for row in rows:
                if row.get('id') == export_id:
                    row.update(changes)
                    self._write_index(rows)
                    return row
        raise AccountWorkflowError('EXPORT_NOT_FOUND', 'Export not found.', 404)

    def mark_downloaded(self, export_id: str, user_id: str, access_token: str) -> ExportRecord:
        _ = access_token
        with self._lock:
            row = next((item for item in self._read_index()
                        if item.get('id') == export_id and item.get('user_id') == user_id), None)
            if not row:
                raise AccountWorkflowError('EXPORT_NOT_FOUND', 'Export not found for owner.', 404)
            if row.get('state') == 'downloaded' and row.get('downloaded_at'):
                return _row_to_record(row)
            expires = _parse_iso(row.get('expires_at'))
            if row.get('state') != 'ready' or not expires or expires <= _now():
                raise AccountWorkflowError('EXPORT_NOT_READY', 'Export is not ready or has expired.', 409)
            updated = self._update(export_id, state='downloaded', downloaded_at=_iso(_now()))
        self._append_audit('account.export_verified', user_id, {
            'export_id': export_id, 'scan_count': updated.get('scan_count'),
            'sha256': updated.get('sha256'), 'resource_type': 'account_export',
        })
        return _row_to_record(updated)

    def download(self, export_id: str, user_id: str) -> DownloadArtifact:
        with self._lock:
            row = next((item for item in self._read_index()
                        if item.get('id') == export_id and item.get('user_id') == user_id), None)
            if not row:
                raise AccountWorkflowError('EXPORT_NOT_FOUND', 'Export not found for owner.', 404)
            expires = _parse_iso(row.get('expires_at'))
            if row.get('state') not in {'ready', 'downloaded'} or not expires or expires <= _now():
                raise AccountWorkflowError('EXPORT_EXPIRED', 'Export is not available or has expired.', 410)
            root = self.root.resolve()
            path = (root / str(row.get('storage_path'))).resolve()
            if not path.is_relative_to(root) or path == root:
                raise AccountWorkflowError('EXPORT_ARTIFACT_MISSING', 'Export artifact is unavailable.', 503)
            try:
                content = path.read_bytes()
            except OSError as exc:
                raise AccountWorkflowError('EXPORT_ARTIFACT_MISSING', 'Export artifact is unavailable.', 503) from exc
            return DownloadArtifact(content=content, filename=f'agrisort-export-{export_id}.zip')

    def record_event(self, export_id: str, event_action: str,
                     reason_code: Optional[str] = None) -> None:
        row = self.get_export(export_id)
        if not row:
            raise AccountWorkflowError('EXPORT_NOT_FOUND', 'Export not found.', 404)
        metadata = {'export_id': export_id, 'scan_count': row.scan_count,
                    'sha256': row.sha256, 'resource_type': 'account_export'}
        if reason_code:
            metadata['reason_code'] = reason_code
        self._append_audit(event_action, row.user_id, metadata)

    def _all_scans(self, user_id: str, access_token: str) -> List[Dict[str, Any]]:
        rows: List[Dict[str, Any]] = []
        offset = 0
        while True:
            page = self.scan_storage.get_scans(limit=200, offset=offset, user_id=user_id,
                                                access_token=access_token)
            records = page.get('records') or []
            for record in records:
                if record.get('user_id') != user_id:
                    raise AccountWorkflowError('EXPORT_OWNER_MISMATCH',
                                               'Export input contains a scan owned by another user.', 403)
            if offset + len(records) > MAX_EXPORT_SCANS:
                raise AccountWorkflowError('EXPORT_TOO_LARGE', 'Too many scans for one export.', 413)
            rows.extend(records)
            total = int(page.get('total_count') or 0)
            offset += len(records)
            if not records or offset >= total:
                break
        return rows

    def delete_account(self, user_id: str, export_id: Optional[str],
                       allow_without_export: bool, waiver_reason_code: Optional[str],
                       access_token: str) -> Dict[str, Any]:
        with self._lock:
            snapshot = self.load_scan_snapshot(user_id, access_token)
            rows = snapshot['scans']
            scan_count = int(snapshot['scan_count'])
            if not allow_without_export:
                export = self.get_export(export_id or '', user_id)
                if not export:
                    raise AccountWorkflowError('EXPORT_NOT_FOUND', 'Export not found for owner.', 404)
                if export.state != 'downloaded' or not export.downloaded_at:
                    raise AccountWorkflowError('EXPORT_NOT_VERIFIED', 'Export must be downloaded and verified.', 409)
                expires = _parse_iso(export.expires_at)
                if not expires or expires <= _now():
                    raise AccountWorkflowError('EXPORT_EXPIRED', 'Export has expired.', 409)
                if (export.scan_count != scan_count
                        or export.snapshot_sha256 != snapshot['snapshot_sha256']):
                    raise AccountWorkflowError('EXPORT_STALE',
                                               'Export does not match the current exact scan snapshot.', 409)
            elif scan_count > 0 and not self.has_failed_export(user_id):
                raise AccountWorkflowError('WAIVER_NOT_ALLOWED',
                                           'Export cannot be skipped while scans exist and no export has failed.', 409)
            deleted = self.scan_storage.clear_scans(user_id=user_id, access_token=access_token)
            if deleted != scan_count:
                raise AccountWorkflowError('SCAN_DELETE_INCOMPLETE', 'Not all scans were deleted.', 503)
            try:
                auth_deleted = self.auth_service.delete_local_user(user_id)
            except Exception as exc:
                for row in rows:
                    try:
                        self.scan_storage.save_scan(row, user_id=user_id)
                    except Exception:
                        pass
                raise AccountWorkflowError('ACCOUNT_DELETE_FAILED', 'Account deletion failed.', 503) from exc
            if not auth_deleted:
                for row in rows:
                    try:
                        self.scan_storage.save_scan(row, user_id=user_id)
                    except Exception:
                        pass
                raise AccountWorkflowError('ACCOUNT_NOT_FOUND', 'Account not found.', 404)
            if export_id and not allow_without_export:
                self._update(export_id, state='consumed', consumed_at=_iso(_now()))
            if allow_without_export:
                self._append_audit('account.deletion_without_export', user_id, {
                    'reason_code': waiver_reason_code or 'user_choice', 'resource_type': 'user',
                })
            self._append_audit('account.deleted', user_id, {
                'export_id': export_id, 'scan_count': scan_count,
                'export_verified': not allow_without_export, 'resource_type': 'user',
            })
            return {'user_id': user_id, 'scan_count': scan_count,
                    'export_verified': not allow_without_export,
                    'without_export': bool(allow_without_export)}


class SupabaseExportRepository:
    '''Supabase REST/Storage/RPC repository using a server-only service role key.'''

    def __init__(self, supabase_url: str, service_role_key: str,
                 bucket: str = 'account-exports'):
        self.base_url = supabase_url.rstrip('/')
        self.service_key = service_role_key
        self.bucket = bucket

    def _request(self, method: str, path: str, body: Optional[Any] = None,
                 access_token: Optional[str] = None,
                 content_type: str = 'application/json', raw: bool = False) -> Any:
        token = access_token or self.service_key
        data: Optional[bytes] = None
        if body is not None:
            data = body if isinstance(body, bytes) else json.dumps(body).encode('utf-8')
        request = urllib.request.Request(
            f'{self.base_url}{path}', data=data, method=method,
            headers={'apikey': self.service_key, 'Authorization': f'Bearer {token}',
                     'Content-Type': content_type, 'Accept': 'application/json'},
        )
        try:
            with urllib.request.urlopen(request, timeout=20) as response:
                payload = response.read()
        except urllib.error.HTTPError as exc:
            exc.close()
            raise AccountWorkflowError('ACCOUNT_PROVIDER_REJECTED',
                                       'The account provider rejected the request.', 502) from exc
        except (urllib.error.URLError, TimeoutError) as exc:
            raise AccountWorkflowError('ACCOUNT_PROVIDER_UNAVAILABLE',
                                       'The account provider is unavailable.', 503) from exc
        if not payload:
            return None
        if raw:
            return payload
        try:
            return json.loads(payload.decode('utf-8'))
        except (UnicodeDecodeError, json.JSONDecodeError) as exc:
            raise AccountWorkflowError('ACCOUNT_PROVIDER_INVALID',
                                       'The account provider returned invalid data.', 502) from exc

    def _select_export(self, export_id: str,
                       user_id: Optional[str] = None) -> Optional[Dict[str, Any]]:
        query = (f'/rest/v1/account_exports?select=*&id=eq.'
                 f'{urllib.parse.quote(export_id)}&limit=1')
        if user_id:
            query += f'&user_id=eq.{urllib.parse.quote(user_id)}'
        rows = self._request('GET', query)
        return rows[0] if isinstance(rows, list) and rows else None

    def count_recent(self, user_id: str, since: datetime) -> int:
        query = ('/rest/v1/account_exports?select=id&user_id=eq.'
                 f'{urllib.parse.quote(user_id)}&created_at=gte.'
                 f'{urllib.parse.quote(_iso(since))}')
        rows = self._request('GET', query)
        return len(rows) if isinstance(rows, list) else 0

    def count_active(self, user_id: str) -> int:
        query = ('/rest/v1/account_exports?select=id&user_id=eq.'
                 f'{urllib.parse.quote(user_id)}&state=in.(pending,ready)'
                 f'&expires_at=gt.{urllib.parse.quote(_iso(_now()))}')
        rows = self._request('GET', query)
        return len(rows) if isinstance(rows, list) else 0

    def has_failed_export(self, user_id: str) -> bool:
        query = ('/rest/v1/account_exports?select=id&user_id=eq.'
                 f'{urllib.parse.quote(user_id)}&state=eq.failed&limit=1')
        rows = self._request('GET', query)
        return bool(rows)

    def _signed_url(self, storage_path: str, expires_in: int = 900) -> str:
        encoded = urllib.parse.quote(storage_path, safe='/')
        payload = self._request('POST',
                                f'/storage/v1/object/sign/{self.bucket}/{encoded}',
                                body={'expiresIn': expires_in})
        signed = (payload or {}).get('signedURL') or (payload or {}).get('signedUrl')
        if not signed:
            raise AccountWorkflowError('EXPORT_URL_FAILED', 'Could not create a download URL.', 503)
        if str(signed).startswith('http'):
            return str(signed)
        return f'{self.base_url}/storage/v1{str(signed)}'

    def load_scan_snapshot(self, user_id: str, access_token: str) -> Dict[str, Any]:
        if not access_token:
            raise AccountWorkflowError('EXPORT_SNAPSHOT_UNAVAILABLE',
                                       'A verified owner session is required for export.', 401)
        result = self._request('POST', '/rest/v1/rpc/rbac_api_scan_snapshot',
                               body={}, access_token=access_token)
        if not isinstance(result, dict):
            raise AccountWorkflowError('EXPORT_SNAPSHOT_UNAVAILABLE',
                                       'The scan snapshot service returned invalid data.', 502)
        scans = result.get('scans')
        digest = result.get('snapshot_sha256')
        snapshot_text = result.get('snapshot_json')
        if (result.get('schema_version') != EXPORT_SCHEMA_VERSION
                or result.get('owner_id') != user_id or not isinstance(scans, list)
                or result.get('scan_count') != len(scans)
                or not isinstance(digest, str) or not re.fullmatch(r'[0-9a-f]{64}', digest)
                or not isinstance(snapshot_text, str)
                or _sha256_bytes(snapshot_text.encode('utf-8')) != digest):
            raise AccountWorkflowError('EXPORT_SNAPSHOT_INVALID',
                                       'The scan snapshot is not bound to this owner.', 502)
        for row in scans:
            if not isinstance(row, dict) or row.get('user_id') != user_id:
                raise AccountWorkflowError('EXPORT_OWNER_MISMATCH',
                                           'Export input contains a scan owned by another user.', 403)
        try:
            canonical = json.loads(snapshot_text)
        except json.JSONDecodeError as exc:
            raise AccountWorkflowError('EXPORT_SNAPSHOT_INVALID',
                                       'The scan snapshot text is invalid.', 502) from exc
        if (not isinstance(canonical, dict)
                or canonical.get('schema_version') != EXPORT_SCHEMA_VERSION
                or canonical.get('owner_id') != user_id
                or canonical.get('scan_count') != len(scans)
                or canonical.get('scans') != scans):
            raise AccountWorkflowError('EXPORT_SNAPSHOT_INVALID',
                                       'The scan snapshot text does not match its rows.', 502)
        return result

    def create_export(self, user_id: str, scan_count: int, sha256: str,
                      manifest: Dict[str, Any], artifact: bytes,
                      created_at: datetime, expires_at: datetime) -> Tuple[ExportRecord, str]:
        export_id = str(uuid.uuid4())
        storage_path = f'{user_id}/{export_id}.zip'
        snapshot = manifest.get('snapshot') or {}
        encoded = urllib.parse.quote(storage_path, safe='/')
        manifest = {**manifest, 'export_id': export_id}
        stale_query = ('/rest/v1/account_exports?user_id=eq.'
                       f'{urllib.parse.quote(user_id)}&state=in.(pending,ready)'
                       f'&expires_at=lte.{urllib.parse.quote(_iso(created_at))}')
        self._request('PATCH', stale_query, body={'state': 'expired'})
        self._request('POST', f'/storage/v1/object/{self.bucket}/{encoded}',
                      body=artifact, content_type='application/zip', raw=True)
        row = {
            'id': export_id, 'user_id': user_id, 'state': 'ready',
            'scan_count': scan_count, 'sha256': sha256, 'manifest': manifest,
            'storage_path': storage_path, 'attempt_count': 1,
            'created_at': _iso(created_at), 'expires_at': _iso(expires_at),
            'ready_at': _iso(created_at),
            'snapshot_schema_version': snapshot.get('schema_version'),
            'snapshot_sha256': snapshot.get('sha256'),
        }
        try:
            result = self._request('POST', '/rest/v1/account_exports?select=*', body=[row])
        except AccountWorkflowError:
            self._delete_object(storage_path)
            raise
        record = _row_to_record(result[0] if isinstance(result, list) else row)
        try:
            self.record_event(export_id, 'account.export_created')
        except AccountWorkflowError:
            self._mark_failed(export_id, 'audit_write_failed')
            self._delete_object(storage_path)
            raise
        try:
            url = self._signed_url(storage_path)
        except AccountWorkflowError:
            self._mark_failed(export_id, 'download_url_failed')
            self._delete_object(storage_path)
            raise
        return record, url

    def _mark_failed(self, export_id: str, reason: str) -> None:
        try:
            self._request(
                'PATCH',
                f"/rest/v1/account_exports?id=eq.{urllib.parse.quote(export_id)}",
                body={'state': 'failed', 'failure_reason': reason[:500]},
            )
        except AccountWorkflowError:
            pass

    def _delete_object(self, storage_path: str) -> None:
        encoded = urllib.parse.quote(storage_path, safe='/')
        try:
            self._request('DELETE', f'/storage/v1/object/{self.bucket}/{encoded}')
        except AccountWorkflowError:
            pass

    def get_export(self, export_id: str, user_id: Optional[str] = None) -> Optional[ExportRecord]:
        row = self._select_export(export_id, user_id)
        return _row_to_record(row) if row else None

    def mark_downloaded(self, export_id: str, user_id: str, access_token: str) -> ExportRecord:
        self._request('POST', '/rest/v1/rpc/rbac_mark_export_downloaded',
                      body={'export_id': export_id}, access_token=access_token)
        record = self.get_export(export_id, user_id)
        if not record:
            raise AccountWorkflowError('EXPORT_NOT_FOUND', 'Export not found for owner.', 404)
        return record

    def download(self, export_id: str, user_id: str) -> DownloadArtifact:
        record = self.get_export(export_id, user_id)
        if not record:
            raise AccountWorkflowError('EXPORT_NOT_FOUND', 'Export not found for owner.', 404)
        expires = _parse_iso(record.expires_at)
        if record.state not in {'ready', 'downloaded'} or not expires or expires <= _now():
            raise AccountWorkflowError('EXPORT_EXPIRED', 'Export is not available or has expired.', 410)
        if not record.storage_path:
            raise AccountWorkflowError('EXPORT_ARTIFACT_MISSING', 'Export artifact is unavailable.', 503)
        return DownloadArtifact(redirect_url=self._signed_url(record.storage_path))

    def record_event(self, export_id: str, event_action: str,
                     reason_code: Optional[str] = None) -> None:
        payload: Dict[str, Any] = {'export_id': export_id, 'event_action': event_action}
        if reason_code:
            payload['failure_reason_code'] = reason_code
        self._request('POST', '/rest/v1/rpc/rbac_record_export_event', body=payload)

    def delete_account(self, user_id: str, export_id: Optional[str],
                       allow_without_export: bool, waiver_reason_code: Optional[str],
                       access_token: str) -> Dict[str, Any]:
        _ = access_token
        payload = {'target_user_id': user_id, 'export_id': export_id,
                   'allow_without_export': bool(allow_without_export),
                   'waiver_reason_code': waiver_reason_code}
        result = self._request('POST', '/rest/v1/rpc/rbac_delete_account', body=payload)
        return result if isinstance(result, dict) else {'user_id': user_id, 'deleted': True}


class AccountWorkflow:
    def __init__(self, repository: ExportRepository, scan_storage: Any,
                 signing_key: Optional[bytes] = None, auth_service: Any = None):
        self.repository = repository
        self.scan_storage = scan_storage
        self.signing_key = signing_key or b''
        self.auth_service = auth_service

    def _reauthenticate(self, user_id: str, email: Optional[str],
                        password: Optional[str]) -> None:
        '''Require a fresh password proof before irreversible deletion.'''
        if self.auth_service is None:
            return
        if not password:
            raise AccountWorkflowError('REAUTH_REQUIRED',
                                       'Confirm your password before deleting the account.', 401)
        if not email:
            raise AccountWorkflowError('REAUTH_UNAVAILABLE',
                                       'This account cannot be re-authenticated here.', 409)
        try:
            session = self.auth_service.login_gmail_user(email, password)
        except (AuthProviderUnavailableError, RuntimeError) as exc:
            raise AccountWorkflowError('ACCOUNT_PROVIDER_UNAVAILABLE',
                                       'Authentication is temporarily unavailable.', 503) from exc
        except Exception as exc:
            raise AccountWorkflowError('REAUTH_FAILED',
                                       'Password confirmation failed.', 401) from exc
        confirmed = (session or {}).get('user') or {}
        if confirmed.get('id') != user_id:
            raise AccountWorkflowError('REAUTH_FAILED',
                                       'Password confirmation failed.', 401)

    def _scan_count(self, user_id: str, access_token: str) -> int:
        page = self.scan_storage.get_scans(limit=1, offset=0, user_id=user_id,
                                            access_token=access_token)
        return int(page.get('total_count') or 0)

    def create_export(self, user_id: str, access_token: str) -> Dict[str, Any]:
        if not self.signing_key:
            raise AccountWorkflowError('EXPORT_SIGNING_UNAVAILABLE',
                                       'Export signing is not configured.', 503)
        now = _now()
        if self.repository.count_recent(user_id, now - timedelta(hours=1)) >= EXPORT_RATE_LIMIT:
            raise AccountWorkflowError('EXPORT_RATE_LIMITED',
                                       'Too many export attempts; retry later.', 429)
        if self.repository.count_active(user_id) >= 1:
            raise AccountWorkflowError('EXPORT_IN_PROGRESS', 'An active export already exists.', 409)
        snapshot = self.repository.load_scan_snapshot(user_id, access_token)
        rows = snapshot.get('scans') if isinstance(snapshot, dict) else None
        snapshot_sha256 = snapshot.get('snapshot_sha256') if isinstance(snapshot, dict) else None
        if (not isinstance(rows, list)
                or snapshot.get('schema_version') != EXPORT_SCHEMA_VERSION
                or snapshot.get('owner_id') != user_id
                or snapshot.get('scan_count') != len(rows)):
            raise AccountWorkflowError('EXPORT_SNAPSHOT_INVALID',
                                       'Export snapshot is not bound to this owner.', 502)
        if len(rows) > MAX_EXPORT_SCANS:
            raise AccountWorkflowError('EXPORT_TOO_LARGE', 'Too many scans for one export.', 413)
        last_error: Optional[Exception] = None
        for _ in range(MAX_EXPORT_ATTEMPTS):
            try:
                artifact, manifest, sha256, scan_count = build_export_artifact(
                    user_id, rows, self.signing_key, created_at=now,
                    snapshot_sha256=snapshot_sha256,
                    snapshot_text=snapshot.get('snapshot_json'))
                record, url = self.repository.create_export(
                    user_id, scan_count, sha256, manifest, artifact,
                    now, now + timedelta(hours=EXPORT_TTL_HOURS))
                check_manifest = {**record.manifest, 'export_id': record.id}
                validate_manifest_snapshot(check_manifest, self.signing_key, user_id, scan_count)
                if record.snapshot_sha256 != snapshot_sha256:
                    raise AccountWorkflowError('EXPORT_SNAPSHOT_INVALID',
                                               'Stored export snapshot does not match the database snapshot.', 500)
                return record.public(download_url=url)
            except AccountWorkflowError as exc:
                last_error = exc
                if exc.code in {'EXPORT_RATE_LIMITED', 'EXPORT_TOO_LARGE',
                                'EXPORT_SIGNING_UNAVAILABLE', 'EXPORT_SIGNATURE_INVALID'}:
                    raise
        raise AccountWorkflowError('EXPORT_FAILED',
                                   'Export could not be created; no artifact was published.', 503) from last_error

    def mark_downloaded(self, user_id: str, export_id: str,
                        access_token: str) -> Dict[str, Any]:
        record = self.repository.mark_downloaded(export_id, user_id, access_token)
        return record.public(download_url=f'/api/v1/account/exports/{export_id}/download')

    def download(self, user_id: str, export_id: str) -> DownloadArtifact:
        return self.repository.download(export_id, user_id)

    def delete_account(self, user_id: str, access_token: str, *, confirmation: str,
                       acknowledge_irreversible: bool, export_id: Optional[str],
                       allow_without_export: bool, waiver_phrase: Optional[str],
                       reason_code: Optional[str], email: Optional[str] = None,
                       reauth_password: Optional[str] = None) -> Dict[str, Any]:
        if confirmation != DELETE_CONFIRMATION:
            raise AccountWorkflowError('CONFIRMATION_MISMATCH',
                                       f'Type {DELETE_CONFIRMATION} exactly.', 400)
        if not acknowledge_irreversible:
            raise AccountWorkflowError('IRREVERSIBLE_NOT_ACKNOWLEDGED',
                                       'Account deletion is irreversible.', 400)
        self._reauthenticate(user_id, email, reauth_password)
        if allow_without_export:
            if waiver_phrase != WAIVER_CONFIRMATION:
                raise AccountWorkflowError('WAIVER_MISMATCH',
                                           f'Type {WAIVER_CONFIRMATION} exactly.', 400)
            if reason_code not in ALLOWED_WAIVER_REASONS:
                raise AccountWorkflowError('WAIVER_REASON_REQUIRED',
                                           'A valid waiver reason is required.', 400)
            current_count = self._scan_count(user_id, access_token)
            if current_count > 0 and not self.repository.has_failed_export(user_id):
                raise AccountWorkflowError(
                    'WAIVER_NOT_ALLOWED',
                    'Export cannot be skipped while scans exist and no export has failed.',
                    409,
                )
        else:
            if not export_id:
                raise AccountWorkflowError('EXPORT_REQUIRED',
                                           'Export or explicit waiver is required.', 400)
            try:
                uuid.UUID(export_id)
            except (ValueError, TypeError) as exc:
                raise AccountWorkflowError('EXPORT_NOT_FOUND',
                                           'Export not found for owner.', 404) from exc
            record = self.repository.get_export(export_id, user_id)
            if not record:
                raise AccountWorkflowError('EXPORT_NOT_FOUND',
                                           'Export not found for owner.', 404)
            if record.state != 'downloaded' or not record.downloaded_at:
                raise AccountWorkflowError('EXPORT_NOT_VERIFIED',
                                           'Export must be downloaded and verified.', 409)
            expires = _parse_iso(record.expires_at)
            if not expires or expires <= _now():
                raise AccountWorkflowError('EXPORT_EXPIRED', 'Export has expired.', 409)
            snapshot_meta = validate_manifest_snapshot(
                {**record.manifest, 'export_id': record.id}, self.signing_key,
                user_id, record.scan_count)
            if (record.snapshot_schema_version != snapshot_meta['schema_version']
                    or record.snapshot_sha256 != snapshot_meta['sha256']):
                raise AccountWorkflowError('EXPORT_SNAPSHOT_INVALID',
                                           'Stored export snapshot metadata is inconsistent.', 409)
        return self.repository.delete_account(user_id, export_id,
                                               allow_without_export,
                                               reason_code, access_token)


def create_account_workflow() -> AccountWorkflow:
    from server.config.auth_config import load_auth_config
    from server.services.auth_service import auth_service
    from server.services.storage_service import storage_service

    config = load_auth_config()
    signing_key = os.environ.get('EXPORT_HMAC_KEY', '').encode('utf-8')
    if len(signing_key) < 32:
        raise AccountWorkflowError(
            'ACCOUNT_WORKFLOW_UNAVAILABLE',
            'Account export requires EXPORT_HMAC_KEY with at least 32 bytes of entropy.',
            503,
        )
    if config.auth_mode == 'local':
        root = Path(__file__).resolve().parents[1] / 'data' / 'account_exports'
        repository: ExportRepository = LocalExportRepository(
            root, storage_service, auth_service)
    else:
        service_key = os.environ.get('SUPABASE_SERVICE_ROLE_KEY', '').strip()
        if not service_key:
            raise AccountWorkflowError('ACCOUNT_WORKFLOW_UNAVAILABLE',
                                       'Account deletion is unavailable until the server service key is configured.', 503)
        repository = SupabaseExportRepository(
            config.supabase_url, service_key,
            os.environ.get('SUPABASE_EXPORT_BUCKET', 'account-exports'))
    return AccountWorkflow(repository, storage_service, signing_key=signing_key,
                           auth_service=auth_service)