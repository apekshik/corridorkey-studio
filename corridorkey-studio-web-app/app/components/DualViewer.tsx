"use client";

import { useState } from "react";
import { Columns2, Square } from "lucide-react";
import { useClipStore } from "../stores/useClipStore";
import { useSettingsStore } from "../stores/useSettingsStore";
import { ViewMode } from "../lib/types";
import { frameUrl } from "../lib/api";
import { useBlobUrl } from "../lib/useBlobUrl";

const OUTPUT_MODES = [ViewMode.ALPHA, ViewMode.FG, ViewMode.MATTE, ViewMode.COMP, ViewMode.PROCESSED];
const ALL_MODES = [ViewMode.INPUT, ...OUTPUT_MODES];

// Map ViewMode to the backend layer query param
const LAYER_MAP: Record<string, string> = {
  [ViewMode.INPUT]: "input",
  [ViewMode.ALPHA]: "alpha_hint",
  [ViewMode.FG]: "fg",
  [ViewMode.MATTE]: "matte",
  [ViewMode.COMP]: "comp",
  [ViewMode.PROCESSED]: "processed",
};

export default function DualViewer() {
  const clips = useClipStore((s) => s.clips);
  const selectedId = useClipStore((s) => s.selectedClipId);
  const viewMode = useClipStore((s) => s.viewMode);
  const setViewMode = useClipStore((s) => s.setViewMode);
  const connected = useSettingsStore((s) => s.connectionStatus) === "connected";
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
              <FrameView clipId={clip.id} frame={clip.currentFrame} layer="input" connected={connected} />
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
            <FrameView
              clipId={clip.id}
              frame={clip.currentFrame}
              layer={LAYER_MAP[viewMode] || "input"}
              connected={connected}
            />
          ) : (
            <span className="text-[var(--text-muted)] text-[10px]">NO OUTPUT</span>
          )}
        </div>
      </div>
    </div>
  );
}

function FrameView({
  clipId,
  frame,
  layer,
  connected,
}: {
  clipId: string;
  frame: number;
  layer: string;
  connected: boolean;
}) {
  const url = connected ? frameUrl(clipId, frame, layer) : null;
  const blobSrc = useBlobUrl(url);

  if (!connected) {
    return (
      <div className="text-[var(--text-muted)] text-xs text-center">
        <div className="w-64 h-44 border border-[var(--border)] flex items-center justify-center mb-2 bg-[#1a1a1a]">
          <span className="text-[10px]">SERVER OFFLINE</span>
        </div>
      </div>
    );
  }

  if (!blobSrc) {
    return (
      <div className="text-[var(--text-muted)] text-xs text-center">
        <div className="w-64 h-44 border border-[var(--border)] flex items-center justify-center mb-2 bg-[#1a1a1a]">
          <span className="text-[10px]">{layer.toUpperCase()} — FRAME {frame}</span>
        </div>
      </div>
    );
  }

  return (
    <img
      key={`${clipId}-${layer}-${frame}`}
      src={blobSrc}
      alt={`${layer} frame ${frame}`}
      className="max-w-full max-h-full object-contain"
    />
  );
}
