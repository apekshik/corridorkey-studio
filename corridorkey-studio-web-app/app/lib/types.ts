export enum ClipState {
  EXTRACTING = "EXTRACTING",
  RAW = "RAW",
  MASKED = "MASKED",
  READY = "READY",
  COMPLETE = "COMPLETE",
  ERROR = "ERROR",
}

export enum JobType {
  INFERENCE = "INFERENCE",
  GVM_ALPHA = "GVM_ALPHA",
  VIDEOMAMA_ALPHA = "VIDEOMAMA_ALPHA",
  PREVIEW = "PREVIEW",
  VIDEO_EXTRACT = "VIDEO_EXTRACT",
}

export enum JobStatus {
  QUEUED = "QUEUED",
  RUNNING = "RUNNING",
  COMPLETE = "COMPLETE",
  CANCELLED = "CANCELLED",
  ERROR = "ERROR",
}

export enum ViewMode {
  INPUT = "INPUT",
  ALPHA = "ALPHA",
  FG = "FG",
  MATTE = "MATTE",
  COMP = "COMP",
  PROCESSED = "PROCESSED",
}

export enum BackendMode {
  LOCAL = "LOCAL",
  CLOUD = "CLOUD",
}

export interface ClipEntry {
  id: string;
  name: string;
  state: ClipState;
  frameCount: number;
  currentFrame: number;
  inPoint: number | null;
  outPoint: number | null;
  thumbnailUrl: string | null;
  warnings: string[];
  errorMessage: string | null;
}

export interface InferenceParams {
  inputIsLinear: boolean;
  despillStrength: number;
  autoDespeckle: boolean;
  despeckleSize: number;
  refinerScale: number;
}

export interface OutputConfig {
  fgEnabled: boolean;
  fgFormat: "exr" | "png";
  fgPremult: "premult" | "straight";
  matteEnabled: boolean;
  matteFormat: "exr" | "png";
  compEnabled: boolean;
  compFormat: "exr" | "png";
  processedEnabled: boolean;
  processedFormat: "exr" | "png";
  generateCompPreview: boolean;
}

export interface GPUJob {
  id: string;
  clipName: string;
  type: JobType;
  status: JobStatus;
  progress: number;
  totalFrames: number;
  currentFrame: number;
}

export interface GPUInfo {
  name: string;
  vramUsed: number;
  vramTotal: number;
}

export const CLIP_STATE_COLORS: Record<ClipState, string> = {
  [ClipState.EXTRACTING]: "#f97316",
  [ClipState.RAW]: "#888",
  [ClipState.MASKED]: "#3b82f6",
  [ClipState.READY]: "#eab308",
  [ClipState.COMPLETE]: "#22c55e",
  [ClipState.ERROR]: "#ef4444",
};

export const DEFAULT_INFERENCE_PARAMS: InferenceParams = {
  inputIsLinear: false,
  despillStrength: 1.0,
  autoDespeckle: true,
  despeckleSize: 400,
  refinerScale: 1.0,
};

export const DEFAULT_OUTPUT_CONFIG: OutputConfig = {
  fgEnabled: true,
  fgFormat: "exr",
  fgPremult: "premult",
  matteEnabled: true,
  matteFormat: "exr",
  compEnabled: false,
  compFormat: "png",
  processedEnabled: true,
  processedFormat: "exr",
  generateCompPreview: true,
};
