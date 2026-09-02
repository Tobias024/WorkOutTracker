// SPDX-License-Identifier: AGPL-3.0-only
"use client";

import { useEffect } from "react";
import { usePathname, useRouter } from "next/navigation";
import { useActiveSession, ACTIVE_SESSION_KEY } from "@/hooks/useWorkout";

/**
 * Candado de sesión: si hay un entrenamiento en curso (sesión sin finalizar),
 * fuerza al usuario a la pantalla de ese entrenamiento — no puede navegar a
 * ninguna otra parte hasta Finalizar o Descartar. No renderiza nada visible.
 */
export function ActiveSessionGuard() {
  const { data: activeId, isLoading, isError } = useActiveSession();
  const pathname = usePathname();
  const router = useRouter();

  useEffect(() => {
    // Si la query resolvió (no loading, no error), su resultado manda (null = sin
    // sesión). Si está cargando o FALLÓ (offline/token), caemos al id guardado
    // localmente → el candado bloquea igual sin red (antes se abría por error).
    let local: string | null = null;
    try {
      local = localStorage.getItem(ACTIVE_SESSION_KEY);
    } catch {
      local = null;
    }
    const resolved = !isLoading && !isError;
    const effective = resolved ? (activeId ?? null) : (activeId ?? local);
    if (!effective) return;
    const target = `/entrenar/${effective}`;
    if (pathname === target || pathname.startsWith("/onboarding")) return;
    router.replace(target);
  }, [activeId, isLoading, isError, pathname, router]);

  return null;
}
