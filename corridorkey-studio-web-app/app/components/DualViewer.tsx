"use client";

import { useState, useCallback, DragEvent } from "react";
import { Columns2, Square, Upload } from "lucide-react";
import { useSessionClipStore } from "../stores/useSessionClipStore";
import { importClip } from "../lib/importClip";

/**
 * DualViewer — left side shows the input preview frame (from fal CDN),
 * right side is reserved for keyed outputs (slice 3+).
 *
 * The whole area is a drop zone. If no clip is loaded, drop onto it to
 * import. While a clip is loading, drops are blocked.
 */
export default function DualViewer() {
  const session = useSessionClipStore();
  const [split, setSplit] = useState(true);
  const [draggingOver, setDraggingOver] = useState(false);

  const frameUrl =
    session.meta?.previewFrameUrls?.[session.currentFrame] ?? null;

  const onDragOver = useCallback((e: DragEvent) => {
    if (e.dataTransfer.types.includes("Files")) {
      e.preventDefault();
      setDraggingOver(true);
    }
  }, []);

  const onDragLeave = useCallback(() => {
    setDraggingOver(false);
  }, []);

  const onDrop = useCallback(async (e: DragEvent) => {
    e.preventDefault();
    setDraggingOver(false);
    const file = e.dataTransfer.files[0];
    if (file) await importClip(file);
  }, []);

  const busy = session.stage === "uploading" || session.stage === "extracting";

  return (
    <div
      className="flex flex-1 min-h-0 relative"
      onDragOver={onDragOver}
      onDragLeave={onDragLeave}
      onDrop={busy ? undefined : onDrop}
    >
      {/* Input side */}
      {split && (
        <div className="flex-1 flex flex-col border-r border-[var(--border)]">
          <div className="px-3 py-1 text-[10px] uppercase tracking-wider text-[var(--text-muted)] border-b border-[var(--border)] flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span>INPUT</span>
              {session.meta && <span>{session.meta.frameCount} frames</span>}
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
            <InputFrame frameUrl={frameUrl} />
          </div>
        </div>
      )}

      {/* Output side — empty until slice 3 wires keying */}
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
            <div className="px-3 py-1 text-[10px] uppercase tracking-wider text-[var(--text-muted)]">
              OUTPUT
            </div>
          </div>
          {session.stage === "ready" && (
            <span className="px-3 text-[10px] uppercase tracking-wider text-[var(--success)]">
              RAW
            </span>
          )}
        </div>
        <div className="flex-1 flex items-center justify-center bg-[#0e0e0e]">
          <span className="text-[var(--text-muted)] text-[10px]">
            {session.stage === "ready" ? "PRESS KEY TO RENDER" : "NO OUTPUT"}
          </span>
        </div>
      </div>

      {/* Drop overlay */}
      {draggingOver && !busy && (
        <div className="absolute inset-0 bg-[rgba(255,51,51,0.1)] border-2 border-dashed border-[var(--accent)] flex items-center justify-center pointer-events-none z-50">
          <div className="flex flex-col items-center gap-2 text-[var(--accent)]">
            <Upload size={32} />
            <span className="text-xs uppercase tracking-[0.2em] font-bold">
              DROP TO IMPORT
            </span>
          </div>
        </div>
      )}
    </div>
  );
}

function InputFrame({ frameUrl }: { frameUrl: string | null }) {
  const session = useSessionClipStore();

  if (session.stage === "idle") {
    return (
      <div className="text-[var(--text-muted)] text-xs text-center">
        <div className="w-64 h-44 border-2 border-dashed border-[var(--border)] flex flex-col items-center justify-center gap-2 bg-[#1a1a1a]">
          <Upload size={24} className="opacity-40" />
          <span className="text-[10px] uppercase tracking-[0.15em]">
            DROP VIDEO FILE
          </span>
        </div>
      </div>
    );
  }

  if (session.stage === "error") {
    return (
      <div className="text-[var(--error)] text-[10px] max-w-sm text-center px-4">
        {session.errorMessage}
      </div>
    );
  }

  if (session.stage === "uploading") {
    return (
      <div className="text-[var(--text-muted)] text-[10px] uppercase tracking-wider">
        UPLOADING TO FAL CDN…
      </div>
    );
  }

  if (session.stage === "extracting") {
    return (
      <div className="text-[var(--text-muted)] text-[10px] uppercase tracking-wider">
        EXTRACTING PREVIEW FRAMES…
      </div>
    );
  }

  if (!frameUrl) {
    return (
      <span className="text-[var(--text-muted)] text-[10px]">
        NO FRAME
      </span>
    );
  }

  // React will re-fetch when src changes, and fal CDN serves with CORS
  // headers, so <img> just works.
  return (
    <img
      // eslint-disable-next-line @next/next/no-img-element
      src={frameUrl}
      alt={`frame ${session.currentFrame}`}
      className="max-w-full max-h-full object-contain"
    />
  );
}
