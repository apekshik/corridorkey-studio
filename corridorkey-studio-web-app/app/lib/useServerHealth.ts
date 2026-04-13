"use client";

import { useEffect, useRef } from "react";
import { useSettingsStore } from "../stores/useSettingsStore";
import { BackendMode } from "./types";

const POLL_INTERVAL = 5000; // 5 seconds

export function useServerHealth() {
  const serverUrl = useSettingsStore((s) => s.serverUrl);
  const backendMode = useSettingsStore((s) => s.backendMode);
  const setConnectionStatus = useSettingsStore((s) => s.setConnectionStatus);
  const setGPU = useSettingsStore((s) => s.setGPU);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

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
        } else {
          setConnectionStatus("disconnected");
        }
      } catch {
        setConnectionStatus("disconnected");
      }
    };

    check();
    timerRef.current = setInterval(check, POLL_INTERVAL);
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [serverUrl, backendMode, setConnectionStatus, setGPU]);
}
