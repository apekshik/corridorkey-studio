"use client";

/**
 * Bottom status bar. Matches DESIGN_MOCK.html §2206–2223 layout (left-
 * aligned system stats, push-right keyboard strip + backend chip).
 *
 * Slice 3 stubs the data-heavy cells:
 *   - Cloud = "CLOUD" (no region / GPU — slice 5+)
 *   - Queue = 00 RUN · 00 WAIT (slice 4 wires real jobs)
 *   - Stream = "IDLE" until keying ships
 *   - Session cost = $0.00 · 0.0 GPU-min (slice 5)
 *   - Surge = OFF · SPOT (placeholder)
 * The runtime Tweaks panel from the prototype has been dropped; the
 * TWEAKS button is not shipped.
 */
export default function StatusBar() {
  return (
    <footer
      className="flex items-stretch border-t border-[var(--rule-strong)] bg-[var(--bg-1)] text-[10px] tracking-[0.04em] text-[var(--ink-2)] overflow-hidden min-w-0"
      style={{ height: "var(--statusbar-h)" }}
    >
      <Stat>
        <Dot />
        <K>Cloud</K>
        <V>CLOUD</V>
      </Stat>
      <Stat>
        <K>Queue</K>
        <V>00 RUN · 00 WAIT</V>
      </Stat>
      <Stat>
        <K>Stream</K>
        <V>IDLE</V>
      </Stat>
      <Stat>
        <K>Session</K>
        <V>$0.00</V>
        <span className="text-[var(--ink-2)]">· 0.0 GPU-min</span>
      </Stat>
      <Stat>
        <K>Surge</K>
        <Chip>OFF · SPOT</Chip>
      </Stat>

      <Stat className="ml-auto hidden xl:flex">
        <K>Keys</K>
        <Chip>1–5</Chip>
        <Chip>F</Chip>
        <Chip>S</Chip>
        <Chip>⌘S</Chip>
      </Stat>
      <Stat>
        <K>Backend</K>
        <Chip active>CLOUD</Chip>
      </Stat>
    </footer>
  );
}

/* ----------------------------- primitives ------------------------------- */

function Stat({
  children,
  className = "",
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={`flex items-center gap-[7px] px-2.5 border-r border-[var(--rule)] whitespace-nowrap shrink-0 last:border-r-0 ${className}`}
    >
      {children}
    </div>
  );
}

function K({ children }: { children: React.ReactNode }) {
  return (
    <span className="text-[var(--ink-3)] tracking-[0.2em] uppercase text-[9.5px]">
      {children}
    </span>
  );
}

function V({ children }: { children: React.ReactNode }) {
  return (
    <span className="text-[var(--ink-0)] tabular-nums">{children}</span>
  );
}

function Dot() {
  return (
    <span
      className="w-[6px] h-[6px] rounded-full"
      style={{ background: "var(--ok)" }}
    />
  );
}

function Chip({
  children,
  active,
}: {
  children: React.ReactNode;
  active?: boolean;
}) {
  return (
    <span
      className="border px-[5px] py-[2px] uppercase tracking-[0.14em] text-[9px]"
      style={{
        color: active ? "var(--accent)" : "var(--ink-1)",
        borderColor: active ? "var(--accent)" : "var(--rule)",
      }}
    >
      {children}
    </span>
  );
}
