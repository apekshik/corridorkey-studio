"use client";

import { useMemo, useRef } from "react";
import { useSettingsStore } from "../stores/useSettingsStore";

/**
 * Right-side parameter panel. Maps 1:1 to ADR-01 (18 IN, 13 OUT) and
 * reflects the DESIGN_MOCK.html §2097–2202 layout:
 *   Alpha Hint → Color Space → Refine → Despill → Output.
 *
 * All controls are fully wired to `useSettingsStore` in slice 3; slice 4
 * will ship these values in the /alpha|/key|/pipeline fal submission
 * payload. The Alpha Hint coverage block is stubbed for now — the
 * numerator comes from the `frames` table once keying writes to it.
 */
export default function ParameterPanel() {
  const { inferenceParams, setInferenceParam, outputConfig, setOutputConfig } =
    useSettingsStore();

  return (
    <aside
      className="grid bg-[var(--bg-1)] border-l border-[var(--rule-strong)] min-w-0 overflow-hidden"
      style={{
        width: "var(--params-w)",
        gridTemplateRows: "var(--sectionlabel-h) 1fr",
      }}
    >
      <div
        className="flex items-center justify-between border-b border-[var(--rule-strong)] text-[10.5px] uppercase tracking-[0.22em] text-[var(--ink-2)]"
        style={{ padding: "0 var(--pad)" }}
      >
        <span>Parameters</span>
      </div>
      <div className="overflow-auto pb-5">
        <AlphaHintGroup />
        <ColorSpaceGroup
          inputIsLinear={inferenceParams.inputIsLinear}
          onChange={(v) => setInferenceParam("inputIsLinear", v)}
        />
        <RefineGroup
          value={inferenceParams.refinerScale}
          onChange={(v) => setInferenceParam("refinerScale", v)}
        />
        <DespillGroup
          strength={inferenceParams.despillStrength}
          onStrength={(v) => setInferenceParam("despillStrength", v)}
          autoDespeckle={inferenceParams.autoDespeckle}
          onAutoDespeckle={(v) => setInferenceParam("autoDespeckle", v)}
          despeckleSize={inferenceParams.despeckleSize}
          onDespeckleSize={(v) => setInferenceParam("despeckleSize", v)}
        />
        <OutputGroup
          config={outputConfig}
          onChange={(k, v) => setOutputConfig(k, v)}
        />
      </div>
    </aside>
  );
}

/* ============================ GROUPS ==================================== */

function AlphaHintGroup() {
  // Slice-3 stub — real keyed-frames coverage lives in api.frames (slice 4).
  const n = 0;
  const m = 0;
  const source = "gvm auto";

  return (
    <Group title="Alpha Hint" subtitle={`source · ${source}`}>
      <div
        className="grid gap-1.5 border-t border-b border-[var(--rule)] bg-[var(--bg-2)]"
        style={{ padding: "10px var(--pad)", margin: "2px -14px -12px" }}
      >
        <div className="flex justify-between text-[10px] uppercase tracking-[0.2em] text-[var(--warn)]">
          <span>Coverage</span>
          <span className="tabular-nums">
            {String(n).padStart(2, "0")} / {m}
          </span>
        </div>
        <div className="h-[3px] bg-[var(--bg-4)] relative">
          <div
            className="h-full bg-[var(--warn)]"
            style={{ width: m > 0 ? `${(n / m) * 100}%` : "0%" }}
          />
        </div>
        <div className="text-[10px] text-[var(--ink-2)] tracking-[0.04em]">
          <b className="text-[var(--warn)] font-medium">No coverage yet.</b>{" "}
          Keying queues GVM hints on run.
        </div>
        <div className="flex gap-1.5 mt-0.5">
          <button
            disabled
            className="flex-1 border text-[10px] uppercase tracking-[0.18em] font-bold py-1.5 cursor-not-allowed opacity-50 border-[var(--accent)] bg-[var(--accent)] text-[var(--accent-ink)]"
            title="Slice 4 wires keying"
          >
            Generate Remaining
          </button>
        </div>
      </div>
    </Group>
  );
}

