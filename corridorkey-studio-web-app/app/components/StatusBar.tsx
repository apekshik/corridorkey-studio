"use client";

import { useState, useRef, useEffect } from "react";
import { AlertTriangle, Monitor, Cloud, ChevronDown } from "lucide-react";
import { useClipStore } from "../stores/useClipStore";
import { useQueueStore } from "../stores/useQueueStore";
import { useSettingsStore } from "../stores/useSettingsStore";
import { JobStatus, BackendMode } from "../lib/types";
import ServerSetup from "./ServerSetup";

const JOB_LABELS: Record<string, string> = {
  INFERENCE: "KEYING",
  GVM_ALPHA: "GENERATING ALPHA",
  VIDEOMAMA_ALPHA: "GENERATING ALPHA",
  VIDEO_EXTRACT: "EXTRACTING",
  PREVIEW: "PREVIEW",
};

export default function StatusBar() {
  const clips = useClipStore((s) => s.clips);
  const selectedId = useClipStore((s) => s.selectedClipId);
  const jobs = useQueueStore((s) => s.jobs);
  const connectionStatus = useSettingsStore((s) => s.connectionStatus);
  const gpu = useSettingsStore((s) => s.gpu);
  const backendMode = useSettingsStore((s) => s.backendMode);
  const [setupOpen, setSetupOpen] = useState(false);
  const [modeDropOpen, setModeDropOpen] = useState(false);
  const modeDropRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!modeDropOpen) return;
    const onClick = (e: MouseEvent) => {
      if (modeDropRef.current && !modeDropRef.current.contains(e.target as Node)) {
        setModeDropOpen(false);
      }
    };
    window.addEventListener("mousedown", onClick);
    return () => window.removeEventListener("mousedown", onClick);
  }, [modeDropOpen]);

  const selectedClip = clips.find((c) => c.id === selectedId);
  const runningJob = jobs.find((j) => j.status === JobStatus.RUNNING);
  const totalWarnings = clips.reduce((sum, c) => sum + c.warnings.length, 0);
  const isConnected = connectionStatus === "connected";

  return (
    <>
      <style dangerouslySetInnerHTML={{ __html: `
        @keyframes ck-spin {
          0% { transform: rotate(0deg); }
          25% { transform: rotate(180deg); }
          50% { transform: rotate(180deg); }
          75% { transform: rotate(360deg); }
          100% { transform: rotate(360deg); }
        }
      `}} />
      <div className="border-t border-[var(--border)] bg-[var(--surface)] shrink-0 select-none overflow-visible relative">
        {/* Full-width progress bar at top of status bar */}
        {runningJob && (
          <div className="h-0.5 bg-[#222] w-full">
            <div
              className="h-full bg-[var(--accent)] transition-all duration-300"
              style={{ width: `${runningJob.progress * 100}%` }}
            />
          </div>
        )}

        <div className="h-9 flex items-center justify-between px-4">
        {/* Left: Progress / frame info */}
        <div className="flex items-center gap-3 flex-1">
          {runningJob && (
            <div className="flex items-center gap-2">
              <div
                className="w-2 h-2 bg-[var(--accent)]"
                style={{ animation: "ck-spin 1.6s ease-in-out infinite" }}
              />
              <span className="text-[10px] text-[var(--accent)] uppercase tracking-wider font-bold">
                {JOB_LABELS[runningJob.type] || runningJob.type.replace(/_/g, " ")}
              </span>
            </div>
          )}
          <span className="text-[10px] text-[var(--text-muted)]">
            {runningJob
              ? `${runningJob.currentFrame}/${runningJob.totalFrames} frames · ${Math.round(runningJob.progress * 100)}%`
              : selectedClip
              ? `${selectedClip.frameCount} frames`
              : "NO CLIP SELECTED"}
          </span>
          {totalWarnings > 0 && (
            <span className="flex items-center gap-1 text-[10px] text-[var(--warning)]">
              <AlertTriangle size={10} />
              {totalWarnings}
            </span>
          )}
        </div>

        {/* Right: Backend mode dropdown + connection */}
        <div className="flex items-center gap-2">
          {/* Backend mode dropdown */}
          <div className="relative" ref={modeDropRef}>
            <button
              onClick={() => setModeDropOpen(!modeDropOpen)}
              className="flex items-center gap-1.5 px-2 py-0.5 border border-[var(--border)] text-[10px] uppercase tracking-wider cursor-pointer hover:border-[var(--text-muted)] transition-colors"
            >
              {backendMode === BackendMode.LOCAL ? <Monitor size={10} /> : <Cloud size={10} />}
              {backendMode}
              <ChevronDown size={8} />
            </button>
            {modeDropOpen && <ModeDropdown dropRef={modeDropRef} backendMode={backendMode} onClose={() => setModeDropOpen(false)} />}
          </div>

          {/* Connection status */}
          <button
            onClick={() => !isConnected && setSetupOpen(true)}
            className={`flex items-center gap-1.5 text-[10px] transition-colors ${
              isConnected
                ? "text-[var(--success)]"
                : "text-[var(--error)] cursor-pointer hover:text-[var(--text)]"
            }`}
          >
            <div
              className="w-2 h-2 shrink-0"
              style={{
                background: isConnected
                  ? "var(--success)"
                  : connectionStatus === "connecting"
                  ? "var(--warning)"
                  : "var(--error)",
              }}
            />
            {isConnected ? (
              <span className="text-[9px] text-[var(--text-muted)]">
                {gpu.name}{gpu.vramUsed > 0 ? ` · ${gpu.vramUsed.toFixed(1)}/${gpu.vramTotal.toFixed(1)} GB` : ""}
              </span>
            ) : (
              <span className="uppercase tracking-wider">SETUP NEEDED</span>
            )}
          </button>
        </div>
        </div>
      </div>
      {setupOpen && <ServerSetup onClose={() => setSetupOpen(false)} />}
    </>
  );
}

