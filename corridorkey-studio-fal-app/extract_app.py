"""CorridorKey Studio — preview frame extraction fal app.

Serverless endpoint that takes a source video URL (any codec ffmpeg supports —
ProRes, DNxHD, MXF, h264, h265, VP9, AV1, Cineform…) and returns:
  - metadata (frame_count, fps, duration, width, height)
  - a thumbnail URL
  - a list of low-res JPEG preview frame URLs (one per source frame)

The preview frames are intentionally small (~480px long edge, JPEG q80) so
the browser can scrub through them cheaply. The full-resolution source video
stays on fal CDN for later keying — keying endpoints decode it directly with
ffmpeg, so input frames stay bit-accurate through the pipeline.

Why ffmpeg subprocess rather than cv2.VideoCapture: cv2 relies on OpenCV's
bundled ffmpeg build, which skips many pro codecs. A system-apt ffmpeg,
invoked directly, matches what EZ-CorridorKey does and gives us ProRes /
DNxHD / MXF support.
"""

# NOTE: Deliberately NOT using `from __future__ import annotations` — it makes
# annotations strings at runtime and the fal worker's FastAPI introspection
# misinterpreted our Pydantic body params as query params until this was
# removed.

import json
import os
import re
import shutil
import subprocess
import tempfile
import time
import urllib.request
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path
from typing import Annotated, Optional

import fal
from fal.container import ContainerImage
from fal.toolkit import File
from fastapi import Body, Request
from pydantic import BaseModel, Field, ValidationError


# ---------------------------------------------------------------------------
# Container image — system ffmpeg + OpenCV bundled
# ---------------------------------------------------------------------------

_dockerfile = """
FROM python:3.12-slim

# System ffmpeg gives us pro codec support (ProRes, DNxHD, MXF, Cineform).
# opencv-python-headless bundles its own build but it strips some codecs.
RUN apt-get update && apt-get install -y --no-install-recommends \\
    ffmpeg \\
    curl \\
 && rm -rf /var/lib/apt/lists/*

RUN pip install --no-cache-dir \\
    opencv-python-headless \\
    numpy

# fal-required packages MUST be installed LAST
RUN pip install --no-cache-dir \\
    boto3==1.35.74 \\
    protobuf==4.25.1 \\
    pydantic==2.10.6

WORKDIR /app
"""

_image = ContainerImage.from_dockerfile_str(
    _dockerfile,
    context_dir=Path(__file__).parent,
)


# ---------------------------------------------------------------------------
# Schemas
# ---------------------------------------------------------------------------

class ExtractInput(BaseModel):
    video_url: str = Field(description="URL of the source video on fal CDN.")
    max_dim: int = Field(
        default=480,
        ge=240,
        le=1080,
        description="Long-edge pixel size for preview frames. 480 = fast to "
                    "download and scrub, 1080 = high-quality preview but 4x "
                    "storage.",
    )
    jpeg_quality: int = Field(
        default=80,
        ge=50,
        le=95,
        description="JPEG quality for preview frames. 80 is a good default.",
    )
    max_frames: int = Field(
        default=5000,
        ge=1,
        le=30000,
        description="Safety cap on frame count to prevent runaway extracts.",
    )


class ExtractOutput(BaseModel):
    frame_count: int
    fps: float
    duration_s: float
    width: int
    height: int
    codec: str
    thumbnail_url: str
    preview_frame_urls: list[str]
    processing_time_s: float


# ---------------------------------------------------------------------------
# ffprobe — read source metadata before we spin up the decoder
# ---------------------------------------------------------------------------

