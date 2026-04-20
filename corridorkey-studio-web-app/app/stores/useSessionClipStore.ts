import { create } from "zustand";

/**
 * A "session clip" is a clip the user is currently working on but has not
 * saved to Convex. When the user drops a video:
 *   1. Upload to fal CDN
 *   2. Call the extract fal endpoint
 *   3. Populate this store
 *
 * Closing the tab or dropping a different video blows it away. Nothing here
 * is reactive / cross-device — that's what explicit save is for (slice 4).
 */

export type SessionStage =
  | "idle"             // nothing loaded
  | "uploading"        // video uploading to fal CDN
  | "extracting"       // fal extract endpoint running
  | "ready"            // preview frames available, user can scrub
  | "error";

interface SessionMeta {
  name: string;
  sourceUrl: string;
  thumbnailUrl: string;
  previewFrameUrls: string[];   // one per source frame
  frameCount: number;
  fps: number;
  durationS: number;
  width: number;
  height: number;
  codec: string;
}

interface SessionClipStore {
  stage: SessionStage;
  progress: number;              // 0..1 coarse progress for uploading stage
  errorMessage: string | null;
  meta: SessionMeta | null;

  // UI state tied to the session clip
  currentFrame: number;
  inPoint: number | null;
  outPoint: number | null;

  // Mutators
  setStage: (stage: SessionStage) => void;
  setProgress: (p: number) => void;
  setError: (msg: string) => void;
  setMeta: (meta: SessionMeta) => void;
  setCurrentFrame: (f: number) => void;
  setInOut: (inPoint: number | null, outPoint: number | null) => void;
  reset: () => void;
}

export const useSessionClipStore = create<SessionClipStore>((set) => ({
  stage: "idle",
  progress: 0,
  errorMessage: null,
  meta: null,
  currentFrame: 0,
  inPoint: null,
  outPoint: null,

  setStage: (stage) => set({ stage }),
  setProgress: (progress) => set({ progress }),
  setError: (msg) => set({ stage: "error", errorMessage: msg }),
  setMeta: (meta) =>
    set({
      meta,
      stage: "ready",
      currentFrame: 0,
      inPoint: null,
      outPoint: null,
      errorMessage: null,
      progress: 1,
    }),
  setCurrentFrame: (f) => set({ currentFrame: f }),
  setInOut: (inPoint, outPoint) => set({ inPoint, outPoint }),
  reset: () =>
    set({
      stage: "idle",
      progress: 0,
      errorMessage: null,
      meta: null,
      currentFrame: 0,
      inPoint: null,
      outPoint: null,
    }),
}));
