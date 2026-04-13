"""Abstract base class for all model services."""

from __future__ import annotations

from abc import ABC, abstractmethod
from pathlib import Path

import numpy as np


class ModelService(ABC):
    """Interface that all inference model wrappers must implement."""

    @property
    @abstractmethod
    def name(self) -> str:
        """Human-readable model name."""
        ...

    @abstractmethod
    def load(self, device: str) -> None:
        """Load model weights onto the given device."""
        ...

    @abstractmethod
    def unload(self) -> None:
        """Release model from memory."""
        ...

    @abstractmethod
    def process_frame(self, frame: np.ndarray, **kwargs) -> dict[str, np.ndarray]:
        """Run inference on a single frame.

        Args:
            frame: [H, W, 3] float32 RGB [0, 1]
            **kwargs: Model-specific parameters

        Returns:
            Dict of output name → [H, W, C] float32 arrays
        """
        ...
