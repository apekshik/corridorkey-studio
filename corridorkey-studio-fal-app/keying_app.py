"""CorridorKey Studio — keying pipeline fal app.

Three webhook-driven endpoints that read a source video from fal CDN,
generate alpha hints (GVM), key with CorridorKey, and upload per-frame
outputs back to fal CDN. The Convex action `keying.dispatch` is the only
caller; results flow back to Convex via the webhook URL supplied on the
queue submission.

  POST /alpha     — GVM only, returns alpha_hint URLs
  POST /key       — CorridorKey only (takes alpha hints), returns matte/fg/
                    comp/processed URLs
  POST /pipeline  — chains /alpha then /key. Emits an interim webhook to
                    `alpha_webhook` once GVM finishes so the UI can stream
                    hints before mattes land.

Stub mode: if `gvm_core` / `CorridorKeyModule` aren't importable in the
container, both endpoints fall back to green-threshold mattes so the
end-to-end webhook plumbing can be tested without the model repos. To
enable real inference, add `git clone` of the CorridorKey + GVM repos to
the Dockerfile (see comments below).
"""

# NOTE: Deliberately NOT using `from __future__ import annotations` — see
# the extract app's note for why this trips up fal's FastAPI introspection.

import hashlib
import hmac
import json
import logging
import os
import shutil
import subprocess
import tempfile
import time
import urllib.request
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path

import fal
from fal.container import ContainerImage
from fal.toolkit import File
from pydantic import BaseModel, Field

logger = logging.getLogger(__name__)


# ---------------------------------------------------------------------------
# Container image — torch + ffmpeg + opencv + huggingface_hub
# ---------------------------------------------------------------------------

# Until the CorridorKey / GVM repos are added here, the app runs in stub mode
# and returns green-threshold mattes. To enable real inference, add (roughly):
#
#   RUN git clone https://github.com/<...>/CorridorKey /opt/CorridorKey \
#    && pip install -e /opt/CorridorKey
#   RUN git clone https://github.com/<...>/gvm-core /opt/gvm-core \
#    && pip install -e /opt/gvm-core
#   ENV PYTHONPATH=/opt/CorridorKey:/opt/gvm-core:$PYTHONPATH
#
# and bump machine_type to GPU-H100.

