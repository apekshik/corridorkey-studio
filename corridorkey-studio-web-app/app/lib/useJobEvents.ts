"use client";

import { useEffect, useRef } from "react";
import { useSettingsStore } from "../stores/useSettingsStore";
import { useClipStore } from "../stores/useClipStore";
import { useQueueStore } from "../stores/useQueueStore";
import { subscribeToJobEvents } from "./api";
import { ClipState, JobStatus } from "./types";

/**
 * Subscribe to SSE job events from the backend.
 * Updates queue store (job progress) and clip store (state transitions).
 */
export function useJobEvents() {
  const connectionStatus = useSettingsStore((s) => s.connectionStatus);
  const esRef = useRef<EventSource | null>(null);

  useEffect(() => {
    if (connectionStatus !== "connected") {
      if (esRef.current) {
        esRef.current.close();
        esRef.current = null;
      }
      return;
    }

    const es = subscribeToJobEvents(
      // job:progress
      (data) => {
        useQueueStore.getState().updateJobProgress(data.id, data.currentFrame, data.progress);
        if (data.status === "RUNNING") {
          useQueueStore.getState().updateJobStatus(data.id, JobStatus.RUNNING);
        }
      },
      // job:complete
      (data) => {
        useQueueStore.getState().updateJobStatus(data.id, JobStatus.COMPLETE);
        useQueueStore.getState().updateJobProgress(data.id, 0, 1);
        if (data.clipState && data.clipId) {
          useClipStore.getState().updateClipState(data.clipId, data.clipState as ClipState);
        }
        // Refresh clips to get updated metadata
        useClipStore.getState().refreshClips();
      },
      // job:error / job:cancelled
      (data) => {
        useQueueStore.getState().updateJobStatus(data.id, JobStatus.ERROR);
      },
      // clip:state
      (data) => {
        useClipStore.getState().updateClipState(data.id, data.state as ClipState);
        useClipStore.getState().refreshClips();
      }
    );

    esRef.current = es;
    return () => {
      es.close();
      esRef.current = null;
    };
  }, [connectionStatus]);
}