function ColorSpaceGroup({
  inputIsLinear,
  onChange,
}: {
  inputIsLinear: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <Group title="Color Space" subtitle="per-clip">
      <Toggle
        label="Linear workflow"
        checked={inputIsLinear}
        onChange={onChange}
      />
      <Seg<"srgb" | "linear">
        value={inputIsLinear ? "linear" : "srgb"}
        options={[
          { v: "srgb", label: "sRGB" },
          { v: "linear", label: "LINEAR" },
        ]}
        onChange={(v) => onChange(v === "linear")}
      />
    </Group>
  );
}

function RefineGroup({
  value,
  onChange,
}: {
  value: number;
  onChange: (v: number) => void;
}) {
  return (
    <Group title="Refine" subtitle="corridorkey">
      <LabeledSlider
        label="Refiner strength"
        value={value}
        min={0}
        max={3}
        step={0.1}
        format={(v) => v.toFixed(2)}
        onChange={onChange}
      />
      <div className="text-[10px] leading-[1.5] text-[var(--ink-2)] pt-1 tracking-[0.02em]">
        <b className="text-[var(--ink-1)] font-medium">0.0</b> skips
        refinement · <b className="text-[var(--ink-1)] font-medium">1.0</b>{" "}
        default · <b className="text-[var(--ink-1)] font-medium">3.0</b>{" "}
        maximum detail (slower).
      </div>
    </Group>
  );
}

function DespillGroup({
  strength,
  onStrength,
  autoDespeckle,
  onAutoDespeckle,
  despeckleSize,
  onDespeckleSize,
}: {
  strength: number;
  onStrength: (v: number) => void;
  autoDespeckle: boolean;
  onAutoDespeckle: (v: boolean) => void;
  despeckleSize: number;
  onDespeckleSize: (v: number) => void;
}) {
  return (
    <Group title="Despill" subtitle="green suppression">
      <LabeledSlider
        label="Strength"
        value={strength}
        min={0}
        max={1}
        step={0.01}
        format={(v) => v.toFixed(2)}
        onChange={onStrength}
      />
      <Toggle
        label="Auto despeckle"
        checked={autoDespeckle}
        onChange={onAutoDespeckle}
      />
      <LabeledSlider
        label="Despeckle size"
        value={despeckleSize}
        min={50}
        max={2000}
        step={10}
        format={(v) => `${Math.round(v)} px`}
        onChange={(v) => onDespeckleSize(Math.round(v))}
        disabled={!autoDespeckle}
      />
    </Group>
  );
}

function OutputGroup({
  config,
  onChange,
}: {
  config: ReturnType<typeof useSettingsStore.getState>["outputConfig"];
  onChange: <K extends keyof typeof config>(k: K, v: (typeof config)[K]) => void;
}) {
  return (
    <Group title="Output" subtitle="per-job">
      <OutRow
        label="FG"
        hint="foreground"
        enabled={config.fgEnabled}
        onEnabled={(v) => onChange("fgEnabled", v)}
        format={config.fgFormat}
        onFormat={(v) => onChange("fgFormat", v)}
      />
      {config.fgEnabled && (
        <div className="flex -mt-[3px] mb-2 ml-9 border border-[var(--rule)] bg-[var(--bg-0)] w-max">
          <SubSeg
            value={config.fgPremult}
            options={[
              { v: "premult", label: "PREMULT" },
              { v: "straight", label: "STRAIGHT" },
            ]}
            onChange={(v) => onChange("fgPremult", v)}
          />
        </div>
      )}
      <OutRow
        label="MATTE"
        hint="alpha only"
        enabled={config.matteEnabled}
        onEnabled={(v) => onChange("matteEnabled", v)}
        format={config.matteFormat}
        onFormat={(v) => onChange("matteFormat", v)}
      />
      <OutRow
        label="COMP"
        hint="over plate"
        enabled={config.compEnabled}
        onEnabled={(v) => onChange("compEnabled", v)}
        format={config.compFormat}
        onFormat={(v) => onChange("compFormat", v)}
      />
      <OutRow
        label="PROCESSED"
        hint="full RGBA"
        enabled={config.processedEnabled}
        onEnabled={(v) => onChange("processedEnabled", v)}
        format={config.processedFormat}
        onFormat={(v) => onChange("processedFormat", v)}
      />

      <div
        aria-hidden
        className="border-t border-dashed border-[var(--rule)]"
        style={{ margin: "10px -14px 8px" }}
      />

      <Toggle
        label="Generate comp preview"
        checked={config.generateCompPreview}
        onChange={(v) => onChange("generateCompPreview", v)}
      />
      <div className="text-[10px] text-[var(--ink-3)] leading-[1.5] tracking-[0.02em]">
        Streams a low-res COMP during keying for live inspection.
      </div>
    </Group>
  );
}

