"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useMutation, useQuery } from "convex/react";
import { Check, Plus } from "lucide-react";
import { api } from "../../convex/_generated/api";
import { Doc, Id } from "../../convex/_generated/dataModel";

interface Props {
  projectId: Id<"projects">;
  currentName: string;
}

/**
 * Top-bar project switcher: serif-italic name + caret trigger. Dropdown
 * lists the user's projects (search-filtered) and offers a "+ New
 * Project" action. "Manage all…" is a slice-5+ placeholder (ghost state).
 *
 * Double-click on the name lets the user rename the current project
 * in-place — the fastest path since we don't yet have a manage page.
 */
export default function ProjectSwitcher({ projectId, currentName }: Props) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [renaming, setRenaming] = useState(false);
  const [renameValue, setRenameValue] = useState(currentName);
  const [filter, setFilter] = useState("");
  const rootRef = useRef<HTMLDivElement>(null);

  const projects = useQuery(api.projects.list) ?? [];
  const createProject = useMutation(api.projects.create);
  const renameProject = useMutation(api.projects.rename);

  useEffect(() => {
    setRenameValue(currentName);
  }, [currentName]);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    window.addEventListener("mousedown", onDown);
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("mousedown", onDown);
      window.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const commitRename = async () => {
    const trimmed = renameValue.trim();
    setRenaming(false);
    if (!trimmed || trimmed === currentName) {
      setRenameValue(currentName);
      return;
    }
    try {
      await renameProject({ projectId, name: trimmed });
    } catch (err) {
      console.error("[project rename] failed:", err);
      setRenameValue(currentName);
    }
  };

  const handleCreate = async () => {
    try {
      const id = await createProject({ name: "Untitled" });
      setOpen(false);
      router.push(`/projects/${id}`);
    } catch (err) {
      console.error("[project create] failed:", err);
    }
  };

  const filtered = projects.filter((p) =>
    p.name.toLowerCase().includes(filter.toLowerCase())
  );

  return (
    <div className="relative flex items-center min-w-0" ref={rootRef}>
      {renaming ? (
        <input
          autoFocus
          value={renameValue}
          onChange={(e) => setRenameValue(e.target.value)}
          onBlur={commitRename}
          onKeyDown={(e) => {
            if (e.key === "Enter") commitRename();
            if (e.key === "Escape") {
              setRenameValue(currentName);
              setRenaming(false);
            }
          }}
          className="bg-transparent outline-none text-[20px] italic leading-none text-[var(--ink-0)] border-b border-[var(--ink-2)] min-w-0"
          style={{ fontFamily: "var(--serif)", width: "14ch" }}
        />
      ) : (
        <button
          onClick={() => setOpen((o) => !o)}
          onDoubleClick={() => setRenaming(true)}
          aria-haspopup="menu"
          aria-expanded={open}
          className="flex flex-col gap-[3px] leading-none min-w-0 text-left"
          title="Double-click to rename"
        >
          <span className="text-[9.5px] uppercase tracking-[0.22em] text-[var(--ink-2)] whitespace-nowrap">
            Project <span className="text-[var(--ink-3)] tracking-normal">/</span>
          </span>
          <span
            className="text-[20px] italic leading-none text-[var(--ink-0)] truncate max-w-[220px]"
            style={{ fontFamily: "var(--serif)" }}
          >
            {currentName}
            <span className="ml-1.5 text-[11px] text-[var(--ink-3)] not-italic align-[1px]">
              ▾
            </span>
          </span>
        </button>
      )}

      {open && (
        <div
          role="menu"
          className="absolute top-[calc(var(--topbar-h)-6px)] left-0 w-[380px] bg-[var(--bg-1)] border border-[var(--rule-strong)] z-[200] shadow-[0_18px_48px_rgba(0,0,0,0.55)] flex flex-col"
        >
          <div className="p-2.5 border-b border-[var(--rule)]">
            <input
              autoFocus
              value={filter}
              onChange={(e) => setFilter(e.target.value)}
              placeholder="FIND PROJECT /"
              className="w-full bg-[var(--bg-0)] border border-[var(--rule)] text-[var(--ink-0)] placeholder:text-[var(--ink-3)] placeholder:tracking-[0.18em] text-[10px] tracking-[0.14em] uppercase px-2 py-1.5 outline-none focus:border-[var(--ink-2)]"
            />
          </div>
          <div className="p-1.5 max-h-[360px] overflow-y-auto">
            <div className="px-2 pt-1 pb-1 text-[9.5px] uppercase tracking-[0.22em] text-[var(--ink-3)]">
              Recent
            </div>
            {filtered.length === 0 && (
              <div className="px-2 py-2 text-[10px] text-[var(--ink-3)]">
                No projects match.
              </div>
            )}
            {filtered.map((p) => (
              <ProjectRow
                key={p._id}
                project={p}
                current={p._id === projectId}
                onSelect={() => {
                  setOpen(false);
                  if (p._id !== projectId) router.push(`/projects/${p._id}`);
                }}
              />
            ))}
          </div>
          <div className="border-t border-[var(--rule)] grid grid-cols-[1fr_auto] gap-1.5 p-1.5">
            <button
              onClick={handleCreate}
              className="px-2.5 py-2 bg-transparent border border-[var(--rule)] text-[var(--ink-0)] text-[10px] uppercase tracking-[0.18em] hover:bg-[var(--bg-2)] hover:border-[var(--ink-3)] inline-flex items-center gap-1.5 justify-center"
            >
              <Plus size={13} className="text-[var(--accent)]" />
              New Project
            </button>
            <button
              disabled
              className="px-2.5 py-2 bg-transparent border border-transparent text-[var(--ink-3)] text-[10px] uppercase tracking-[0.18em] cursor-not-allowed"
              title="Manage all — slice 5+"
            >
              Manage all…
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function ProjectRow({
  project,
  current,
  onSelect,
}: {
  project: Doc<"projects">;
  current: boolean;
  onSelect: () => void;
}) {
  // A fake cover swatch tinted from the project id — replaces the
  // handcrafted thumbnail gradients in the prototype until the real
  // cover-picker lands in slice 5+.
  const hue = hashHue(project._id);
  const cover = `linear-gradient(135deg, hsl(${hue} 26% 22%), hsl(${(hue + 30) % 360} 22% 10%))`;

  return (
    <button
      role="menuitem"
      onClick={onSelect}
      className="grid grid-cols-[44px_1fr_auto] gap-2.5 items-center w-full px-2 py-1.5 hover:bg-[var(--bg-2)] text-left"
    >
      <div
        className="w-[44px] h-[28px] border border-[var(--rule)]"
        style={{ background: cover }}
      />
      <div className="min-w-0">
        <div
          className="text-[15px] italic leading-[1.15] text-[var(--ink-0)] truncate"
          style={{ fontFamily: "var(--serif)" }}
        >
          {project.name}
        </div>
        <div className="text-[9.5px] uppercase tracking-[0.12em] text-[var(--ink-3)] mt-0.5 tabular-nums">
          edited {formatEditedAt(project.updatedAt)}
        </div>
      </div>
      <div className="w-[18px] text-center text-[11px]">
        {current ? (
          <Check size={12} className="text-[var(--accent)] inline" />
        ) : (
          <span className="opacity-0">·</span>
        )}
      </div>
    </button>
  );
}

function hashHue(id: string): number {
  let h = 0;
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) >>> 0;
  return h % 360;
}

function formatEditedAt(ts: number): string {
  const diff = Date.now() - ts;
  const d = Math.floor(diff / (1000 * 60 * 60 * 24));
  if (d === 0) {
    const date = new Date(ts);
    return `${String(date.getHours()).padStart(2, "0")}:${String(date.getMinutes()).padStart(2, "0")}`;
  }
  if (d === 1) return "yesterday";
  if (d < 7) return `${d} days ago`;
  if (d < 30) return `${Math.floor(d / 7)} weeks ago`;
  return `${Math.floor(d / 30)} months ago`;
}
