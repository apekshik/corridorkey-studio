"use client";

import { useCallback, useEffect, useState } from "react";

/**
 * Adapter that exposes the WorkOS AuthKit session in the shape
 * `ConvexProviderWithAuth` expects.
 *
 * Convex calls `fetchAccessToken({ forceRefreshToken })` whenever it needs
 * to authenticate a request. The token lives in an HTTP-only cookie, so we
 * route through `/api/auth/token` which reads it server-side via
 * `withAuth()` and returns the bare JWT.
 */
export function useWorkOSAuth() {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/auth/token")
      .then((r) => (r.ok ? r.json() : { token: null }))
      .then((d) => {
        if (cancelled) return;
        setIsAuthenticated(!!d.token);
        setIsLoading(false);
      })
      .catch(() => {
        if (cancelled) return;
        setIsAuthenticated(false);
        setIsLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const fetchAccessToken = useCallback(
    async ({ forceRefreshToken }: { forceRefreshToken: boolean }) => {
      const res = await fetch("/api/auth/token", {
        cache: forceRefreshToken ? "no-store" : "default",
      });
      if (!res.ok) return null;
      const { token } = await res.json();
      return token ?? null;
    },
    []
  );

  return { isLoading, isAuthenticated, fetchAccessToken };
}
