"""FastAPI application factory."""

from __future__ import annotations

from contextlib import asynccontextmanager
from typing import AsyncIterator

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from corridorkey_studio import __version__
from corridorkey_studio.config import settings
from corridorkey_studio.routers import clips, frames, health
from corridorkey_studio.services.clip_manager import ClipManager
from corridorkey_studio.services.frame_store import FrameStore
from corridorkey_studio.services.gpu import GPUService
from corridorkey_studio.utils.errors import register_error_handlers


@asynccontextmanager
async def lifespan(app: FastAPI) -> AsyncIterator[None]:
    # Startup
    settings.ensure_dirs()
    app.state.version = __version__
    app.state.gpu_service = GPUService()
    app.state.frame_store = FrameStore(settings.data_dir / "projects")
    app.state.clip_manager = ClipManager(settings.data_dir, app.state.frame_store)
    yield


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

    return app
