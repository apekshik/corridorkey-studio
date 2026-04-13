"""CorridorKey model wrapper — GreenFormer keyer.

Stub implementation for Phase 4. Phase 5 will wire up the real
CorridorKeyEngine from the CorridorKey repository.

Real model:
  - Input: [H,W,3] RGB + [H,W] alpha hint → resized to 2048x2048
  - Output: {'alpha': [H,W,1], 'fg': [H,W,3]}
  - Post-processing: despill, despeckle, compositing
  - VRAM: ~8-10 GB with float16 + torch.compile
"""

from __future__ import annotations

import logging

import numpy as np

from corridorkey_studio.inference.base import ModelService

logger = logging.getLogger(__name__)


class CorridorKeyService(ModelService):
    def __init__(self) -> None:
        self._loaded = False

    @property
    def name(self) -> str:
        return "CorridorKey"

    def load(self, device: str) -> None:
        logger.info("Loading CorridorKey stub on %s", device)
        self._device = device
        self._loaded = True

    def unload(self) -> None:
        logger.info("Unloading CorridorKey stub")
        self._loaded = False

    def process_frame(
        self,
        frame: np.ndarray,
        alpha_hint: np.ndarray | None = None,
        **kwargs,
    ) -> dict[str, np.ndarray]:
        """Stub: generate synthetic keying outputs.

        Real implementation will call CorridorKeyEngine.process_frame()
        with despill, despeckle, refiner params.
        """
        h, w = frame.shape[:2]

        if alpha_hint is not None:
            # Use alpha hint as the matte (real model refines this)
            if alpha_hint.ndim == 2:
                matte = alpha_hint[..., np.newaxis]
            else:
                matte = alpha_hint
        else:
            # No hint: generate a simple green-screen threshold matte
            matte = self._green_threshold(frame)

        # Ensure matte is [H, W, 1]
        if matte.ndim == 2:
            matte = matte[..., np.newaxis]

        # FG: frame * alpha (straight alpha)
        fg = frame * matte

        # Comp: FG over checkerboard
        checker = self._checkerboard(h, w)
        comp = fg + checker * (1.0 - matte)

        # Processed: RGBA premultiplied
        processed = np.concatenate([fg, matte], axis=-1)

        return {
            "matte": matte,
            "fg": fg,
            "comp": comp,
            "processed": processed,
        }

    @staticmethod
    def _green_threshold(frame: np.ndarray) -> np.ndarray:
        """Simple green-screen detection for stub output."""
        r, g, b = frame[..., 0], frame[..., 1], frame[..., 2]
        green_excess = g - np.maximum(r, b)
        matte = 1.0 - np.clip(green_excess * 4.0, 0.0, 1.0)
        return matte[..., np.newaxis].astype(np.float32)

    @staticmethod
    def _checkerboard(h: int, w: int, size: int = 16) -> np.ndarray:
        """Generate a gray checkerboard pattern for compositing."""
        y = np.arange(h) // size
        x = np.arange(w) // size
        pattern = (y[:, None] + x[None, :]) % 2
        gray = np.where(pattern, 0.3, 0.2).astype(np.float32)
        return np.stack([gray, gray, gray], axis=-1)
