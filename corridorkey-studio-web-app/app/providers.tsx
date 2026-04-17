"use client";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useState } from "react";
import { ConvexClientProvider } from "./providers/ConvexProvider";

export default function Providers({ children }: { children: React.ReactNode }) {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            staleTime: 5000,
            retry: false,
          },
        },
      })
  );

  return (
    <ConvexClientProvider>
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    </ConvexClientProvider>
  );
}
