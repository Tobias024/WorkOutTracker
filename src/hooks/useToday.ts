"use client";

import { useEffect, useState } from "react";
import { dateKey } from "@/lib/metrics";

/**
 * Clave del día local ("YYYY-MM-DD") que se actualiza sola al cambiar de día:
 * al volver el foco a la pestaña (visibilitychange) y con un timeout a la
 * próxima medianoche. Evita que los `useMemo` que capturan `new Date()` queden
 * congelados en el día en que se montó la app (SPA/PWA abierta mucho tiempo).
 */
export function useToday(): string {
  const [today, setToday] = useState(() => dateKey(new Date().toISOString()));

  useEffect(() => {
    let timer: ReturnType<typeof setTimeout>;

    const sync = () => {
      setToday(dateKey(new Date().toISOString()));
      const now = new Date();
      const nextMidnight = new Date(
        now.getFullYear(),
        now.getMonth(),
        now.getDate() + 1,
        0,
        0,
        5, // 5s de colchón para asegurar que ya cruzó
      );
      clearTimeout(timer);
      timer = setTimeout(sync, nextMidnight.getTime() - now.getTime());
    };

    const onVisible = () => {
      if (document.visibilityState === "visible") sync();
    };

    sync();
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      clearTimeout(timer);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, []);

  return today;
}
