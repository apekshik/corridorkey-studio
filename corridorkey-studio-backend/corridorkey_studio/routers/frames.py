"""Frame and thumbnail serving endpoints."""

from __future__ import annotations

from fastapi import APIRouter, Query, Request
from fastapi.responses import FileResponse

from corridorkey_studio.utils.errors import ClipNotFoundError

router = APIRouter(prefix="/clips", tags=["frames"])

# Map URL layer names to disk layer directories
_LAYER_MAP = {
    "input": "input",
    "fg": "fg",
    "matte": "matte",
    "comp": "comp",
    "processed": "processed",
    "alpha_hint": "alpha_hint",
}


@router.get("/{clip_id}/thumbnail")
async def get_thumbnail(request: Request, clip_id: str) -> FileResponse:
    frame_store = request.app.state.frame_store
    # Verify clip exists
    request.app.state.clip_manager.get_clip(clip_id)

    path = frame_store.thumbnail_path(clip_id)
    if not path.exists():
        raise ClipNotFoundError(f"Thumbnail not found for clip {clip_id}")
    return FileResponse(path, media_type="image/png")


@router.get("/{clip_id}/frames/{frame_num}")
async def get_frame(
    request: Request,
    clip_id: str,
    frame_num: int,
    layer: str = Query("input"),
) -> FileResponse:
    frame_store = request.app.state.frame_store
    # Verify clip exists
    request.app.state.clip_manager.get_clip(clip_id)

    disk_layer = _LAYER_MAP.get(layer, layer)
    path = frame_store.find_frame_file(clip_id, disk_layer, frame_num)
    if path is None:
        raise ClipNotFoundError(f"Frame {frame_num} not found for layer '{layer}'")

    media_type = "image/png" if path.suffix == ".png" else "image/x-exr"
    return FileResponse(path, media_type=media_type)
