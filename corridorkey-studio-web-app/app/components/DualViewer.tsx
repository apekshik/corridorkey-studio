"use client";

import { useCallback, useEffect, useState, DragEvent } from "react";
import { Ruler, Upload } from "lucide-react";
import { useSessionClipStore } from "../stores/useSessionClipStore";
import { importClip } from "../lib/importClip";

type Layer = "alpha" | "fg" | "matte" | "comp" | "processed";
type ViewMode = "split-h" | "split-v" | "single";

const LAYERS: { id: Layer; label: string; key: string }[] = [
  { id: "alpha", label: "Alpha", key: "1" },
  { id: "fg", label: "FG", key: "2" },
  { id: "matte", label: "Matte", key: "3" },
  { id: "comp", label: "Comp", key: "4" },
  { id: "processed", label: "Processed", key: "5" },
];

/**
 * Viewer canvas. Slice 3 ships the full v2 chrome (header, view modes,
 * layer tabs, tools, pending overlay) but only the INPUT pane renders a
 * real frame — the OUTPUT layers are placeholders that go live in
 * slice 4 once the keying pipeline writes to `frames`.
 */
export default function DualViewer() {
  const session = useSessionClipStore();
  const [view, setView] = useState<ViewMode>("split-h");
  const [lastSplit, setLastSplit] = useState<"split-h" | "split-v">("split-h");
  const [layer, setLayer] = useState<Layer>("comp");
  const [dragOver, setDragOver] = useState(false);
  const [ruler, setRuler] = useState(true);
  const [checker, setChecker] = useState(false);

  const frameUrl =
    session.meta?.previewFrameUrls?.[session.currentFrame] ?? null;
  const busy = session.stage === "uploading" || session.stage === "extracting";

  const onDragOver = useCallback((e: DragEvent) => {
    if (e.dataTransfer.types.includes("Files")) {
      e.preventDefault();
      setDragOver(true);
    }
  }, []);
  const onDragLeave = useCallback(() => setDragOver(false), []);
  const onDrop = useCallback(async (e: DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    const file = e.dataTransfer.files[0];
    if (file) await importClip(file);
  }, []);

  // Keyboard shortcuts: 1..5 swap layer, F toggles split↔single, S → single.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement | null)?.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return;
      if (e.metaKey || e.ctrlKey) return;

      const k = e.key.toLowerCase();
      const layerHit = LAYERS.find((l) => l.key === k);
      if (layerHit) {
        setLayer(layerHit.id);
        e.preventDefault();
        return;
      }
      if (k === "f") {
        setView((cur) => {
          if (cur === "single") return lastSplit;
          setLastSplit(cur === "split-v" ? "split-v" : "split-h");
          return "single";
        });
      }
      if (k === "s") setView("single");
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [lastSplit]);

  return (
    <section
      className="grid bg-[var(--bg-0)] min-w-0 overflow-hidden flex-1 min-h-0 relative"
      style={{
        gridTemplateRows: "var(--sectionlabel-h) 1fr auto",
      }}
      onDragOver={onDragOver}
      onDragLeave={onDragLeave}
      onDrop={busy ? undefined : onDrop}
    >
      <ViewerHeader
        name={session.meta?.name ?? null}
        stateLabel={stateLabelFor(session.stage)}
        view={view}
        onView={(v) => {
          if (v !== "single") setLastSplit(v);
          setView(v);
        }}
      />

      <div className="relative overflow-hidden bg-[#050506]">
        <div
          className="absolute inset-0 grid"
          style={{
            gridTemplateColumns: view === "split-h" ? "1fr 1fr" : "1fr",
            gridTemplateRows: view === "split-v" ? "1fr 1fr" : "1fr",
          }}
        >
          {view !== "single" && (
            <InputPane frameUrl={frameUrl} session={session} />
          )}
          <OutputPane
            layer={layer}
            stage={session.stage}
            ruler={ruler}
            checker={checker}
          />
        </div>

        {dragOver && !busy && (
          <div className="absolute inset-0 bg-[rgba(74,222,128,0.08)] border-2 border-dashed border-[var(--accent)] flex items-center justify-center pointer-events-none z-50">
            <div className="flex flex-col items-center gap-2 text-[var(--accent)]">
              <Upload size={32} />
              <span className="text-xs uppercase tracking-[0.2em] font-bold">
                DROP TO IMPORT
              </span>
            </div>
          </div>
        )}
      </div>

      <LayerBar
        layer={layer}
        onLayer={setLayer}
        ruler={ruler}
        onRuler={() => setRuler((r) => !r)}
        checker={checker}
        onChecker={() => setChecker((c) => !c)}
      />
    </section>
  );
}

