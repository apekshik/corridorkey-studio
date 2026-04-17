"use client";

import { useEffect, useRef, useState } from "react";
import { LogOut } from "lucide-react";
import { useQuery } from "convex/react";
import { api } from "../../convex/_generated/api";

/**
 * Top-bar avatar + dropdown. Shows the profile picture (or initials fallback)
 * and on click reveals a menu with the user's email and a sign-out button.
 */
export default function UserMenu() {
  const user = useQuery(api.users.current);
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    window.addEventListener("mousedown", onClick);
    return () => window.removeEventListener("mousedown", onClick);
  }, [open]);

  const handleSignOut = async () => {
    await fetch("/api/auth/sign-out");
    window.location.href = "/";
  };

  // Loading (Convex query hasn't returned yet) or row not synced yet.
  if (user === undefined || user === null) {
    return (
      <div
        className="shrink-0 border border-[var(--border)] bg-[var(--surface-2)] animate-pulse"
        style={{ width: 22, height: 22 }}
      />
    );
  }

  const initials = initialsFor(user.name, user.email);

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen(!open)}
        className="shrink-0 flex items-center justify-center border border-[var(--border)] bg-[var(--surface-2)] overflow-hidden cursor-pointer hover:border-[var(--text-muted)] transition-colors"
        style={{ width: 22, height: 22 }}
        title={user.name || user.email}
      >
        {user.profileImageUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={user.profileImageUrl}
            alt={user.name || user.email}
            className="block w-full h-full object-cover"
          />
        ) : (
          <span className="text-[9px] font-bold tracking-wider text-[var(--text)]">
            {initials}
          </span>
        )}
      </button>
      {open && (
        <div className="absolute right-0 top-full mt-1 w-56 bg-[var(--surface)] border border-[var(--border)] z-[200]">
          <div className="px-3 py-2 border-b border-[var(--border)]">
            {user.name && (
              <div className="text-[10px] text-[var(--text-bright)] font-bold truncate">
                {user.name}
              </div>
            )}
            <div className="text-[9px] text-[var(--text-muted)] truncate">
              {user.email}
            </div>
          </div>
          <button
            onClick={handleSignOut}
            className="w-full text-left px-3 py-2 cursor-pointer transition-colors hover:bg-[var(--surface-2)] flex items-center gap-2"
          >
            <LogOut size={11} className="text-[var(--text-muted)]" />
            <span className="text-[10px] uppercase tracking-wider text-[var(--text)]">
              Sign out
            </span>
          </button>
        </div>
      )}
    </div>
  );
}

function initialsFor(name: string | undefined, email: string): string {
  if (name) {
    const parts = name.trim().split(/\s+/);
    if (parts.length === 1) return parts[0][0].toUpperCase();
    return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
  }
  return email[0]?.toUpperCase() ?? "?";
}
