"use client";

import { useRef, useState } from "react";
import { useQuery } from "convex/react";
import { Loader2, Upload, X } from "lucide-react";
import { useSessionClipStore } from "../stores/useSessionClipStore";
import { importClip } from "../lib/importClip";
import { api } from "../../convex/_generated/api";
import { Doc, Id } from "../../convex/_generated/dataModel";

interface Props {
  projectId: Id<"projects">;
}

type Tab = "media" | "queue";

/**
 * Left rail: Media / Queue tabs. Matches the prototype layout in
 * DESIGN_MOCK.html (lines 1765-1987). Queue is stubbed for slice 3 —
 * no jobs exist until slice 4's key pipeline ships.
 */
export default function SidePanel({ projectId }: Props) {
  const [tab, setTab] = useState<Tab>("media");
  const clips = useQuery(api.clips.listByProject, { projectId }) ?? [];
  const session = useSessionClipStore();

  const mediaCount = clips.length + (session.stage !== "idle" ? 1 : 0);

  return (
    <aside
      className="grid border-r border-[var(--rule-strong)] bg-[var(--bg-1)] min-w-0 overflow-hidden shrink-0"
      style={{
        width: "var(--rail-w)",
        gridTemplateRows: "auto 1fr",
      }}
    >
      <RailTabs
        tab={tab}
        onTab={setTab}
        mediaCount={mediaCount}
        queueCount={0}
      />
      <div className="overflow-auto">
        {tab === "media" ? <MediaTab clips={clips} /> : <QueueTab />}
      </div>
    </aside>
  );
}

function RailTabs({
  tab,
  onTab,
  mediaCount,
  queueCount,
}: {
  tab: Tab;
  onTab: (t: Tab) => void;
  mediaCount: number;
  queueCount: number;
}) {
  return (
    <div
      className="flex border-b border-[var(--rule-strong)]"
      style={{ height: "var(--sectionlabel-h)" }}
      role="tablist"
    >
      <TabButton
        label="Media"
        count={mediaCount}
        selected={tab === "media"}
        onClick={() => onTab("media")}
      />
      <TabButton
        label="Queue"
        count={queueCount}
        selected={tab === "queue"}
        onClick={() => onTab("queue")}
      />
    </div>
  );
}

function TabButton({
  label,
  count,
  selected,
  onClick,
}: {
  label: string;
  count: number;
  selected: boolean;
  onClick: () => void;
}) {
  return (
    <button
      role="tab"
      aria-selected={selected}
      onClick={onClick}
      className={`flex-1 flex items-center justify-between text-[10.5px] uppercase tracking-[0.22em] border-r border-[var(--rule)] last:border-r-0 relative transition-colors ${
        selected
          ? "text-[var(--ink-0)] bg-[var(--bg-2)]"
          : "text-[var(--ink-2)] hover:text-[var(--ink-0)]"
      }`}
      style={{ padding: "0 var(--pad)" }}
    >
      <span>{label}</span>
      <span
        className={`text-[10px] tracking-[0.08em] border px-1.5 py-0.5 ${
          selected
            ? "text-[var(--ink-0)] border-[var(--rule-strong)] bg-[var(--bg-3)]"
            : "text-[var(--ink-1)] border-[var(--rule)] bg-[var(--bg-3)]"
        }`}
      >
        {String(count).padStart(2, "0")}
      </span>
      {selected && (
        <span className="absolute left-0 right-0 top-0 h-[2px] bg-[var(--ink-0)]" />
      )}
    </button>
  );
}

/* ================================= MEDIA ================================ */

function MediaTab({ clips }: { clips: Doc<"clips">[] }) {
  const fileRef = useRef<HTMLInputElement>(null);
  const session = useSessionClipStore();

  const handlePick = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;
    await importClip(files[0]);
    if (fileRef.current) fileRef.current.value = "";
  };

  return (
    <div>
      <input
        ref={fileRef}
        type="file"
        accept="video/*,.mov,.mp4,.avi,.mxf,.mkv,.webm,.m4v"
        className="hidden"
        onChange={handlePick}
      />

      <MediaToolbar />

      <ul className="list-none m-0 p-0">
        {session.stage !== "idle" && <SessionClipRow />}
        {clips.map((clip) => (
          <ClipRow key={clip._id} clip={clip} />
        ))}
      </ul>

      <button
        onClick={() => fileRef.current?.click()}
        className="mx-2.5 mt-2.5 mb-3.5 w-[calc(100%-20px)] border border-dashed border-[var(--rule-strong)] text-center flex flex-col items-center gap-1.5 py-[18px] px-3.5 hover:border-[var(--ink-3)] hover:bg-white/[0.015] cursor-pointer"
      >
        <Upload size={22} className="text-[var(--ink-3)]" />
        <span
          className="text-[15px] italic text-[var(--ink-1)]"
          style={{ fontFamily: "var(--serif)" }}
        >
          Drop plates here
        </span>
        <span className="text-[9.5px] uppercase tracking-[0.16em] text-[var(--ink-3)]">
          or import from S3, GCS, Dropbox, Frame.io
          <span className="ml-1.5 inline-block align-middle border border-dashed border-[var(--rule-strong)] px-1 py-[1px] text-[8.5px] tracking-[0.2em] text-[var(--ink-3)]">
            soon
          </span>
        </span>
      </button>
    </div>
  );
}