_dockerfile = """
FROM python:3.12-slim

RUN apt-get update && apt-get install -y --no-install-recommends \\
    ffmpeg \\
    curl \\
    git \\
 && rm -rf /var/lib/apt/lists/*

RUN pip install --no-cache-dir \\
    opencv-python-headless \\
    numpy \\
    requests \\
    huggingface_hub

# Torch is the heaviest dep; pinned for reproducibility. Skip the +cu121
# wheel index for stub mode (CPU only). Add the index when enabling GPU.
RUN pip install --no-cache-dir torch==2.5.1

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

class InferenceSettings(BaseModel):
    inputIsLinear: bool = False
    despillStrength: float = 1.0
    autoDespeckle: bool = True
    despeckleSize: int = 200
    refinerScale: float = 1.0


class OutputConfig(BaseModel):
    fgEnabled: bool = True
    fgFormat: str = "exr"
    fgPremult: str = "premult"
    matteEnabled: bool = True
    matteFormat: str = "exr"
    compEnabled: bool = False
    compFormat: str = "png"
    processedEnabled: bool = True
    processedFormat: str = "exr"
    generateCompPreview: bool = True


class AlphaInput(BaseModel):
    clip_id: str
    source_url: str
    frame_count: int
    in_point: int | None = None
    out_point: int | None = None
    settings: InferenceSettings


class KeyInput(BaseModel):
    clip_id: str
    source_url: str
    alpha_hint_urls: list[str]
    frame_count: int
    in_point: int | None = None
    out_point: int | None = None
    settings: InferenceSettings
    output_config: OutputConfig


class PipelineInput(BaseModel):
    clip_id: str
    source_url: str
    frame_urls: list[str] = Field(default_factory=list)
    frame_count: int
    in_point: int | None = None
    out_point: int | None = None
    scope: str = "ready"
    settings: InferenceSettings
    output_config: OutputConfig
    alpha_webhook: str | None = None


class FrameUpdate(BaseModel):
    frameNum: int
    alphaHintUrl: str | None = None
    matteUrl: str | None = None
    fgUrl: str | None = None
    compUrl: str | None = None
    processedUrl: str | None = None


class JobOutput(BaseModel):
    clip_id: str
    frames: list[FrameUpdate]
    processing_time_s: float


# ---------------------------------------------------------------------------
# Helpers — ffmpeg decode, fal upload, webhook signing
# ---------------------------------------------------------------------------

def _decode_to_sequence(video_path: str, out_dir: Path) -> list[Path]:
    """Decode every frame of `video_path` to numbered JPEGs in `out_dir`.

    JPEG (quality 95) instead of PNG keeps fal's tmpfs/RAM footprint low —
    1080p PNGs are ~2MB each, JPEGs ~150KB. Visually transparent for keying
    input. Alpha hints + matte outputs stay PNG (need lossless / alpha).
    """
    out_dir.mkdir(parents=True, exist_ok=True)
    out_pattern = str(out_dir / "%06d.jpg")
    cmd = [
        "ffmpeg",
        "-hide_banner",
        "-loglevel", "error",
        "-i", video_path,
        "-fps_mode", "passthrough",
        "-start_number", "0",
        "-q:v", "2",        # JPEG quality (1=best, 31=worst); 2 ≈ Q95
        out_pattern,
    ]
    subprocess.run(cmd, check=True)
    return sorted(out_dir.glob("*.jpg"))


def _source_frames(frames_dir: Path) -> list[Path]:
    """Sorted list of decoded source frames (jpg now, png tolerated)."""
    return sorted(
        list(frames_dir.glob("*.jpg")) + list(frames_dir.glob("*.png"))
    )


def _upload_file(path: Path, content_type: str) -> str:
    with open(path, "rb") as f:
        data = f.read()
    return File.from_bytes(
        data, content_type=content_type, file_name=path.name
    ).url


def _upload_parallel(paths: list[Path], content_type: str, workers: int = 16) -> list[str]:
    if not paths:
        return []
    with ThreadPoolExecutor(max_workers=workers) as pool:
        return list(pool.map(lambda p: _upload_file(p, content_type), paths))


def _fetch_url(url: str, dest: Path) -> None:
    urllib.request.urlretrieve(url, str(dest))


def _post_webhook(url: str, body: dict) -> None:
    """POST a JSON body to a webhook URL, signed if FAL_WEBHOOK_SECRET is set."""
    import requests

    raw = json.dumps(body, separators=(",", ":")).encode("utf-8")
    headers = {"Content-Type": "application/json"}
    secret = os.environ.get("FAL_WEBHOOK_SECRET")
    if secret:
        sig = hmac.new(secret.encode("utf-8"), raw, hashlib.sha256).hexdigest()
        headers["x-fal-webhook-signature"] = sig
    try:
        resp = requests.post(url, data=raw, headers=headers, timeout=10)
        if not resp.ok:
            logger.warning("webhook POST %s returned %s: %s", url, resp.status_code, resp.text[:200])
    except Exception as e:
        logger.warning("webhook POST %s failed: %s", url, e)


# ---------------------------------------------------------------------------
# Inference orchestration — falls back to stubs when the model repos aren't
# bundled in the container.
# ---------------------------------------------------------------------------

def _gvm_available() -> bool:
    try:
        import gvm_core  # noqa: F401
        return True
    except ImportError:
        return False


def _corridorkey_available() -> bool:
    try:
        from CorridorKeyModule.backend import create_engine  # noqa: F401
        return True
    except ImportError:
        return False


def _run_gvm(frames_dir: Path, hints_dir: Path) -> None:
    """Run GVM batch sequence → grayscale alpha hint PNGs in `hints_dir`."""
    hints_dir.mkdir(parents=True, exist_ok=True)
    if _gvm_available():
        from gvm_core.wrapper import GVMProcessor

        processor = GVMProcessor(device="cuda")
        processor.process_sequence(
            input_path=str(frames_dir),
            output_dir=str(hints_dir.parent),
            num_frames_per_batch=1,
            decode_chunk_size=1,
            denoise_steps=1,
            mode="matte",
            direct_output_dir=str(hints_dir),
        )
        return

    # Stub: green-threshold each frame
    _green_threshold_stub(frames_dir, hints_dir)


def _green_threshold_stub(frames_dir: Path, hints_dir: Path) -> None:
    import cv2
    import numpy as np

    for frame_path in _source_frames(frames_dir):
        img = cv2.imread(str(frame_path), cv2.IMREAD_COLOR)
        if img is None:
            continue
        rgb = cv2.cvtColor(img, cv2.COLOR_BGR2RGB).astype(np.float32) / 255.0
        r, g, b = rgb[..., 0], rgb[..., 1], rgb[..., 2]
        green_excess = g - np.maximum(r, b)
        alpha = (1.0 - np.clip(green_excess * 3.0, 0.0, 1.0)) * 255
        cv2.imwrite(str(hints_dir / f"{frame_path.stem}.png"), alpha.astype("uint8"))


def _run_corridorkey(
    frames_dir: Path,
    hints_dir: Path,
    out_dir: Path,
    settings: InferenceSettings,
    output_config: OutputConfig,
) -> dict[str, list[Path]]:
    """Run CorridorKey per frame, return paths to outputs grouped by kind."""
    import cv2
    import numpy as np

    out_dir.mkdir(parents=True, exist_ok=True)
    (out_dir / "matte").mkdir(exist_ok=True)
    (out_dir / "fg").mkdir(exist_ok=True)
    (out_dir / "comp").mkdir(exist_ok=True)
    (out_dir / "processed").mkdir(exist_ok=True)

    engine = None
    if _corridorkey_available():
        try:
            from CorridorKeyModule.backend import create_engine
            engine = create_engine(device="cuda")
        except Exception as e:
            logger.warning("CorridorKey engine init failed (%s) — falling back to stub", e)

    outputs: dict[str, list[Path]] = {"matte": [], "fg": [], "comp": [], "processed": []}

    frame_files = _source_frames(frames_dir)
    for frame_path in frame_files:
        name = frame_path.stem
        bgr = cv2.imread(str(frame_path), cv2.IMREAD_COLOR)
        if bgr is None:
            continue
        rgb = cv2.cvtColor(bgr, cv2.COLOR_BGR2RGB).astype(np.float32) / 255.0
        hint_path = hints_dir / f"{name}.png"
        if hint_path.exists():
            hint_img = cv2.imread(str(hint_path), cv2.IMREAD_GRAYSCALE)
            hint = (hint_img.astype(np.float32) / 255.0) if hint_img is not None else None
        else:
            hint = None

        if engine is not None:
            try:
                result = engine.process_frame(
                    rgb, hint,
                    refiner_scale=settings.refinerScale,
                    input_is_linear=settings.inputIsLinear,
                    despill_strength=settings.despillStrength,
                    auto_despeckle=settings.autoDespeckle,
                    despeckle_size=settings.despeckleSize,
                )
                if isinstance(result, list):
                    result = result[0]
                matte = result.get("alpha")
                fg = result.get("fg")
                comp = result.get("comp")
                processed = result.get("processed")
            except Exception as e:
                logger.warning("CorridorKey process_frame failed (%s) — falling back to stub for %s", e, name)
                matte, fg, comp, processed = _stub_outputs(rgb, hint)
        else:
            matte, fg, comp, processed = _stub_outputs(rgb, hint)

        if output_config.matteEnabled:
            mp = out_dir / "matte" / f"{name}.png"
            cv2.imwrite(str(mp), (np.clip(matte.squeeze(), 0, 1) * 255).astype("uint8"))
            outputs["matte"].append(mp)
        if output_config.fgEnabled:
            fp = out_dir / "fg" / f"{name}.png"
            cv2.imwrite(str(fp), cv2.cvtColor((np.clip(fg, 0, 1) * 255).astype("uint8"), cv2.COLOR_RGB2BGR))
            outputs["fg"].append(fp)
        if output_config.compEnabled or output_config.generateCompPreview:
            cp = out_dir / "comp" / f"{name}.png"
            cv2.imwrite(str(cp), cv2.cvtColor((np.clip(comp, 0, 1) * 255).astype("uint8"), cv2.COLOR_RGB2BGR))
            outputs["comp"].append(cp)
        if output_config.processedEnabled:
            pp = out_dir / "processed" / f"{name}.png"
            # processed = RGBA premult — save with alpha
            rgba = (np.clip(processed, 0, 1) * 255).astype("uint8")
            cv2.imwrite(str(pp), cv2.cvtColor(rgba, cv2.COLOR_RGBA2BGRA))
            outputs["processed"].append(pp)

    return outputs


def _stub_outputs(rgb, hint):
    """Green-threshold fallback when CorridorKey isn't available."""
    import numpy as np

    h, w = rgb.shape[:2]
    if hint is not None:
        matte = hint[..., np.newaxis] if hint.ndim == 2 else hint
    else:
        r, g, b = rgb[..., 0], rgb[..., 1], rgb[..., 2]
        green_excess = g - np.maximum(r, b)
        matte = (1.0 - np.clip(green_excess * 4.0, 0.0, 1.0))[..., np.newaxis].astype(np.float32)

    fg = rgb * matte
    # Cheap checkerboard for comp
    y, x = np.arange(h) // 16, np.arange(w) // 16
    gray = np.where((y[:, None] + x[None, :]) % 2, 0.3, 0.2).astype(np.float32)
    checker = np.stack([gray, gray, gray], axis=-1)
    comp = fg + checker * (1.0 - matte)
    processed = np.concatenate([fg, matte], axis=-1)
    return matte, fg, comp, processed