function ModeDropdown({
  dropRef,
  backendMode,
  onClose,
}: {
  dropRef: React.RefObject<HTMLDivElement | null>;
  backendMode: BackendMode;
  onClose: () => void;
}) {
  const rect = dropRef.current?.getBoundingClientRect();
  const pos = rect
    ? { bottom: window.innerHeight - rect.top + 4, right: window.innerWidth - rect.right }
    : { bottom: 40, right: 16 };

  return (
    <div
      className="fixed w-56 bg-[var(--surface)] border border-[var(--border)] z-[200]"
      style={{ bottom: pos.bottom, right: pos.right }}
    >
      <button
        onClick={onClose}
        className={`w-full text-left px-3 py-2 cursor-pointer transition-colors border-b border-[var(--border)] ${
          backendMode === BackendMode.LOCAL ? "bg-[var(--surface-2)]" : "hover:bg-[var(--surface-2)]"
        }`}
      >
        <div className="flex items-center gap-2">
          <Monitor size={12} className="text-[var(--text)]" />
          <div>
            <div className="text-[10px] uppercase tracking-wider font-bold text-[var(--text)]">LOCAL</div>
            <div className="text-[9px] text-[var(--text-muted)] mt-0.5">Run on your GPU</div>
          </div>
        </div>
      </button>
      <div className="w-full text-left px-3 py-2 opacity-40 cursor-not-allowed">
        <div className="flex items-center gap-2">
          <Cloud size={12} className="text-[var(--text-muted)]" />
          <div>
            <div className="text-[10px] uppercase tracking-wider font-bold text-[var(--text-muted)]">CLOUD</div>
            <div className="text-[9px] text-[var(--text-muted)] mt-0.5">Free cloud GPUs with generous limits — coming soon</div>
          </div>
        </div>
      </div>
    </div>
  );
}
