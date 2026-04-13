"use client";

import { useState } from "react";
import { Columns2, Square } from "lucide-react";
import { useClipStore } from "../stores/useClipStore";
import { ViewMode } from "../lib/types";

const OUTPUT_MODES = [ViewMode.FG, ViewMode.MATTE, ViewMode.COMP, ViewMode.PROCESSED];
const ALL_MODES = [ViewMode.INPUT, ...OUTPUT_MODES];

export default function DualViewer() {
  const clips = useClipStore((s) => s.clips);
  const selectedId = useClipStore((s) => s.selectedClipId);
  const viewMode = useClipStore((s) => s.viewMode);
  const setViewMode = useClipStore((s) => s.setViewMode);
  const clip = clips.find((c) => c.id === selectedId);
  const [split, setSplit] = useState(true);

  const modes = split ? OUTPUT_MODES : ALL_MODES;

  return (
    <div className="flex flex-1 min-h-0">
      {/* Input viewer — only in split mode */}
      {split && (
        <div className="flex-1 flex flex-col border-r border-[var(--border)]">
          <div className="px-3 py-1 text-[10px] uppercase tracking-wider text-[var(--text-muted)] border-b border-[var(--border)] flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span>INPUT</span>
              {clip && (
                <span>{clip.frameCount} frames</span>
              )}
            </div>
            <button
              onClick={() => setSplit(false)}
              className="text-[var(--text-muted)] hover:text-[var(--text)] cursor-pointer transition-colors"
              title="Single view"
            >
              <Square size={12} />
            </button>
          </div>
          <div className="flex-1 flex items-center justify-center bg-[#0e0e0e]">
            {clip ? (
              <div className="text-[var(--text-muted)] text-xs text-center">
                <div className="w-64 h-44 border border-[var(--border)] flex items-center justify-center mb-2 bg-[#1a1a1a]">
                  <span className="text-[10px]">FRAME {clip.currentFrame}</span>
                </div>
                <span className="text-[10px]">{clip.name}</span>
              </div>
            ) : (
              <span className="text-[var(--text-muted)] text-[10px]">NO INPUT</span>
            )}
          </div>
        </div>
      )}

      {/* Output viewer */}
      <div className="flex-1 flex flex-col">
        <div className="border-b border-[var(--border)] flex items-center justify-between">
          <div className="flex items-center">
            {!split && (
              <button
                onClick={() => setSplit(true)}
                className="px-3 py-1 text-[var(--text-muted)] hover:text-[var(--text)] cursor-pointer transition-colors border-r border-[var(--border)]"
                title="Split view"
              >
                <Columns2 size={12} />
              </button>
            )}
            {modes.map((mode) => (
              <button
                key={mode}
                onClick={() => setViewMode(mode)}
                className={`px-3 py-1 text-[10px] uppercase tracking-wider font-bold cursor-pointer transition-colors border-r border-[var(--border)] ${
                  viewMode === mode
                    ? "bg-[var(--accent)] text-white"
                    : "text-[var(--text-muted)] hover:text-[var(--text)] hover:bg-[var(--surface-2)]"
                }`}
              >
                {mode}
              </button>
            ))}
          </div>
          {clip && (
            <span className="px-3 text-[10px] uppercase tracking-wider text-[var(--success)]">
              {clip.state}
            </span>
          )}
        </div>
        <div className="flex-1 flex items-center justify-center bg-[#0e0e0e]">
          {clip ? (
            <div className="text-[var(--text-muted)] text-xs text-center">
              <div className="w-64 h-44 border border-[var(--border)] flex items-center justify-center mb-2 bg-black">
                <span className="text-[10px]">
                  {viewMode === ViewMode.INPUT ? "" : `${viewMode} — `}FRAME {clip.currentFrame}
                </span>
              </div>
              <span className="text-[10px]">
                {viewMode === ViewMode.INPUT ? clip.name : `${viewMode} OUTPUT`}
              </span>
            </div>
          ) : (
            <span className="text-[var(--text-muted)] text-[10px]">NO OUTPUT</span>
          )}
        </div>
      </div>
    </div>
  );
}
