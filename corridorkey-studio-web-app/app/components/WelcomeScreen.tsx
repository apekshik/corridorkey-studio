"use client";

import { Upload } from "lucide-react";

export default function WelcomeScreen() {
  return (
    <div className="absolute inset-0 z-50 bg-[var(--bg)] flex items-center justify-center">
      <div className="flex flex-col items-center gap-8">
        <h1 className="text-xl font-bold tracking-[0.3em] uppercase text-[var(--text-bright)]">
          CORRIDORKEY STUDIO
        </h1>
        <div className="w-96 h-56 border-2 border-dashed border-[var(--border)] flex flex-col items-center justify-center gap-4 cursor-pointer hover:border-[var(--text-muted)] transition-colors">
          <Upload size={32} className="text-[var(--text-muted)]" />
          <span className="text-xs uppercase tracking-[0.2em] text-[var(--text-muted)]">
            DROP VIDEO FILES
          </span>
          <span className="text-[10px] text-[var(--text-muted)] opacity-50">
            .mov .mp4 .avi .mxf — or image sequences
          </span>
        </div>
        <div className="text-[10px] text-[var(--text-muted)]">
          <span className="uppercase tracking-wider">Recent</span>
          <div className="mt-2 flex flex-col gap-1">
            <span className="hover:text-[var(--text)] cursor-pointer transition-colors">
              ~/Projects/Woman_Jumps_Fx_pro_uhd
            </span>
            <span className="hover:text-[var(--text)] cursor-pointer transition-colors">
              ~/Projects/Car_Chase_GS_4k
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
