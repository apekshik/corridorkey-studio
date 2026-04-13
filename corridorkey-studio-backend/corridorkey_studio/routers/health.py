"""Health check endpoint — polled by the web app every 5 seconds."""

from __future__ import annotations

from fastapi import APIRouter, Request

from corridorkey_studio.models.schemas import HealthResponse

router = APIRouter()


@router.get("/health", response_model=HealthResponse)
async def health(request: Request) -> HealthResponse:
    gpu_service = request.app.state.gpu_service
    return HealthResponse(
        gpu=gpu_service.get_info(),
        version=request.app.state.version,
        gpu_available=gpu_service.is_available,
    )
