"use client";

import { useState } from "react";
import { ChevronLeft, ChevronRight, Download, Monitor, Wifi, WifiOff } from "lucide-react";
import { useSettingsStore } from "../stores/useSettingsStore";
import { useClipStore } from "../stores/useClipStore";
import { useQueueStore } from "../stores/useQueueStore";
import { ClipState, JobType } from "../lib/types";
import { createJob } from "../lib/api";
import { useResizeHandle } from "../lib/useResizeHandle";

const ALPHA_MODELS = ["GVM AUTO", "VIDEOMAMA"] as const;

export default function ParameterPanel() {
  const { inferenceParams, setInferenceParam, outputConfig, setOutputConfig } =
    useSettingsStore();
  const clips = useClipStore((s) => s.clips);
  const selectedId = useClipStore((s) => s.selectedClipId);
  const selectedClip = clips.find((c) => c.id === selectedId);
  const isComplete = selectedClip?.state === ClipState.COMPLETE;
  const isPartialKeyed =
    selectedClip?.state === ClipState.READY &&
    selectedClip.currentFrame > 0 &&
    selectedClip.currentFrame < selectedClip.frameCount;
  const canExport = isComplete || isPartialKeyed;
  const connected = useSettingsStore((s) => s.connectionStatus) === "connected";
  const addJob = useQueueStore((s) => s.addJob);
  const { width: panelWidth, onMouseDown: onResizeMouseDown } = useResizeHandle({ initialWidth: 280, minWidth: 220, maxWidth: 400, side: "left" });
  const [alphaModelIndex, setAlphaModelIndex] = useState(0);

  const cycleModel = (dir: -1 | 1) => {
    setAlphaModelIndex((i) => (i + dir + ALPHA_MODELS.length) % ALPHA_MODELS.length);
  };

  const handleGenerate = async () => {
    if (!selectedClip || !connected) return;
    const jobType = alphaModelIndex === 0 ? JobType.GVM_ALPHA : JobType.VIDEOMAMA_ALPHA;
    try {
      const job = await createJob(selectedClip.id, jobType);
      addJob(job);
    } catch (err) {
      console.error("Failed to create alpha job:", err);
    }
  };

  return (
    <div className="border-l border-[var(--border)] bg-[var(--surface)] shrink-0 relative flex flex-col overflow-y-auto" style={{ width: panelWidth }}>
      {/* Panel title */}
      <div className="px-4 py-2.5 text-xs font-bold tracking-[0.2em] uppercase text-[var(--text-bright)] border-b border-[var(--border)]">
        SETTINGS
      </div>

      {/* Keying */}
      <Section title="KEYING">
        <ParamRow label="Color Space">
          <select
            className="bg-[var(--surface-2)] border border-[var(--border)] text-[var(--text)] text-[10px] px-2 py-0.5 w-20 cursor-pointer"
            value={inferenceParams.inputIsLinear ? "linear" : "srgb"}
            onChange={(e) =>
              setInferenceParam("inputIsLinear", e.target.value === "linear")
            }
          >
            <option value="srgb">sRGB</option>
            <option value="linear">Linear</option>
          </select>
        </ParamRow>

        <ParamRow label="Despill">
          <div className="flex items-center gap-2 flex-1">
            <input
              type="range"
              min={0}
              max={1}
              step={0.01}
              value={inferenceParams.despillStrength}
              onChange={(e) =>
                setInferenceParam("despillStrength", parseFloat(e.target.value))
              }
              className="flex-1"
            />
            <span className="text-[10px] text-[var(--text-muted)] tabular-nums w-8 text-right">
              {inferenceParams.despillStrength.toFixed(2)}
            </span>
          </div>
        </ParamRow>

        <ParamRow label="Despeckle">
          <div className="flex items-center gap-2">
            <button
              className={`w-4 h-4 border border-[var(--border)] flex items-center justify-center cursor-pointer ${
                inferenceParams.autoDespeckle ? "bg-[var(--accent)]" : ""
              }`}
              onClick={() =>
                setInferenceParam("autoDespeckle", !inferenceParams.autoDespeckle)
              }
            />
            <input
              type="number"
              min={50}
              max={2000}
              value={inferenceParams.despeckleSize}
              onChange={(e) =>
                setInferenceParam("despeckleSize", parseInt(e.target.value) || 400)
              }
              disabled={!inferenceParams.autoDespeckle}
              className="w-14 bg-[var(--surface-2)] border border-[var(--border)] text-[var(--text)] text-[10px] px-1.5 py-0.5 tabular-nums disabled:opacity-30"
            />
          </div>
        </ParamRow>

        <ParamRow label="Refiner">
          <div className="flex items-center gap-2 flex-1">
            <input
              type="range"
              min={0}
              max={3}
              step={0.1}
              value={inferenceParams.refinerScale}
              onChange={(e) =>
                setInferenceParam("refinerScale", parseFloat(e.target.value))
              }
              className="flex-1"
            />
            <span className="text-[10px] text-[var(--text-muted)] tabular-nums w-8 text-right">
              {inferenceParams.refinerScale.toFixed(1)}
            </span>
          </div>
        </ParamRow>

        <ParamRow label="Live Preview">
          <button
            className={`w-4 h-4 border border-[var(--border)] flex items-center justify-center cursor-pointer ${
              inferenceParams.livePreview ? "bg-[var(--accent)]" : ""
            }`}
            onClick={() =>
              setInferenceParam("livePreview", !inferenceParams.livePreview)
            }
          />
        </ParamRow>
      </Section>

      {/* Alpha Generation */}
      <Section title="ALPHA GENERATION">
        <div className="flex items-center border border-[var(--border)]">
          <button
            onClick={() => cycleModel(-1)}
            className="px-2 py-1.5 text-[var(--text-muted)] hover:text-[var(--text)] cursor-pointer transition-colors border-r border-[var(--border)]"
          >
            <ChevronLeft size={12} />
          </button>
          <span className="flex-1 text-center text-[10px] uppercase tracking-wider font-bold text-[var(--text)] py-1.5">
            {ALPHA_MODELS[alphaModelIndex]}
          </span>
          <button
            onClick={() => cycleModel(1)}
            className="px-2 py-1.5 text-[var(--text-muted)] hover:text-[var(--text)] cursor-pointer transition-colors border-l border-[var(--border)]"
          >
            <ChevronRight size={12} />
          </button>
        </div>
        <div className="flex gap-2">
          <ActionButton label="GENERATE" accent onClick={handleGenerate} disabled={!selectedClip || !connected} />
          <ActionButton label="EXPORT MASKS" />
        </div>
      </Section>

      {/* Output Format */}
      <Section title="EXPORT SETTINGS">
        <OutputRow
          label="FG"
          enabled={outputConfig.fgEnabled}
          format={outputConfig.fgFormat}
          onToggle={() => setOutputConfig("fgEnabled", !outputConfig.fgEnabled)}
          onFormat={(f) => setOutputConfig("fgFormat", f)}
        />
        <OutputRow
          label="Matte"
          enabled={outputConfig.matteEnabled}
          format={outputConfig.matteFormat}
          onToggle={() =>
            setOutputConfig("matteEnabled", !outputConfig.matteEnabled)
          }
          onFormat={(f) => setOutputConfig("matteFormat", f)}
        />
        <OutputRow
          label="Comp"
          enabled={outputConfig.compEnabled}
          format={outputConfig.compFormat}
          onToggle={() =>
            setOutputConfig("compEnabled", !outputConfig.compEnabled)
          }
          onFormat={(f) => setOutputConfig("compFormat", f)}
        />
        <OutputRow
          label="Processed"
          enabled={outputConfig.processedEnabled}
          format={outputConfig.processedFormat}
          onToggle={() =>
            setOutputConfig("processedEnabled", !outputConfig.processedEnabled)
          }
          onFormat={(f) => setOutputConfig("processedFormat", f)}
        />
        <button
          disabled={!canExport}
          className={`w-full py-2 mt-2 flex flex-col items-center justify-center gap-0.5 text-[10px] uppercase tracking-wider font-bold transition-colors ${
            isComplete
              ? "bg-[var(--accent)] text-[var(--text-bright)] cursor-pointer hover:bg-[var(--accent-dim)]"
              : isPartialKeyed
              ? "bg-[var(--warning)] text-[var(--bg)] cursor-pointer hover:brightness-110"
              : "bg-[var(--surface-2)] text-[var(--text-muted)] opacity-40 cursor-not-allowed"
          }`}
        >
          <span className="flex items-center gap-2">
            <Download size={12} />
            {isPartialKeyed ? "EXPORT PARTIAL" : "EXPORT"}
          </span>
          {isPartialKeyed && selectedClip && (
            <span className="text-[8px] font-normal normal-case tracking-normal opacity-80">
              {selectedClip.currentFrame}/{selectedClip.frameCount} frames keyed
            </span>
          )}
        </button>
      </Section>

      {/* Spacer to push connection status to bottom */}
      <div className="flex-1" />

      {/* Connection status */}
      <ConnectionStatus />

      {/* Drag handle */}
      <div
        onMouseDown={onResizeMouseDown}
        className="w-1 cursor-col-resize hover:bg-[var(--accent)] transition-colors absolute top-0 bottom-0 left-0 z-10"
      />
    </div>
  );
}