/* ============================ PRIMITIVES ================================= */

function Group({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle?: string;
  children: React.ReactNode;
}) {
  return (
    <div
      className="border-b border-[var(--rule)]"
      style={{ padding: "10px var(--pad) 12px" }}
    >
      <div className="flex items-baseline justify-between text-[10.5px] uppercase tracking-[0.22em] text-[var(--ink-2)] mb-2">
        <span>{title}</span>
        {subtitle && (
          <span className="text-[var(--ink-3)] text-[10px] tracking-[0.04em] normal-case">
            {subtitle}
          </span>
        )}
      </div>
      <div className="flex flex-col gap-1">{children}</div>
    </div>
  );
}

function LabeledSlider({
  label,
  value,
  min,
  max,
  step,
  format,
  onChange,
  disabled,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  format: (v: number) => string;
  onChange: (v: number) => void;
  disabled?: boolean;
}) {
  const trackRef = useRef<HTMLDivElement>(null);
  const pct = useMemo(
    () => ((value - min) / (max - min)) * 100,
    [value, min, max]
  );

  const seek = (clientX: number) => {
    if (disabled) return;
    const t = trackRef.current;
    if (!t) return;
    const rect = t.getBoundingClientRect();
    const x = Math.max(0, Math.min(1, (clientX - rect.left) / rect.width));
    const raw = min + x * (max - min);
    const stepped = Math.round(raw / step) * step;
    onChange(clamp(stepped, min, max));
  };

  return (
    <div className={`grid gap-1 ${disabled ? "opacity-50" : ""}`}>
      <div className="grid grid-cols-[1fr_54px] items-center gap-2.5 py-[3px]">
        <span className="text-[10.5px] text-[var(--ink-1)] tracking-[0.04em] truncate">
          {label}
        </span>
        <span className="text-[10.5px] text-[var(--ink-0)] text-right tabular-nums">
          {format(value)}
        </span>
      </div>
      <div
        ref={trackRef}
        className="relative h-[18px] flex items-center"
        style={{ cursor: disabled ? "not-allowed" : "pointer" }}
        onMouseDown={(e) => {
          seek(e.clientX);
          const onMove = (ev: MouseEvent) => seek(ev.clientX);
          const onUp = () => {
            window.removeEventListener("mousemove", onMove);
            window.removeEventListener("mouseup", onUp);
          };
          window.addEventListener("mousemove", onMove);
          window.addEventListener("mouseup", onUp);
        }}
      >
        <div className="absolute left-0 right-0 h-[2px] bg-[var(--bg-4)]" />
        <div
          className="absolute left-0 h-[2px] bg-[var(--ink-0)]"
          style={{ width: `${pct}%` }}
        />
        <div
          className="absolute w-[8px] h-[12px] bg-[var(--ink-0)]"
          style={{ left: `${pct}%`, transform: "translateX(-50%)" }}
        />
      </div>
    </div>
  );
}

function Toggle({
  label,
  checked,
  onChange,
}: {
  label: string;
  checked: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <div className="flex items-center justify-between py-1">
      <span className="text-[10.5px] text-[var(--ink-1)] tracking-[0.04em]">
        {label}
      </span>
      <button
        role="switch"
        aria-checked={checked}
        onClick={() => onChange(!checked)}
        className="w-[28px] h-[14px] border relative shrink-0"
        style={{
          background: checked ? "var(--accent)" : "var(--bg-3)",
          borderColor: checked ? "var(--accent)" : "var(--rule)",
        }}
      >
        <span
          className="absolute top-[1px] w-[10px] h-[10px] transition-[left] duration-150"
          style={{
            left: checked ? "15px" : "1px",
            background: checked ? "var(--accent-ink)" : "var(--ink-2)",
          }}
        />
      </button>
    </div>
  );
}

