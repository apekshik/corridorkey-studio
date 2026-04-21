"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useMutation, useQuery } from "convex/react";
import { Plus, Trash2, X } from "lucide-react";
import UserMenu from "./UserMenu";
import { api } from "../../convex/_generated/api";
import { Doc } from "../../convex/_generated/dataModel";

interface Props {
  workosUser: {
    email: string;
    name?: string;
    profileImageUrl?: string;
  };
  /**
   * When provided, the pane behaves as a dismissable modal — ESC and
   * clicking the backdrop call it. When omitted (first-run / root route
   * with no projects), the pane is the only surface and cannot be
   * closed until the user picks or creates a project.
   */
  onClose?: () => void;
}

const SHOWCASE = Array.from(
  { length: 8 },
  (_, i) => `/showcase/corridorkey-splash-screen-${i + 1}.png`
);
const CAROUSEL_INTERVAL_MS = 5000;

/**
 * Floating project picker. Renders a centered modal card above whatever
 * is behind it (studio chrome when opened from the TopBar, a dim idle
 * background when rendered at `/`). Mirrors the old dropdown's role as
 * the canonical project-management surface without the dropdown's size
 * limitations.
 */
export default function ProjectsPane({ workosUser, onClose }: Props) {
  const router = useRouter();
  const syncUser = useMutation(api.users.getOrCreate);
  const createProject = useMutation(api.projects.create);
  const removeProject = useMutation(api.projects.remove);
  const projects = useQuery(api.projects.list);

  const [creating, setCreating] = useState(false);
  const [newName, setNewName] = useState("");
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);
  const cardRef = useRef<HTMLDivElement>(null);

  // Mirror WorkOS identity into Convex on first mount.
  useEffect(() => {
    syncUser({
      email: workosUser.email,
      name: workosUser.name,
      profileImageUrl: workosUser.profileImageUrl,
    }).catch((err) => console.error("[user sync] failed:", err));
  }, [syncUser, workosUser.email, workosUser.name, workosUser.profileImageUrl]);

  // ESC dismiss (modal mode only).
  useEffect(() => {
    if (!onClose) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const submitNew = async () => {
    const name = newName.trim();
    if (!name) return;
    try {
      const id = await createProject({ name });
      router.push(`/projects/${id}`);
    } catch (err) {
      console.error("[create project] failed:", err);
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await removeProject({ projectId: id as Doc<"projects">["_id"] });
    } catch (err) {
      console.error("[delete project] failed:", err);
    } finally {
      setConfirmDelete(null);
    }
  };

  const backdropClick = (e: React.MouseEvent) => {
    if (!onClose) return;
    if (cardRef.current && cardRef.current.contains(e.target as Node)) return;
    onClose();
  };

  return (
    <div
      onMouseDown={backdropClick}
      className="fixed inset-0 z-[100] flex items-center justify-center"
      style={{
        background: "rgba(5,5,7,0.72)",
        backdropFilter: "blur(4px)",
        WebkitBackdropFilter: "blur(4px)",
        fontFamily: "var(--mono)",
      }}
    >
      <div
        ref={cardRef}
        className="relative flex flex-col border border-[var(--rule-strong)] bg-[var(--bg-1)] shadow-[0_40px_80px_rgba(0,0,0,0.6)] overflow-hidden"
        style={{
          width: "min(960px, 92vw)",
          maxHeight: "min(720px, 88vh)",
        }}
      >
        <Header workosUser={workosUser} onClose={onClose} />
        <div className="flex-1 min-h-0 overflow-y-auto">
          <Carousel />
          <section style={{ padding: "22px var(--pad) 32px" }}>
            <div className="flex items-baseline justify-between mb-4">
              <h2
                className="text-[26px] italic text-[var(--ink-0)]"
                style={{ fontFamily: "var(--serif)" }}
              >
                Projects
              </h2>
              <span className="text-[10px] uppercase tracking-[0.22em] text-[var(--ink-3)]">
                {projects === undefined
                  ? "loading…"
                  : projects.length === 0
                  ? "none yet"
                  : `${String(projects.length).padStart(2, "0")} total`}
              </span>
            </div>

            <div className="grid gap-3 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3">
              <NewProjectCard
                active={creating}
                name={newName}
                onNameChange={setNewName}
                onStart={() => {
                  setCreating(true);
                  setNewName("");
                }}
                onCancel={() => {
                  setCreating(false);
                  setNewName("");
                }}
                onSubmit={submitNew}
              />
              {projects?.map((p) => (
                <ProjectCard
                  key={p._id}
                  project={p}
                  onOpen={() => router.push(`/projects/${p._id}`)}
                  confirming={confirmDelete === p._id}
                  onRequestDelete={() => setConfirmDelete(p._id)}
                  onCancelDelete={() => setConfirmDelete(null)}
                  onConfirmDelete={() => handleDelete(p._id)}
                />
              ))}
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}

/* ----------------------------- header ----------------------------------- */

function Header({
  workosUser,
  onClose,
}: {
  workosUser: Props["workosUser"];
  onClose?: () => void;
}) {
  return (
    <header
      className="flex items-center justify-between border-b border-[var(--rule-strong)] bg-[var(--bg-1)] shrink-0"
      style={{
        height: "var(--topbar-h)",
        padding: "0 var(--pad)",
      }}
    >
      <div className="flex items-center gap-3 min-w-0">
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
      <div className="flex items-center gap-3 text-[11px] text-[var(--ink-2)]">
        <span className="hidden sm:inline">{workosUser.email}</span>
        <UserMenu />
        {onClose && (
          <button
            onClick={onClose}
            className="w-9 h-9 grid place-items-center border border-[var(--rule)] text-[var(--ink-1)] hover:text-[var(--err)] hover:border-[var(--err)]"
            aria-label="Close"
            title="Close (Esc)"
          >
            <X size={14} />
          </button>
        )}
      </div>
    </header>
  );
}

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

/* ----------------------------- carousel --------------------------------- */

function Carousel() {
  const [index, setIndex] = useState(0);

  useEffect(() => {
    setIndex(Math.floor(Math.random() * SHOWCASE.length));
  }, []);

  useEffect(() => {
    const id = setInterval(
      () => setIndex((i) => (i + 1) % SHOWCASE.length),
      CAROUSEL_INTERVAL_MS
    );
    return () => clearInterval(id);
  }, []);

  return (
    <div className="relative w-full bg-[var(--bg-0)] border-b border-[var(--rule-strong)] overflow-hidden">
      <div className="relative w-full" style={{ aspectRatio: "16 / 6" }}>
        {SHOWCASE.map((src, i) => (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            key={src}
            src={src}
            alt=""
            loading={i === index ? "eager" : "lazy"}
            className="absolute inset-0 w-full h-full object-cover transition-opacity duration-700"
            style={{ opacity: i === index ? 1 : 0 }}
          />
        ))}
        <div
          aria-hidden
          className="absolute inset-x-0 bottom-0 h-12"
          style={{
            background:
              "linear-gradient(to bottom, transparent, var(--bg-1) 100%)",
          }}
        />
        <div className="absolute left-[var(--pad)] bottom-3 flex items-center gap-1.5">
          {SHOWCASE.map((_, i) => (
            <span
              key={i}
              className="h-[3px]"
              style={{
                width: i === index ? 22 : 8,
                background:
                  i === index ? "var(--accent)" : "rgba(242,239,232,0.25)",
                transition: "width 0.4s, background 0.4s",
              }}
            />
          ))}
        </div>
      </div>
    </div>
  );
}

/* ----------------------------- cards ------------------------------------ */

function NewProjectCard({
  active,
  name,
  onNameChange,
  onStart,
  onCancel,
  onSubmit,
}: {
  active: boolean;
  name: string;
  onNameChange: (n: string) => void;
  onStart: () => void;
  onCancel: () => void;
  onSubmit: () => void;
}) {
  if (!active) {
    return (
      <button
        onClick={onStart}
        className="border border-dashed border-[var(--rule-strong)] hover:border-[var(--accent)] hover:bg-[var(--bg-2)] transition-colors text-left min-h-[150px] p-4 flex flex-col justify-between group"
      >
        <div className="flex items-center gap-2 text-[var(--accent)]">
          <Plus size={16} />
          <span className="text-[10.5px] uppercase tracking-[0.22em]">
            New Project
          </span>
        </div>
        <div
          className="text-[15px] italic text-[var(--ink-3)] group-hover:text-[var(--ink-1)]"
          style={{ fontFamily: "var(--serif)" }}
        >
          Name it to begin.
        </div>
      </button>
    );
  }
  return (
    <div className="border border-[var(--accent)] bg-[var(--bg-2)] min-h-[150px] p-4 flex flex-col justify-between">
      <div className="flex items-center gap-2 text-[var(--accent)]">
        <Plus size={16} />
        <span className="text-[10.5px] uppercase tracking-[0.22em]">
          New Project
        </span>
      </div>
      <div className="grid gap-3">
        <input
          autoFocus
          value={name}
          onChange={(e) => onNameChange(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") onSubmit();
            if (e.key === "Escape") onCancel();
          }}
          placeholder="Project name"
          className="bg-transparent border-b border-[var(--ink-3)] outline-none text-[20px] italic text-[var(--ink-0)] pb-1 placeholder:text-[var(--ink-3)]"
          style={{ fontFamily: "var(--serif)" }}
        />
        <div className="flex gap-2">
          <button
            onClick={onSubmit}
            disabled={!name.trim()}
            className="px-3 py-1.5 text-[10.5px] uppercase tracking-[0.2em] font-semibold disabled:opacity-40 disabled:cursor-not-allowed"
            style={{
              background: "var(--accent)",
              color: "var(--accent-ink)",
            }}
          >
            Create ↵
          </button>
          <button
            onClick={onCancel}
            className="px-3 py-1.5 text-[10.5px] uppercase tracking-[0.2em] border border-[var(--rule)] text-[var(--ink-2)] hover:text-[var(--ink-0)]"
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}

function ProjectCard({
  project,
  onOpen,
  confirming,
  onRequestDelete,
  onCancelDelete,
  onConfirmDelete,
}: {
  project: Doc<"projects">;
  onOpen: () => void;
  confirming: boolean;
  onRequestDelete: () => void;
  onCancelDelete: () => void;
  onConfirmDelete: () => void;
}) {
  const hue = hashHue(project._id);
  const cover = `linear-gradient(135deg, hsl(${hue} 26% 22%), hsl(${(hue + 30) % 360} 22% 10%))`;

  return (
    <div className="border border-[var(--rule)] bg-[var(--bg-1)] hover:bg-[var(--bg-2)] transition-colors min-h-[150px] flex flex-col relative group">
      <button
        onClick={onOpen}
        className="flex-1 text-left flex flex-col"
        disabled={confirming}
      >
        <div
          className="h-[64px] border-b border-[var(--rule)]"
          style={{ background: cover }}
        />
        <div className="p-4 flex flex-col gap-1.5 flex-1">
          <div
            className="text-[18px] italic leading-[1.2] text-[var(--ink-0)] break-words"
            style={{ fontFamily: "var(--serif)" }}
          >
            {project.name}
          </div>
          <div className="text-[10px] uppercase tracking-[0.12em] text-[var(--ink-3)] tabular-nums">
            edited {formatEditedAt(project.updatedAt)}
          </div>
        </div>
      </button>

      {!confirming && (
        <button
          onClick={onRequestDelete}
          className="absolute top-2 right-2 p-1.5 text-[var(--ink-3)] hover:text-[var(--err)] opacity-0 group-hover:opacity-100 transition-opacity"
          title="Delete project"
          aria-label="Delete project"
        >
          <Trash2 size={14} />
        </button>
      )}

      {confirming && (
        <div className="absolute inset-0 bg-[rgba(11,12,14,0.92)] border border-[var(--err)] flex flex-col justify-center items-center gap-3 p-4 text-center">
          <span
            className="text-[14px] italic text-[var(--ink-0)]"
            style={{ fontFamily: "var(--serif)" }}
          >
            Delete “{project.name}”?
          </span>
          <span className="text-[10px] text-[var(--ink-2)] tracking-[0.08em]">
            Clips and frames will be removed. Can&apos;t be undone.
          </span>
          <div className="flex gap-2">
            <button
              onClick={onConfirmDelete}
              className="px-3 py-1.5 text-[10px] uppercase tracking-[0.18em] font-semibold"
              style={{ background: "var(--err)", color: "var(--bg-0)" }}
            >
              Delete
            </button>
            <button
              onClick={onCancelDelete}
              className="px-3 py-1.5 text-[10px] uppercase tracking-[0.18em] border border-[var(--rule)] text-[var(--ink-2)] hover:text-[var(--ink-0)]"
            >
              Cancel
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

/* ------------------------------ helpers --------------------------------- */

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
