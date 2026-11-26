// SPDX-License-Identifier: AGPL-3.0-only
"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useQueryClient } from "@tanstack/react-query";
import { createClient, getUserId } from "@/lib/supabase/client";
import { toast } from "@/lib/toast";

/** Errores de accept_invite que no se arreglan reintentando. */
function isDefinitive(message: string): boolean {
  return /inválida|vencida|vos mismo/i.test(message);
}

/**
 * Consume una invitación pendiente tras autenticarse. El invite/[code] guarda el
 * code en localStorage cuando el usuario no está logueado; si la cadena de
 * redirects del registro se corta (confirmación cross-device, onboarding,
 * fallback al Site URL), este handler —montado en el layout autenticado— corre
 * `accept_invite` al llegar a cualquier pantalla y limpia el pendiente.
 * `accept_invite` es reintentar-seguro (on conflict do update). No renderiza nada.
 * Avisa con un toast tanto del éxito como de un error definitivo (que además
 * limpia el pendiente en vez de reintentar en silencio).
 */
export function PendingInviteHandler() {
  const qc = useQueryClient();
  const router = useRouter();
  useEffect(() => {
    let code: string | null = null;
    try {
      code = localStorage.getItem("wot-pending-invite");
    } catch {
      code = null;
    }
    if (!code) return;
    const pending = code;
    function clearPending() {
      try {
        localStorage.removeItem("wot-pending-invite");
      } catch {
        // no-op
      }
    }
    (async () => {
      const supabase = createClient();
      const uid = await getUserId();
      if (!uid) return; // aún no autenticado: se reintenta al próximo montaje

      // Nombre del invitador (migración 0037); si no existe o falla, sin nombre.
      let inviter: string | null = null;
      try {
        const res = await (
          supabase.rpc as unknown as (
            fn: string,
            args: Record<string, unknown>,
          ) => PromiseLike<{ data: unknown; error: unknown }>
        ).call(supabase, "preview_invite", { p_code: pending });
        if (!res.error && typeof res.data === "string") inviter = res.data;
      } catch {
        // sin nombre
      }

      const { error } = await supabase.rpc("accept_invite", { p_code: pending });
      if (error) {
        if (isDefinitive(error.message)) {
          clearPending();
          toast(error.message, { tone: "danger" });
        }
        return; // p.ej. offline: dejamos el pendiente para reintentar
      }
      clearPending();
      toast(
        inviter
          ? `Ya sos amigo de ${inviter} 🎉`
          : "Se aceptó tu invitación 🎉",
        {
          tone: "success",
          action: { label: "Ver ranking", onClick: () => router.push("/scoreboard") },
        },
      );
      qc.invalidateQueries({ queryKey: ["friends"] });
      qc.invalidateQueries({ queryKey: ["scoreboard"] });
    })();
  }, [qc, router]);
  return null;
}
