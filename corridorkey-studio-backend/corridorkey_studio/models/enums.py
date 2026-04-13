"""Enums matching the TypeScript types in the web app."""

from enum import Enum


class ClipState(str, Enum):
    EXTRACTING = "EXTRACTING"
    RAW = "RAW"
    MASKED = "MASKED"
    READY = "READY"
    COMPLETE = "COMPLETE"
    ERROR = "ERROR"


class JobType(str, Enum):
    INFERENCE = "INFERENCE"
    GVM_ALPHA = "GVM_ALPHA"
    VIDEOMAMA_ALPHA = "VIDEOMAMA_ALPHA"
    PREVIEW = "PREVIEW"
    VIDEO_EXTRACT = "VIDEO_EXTRACT"


class JobStatus(str, Enum):
    QUEUED = "QUEUED"
    RUNNING = "RUNNING"
    COMPLETE = "COMPLETE"
    CANCELLED = "CANCELLED"
    ERROR = "ERROR"


class ViewMode(str, Enum):
    INPUT = "INPUT"
    FG = "FG"
    MATTE = "MATTE"
    COMP = "COMP"
    PROCESSED = "PROCESSED"


class BackendMode(str, Enum):
    LOCAL = "LOCAL"
    CLOUD = "CLOUD"