def _ffprobe(video_path: str) -> dict:
    """Run ffprobe and return the first video stream's info."""
    cmd = [
        "ffprobe",
        "-v", "error",
        "-select_streams", "v:0",
        "-show_entries",
        "stream=width,height,codec_name,r_frame_rate,avg_frame_rate,nb_frames,duration",
        "-show_entries", "format=duration",
        "-of", "json",
        video_path,
    ]
    result = subprocess.run(cmd, capture_output=True, text=True, check=True)
    data = json.loads(result.stdout)
    stream = data.get("streams", [{}])[0]
    fmt = data.get("format", {})

    width = int(stream.get("width", 0))
    height = int(stream.get("height", 0))
    codec = stream.get("codec_name", "unknown")

    # r_frame_rate is usually "30000/1001" form; avg_frame_rate is a fallback
    fps_str = stream.get("r_frame_rate") or stream.get("avg_frame_rate") or "0/1"
    num, den = fps_str.split("/")
    fps = float(num) / float(den) if float(den) != 0 else 0.0

    # Duration: prefer stream duration, fall back to format duration
    duration_s = float(stream.get("duration") or fmt.get("duration") or 0)

    # nb_frames is reliable for most formats but absent for some streams.
    # If missing, estimate from fps * duration.
    nb_frames_raw = stream.get("nb_frames")
    if nb_frames_raw and nb_frames_raw != "N/A":
        frame_count = int(nb_frames_raw)
    elif fps > 0 and duration_s > 0:
        frame_count = int(round(fps * duration_s))
    else:
        frame_count = 0

    return {
        "width": width,
        "height": height,
        "codec": codec,
        "fps": fps,
        "duration_s": duration_s,
        "frame_count": frame_count,
    }


# ---------------------------------------------------------------------------
# ffmpeg frame extraction
# ---------------------------------------------------------------------------

def _extract_frames(
    video_path: str,
    out_dir: Path,
    max_dim: int,
    jpeg_quality: int,
) -> list[Path]:
    """Extract every frame to out_dir as JPEGs, resized so long edge = max_dim.

    Returns the sorted list of emitted file paths.

    ffmpeg flags:
      -i input
      -vf scale='if(gt(iw,ih),{max_dim},-2):if(gt(iw,ih),-2,{max_dim})'
         — keep aspect, resize so long edge is max_dim (and other dim is even)
      -q:v {quality}  — JPEG quality (1 best, 31 worst; ffmpeg scale differs
                        from the 50-95 user-facing one; we remap below)
      -frame_pts 1     — emit frames at their PTS (for potential re-mux)
      -start_number 0  — 0-indexed
      -fps_mode passthrough — don't resample frame rate (keep source timing)
    """
    out_dir.mkdir(parents=True, exist_ok=True)

    # JPEG quality: user gives 50-95 (higher = better). ffmpeg's mjpeg uses
    # -q:v 2-31 (lower = better). Map linearly.
    # user 95 → q 2, user 50 → q 15
    qscale = max(2, min(31, int(round(31 - (jpeg_quality - 50) * 29 / 45))))

    # Scale filter: long-edge-to-max_dim, keeps aspect, enforces even dims
    scale_filter = (
        f"scale='if(gt(iw,ih),{max_dim},trunc(oh*iw/ih/2)*2):"
        f"if(gt(iw,ih),trunc(ow*ih/iw/2)*2,{max_dim})'"
    )

    out_pattern = str(out_dir / "%06d.jpg")
    cmd = [
        "ffmpeg",
        "-hide_banner",
        "-loglevel", "error",
        "-i", video_path,
        "-vf", scale_filter,
        "-fps_mode", "passthrough",
        "-q:v", str(qscale),
        "-start_number", "0",
        out_pattern,
    ]

    subprocess.run(cmd, check=True)

    files = sorted(out_dir.glob("*.jpg"), key=_numeric_sort_key)
    return files