/* ----------------------------- header ----------------------------------- */

function ViewerHeader({
  name,
  stateLabel,
  view,
  onView,
}: {
  name: string | null;
  stateLabel: string | null;
  view: ViewMode;
  onView: (v: ViewMode) => void;
}) {
  return (
    <div className="flex items-stretch border-b border-[var(--rule-strong)] bg-[var(--bg-1)]">
      <div
        className="flex items-center gap-3 text-[10.5px] uppercase tracking-[0.22em] text-[var(--ink-2)] border-r border-[var(--rule)] min-w-0"
        style={{ padding: "0 var(--pad)" }}
      >
        <span>Clip</span>
        <span
          className="text-[var(--ink-0)] tracking-[0.04em] normal-case text-[11.5px] truncate"
          style={{ maxWidth: 320 }}
        >
          {name ?? "—"}
        </span>
        {stateLabel && (
          <span className="text-[9.5px] tracking-[0.22em] text-[var(--accent)]">
            · {stateLabel}
          </span>
        )}
      </div>
      <div className="flex ml-auto">
        <ModeBtn
          pressed={view === "split-h"}
          onClick={() => onView("split-h")}
          label="A │ B"
          kbd="F"
        />
        <ModeBtn
          pressed={view === "split-v"}
          onClick={() => onView("split-v")}
          label="A ─ B"
        />
        <ModeBtn
          pressed={view === "single"}
          onClick={() => onView("single")}
          label="Single"
          kbd="S"
        />
        <ModeBtn
          pressed={false}
          disabled
          label={
            <>
              Hint Painter{" "}
              <span className="ml-1 align-middle border border-dashed border-[var(--rule-strong)] text-[8.5px] tracking-[0.2em] px-1 py-[1px] text-[var(--ink-3)]">
                soon
              </span>
            </>
          }
        />
      </div>
    </div>
  );
}

function ModeBtn({
  label,
  pressed,
  disabled,
  kbd,
  onClick,
}: {
  label: React.ReactNode;
  pressed: boolean;
  disabled?: boolean;
  kbd?: string;
  onClick?: () => void;
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      aria-pressed={pressed}
      className={`px-3 border-l border-[var(--rule)] flex items-center gap-1.5 text-[10.5px] uppercase tracking-[0.18em] ${
        disabled
          ? "text-[var(--ink-3)] opacity-55 cursor-not-allowed"
          : pressed
          ? "text-[var(--ink-0)] bg-[var(--bg-2)]"
          : "text-[var(--ink-2)] hover:text-[var(--ink-0)]"
      }`}
    >
      {label}
      {kbd && <span className="text-[var(--ink-3)] text-[9.5px]">{kbd}</span>}
    </button>
  );
}

/* ----------------------------- panes ------------------------------------ */

function InputPane({
  frameUrl,
  session,
}: {
  frameUrl: string | null;
  session: ReturnType<typeof useSessionClipStore.getState>;
}) {
  const hasFrame = session.stage === "ready" && frameUrl;

  return (
    <div className="relative overflow-hidden border-r border-[var(--rule-strong)]">
      {/* Plate is the idle background — preview image layers on top once ready. */}
      <Plate />
      {hasFrame ? (
        <div className="absolute inset-0 flex items-center justify-center bg-[#050506]">
          <img
            // eslint-disable-next-line @next/next/no-img-element
            src={frameUrl!}
            alt={`frame ${session.currentFrame}`}
            className="max-w-full max-h-full object-contain"
          />
        </div>
      ) : (
        <InputSlate session={session} />
      )}
      <PaneLabel tag="A" label="INPUT · sRGB" />
    </div>
  );
}

