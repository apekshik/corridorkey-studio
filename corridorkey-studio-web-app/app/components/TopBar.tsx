"use client";

import { useState, useEffect, useRef } from "react";
import { Settings, Play, Square, ChevronDown, Info, X, AlertTriangle } from "lucide-react";
import { useSettingsStore } from "../stores/useSettingsStore";
import { useClipStore } from "../stores/useClipStore";
import { useQueueStore } from "../stores/useQueueStore";
import { JobType, JobStatus, ClipState } from "../lib/types";
import { createJob, cancelJob } from "../lib/api";
import UserMenu from "./UserMenu";

const KEY_MODES = [
  {
    id: "selected",
    label: "KEY SELECTED",
    subtitle: "Key the currently selected clip",
  },
  {
    id: "all-ready",
    label: "KEY ALL READY",
    subtitle: "Key all clips with alpha hints",
  },
  {
    id: "all-pipeline",
    label: "KEY ALL",
    subtitle: "Generate alpha + key for all pending clips",
  },
] as const;

export default function TopBar() {
  const connected = useSettingsStore((s) => s.connectionStatus) === "connected";
  const clips = useClipStore((s) => s.clips);
  const selectedId = useClipStore((s) => s.selectedClipId);
  const addJob = useQueueStore((s) => s.addJob);
  const [keyModeIndex, setKeyModeIndex] = useState(0);
  const [keyDropOpen, setKeyDropOpen] = useState(false);
  const [infoOpen, setInfoOpen] = useState(false);
  const [partialHintModal, setPartialHintModal] = useState(false);
  const dropRef = useRef<HTMLDivElement>(null);
  const coverage = useClipStore((s) => s.coverage);

  const selectedClip = clips.find((c) => c.id === selectedId);
  const selectedIsReady = selectedClip?.state === ClipState.READY;
  const hasPartialHints = selectedIsReady && selectedClip &&
    coverage.alphaHints.length > 0 &&
    coverage.alphaHints.length < selectedClip.frameCount;
  const readyClips = clips.filter((c) => c.state === ClipState.READY);

  const hasNoHints = selectedClip && coverage.alphaHints.length === 0;
  const canKey = connected;

  const executeKey = async () => {
    if (!canKey) return;
    const mode = KEY_MODES[keyModeIndex].id;
    let targets: string[] = [];

    if (mode === "selected" && selectedId && selectedIsReady) {
      targets = [selectedId];
    } else if (mode === "all-ready") {
      targets = readyClips.map((c) => c.id);
    } else if (mode === "all-pipeline") {
      // For "KEY ALL": run GVM on RAW clips first, then key all READY
      const rawClips = clips.filter((c) => c.state === ClipState.RAW);
      for (const clip of rawClips) {
        try {
          const gvmJob = await createJob(clip.id, JobType.GVM_ALPHA);
          addJob(gvmJob);
        } catch (err) {
          console.error("Failed to create GVM job:", err);
        }
      }
      targets = readyClips.map((c) => c.id);
    }

    for (const clipId of targets) {
      try {
        const job = await createJob(clipId, JobType.INFERENCE);
        addJob(job);
        // Open queue panel
        const qs = useQueueStore.getState();
        if (!qs.isOpen) qs.toggleQueue();
      } catch (err) {
        console.error("Failed to create key job:", err);
      }
    }
  };

  const [noHintModal, setNoHintModal] = useState(false);

  const handleKey = () => {
    if (!canKey) return;
    if (keyModeIndex === 0 && selectedClip) {
      if (hasNoHints) {
        setNoHintModal(true);
        return;
      }
      if (hasPartialHints) {
        setPartialHintModal(true);
        return;
      }
    }
    executeKey();
  };

  // Close dropdown on outside click
  useEffect(() => {
    if (!keyDropOpen) return;
    const onClick = (e: MouseEvent) => {
      if (dropRef.current && !dropRef.current.contains(e.target as Node)) {
        setKeyDropOpen(false);
      }
    };
    window.addEventListener("mousedown", onClick);
    return () => window.removeEventListener("mousedown", onClick);
  }, [keyDropOpen]);

  return (
    <>
      <div className="h-10 flex items-center justify-between px-4 border-b border-[var(--border)] bg-[var(--surface)] shrink-0 select-none">
        {/* Brand + info */}
        <div className="flex items-center gap-2">
          <span className="text-[var(--text-bright)] text-xs font-bold tracking-[0.2em] uppercase">
            CORRIDORKEY STUDIO
          </span>
          <button
            onClick={() => setInfoOpen(true)}
            className="text-[var(--text-muted)] hover:text-[var(--text)] cursor-pointer transition-colors"
            title="About CorridorKey"
          >
            <Info size={13} />
          </button>
        </div>

        {/* Actions + settings */}
        <div className="flex items-center gap-2">
          {/* KEY button with dropdown */}
          <div className="relative" ref={dropRef}>
            <div className="flex">
              <button
                onClick={handleKey}
                disabled={!canKey}
                title={!connected ? "Connect to server first" : ""}
                className={`flex items-center gap-1.5 px-3 py-1 text-[10px] uppercase tracking-wider font-bold transition-colors ${
                  canKey
                    ? "bg-[var(--accent)] text-[var(--text-bright)] cursor-pointer hover:bg-[var(--accent-dim)]"
                    : "bg-[var(--surface-2)] text-[var(--text-muted)] cursor-not-allowed opacity-50"
                }`}
              >
                <Play size={10} fill="currentColor" />
                {KEY_MODES[keyModeIndex].label}
              </button>
              <button
                onClick={() => setKeyDropOpen(!keyDropOpen)}
                className="px-1.5 py-1 bg-[var(--accent)] text-[var(--text-bright)] cursor-pointer hover:bg-[var(--accent-dim)] transition-colors border-l border-[rgba(255,255,255,0.2)]"
              >
                <ChevronDown size={10} />
              </button>
            </div>

            {keyDropOpen && (
              <div
                className="absolute right-0 top-full mt-1 w-64 bg-[var(--surface)] border border-[var(--border)] z-50"
              >
                {KEY_MODES.map((mode, i) => (
                  <button
                    key={mode.id}
                    onClick={() => {
                      setKeyModeIndex(i);
                      setKeyDropOpen(false);
                    }}
                    className={`w-full text-left px-3 py-2 cursor-pointer transition-colors border-b border-[var(--border)] last:border-b-0 ${
                      i === keyModeIndex
                        ? "bg-[var(--surface-2)]"
                        : "hover:bg-[var(--surface-2)]"
                    }`}
                  >
                    <div className="text-[10px] uppercase tracking-wider font-bold text-[var(--text)]">
                      {mode.label}
                    </div>
                    <div className="text-[9px] text-[var(--text-muted)] mt-0.5">
                      {mode.subtitle}
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>

          <button
            onClick={async () => {
              const jobs = useQueueStore.getState().jobs;
              const running = jobs.filter((j) => j.status === "RUNNING" || j.status === "QUEUED");
              for (const job of running) {
                try {
                  await cancelJob(job.id);
                  useQueueStore.getState().updateJobStatus(job.id, JobStatus.CANCELLED);
                } catch (err) {
                  console.error("Failed to cancel job:", err);
                }
              }
            }}
            className="flex items-center gap-1.5 px-3 py-1 border border-[var(--border)] text-[10px] uppercase tracking-wider cursor-pointer hover:border-[var(--text-muted)] hover:text-[var(--error)] transition-colors"
          >
            <Square size={10} />
            STOP
          </button>

          <button className="p-1 text-[var(--text-muted)] hover:text-[var(--text)] cursor-pointer transition-colors">
            <Settings size={14} />
          </button>

          <div className="w-px h-4 bg-[var(--border)]" />

          <UserMenu />
        </div>
      </div>

      {/* Info overlay */}
      {infoOpen && <InfoOverlay onClose={() => setInfoOpen(false)} />}
      {noHintModal && selectedClip && (
        <NoHintModal
          clipName={selectedClip.name}
          onGenerate={async () => {
            setNoHintModal(false);
            try {
              const job = await createJob(selectedClip.id, JobType.GVM_ALPHA);
              addJob(job);
              // Open queue panel so user sees progress
              const qs = useQueueStore.getState();
              if (!qs.isOpen) qs.toggleQueue();
            } catch (err) {
              console.error("Failed to create GVM job:", err);
            }
          }}
          onClose={() => setNoHintModal(false)}
        />
      )}
      {partialHintModal && selectedClip && (
        <PartialHintModal
          hintCount={coverage.alphaHints.length}
          totalFrames={selectedClip.frameCount}
          onContinue={() => {
            setPartialHintModal(false);
            executeKey();
          }}
          onGenerate={async () => {
            setPartialHintModal(false);
            try {
              const job = await createJob(selectedClip.id, JobType.GVM_ALPHA);
              addJob(job);
              const qs = useQueueStore.getState();
              if (!qs.isOpen) qs.toggleQueue();
            } catch (err) {
              console.error("Failed to create GVM job:", err);
            }
          }}
          onClose={() => setPartialHintModal(false)}
        />
      )}
    </>
  );
}

function NoHintModal({
  clipName,
  onGenerate,
  onClose,
}: {
  clipName: string;
  onGenerate: () => void;
  onClose: () => void;
}) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70"
      onClick={onClose}
    >
      <div
        className="w-[400px] bg-[var(--surface)] border border-[var(--border)] flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center gap-2 px-5 py-4 border-b border-[var(--border)]">
          <AlertTriangle size={16} className="text-[var(--warning)]" />
          <span className="text-sm font-bold tracking-[0.1em] uppercase text-[var(--text-bright)]">
            NO ALPHA HINTS
          </span>
        </div>
        <div className="px-5 py-4 text-[11px] text-[var(--text-muted)] leading-relaxed">
          <p className="mb-4">
            <span className="text-[var(--text-bright)]">{clipName}</span>{" "}doesn&apos;t have
            alpha hints yet. CorridorKey needs alpha hints to know where the foreground is
            before it can generate a clean key.
          </p>
          <button
            onClick={onGenerate}
            className="w-full py-2 bg-[var(--accent)] text-[10px] uppercase tracking-wider font-bold text-white cursor-pointer hover:bg-[var(--accent-dim)] transition-colors"
          >
            GENERATE ALPHA HINTS
          </button>
        </div>
      </div>
    </div>
  );
}

function PartialHintModal({
  hintCount,
  totalFrames,
  onContinue,
  onGenerate,
  onClose,
}: {
  hintCount: number;
  totalFrames: number;
  onContinue: () => void;
  onGenerate: () => void;
  onClose: () => void;
}) {
  const pct = Math.round((hintCount / totalFrames) * 100);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70"
      onClick={onClose}
    >
      <div
        className="w-[400px] bg-[var(--surface)] border border-[var(--border)] flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center gap-2 px-5 py-4 border-b border-[var(--border)]">
          <AlertTriangle size={16} className="text-[var(--warning)]" />
          <span className="text-sm font-bold tracking-[0.1em] uppercase text-[var(--text-bright)]">
            PARTIAL ALPHA HINTS
          </span>
        </div>
        <div className="px-5 py-4 text-[11px] text-[var(--text-muted)] leading-relaxed">
          <p className="mb-3">
            Only <span className="text-[var(--text-bright)] font-bold">{hintCount}/{totalFrames}</span> frames
            ({pct}%) have alpha hints. Keying now will only process frames with hints — the rest will be skipped.
          </p>
          <div className="w-full h-1.5 bg-[#222] mb-4">
            <div className="h-full bg-[var(--warning)]" style={{ width: `${pct}%` }} />
          </div>
          <div className="flex gap-2">
            <button
              onClick={onGenerate}
              className="flex-1 py-2 border border-[var(--border)] text-[10px] uppercase tracking-wider font-bold text-[var(--text)] cursor-pointer hover:bg-[var(--surface-2)] transition-colors"
            >
              GENERATE REMAINING
            </button>
            <button
              onClick={onContinue}
              className="flex-1 py-2 bg-[var(--accent)] text-[10px] uppercase tracking-wider font-bold text-white cursor-pointer hover:bg-[var(--accent-dim)] transition-colors"
            >
              KEY ANYWAY
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function InfoOverlay({ onClose }: { onClose: () => void }) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70"
      onClick={onClose}
    >
      <div
        className="w-[560px] max-h-[80vh] bg-[var(--surface)] border border-[var(--border)] flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Sticky header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-[var(--border)] bg-[var(--surface)] sticky top-0 z-10 shrink-0">
          <span className="text-sm font-bold tracking-[0.15em] uppercase text-[var(--text-bright)]">
            ABOUT CORRIDORKEY
          </span>
          <button
            onClick={onClose}
            className="text-[var(--text-muted)] hover:text-[var(--text)] cursor-pointer transition-colors"
          >
            <X size={16} />
          </button>
        </div>

        {/* Scrollable content */}
        <div className="px-6 py-5 text-[11px] leading-relaxed text-[var(--text)] flex flex-col gap-5 overflow-y-auto">
          <Section title="WHAT IS KEYING?">
            Green screen keying is the process of separating a subject (person,
            object) from a green screen background. The result is an{" "}
            <strong className="text-[var(--text-bright)]">alpha matte</strong> — a
            black-and-white image where white is foreground and black is background.
            With the matte, you can composite the subject onto any background.
          </Section>

          <Section title="HOW CORRIDORKEY WORKS">
            CorridorKey uses a neural network to produce production-quality mattes
            with clean hair detail, motion blur, and translucency. It requires an{" "}
            <strong className="text-[var(--text-bright)]">alpha hint</strong> — a
            rough guess of where the foreground is — which it refines into a precise
            cutout. Think of it as: you give the AI a rough outline, it gives you
            back a perfect key.
          </Section>

          <Section title="ALPHA HINTS">
            <p className="mb-2">
              Before keying, each clip needs an alpha hint. There are two ways to
              generate one:
            </p>
            <div className="flex flex-col gap-2 pl-3 border-l border-[var(--border)]">
              <div>
                <strong className="text-[var(--text-bright)]">GVM AUTO</strong>
                <span className="text-[var(--text-muted)]"> — </span>
                One-click automatic segmentation. A separate model detects the
                foreground and generates the hint. Best for standard green screen
                shots with clear separation.
              </div>
              <div>
                <strong className="text-[var(--text-bright)]">VIDEOMAMA</strong>
                <span className="text-[var(--text-muted)]"> — </span>
                Artist-guided masking. You paint foreground (green) and background
                (red) brush strokes on a few keyframes, and VideoMaMa interpolates
                between them. More work, but much better for tricky shots.
              </div>
            </div>
          </Section>

          <Section title="THE PIPELINE">
            <div className="flex flex-col gap-1 text-[10px] font-bold tracking-wider uppercase">
              <Step num="1" text="Import video" desc="Drag files or click Import" />
              <Step num="2" text="Generate alpha hint" desc="GVM Auto or VideoMaMa" />
              <Step num="3" text="Key the clip" desc="CorridorKey refines the hint into a production matte" />
              <Step num="4" text="Export outputs" desc="FG, Matte, Comp, Processed — EXR or PNG" />
            </div>
          </Section>

          <Section title="CLIP STATES">
            <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-[10px]">
              <StateRow color="#f97316" label="EXTRACTING" desc="Video being decoded" />
              <StateRow color="#888" label="RAW" desc="Frames loaded, no alpha" />
              <StateRow color="#3b82f6" label="MASKED" desc="Annotations painted" />
              <StateRow color="#eab308" label="READY" desc="Alpha hint available" />
              <StateRow color="#22c55e" label="COMPLETE" desc="Keying done" />
              <StateRow color="#ef4444" label="ERROR" desc="Processing failed" />
            </div>
          </Section>

          <Section title="KEYBOARD SHORTCUTS">
            <div className="grid grid-cols-2 gap-x-4 gap-y-0.5 text-[10px]">
              <Shortcut keys="Q" desc="Toggle media/queue panel" />
              <Shortcut keys="Space" desc="Play / pause" />
              <Shortcut keys="I" desc="Set in-point" />
              <Shortcut keys="O" desc="Set out-point" />
              <Shortcut keys="1" desc="Foreground brush" />
              <Shortcut keys="2" desc="Background brush" />
            </div>
          </Section>
        </div>
      </div>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="text-[9px] uppercase tracking-[0.15em] text-[var(--text-muted)] font-bold mb-1.5">
        {title}
      </div>
      {children}
    </div>
  );
}

function Step({ num, text, desc }: { num: string; text: string; desc: string }) {
  return (
    <div className="flex items-baseline gap-2 py-1">
      <span className="text-[var(--accent)] w-4">{num}.</span>
      <span className="text-[var(--text-bright)]">{text}</span>
      <span className="text-[var(--text-muted)] font-normal text-[9px] normal-case tracking-normal">
        — {desc}
      </span>
    </div>
  );
}

function StateRow({ color, label, desc }: { color: string; label: string; desc: string }) {
  return (
    <div className="flex items-center gap-2">
      <div className="w-2 h-2 shrink-0" style={{ background: color }} />
      <span className="text-[var(--text)] uppercase tracking-wider">{label}</span>
      <span className="text-[var(--text-muted)]">— {desc}</span>
    </div>
  );
}

function Shortcut({ keys, desc }: { keys: string; desc: string }) {
  return (
    <div className="flex items-center gap-2">
      <span className="text-[var(--text-bright)] bg-[var(--surface-2)] border border-[var(--border)] px-1.5 py-0.5 text-[9px] font-bold min-w-6 text-center">
        {keys}
      </span>
      <span className="text-[var(--text-muted)]">{desc}</span>
    </div>
  );
}