function MediaToolbar() {
  return (
    <div
      className="flex items-center justify-between border-b border-[var(--rule)] text-[10.5px] uppercase tracking-[0.16em] text-[var(--ink-2)]"
      style={{ padding: "8px var(--pad)" }}
    >
      <input
        className="flex-1 bg-transparent border-0 border-b border-[var(--rule)] text-[var(--ink-0)] text-[11px] tracking-[0.02em] px-0 py-1 outline-none focus:border-[var(--ink-1)]"
        placeholder="FILTER CLIPS /"
      />
      <span className="text-[var(--ink-2)] pl-2">SORT ↓</span>
    </div>
  );
}

/** Ephemeral in-browser session clip — not yet in Convex. */
function SessionClipRow() {
  const s = useSessionClipStore();
  const meta = s.meta;
  const busy = s.stage === "uploading" || s.stage === "extracting";

  const stateLabel =
    s.stage === "uploading"
      ? "UPLOADING"
      : s.stage === "extracting"
      ? "EXTRACTING"
      : s.stage === "ready"
      ? "RAW"
      : s.stage === "error"
      ? "ERROR"
      : "";
  const stateKey =
    s.stage === "uploading"
      ? "uploading"
      : s.stage === "extracting"
      ? "extracting"
      : s.stage === "error"
      ? "error"
      : "raw";

  return (
    <li
      className="grid gap-2.5 border-b border-[var(--rule)] cursor-pointer relative items-stretch"
      style={{
        gridTemplateColumns: "64px minmax(0, 1fr) auto",
        padding: "10px var(--pad)",
        background: "var(--bg-2)",
      }}
      aria-selected
      data-state={stateKey}
    >
      <Thumb
        src={meta?.thumbnailUrl}
        busy={busy}
        uploading={s.stage === "uploading"}
        progress={s.progress}
        tc={meta ? `${meta.frameCount} fr` : busy ? "——:——" : ""}
        stateKey={stateKey}
      />
      <div className="flex flex-col justify-between py-[1px] min-w-0">
        <div className="text-[11.5px] text-[var(--ink-0)] truncate tracking-[0.02em]">
          {meta?.name ?? "session clip"}
        </div>
        <div className="text-[10px] text-[var(--ink-2)] tracking-[0.04em] flex gap-2.5 items-center">
          {meta && (
            <>
              <span>{meta.width}×{meta.height}</span>
              <span className="text-[var(--ink-4)]">·</span>
              <span>{meta.fps.toFixed(0)} fps</span>
              <span className="text-[var(--ink-4)]">·</span>
              <span>{meta.frameCount} fr</span>
            </>
          )}
          {!meta && busy && (
            <span>{s.stage === "uploading" ? "uploading" : "decoding"}</span>
          )}
          {!meta && s.stage === "error" && (
            <span className="text-[var(--err)]">{s.errorMessage}</span>
          )}
        </div>
        {busy && (
          <div className="col-span-full h-[2px] bg-[var(--bg-3)] mt-1.5 relative overflow-hidden">
            <div
              className="h-full bg-[var(--accent)]"
              style={{ width: `${Math.max(0.05, s.progress) * 100}%` }}
            />
          </div>
        )}
      </div>
      <StateAside
        stateLabel={stateLabel}
        stateKey={stateKey}
        hint={meta ? `${meta.codec?.toUpperCase() ?? ""}` : "session"}
        dismissable={!busy}
        onDismiss={() => s.reset()}
      />
    </li>
  );
}

function ClipRow({ clip }: { clip: Doc<"clips"> }) {
  const stateKey = clip.state.toLowerCase();
  const stateLabel = clip.state;
  const hint =
    clip.state === "READY" || clip.state === "MASKED"
      ? "AUTO · GVM"
      : clip.codec ?? "";

  return (
    <li
      className="grid gap-2.5 border-b border-[var(--rule)] cursor-pointer relative items-stretch hover:bg-[var(--bg-2)]"
      style={{
        gridTemplateColumns: "64px minmax(0, 1fr) auto",
        padding: "10px var(--pad)",
      }}
      data-state={stateKey}
    >
      <Thumb
        src={clip.thumbnailUrl ?? undefined}
        busy={false}
        uploading={false}
        progress={1}
        tc={clip.frameCount ? `${clip.frameCount} fr` : "——:——"}
        stateKey={stateKey}
      />
      <div className="flex flex-col justify-between py-[1px] min-w-0">
        <div className="text-[11.5px] text-[var(--ink-0)] truncate tracking-[0.02em]">
          {clip.name}
        </div>
        <div className="text-[10px] text-[var(--ink-2)] tracking-[0.04em] flex gap-2.5 items-center">
          {clip.width && clip.height && (
            <>
              <span>
                {clip.width}×{clip.height}
              </span>
              <span className="text-[var(--ink-4)]">·</span>
            </>
          )}
          {clip.fps && (
            <>
              <span>{clip.fps.toFixed(0)} fps</span>
              <span className="text-[var(--ink-4)]">·</span>
            </>
          )}
          {clip.frameCount && <span>{clip.frameCount} fr</span>}
        </div>
      </div>
      <StateAside
        stateLabel={stateLabel}
        stateKey={stateKey}
        hint={hint}
        dismissable={false}
      />
    </li>
  );
}

