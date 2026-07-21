"use client";

import { useEffect } from "react";
import { usePathname, useRouter } from "next/navigation";
import { useActiveSession } from "@/hooks/useWorkout";

/**
 * Candado de sesión: si hay un entrenamiento en curso (sesión sin finalizar),
 * fuerza al usuario a la pantalla de ese entrenamiento — no puede navegar a
 * ninguna otra parte hasta Finalizar o Descartar. No renderiza nada visible.
 */
export function ActiveSessionGuard() {
  const { data: activeId, isLoading } = useActiveSession();
  const pathname = usePathname();
  const router = useRouter();

  useEffect(() => {
    if (isLoading || !activeId) return;
    const target = `/entrenar/${activeId}`;
    if (pathname === target || pathname.startsWith("/onboarding")) return;
    router.replace(target);
  }, [activeId, isLoading, pathname, router]);

  return null;
}
