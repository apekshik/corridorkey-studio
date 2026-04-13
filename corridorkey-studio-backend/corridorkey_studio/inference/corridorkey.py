"""CorridorKey model wrapper — uses the real CorridorKey repo's create_engine() factory.

This wraps the official CorridorKey inference engine (GreenFormer on Torch,
or MLX on Apple Silicon). The engine is loaded via backend.create_engine()
which handles checkpoint discovery, auto-download, and backend selection.

Falls back to a simple green-threshold stub if CorridorKey is not available
(e.g. missing --corridorkey-path or missing dependencies).
"""

from __future__ import annotations

import logging

import numpy as np

from corridorkey_studio.inference.base import ModelService

logger = logging.getLogger(__name__)


def _corridorkey_available() -> bool:
    """Check if CorridorKey modules are importable."""
    try:
        from CorridorKeyModule.backend import create_engine  # noqa: F401
        return True
    except ImportError:
        return False


class CorridorKeyService(ModelService):
    def __init__(self) -> None:
        self._engine = None
        self._device = "cpu"
        self._is_real = False

    @property
    def name(self) -> str:
        return "CorridorKey"

    def load(self, device: str) -> None:
        self._device = device

        if _corridorkey_available():
            from CorridorKeyModule.backend import create_engine
            import glob, os

            # Find checkpoint explicitly — backend.py's relative path may not resolve
            # from our working directory
            ckpt_dir = os.path.join(os.path.dirname(os.path.abspath(__import__("CorridorKeyModule").__file__)), "checkpoints")
            ptfiles = glob.glob(os.path.join(ckpt_dir, "*.pth"))

            logger.info("Loading real CorridorKey engine on %s (checkpoint dir: %s)", device, ckpt_dir)

            if not ptfiles:
                # No checkpoint found — download from HuggingFace
                logger.info("No checkpoint found in %s, downloading...", ckpt_dir)
                os.makedirs(ckpt_dir, exist_ok=True)
                try:
                    from huggingface_hub import hf_hub_download
                    cached = hf_hub_download(
                        repo_id="nikopueringer/CorridorKey_v1.0",
                        filename="CorridorKey_v1.0.pth",
                    )
                    import shutil
                    dest = os.path.join(ckpt_dir, "CorridorKey_v1.0.pth")
                    shutil.copy2(cached, dest)
                    ptfiles = [dest]
                    logger.info("Downloaded checkpoint to %s", dest)
                except Exception as e:
                    logger.error("Failed to download checkpoint: %s", e)

            if ptfiles:
                from CorridorKeyModule.inference_engine import CorridorKeyEngine
                import torch

                self._engine = CorridorKeyEngine(
                    checkpoint_path=ptfiles[0],
                    device=device,
                    img_size=2048,
                    model_precision=torch.float16,
                )
            else:
                logger.warning("No checkpoint available — falling back to stub")
                self._is_real = False
                return

            self._is_real = True
        else:
            logger.warning(
                "CorridorKey modules not available — using stub. "
                "Start the server with --corridorkey-path /path/to/CorridorKey"
            )
            self._is_real = False

    def unload(self) -> None:
        if self._engine is not None:
            del self._engine
            self._engine = None
        self._is_real = False
        logger.info("Unloaded CorridorKey engine")

    def process_frame(
        self,
        frame: np.ndarray,
        alpha_hint: np.ndarray | None = None,
        **kwargs,
    ) -> dict[str, np.ndarray]:
        """Run CorridorKey keying on a single frame.

        Args:
            frame: [H, W, 3] float32 RGB [0, 1]
            alpha_hint: [H, W] or [H, W, 1] float32 [0, 1]
            **kwargs: refiner_scale, despill_strength, auto_despeckle, etc.
        """
        if self._is_real and self._engine is not None:
            return self._process_real(frame, alpha_hint, **kwargs)
        return self._process_stub(frame, alpha_hint)

    def _process_real(
        self,
        frame: np.ndarray,
        alpha_hint: np.ndarray | None,
        **kwargs,
    ) -> dict[str, np.ndarray]:
        """Call the real CorridorKey engine."""
        h, w = frame.shape[:2]

        if alpha_hint is None:
            mask = np.ones((h, w), dtype=np.float32)
        elif alpha_hint.ndim == 3:
            mask = alpha_hint[..., 0]
        else:
            mask = alpha_hint

        engine_kwargs = {
            "refiner_scale": kwargs.get("refiner_scale", 1.0),
            "input_is_linear": kwargs.get("input_is_linear", False),
            "despill_strength": kwargs.get("despill_strength", 1.0),
            "auto_despeckle": kwargs.get("auto_despeckle", True),
            "despeckle_size": kwargs.get("despeckle_size", 400),
        }

        result = self._engine.process_frame(frame, mask, **engine_kwargs)

        # Engine returns list for batched input — we send single frames
        if isinstance(result, list):
            result = result[0]

        alpha = result.get("alpha", np.ones((h, w, 1), dtype=np.float32))
        if alpha.ndim == 2:
            alpha = alpha[..., np.newaxis]

        fg = result.get("fg", frame)
        comp = result.get("comp", frame)
        processed = result.get("processed", np.concatenate([fg, alpha], axis=-1))

        return {"matte": alpha, "fg": fg, "comp": comp, "processed": processed}

    def _process_stub(self, frame: np.ndarray, alpha_hint: np.ndarray | None) -> dict[str, np.ndarray]:
        """Fallback stub when CorridorKey is not available."""
        h, w = frame.shape[:2]

        if alpha_hint is not None:
            matte = alpha_hint if alpha_hint.ndim == 3 else alpha_hint[..., np.newaxis]
        else:
            matte = self._green_threshold(frame)
        if matte.ndim == 2:
            matte = matte[..., np.newaxis]

        fg = frame * matte
        checker = self._checkerboard(h, w)
        comp = fg + checker * (1.0 - matte)
        processed = np.concatenate([fg, matte], axis=-1)
        return {"matte": matte, "fg": fg, "comp": comp, "processed": processed}

    @staticmethod
    def _green_threshold(frame: np.ndarray) -> np.ndarray:
        r, g, b = frame[..., 0], frame[..., 1], frame[..., 2]
        green_excess = g - np.maximum(r, b)
        return (1.0 - np.clip(green_excess * 4.0, 0.0, 1.0))[..., np.newaxis].astype(np.float32)

    @staticmethod
    def _checkerboard(h: int, w: int, size: int = 16) -> np.ndarray:
        y, x = np.arange(h) // size, np.arange(w) // size
        gray = np.where((y[:, None] + x[None, :]) % 2, 0.3, 0.2).astype(np.float32)
        return np.stack([gray, gray, gray], axis=-1)
