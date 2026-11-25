'''Unit tests for scan export integrity and export-before-deletion policy.'''

from datetime import datetime, timedelta, timezone
import io
import json
from pathlib import Path
import tempfile
import types
import unittest
import uuid
import zipfile

from server.services.account_service import (
    AccountWorkflow,
    AccountWorkflowError,
    DownloadArtifact,
    ExportRecord,
    LocalExportRepository,
    SupabaseExportRepository,
    build_export_artifact,
    verify_manifest_signature,
)

UTC = timezone.utc
KEY = b'test-signing-key'
USER = '00000000-0000-0000-0000-000000000001'
OTHER = '00000000-0000-0000-0000-000000000002'


def _row(scan_id: str, user_id: str = USER, **extra):
    row = {'scan_id': scan_id, 'user_id': user_id, 'commodity': 'Tomat',
           'grade': 'A', 'recommendation_note': 'Simpan di tempat sejuk'}
    row.update(extra)
    return row


class FakeScanStorage:
    def __init__(self, rows):
        self.rows = list(rows)
        self.calls = []

    def get_scans(self, limit=50, offset=0, commodity=None, user_id=None,
                  access_token=None):
        self.calls.append({'limit': limit, 'offset': offset, 'user_id': user_id,
                           'access_token': access_token})
        rows = [r for r in self.rows if not user_id or r.get('user_id') == user_id]
        return {'records': rows[offset:offset + limit], 'total_count': len(rows)}

    def clear_scans(self, user_id=None, access_token=None):
        before = len(self.rows)
        self.rows = [r for r in self.rows if user_id and r.get('user_id') != user_id]
        return before - len(self.rows)

    def save_scan(self, record, user_id=None, access_token=None):
        self.rows.append({**record, 'user_id': user_id or record.get('user_id')})
        return record


class FakeAuth:
    def __init__(self):
        self.deleted = []
        self.fail = False
        self.exists = True

    def local_user_exists(self, user_id):
        return self.exists

    def delete_local_user(self, user_id):
        if self.fail:
            raise RuntimeError('auth store unavailable')
        if not self.exists:
            return False
        self.deleted.append(user_id)
        self.exists = False
        return True


class FakeRepo:
    def __init__(self):
        self.records = {}
        self.events = []
        self.deleted = None
        self.recent = 0
        self.active = 0
        self.failed = False

    def count_recent(self, user_id, since):
        return self.recent

    def count_active(self, user_id):
        return self.active

    def has_failed_export(self, user_id):
        return self.failed

    def create_export(self, user_id, scan_count, sha256, manifest, artifact,
                      created_at, expires_at):
        export_id = str(uuid.uuid4())
        signed = {**manifest, 'export_id': export_id}
        record = ExportRecord(
            id=export_id, user_id=user_id, state='ready', scan_count=scan_count,
            sha256=sha256, manifest=signed, storage_path='memory',
            created_at=created_at.isoformat(), expires_at=expires_at.isoformat(),
            ready_at=created_at.isoformat(), attempt_count=1)
        self.records[export_id] = record
        self.events.append('account.export_created')
        return record, f'/api/v1/account/exports/{export_id}/download'

    def get_export(self, export_id, user_id=None):
        record = self.records.get(export_id)
        if record and (user_id is None or record.user_id == user_id):
            return record
        return None

    def mark_downloaded(self, export_id, user_id, access_token):
        record = self.get_export(export_id, user_id)
        if not record:
            raise AccountWorkflowError('EXPORT_NOT_FOUND', 'not found', 404)
        updated = ExportRecord(**{**record.__dict__, 'state': 'downloaded',
                                  'downloaded_at': datetime.now(UTC).isoformat()})
        self.records[export_id] = updated
        return updated

    def download(self, export_id, user_id):
        if not self.get_export(export_id, user_id):
            raise AccountWorkflowError('EXPORT_NOT_FOUND', 'not found', 404)
        return DownloadArtifact(content=b'zip', filename='export.zip')

    def delete_account(self, user_id, export_id, allow_without_export,
                       waiver_reason_code, access_token):
        self.deleted = {'user_id': user_id, 'export_id': export_id,
                        'allow_without_export': allow_without_export,
                        'reason_code': waiver_reason_code}
        return {'user_id': user_id, 'scan_count': 0,
                'export_verified': not allow_without_export,
                'without_export': allow_without_export}

    def record_event(self, export_id, event_action, reason_code=None):
        self.events.append(event_action)


