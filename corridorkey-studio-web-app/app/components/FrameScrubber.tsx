"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  ChevronLeft,
  ChevronRight,
  Pause,
  Play,
  SkipBack,
  SkipForward,
} from "lucide-react";
import { useSessionClipStore } from "../stores/useSessionClipStore";

/**
 * Scrub strip. Matches DESIGN_MOCK.html §2069–2093:
 *   - transport buttons
 *   - track (ticks, processed-region tint, keyed coverage marks,
 *     keying-edge line, playhead)
 *   - meta row (FR X / Y · TC · fps)
 *
 * Slice 3 ships the whole chrome; the processed region and keying edge
 * are stubbed to 0 until slice 4 populates the `frames` table. Keyframe
 * ticks are empty until the Hint Painter ships (slice 5).
 */
export default function FrameScrubber() {
  const {
    stage,
    meta,
    currentFrame,
    setCurrentFrame,
  } = useSessionClipStore();
  const [playing, setPlaying] = useState(false);
  const trackRef = useRef<HTMLDivElement>(null);

  const ready = stage === "ready" && meta !== null;
  const frameCount = meta?.frameCount ?? 0;
  const fps = meta?.fps ?? 24;

  // Spacebar play/pause.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement).tagName;
      if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return;
      if (e.code === "Space") {
        e.preventDefault();
        if (ready) setPlaying((p) => !p);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [ready]);

  // Playback loop.
  useEffect(() => {
    if (!playing || !ready) return;
    const iv = setInterval(() => {
      const cur = useSessionClipStore.getState();
      if (cur.stage !== "ready" || !cur.meta) return;
      const max = cur.meta.frameCount - 1;
      if (cur.currentFrame >= max) {
        setPlaying(false);
      } else {
        cur.setCurrentFrame(cur.currentFrame + 1);
      }
    }, 1000 / Math.max(1, fps));
    return () => clearInterval(iv);
  }, [playing, ready, fps]);

  const pct = ready ? (currentFrame / Math.max(1, frameCount - 1)) * 100 : 0;

  const seekFromEvent = (clientX: number) => {
    const track = trackRef.current;
    if (!track || !ready) return;
    const rect = track.getBoundingClientRect();
    const x = Math.max(0, Math.min(1, (clientX - rect.left) / rect.width));
    setCurrentFrame(Math.round(x * (frameCount - 1)));
  };

  const onTrackDown = (e: React.MouseEvent) => {
    seekFromEvent(e.clientX);
    const onMove = (ev: MouseEvent) => seekFromEvent(ev.clientX);
    const onUp = () => {
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
    };
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
  };

  const ticks = useMemo(() => makeTicks(frameCount), [frameCount]);

  return (
    <div
      className="grid gap-[14px] items-center border-t border-[var(--rule-strong)] bg-[var(--bg-1)] min-w-0"
      style={{
        gridTemplateColumns: "auto minmax(0, 1fr) auto",
        padding: "10px var(--pad) 12px",
      }}
    >
      {/* Transport */}
      <div className="flex gap-[2px]">
        <TransportBtn
          disabled={!ready}
          onClick={() => setCurrentFrame(0)}
          title="First frame"
        >
          <SkipBack size={12} />
        </TransportBtn>
        <TransportBtn
          disabled={!ready}
          onClick={() => setCurrentFrame(Math.max(0, currentFrame - 1))}
          title="Previous frame"
        >
          <ChevronLeft size={12} />
        </TransportBtn>
        <TransportBtn
          primary
          disabled={!ready}
          onClick={() => setPlaying((p) => !p)}
          title={playing ? "Pause (Space)" : "Play (Space)"}
        >
          {playing ? <Pause size={12} /> : <Play size={12} fill="currentColor" />}
        </TransportBtn>
        <TransportBtn
          disabled={!ready}
          onClick={() =>
            setCurrentFrame(Math.min(frameCount - 1, currentFrame + 1))
          }
          title="Next frame"
        >
          <ChevronRight size={12} />
        </TransportBtn>
        <TransportBtn
          disabled={!ready}
          onClick={() => setCurrentFrame(frameCount - 1)}
          title="Last frame"
        >
          <SkipForward size={12} />
        </TransportBtn>
      </div>

      {/* Track */}
      <div
        ref={trackRef}
        onMouseDown={ready ? onTrackDown : undefined}
        className="relative h-[42px] bg-[var(--bg-0)] border border-[var(--rule)] overflow-hidden"
        style={{ cursor: ready ? "pointer" : "default" }}
      >
        {/* Processed region tint (slice 4 drives this from `frames`) */}
        <div
          className="absolute left-0 top-0 bottom-0 pointer-events-none"
          style={{
            width: "0%",
            background: "rgba(234,179,8,0.12)",
          }}
        />
        {/* Ticks row */}
        <div className="absolute left-0 right-0 top-0 h-3 flex p-0">
          {ticks.map((t, i) => (
            <span
              key={i}
              className="flex-1 border-r border-[var(--rule)] last:border-r-0 text-[8.5px] text-[var(--ink-3)] pl-[3px] leading-[12px] tracking-[0.02em]"
            >
              {t}
            </span>
          ))}
        </div>
        {/* Keyframe (hint) ticks — empty placeholder until slice 5 */}
        <div className="absolute left-0 right-0 bottom-0 h-[10px] flex" />
        {/* Keying edge — 0% until slice 4 drives it */}
        <div
          className="absolute top-0 w-px bg-[var(--accent)] pointer-events-none"
          style={{ left: "0%", bottom: 10, display: "none" }}
        />
        {/* Playhead */}
        {ready && (
          <div
            className="absolute w-[2px] bg-[var(--ink-0)] pointer-events-none"
            style={{ left: `${pct}%`, top: "-2px", bottom: "-2px" }}
          >
            <span
              className="absolute left-1/2 -translate-x-1/2"
              style={{
                top: "-1px",
                width: 0,
                height: 0,
                border: "4px solid transparent",
                borderTopColor: "var(--ink-0)",
                borderBottom: "0",
              }}
            />
          </div>
        )}
      </div>

      {/* Meta */}
      <div className="flex items-center gap-2.5 text-[10px] text-[var(--ink-2)] tracking-[0.04em] whitespace-nowrap shrink-0">
        <span className="text-[var(--ink-0)] tabular-nums">
          FR {String(currentFrame).padStart(3, "0")}
        </span>
        <span className="text-[var(--ink-4)]">/</span>
        <span className="tabular-nums">{frameCount || "—"}</span>
        <span className="text-[var(--ink-4)]">·</span>
        <span className="tabular-nums">{ready ? formatTC(currentFrame, fps) : "——:——:——:——"}</span>
        <span className="text-[var(--ink-4)]">·</span>
        <span>{ready ? `${fps.toFixed(3)} fps` : "—"}</span>
      </div>
    </div>
  );
}

