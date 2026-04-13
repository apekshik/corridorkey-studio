"""Clip management endpoints — CRUD + video import."""

from __future__ import annotations

from fastapi import APIRouter, Query, Request, UploadFile
from fastapi.responses import Response

from corridorkey_studio.models.enums import ClipState
from corridorkey_studio.models.schemas import ClipEntry, ClipUpdate

router = APIRouter(prefix="/clips", tags=["clips"])


@router.get("", response_model=list[ClipEntry])
async def list_clips(
    request: Request,
    state: ClipState | None = Query(None),
) -> list[ClipEntry]:
    clip_manager = request.app.state.clip_manager
    return clip_manager.list_clips(state_filter=state)


@router.get("/{clip_id}", response_model=ClipEntry)
async def get_clip(request: Request, clip_id: str) -> ClipEntry:
    return request.app.state.clip_manager.get_clip(clip_id)


@router.post("/import", response_model=ClipEntry, status_code=201)
async def import_video(request: Request, file: UploadFile) -> ClipEntry:
    clip_manager = request.app.state.clip_manager
    data = await file.read()
    return clip_manager.import_video(file.filename or "untitled.mp4", data)


@router.patch("/{clip_id}", response_model=ClipEntry)
async def update_clip(request: Request, clip_id: str, body: ClipUpdate) -> ClipEntry:
    return request.app.state.clip_manager.update_clip(clip_id, body)


@router.delete("/{clip_id}", status_code=204)
async def delete_clip(request: Request, clip_id: str) -> Response:
    request.app.state.clip_manager.delete_clip(clip_id)
    return Response(status_code=204)


@router.get("/{clip_id}/coverage")
async def get_coverage(request: Request, clip_id: str) -> dict:
    # Verify clip exists
    request.app.state.clip_manager.get_clip(clip_id)
    return request.app.state.frame_store.get_coverage(clip_id)
