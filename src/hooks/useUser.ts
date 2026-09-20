// SPDX-License-Identifier: AGPL-3.0-only
"use client";

import { useQuery } from "@tanstack/react-query";
import { createClient } from "@/lib/supabase/client";

/**
 * Id del usuario logueado.
 *
 * Hace falta para decidir si algo es EDITABLE antes de ofrecer el botón: la RLS
 * ya protege la escritura, pero un update que la política rechaza no devuelve
 * error — actualiza cero filas y listo. Mostrar un lápiz que no hace nada es
 * peor que no mostrarlo.
 */
export function useCurrentUserId() {
  return useQuery({
    queryKey: ["current-user-id"],
    staleTime: Infinity,
    queryFn: async (): Promise<string | null> => {
      const supabase = createClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();
      return user?.id ?? null;
    },
  });
}
