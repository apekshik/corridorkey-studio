"""GVM (Generic Visual Model) wrapper — automatic alpha hint generation.

Uses the real GVMProcessor from the CorridorKey repo when available.
GVM operates on sequences (not individual frames), so process_frame()
is only used as a stub fallback. The real path is process_sequence()
called directly by the job queue.

Falls back to a green-threshold stub if gvm_core is not importable.
"""

from __future__ import annotations

import logging
from pathlib import Path

import numpy as np

from corridorkey_studio.inference.base import ModelService

logger = logging.getLogger(__name__)


def _gvm_available() -> bool:
    try:
        from gvm_core.wrapper import GVMProcessor  # noqa: F401
        return True
    except ImportError:
        return False


class GVMService(ModelService):
    def __init__(self) -> None:
        self._processor = None
        self._device = "cpu"
        self._is_real = False

    @property
    def name(self) -> str:
        return "GVM"

    def load(self, device: str) -> None:
        self._device = device

        if _gvm_available():
            from gvm_core.wrapper import GVMProcessor

            try:
                logger.info("Loading real GVM processor on %s", device)
                self._processor = GVMProcessor(device=device)
                self._is_real = True
            except Exception as e:
                logger.warning("GVM model load failed (weights missing?): %s — using stub", e)
                self._is_real = False
        else:
            logger.warning(
                "gvm_core not available — using stub. "
                "Start the server with --corridorkey-path /path/to/CorridorKey"
            )
            self._is_real = False

    def unload(self) -> None:
        if self._processor is not None:
            del self._processor
            self._processor = None
        self._is_real = False
        logger.info("Unloaded GVM processor")

    def process_sequence(
        self,
        input_dir: Path,
        output_dir: Path,
        progress_callback=None,
    ) -> None:
        """Process a full frame sequence through GVM.

        This is the primary entry point — GVM works on sequences, not frames.
        The job queue calls this directly instead of process_frame().
        """
        if not self._is_real or self._processor is None:
            # Stub: copy green-threshold masks for each input frame
            self._stub_sequence(input_dir, output_dir, progress_callback)
            return

        self._processor.process_sequence(
            input_path=str(input_dir),
            output_dir=str(output_dir.parent),
            num_frames_per_batch=1,
            decode_chunk_size=1,
            denoise_steps=1,
            mode="matte",
            direct_output_dir=str(output_dir),
            progress_callback=progress_callback,
        )

    def process_frame(self, frame: np.ndarray, **kwargs) -> dict[str, np.ndarray]:
        """Per-frame fallback (used by stub mode only)."""
        r, g, b = frame[..., 0], frame[..., 1], frame[..., 2]
        green_excess = g - np.maximum(r, b)
        alpha = 1.0 - np.clip(green_excess * 3.0, 0.0, 1.0)
        return {"alpha_hint": alpha[..., np.newaxis].astype(np.float32)}

    def _stub_sequence(self, input_dir: Path, output_dir: Path, progress_callback=None) -> None:
        """Generate stub alpha hints for a whole sequence."""
        import cv2

        output_dir.mkdir(parents=True, exist_ok=True)
        frames = sorted(f for f in input_dir.iterdir() if f.suffix in (".png", ".exr"))
        total = len(frames)

        for i, frame_path in enumerate(frames):
            out_path = output_dir / frame_path.name
            if out_path.exists():
                continue

            img = cv2.imread(str(frame_path), cv2.IMREAD_COLOR)
            if img is None:
                continue
            img = cv2.cvtColor(img, cv2.COLOR_BGR2RGB).astype(np.float32) / 255.0
            result = self.process_frame(img)
            hint = (np.clip(result["alpha_hint"], 0, 1) * 255).astype(np.uint8)
            if hint.ndim == 3:
                hint = hint[..., 0]
            cv2.imwrite(str(out_path), hint)

            if progress_callback and (i + 1) % 5 == 0:
                progress_callback(i + 1, total)

        if progress_callback:
            progress_callback(total, total)
