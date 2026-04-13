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
  const wasConnectedRef = useRef(false);
  const enabled = backendMode === BackendMode.LOCAL;

  const { data, isSuccess, isError } = useQuery({
    queryKey: ["server-health", serverUrl],
    queryFn: () => fetchHealth(serverUrl),
    refetchInterval: 5000,
    enabled,
    retry: false,
  });

  useEffect(() => {
    const store = useSettingsStore.getState();

    if (!enabled) {
      store.setConnectionStatus("disconnected");
      wasConnectedRef.current = false;
      return;
    }

    if (isSuccess) {
      console.log("[health] connected", data);
      store.setConnectionStatus("connected");
      if (data?.gpu) store.setGPU(data.gpu);
      if (!wasConnectedRef.current) {
        wasConnectedRef.current = true;
        useClipStore.getState().refreshClips();
        useQueueStore.getState().refreshJobs();
      }
    } else if (isError) {
      console.log("[health] disconnected");
      store.setConnectionStatus("disconnected");
      wasConnectedRef.current = false;
    }
  }, [enabled, isSuccess, isError, data]);
}