class AccountExportIntegrityTests(unittest.TestCase):
    def test_zip_contains_signed_manifest_and_all_owner_files(self):
        created = datetime(2026, 1, 1, tzinfo=UTC)
        artifact, manifest, sha256, count = build_export_artifact(
            USER, [_row('s1'), _row('s2')], KEY, created)
        self.assertEqual(count, 2)
        self.assertEqual(sha256, __import__('hashlib').sha256(artifact).hexdigest())
        self.assertTrue(verify_manifest_signature(manifest, KEY))
        with zipfile.ZipFile(io.BytesIO(artifact)) as archive:
            self.assertEqual(sorted(archive.namelist()),
                             ['README.txt', 'manifest.json', 'scans.csv', 'scans.json'])
            stored = json.loads(archive.read('manifest.json'))
            self.assertTrue(verify_manifest_signature(stored, KEY))
            self.assertEqual(len(stored['files']), 3)
            for item in stored['files']:
                content = archive.read(item['path'])
                self.assertEqual(__import__('hashlib').sha256(content).hexdigest(), item['sha256'])
            rows = json.loads(archive.read('scans.json'))
            self.assertEqual([r['scan_id'] for r in rows], ['s1', 's2'])
            self.assertIn('scan_id,user_id,commodity,grade,recommendation_note',
                          archive.read('scans.csv').decode('utf-8').splitlines()[0])

    def test_foreign_scan_is_rejected(self):
        with self.assertRaises(AccountWorkflowError) as caught:
            build_export_artifact(USER, [_row('s1'), _row('s2', user_id=OTHER)], KEY)
        self.assertEqual(caught.exception.code, 'EXPORT_OWNER_MISMATCH')

    def test_signature_detects_manifest_tampering(self):
        _, manifest, _, _ = build_export_artifact(USER, [_row('s1')], KEY)
        tampered = {**manifest, 'scan_count': 99}
        self.assertFalse(verify_manifest_signature(tampered, KEY))
        self.assertFalse(verify_manifest_signature(manifest, b'wrong-key'))


