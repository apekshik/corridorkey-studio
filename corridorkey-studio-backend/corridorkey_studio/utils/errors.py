"""Exception hierarchy and FastAPI error handlers."""

from __future__ import annotations

from fastapi import FastAPI, Request
from fastapi.responses import JSONResponse


class CKError(Exception):
    status_code: int = 500
    detail: str = "Internal server error"

    def __init__(self, detail: str | None = None) -> None:
        if detail:
            self.detail = detail
        super().__init__(self.detail)


class GPUUnavailableError(CKError):
    status_code = 503
    detail = "No GPU available. Install CUDA toolkit and ensure an NVIDIA GPU is present."


class ModelNotLoadedError(CKError):
    status_code = 503
    detail = "Required model is not loaded. It may still be downloading."


class OutOfMemoryError(CKError):
    status_code = 507
    detail = "GPU out of memory."


class ClipNotFoundError(CKError):
    status_code = 404
    detail = "Clip not found."


class JobNotFoundError(CKError):
    status_code = 404
    detail = "Job not found."


class InvalidStateTransitionError(CKError):
    status_code = 409
    detail = "Clip is not in the correct state for this operation."


def register_error_handlers(app: FastAPI) -> None:
    @app.exception_handler(CKError)
    async def ck_error_handler(request: Request, exc: CKError) -> JSONResponse:
        return JSONResponse(
            status_code=exc.status_code,
            content={"error": exc.detail},
        )