function Thumb({
  src,
  busy,
  uploading,
  progress,
  tc,
  stateKey,
}: {
  src?: string;
  busy: boolean;
  uploading: boolean;
  progress: number;
  tc: string;
  stateKey: string;
}) {
  const stateColor = stateColorFor(stateKey);
  return (
    <div
      className="relative overflow-hidden border border-[var(--rule)] bg-[var(--bg-0)]"
      style={{ width: 64, height: 42 }}
    >
      {src ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={src}
          alt=""
          className="w-full h-full object-cover"
        />
      ) : uploading ? (
        <div className="absolute inset-0 bg-[repeating-linear-gradient(-45deg,#1b1e23_0_6px,#23272e_6px_12px)]" />
      ) : busy ? (
        <>
          <div className="absolute inset-0" />
          <Loader2
            size={12}
            className="absolute inset-0 m-auto text-[var(--ink-3)] animate-spin"
          />
        </>
      ) : (
        <div className="absolute inset-0 bg-gradient-to-br from-[#2a3a2a] to-[#1a2418] opacity-60" />
      )}
      <span
        className="absolute top-[2px] left-[3px] text-[8.5px] tracking-[0.06em] text-[var(--ink-1)]"
        style={{ textShadow: "0 0 4px rgba(0,0,0,0.8)" }}
      >
        {tc}
      </span>
      <div
        className="absolute left-0 right-0 bottom-0 h-[3px] bg-[var(--ink-4)]"
      >
        <div
          className="h-full"
          style={{
            width: `${Math.max(0, Math.min(1, progress)) * 100}%`,
            background: stateColor,
          }}
        />
      </div>
    </div>
  );
}

function StateAside({
  stateLabel,
  stateKey,
  hint,
  dismissable,
  onDismiss,
}: {
  stateLabel: string;
  stateKey: string;
  hint: string;
  dismissable: boolean;
  onDismiss?: () => void;
}) {
  const stateColor = stateColorFor(stateKey);
  const border = stateBorderFor(stateKey);
  return (
    <div className="flex flex-col items-end justify-between gap-1 pt-[1px] min-w-0 shrink-0">
      <div className="flex items-center gap-1.5">
        <span
          className="text-[9px] uppercase tracking-[0.14em] py-[2px] px-[5px] border leading-[1.1] whitespace-nowrap"
          style={{
            color: stateColor,
            borderColor: border,
          }}
        >
          {stateLabel}
        </span>
        {dismissable && onDismiss && (
          <button
            onClick={(e) => {
              e.stopPropagation();
              onDismiss();
            }}
            className="text-[var(--ink-3)] hover:text-[var(--err)] shrink-0"
            title="Discard session clip"
          >
            <X size={11} />
          </button>
        )}
      </div>
      <div className="text-[9px] text-[var(--ink-2)] tracking-[0.04em] whitespace-nowrap">
        {hint}
      </div>
    </div>
  );
}

function stateColorFor(k: string): string {
  switch (k) {
    case "uploading":
      return "#60a5fa";
    case "extracting":
      return "var(--warn)";
    case "raw":
      return "var(--ink-1)";
    case "masked":
      return "#c084fc";
    case "ready":
      return "var(--ok)";
    case "keying":
      return "var(--accent)";
    case "complete":
      return "var(--ink-0)";
    case "error":
      return "var(--err)";
    default:
      return "var(--ink-3)";
  }
}

function stateBorderFor(k: string): string {
  switch (k) {
    case "uploading":
      return "#23344a";
    case "extracting":
    case "keying":
      return "#4a3b14";
    case "masked":
      return "#3a2e4a";
    case "ready":
      return "#1f3b2a";
    case "error":
      return "#4a1f1f";
    default:
      return "var(--rule)";
  }
}

/* ================================= QUEUE ================================ */

function QueueTab() {
  return (
    <div>
      <div
        className="flex items-center justify-between border-b border-[var(--rule)] text-[10.5px] uppercase tracking-[0.16em] text-[var(--ink-2)]"
        style={{ padding: "8px var(--pad)" }}
      >
        <span>ACTIVE · 00 · QUEUED · 00</span>
        <span className="text-[var(--ink-2)]">CLOUD</span>
      </div>
      <div className="p-6 text-[10px] uppercase tracking-[0.16em] text-[var(--ink-3)] text-center">
        No jobs yet — slice 4 wires keying.
      </div>
    </div>
  );
}