function Seg<V extends string>({
  value,
  options,
  onChange,
}: {
  value: V;
  options: { v: V; label: string }[];
  onChange: (v: V) => void;
}) {
  return (
    <div className="flex border border-[var(--rule)] mt-0.5">
      {options.map((o, i) => (
        <button
          key={o.v}
          onClick={() => onChange(o.v)}
          aria-pressed={value === o.v}
          className={`flex-1 px-2 py-1.5 text-[10px] uppercase tracking-[0.16em] ${
            i < options.length - 1 ? "border-r border-[var(--rule)]" : ""
          } ${
            value === o.v
              ? "bg-[var(--bg-3)] text-[var(--ink-0)]"
              : "text-[var(--ink-2)] hover:text-[var(--ink-0)]"
          }`}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

function SubSeg<V extends string>({
  value,
  options,
  onChange,
}: {
  value: V;
  options: { v: V; label: string }[];
  onChange: (v: V) => void;
}) {
  return (
    <>
      {options.map((o, i) => (
        <button
          key={o.v}
          onClick={() => onChange(o.v)}
          aria-pressed={value === o.v}
          className={`px-2.5 py-[4px] text-[9.5px] uppercase tracking-[0.16em] ${
            i < options.length - 1 ? "border-r border-[var(--rule)]" : ""
          } ${
            value === o.v
              ? "bg-[var(--bg-2)] text-[var(--ink-1)]"
              : "text-[var(--ink-3)] hover:text-[var(--ink-1)]"
          }`}
        >
          {o.label}
        </button>
      ))}
    </>
  );
}

function OutRow({
  label,
  hint,
  enabled,
  onEnabled,
  format,
  onFormat,
}: {
  label: string;
  hint: string;
  enabled: boolean;
  onEnabled: (v: boolean) => void;
  format: "exr" | "png";
  onFormat: (v: "exr" | "png") => void;
}) {
  return (
    <div className="grid grid-cols-[1fr_auto] items-center gap-2.5 border-b border-[var(--rule)] py-[7px] last:border-b-0">
      <button
        role="switch"
        aria-checked={enabled}
        onClick={() => onEnabled(!enabled)}
        className="inline-flex items-center gap-2.5 text-left min-w-0"
      >
        <span
          className="w-[26px] h-[14px] border relative shrink-0"
          style={{
            background: enabled ? "var(--accent)" : "var(--bg-0)",
            borderColor: enabled ? "var(--accent)" : "var(--rule-strong)",
          }}
        >
          <span
            className="absolute top-[1px] w-[10px] h-[10px] transition-transform duration-150"
            style={{
              left: "1px",
              transform: enabled ? "translateX(12px)" : "translateX(0)",
              background: enabled ? "#0a0806" : "var(--ink-3)",
            }}
          />
        </span>
        <span
          className={`text-[11px] font-semibold tracking-[0.16em] ${
            enabled ? "text-[var(--ink-0)]" : "text-[var(--ink-2)]"
          }`}
        >
          {label}
        </span>
        <span className="text-[9.5px] uppercase tracking-[0.14em] text-[var(--ink-3)]">
          {hint}
        </span>
      </button>
      <div className="inline-flex border border-[var(--rule)] bg-[var(--bg-0)]">
        {(["exr", "png"] as const).map((f, i) => (
          <button
            key={f}
            onClick={() => onFormat(f)}
            aria-pressed={format === f}
            className={`px-2.5 py-[5px] text-[10px] uppercase tracking-[0.14em] ${
              i === 0 ? "border-r border-[var(--rule)]" : ""
            } ${
              format === f
                ? "bg-[var(--bg-2)] text-[var(--ink-0)]"
                : "text-[var(--ink-2)]"
            }`}
          >
            {f}
          </button>
        ))}
      </div>
    </div>
  );
}

function clamp(v: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, v));
}
