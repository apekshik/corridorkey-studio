"""Video frame extraction using OpenCV."""

from __future__ import annotations

import logging
from pathlib import Path
from typing import Callable

import cv2
import numpy as np

logger = logging.getLogger(__name__)


def get_video_info(video_path: Path) -> dict:
    """Return frame count, fps, width, height for a video file."""
    cap = cv2.VideoCapture(str(video_path))
    if not cap.isOpened():
        raise ValueError(f"Cannot open video: {video_path}")
    try:
        frame_count = int(cap.get(cv2.CAP_PROP_FRAME_COUNT))
        fps = cap.get(cv2.CAP_PROP_FPS)
        width = int(cap.get(cv2.CAP_PROP_FRAME_WIDTH))
        height = int(cap.get(cv2.CAP_PROP_FRAME_HEIGHT))
        return {
            "frame_count": frame_count,
            "fps": fps,
            "width": width,
            "height": height,
        }
    finally:
        cap.release()


def extract_frames(
    video_path: Path,
    output_dir: Path,
    on_progress: Callable[[int, int], None] | None = None,
) -> int:
    """Extract all frames from a video as numbered PNGs.

    Returns the total number of frames extracted.
    """
    output_dir.mkdir(parents=True, exist_ok=True)

    cap = cv2.VideoCapture(str(video_path))
    if not cap.isOpened():
        raise ValueError(f"Cannot open video: {video_path}")

    try:
        total = int(cap.get(cv2.CAP_PROP_FRAME_COUNT))
        frame_num = 0

        while True:
            ret, frame = cap.read()
            if not ret:
                break

            out_path = output_dir / f"{frame_num:06d}.png"
            # Skip if already extracted (resume support)
            if not out_path.exists():
                cv2.imwrite(str(out_path), frame)

            frame_num += 1
            if on_progress and frame_num % 10 == 0:
                on_progress(frame_num, total)

        if on_progress:
            on_progress(frame_num, total)

        logger.info("Extracted %d frames from %s", frame_num, video_path.name)
        return frame_num
    finally:
        cap.release()


def extract_thumbnail(video_path: Path, output_path: Path, frame_index: int = 0) -> None:
    """Extract a single frame as a thumbnail."""
    output_path.parent.mkdir(parents=True, exist_ok=True)

    cap = cv2.VideoCapture(str(video_path))
    if not cap.isOpened():
        raise ValueError(f"Cannot open video: {video_path}")

    try:
        cap.set(cv2.CAP_PROP_POS_FRAMES, frame_index)
        ret, frame = cap.read()
        if not ret:
            raise ValueError(f"Cannot read frame {frame_index}")

        # Resize to thumbnail (160x120 max, preserving aspect ratio)
        h, w = frame.shape[:2]
        scale = min(160 / w, 120 / h)
        thumb = cv2.resize(frame, (int(w * scale), int(h * scale)))
        cv2.imwrite(str(output_path), thumb)
    finally:
        cap.release()
