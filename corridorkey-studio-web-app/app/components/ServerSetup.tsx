"use client";

import { useState } from "react";
import { Copy, Check, Terminal, X, RefreshCw } from "lucide-react";
import { useSettingsStore, type ConnectionStatus } from "../stores/useSettingsStore";

export default function ServerSetup({ onClose }: { onClose: () => void }) {
  const connectionStatus = useSettingsStore((s) => s.connectionStatus);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70"
      onClick={onClose}
    >
      <div
        className="w-[520px] bg-[var(--surface)] border border-[var(--border)] flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-[var(--border)] shrink-0">
          <span className="text-sm font-bold tracking-[0.15em] uppercase text-[var(--text-bright)]">
            LOCAL SERVER SETUP
          </span>
          <button
            onClick={onClose}
            className="text-[var(--text-muted)] hover:text-[var(--text)] cursor-pointer transition-colors"
          >
            <X size={16} />
          </button>
        </div>

        {/* Status */}
        <div className="px-6 py-4 border-b border-[var(--border)]">
          <StatusIndicator status={connectionStatus} />
        </div>

        {/* Steps */}
        <div className="px-6 py-5 flex flex-col gap-5 text-[11px] leading-relaxed text-[var(--text)]">
          {connectionStatus === "connected" ? (
            <div className="text-center py-4">
              <div className="text-[var(--success)] text-sm font-bold mb-2">SERVER CONNECTED</div>
              <div className="text-[var(--text-muted)]">
                You&apos;re all set. Close this dialog and start keying.
              </div>
            </div>
          ) : (
            <>
              <Step number={1} title="INSTALL">
                <p className="text-[var(--text-muted)] mb-2">
                  Requires Python 3.10+ and git:
                </p>
                <div className="flex flex-col gap-1.5">
                  <CommandBlock command="pip install corridorkey-studio" />
                </div>
              </Step>

              <Step number={2} title="START THE SERVER">
                <p className="text-[var(--text-muted)] mb-2">
                  This starts the local server. On first run it automatically
                  downloads the CorridorKey models (~400MB):
                </p>
                <CommandBlock command="corridorkey-studio serve" />
              </Step>

              <Step number={3} title="CONNECT">
                <p className="text-[var(--text-muted)]">
                  Once the server is running, this page will automatically detect it.
                  The status indicator above will turn green when connected.
                </p>
              </Step>

              <div className="border-t border-[var(--border)] pt-4 mt-1">
                <div className="text-[9px] uppercase tracking-[0.15em] text-[var(--text-muted)] font-bold mb-2">
                  SUPPORTED HARDWARE
                </div>
                <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-[10px] text-[var(--text-muted)]">
                  <span>NVIDIA GPU (CUDA)</span>
                  <span>Apple Silicon (MPS)</span>
                  <span>8GB+ VRAM / unified memory</span>
                  <span>Python 3.10+ &amp; git</span>
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

function StatusIndicator({ status }: { status: ConnectionStatus }) {
  const color =
    status === "connected"
      ? "var(--success)"
      : status === "connecting"
      ? "var(--warning)"
      : "var(--error)";

  const label =
    status === "connected"
      ? "CONNECTED"
      : status === "connecting"
      ? "CHECKING..."
      : "NOT DETECTED";

  return (
    <div className="flex items-center gap-3">
      <div className="flex items-center gap-2">
        <div className="w-2 h-2" style={{ background: color }} />
        <span className="text-[10px] uppercase tracking-wider font-bold" style={{ color }}>
          {label}
        </span>
      </div>
      <span className="text-[10px] text-[var(--text-muted)]">
        localhost:8000
      </span>
      {status === "connecting" && (
        <RefreshCw size={10} className="text-[var(--text-muted)] animate-spin" />
      )}
    </div>
  );
}

function Step({
  number,
  title,
  children,
}: {
  number: number;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <div className="flex items-baseline gap-2 mb-2">
        <span className="text-[var(--accent)] text-[10px] font-bold">{number}.</span>
        <span className="text-[10px] uppercase tracking-[0.15em] text-[var(--text-bright)] font-bold">
          {title}
        </span>
      </div>
      {children}
    </div>
  );
}

function CommandBlock({ command }: { command: string }) {
  const [copied, setCopied] = useState(false);

  const copy = () => {
    navigator.clipboard.writeText(command);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="flex items-center bg-[var(--bg)] border border-[var(--border)] group">
      <div className="px-2 py-2 border-r border-[var(--border)]">
        <Terminal size={12} className="text-[var(--text-muted)]" />
      </div>
      <code className="flex-1 px-3 py-2 text-[11px] text-[var(--text-bright)] select-all">
        {command}
      </code>
      <button
        onClick={copy}
        className="px-3 py-2 text-[var(--text-muted)] hover:text-[var(--text)] cursor-pointer transition-colors border-l border-[var(--border)]"
      >
        {copied ? <Check size={12} className="text-[var(--success)]" /> : <Copy size={12} />}
      </button>
    </div>
  );
}
