import { create } from "zustand";
import {
  InferenceParams,
  OutputConfig,
  BackendMode,
  GPUInfo,
  DEFAULT_INFERENCE_PARAMS,
  DEFAULT_OUTPUT_CONFIG,
} from "../lib/types";
import { setServerUrl as setApiServerUrl } from "../lib/api";

export type ConnectionStatus = "disconnected" | "connecting" | "connected";

interface SettingsStore {
  inferenceParams: InferenceParams;
  outputConfig: OutputConfig;
  backendMode: BackendMode;
  gpu: GPUInfo;
  settingsPanelOpen: boolean;
  connectionStatus: ConnectionStatus;
  serverUrl: string;

  setInferenceParam: <K extends keyof InferenceParams>(key: K, value: InferenceParams[K]) => void;
  setOutputConfig: <K extends keyof OutputConfig>(key: K, value: OutputConfig[K]) => void;
  toggleBackendMode: () => void;
  toggleSettingsPanel: () => void;
  setGPU: (gpu: GPUInfo) => void;
  setConnectionStatus: (status: ConnectionStatus) => void;
  setServerUrl: (url: string) => void;
}

export const useSettingsStore = create<SettingsStore>((set) => ({
  inferenceParams: DEFAULT_INFERENCE_PARAMS,
  outputConfig: DEFAULT_OUTPUT_CONFIG,
  backendMode: BackendMode.CLOUD,
  gpu: { name: "—", vramUsed: 0, vramTotal: 0 },
  settingsPanelOpen: true,
  connectionStatus: "disconnected",
  serverUrl: "http://localhost:8000",

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
  setConnectionStatus: (status) => set({ connectionStatus: status }),
  setServerUrl: (url) => {
    setApiServerUrl(url);
    set({ serverUrl: url });
  },
}));
