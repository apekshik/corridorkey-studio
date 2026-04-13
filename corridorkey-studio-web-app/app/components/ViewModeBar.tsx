"use client";

import { useClipStore } from "../stores/useClipStore";
import { ViewMode } from "../lib/types";

const MODES = [
  ViewMode.INPUT,
  ViewMode.FG,
  ViewMode.MATTE,
  ViewMode.COMP,
  ViewMode.PROCESSED,
];

export default function ViewModeBar() {
  const viewMode = useClipStore((s) => s.viewMode);
  const setViewMode = useClipStore((s) => s.setViewMode);

  return (
    <div className="flex items-center gap-0 border-b border-[var(--border)] shrink-0">
      {MODES.map((mode) => (
        <button
          key={mode}
          onClick={() => setViewMode(mode)}
          className={`px-4 py-1.5 text-[10px] uppercase tracking-wider font-bold cursor-pointer transition-colors border-r border-[var(--border)] ${
            viewMode === mode
              ? "bg-[var(--accent)] text-white"
              : "text-[var(--text-muted)] hover:text-[var(--text)] hover:bg-[var(--surface-2)]"
          }`}
        >
          {mode}
        </button>
      ))}
    </div>
  );
}
