import { create } from "zustand";
import { ClipEntry, ClipState, ViewMode } from "../lib/types";
import { MOCK_CLIPS, MOCK_COVERAGE } from "../lib/mock-data";

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
}

export const useClipStore = create<ClipStore>((set) => ({
  clips: MOCK_CLIPS,
  selectedClipId: MOCK_CLIPS[0].id,
  viewMode: ViewMode.MATTE,
  coverage: MOCK_COVERAGE,

  selectClip: (id) => set({ selectedClipId: id }),
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

  addClip: (clip) => set((s) => ({ clips: [...s.clips, clip] })),

  removeClip: (id) =>
    set((s) => ({
      clips: s.clips.filter((c) => c.id !== id),
      selectedClipId: s.selectedClipId === id ? null : s.selectedClipId,
    })),

  updateClipState: (id, state) =>
    set((s) => ({
      clips: s.clips.map((c) => (c.id === id ? { ...c, state } : c)),
    })),
}));
