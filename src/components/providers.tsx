// SPDX-License-Identifier: AGPL-3.0-only
"use client";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useState } from "react";

export function Providers({ children }: { children: React.ReactNode }) {
  const [client] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            staleTime: 60_000,
            // Al volver a la app tras días, refetchea (y re-renderiza) para que
            // el gráfico/semana/cumplimiento avancen de día. Con los staleTime
            // por query (history 5min, exercises 1h) no dispara refetch masivo.
            refetchOnWindowFocus: true,
            retry: 1,
          },
        },
      }),
  );

  return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
}