# ---------------------------------------------------------------------------
# fal App
# ---------------------------------------------------------------------------

class KeyingApp(fal.App, keep_alive=300):
    app_name = "corridorkey-studio-key"
    machine_type = "M"    # XS OOMs decoding 1080p; bump to GPU-H100 once CorridorKey/GVM repos bundled
    image = _image

    def setup(self):
        try:
            subprocess.run(["ffmpeg", "-version"], capture_output=True, check=True)
        except Exception as e:
            raise RuntimeError(f"ffmpeg binary not available in container: {e}")

    # -----------------------------------------------------------------------
    # /alpha — GVM only
    # -----------------------------------------------------------------------

    @fal.endpoint("/alpha")
    def alpha(self, input: AlphaInput) -> JobOutput:
        t0 = time.time()
        work_dir = Path(tempfile.mkdtemp(prefix="ck_alpha_"))
        try:
            video_path = work_dir / "source.bin"
            _fetch_url(input.source_url, video_path)

            frames_dir = work_dir / "frames"
            _decode_to_sequence(str(video_path), frames_dir)

            hints_dir = work_dir / "hints"
            _run_gvm(frames_dir, hints_dir)

            hint_files = sorted(hints_dir.glob("*.png"))
            urls = _upload_parallel(hint_files, "image/png")

            frames_out = [
                FrameUpdate(frameNum=i, alphaHintUrl=url)
                for i, url in enumerate(urls)
            ]
            return JobOutput(
                clip_id=input.clip_id,
                frames=frames_out,
                processing_time_s=round(time.time() - t0, 2),
            )
        finally:
            shutil.rmtree(work_dir, ignore_errors=True)

    # -----------------------------------------------------------------------
    # /key — CorridorKey only
    # -----------------------------------------------------------------------

    @fal.endpoint("/key")
    def key(self, input: KeyInput) -> JobOutput:
        t0 = time.time()
        work_dir = Path(tempfile.mkdtemp(prefix="ck_key_"))
        try:
            video_path = work_dir / "source.bin"
            _fetch_url(input.source_url, video_path)

            frames_dir = work_dir / "frames"
            _decode_to_sequence(str(video_path), frames_dir)

            hints_dir = work_dir / "hints"
            hints_dir.mkdir(parents=True, exist_ok=True)
            for i, url in enumerate(input.alpha_hint_urls):
                _fetch_url(url, hints_dir / f"{i:06d}.png")

            out_dir = work_dir / "out"
            outputs = _run_corridorkey(
                frames_dir, hints_dir, out_dir, input.settings, input.output_config
            )

            matte_urls = _upload_parallel(outputs["matte"], "image/png")
            fg_urls = _upload_parallel(outputs["fg"], "image/png")
            comp_urls = _upload_parallel(outputs["comp"], "image/png")
            processed_urls = _upload_parallel(outputs["processed"], "image/png")

            n = max(len(matte_urls), len(fg_urls), len(comp_urls), len(processed_urls))
            frames_out: list[FrameUpdate] = []
            for i in range(n):
                frames_out.append(FrameUpdate(
                    frameNum=i,
                    matteUrl=matte_urls[i] if i < len(matte_urls) else None,
                    fgUrl=fg_urls[i] if i < len(fg_urls) else None,
                    compUrl=comp_urls[i] if i < len(comp_urls) else None,
                    processedUrl=processed_urls[i] if i < len(processed_urls) else None,
                ))

            return JobOutput(
                clip_id=input.clip_id,
                frames=frames_out,
                processing_time_s=round(time.time() - t0, 2),
            )
        finally:
            shutil.rmtree(work_dir, ignore_errors=True)

    # -----------------------------------------------------------------------
    # /pipeline — /alpha then /key, with interim webhook on alpha-done
    # -----------------------------------------------------------------------

    @fal.endpoint("/pipeline")
    def pipeline(self, input: PipelineInput) -> JobOutput:
        t0 = time.time()
        work_dir = Path(tempfile.mkdtemp(prefix="ck_pipeline_"))
        try:
            video_path = work_dir / "source.bin"
            _fetch_url(input.source_url, video_path)

            frames_dir = work_dir / "frames"
            _decode_to_sequence(str(video_path), frames_dir)

            # 1. GVM
            hints_dir = work_dir / "hints"
            _run_gvm(frames_dir, hints_dir)
            hint_files = sorted(hints_dir.glob("*.png"))
            hint_urls = _upload_parallel(hint_files, "image/png")
            alpha_frames = [
                FrameUpdate(frameNum=i, alphaHintUrl=url)
                for i, url in enumerate(hint_urls)
            ]

            # 2. Fire the interim alpha-done webhook so the UI lights up the
            # ALPHA layer before mattes start landing. Failures here are
            # logged but don't fail the run.
            if input.alpha_webhook:
                _post_webhook(input.alpha_webhook, {
                    "request_id": _current_request_id(),
                    "status": "ALPHA_DONE",
                    "payload": {
                        "clip_id": input.clip_id,
                        "frames": [f.model_dump(exclude_none=True) for f in alpha_frames],
                    },
                })

            # 3. CorridorKey
            out_dir = work_dir / "out"
            outputs = _run_corridorkey(
                frames_dir, hints_dir, out_dir, input.settings, input.output_config
            )

            matte_urls = _upload_parallel(outputs["matte"], "image/png")
            fg_urls = _upload_parallel(outputs["fg"], "image/png")
            comp_urls = _upload_parallel(outputs["comp"], "image/png")
            processed_urls = _upload_parallel(outputs["processed"], "image/png")

            n = max(
                len(hint_urls),
                len(matte_urls),
                len(fg_urls),
                len(comp_urls),
                len(processed_urls),
            )
            frames_out: list[FrameUpdate] = []
            for i in range(n):
                frames_out.append(FrameUpdate(
                    frameNum=i,
                    alphaHintUrl=hint_urls[i] if i < len(hint_urls) else None,
                    matteUrl=matte_urls[i] if i < len(matte_urls) else None,
                    fgUrl=fg_urls[i] if i < len(fg_urls) else None,
                    compUrl=comp_urls[i] if i < len(comp_urls) else None,
                    processedUrl=processed_urls[i] if i < len(processed_urls) else None,
                ))

            return JobOutput(
                clip_id=input.clip_id,
                frames=frames_out,
                processing_time_s=round(time.time() - t0, 2),
            )
        finally:
            shutil.rmtree(work_dir, ignore_errors=True)


def _current_request_id() -> str:
    """Best-effort lookup of the current fal request id for interim webhooks.

    fal injects the request id via the FAL_REQUEST_ID env var per invocation.
    Falls back to empty string if unavailable; the Convex receiver will then
    reject the interim webhook (which is the correct behavior — we'd rather
    fail loud than write to a wrong clip).
    """
    return os.environ.get("FAL_REQUEST_ID", "")
