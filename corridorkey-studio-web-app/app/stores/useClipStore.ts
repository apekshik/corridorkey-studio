import { create } from "zustand";
import { ClipEntry, ClipState, ViewMode } from "../lib/types";
import { fetchClips, fetchCoverage } from "../lib/api";

interface ClipStore {
  clips: ClipEntry[];
  selectedClipId: string | null;
  viewMode: ViewMode;
  coverage: { annotations: number[]; alphaHints: number[]; inferenceOutput: number[] };

  selectClip: (id: string) => void;
  setViewMode: (mode: ViewMode) => void;
  setCurrentFrame: (frame: number) => void;
  setInOutPoints: (inPoint: number | null, outPoint: number | null) => void;
  addClip: (clip: ClipEntry) => void;
  removeClip: (id: string) => void;
  updateClipState: (id: string, state: ClipState) => void;
  setClips: (clips: ClipEntry[]) => void;
  setCoverage: (coverage: { annotations: number[]; alphaHints: number[]; inferenceOutput: number[] }) => void;
  refreshClips: () => Promise<void>;
  refreshCoverage: (clipId: string) => Promise<void>;
}

const EMPTY_COVERAGE = { annotations: [], alphaHints: [], inferenceOutput: [] };

export const useClipStore = create<ClipStore>((set, get) => ({
  clips: [],
  selectedClipId: null,
  viewMode: ViewMode.MATTE,
  coverage: EMPTY_COVERAGE,

  selectClip: (id) => {
    set({ selectedClipId: id });
    // Fetch coverage for newly selected clip
    get().refreshCoverage(id);
  },

  setViewMode: (mode) => set({ viewMode: mode }),

  setCurrentFrame: (frame) =>
    set((s) => ({
      clips: s.clips.map((c) =>
        c.id === s.selectedClipId ? { ...c, currentFrame: frame } : c
      ),
    })),

  setInOutPoints: (inPoint, outPoint) =>
    set((s) => ({
      clips: s.clips.map((c) =>
        c.id === s.selectedClipId ? { ...c, inPoint, outPoint } : c
      ),
    })),

  addClip: (clip) =>
    set((s) => {
      const clips = [...s.clips, clip];
      // Auto-select if it's the first clip
      const selectedClipId = s.selectedClipId ?? clip.id;
      return { clips, selectedClipId };
    }),

  removeClip: (id) =>
    set((s) => ({
      clips: s.clips.filter((c) => c.id !== id),
      selectedClipId: s.selectedClipId === id ? null : s.selectedClipId,
    })),

  updateClipState: (id, state) =>
    set((s) => ({
      clips: s.clips.map((c) => (c.id === id ? { ...c, state } : c)),
    })),

  setClips: (clips) => set({ clips }),

  setCoverage: (coverage) => set({ coverage }),

  refreshClips: async () => {
    try {
      const clips = await fetchClips();
      set({ clips });
    } catch {
      // Server not available — keep current state
    }
  },

  refreshCoverage: async (clipId: string) => {
    try {
      const coverage = await fetchCoverage(clipId);
      set({ coverage });
    } catch {
      set({ coverage: EMPTY_COVERAGE });
    }
  },
}));
