// SPDX-License-Identifier: AGPL-3.0-only
"use client";

import {
  MutationCache,
  QueryClient,
  QueryClientProvider,
} from "@tanstack/react-query";
import { useState } from "react";
import { Toaster } from "@/components/Toaster";
import { toast } from "@/lib/toast";

export function Providers({ children }: { children: React.ReactNode }) {
  const [client] = useState(
    () =>
      new QueryClient({
        mutationCache: new MutationCache({
          onError: (_error, _vars, _ctx, mutation) => {
            if (mutation.meta?.silent) return;
            toast("No se pudo guardar. Revisá tu conexión y probá de nuevo.", {
              tone: "danger",
              id: "mutation-error",
            });
          },
        }),
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

  return (
    <QueryClientProvider client={client}>
      {children}
      <Toaster />
    </QueryClientProvider>
  );
}
