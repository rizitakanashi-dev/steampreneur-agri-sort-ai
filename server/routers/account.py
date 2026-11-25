'''Owner-scoped account export and deletion API.'''

from typing import Any, Dict, Optional

from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.responses import RedirectResponse, Response
from pydantic import BaseModel, Field

from server.services.account_service import (
    AccountWorkflow,
    AccountWorkflowError,
    create_account_workflow,
)
from server.utils.auth import get_current_user

router = APIRouter(prefix='/api/v1/account', tags=['Account'])
_workflow: Optional[AccountWorkflow] = None


def get_account_workflow() -> AccountWorkflow:
    global _workflow
    if _workflow is None:
        _workflow = create_account_workflow()
    return _workflow


def set_account_workflow(workflow: Optional[AccountWorkflow]) -> None:
    global _workflow
    _workflow = workflow


def _raise_http(exc: AccountWorkflowError) -> None:
    raise HTTPException(
        status_code=exc.status_code,
        detail={'code': exc.code, 'message': exc.message},
    ) from exc


class DeleteAccountRequest(BaseModel):
    confirmation: str = Field(..., min_length=1, max_length=64)
    acknowledge_irreversible: bool = False
    export_id: Optional[str] = Field(None, max_length=64)
    allow_without_export: bool = False
    waiver_phrase: Optional[str] = Field(None, max_length=64)
    reason_code: Optional[str] = Field(None, max_length=32)
    password: Optional[str] = Field(None, min_length=1, max_length=256, repr=False)


@router.post('/exports', status_code=status.HTTP_201_CREATED)
async def create_export(
    current_user: Dict[str, Any] = Depends(get_current_user),
) -> Dict[str, Any]:
    try:
        data = get_account_workflow().create_export(
            current_user['id'], current_user['_access_token'])
    except AccountWorkflowError as exc:
        _raise_http(exc)
    return {'status': 'success', 'data': data}


@router.get('/exports/{export_id}/download')
async def download_export(
    export_id: str,
    current_user: Dict[str, Any] = Depends(get_current_user),
):
    try:
        artifact = get_account_workflow().download(current_user['id'], export_id)
    except AccountWorkflowError as exc:
        _raise_http(exc)
    if artifact.redirect_url:
        return RedirectResponse(
            artifact.redirect_url,
            status_code=status.HTTP_302_FOUND,
            headers={'Cache-Control': 'no-store'},
        )
    filename = artifact.filename or 'export.zip'
    headers = {
        'Content-Disposition': f'attachment; filename="{filename}"',
        'Cache-Control': 'no-store',
        'Pragma': 'no-cache',
    }
    return Response(content=artifact.content or b'', media_type='application/zip', headers=headers)


@router.post('/exports/{export_id}/verify')
async def verify_export(
    export_id: str,
    current_user: Dict[str, Any] = Depends(get_current_user),
) -> Dict[str, Any]:
    try:
        data = get_account_workflow().mark_downloaded(
            current_user['id'], export_id, current_user['_access_token'])
    except AccountWorkflowError as exc:
        _raise_http(exc)
    return {'status': 'success', 'data': data}


@router.post('/delete')
async def delete_account(
    payload: DeleteAccountRequest,
    current_user: Dict[str, Any] = Depends(get_current_user),
) -> Dict[str, Any]:
    try:
        data = get_account_workflow().delete_account(
            current_user['id'], current_user['_access_token'],
            confirmation=payload.confirmation,
            acknowledge_irreversible=payload.acknowledge_irreversible,
            export_id=payload.export_id,
            allow_without_export=payload.allow_without_export,
            waiver_phrase=payload.waiver_phrase,
            reason_code=payload.reason_code,
            email=current_user.get('email'),
            reauth_password=payload.password,
        )
    except AccountWorkflowError as exc:
        _raise_http(exc)
    return {'status': 'success', 'data': data}