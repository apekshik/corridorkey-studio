"use client";

import { useRef } from "react";
import { Plus, PanelLeftOpen, PanelLeftClose, Loader2, X } from "lucide-react";
import { useSessionClipStore } from "../stores/useSessionClipStore";
import { useQueueStore } from "../stores/useQueueStore";
import { useResizeHandle } from "../lib/useResizeHandle";
import { importClip } from "../lib/importClip";

type Tab = "MEDIA" | "QUEUE";

export default function SidePanel() {
  const { isOpen, toggleQueue: toggle, jobs } = useQueueStore();
  const session = useSessionClipStore();
  const { width, onMouseDown } = useResizeHandle({
    initialWidth: 240,
    minWidth: 180,
    maxWidth: 400,
    side: "right",
  });

  const hasSession = session.stage !== "idle";

  return (
    <div className="flex shrink-0 relative">
      {!isOpen && (
        <button
          onClick={toggle}
          className="w-8 border-r border-[var(--border)] bg-[var(--surface)] flex flex-col items-center pt-2 cursor-pointer hover:bg-[var(--surface-2)] transition-colors"
        >
          <PanelLeftOpen size={14} className="text-[var(--text-muted)]" />
        </button>
      )}

      {isOpen && (
        <div
          className="border-r border-[var(--border)] bg-[var(--surface)] flex flex-col shrink-0"
          style={{ width }}
        >
          <div className="flex items-center border-b border-[var(--border)]">
            <div className="flex-1 py-2 text-[10px] uppercase tracking-[0.15em] font-bold text-center text-[var(--text)] bg-[var(--surface-2)] border-r border-[var(--border)]">
              MEDIA ({hasSession ? 1 : 0})
            </div>
            <button
              onClick={toggle}
              className="px-2 py-2 text-[var(--text-muted)] hover:text-[var(--text)] cursor-pointer transition-colors"
            >
              <PanelLeftClose size={14} />
            </button>
          </div>

          <div className="flex-1 overflow-y-auto">
            <MediaTab />
          </div>
        </div>
      )}

      {isOpen && (
        <div
          onMouseDown={onMouseDown}
          className="w-1 cursor-col-resize hover:bg-[var(--accent)] transition-colors absolute top-0 bottom-0 right-0 z-10"
        />
      )}
    </div>
  );
}

function MediaTab() {
  const fileRef = useRef<HTMLInputElement>(null);
  const session = useSessionClipStore();

  const handlePick = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;
    // Take the first file only — session is single-clip for now.
    await importClip(files[0]);
    if (fileRef.current) fileRef.current.value = "";
  };

  return (
    <>
      <input
        ref={fileRef}
        type="file"
        accept="video/*,.mov,.mp4,.avi,.mxf,.mkv,.webm,.m4v"
        className="hidden"
        onChange={handlePick}
      />

      {/* Import button bar */}
      <div className="flex items-center border-b border-[var(--border)]">
        <div className="flex-1 px-3 py-1.5 text-[9px] uppercase tracking-[0.15em] text-[var(--text-muted)]">
          {session.stage === "idle" ? "NO CLIPS" : "SESSION CLIP"}
        </div>
        <button
          onClick={() => fileRef.current?.click()}
          disabled={
            session.stage === "uploading" || session.stage === "extracting"
          }
          className="px-2 py-1.5 text-[var(--text-muted)] hover:text-[var(--text)] cursor-pointer transition-colors border-l border-[var(--border)] disabled:opacity-30 disabled:cursor-not-allowed"
          title="Import clip"
        >
          <Plus size={12} />
        </button>
      </div>

      <SessionRow />
    </>
  );
}

function SessionRow() {
  const { stage, progress, meta, errorMessage, reset } = useSessionClipStore();

  if (stage === "idle") {
    return (
      <div className="px-3 py-8 text-[10px] text-[var(--text-muted)] text-center leading-relaxed">
        Drop a video above, or use{" "}
        <span className="text-[var(--text)]">+</span>.
      </div>
    );
  }

  const label =
    stage === "uploading"
      ? "UPLOADING"
      : stage === "extracting"
      ? "EXTRACTING"
      : stage === "ready"
      ? "RAW"
      : stage === "error"
      ? "ERROR"
      : "";

  const color =
    stage === "ready"
      ? "var(--success)"
      : stage === "error"
      ? "var(--error)"
      : "var(--warning)";

  const name = meta?.name ?? "untitled";
  const frameCount = meta?.frameCount ?? 0;
  const busy = stage === "uploading" || stage === "extracting";

  return (
    <div className="w-full text-left px-3 py-2 border-b border-[var(--border)] flex gap-3 items-start bg-[var(--surface-2)]">
      {/* Thumbnail */}
      <div className="w-10 h-10 shrink-0 border border-[var(--border)] bg-[#1a1a1a] flex items-center justify-center relative overflow-hidden">
        {meta?.thumbnailUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={meta.thumbnailUrl}
            alt={name}
            className="w-full h-full object-cover"
          />
        ) : busy ? (
          <Loader2 size={12} className="text-[var(--text-muted)] animate-spin" />
        ) : (
          <span className="text-[7px] text-[var(--text-muted)]">—</span>
        )}
        <div
          className="absolute bottom-0 left-0 right-0 h-0.5"
          style={{ background: color }}
        />
      </div>
      <div className="flex-1 min-w-0">
        <div className="text-[10px] text-[var(--text)] truncate">{name}</div>
        <div className="flex items-center justify-between">
          <span
            className="text-[8px] uppercase tracking-wider"
            style={{ color }}
          >
            {label}
          </span>
          {frameCount > 0 && (
            <span className="text-[8px] text-[var(--text-muted)] tabular-nums">
              {frameCount} f
            </span>
          )}
        </div>
        {busy && (
          <div className="mt-1 w-full h-0.5 bg-[#222]">
            <div
              className="h-full bg-[var(--accent)] transition-all"
              style={{ width: `${Math.max(0.05, progress) * 100}%` }}
            />
          </div>
        )}
        {stage === "error" && errorMessage && (
          <div className="mt-0.5 text-[8px] text-[var(--error)] leading-snug">
            {errorMessage}
          </div>
        )}
      </div>
      {stage !== "uploading" && stage !== "extracting" && (
        <button
          onClick={reset}
          className="text-[var(--text-muted)] hover:text-[var(--error)] cursor-pointer transition-colors shrink-0"
          title="Discard session clip"
        >
          <X size={11} />
        </button>
      )}
    </div>
  );
}
