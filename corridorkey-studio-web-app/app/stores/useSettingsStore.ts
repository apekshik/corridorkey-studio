import { create } from "zustand";
import {
  InferenceParams,
  OutputConfig,
  BackendMode,
  GPUInfo,
  DEFAULT_INFERENCE_PARAMS,
  DEFAULT_OUTPUT_CONFIG,
} from "../lib/types";
import { MOCK_GPU } from "../lib/mock-data";

interface SettingsStore {
  inferenceParams: InferenceParams;
  outputConfig: OutputConfig;
  backendMode: BackendMode;
  gpu: GPUInfo;
  settingsPanelOpen: boolean;

  setInferenceParam: <K extends keyof InferenceParams>(key: K, value: InferenceParams[K]) => void;
  setOutputConfig: <K extends keyof OutputConfig>(key: K, value: OutputConfig[K]) => void;
  toggleBackendMode: () => void;
  toggleSettingsPanel: () => void;
  setGPU: (gpu: GPUInfo) => void;
}

export const useSettingsStore = create<SettingsStore>((set) => ({
  inferenceParams: DEFAULT_INFERENCE_PARAMS,
  outputConfig: DEFAULT_OUTPUT_CONFIG,
  backendMode: BackendMode.LOCAL,
  gpu: MOCK_GPU,
  settingsPanelOpen: true,

  setInferenceParam: (key, value) =>
    set((s) => ({
      inferenceParams: { ...s.inferenceParams, [key]: value },
    })),

  setOutputConfig: (key, value) =>
    set((s) => ({
      outputConfig: { ...s.outputConfig, [key]: value },
    })),

  toggleBackendMode: () =>
    set((s) => ({
      backendMode:
        s.backendMode === BackendMode.LOCAL
          ? BackendMode.CLOUD
          : BackendMode.LOCAL,
    })),

  toggleSettingsPanel: () => set((s) => ({ settingsPanelOpen: !s.settingsPanelOpen })),

  setGPU: (gpu) => set({ gpu }),
}));
