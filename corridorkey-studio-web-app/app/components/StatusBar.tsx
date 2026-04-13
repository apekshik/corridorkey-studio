"use client";

import { AlertTriangle } from "lucide-react";
import { useClipStore } from "../stores/useClipStore";
import { useQueueStore } from "../stores/useQueueStore";
import { JobStatus } from "../lib/types";

export default function StatusBar() {
  const clips = useClipStore((s) => s.clips);
  const selectedId = useClipStore((s) => s.selectedClipId);
  const jobs = useQueueStore((s) => s.jobs);

  const selectedClip = clips.find((c) => c.id === selectedId);
  const runningJob = jobs.find((j) => j.status === JobStatus.RUNNING);
  const totalWarnings = clips.reduce((sum, c) => sum + c.warnings.length, 0);

  return (
    <div className="h-9 flex items-center justify-between px-4 border-t border-[var(--border)] bg-[var(--surface)] shrink-0 select-none">
      {/* Progress bar */}
      <div className="flex items-center gap-3 flex-1">
        {runningJob && (
          <div className="w-32 h-1 bg-[#222] relative">
            <div
              className="absolute inset-y-0 left-0 bg-[var(--accent)]"
              style={{ width: `${runningJob.progress * 100}%` }}
            />
          </div>
        )}
        <span className="text-[10px] text-[var(--text-muted)]">
          {runningJob
            ? `${runningJob.currentFrame}/${runningJob.totalFrames} frames`
            : selectedClip
            ? `${selectedClip.frameCount} frames`
            : "NO CLIP SELECTED"}
        </span>
        {runningJob && (
          <span className="text-[10px] text-[var(--text-muted)]">
            ~02:30 ETA
          </span>
        )}
        {totalWarnings > 0 && (
          <span className="flex items-center gap-1 text-[10px] text-[var(--warning)]">
            <AlertTriangle size={10} />
            {totalWarnings}
          </span>
        )}
      </div>

    </div>
  );
}
