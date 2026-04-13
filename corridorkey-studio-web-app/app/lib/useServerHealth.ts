"use client";

import { useEffect, useRef } from "react";
import { useSettingsStore } from "../stores/useSettingsStore";
import { useClipStore } from "../stores/useClipStore";
import { useQueueStore } from "../stores/useQueueStore";
import { BackendMode } from "./types";

const POLL_INTERVAL = 5000;

export function useServerHealth() {
  const serverUrl = useSettingsStore((s) => s.serverUrl);
  const backendMode = useSettingsStore((s) => s.backendMode);
  const setConnectionStatus = useSettingsStore((s) => s.setConnectionStatus);
  const setGPU = useSettingsStore((s) => s.setGPU);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const wasConnectedRef = useRef(false);

  useEffect(() => {
    if (backendMode !== BackendMode.LOCAL) {
      setConnectionStatus("disconnected");
      return;
    }

    const check = async () => {
      setConnectionStatus("connecting");
      try {
        const res = await fetch(`${serverUrl}/health`, {
          signal: AbortSignal.timeout(3000),
        });
        if (res.ok) {
          const data = await res.json();
          setConnectionStatus("connected");
          if (data.gpu) {
            setGPU(data.gpu);
          }
          // On first connection, fetch clips and jobs
          if (!wasConnectedRef.current) {
            wasConnectedRef.current = true;
            useClipStore.getState().refreshClips();
            useQueueStore.getState().refreshJobs();
          }
        } else {
          setConnectionStatus("disconnected");
          wasConnectedRef.current = false;
        }
      } catch {
        setConnectionStatus("disconnected");
        wasConnectedRef.current = false;
      }
    };

    check();
    timerRef.current = setInterval(check, POLL_INTERVAL);
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [serverUrl, backendMode, setConnectionStatus, setGPU]);
}
