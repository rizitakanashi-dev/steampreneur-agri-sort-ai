'''Contract tests for the account export/deletion API router.'''

from fastapi import FastAPI
from fastapi.testclient import TestClient
import unittest

from server.routers import account as account_router
from server.services.account_service import (
    AccountWorkflowError,
    DownloadArtifact,
)
from server.utils.auth import get_current_user

USER = '00000000-0000-0000-0000-000000000001'


class FakeWorkflow:
    def __init__(self):
        self.calls = []
        self.error = None

    def _maybe_raise(self):
        if self.error:
            raise self.error

    def create_export(self, user_id, access_token):
        self.calls.append(('create_export', user_id, access_token))
        self._maybe_raise()
        return {'export_id': 'e1', 'state': 'ready', 'scan_count': 2,
                'download_url': '/api/v1/account/exports/e1/download'}

    def mark_downloaded(self, user_id, export_id, access_token):
        self.calls.append(('mark_downloaded', user_id, export_id, access_token))
        self._maybe_raise()
        return {'export_id': export_id, 'state': 'downloaded'}

    def download(self, user_id, export_id):
        self.calls.append(('download', user_id, export_id))
        self._maybe_raise()
        return DownloadArtifact(content=b'PK\x03\x04', filename='export.zip')

    def delete_account(self, user_id, access_token, **kwargs):
        self.calls.append(('delete_account', user_id, access_token, kwargs))
        self._maybe_raise()
        return {'user_id': user_id, 'export_verified': True}


class AccountApiTests(unittest.TestCase):
    def setUp(self):
        self.workflow = FakeWorkflow()
        account_router.set_account_workflow(self.workflow)
        app = FastAPI()
        app.include_router(account_router.router)
        app.dependency_overrides[get_current_user] = lambda: {
            'id': USER, 'email': 'owner@example.test', '_access_token': 'user-token'}
        self.client = TestClient(app)

    def tearDown(self):
        account_router.set_account_workflow(None)

    def test_create_export_uses_authenticated_owner_and_token(self):
        response = self.client.post('/api/v1/account/exports')
        self.assertEqual(response.status_code, 201)
        self.assertEqual(response.json()['data']['scan_count'], 2)
        self.assertEqual(self.workflow.calls[0], ('create_export', USER, 'user-token'))

    def test_download_is_streamed_with_attachment_disposition(self):
        response = self.client.get('/api/v1/account/exports/e1/download')
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.headers['content-type'], 'application/zip')
        self.assertIn('filename="export.zip"', response.headers['content-disposition'])
        self.assertEqual(response.headers['cache-control'], 'no-store')

    def test_verify_marks_export_downloaded_for_owner(self):
        response = self.client.post('/api/v1/account/exports/e1/verify')
        self.assertEqual(response.status_code, 200)
        self.assertEqual(self.workflow.calls[0][0], 'mark_downloaded')
        self.assertEqual(self.workflow.calls[0][2], 'e1')

    def test_delete_forwards_typed_confirmation_fields(self):
        response = self.client.post('/api/v1/account/delete', json={
            'confirmation': 'DELETE MY ACCOUNT',
            'acknowledge_irreversible': True,
            'export_id': 'e1',
            'allow_without_export': False,
            'password': 'correct-horse',
        })
        self.assertEqual(response.status_code, 200)
        call = self.workflow.calls[0]
        self.assertEqual(call[3]['confirmation'], 'DELETE MY ACCOUNT')
        self.assertTrue(call[3]['acknowledge_irreversible'])
        self.assertEqual(call[3]['reauth_password'], 'correct-horse')
        self.assertEqual(call[3]['email'], 'owner@example.test')
        self.assertNotIn('correct-horse', response.text)

    def test_workflow_error_is_mapped_without_internal_detail(self):
        self.workflow.error = AccountWorkflowError('EXPORT_NOT_VERIFIED',
                                                   'Export must be downloaded and verified.', 409)
        response = self.client.post('/api/v1/account/delete', json={
            'confirmation': 'DELETE MY ACCOUNT',
            'acknowledge_irreversible': True,
            'export_id': 'e1',
        })
        self.assertEqual(response.status_code, 409)
        self.assertEqual(response.json()['detail']['code'], 'EXPORT_NOT_VERIFIED')
        self.assertNotIn('Traceback', response.text)

    def test_missing_confirmation_is_rejected_by_schema(self):
        response = self.client.post('/api/v1/account/delete', json={
            'acknowledge_irreversible': True,
        })
        self.assertEqual(response.status_code, 422)


if __name__ == '__main__':
    unittest.main()