function InputSlate({
  session,
}: {
  session: ReturnType<typeof useSessionClipStore.getState>;
}) {
  let title = "Drop a plate";
  let sub = "Video file · any codec ffmpeg supports";
  let tone: "default" | "warn" | "err" = "default";
  if (session.stage === "uploading") {
    title = "Uploading";
    sub = "Streaming source to fal CDN…";
    tone = "warn";
  } else if (session.stage === "extracting") {
    title = "Extracting";
    sub = "Decoding frames on the extract app…";
    tone = "warn";
  } else if (session.stage === "error") {
    title = "Import failed";
    sub = session.errorMessage ?? "Unknown error";
    tone = "err";
  }

  return (
    <Slate>
      <SlateTitle tone={tone}>{title}</SlateTitle>
      <SlateRow k="Status">
        {session.stage === "idle" ? "READY" : session.stage.toUpperCase()}
      </SlateRow>
      <SlateRow k="Hint">{sub}</SlateRow>
      <SlateRow k="Source">—</SlateRow>
      <SlateRow k="Codec">—</SlateRow>
    </Slate>
  );
}

function OutputPane({
  layer,
  stage,
  ruler,
  checker,
}: {
  layer: Layer;
  stage: string;
  ruler: boolean;
  checker: boolean;
}) {
  return (
    <div className="relative overflow-hidden bg-[#0a0a0a]">
      <Plate />

      {/* Checker background for FG / COMP */}
      {checker && (
        <div
          className="absolute inset-0"
          style={{
            background:
              "conic-gradient(#2b2d31 25%, #1e2024 0 50%, #2b2d31 0 75%, #1e2024 0)",
            backgroundSize: "20px 20px",
          }}
        />
      )}

      {/* Crosshair */}
      {ruler && (
        <div
          className="absolute inset-0 pointer-events-none"
          style={{
            background:
              "linear-gradient(to right, transparent calc(50% - 0.5px), rgba(255,255,255,0.05) calc(50% - 0.5px) calc(50% + 0.5px), transparent calc(50% + 0.5px)), linear-gradient(to bottom, transparent calc(50% - 0.5px), rgba(255,255,255,0.05) calc(50% - 0.5px) calc(50% + 0.5px), transparent calc(50% + 0.5px))",
          }}
        />
      )}

      <Slate>
        <SlateTitle>
          {stage === "ready" ? `${layer.toUpperCase()} pending` : "No output"}
        </SlateTitle>
        <SlateRow k="Layer">{outputLayerLabel(layer)}</SlateRow>
        <SlateRow k="Status">
          {stage === "ready" ? "AWAITING KEY" : "NO CLIP"}
        </SlateRow>
        <SlateRow k="Pipeline">slice 4 · fal webhook</SlateRow>
      </Slate>

      <PaneLabel tag="B" label={outputLayerLabel(layer)} />
    </div>
  );
}

/* ----------------------------- plate + slate ---------------------------- */

