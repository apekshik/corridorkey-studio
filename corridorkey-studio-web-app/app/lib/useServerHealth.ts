"use client";

import { useEffect, useRef } from "react";
import { useQuery } from "@tanstack/react-query";
import { useSettingsStore } from "../stores/useSettingsStore";
import { useClipStore } from "../stores/useClipStore";
import { useQueueStore } from "../stores/useQueueStore";
import { BackendMode } from "./types";

async function fetchHealth(serverUrl: string) {
  const res = await fetch(`${serverUrl}/health`, {
    signal: AbortSignal.timeout(3000),
  });
  if (!res.ok) throw new Error(`Health check failed: ${res.status}`);
  return res.json();
}

export function useServerHealth() {
  const serverUrl = useSettingsStore((s) => s.serverUrl);
  const backendMode = useSettingsStore((s) => s.backendMode);
  const setConnectionStatus = useSettingsStore((s) => s.setConnectionStatus);
  const setGPU = useSettingsStore((s) => s.setGPU);
  const wasConnectedRef = useRef(false);

  const enabled = backendMode === BackendMode.LOCAL;

  const { data, status } = useQuery({
    queryKey: ["server-health", serverUrl],
    queryFn: () => fetchHealth(serverUrl),
    refetchInterval: 5000,
    enabled,
    retry: false,
  });

  // Sync query state → zustand store
  useEffect(() => {
    if (!enabled) {
      setConnectionStatus("disconnected");
      wasConnectedRef.current = false;
      return;
    }

    if (status === "success" && data) {
      setConnectionStatus("connected");
      if (data.gpu) setGPU(data.gpu);
      if (!wasConnectedRef.current) {
        wasConnectedRef.current = true;
        useClipStore.getState().refreshClips();
        useQueueStore.getState().refreshJobs();
      }
    } else if (status === "error") {
      setConnectionStatus("disconnected");
      wasConnectedRef.current = false;
    } else if (status === "pending") {
      setConnectionStatus("connecting");
    }
  }, [status, data, enabled, setConnectionStatus, setGPU]);
}
