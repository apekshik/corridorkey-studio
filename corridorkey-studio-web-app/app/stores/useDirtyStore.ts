import { create } from "zustand";

/**
 * Tracks whether the current project has unsaved parameter edits.
 *
 * Any ParameterPanel change calls `markDirty()`; the TopBar Save button
 * (and ⌘S) calls `markClean(lastSavedAt)` after the mutation returns.
 * On project switch, the hydrate effect resets both.
 */
interface DirtyStore {
  dirty: boolean;
  lastSavedAt: number | null;

  markDirty: () => void;
  markClean: (lastSavedAt: number) => void;
  reset: (lastSavedAt: number | null) => void;
}

export const useDirtyStore = create<DirtyStore>((set) => ({
  dirty: false,
  lastSavedAt: null,

  markDirty: () => set({ dirty: true }),
  markClean: (lastSavedAt) => set({ dirty: false, lastSavedAt }),
  reset: (lastSavedAt) => set({ dirty: false, lastSavedAt }),
}));