/** SMPTE color bars + PLUGE — the idle pane background. */
function Plate() {
  const topBars = ["#c0c0c0", "#c0c000", "#00c0c0", "#00c000", "#c000c0", "#c00000", "#0000c0"];
  const midBars = ["#0000c0", "#131313", "#c000c0", "#131313", "#00c0c0", "#131313", "#c0c0c0"];
  const botBars = [
    { bg: "#00214c", flex: 5 },
    { bg: "#ffffff", flex: 5 },
    { bg: "#32006a", flex: 5 },
    { bg: "#131313", flex: 5 },
    { bg: "#090909", flex: 1 },
    { bg: "#131313", flex: 1 },
    { bg: "#1d1d1d", flex: 1 },
    { bg: "#131313", flex: 2 },
    { bg: "#131313", flex: 2 },
    { bg: "#131313", flex: 2 },
  ];
  return (
    <div
      className="absolute inset-0 grid pointer-events-none"
      style={{ gridTemplateRows: "4fr 0.55fr 0.7fr" }}
      aria-hidden
    >
      <div className="grid" style={{ gridTemplateColumns: "repeat(7, 1fr)" }}>
        {topBars.map((bg, i) => (
          <span key={i} style={{ background: bg }} />
        ))}
      </div>
      <div className="grid" style={{ gridTemplateColumns: "repeat(7, 1fr)" }}>
        {midBars.map((bg, i) => (
          <span key={i} style={{ background: bg }} />
        ))}
      </div>
      <div
        className="grid"
        style={{
          gridTemplateColumns: botBars.map((b) => `${b.flex}fr`).join(" "),
        }}
      >
        {botBars.map((b, i) => (
          <span key={i} style={{ background: b.bg }} />
        ))}
      </div>
    </div>
  );
}

function Slate({ children }: { children: React.ReactNode }) {
  return (
    <div className="absolute inset-0 grid place-items-center pointer-events-none z-[3]">
      <div
        className="grid gap-y-1.5 gap-x-[18px] px-[18px] py-3.5 min-w-[280px] font-[var(--mono)] text-[11px] uppercase tracking-[0.12em]"
        style={{
          background: "rgba(11,12,14,0.72)",
          border: "1px solid rgba(255,255,255,0.22)",
          color: "var(--ink-0)",
          gridTemplateColumns: "auto auto",
        }}
      >
        {children}
      </div>
    </div>
  );
}

function SlateTitle({
  children,
  tone = "default",
}: {
  children: React.ReactNode;
  tone?: "default" | "warn" | "err";
}) {
  const color =
    tone === "warn"
      ? "var(--warn)"
      : tone === "err"
      ? "var(--err)"
      : "var(--ink-0)";
  return (
    <div
      className="col-span-full text-[24px] italic leading-[1] tracking-[0] normal-case mb-1.5"
      style={{ fontFamily: "var(--serif)", color }}
    >
      {children}
    </div>
  );
}

function SlateRow({ k, children }: { k: string; children: React.ReactNode }) {
  return (
    <>
      <span style={{ color: "rgba(242,239,232,0.6)" }}>{k}</span>
      <span>{children}</span>
    </>
  );
}

function PaneLabel({ tag, label }: { tag: string; label: string }) {
  return (
    <div
      className="absolute top-[10px] left-[10px] text-[10px] uppercase tracking-[0.22em] text-[var(--ink-0)] px-2 py-1 border border-[var(--rule-strong)] z-[2]"
      style={{ background: "rgba(11,12,14,0.75)" }}
    >
      <span className="text-[var(--ink-2)] mr-2">{tag} ·</span>
      {label}
    </div>
  );
}

/* ----------------------------- layer bar -------------------------------- */