function TransportBtn({
  children,
  primary,
  onClick,
  disabled,
  title,
}: {
  children: React.ReactNode;
  primary?: boolean;
  onClick?: () => void;
  disabled?: boolean;
  title?: string;
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      title={title}
      className={`w-[28px] h-[28px] grid place-items-center border transition-colors ${
        disabled
          ? "border-[var(--rule)] text-[var(--ink-3)] opacity-40 cursor-not-allowed"
          : primary
          ? "border-[var(--accent)] bg-[var(--accent)] text-[var(--accent-ink)] hover:brightness-105"
          : "border-[var(--rule)] text-[var(--ink-1)] hover:border-[var(--rule-strong)] hover:text-[var(--ink-0)]"
      }`}
    >
      {children}
    </button>
  );
}

function makeTicks(frameCount: number): string[] {
  if (!frameCount) return [];
  const n = 12;
  const step = Math.max(1, Math.round(frameCount / n));
  const ticks: string[] = [];
  for (let i = 0; i < n; i++) {
    ticks.push(String(i * step).padStart(3, "0"));
  }
  return ticks;
}

function formatTC(frame: number, fps: number): string {
  const seconds = frame / Math.max(1, fps);
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = Math.floor(seconds % 60);
  const f = Math.max(0, frame % Math.max(1, Math.round(fps)));
  return `${pad(h)}:${pad(m)}:${pad(s)}:${pad(f)}`;
}

function pad(n: number): string {
  return String(n).padStart(2, "0");
}
