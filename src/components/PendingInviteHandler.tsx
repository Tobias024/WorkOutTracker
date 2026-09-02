// SPDX-License-Identifier: AGPL-3.0-only
"use client";

import { useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { createClient } from "@/lib/supabase/client";

/**
 * Consume una invitación pendiente tras autenticarse. El invite/[code] guarda el
 * code en localStorage cuando el usuario no está logueado; si la cadena de
 * redirects del registro se corta (confirmación cross-device, onboarding,
 * fallback al Site URL), este handler —montado en el layout autenticado— corre
 * `accept_invite` al llegar a cualquier pantalla y limpia el pendiente.
 * `accept_invite` es reintentar-seguro (on conflict do update). No renderiza nada.
 */
export function PendingInviteHandler() {
  const qc = useQueryClient();
  useEffect(() => {
    let code: string | null = null;
    try {
      code = localStorage.getItem("wot-pending-invite");
    } catch {
      code = null;
    }
    if (!code) return;
    (async () => {
      const supabase = createClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) return; // aún no autenticado: se reintenta al próximo montaje
      const { error } = await supabase.rpc("accept_invite", { p_code: code });
      if (error) return; // p.ej. offline: dejamos el pendiente para reintentar
      try {
        localStorage.removeItem("wot-pending-invite");
      } catch {
        // no-op
      }
      qc.invalidateQueries({ queryKey: ["friends"] });
      qc.invalidateQueries({ queryKey: ["scoreboard"] });
    })();
  }, [qc]);
  return null;
}
