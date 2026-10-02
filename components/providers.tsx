"use client";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import * as React from "react";
import { RealtimeProvider } from "@/components/realtime/realtime-provider";
import { Toaster } from "@/components/ui/toaster";

export function Providers({ children, clerk = false }: { children: React.ReactNode; clerk?: boolean }) {
  const [client] = React.useState(() => new QueryClient({ defaultOptions: { queries: { staleTime: 30_000, refetchOnWindowFocus: false, retry: 1 } } }));
  return (
    <QueryClientProvider client={client}>
      <RealtimeProvider clerk={clerk}>{children}</RealtimeProvider>
      <Toaster />
    </QueryClientProvider>
  );
}
