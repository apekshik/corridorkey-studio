"""Pydantic models mirroring the TypeScript types (camelCase JSON output)."""

from __future__ import annotations

from typing import Literal

from pydantic import BaseModel, ConfigDict
from pydantic.alias_generators import to_camel

from .enums import ClipState, JobStatus, JobType


class CamelModel(BaseModel):
    model_config = ConfigDict(
        alias_generator=to_camel,
        populate_by_name=True,
    )


# --- GPU / Health ---


class GPUInfo(CamelModel):
    name: str
    vram_used: float
    vram_total: float


class HealthResponse(CamelModel):
    gpu: GPUInfo
    version: str
    gpu_available: bool
    models_loaded: list[str] = []


# --- Clips ---


class ClipEntry(CamelModel):
    id: str
    name: str
    state: ClipState
    frame_count: int
    current_frame: int = 0
    in_point: int | None = None
    out_point: int | None = None
    thumbnail_url: str | None = None
    warnings: list[str] = []
    error_message: str | None = None


class ClipUpdate(CamelModel):
    in_point: int | None = None
    out_point: int | None = None
    current_frame: int | None = None


# --- Inference Parameters ---


class InferenceParams(CamelModel):
    input_is_linear: bool = False
    despill_strength: float = 1.0
    auto_despeckle: bool = True
    despeckle_size: int = 400
    refiner_scale: float = 1.0
    live_preview: bool = False


class OutputConfig(CamelModel):
    fg_enabled: bool = True
    fg_format: Literal["exr", "png"] = "exr"
    matte_enabled: bool = True
    matte_format: Literal["exr", "png"] = "exr"
    comp_enabled: bool = True
    comp_format: Literal["exr", "png"] = "png"
    processed_enabled: bool = True
    processed_format: Literal["exr", "png"] = "exr"


# --- Jobs ---


class GPUJob(CamelModel):
    id: str
    clip_name: str
    type: JobType
    status: JobStatus
    progress: float = 0.0
    total_frames: int = 0
    current_frame: int = 0


class JobCreate(CamelModel):
    clip_id: str
    type: JobType
    params: InferenceParams | None = None


class KeyRequest(CamelModel):
    mode: Literal["selected", "all-ready", "all-pipeline"]
    clip_id: str | None = None
    inference_params: InferenceParams = InferenceParams()
    output_config: OutputConfig = OutputConfig()
