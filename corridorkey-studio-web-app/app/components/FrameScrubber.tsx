"use client";

import {
  SkipBack,
  ChevronLeft,
  Play,
  Pause,
  ChevronRight,
  SkipForward,
  Repeat,
} from "lucide-react";
import { useState, useRef, useEffect } from "react";
import { useSessionClipStore } from "../stores/useSessionClipStore";

export default function FrameScrubber() {
  const { stage, meta, currentFrame, inPoint, outPoint, setCurrentFrame } =
    useSessionClipStore();
  const [playing, setPlaying] = useState(false);
  const [looping, setLooping] = useState(false);
  const trackRef = useRef<HTMLDivElement>(null);

  const ready = stage === "ready" && meta !== null;
  const frameCount = meta?.frameCount ?? 0;
  const fps = meta?.fps ?? 24;

  // Spacebar play/pause — only when a clip is ready
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

  // Playback loop — advance frame at source fps while playing
  useEffect(() => {
    if (!playing || !ready) return;
    const interval = setInterval(() => {
      const cur = useSessionClipStore.getState();
      if (cur.stage !== "ready" || !cur.meta) return;
      const max = cur.meta.frameCount - 1;
      if (cur.currentFrame >= max) {
        if (looping) {
          cur.setCurrentFrame(0);
        } else {
          setPlaying(false);
        }
      } else {
        cur.setCurrentFrame(cur.currentFrame + 1);
      }
    }, 1000 / Math.max(1, fps));
    return () => clearInterval(interval);
  }, [playing, looping, ready, fps]);

  const disabledBtn = "p-1.5 text-[var(--text-muted)] opacity-30 cursor-default";
  const transportBtn =
    "p-1.5 text-[var(--text-muted)] hover:text-[var(--text)] cursor-pointer transition-colors";

  if (!ready) {
    return (
      <div className="shrink-0 border-t border-[var(--border)] bg-[var(--surface)]">
        <div className="relative h-10 mx-3 mt-2">
          <div className="absolute inset-x-0 top-1/2 h-px bg-[#222]" />
        </div>
        <div className="flex items-center justify-between px-3 py-1.5">
          <div className="flex items-center gap-0">
            <span className={disabledBtn}><SkipBack size={14} /></span>
            <span className={disabledBtn}><ChevronLeft size={14} /></span>
            <span className={disabledBtn}><Play size={14} fill="currentColor" /></span>
            <span className={disabledBtn}><ChevronRight size={14} /></span>
            <span className={disabledBtn}><SkipForward size={14} /></span>
          </div>
          <span className="text-[10px] text-[var(--text-muted)] opacity-50">0 / 0</span>
          <div className="flex items-center gap-3 text-[8px] text-[var(--text-muted)] opacity-30">
            <span className="flex items-center gap-1"><span className="w-2 h-2 bg-[rgba(59,130,246,0.5)] inline-block" />ALPHA</span>
            <span className="flex items-center gap-1"><span className="w-2 h-2 bg-[rgba(255,50,50,0.5)] inline-block" />KEYED</span>
          </div>
        </div>
      </div>
    );
  }

  const pct = currentFrame / Math.max(1, frameCount - 1);

  const seekFromEvent = (e: React.MouseEvent | MouseEvent) => {
    const track = trackRef.current;
    if (!track) return;
    const rect = track.getBoundingClientRect();
    const x = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
    setCurrentFrame(Math.round(x * (frameCount - 1)));
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

  return (
    <div className="border-t border-[var(--border)] bg-[var(--surface)] shrink-0">
      {/* Timeline track */}
      <div
        ref={trackRef}
        className="relative h-10 cursor-pointer mx-3 mt-2"
        onMouseDown={onTrackMouseDown}
      >
        <div className="absolute inset-0 bg-[#161616] border border-[var(--border)]" />

        {inPoint !== null && (
          <div
            className="absolute top-0 bottom-0 border-l-2 border-[var(--warning)]"
            style={{ left: `${(inPoint / frameCount) * 100}%` }}
          />
        )}
        {outPoint !== null && (
          <div
            className="absolute top-0 bottom-0 border-r-2 border-[var(--warning)]"
            style={{ left: `${(outPoint / frameCount) * 100}%` }}
          />
        )}

        {/* Playhead */}
        <div
          className="absolute top-0 bottom-0 w-px bg-white z-10"
          style={{ left: `${pct * 100}%` }}
        >
          <div className="absolute -top-0.5 left-1/2 -translate-x-1/2 w-2.5 h-1.5 bg-white" />
        </div>
      </div>

      <div className="flex items-center justify-between px-3 py-1.5">
        <div className="flex items-center gap-0">
          <button className={transportBtn} onClick={() => setCurrentFrame(0)}>
            <SkipBack size={14} />
          </button>
          <button
            className={transportBtn}
            onClick={() => setCurrentFrame(Math.max(0, currentFrame - 1))}
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
              setCurrentFrame(Math.min(frameCount - 1, currentFrame + 1))
            }
          >
            <ChevronRight size={14} />
          </button>
          <button
            className={transportBtn}
            onClick={() => setCurrentFrame(frameCount - 1)}
          >
            <SkipForward size={14} />
          </button>
          <button
            className={`p-1.5 cursor-pointer transition-colors ${
              looping
                ? "text-[var(--accent)]"
                : "text-[var(--text-muted)] hover:text-[var(--text)]"
            }`}
            onClick={() => setLooping(!looping)}
            title={looping ? "Loop on" : "Loop off"}
          >
            <Repeat size={14} />
          </button>
        </div>

        <div className="flex items-center gap-4 text-[10px] tabular-nums">
          <span className="text-[var(--text)]">
            {currentFrame}
            <span className="text-[var(--text-muted)]"> / {frameCount}</span>
          </span>
          {inPoint !== null && outPoint !== null && (
            <span className="text-[var(--warning)]">
              [{inPoint}–{outPoint}]
            </span>
          )}
        </div>

        <div className="flex items-center gap-3 text-[8px] text-[var(--text-muted)]">
          <span className="flex items-center gap-1">
            <span className="w-2 h-2 bg-[rgba(59,130,246,0.5)] inline-block" />
            ALPHA
          </span>
          <span className="flex items-center gap-1">
            <span className="w-2 h-2 bg-[rgba(255,50,50,0.5)] inline-block" />
            KEYED
          </span>
        </div>
      </div>
    </div>
  );
}
