"use client";

import { useQueueStore } from "../stores/useQueueStore";
import { JobStatus } from "../lib/types";

export default function QueuePanel() {
  const { jobs, isOpen } = useQueueStore();

  if (!isOpen) return null;

  return (
    <div className="w-60 border-r border-[var(--border)] bg-[var(--surface)] flex flex-col shrink-0">
      <div className="px-3 py-2 text-[10px] uppercase tracking-[0.15em] text-[var(--text-muted)] font-bold border-b border-[var(--border)]">
        QUEUE ({jobs.length})
      </div>
      <div className="flex-1 overflow-y-auto">
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
              {job.type.replace("_", " ")}
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
          <div className="px-3 py-4 text-[10px] text-[var(--text-muted)] text-center">
            NO JOBS
          </div>
        )}
      </div>
    </div>
  );
}
