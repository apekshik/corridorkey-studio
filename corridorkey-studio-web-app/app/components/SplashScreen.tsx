"use client";

import { useState, useEffect } from "react";

// Replace these with real Corridor Crew / Niko frame URLs
const SHOWCASE_IMAGES = [
  { label: "BEFORE", sublabel: "Raw green screen footage" },
  { label: "ALPHA HINT", sublabel: "AI-generated foreground mask" },
  { label: "MATTE", sublabel: "Production-quality key" },
  { label: "FINAL COMP", sublabel: "Clean composite output" },
];

export default function SplashScreen() {
  const [phase, setPhase] = useState<"loading" | "visible" | "fading" | "gone">("loading");

  useEffect(() => {
    // Show splash briefly, then fade out
    const t1 = setTimeout(() => setPhase("visible"), 300);
    const t2 = setTimeout(() => setPhase("fading"), 3000);
    const t3 = setTimeout(() => setPhase("gone"), 3800);
    return () => {
      clearTimeout(t1);
      clearTimeout(t2);
      clearTimeout(t3);
    };
  }, []);

  if (phase === "gone") return null;

  return (
    <div
      className={`fixed inset-0 z-[100] bg-[#050505] flex flex-col items-center justify-center transition-opacity duration-700 ${
        phase === "fading" ? "opacity-0" : "opacity-100"
      }`}
    >
      {/* Brand */}
      <div
        className={`flex flex-col items-center transition-all duration-500 ${
          phase === "loading" ? "opacity-0 translate-y-4" : "opacity-100 translate-y-0"
        }`}
      >
        <h1 className="text-2xl font-bold tracking-[0.3em] uppercase text-[var(--text-bright)] mb-2">
          CORRIDORKEY STUDIO
        </h1>
        <p className="text-[11px] text-[var(--text-muted)] tracking-wider mb-10 max-w-md text-center leading-relaxed">
          AI-powered green screen keying for production VFX.
          <br />
          Import footage, generate mattes, export clean keys.
        </p>
      </div>

      {/* Showcase frames */}
      <div
        className={`flex gap-3 mb-12 transition-all duration-700 delay-200 ${
          phase === "loading" ? "opacity-0 translate-y-6" : "opacity-100 translate-y-0"
        }`}
      >
        {SHOWCASE_IMAGES.map((img, i) => (
          <div key={i} className="flex flex-col items-center gap-2">
            <div className="w-40 h-24 bg-[#111] border border-[var(--border)] flex items-center justify-center overflow-hidden">
              {/* Replace with <img> when real frames are available */}
              <div className="text-[9px] text-[var(--text-muted)] text-center px-2">
                {img.label}
              </div>
            </div>
            <div className="text-center">
              <div className="text-[8px] uppercase tracking-[0.15em] font-bold text-[var(--text)]">
                {img.label}
              </div>
              <div className="text-[8px] text-[var(--text-muted)]">
                {img.sublabel}
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Loader */}
      <div
        className={`flex flex-col items-center gap-3 transition-all duration-500 delay-300 ${
          phase === "loading" ? "opacity-0" : "opacity-100"
        }`}
      >
        <div className="flex gap-1">
          {[0, 1, 2, 3, 4].map((i) => (
            <div
              key={i}
              className="w-6 h-0.5 bg-[var(--accent)]"
              style={{
                animation: `pulse 1.2s ease-in-out ${i * 0.15}s infinite`,
                opacity: 0.3,
              }}
            />
          ))}
        </div>
        <span className="text-[9px] text-[var(--text-muted)] tracking-wider uppercase">
          Loading workspace
        </span>
      </div>

      <style jsx>{`
        @keyframes pulse {
          0%, 100% { opacity: 0.2; }
          50% { opacity: 1; }
        }
      `}</style>
    </div>
  );
}
