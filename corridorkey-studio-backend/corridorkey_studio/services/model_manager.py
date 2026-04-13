"""Model weight management — download, load/unload with GPU lock.

Only ONE heavy model is in VRAM at a time. Before loading a new model,
the current model is evicted: unload → gc.collect → empty_cache → load.
"""

from __future__ import annotations

import asyncio
import gc
import logging
import threading
from enum import Enum
from typing import TYPE_CHECKING

if TYPE_CHECKING:
    from corridorkey_studio.inference.base import ModelService

logger = logging.getLogger(__name__)


class ActiveModel(str, Enum):
    NONE = "NONE"
    CORRIDORKEY = "CORRIDORKEY"
    GVM = "GVM"
    VIDEOMAMA = "VIDEOMAMA"


class ModelManager:
    """Manages model lifecycle — ensures only one model in VRAM at a time."""

    def __init__(self) -> None:
        self._lock = threading.Lock()
        self._active: ActiveModel = ActiveModel.NONE
        self._service: ModelService | None = None
        self._device: str = "cpu"
        self._detect_device()

    def _detect_device(self) -> None:
        try:
            import torch

            if torch.cuda.is_available():
                self._device = "cuda"
            elif hasattr(torch.backends, "mps") and torch.backends.mps.is_available():
                self._device = "mps"
            else:
                self._device = "cpu"
        except ImportError:
            self._device = "cpu"
        logger.info("Model manager device: %s", self._device)

    @property
    def device(self) -> str:
        return self._device

    @property
    def active_model(self) -> ActiveModel:
        return self._active

    @property
    def lock(self) -> threading.Lock:
        """GPU lock — all forward passes must be guarded by this."""
        return self._lock

    def ensure_model(self, needed: ActiveModel) -> ModelService:
        """Ensure the requested model is loaded, evicting any current model.

        Must be called from a thread (not the event loop) since it acquires
        a blocking lock and may do heavy I/O.
        """
        with self._lock:
            if self._active == needed and self._service is not None:
                return self._service

            # Evict current model
            if self._service is not None:
                logger.info("Evicting %s to load %s", self._active.value, needed.value)
                self._evict()

            # Load new model
            service = self._create_service(needed)
            service.load(self._device)
            self._service = service
            self._active = needed
            logger.info("Loaded %s on %s", needed.value, self._device)
            return service

    def _evict(self) -> None:
        """Unload current model and free GPU memory."""
        if self._service is not None:
            self._service.unload()
            self._service = None
        self._active = ActiveModel.NONE
        gc.collect()
        try:
            import torch

            if torch.cuda.is_available():
                torch.cuda.empty_cache()
        except ImportError:
            pass

    def _create_service(self, model: ActiveModel) -> ModelService:
        """Instantiate the appropriate model service."""
        if model == ActiveModel.CORRIDORKEY:
            from corridorkey_studio.inference.corridorkey import CorridorKeyService
            return CorridorKeyService()
        elif model == ActiveModel.GVM:
            from corridorkey_studio.inference.gvm import GVMService
            return GVMService()
        elif model == ActiveModel.VIDEOMAMA:
            from corridorkey_studio.inference.videomama import VideoMaMaService
            return VideoMaMaService()
        else:
            raise ValueError(f"Unknown model: {model}")

    def unload_all(self) -> None:
        """Unload everything — called on shutdown."""
        with self._lock:
            self._evict()
