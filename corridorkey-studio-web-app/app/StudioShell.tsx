"use client";

import { useEffect } from "react";
import { useMutation } from "convex/react";
import TopBar from "./components/TopBar";
import StatusBar from "./components/StatusBar";
import DualViewer from "./components/DualViewer";
import FrameScrubber from "./components/FrameScrubber";
import ParameterPanel from "./components/ParameterPanel";
import SidePanel from "./components/SidePanel";
import SplashScreen from "./components/SplashScreen";
import { useQueueStore } from "./stores/useQueueStore";
import { useSettingsStore } from "./stores/useSettingsStore";
import { useServerHealth } from "./lib/useServerHealth";
import { useJobEvents } from "./lib/useJobEvents";
import { api } from "../convex/_generated/api";

interface StudioShellProps {
  workosUser: {
    email: string;
    name?: string;
    profileImageUrl?: string;
  };
}

export default function StudioShell({ workosUser }: StudioShellProps) {
  const toggleQueue = useQueueStore((s) => s.toggleQueue);
  const toggleSettings = useSettingsStore((s) => s.toggleSettingsPanel);
  const settingsOpen = useSettingsStore((s) => s.settingsPanelOpen);
  const getOrCreate = useMutation(api.users.getOrCreate);

  // Mirror the WorkOS identity into Convex on first render.
  useEffect(() => {
    getOrCreate({
      email: workosUser.email,
      name: workosUser.name,
      profileImageUrl: workosUser.profileImageUrl,
    }).catch((err) => {
      console.error("[user sync] failed:", err);
    });
  }, [getOrCreate, workosUser.email, workosUser.name, workosUser.profileImageUrl]);

  // LOCAL-mode effects — become no-ops in CLOUD mode
  useServerHealth();
  useJobEvents();

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement).tagName;
      if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return;
      if (e.metaKey || e.ctrlKey) return;

      switch (e.key) {
        case "q":
          toggleQueue();
          break;
        case "e":
          toggleSettings();
          break;
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [toggleQueue, toggleSettings]);

  return (
    <div className="h-full flex flex-col">
      <SplashScreen />
      <TopBar />
      <div className="flex flex-1 min-h-0">
        <SidePanel />
        <div className="flex flex-col flex-1 min-w-0">
          <DualViewer />
          <FrameScrubber />
        </div>
        {settingsOpen && <ParameterPanel />}
      </div>
      <StatusBar />
    </div>
  );
}
