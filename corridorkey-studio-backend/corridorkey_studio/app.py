"""FastAPI application factory."""

from __future__ import annotations

from contextlib import asynccontextmanager
from typing import AsyncIterator

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from corridorkey_studio import __version__
from corridorkey_studio.config import settings
from corridorkey_studio.routers import clips, frames, health, jobs
from corridorkey_studio.services.clip_manager import ClipManager
from corridorkey_studio.services.frame_store import FrameStore
from corridorkey_studio.services.gpu import GPUService
from corridorkey_studio.services.job_queue import JobQueue
from corridorkey_studio.services.model_manager import ModelManager
from corridorkey_studio.utils.errors import register_error_handlers


@asynccontextmanager
async def lifespan(app: FastAPI) -> AsyncIterator[None]:
    # Startup
    settings.ensure_dirs()
    app.state.version = __version__
    app.state.gpu_service = GPUService()
    app.state.frame_store = FrameStore(settings.data_dir / "projects")
    app.state.clip_manager = ClipManager(settings.data_dir, app.state.frame_store)

    # Model manager — handles GPU lock + model switching
    app.state.model_manager = ModelManager()

    # Job queue — wire up service references
    job_queue = JobQueue()
    job_queue.clip_manager = app.state.clip_manager
    job_queue.frame_store = app.state.frame_store
    job_queue.model_manager = app.state.model_manager
    job_queue.start_worker()
    app.state.job_queue = job_queue

    yield

    # Shutdown
    await job_queue.stop_worker()
    app.state.model_manager.unload_all()


def create_app() -> FastAPI:
    app = FastAPI(
        title="CorridorKey Studio",
        version=__version__,
        lifespan=lifespan,
    )

    # CORS for web UI
    app.add_middleware(
        CORSMiddleware,
        allow_origins=settings.cors_origins,
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )

    # Error handlers
    register_error_handlers(app)

    # Routers
    app.include_router(health.router)
    app.include_router(clips.router)
    app.include_router(frames.router)
    app.include_router(jobs.router)

    return app