function ConnectionStatus() {
  const connectionStatus = useSettingsStore((s) => s.connectionStatus);
  const gpu = useSettingsStore((s) => s.gpu);
  const isConnected = connectionStatus === "connected";

  return (
    <div className="border-t border-[var(--border)] px-4 py-3 shrink-0">
      <div className="flex items-center gap-2 mb-2">
        <div
          className="w-2 h-2 shrink-0"
          style={{
            background: isConnected ? "var(--success)" : connectionStatus === "connecting" ? "var(--warning)" : "var(--error)",
          }}
        />
        <span className="text-[10px] uppercase tracking-wider font-bold text-[var(--text)]">
          {isConnected ? "CONNECTED" : "NOT CONNECTED"}
        </span>
      </div>
      {isConnected ? (
        <div className="flex items-center gap-2 text-[9px] text-[var(--text-muted)]">
          <Monitor size={10} />
          <span>{gpu.name}</span>
          {gpu.vramTotal > 0 && (
            <span className="text-[var(--text-muted)]">
              {gpu.vramUsed.toFixed(1)}/{gpu.vramTotal.toFixed(1)} GB
            </span>
          )}
        </div>
      ) : (
        <div className="flex flex-col gap-2">
          <p className="text-[9px] text-[var(--text-muted)] leading-relaxed">
            Start the local server to begin keying.
          </p>
          <div className="bg-[#0a0a0a] border border-[var(--border)] px-2.5 py-1.5 text-[9px] text-[var(--text)] font-mono">
            corridorkey-studio serve
          </div>
        </div>
      )}
    </div>
  );
}

