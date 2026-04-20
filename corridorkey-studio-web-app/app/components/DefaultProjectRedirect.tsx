"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useMutation } from "convex/react";
import { api } from "../../convex/_generated/api";

interface Props {
  workosUser: {
    email: string;
    name?: string;
    profileImageUrl?: string;
  };
}

/**
 * Client bootstrap for the root route. After the WorkOS session is
 * confirmed server-side, this component:
 *   1. Upserts the Convex users row (mirrors the identity).
 *   2. Resolves the user's default project (creates "Untitled" if none).
 *   3. Replaces the URL with `/projects/<id>` so the studio shell takes
 *      over on the next render.
 *
 * Shown as a minimal loading surface for the half-second while the
 * round-trips complete.
 */
export default function DefaultProjectRedirect({ workosUser }: Props) {
  const router = useRouter();
  const getOrCreateUser = useMutation(api.users.getOrCreate);
  const getOrCreateDefault = useMutation(api.projects.getOrCreateDefault);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    (async () => {
      try {
        await getOrCreateUser({
          email: workosUser.email,
          name: workosUser.name,
          profileImageUrl: workosUser.profileImageUrl,
        });
        const projectId = await getOrCreateDefault({});
        if (!cancelled) router.replace(`/projects/${projectId}`);
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : String(err));
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [
    getOrCreateUser,
    getOrCreateDefault,
    router,
    workosUser.email,
    workosUser.name,
    workosUser.profileImageUrl,
  ]);

  if (error) {
    return (
      <div className="h-full grid place-items-center bg-[var(--bg-0)]">
        <div className="text-[var(--err)] text-xs max-w-md text-center px-6">
          {error}
        </div>
      </div>
    );
  }

  return (
    <div className="h-full grid place-items-center bg-[var(--bg-0)]">
      <div className="text-[var(--ink-2)] text-[10px] uppercase tracking-[0.22em]">
        Opening project…
      </div>
    </div>
  );
}
