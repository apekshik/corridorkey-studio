"use client";

import { useEffect, useRef, useState } from "react";
import { useQuery } from "convex/react";
import { ChevronDown, Download, Settings } from "lucide-react";
import ProjectSwitcher from "./ProjectSwitcher";
import UserMenu from "./UserMenu";
import { api } from "../../convex/_generated/api";
import { Doc, Id } from "../../convex/_generated/dataModel";

interface Props {
  projectId: Id<"projects">;
  project: Doc<"projects"> | null | undefined;
}

type KeyScope = "selected" | "ready" | "all";
const SCOPES: { id: KeyScope; label: string; sub: string }[] = [
  { id: "selected", label: "Key Selected", sub: "Run only the highlighted clip" },
  { id: "ready", label: "Key All-Ready", sub: "Run every clip with hints present" },
  { id: "all", label: "Key Everything", sub: "Auto-generate hints for clips that need them" },
];

export default function TopBar({ projectId, project }: Props) {
  const clips = useQuery(api.clips.listByProject, { projectId }) ?? [];
  const [keyScope, setKeyScope] = useState<KeyScope>("ready");
  const [scopeOpen, setScopeOpen] = useState(false);
  const keyGroupRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!scopeOpen) return;
    const onDown = (e: MouseEvent) => {
      if (keyGroupRef.current && !keyGroupRef.current.contains(e.target as Node)) {
        setScopeOpen(false);
      }
    };
    window.addEventListener("mousedown", onDown);
    return () => window.removeEventListener("mousedown", onDown);
  }, [scopeOpen]);

  const clipCount = clips.length;
  const totalSeconds = clips.reduce((s, c) => s + (c.durationS ?? 0), 0);

  const scopeCount = scopeCountFor(keyScope, clips);
  const currentScope = SCOPES.find((s) => s.id === keyScope)!;
  // Keyed-frames coverage on the first clip (v1 stub until slice 4).
  const coverageClip = clips[0];
  const coverage = coverageClip
    ? { n: 0, m: coverageClip.frameCount ?? 0 }
    : null;

  return (
    <header
      className="grid items-stretch border-b border-[var(--rule-strong)] bg-[var(--bg-1)] min-w-0 select-none"
      style={{
        gridTemplateColumns: "var(--rail-w) minmax(0, 1fr) auto",
        height: "var(--topbar-h)",
      }}
    >
      {/* Brand */}
      <div
        className="flex items-center gap-3 border-r border-[var(--rule-strong)] min-w-0"
        style={{ padding: "0 var(--pad)" }}
      >
        <BrandMark />
        <div className="flex flex-col leading-none gap-1 min-w-0">
          <span
            className="text-[22px] italic text-[var(--ink-0)] leading-none tracking-[-0.01em] whitespace-nowrap"
            style={{ fontFamily: "var(--serif)" }}
          >
            Corridorkey
          </span>
          <span className="text-[10px] uppercase tracking-[0.18em] text-[var(--ink-2)] pt-0.5">
            Studio · v0.14
          </span>
        </div>
      </div>

      {/* Project + meta + coverage */}
      <div
        className="flex items-center gap-2.5 min-w-0 overflow-hidden"
        style={{ padding: "0 var(--pad)" }}
      >
        <div className="flex items-center gap-3.5 pr-3 border-r border-[var(--rule)] h-[60%] min-w-0">
          {project ? (
            <ProjectSwitcher projectId={projectId} currentName={project.name} />
          ) : (
            <div className="flex flex-col gap-[3px] leading-none">
              <span className="text-[9.5px] uppercase tracking-[0.22em] text-[var(--ink-3)]">
                Project /
              </span>
              <span
                className="text-[20px] italic text-[var(--ink-3)] leading-none"
                style={{ fontFamily: "var(--serif)" }}
              >
                …
              </span>
            </div>
          )}
          <div className="text-[11px] text-[var(--ink-2)] whitespace-nowrap overflow-hidden text-ellipsis flex items-center gap-2">
            <span className="tabular-nums">
              {String(clipCount).padStart(2, "0")} clips
            </span>
            <span className="text-[var(--ink-4)]">·</span>
            <span className="tabular-nums">{formatHMS(totalSeconds)} total</span>
            <span className="text-[var(--ink-4)]">·</span>
            <SaveState />
          </div>
        </div>

        {coverage && (
          <div
            className="flex items-center gap-2 border border-[var(--rule-strong)] text-[10px] uppercase tracking-[0.16em] px-2.5 whitespace-nowrap"
            style={{
              height: "calc(var(--topbar-h) - 16px)",
              color: coverage.n === coverage.m ? "var(--ok)" : "var(--warn)",
              background:
                coverage.n === coverage.m
                  ? "rgba(134,239,172,0.06)"
                  : "rgba(251,191,36,0.06)",
              borderColor:
                coverage.n === coverage.m ? "#1f3b2a" : "#4a3b14",
            }}
            title="Keyed-frame coverage for the selected clip"
          >
            <span
              className="w-[6px] h-[6px]"
              style={{
                background:
                  coverage.n === coverage.m ? "var(--ok)" : "var(--warn)",
              }}
            />
            Keyed {String(coverage.n).padStart(2, "0")} / {coverage.m}
          </div>
        )}
      </div>

      {/* Right actions */}
      <div className="flex items-stretch border-l border-[var(--rule-strong)] shrink-0">
        <button
          disabled
          title="Stop all jobs — slice 4"
          className="flex items-center gap-2 px-3 my-2 mr-1.5 ml-1 border border-[var(--rule-strong)] text-[var(--ink-2)] text-[10.5px] uppercase tracking-[0.2em] whitespace-nowrap opacity-50 cursor-not-allowed"
          style={{ height: "calc(var(--topbar-h) - 16px)" }}
        >
          <span
            className="w-[8px] h-[8px]"
            style={{ background: "var(--err)" }}
          />
          Stop
        </button>

        <div
          ref={keyGroupRef}
          role="group"
          aria-label="Key action"
          className="relative flex items-stretch my-2 ml-auto border text-[12px] font-bold uppercase tracking-[0.2em]"
          style={{
            height: "calc(var(--topbar-h) - 16px)",
            background: "var(--accent)",
            color: "var(--accent-ink)",
            borderColor: "var(--accent)",
          }}
        >
          <button
            disabled
            title="Key — slice 4"
            className="flex items-center gap-2.5 px-3.5 border-r border-black/25 cursor-not-allowed opacity-80"
          >
            Key
            <span className="text-[10px] font-medium opacity-70 tracking-[0.14em]">
              {currentScope.label.replace(/^Key /, "").toUpperCase()} ·{" "}
              {String(scopeCount).padStart(2, "0")}
            </span>
          </button>
          <button
            onClick={() => setScopeOpen((o) => !o)}
            aria-haspopup="menu"
            className="flex items-center gap-1.5 px-2.5 text-[10.5px] tracking-[0.14em]"
          >
            Scope <ChevronDown size={10} />
          </button>
          {scopeOpen && (
            <div
              role="menu"
              className="absolute top-[calc(100%+1px)] right-0 min-w-[260px] bg-[var(--bg-2)] border border-[var(--rule-strong)] text-[var(--ink-0)] z-[20]"
            >
              {SCOPES.map((s) => (
                <button
                  key={s.id}
                  role="menuitem"
                  onClick={() => {
                    setKeyScope(s.id);
                    setScopeOpen(false);
                  }}
                  className={`grid grid-cols-[1fr_auto] gap-3 w-full text-left px-3 py-2.5 border-b border-[var(--rule)] last:border-b-0 ${
                    s.id === keyScope
                      ? "bg-[var(--bg-3)]"
                      : "hover:bg-[var(--bg-3)]"
                  }`}
                >
                  <div>
                    <div
                      className={`uppercase tracking-[0.16em] text-[10.5px] ${
                        s.id === keyScope
                          ? "text-[var(--accent)]"
                          : "text-[var(--ink-0)]"
                      }`}
                    >
                      {s.label}
                    </div>
                    <div className="text-[10px] text-[var(--ink-2)] mt-0.5 tracking-normal normal-case">
                      {s.sub}
                    </div>
                  </div>
                  <span className="text-[10.5px] text-[var(--ink-2)] self-start">
                    {String(scopeCountFor(s.id, clips)).padStart(2, "0")}
                  </span>
                </button>
              ))}
            </div>
          )}
        </div>

        <IconButton title="Export config">
          <Download size={16} />
        </IconButton>
        <IconButton title="Settings">
          <Settings size={16} />
        </IconButton>
        <div className="flex items-center gap-2 px-2.5 border-l border-[var(--rule)] h-full whitespace-nowrap shrink-0">
          <UserMenu />
        </div>
      </div>
    </header>
  );
}

