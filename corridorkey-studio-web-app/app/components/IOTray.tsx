"use client";

import { Plus } from "lucide-react";
import { useClipStore } from "../stores/useClipStore";
import { ClipState, CLIP_STATE_COLORS } from "../lib/types";

export default function IOTray() {
  const clips = useClipStore((s) => s.clips);
  const selectedId = useClipStore((s) => s.selectedClipId);
  const selectClip = useClipStore((s) => s.selectClip);

  const inputClips = clips.filter((c) => c.state !== ClipState.COMPLETE);
  const exportClips = clips.filter((c) => c.state === ClipState.COMPLETE);

  return (
    <div className="flex border-t border-[var(--border)] shrink-0 h-20 bg-[var(--surface)]">
      {/* Input strip */}
      <div className="flex-1 flex flex-col border-r border-[var(--border)]">
        <div className="px-3 py-1 text-[10px] uppercase tracking-wider text-[var(--text-muted)] border-b border-[var(--border)] flex items-center justify-between">
          <span>INPUT ({inputClips.length})</span>
          <button className="flex items-center gap-1 text-[var(--text-muted)] hover:text-[var(--text)] cursor-pointer transition-colors">
            <Plus size={10} />
            ADD
          </button>
        </div>
        <div className="flex-1 flex items-center gap-2 px-3 overflow-x-auto">
          {inputClips.map((clip) => (
            <ClipThumb
              key={clip.id}
              clip={clip}
              selected={clip.id === selectedId}
              onClick={() => selectClip(clip.id)}
            />
          ))}
        </div>
      </div>

      {/* Exports strip */}
      <div className="w-[280px] flex flex-col">
        <div className="px-3 py-1 text-[10px] uppercase tracking-wider text-[var(--text-muted)] border-b border-[var(--border)]">
          EXPORTS ({exportClips.length})
        </div>
        <div className="flex-1 flex items-center gap-2 px-3 overflow-x-auto">
          {exportClips.map((clip) => (
            <ClipThumb
              key={clip.id}
              clip={clip}
              selected={clip.id === selectedId}
              onClick={() => selectClip(clip.id)}
            />
          ))}
        </div>
      </div>
    </div>
  );
}

function ClipThumb({
  clip,
  selected,
  onClick,
}: {
  clip: { id: string; name: string; state: ClipState };
  selected: boolean;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={`shrink-0 flex flex-col items-center gap-1 cursor-pointer transition-colors ${
        selected ? "opacity-100" : "opacity-60 hover:opacity-80"
      }`}
    >
      <div
        className={`w-16 h-10 bg-[var(--surface-2)] border flex items-center justify-center relative ${
          selected ? "border-[var(--text)]" : "border-[var(--border)]"
        }`}
      >
        <span className="text-[8px] text-[var(--text-muted)]">
          {clip.name.slice(0, 6)}
        </span>
        {/* State badge */}
        <div
          className="absolute top-0.5 right-0.5 w-2 h-2"
          style={{ background: CLIP_STATE_COLORS[clip.state] }}
        />
      </div>
      <span className="text-[8px] text-[var(--text-muted)] max-w-16 truncate">
        {clip.name}
      </span>
    </button>
  );
}