class AccountWorkflowTests(unittest.TestCase):
    def setUp(self):
        self.storage = FakeScanStorage([_row('s1'), _row('s2')])
        self.repo = FakeRepo()
        self.workflow = AccountWorkflow(self.repo, self.storage, signing_key=KEY)

    def test_create_export_reads_only_owner_scope_and_verifies_manifest(self):
        result = self.workflow.create_export(USER, 'token')
        self.assertEqual(result['scan_count'], 2)
        self.assertTrue(result['download_url'].endswith('/download'))
        self.assertTrue(self.storage.calls)
        self.assertTrue(all(call['user_id'] == USER for call in self.storage.calls))
        self.assertTrue(all(call['access_token'] == 'token' for call in self.storage.calls))
        stored = self.repo.records[result['export_id']]
        self.assertTrue(verify_manifest_signature(stored.manifest, KEY))

    def test_create_export_rejects_rate_limit_and_active_export(self):
        self.repo.recent = 3
        with self.assertRaises(AccountWorkflowError) as caught:
            self.workflow.create_export(USER, 'token')
        self.assertEqual(caught.exception.code, 'EXPORT_RATE_LIMITED')
        self.repo.recent = 0
        self.repo.active = 1
        with self.assertRaises(AccountWorkflowError) as caught:
            self.workflow.create_export(USER, 'token')
        self.assertEqual(caught.exception.code, 'EXPORT_IN_PROGRESS')

    def test_mark_downloaded_is_owner_scoped(self):
        created = self.workflow.create_export(USER, 'token')
        marked = self.workflow.mark_downloaded(USER, created['export_id'], 'token')
        self.assertEqual(marked['state'], 'downloaded')
        with self.assertRaises(AccountWorkflowError) as caught:
            self.workflow.mark_downloaded(OTHER, created['export_id'], 'token')
        self.assertEqual(caught.exception.code, 'EXPORT_NOT_FOUND')

    def _downloaded_record(self, scan_count=2, user_id=USER):
        export_id = str(uuid.uuid4())
        record = ExportRecord(
            id=export_id, user_id=user_id, state='downloaded', scan_count=scan_count,
            sha256='a' * 64, manifest={'schema_version': 'scan-export-v1'},
            downloaded_at=datetime.now(UTC).isoformat(),
            expires_at=(datetime.now(UTC) + timedelta(hours=1)).isoformat())
        self.repo.records[export_id] = record
        return export_id

    def test_delete_requires_exact_typed_confirmation_and_acknowledgement(self):
        export_id = self._downloaded_record()
        with self.assertRaises(AccountWorkflowError) as caught:
            self.workflow.delete_account(USER, 'token', confirmation='delete my account',
                                         acknowledge_irreversible=True, export_id=export_id,
                                         allow_without_export=False, waiver_phrase=None,
                                         reason_code=None)
        self.assertEqual(caught.exception.code, 'CONFIRMATION_MISMATCH')
        with self.assertRaises(AccountWorkflowError) as caught:
            self.workflow.delete_account(USER, 'token', confirmation='DELETE MY ACCOUNT',
                                         acknowledge_irreversible=False, export_id=export_id,
                                         allow_without_export=False, waiver_phrase=None,
                                         reason_code=None)
        self.assertEqual(caught.exception.code, 'IRREVERSIBLE_NOT_ACKNOWLEDGED')

    def test_delete_requires_downloaded_matching_export(self):
        export_id = self._downloaded_record()
        result = self.workflow.delete_account(
            USER, 'token', confirmation='DELETE MY ACCOUNT',
            acknowledge_irreversible=True, export_id=export_id,
            allow_without_export=False, waiver_phrase=None, reason_code=None)
        self.assertTrue(result['export_verified'])
        self.assertEqual(self.repo.deleted['export_id'], export_id)
        self.assertFalse(self.repo.deleted['allow_without_export'])

    def test_delete_rejects_ready_export_or_stale_count(self):
        export_id = self._downloaded_record()
        ready = ExportRecord(**{**self.repo.records[export_id].__dict__, 'state': 'ready'})
        self.repo.records[export_id] = ready
        with self.assertRaises(AccountWorkflowError) as caught:
            self.workflow.delete_account(USER, 'token', confirmation='DELETE MY ACCOUNT',
                                         acknowledge_irreversible=True, export_id=export_id,
                                         allow_without_export=False, waiver_phrase=None,
                                         reason_code=None)
        self.assertEqual(caught.exception.code, 'EXPORT_NOT_VERIFIED')
        export_id = self._downloaded_record(scan_count=1)
        with self.assertRaises(AccountWorkflowError) as caught:
            self.workflow.delete_account(USER, 'token', confirmation='DELETE MY ACCOUNT',
                                         acknowledge_irreversible=True, export_id=export_id,
                                         allow_without_export=False, waiver_phrase=None,
                                         reason_code=None)
        self.assertEqual(caught.exception.code, 'EXPORT_STALE')

    def test_delete_rejects_foreign_export_and_requires_export_without_waiver(self):
        foreign = self._downloaded_record(user_id=OTHER)
        with self.assertRaises(AccountWorkflowError) as caught:
            self.workflow.delete_account(USER, 'token', confirmation='DELETE MY ACCOUNT',
                                         acknowledge_irreversible=True, export_id=foreign,
                                         allow_without_export=False, waiver_phrase=None,
                                         reason_code=None)
        self.assertEqual(caught.exception.code, 'EXPORT_NOT_FOUND')
        with self.assertRaises(AccountWorkflowError) as caught:
            self.workflow.delete_account(USER, 'token', confirmation='DELETE MY ACCOUNT',
                                         acknowledge_irreversible=True, export_id=None,
                                         allow_without_export=False, waiver_phrase=None,
                                         reason_code=None)
        self.assertEqual(caught.exception.code, 'EXPORT_REQUIRED')

    def test_delete_requires_fresh_password_proof_when_configured(self):
        class Login:
            def login_gmail_user(self, email, password):
                if email == 'owner@example.test' and password == 'correct':
                    return {'user': {'id': USER, 'email': email}}
                raise ValueError('wrong password')

        self.workflow = AccountWorkflow(self.repo, self.storage, KEY, Login())
        export_id = self._downloaded_record()
        base = dict(confirmation='DELETE MY ACCOUNT', acknowledge_irreversible=True,
                    export_id=export_id, allow_without_export=False,
                    waiver_phrase=None, reason_code=None, email='owner@example.test')
        with self.assertRaises(AccountWorkflowError) as caught:
            self.workflow.delete_account(USER, 'token', **base)
        self.assertEqual(caught.exception.code, 'REAUTH_REQUIRED')
        with self.assertRaises(AccountWorkflowError) as caught:
            self.workflow.delete_account(USER, 'token', reauth_password='wrong', **base)
        self.assertEqual(caught.exception.code, 'REAUTH_FAILED')
        result = self.workflow.delete_account(USER, 'token', reauth_password='correct', **base)
        self.assertTrue(result['export_verified'])

    def test_waiver_requires_both_typed_phrase_and_reason(self):
        with self.assertRaises(AccountWorkflowError) as caught:
            self.workflow.delete_account(USER, 'token', confirmation='DELETE MY ACCOUNT',
                                         acknowledge_irreversible=True, export_id=None,
                                         allow_without_export=True, waiver_phrase='DELETE',
                                         reason_code='user_choice')
        self.assertEqual(caught.exception.code, 'WAIVER_MISMATCH')
        with self.assertRaises(AccountWorkflowError) as caught:
            self.workflow.delete_account(USER, 'token', confirmation='DELETE MY ACCOUNT',
                                         acknowledge_irreversible=True, export_id=None,
                                         allow_without_export=True,
                                         waiver_phrase='DELETE WITHOUT EXPORT',
                                         reason_code='because')
        self.assertEqual(caught.exception.code, 'WAIVER_REASON_REQUIRED')
        with self.assertRaises(AccountWorkflowError) as caught:
            self.workflow.delete_account(
                USER, 'token', confirmation='DELETE MY ACCOUNT',
                acknowledge_irreversible=True, export_id=None,
                allow_without_export=True, waiver_phrase='DELETE WITHOUT EXPORT',
                reason_code='user_choice')
        self.assertEqual(caught.exception.code, 'WAIVER_NOT_ALLOWED')
        self.repo.failed = True
        result = self.workflow.delete_account(
            USER, 'token', confirmation='DELETE MY ACCOUNT',
            acknowledge_irreversible=True, export_id=None,
            allow_without_export=True, waiver_phrase='DELETE WITHOUT EXPORT',
            reason_code='user_choice')
        self.assertTrue(result['without_export'])
        self.assertEqual(self.repo.deleted['reason_code'], 'user_choice')

    def test_waiver_is_allowed_when_there_are_no_scans(self):
        self.storage.rows = []
        result = self.workflow.delete_account(
            USER, 'token', confirmation='DELETE MY ACCOUNT',
            acknowledge_irreversible=True, export_id=None,
            allow_without_export=True, waiver_phrase='DELETE WITHOUT EXPORT',
            reason_code='no_scans')
        self.assertTrue(result['without_export'])


