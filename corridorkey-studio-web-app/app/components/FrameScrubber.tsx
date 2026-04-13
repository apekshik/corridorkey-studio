"use client";

import {
  SkipBack,
  ChevronLeft,
  Play,
  Pause,
  ChevronRight,
  SkipForward,
} from "lucide-react";
import { useState, useCallback, useRef } from "react";
import { useClipStore } from "../stores/useClipStore";

export default function FrameScrubber() {
  const clips = useClipStore((s) => s.clips);
  const selectedId = useClipStore((s) => s.selectedClipId);
  const coverage = useClipStore((s) => s.coverage);
  const setCurrentFrame = useClipStore((s) => s.setCurrentFrame);
  const [playing, setPlaying] = useState(false);
  const trackRef = useRef<HTMLDivElement>(null);

  const clip = clips.find((c) => c.id === selectedId);

  if (!clip) {
    return (
      <div className="shrink-0 border-t border-[var(--border)] bg-[var(--surface)]">
        <div className="h-10 bg-[#111] border-b border-[var(--border)]" />
        <div className="flex items-center justify-center py-2">
          <span className="text-[10px] text-[var(--text-muted)]">NO CLIP SELECTED</span>
        </div>
      </div>
    );
  }

  const pct = clip.currentFrame / Math.max(1, clip.frameCount - 1);

  const seekFromEvent = (e: React.MouseEvent | MouseEvent) => {
    const track = trackRef.current;
    if (!track) return;
    const rect = track.getBoundingClientRect();
    const x = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
    setCurrentFrame(Math.round(x * (clip.frameCount - 1)));
  };

  const onTrackMouseDown = (e: React.MouseEvent) => {
    seekFromEvent(e);
    const onMove = (ev: MouseEvent) => seekFromEvent(ev);
    const onUp = () => {
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
    };
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
  };

  const transportBtn =
    "p-1.5 text-[var(--text-muted)] hover:text-[var(--text)] cursor-pointer transition-colors";

  return (
    <div className="border-t border-[var(--border)] bg-[var(--surface)] shrink-0">
      {/* Timeline track */}
      <div
        ref={trackRef}
        className="relative h-10 cursor-pointer mx-3 mt-2"
        onMouseDown={onTrackMouseDown}
      >
        {/* Background */}
        <div className="absolute inset-0 bg-[#161616] border border-[var(--border)]" />

        {/* Coverage layers — stacked, translucent */}
        <CoverageLane
          frames={coverage.alphaHints}
          total={clip.frameCount}
          color="rgba(255,255,255,0.06)"
          height="100%"
        />
        <CoverageLane
          frames={coverage.inferenceOutput}
          total={clip.frameCount}
          color="rgba(255,50,50,0.2)"
          height="100%"
        />
        <CoverageLane
          frames={coverage.annotations}
          total={clip.frameCount}
          color="rgba(34,197,94,0.5)"
          height="4px"
          bottom
        />

        {/* In/Out markers */}
        {clip.inPoint !== null && (
          <div
            className="absolute top-0 bottom-0 border-l-2 border-[var(--warning)]"
            style={{ left: `${(clip.inPoint / clip.frameCount) * 100}%` }}
          />
        )}
        {clip.outPoint !== null && (
          <div
            className="absolute top-0 bottom-0 border-r-2 border-[var(--warning)]"
            style={{ left: `${(clip.outPoint / clip.frameCount) * 100}%` }}
          />
        )}

        {/* Playhead */}
        <div
          className="absolute top-0 bottom-0 w-px bg-white z-10"
          style={{ left: `${pct * 100}%` }}
        >
          {/* Head marker */}
          <div className="absolute -top-0.5 left-1/2 -translate-x-1/2 w-2.5 h-1.5 bg-white" />
        </div>
      </div>

      {/* Controls row */}
      <div className="flex items-center justify-between px-3 py-1.5">
        {/* Transport */}
        <div className="flex items-center gap-0">
          <button className={transportBtn} onClick={() => setCurrentFrame(0)}>
            <SkipBack size={14} />
          </button>
          <button
            className={transportBtn}
            onClick={() => setCurrentFrame(Math.max(0, clip.currentFrame - 1))}
          >
            <ChevronLeft size={14} />
          </button>
          <button
            className={`${transportBtn} text-[var(--text)]`}
            onClick={() => setPlaying(!playing)}
          >
            {playing ? <Pause size={14} /> : <Play size={14} fill="currentColor" />}
          </button>
          <button
            className={transportBtn}
            onClick={() =>
              setCurrentFrame(Math.min(clip.frameCount - 1, clip.currentFrame + 1))
            }
          >
            <ChevronRight size={14} />
          </button>
          <button
            className={transportBtn}
            onClick={() => setCurrentFrame(clip.frameCount - 1)}
          >
            <SkipForward size={14} />
          </button>
        </div>

        {/* Frame info */}
        <div className="flex items-center gap-4 text-[10px] tabular-nums">
          <span className="text-[var(--text)]">
            {clip.currentFrame}
            <span className="text-[var(--text-muted)]"> / {clip.frameCount}</span>
          </span>
          {clip.inPoint !== null && clip.outPoint !== null && (
            <span className="text-[var(--warning)]">
              [{clip.inPoint}–{clip.outPoint}]
            </span>
          )}
        </div>

        {/* Timecode / coverage legend */}
        <div className="flex items-center gap-3 text-[8px] text-[var(--text-muted)]">
          <span className="flex items-center gap-1">
            <span className="w-2 h-2 bg-[rgba(255,255,255,0.15)] inline-block" />
            ALPHA
          </span>
          <span className="flex items-center gap-1">
            <span className="w-2 h-2 bg-[rgba(255,50,50,0.5)] inline-block" />
            KEYED
          </span>
          <span className="flex items-center gap-1">
            <span className="w-2 h-2 bg-[rgba(34,197,94,0.6)] inline-block" />
            ANNOTATED
          </span>
        </div>
      </div>
    </div>
  );
}

function CoverageLane({
  frames,
  total,
  color,
  height = "100%",
  bottom = false,
}: {
  frames: number[];
  total: number;
  color: string;
  height?: string;
  bottom?: boolean;
}) {
  const segments = new Set(frames);
  return (
    <div
      className={`absolute left-0 right-0 overflow-hidden pointer-events-none ${
        bottom ? "bottom-0" : "top-0"
      }`}
      style={{ height }}
    >
      {Array.from(segments).map((f) => (
        <div
          key={f}
          className="absolute inset-y-0"
          style={{
            left: `${(f / total) * 100}%`,
            width: `${Math.max(0.3, 100 / total)}%`,
            background: color,
          }}
        />
      ))}
    </div>
  );
}
