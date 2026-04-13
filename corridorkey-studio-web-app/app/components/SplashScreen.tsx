"use client";

import { useState, useEffect, useRef } from "react";

const SHOWCASE_IMAGES = [
  "/showcase/corridorkey-splash-screen-1.png",
  "/showcase/corridorkey-splash-screen-2.png",
  "/showcase/corridorkey-splash-screen-3.png",
  "/showcase/corridorkey-splash-screen-4.png",
  "/showcase/corridorkey-splash-screen-5.png",
  "/showcase/corridorkey-splash-screen-6.png",
  "/showcase/corridorkey-splash-screen-7.png",
  "/showcase/corridorkey-splash-screen-8.png",
];

export default function SplashScreen() {
  const [phase, setPhase] = useState<"in" | "visible" | "fading" | "gone">("in");
  // Pick a fixed index for SSR to avoid hydration mismatch, then randomize on client
  const [imageIndex, setImageIndex] = useState(0);
  const [imageError, setImageError] = useState(false);
  const hasRandomized = useRef(false);

  if (!hasRandomized.current && typeof window !== "undefined") {
    hasRandomized.current = true;
    const idx = Math.floor(Math.random() * SHOWCASE_IMAGES.length);
    if (idx !== 0) setImageIndex(idx);
  }

  useEffect(() => {
    const t1 = setTimeout(() => setPhase("visible"), 200);
    const t2 = setTimeout(() => setPhase("fading"), 3500);
    const t3 = setTimeout(() => setPhase("gone"), 4300);
    return () => {
      clearTimeout(t1);
      clearTimeout(t2);
      clearTimeout(t3);
    };
  }, []);

  if (phase === "gone") return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center">
      <div
        className={`bg-[var(--surface)] border border-[var(--border)] w-[780px] overflow-hidden transition-all duration-500 ${
          phase === "in"
            ? "opacity-0 scale-95"
            : phase === "fading"
            ? "opacity-0 scale-95"
            : "opacity-100 scale-100"
        }`}
      >
        {/* Image */}
        <div className="w-full h-80 bg-[#0a0a0a] relative overflow-hidden">
          {!imageError ? (
            <img
              key={imageIndex}
              src={SHOWCASE_IMAGES[imageIndex]}
              alt="CorridorKey showcase"
              className="w-full h-full object-cover transition-opacity duration-300"
              onError={() => setImageError(true)}
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center">
              <span className="text-[var(--text-muted)] text-[10px] tracking-wider">
                CORRIDORKEY STUDIO
              </span>
            </div>
          )}
          {/* Gradient overlay at bottom */}
          <div className="absolute inset-x-0 bottom-0 h-20 bg-gradient-to-t from-[var(--surface)] to-transparent" />
        </div>

        {/* Content */}
        <div className="px-6 pb-5 -mt-4 relative">
          <h1 className="text-xl font-bold tracking-[0.3em] uppercase text-white mb-2">
            CORRIDORKEY STUDIO
          </h1>
          <p className="text-[11px] text-[var(--text-muted)] leading-relaxed mb-4">
            AI-powered green screen keying for production VFX.
            Import footage, generate mattes, and export clean keys
            — locally on your GPU or on cloud GPUs for free.
          </p>

          {/* Loader bar */}
          <div className="flex items-center gap-3">
            <div className="flex-1 h-0.5 bg-[#222] overflow-hidden">
              <div
                className="h-full bg-[var(--accent)]"
                style={{
                  animation: "loadbar 2s ease-in-out infinite",
                }}
              />
            </div>
            <span className="text-[8px] text-[var(--text-muted)] tracking-wider uppercase shrink-0">
              Loading
            </span>
          </div>
        </div>

        <style jsx>{`
          @keyframes loadbar {
            0% { width: 0%; margin-left: 0%; }
            50% { width: 40%; margin-left: 30%; }
            100% { width: 0%; margin-left: 100%; }
          }
        `}</style>
      </div>
    </div>
  );
}