class SupabaseRepositoryTests(unittest.TestCase):
    def _repo(self, fail_event=False):
        repo = SupabaseExportRepository('https://project.test', 'service-key')
        calls = []

        def request(method, path, body=None, access_token=None,
                    content_type='application/json', raw=False):
            calls.append({'method': method, 'path': path, 'body': body})
            if path.startswith('/storage/v1/object/sign/'):
                return {'signedURL': '/object/sign/account-exports/a.zip?token=t'}
            if path.startswith('/storage/v1/object/'):
                return {}
            if 'rbac_record_export_event' in path:
                if fail_event:
                    raise AccountWorkflowError('ACCOUNT_PROVIDER_REJECTED', 'audit failed', 502)
                return 'event-id'
            if path.startswith('/rest/v1/account_exports?select=*'):
                row = dict(body[0])
                row['id'] = row.get('id')
                return [row]
            if 'rbac_delete_account' in path:
                return {'user_id': body['target_user_id'], 'deleted': True}
            return {}

        repo._request = request
        return repo, calls

    def test_create_marks_stale_rows_expired_before_upload_and_publishes(self):
        repo, calls = self._repo()
        created = datetime(2026, 1, 1, tzinfo=UTC)
        artifact, manifest, sha, count = build_export_artifact(USER, [_row('s1')], KEY, created)
        record, url = repo.create_export(USER, count, sha, manifest, artifact,
                                         created, created + timedelta(hours=24))
        self.assertEqual(record.state, 'ready')
        self.assertTrue(url.startswith('https://project.test/storage/v1/object/sign/'))
        paths = [call['path'] for call in calls]
        stale = next(i for i, path in enumerate(paths) if 'expires_at=lte' in path)
        upload = next(i for i, path in enumerate(paths) if
                      path.startswith('/storage/v1/object/account-exports/'))
        self.assertLess(stale, upload)
        self.assertEqual(calls[stale]['body'], {'state': 'expired'})

    def test_audit_failure_marks_export_failed_and_deletes_artifact(self):
        repo, calls = self._repo(fail_event=True)
        created = datetime(2026, 1, 1, tzinfo=UTC)
        artifact, manifest, sha, count = build_export_artifact(USER, [_row('s1')], KEY, created)
        with self.assertRaises(AccountWorkflowError):
            repo.create_export(USER, count, sha, manifest, artifact,
                               created, created + timedelta(hours=24))
        self.assertTrue(any('rbac_record_export_event' in c['path'] for c in calls))
        self.assertTrue(any(c['method'] == 'PATCH' and c['body'] ==
                            {'state': 'failed', 'failure_reason': 'audit_write_failed'}
                            for c in calls))
        self.assertTrue(any(c['method'] == 'DELETE' and
                            c['path'].startswith('/storage/v1/object/account-exports/')
                            for c in calls))

    def test_delete_forwards_exact_waiver_fields(self):
        repo, calls = self._repo()
        result = repo.delete_account(USER, None, True, 'export_failed', 'token')
        self.assertTrue(result['deleted'])
        body = calls[-1]['body']
        self.assertEqual(body['target_user_id'], USER)
        self.assertEqual(body['waiver_reason_code'], 'export_failed')
        self.assertTrue(body['allow_without_export'])


class LocalRepositoryTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.storage = FakeScanStorage([_row('s1'), _row('s2')])
        self.auth = FakeAuth()
        self.repo = LocalExportRepository(Path(self.temp.name), self.storage, self.auth)
        self.workflow = AccountWorkflow(self.repo, self.storage, signing_key=KEY)

    def tearDown(self):
        self.temp.cleanup()

    def test_local_export_is_downloadable_and_deletion_consumes_it(self):
        created = self.workflow.create_export(USER, 'token')
        artifact = self.workflow.download(USER, created['export_id'])
        self.assertTrue(artifact.content.startswith(b'PK'))
        self.workflow.mark_downloaded(USER, created['export_id'], 'token')
        result = self.workflow.delete_account(
            USER, 'token', confirmation='DELETE MY ACCOUNT',
            acknowledge_irreversible=True, export_id=created['export_id'],
            allow_without_export=False, waiver_phrase=None, reason_code=None)
        self.assertTrue(result['export_verified'])
        self.assertEqual(self.auth.deleted, [USER])
        self.assertEqual(self.storage.rows, [])
        self.assertEqual(self.repo.get_export(created['export_id']).state, 'consumed')
        audit = [json.loads(line) for line in self.repo.audit_path.read_text().splitlines()]
        actions = [entry['action'] for entry in audit]
        self.assertIn('account.export_verified', actions)
        self.assertIn('account.deleted', actions)

    def test_local_auth_failure_restores_scans(self):
        created = self.workflow.create_export(USER, 'token')
        self.workflow.mark_downloaded(USER, created['export_id'], 'token')
        self.auth.fail = True
        with self.assertRaises(AccountWorkflowError) as caught:
            self.workflow.delete_account(
                USER, 'token', confirmation='DELETE MY ACCOUNT',
                acknowledge_irreversible=True, export_id=created['export_id'],
                allow_without_export=False, waiver_phrase=None, reason_code=None)
        self.assertEqual(caught.exception.code, 'ACCOUNT_DELETE_FAILED')
        self.assertEqual(len(self.storage.rows), 2)
        self.assertEqual(self.repo.get_export(created['export_id']).state, 'downloaded')

    def test_new_export_marks_stale_active_rows_expired(self):
        artifact, manifest, sha, count = build_export_artifact(
            USER, [_row('s1')], KEY, datetime(2026, 1, 1, tzinfo=UTC))
        first, _ = self.repo.create_export(
            USER, count, sha, manifest, artifact,
            datetime(2026, 1, 1, tzinfo=UTC),
            datetime(2026, 1, 1, 1, tzinfo=UTC))
        second, _ = self.repo.create_export(
            USER, count, sha, manifest, artifact, datetime.now(UTC),
            datetime.now(UTC) + timedelta(hours=1))
        self.assertEqual(self.repo.get_export(first.id).state, 'expired')
        self.assertEqual(self.repo.get_export(second.id).state, 'ready')

    def test_local_owner_cannot_read_another_users_export(self):
        created = self.workflow.create_export(USER, 'token')
        with self.assertRaises(AccountWorkflowError) as caught:
            self.workflow.download(OTHER, created['export_id'])
        self.assertEqual(caught.exception.code, 'EXPORT_NOT_FOUND')

    def test_local_download_rejects_tampered_storage_path(self):
        created = self.workflow.create_export(USER, 'token')
        rows = json.loads(self.repo.index_path.read_text())
        rows[0]['storage_path'] = '../../etc/passwd'
        self.repo.index_path.write_text(json.dumps(rows))
        with self.assertRaises(AccountWorkflowError) as caught:
            self.workflow.download(USER, created['export_id'])
        self.assertEqual(caught.exception.code, 'EXPORT_ARTIFACT_MISSING')


