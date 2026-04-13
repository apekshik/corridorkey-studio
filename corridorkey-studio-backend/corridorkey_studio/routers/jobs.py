"""Job queue endpoints + SSE event stream."""

from __future__ import annotations

from fastapi import APIRouter, Query, Request
from fastapi.responses import Response, StreamingResponse

from corridorkey_studio.models.enums import JobStatus
from corridorkey_studio.models.schemas import GPUJob, JobCreate

router = APIRouter(prefix="/jobs", tags=["jobs"])


@router.get("", response_model=list[GPUJob])
async def list_jobs(
    request: Request,
    status: JobStatus | None = Query(None),
) -> list[GPUJob]:
    return request.app.state.job_queue.list_jobs(status_filter=status)


@router.post("", response_model=GPUJob, status_code=201)
async def create_job(request: Request, body: JobCreate) -> GPUJob:
    return await request.app.state.job_queue.enqueue(body)


@router.get("/events", response_class=StreamingResponse)
async def job_events(request: Request) -> StreamingResponse:
    """SSE endpoint for real-time job progress updates."""
    job_queue = request.app.state.job_queue

    return StreamingResponse(
        job_queue.subscribe(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no",
        },
    )


@router.get("/{job_id}", response_model=GPUJob)
async def get_job(request: Request, job_id: str) -> GPUJob:
    return request.app.state.job_queue.get_job(job_id)


@router.delete("/{job_id}", status_code=204)
async def cancel_job(request: Request, job_id: str) -> Response:
    await request.app.state.job_queue.cancel_job(job_id)
    return Response(status_code=204)