function LayerBar({
  layer,
  onLayer,
  ruler,
  onRuler,
  checker,
  onChecker,
}: {
  layer: Layer;
  onLayer: (l: Layer) => void;
  ruler: boolean;
  onRuler: () => void;
  checker: boolean;
  onChecker: () => void;
}) {
  return (
    <div
      className="flex items-stretch border-t border-[var(--rule-strong)] bg-[var(--bg-1)]"
      style={{ height: 36 }}
    >
      {LAYERS.map((l) => (
        <button
          key={l.id}
          aria-pressed={layer === l.id}
          onClick={() => onLayer(l.id)}
          className={`px-3.5 flex items-center gap-2 text-[10.5px] uppercase tracking-[0.22em] border-r border-[var(--rule)] relative ${
            layer === l.id
              ? "text-[var(--ink-0)] bg-[var(--bg-2)]"
              : "text-[var(--ink-2)] hover:text-[var(--ink-0)]"
          }`}
        >
          <LayerSwatch layer={l.id} />
          {l.label}
          <span className="text-[var(--ink-3)] text-[9.5px] tracking-[0.04em]">
            {l.key}
          </span>
          {layer === l.id && (
            <span className="absolute left-0 right-0 -bottom-[1px] h-[2px] bg-[var(--ink-0)]" />
          )}
        </button>
      ))}
      <div className="flex-1" />
      <div className="flex items-center border-l border-[var(--rule-strong)]">
        <ToolBtn title="Fit to view">
          <svg
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.5"
            width="14"
            height="14"
          >
            <path d="M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5" />
          </svg>
        </ToolBtn>
        <ToolBtn title="100%">
          <svg
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.5"
            width="14"
            height="14"
          >
            <circle cx="11" cy="11" r="7" />
            <path d="M21 21l-4.35-4.35M8 11h6M11 8v6" />
          </svg>
        </ToolBtn>
        <ToolBtn title="Show ruler" pressed={ruler} onClick={onRuler}>
          <Ruler size={14} />
        </ToolBtn>
        <ToolBtn title="Checkerboard" pressed={checker} onClick={onChecker}>
          <svg
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.5"
            width="14"
            height="14"
          >
            <rect x="3" y="3" width="8" height="8" />
            <rect x="13" y="13" width="8" height="8" />
          </svg>
        </ToolBtn>
      </div>
    </div>
  );
}

function ToolBtn({
  title,
  children,
  pressed,
  onClick,
}: {
  title: string;
  children: React.ReactNode;
  pressed?: boolean;
  onClick?: () => void;
}) {
  return (
    <button
      title={title}
      onClick={onClick}
      aria-pressed={pressed}
      className={`w-9 h-9 grid place-items-center border-l border-[var(--rule)] hover:bg-[var(--bg-2)] hover:text-[var(--ink-0)] first:border-l-0 ${
        pressed ? "text-[var(--accent)]" : "text-[var(--ink-1)]"
      }`}
    >
      {children}
    </button>
  );
}

function LayerSwatch({ layer }: { layer: Layer }) {
  if (layer === "alpha") {
    return (
      <span
        className="w-[14px] h-[10px]"
        style={{
          background: "linear-gradient(to right, #fff 0 45%, #000 45% 100%)",
        }}
      />
    );
  }
  if (layer === "fg") {
    return (
      <span
        className="w-[14px] h-[10px]"
        style={{
          background:
            "conic-gradient(#3d8850 25%, #1f4a2a 0 50%, #3d8850 0 75%, #1f4a2a 0)",
          backgroundSize: "6px 5px",
        }}
      />
    );
  }
  if (layer === "matte") {
    return (
      <span
        className="w-[14px] h-[10px]"
        style={{ background: "#fff", border: "1px solid #fff" }}
      />
    );
  }
  if (layer === "comp") {
    return (
      <span
        className="w-[14px] h-[10px]"
        style={{
          background: "linear-gradient(135deg, #c0c000 0 50%, #00c0c0 50% 100%)",
        }}
      />
    );
  }
  return (
    <span
      className="w-[14px] h-[10px]"
      style={{ background: "linear-gradient(#666, #222)" }}
    />
  );
}

/* ----------------------------- helpers ---------------------------------- */

function outputLayerLabel(layer: Layer): string {
  switch (layer) {
    case "alpha":
      return "ALPHA · MATTE";
    case "fg":
      return "FG · PREMULT";
    case "matte":
      return "MATTE · 8F";
    case "comp":
      return "COMP · OVER BARS";
    case "processed":
      return "PROCESSED · RGBA";
  }
}

function stateLabelFor(stage: string): string | null {
  if (stage === "idle") return null;
  if (stage === "uploading") return "UPLOADING";
  if (stage === "extracting") return "EXTRACTING";
  if (stage === "ready") return "RAW";
  if (stage === "error") return "ERROR";
  return null;
}