class LocalAuthDeletionTests(unittest.TestCase):
    def test_delete_local_user_removes_user_otp_and_sessions(self):
        from server.services import auth_service as auth_module
        old_path = auth_module._LOCAL_STATE_PATH
        with tempfile.TemporaryDirectory() as folder:
            path = Path(folder) / 'local_auth_state.json'
            path.write_text(json.dumps({
                'users': {
                    'owner@example.test': {'id': USER, 'email': 'owner@example.test'},
                    'other@example.test': {'id': OTHER, 'email': 'other@example.test'},
                },
                'otps': {'owner@example.test': {'code': '1'}},
                'sessions': {
                    'a': {'user': {'id': USER, 'email': 'owner@example.test'}},
                    'b': {'user': {'id': OTHER, 'email': 'other@example.test'}},
                },
            }), encoding='utf-8')
            auth_module._LOCAL_STATE_PATH = path
            service = auth_module.AuthService.__new__(auth_module.AuthService)
            service._config = types.SimpleNamespace(auth_mode='local')
            try:
                self.assertTrue(service.local_user_exists(USER))
                self.assertTrue(service.delete_local_user(USER))
                self.assertFalse(service.local_user_exists(USER))
                self.assertFalse(service.delete_local_user(USER))
                state = json.loads(path.read_text())
                self.assertNotIn('owner@example.test', state['users'])
                self.assertIn('other@example.test', state['users'])
                self.assertEqual(list(state['sessions']), ['b'])
                self.assertNotIn('owner@example.test', state['otps'])
            finally:
                auth_module._LOCAL_STATE_PATH = old_path


if __name__ == '__main__':
    unittest.main()