function Section({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className="border-b border-[var(--border)]">
      <div className="px-4 py-2 text-[10px] uppercase tracking-[0.15em] text-[var(--text-bright)] font-bold">
        {title}
      </div>
      <div className="px-4 pb-3 flex flex-col gap-2">{children}</div>
    </div>
  );
}

function ActionButton({ label, accent, onClick, disabled }: { label: string; accent?: boolean; onClick?: () => void; disabled?: boolean }) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={`w-full py-1.5 border text-[10px] uppercase tracking-wider font-bold transition-colors ${
        disabled
          ? "border-[var(--border)] text-[var(--text-muted)] opacity-40 cursor-not-allowed"
          : accent
          ? "border-[var(--accent)] bg-[var(--accent)] text-white cursor-pointer hover:bg-[var(--accent-dim)]"
          : "border-[var(--border)] text-[var(--text)] cursor-pointer hover:border-[var(--text-muted)] hover:bg-[var(--surface-2)]"
      }`}
    >
      {label}
    </button>
  );
}

function ParamRow({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex items-center justify-between gap-2">
      <span className="text-[10px] text-[var(--text-muted)] shrink-0">
        {label}
      </span>
      {children}
    </div>
  );
}

function OutputRow({
  label,
  enabled,
  format,
  onToggle,
  onFormat,
}: {
  label: string;
  enabled: boolean;
  format: "exr" | "png";
  onToggle: () => void;
  onFormat: (f: "exr" | "png") => void;
}) {
  return (
    <div className="flex items-center gap-2">
      <button
        className={`w-4 h-4 border border-[var(--border)] flex items-center justify-center cursor-pointer shrink-0 ${
          enabled ? "bg-[var(--accent)]" : ""
        }`}
        onClick={onToggle}
      />
      <span
        className={`text-[10px] flex-1 ${
          enabled ? "text-[var(--text)]" : "text-[var(--text-muted)] opacity-50"
        }`}
      >
        {label}
      </span>
      <select
        className="bg-[var(--surface-2)] border border-[var(--border)] text-[var(--text)] text-[10px] px-1.5 py-0.5 w-14 cursor-pointer disabled:opacity-30"
        value={format}
        onChange={(e) => onFormat(e.target.value as "exr" | "png")}
        disabled={!enabled}
      >
        <option value="exr">exr</option>
        <option value="png">png</option>
      </select>
    </div>
  );
}
