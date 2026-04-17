import { Cloud } from "lucide-react";

export default function SignInScreen() {
  return (
    <div className="h-full w-full flex items-center justify-center bg-[var(--bg)]">
      <div className="w-[420px] bg-[var(--surface)] border border-[var(--border)]">
        <div className="px-6 py-5 border-b border-[var(--border)]">
          <div className="text-[9px] uppercase tracking-[0.2em] text-[var(--text-muted)] mb-1">
            CORRIDORKEY STUDIO
          </div>
          <div className="text-sm font-bold tracking-[0.15em] uppercase text-[var(--text-bright)]">
            SIGN IN TO CONTINUE
          </div>
        </div>

        <div className="px-6 py-5 flex flex-col gap-4 text-[11px] leading-relaxed text-[var(--text)]">
          <p className="text-[var(--text-muted)]">
            Keying runs on our cloud GPUs — free to use with generous limits.
            Sign in to import footage and generate mattes.
          </p>
          <a
            href="/sign-in"
            className="flex items-center justify-center gap-2 py-2.5 bg-[var(--accent)] text-[10px] uppercase tracking-[0.15em] font-bold text-white hover:bg-[var(--accent-dim)] transition-colors"
          >
            <Cloud size={12} />
            SIGN IN
          </a>
          <div className="border-t border-[var(--border)] pt-3 text-[10px] text-[var(--text-muted)]">
            Local GPU mode is coming back soon — run CorridorKey on your own
            hardware without an account.
          </div>
        </div>
      </div>
    </div>
  );
}
