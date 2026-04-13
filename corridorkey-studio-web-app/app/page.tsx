"use client";

import { useEffect } from "react";
import TopBar from "./components/TopBar";
import StatusBar from "./components/StatusBar";
import DualViewer from "./components/DualViewer";
import FrameScrubber from "./components/FrameScrubber";
import ParameterPanel from "./components/ParameterPanel";
import SidePanel from "./components/SidePanel";
import { useQueueStore } from "./stores/useQueueStore";
import { useSettingsStore } from "./stores/useSettingsStore";

export default function Home() {
  const toggleQueue = useQueueStore((s) => s.toggleQueue);
  const toggleSettings = useSettingsStore((s) => s.toggleSettingsPanel);
  const settingsOpen = useSettingsStore((s) => s.settingsPanelOpen);

  // Keyboard shortcuts
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
