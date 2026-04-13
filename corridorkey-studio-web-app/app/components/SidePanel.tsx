"use client";

import { useState, useMemo } from "react";
import { Plus, PanelLeftOpen, PanelLeftClose } from "lucide-react";
import { useClipStore } from "../stores/useClipStore";
import { useQueueStore } from "../stores/useQueueStore";
import { ClipState, CLIP_STATE_COLORS, JobStatus } from "../lib/types";

type Tab = "MEDIA" | "QUEUE";

export default function SidePanel() {
  const { isOpen, toggleQueue: toggle, jobs } = useQueueStore();
  const clips = useClipStore((s) => s.clips);
  const selectedId = useClipStore((s) => s.selectedClipId);
  const selectClip = useClipStore((s) => s.selectClip);
  const [tab, setTab] = useState<Tab>("MEDIA");

  const runningJobs = jobs.filter((j) => j.status === JobStatus.RUNNING).length;

  return (
    <div className="flex shrink-0">
      {/* Collapsed toggle strip — always visible */}
      {!isOpen && (
        <button
          onClick={toggle}
          className="w-8 border-r border-[var(--border)] bg-[var(--surface)] flex flex-col items-center pt-2 cursor-pointer hover:bg-[var(--surface-2)] transition-colors"
        >
          <PanelLeftOpen size={14} className="text-[var(--text-muted)]" />
          {runningJobs > 0 && (
            <div className="mt-2 w-2 h-2 bg-[var(--accent)]" />
          )}
        </button>
      )}

      {/* Expanded panel */}
      {isOpen && (
        <div className="w-60 border-r border-[var(--border)] bg-[var(--surface)] flex flex-col shrink-0">
          {/* Header with tabs + close */}
          <div className="flex items-center border-b border-[var(--border)]">
            <button
              onClick={() => setTab("MEDIA")}
              className={`flex-1 py-2 text-[10px] uppercase tracking-[0.15em] font-bold text-center cursor-pointer transition-colors border-r border-[var(--border)] ${
                tab === "MEDIA"
                  ? "text-[var(--text)] bg-[var(--surface-2)]"
                  : "text-[var(--text-muted)] hover:text-[var(--text)]"
              }`}
            >
              MEDIA ({clips.length})
            </button>
            <button
              onClick={() => setTab("QUEUE")}
              className={`flex-1 py-2 text-[10px] uppercase tracking-[0.15em] font-bold text-center cursor-pointer transition-colors border-r border-[var(--border)] relative ${
                tab === "QUEUE"
                  ? "text-[var(--text)] bg-[var(--surface-2)]"
                  : "text-[var(--text-muted)] hover:text-[var(--text)]"
              }`}
            >
              QUEUE ({jobs.length})
              {runningJobs > 0 && (
                <span className="absolute top-1 right-2 w-1.5 h-1.5 bg-[var(--accent)]" />
              )}
            </button>
            <button
              onClick={toggle}
              className="px-2 py-2 text-[var(--text-muted)] hover:text-[var(--text)] cursor-pointer transition-colors"
            >
              <PanelLeftClose size={14} />
            </button>
          </div>

          {/* Content */}
          <div className="flex-1 overflow-y-auto">
            {tab === "MEDIA" ? (
              <MediaTab
                clips={clips}
                selectedId={selectedId}
                selectClip={selectClip}
              />
            ) : (
              <QueueTab jobs={jobs} />
            )}
          </div>
        </div>
      )}
    </div>
  );
}

type Filter = "ALL" | "PENDING" | "COMPLETE" | "ERROR";
const FILTERS: { id: Filter; label: string }[] = [
  { id: "ALL", label: "ALL" },
  { id: "PENDING", label: "PENDING" },
  { id: "COMPLETE", label: "DONE" },
  { id: "ERROR", label: "ERR" },
];

