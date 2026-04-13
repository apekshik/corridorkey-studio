"""Image I/O helpers for PNG and EXR formats."""

from __future__ import annotations

from pathlib import Path

import cv2
import numpy as np


def read_image(path: Path) -> np.ndarray:
    """Read an image file and return as float32 RGB [0, 1].

    Supports PNG, JPG, EXR.
    """
    ext = path.suffix.lower()

    if ext == ".exr":
        img = cv2.imread(str(path), cv2.IMREAD_ANYCOLOR | cv2.IMREAD_ANYDEPTH)
        if img is None:
            raise ValueError(f"Cannot read EXR: {path}")
        # EXR is already float, just convert BGR→RGB
        img = cv2.cvtColor(img, cv2.COLOR_BGR2RGB)
        return img.astype(np.float32)
    else:
        img = cv2.imread(str(path), cv2.IMREAD_COLOR)
        if img is None:
            raise ValueError(f"Cannot read image: {path}")
        img = cv2.cvtColor(img, cv2.COLOR_BGR2RGB)
        return img.astype(np.float32) / 255.0


def write_png(path: Path, img: np.ndarray) -> None:
    """Write a float32 RGB [0,1] or uint8 image as PNG."""
    if img.dtype == np.float32 or img.dtype == np.float64:
        img = np.clip(img * 255.0, 0, 255).astype(np.uint8)
    bgr = cv2.cvtColor(img, cv2.COLOR_RGB2BGR)
    cv2.imwrite(str(path), bgr)


def write_exr(path: Path, img: np.ndarray) -> None:
    """Write a float32 image as EXR (using OpenCV's EXR writer)."""
    if img.dtype != np.float32:
        img = img.astype(np.float32)
    if len(img.shape) == 3 and img.shape[2] == 3:
        bgr = cv2.cvtColor(img, cv2.COLOR_RGB2BGR)
    elif len(img.shape) == 3 and img.shape[2] == 4:
        bgr = cv2.cvtColor(img, cv2.COLOR_RGBA2BGRA)
    else:
        bgr = img
    cv2.imwrite(str(path), bgr)