/* ----------------------------- subcomponents ---------------------------- */

function BrandMark() {
  return (
    <div
      aria-hidden
      className="relative grid place-items-center border border-[var(--ink-0)]"
      style={{ width: 26, height: 26 }}
    >
      <span
        className="absolute border border-[var(--ink-2)]"
        style={{ inset: 3 }}
      />
      <span
        className="absolute"
        style={{
          width: 6,
          height: 6,
          top: 2,
          right: 2,
          background: "var(--accent)",
        }}
      />
    </div>
  );
}

function IconButton({
  title,
  children,
  onClick,
}: {
  title: string;
  children: React.ReactNode;
  onClick?: () => void;
}) {
  return (
    <button
      onClick={onClick}
      title={title}
      className="grid place-items-center border-l border-[var(--rule)] text-[var(--ink-1)] hover:bg-[var(--bg-2)] hover:text-[var(--ink-0)] shrink-0"
      style={{ width: 40, height: "var(--topbar-h)" }}
    >
      {children}
    </button>
  );
}

function SaveState() {
  // Slice-3 stub — real dirty/save wiring lands with task #12.
  const [dirty] = useState(false);
  const label = dirty ? "unsaved" : "saved —:—";
  return (
    <span className="inline-flex items-center gap-1.5 tabular-nums">
      <span
        className={dirty ? "text-[var(--warn)]" : "text-[var(--ink-2)]"}
      >
        {label}
      </span>
    </span>
  );
}

/* ------------------------------- helpers -------------------------------- */

function formatHMS(seconds: number): string {
  if (!seconds || !isFinite(seconds)) return "00:00:00";
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = Math.floor(seconds % 60);
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:${String(
    s
  ).padStart(2, "0")}`;
}

function scopeCountFor(scope: KeyScope, clips: Doc<"clips">[]): number {
  if (scope === "selected") return clips.length > 0 ? 1 : 0;
  if (scope === "ready") return clips.filter((c) => c.state === "READY").length;
  return clips.length;
}
