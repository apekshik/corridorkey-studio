"""Color space utilities ported from EZ-CorridorKey/CorridorKeyModule/core/color_utils.py."""

from __future__ import annotations

import numpy as np


def srgb_to_linear(x: np.ndarray) -> np.ndarray:
    """Convert sRGB [0,1] to linear light [0,1]."""
    return np.where(x <= 0.04045, x / 12.92, ((x + 0.055) / 1.055) ** 2.4)


def linear_to_srgb(x: np.ndarray) -> np.ndarray:
    """Convert linear light [0,1] to sRGB [0,1]."""
    return np.where(x <= 0.0031308, x * 12.92, 1.055 * (x ** (1.0 / 2.4)) - 0.055)


def despill(
    image: np.ndarray,
    strength: float = 1.0,
    mode: str = "average",
) -> np.ndarray:
    """Remove green spill from an image.

    Args:
        image: [H, W, 3] float32 RGB [0, 1]
        strength: Despill strength 0-1
        mode: "average" uses (R+B)/2 as green limit, "max" uses max(R, B)
    """
    if strength <= 0:
        return image.copy()

    r, g, b = image[..., 0], image[..., 1], image[..., 2]

    if mode == "max":
        limit = np.maximum(r, b)
    else:
        limit = (r + b) / 2.0

    spill = np.clip(g - limit, 0, None) * strength
    result = image.copy()
    result[..., 0] = r + spill * 0.5  # redistribute to R
    result[..., 1] = g - spill
    result[..., 2] = b + spill * 0.5  # redistribute to B
    return result


def clean_matte(
    alpha: np.ndarray,
    area_threshold: int = 300,
    dilation: int = 15,
    blur_size: int = 5,
) -> np.ndarray:
    """Clean up a matte by removing small islands and smoothing edges.

    Args:
        alpha: [H, W] float32 [0, 1]
        area_threshold: Remove connected components smaller than this
        dilation: Morphological dilation kernel size
        blur_size: Gaussian blur kernel size for edge smoothing
    """
    import cv2

    mask = (alpha * 255).astype(np.uint8)

    # Remove small connected components
    num_labels, labels, stats, _ = cv2.connectedComponentsWithStats(mask, connectivity=8)
    for i in range(1, num_labels):
        if stats[i, cv2.CC_STAT_AREA] < area_threshold:
            mask[labels == i] = 0

    # Dilate then blur for smoother edges
    if dilation > 0:
        kernel = cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (dilation, dilation))
        mask = cv2.dilate(mask, kernel)
    if blur_size > 0:
        mask = cv2.GaussianBlur(mask, (blur_size | 1, blur_size | 1), 0)

    return mask.astype(np.float32) / 255.0