function MediaTab({
  clips,
  selectedId,
  selectClip,
}: {
  clips: ReturnType<typeof useClipStore.getState>["clips"];
  selectedId: string | null;
  selectClip: (id: string) => void;
}) {
  const [filter, setFilter] = useState<Filter>("ALL");

  const filtered = useMemo(() => {
    switch (filter) {
      case "PENDING":
        return clips.filter((c) => c.state !== ClipState.COMPLETE && c.state !== ClipState.ERROR);
      case "COMPLETE":
        return clips.filter((c) => c.state === ClipState.COMPLETE);
      case "ERROR":
        return clips.filter((c) => c.state === ClipState.ERROR);
      default:
        return clips;
    }
  }, [clips, filter]);

  return (
    <>
      {/* Filter bar + import */}
      <div className="flex items-center border-b border-[var(--border)]">
        {FILTERS.map((f) => (
          <button
            key={f.id}
            onClick={() => setFilter(f.id)}
            className={`flex-1 py-1.5 text-[8px] uppercase tracking-[0.1em] font-bold text-center cursor-pointer transition-colors ${
              filter === f.id
                ? "text-[var(--text)] bg-[var(--surface-2)]"
                : "text-[var(--text-muted)] hover:text-[var(--text)]"
            }`}
          >
            {f.label}
          </button>
        ))}
        <button
          className="px-2 py-1.5 text-[var(--text-muted)] hover:text-[var(--text)] cursor-pointer transition-colors border-l border-[var(--border)]"
          title="Import clips"
        >
          <Plus size={12} />
        </button>
      </div>

      {/* Clip list */}
      {filtered.map((clip) => (
        <ClipRow key={clip.id} clip={clip} selected={clip.id === selectedId} onClick={() => selectClip(clip.id)} />
      ))}

      {filtered.length === 0 && (
        <div className="px-3 py-6 text-[10px] text-[var(--text-muted)] text-center">
          {clips.length === 0 ? "NO CLIPS" : "NO MATCHES"}
        </div>
      )}
    </>
  );
}

function ClipRow({
  clip,
  selected,
  onClick,
}: {
  clip: { id: string; name: string; state: ClipState; frameCount: number; warnings: string[] };
  selected: boolean;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={`w-full text-left px-3 py-2 border-b border-[var(--border)] cursor-pointer transition-colors flex gap-3 items-start ${
        selected ? "bg-[var(--surface-2)]" : "hover:bg-[var(--surface-2)]"
      }`}
    >
      {/* Thumbnail placeholder */}
      <div
        className="w-10 h-10 shrink-0 border border-[var(--border)] bg-[#1a1a1a] flex items-center justify-center relative"
      >
        <span className="text-[7px] text-[var(--text-muted)]">
          {clip.frameCount}f
        </span>
        <div
          className="absolute bottom-0 left-0 right-0 h-0.5"
          style={{ background: CLIP_STATE_COLORS[clip.state] }}
        />
      </div>
      <div className="flex-1 min-w-0">
        <div className="text-[10px] text-[var(--text)] truncate">
          {clip.name}
        </div>
        <div className="flex items-center justify-between">
          <span className="text-[8px] text-[var(--text-muted)] uppercase tracking-wider">
            {clip.state}
          </span>
          <span className="text-[8px] text-[var(--text-muted)] tabular-nums">
            {clip.frameCount} f
          </span>
        </div>
        {clip.warnings.length > 0 && (
          <div className="mt-0.5 text-[8px] text-[var(--warning)]">
            {clip.warnings.length} warning{clip.warnings.length > 1 ? "s" : ""}
          </div>
        )}
      </div>
    </button>
  );
}

function QueueTab({ jobs }: { jobs: ReturnType<typeof useQueueStore.getState>["jobs"] }) {
  return (
    <>
      {jobs.map((job) => (
        <div
          key={job.id}
          className="px-3 py-2 border-b border-[var(--border)]"
        >
          <div className="flex items-center justify-between mb-1">
            <span className="text-[10px] text-[var(--text)] truncate max-w-32">
              {job.clipName}
            </span>
            <span
              className={`text-[8px] uppercase tracking-wider ${
                job.status === JobStatus.RUNNING
                  ? "text-[var(--accent)]"
                  : job.status === JobStatus.COMPLETE
                  ? "text-[var(--success)]"
                  : "text-[var(--text-muted)]"
              }`}
            >
              {job.status}
            </span>
          </div>
          <div className="text-[8px] text-[var(--text-muted)] mb-1">
            {job.type.replace(/_/g, " ")}
          </div>
          <div className="w-full h-1 bg-[#222] relative">
            <div
              className="absolute inset-y-0 left-0 bg-[var(--accent)]"
              style={{ width: `${job.progress * 100}%` }}
            />
          </div>
          {job.status === JobStatus.RUNNING && (
            <div className="text-[8px] text-[var(--text-muted)] mt-0.5 tabular-nums">
              {job.currentFrame}/{job.totalFrames}
            </div>
          )}
        </div>
      ))}
      {jobs.length === 0 && (
        <div className="px-3 py-6 text-[10px] text-[var(--text-muted)] text-center">
          NO JOBS
        </div>
      )}
    </>
  );
}
