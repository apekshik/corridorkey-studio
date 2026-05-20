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
from fal.toolkit import FAL_MODEL_WEIGHTS_DIR, File, clone_repository
from pydantic import BaseModel, Field

logger = logging.getLogger(__name__)


# ---------------------------------------------------------------------------
# Container image — pytorch base + upstream pyproject deps.
#
# The CorridorKey monorepo is NOT cloned at build time anymore. It's cloned
# into fal's persistent /data volume from setup() via clone_repository(),
# which means bumping _CORRIDORKEY_SHA only requires a code redeploy
# (seconds), not an image rebuild (~20 min).
# ---------------------------------------------------------------------------

# Pin the CorridorKey monorepo to an explicit SHA for reproducibility.
# Bump this when you want a newer model/code revision; no image rebuild.
_CORRIDORKEY_REPO = "https://github.com/apekshik/CorridorKey"
_CORRIDORKEY_SHA = "cddabf3115ddb7d7db3dc212eea4363d7bacb434"

# Base image gives us python + torch 2.8.0 + cuda 12.6 + cudnn 9 already
# wired up, so we don't fight version skew between the torch wheel's bundled
# CUDA runtime and the system CUDA. Same pattern as fal's own
# fal-demos/audio/diffrhythm.py. (cuda 12.1 doesn't exist for torch 2.8 on
# Docker Hub — 12.6 is the lowest tag and is fully A100-compatible.)
_dockerfile = """
FROM pytorch/pytorch:2.8.0-cuda12.6-cudnn9-runtime

ENV DEBIAN_FRONTEND=noninteractive \\
    PYTHONDONTWRITEBYTECODE=1 \\
    PYTHONUNBUFFERED=1 \\
    PIP_NO_CACHE_DIR=1

RUN apt-get update && apt-get install -y --no-install-recommends \\
    ffmpeg \\
    libgl1 libglib2.0-0 \\
    git curl ca-certificates \\
 && rm -rf /var/lib/apt/lists/*

# Upstream pyproject.toml deps minus the mlx/rocm/windows-only extras.
# torch + torchvision come from the base image — don't reinstall.
RUN pip install --upgrade pip \\
 && pip install \\
        timm==1.0.24 \\
        numpy \\
        opencv-python-headless \\
        tqdm \\
        setuptools \\
        diffusers \\
        transformers \\
        accelerate \\
        peft \\
        av \\
        Pillow \\
        PIMS \\
        easydict \\
        imageio \\
        matplotlib \\
        einops \\
        kornia \\
        huggingface-hub \\
        requests

# fal-required packages MUST be installed LAST
RUN pip install \\
        boto3==1.35.74 \\
        protobuf==4.25.1 \\
        pydantic==2.10.6

ENV OPENCV_IO_ENABLE_OPENEXR=1 \\
    CORRIDORKEY_SKIP_COMPILE=1 \\
    HF_HUB_ENABLE_HF_TRANSFER=1

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
        "-vsync", "0",      # older-ffmpeg-compatible name for fps_mode=passthrough
                            # (apt ffmpeg on pytorch's ubuntu base is 4.x)
        "-start_number", "0",
        "-q:v", "2",        # JPEG quality (1=best, 31=worst); 2 ≈ Q95
        out_pattern,
    ]
    result = subprocess.run(cmd, capture_output=True, text=True)
    if result.returncode != 0:
        # ffmpeg's stderr is the only place that tells us what really
        # broke (missing codec, corrupt input, bad PATH). Surface it.
        import shutil as _shutil
        which_ffmpeg = _shutil.which("ffmpeg") or "<not on PATH>"
        try:
            size = Path(video_path).stat().st_size
        except Exception:
            size = -1
        raise RuntimeError(
            f"ffmpeg decode failed (rc={result.returncode}). "
            f"ffmpeg={which_ffmpeg}, input={video_path} ({size} bytes). "
            f"stderr:\n{result.stderr}"
        )
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
# Weights: persistent across cold starts on fal's /data volume.
#
# fal automatically sets HF_HOME=/data/.cache/huggingface, so HuggingFace
# downloads are auto-cached. We additionally pin our weights to predictable
# paths under FAL_MODEL_WEIGHTS_DIR (= /data/.fal/model-weights) so the
# engines can find them without re-resolving the HF cache layout.
# ---------------------------------------------------------------------------

# fal.toolkit returns FAL_MODEL_WEIGHTS_DIR as a PurePosixPath (abstract — no
# filesystem ops). Convert to concrete Path so .exists() / .mkdir() work.
_FAL_WEIGHTS = Path(str(FAL_MODEL_WEIGHTS_DIR))
_CK_WEIGHTS_DIR = _FAL_WEIGHTS / "corridorkey"
_CK_CHECKPOINT = _CK_WEIGHTS_DIR / "CorridorKey_v1.0.pth"
_GVM_WEIGHTS_DIR = _FAL_WEIGHTS / "gvm"

_CK_HF_REPO = "nikopueringer/CorridorKey_v1.0"
_CK_HF_FILE = "CorridorKey_v1.0.pth"
_GVM_HF_REPO = "geyongtao/gvm"


def _ensure_corridorkey_checkpoint() -> Path:
    """Download the CorridorKey .pth on first cold start; reuse after."""
    from huggingface_hub import hf_hub_download

    if _CK_CHECKPOINT.exists():
        return _CK_CHECKPOINT
    _CK_WEIGHTS_DIR.mkdir(parents=True, exist_ok=True)
    logger.info("Downloading CorridorKey checkpoint to %s", _CK_CHECKPOINT)
    path = Path(hf_hub_download(
        repo_id=_CK_HF_REPO,
        filename=_CK_HF_FILE,
        local_dir=str(_CK_WEIGHTS_DIR),
    ))
    # hf_hub_download returns the final on-disk path; pin our stable name
    # to it so downstream code references one canonical path.
    if path != _CK_CHECKPOINT and not _CK_CHECKPOINT.exists():
        _CK_CHECKPOINT.symlink_to(path)
    return _CK_CHECKPOINT


def _ensure_gvm_weights() -> Path:
    """Download the GVM HF tree (~80 GB) on first cold start; reuse after."""
    from huggingface_hub import snapshot_download

    # snapshot_download verifies digests every call, which is slow for an
    # 80 GB tree. Skip entirely once a marker file confirms completion.
    marker = _GVM_WEIGHTS_DIR / ".fal_complete"
    if marker.exists():
        return _GVM_WEIGHTS_DIR

    _GVM_WEIGHTS_DIR.mkdir(parents=True, exist_ok=True)
    logger.info("Downloading GVM weights to %s (one-time, ~80 GB)", _GVM_WEIGHTS_DIR)
    snapshot_download(
        repo_id=_GVM_HF_REPO,
        local_dir=str(_GVM_WEIGHTS_DIR),
        max_workers=8,
    )
    # Atomic completion marker — write+rename so a partial download never
    # gets recognised as complete.
    tmp = _GVM_WEIGHTS_DIR / ".fal_complete.partial"
    tmp.touch()
    tmp.rename(marker)
    return _GVM_WEIGHTS_DIR


# ---------------------------------------------------------------------------
# fal App — engines load once in setup(); endpoints run inference per request.
# ---------------------------------------------------------------------------

class KeyingApp(
    fal.App,
    keep_alive=600,
    max_concurrency=1,     # one job per runner; CK + GVM together hog the GPU
    max_multiplexing=1,    # don't share the runner across concurrent requests
):
    app_name = "corridorkey-studio-key"
    machine_type = "GPU-H100"
    image = _image

    def setup(self):
        # 1. Sanity-check binaries.
        try:
            subprocess.run(["ffmpeg", "-version"], capture_output=True, check=True)
        except Exception as e:
            raise RuntimeError(f"ffmpeg binary not available in container: {e}")

        # 2. Clone the CorridorKey monorepo into /data, pinned to a SHA.
        # `include_to_path=True` puts the clone on sys.path so the
        # CorridorKeyModule + gvm_core packages import directly. Re-running
        # with the same SHA is a no-op (already on /data).
        repo_path = clone_repository(
            _CORRIDORKEY_REPO,
            commit_hash=_CORRIDORKEY_SHA,
            include_to_path=True,
        )
        logger.info("CorridorKey repo ready at %s", repo_path)

        # 3. Make weights available on /data (one-time cost on the very
        # first cold start; idempotent on every subsequent one).
        ck_ckpt = _ensure_corridorkey_checkpoint()
        gvm_dir = _ensure_gvm_weights()

        # 4. Build engines on CUDA. Imports are deferred to setup() so module
        # import doesn't pay torch's startup cost during container probes,
        # and so they happen *after* the repo is on sys.path.
        import torch
        from CorridorKeyModule.inference_engine import CorridorKeyEngine
        from gvm_core.wrapper import GVMProcessor

        logger.info("Loading CorridorKey engine (checkpoint=%s)", ck_ckpt)
        self.ck_engine = CorridorKeyEngine(
            checkpoint_path=str(ck_ckpt),
            device="cuda",
            img_size=2048,
            model_precision=torch.float16,
        )

        logger.info("Loading GVM processor (weights=%s)", gvm_dir)
        self.gvm = GVMProcessor(model_base=str(gvm_dir), device="cuda")
        logger.info("Models loaded — KeyingApp ready.")

    # -----------------------------------------------------------------------
    # Inference helpers — backed by the engines loaded in setup().
    # -----------------------------------------------------------------------

    def _run_gvm(self, frames_dir: Path, hints_dir: Path) -> None:
        """GVM batch sequence → grayscale alpha hint PNGs in `hints_dir`."""
        hints_dir.mkdir(parents=True, exist_ok=True)
        self.gvm.process_sequence(
            input_path=str(frames_dir),
            output_dir=str(hints_dir.parent),
            num_frames_per_batch=1,
            decode_chunk_size=1,
            denoise_steps=1,
            mode="matte",
            direct_output_dir=str(hints_dir),
        )

    def _run_corridorkey(
        self,
        frames_dir: Path,
        hints_dir: Path,
        out_dir: Path,
        settings: InferenceSettings,
        output_config: OutputConfig,
    ) -> dict[str, list[Path]]:
        """CorridorKey per frame → matte/fg/comp/processed PNGs grouped by kind."""
        import cv2
        import numpy as np

        out_dir.mkdir(parents=True, exist_ok=True)
        (out_dir / "matte").mkdir(exist_ok=True)
        (out_dir / "fg").mkdir(exist_ok=True)
        (out_dir / "comp").mkdir(exist_ok=True)
        (out_dir / "processed").mkdir(exist_ok=True)

        outputs: dict[str, list[Path]] = {"matte": [], "fg": [], "comp": [], "processed": []}

        for frame_path in _source_frames(frames_dir):
            name = frame_path.stem
            bgr = cv2.imread(str(frame_path), cv2.IMREAD_COLOR)
            if bgr is None:
                continue
            rgb = cv2.cvtColor(bgr, cv2.COLOR_BGR2RGB).astype(np.float32) / 255.0

            hint_path = hints_dir / f"{name}.png"
            hint_img = cv2.imread(str(hint_path), cv2.IMREAD_GRAYSCALE) if hint_path.exists() else None
            if hint_img is not None:
                # GVM emits hints at its own internal resolution (often
                # different from the source). CorridorKey's process_frame
                # requires mask.shape == frame.shape[:2], so resize here.
                fh, fw = rgb.shape[:2]
                if hint_img.shape != (fh, fw):
                    hint_img = cv2.resize(hint_img, (fw, fh), interpolation=cv2.INTER_LINEAR)
                mask = hint_img.astype(np.float32) / 255.0
            else:
                mask = np.ones(rgb.shape[:2], dtype=np.float32)

            result = self.ck_engine.process_frame(
                rgb, mask,
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
            comp = result.get("comp", fg)
            processed = result.get("processed")
            if processed is None and matte is not None and fg is not None:
                m3 = matte if matte.ndim == 3 else matte[..., np.newaxis]
                processed = np.concatenate([fg, m3], axis=-1)

            if output_config.matteEnabled and matte is not None:
                mp = out_dir / "matte" / f"{name}.png"
                cv2.imwrite(str(mp), (np.clip(matte.squeeze(), 0, 1) * 255).astype("uint8"))
                outputs["matte"].append(mp)
            if output_config.fgEnabled and fg is not None:
                fp = out_dir / "fg" / f"{name}.png"
                cv2.imwrite(str(fp), cv2.cvtColor((np.clip(fg, 0, 1) * 255).astype("uint8"), cv2.COLOR_RGB2BGR))
                outputs["fg"].append(fp)
            if (output_config.compEnabled or output_config.generateCompPreview) and comp is not None:
                cp = out_dir / "comp" / f"{name}.png"
                cv2.imwrite(str(cp), cv2.cvtColor((np.clip(comp, 0, 1) * 255).astype("uint8"), cv2.COLOR_RGB2BGR))
                outputs["comp"].append(cp)
            if output_config.processedEnabled and processed is not None:
                pp = out_dir / "processed" / f"{name}.png"
                rgba = (np.clip(processed, 0, 1) * 255).astype("uint8")
                cv2.imwrite(str(pp), cv2.cvtColor(rgba, cv2.COLOR_RGBA2BGRA))
                outputs["processed"].append(pp)

        return outputs

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
            self._run_gvm(frames_dir, hints_dir)

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
            outputs = self._run_corridorkey(
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
            self._run_gvm(frames_dir, hints_dir)
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
            outputs = self._run_corridorkey(
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
