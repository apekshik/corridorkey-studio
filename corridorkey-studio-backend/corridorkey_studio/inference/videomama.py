"""VideoMaMa wrapper — artist-guided alpha hint generation.

Stub implementation for Phase 4. Phase 5 will wire up the real
VideoMaMa pipeline from the CorridorKey repository.

Real model:
  - Input: RGB frames + grayscale mask keyframes (artist brush strokes)
  - Output: interpolated alpha hints for all frames
  - Architecture: SVD-based UNet (12 input channels: 4 noise + 4 cond + 4 mask)
  - VRAM: ~24 GB+ (heaviest model, requires offloading on consumer cards)
  - Process: paint FG/BG strokes on keyframes, model interpolates between them
"""

from __future__ import annotations

import logging

import numpy as np

from corridorkey_studio.inference.base import ModelService

logger = logging.getLogger(__name__)


class VideoMaMaService(ModelService):
    def __init__(self) -> None:
        self._loaded = False

    @property
    def name(self) -> str:
        return "VideoMaMa"

    def load(self, device: str) -> None:
        logger.info("Loading VideoMaMa stub on %s", device)
        self._device = device
        self._loaded = True

    def unload(self) -> None:
        logger.info("Unloading VideoMaMa stub")
        self._loaded = False

    def process_frame(self, frame: np.ndarray, mask: np.ndarray | None = None, **kwargs) -> dict[str, np.ndarray]:
        """Stub: pass through or interpolate the mask keyframe.

        Real implementation will encode frames + masks through the
        SVD-based UNet and interpolate between keyframes.
        """
        h, w = frame.shape[:2]

        if mask is not None:
            # Use provided mask directly (real model would refine/interpolate)
            if mask.ndim == 3:
                alpha = mask[..., 0:1]
            else:
                alpha = mask[..., np.newaxis]
        else:
            # No mask provided: generate a neutral gray hint
            alpha = np.full((h, w, 1), 0.5, dtype=np.float32)

        return {"alpha_hint": alpha.astype(np.float32)}