def _extract_thumbnail(
    video_path: str,
    out_path: Path,
    mid_time_s: float,
    max_dim: int = 320,
) -> None:
    """Seek to mid_time_s and emit a single JPEG thumbnail."""
    scale_filter = (
        f"scale='if(gt(iw,ih),{max_dim},trunc(oh*iw/ih/2)*2):"
        f"if(gt(iw,ih),trunc(ow*ih/iw/2)*2,{max_dim})'"
    )
    cmd = [
        "ffmpeg",
        "-hide_banner",
        "-loglevel", "error",
        "-ss", str(mid_time_s),
        "-i", video_path,
        "-vframes", "1",
        "-vf", scale_filter,
        "-q:v", "3",
        "-y",
        str(out_path),
    ]
    subprocess.run(cmd, check=True)


def _numeric_sort_key(p: Path) -> int:
    m = re.match(r"(\d+)", p.stem)
    return int(m.group(1)) if m else 0


# ---------------------------------------------------------------------------
# fal CDN upload (parallel)
# ---------------------------------------------------------------------------

def _upload_file(path: Path, content_type: str) -> str:
    with open(path, "rb") as f:
        data = f.read()
    return File.from_bytes(
        data, content_type=content_type, file_name=path.name
    ).url


def _upload_frames_parallel(paths: list[Path], workers: int = 16) -> list[str]:
    """Upload all preview frames to fal CDN in parallel, preserving order."""
    with ThreadPoolExecutor(max_workers=workers) as pool:
        urls = list(pool.map(lambda p: _upload_file(p, "image/jpeg"), paths))
    return urls


# ---------------------------------------------------------------------------
# fal App
# ---------------------------------------------------------------------------

class ExtractPreviewApp(fal.App, keep_alive=180):
    app_name = "corridorkey-studio-extract"
    machine_type = "XS"   # CPU-only, small
    image = _image

    def setup(self):
        # Sanity check: ffmpeg must be available.
        try:
            subprocess.run(
                ["ffmpeg", "-version"], capture_output=True, check=True
            )
        except Exception as e:
            raise RuntimeError(
                f"ffmpeg binary not available in container: {e}"
            )

    @fal.endpoint("/")
    def extract(self, input: ExtractInput) -> ExtractOutput:
        t0 = time.time()

        # Stream the source video from fal CDN to a local temp path.
        # We don't hold the whole file in memory in case it's a large ProRes.
        with tempfile.NamedTemporaryFile(delete=False, suffix=".bin") as tmp:
            local_video = tmp.name
        urllib.request.urlretrieve(input.video_url, local_video)

        # 1. Probe metadata
        meta = _ffprobe(local_video)
        if meta["frame_count"] <= 0:
            raise ValueError(
                f"Could not determine frame count for {input.video_url}"
            )
        if meta["frame_count"] > input.max_frames:
            raise ValueError(
                f"Video has {meta['frame_count']} frames, exceeds cap "
                f"{input.max_frames}. Trim the clip first."
            )

        work_dir = Path(tempfile.mkdtemp(prefix="ck_extract_"))

        try:
            # 2. Thumbnail (mid-point) — done first so callers see something fast
            thumb_path = work_dir / "thumbnail.jpg"
            mid = (meta["duration_s"] or 0) / 2
            _extract_thumbnail(local_video, thumb_path, mid_time_s=mid)
            thumbnail_url = _upload_file(thumb_path, "image/jpeg")

            # 3. Preview frames — full sequence
            frames_dir = work_dir / "frames"
            frame_files = _extract_frames(
                local_video,
                frames_dir,
                max_dim=input.max_dim,
                jpeg_quality=input.jpeg_quality,
            )

            # 4. Upload all previews in parallel to fal CDN
            preview_urls = _upload_frames_parallel(frame_files)

            return ExtractOutput(
                frame_count=len(preview_urls),
                fps=meta["fps"],
                duration_s=meta["duration_s"],
                width=meta["width"],
                height=meta["height"],
                codec=meta["codec"],
                thumbnail_url=thumbnail_url,
                preview_frame_urls=preview_urls,
                processing_time_s=round(time.time() - t0, 2),
            )
        finally:
            shutil.rmtree(work_dir, ignore_errors=True)
            try:
                os.unlink(local_video)
            except Exception:
                pass
