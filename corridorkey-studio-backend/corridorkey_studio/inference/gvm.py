"""GVM (Generic Visual Model) wrapper — automatic alpha hint generation.

Stub implementation for Phase 4. Phase 5 will wire up the real
GVMProcessor from the CorridorKey repository.

Real model:
  - Input: video frames → resized to 1024xN, VAE-encoded
  - Output: alpha matte frames (grayscale)
  - VRAM: ~6-12 GB with float16 + chunked decoding
  - Process: one-click automatic foreground segmentation
"""

from __future__ import annotations

import logging

import numpy as np

from corridorkey_studio.inference.base import ModelService

logger = logging.getLogger(__name__)


class GVMService(ModelService):
    def __init__(self) -> None:
        self._loaded = False

    @property
    def name(self) -> str:
        return "GVM"

    def load(self, device: str) -> None:
        logger.info("Loading GVM stub on %s", device)
        self._device = device
        self._loaded = True

    def unload(self) -> None:
        logger.info("Unloading GVM stub")
        self._loaded = False

    def process_frame(self, frame: np.ndarray, **kwargs) -> dict[str, np.ndarray]:
        """Stub: generate a simple threshold-based alpha hint.

        Real implementation will call GVMProcessor with VAE encoding,
        flow-match diffusion, and chunked decoding.
        """
        # Simple green-channel threshold as stub alpha hint
        r, g, b = frame[..., 0], frame[..., 1], frame[..., 2]
        green_excess = g - np.maximum(r, b)
        alpha = 1.0 - np.clip(green_excess * 3.0, 0.0, 1.0)
        alpha = alpha.astype(np.float32)

        return {"alpha_hint": alpha[..., np.newaxis]}
