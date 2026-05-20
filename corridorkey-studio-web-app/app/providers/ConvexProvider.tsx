"use client";

import { ConvexReactClient } from "convex/react";
import { ConvexProviderWithAuth } from "convex/react";
import { ReactNode, useMemo } from "react";
import { useWorkOSAuth } from "./useWorkOSAuth";

// During Next.js static prerender (e.g. /_not-found), NEXT_PUBLIC_CONVEX_URL
// may be undefined — and ConvexReactClient throws on a missing URL. The
// "use client" directive doesn't prevent this constructor from running at
// build time. Fall back to a placeholder so the build succeeds; the real
// URL is always present at runtime in the browser.
const CONVEX_URL =
  process.env.NEXT_PUBLIC_CONVEX_URL || "https://placeholder.convex.cloud";

export function ConvexClientProvider({ children }: { children: ReactNode }) {
  const convex = useMemo(() => new ConvexReactClient(CONVEX_URL), []);
  return (
    <ConvexProviderWithAuth client={convex} useAuth={useWorkOSAuth}>
      {children}
    </ConvexProviderWithAuth>
  );
}
