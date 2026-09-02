// SPDX-License-Identifier: AGPL-3.0-only
"use client";

import { useEffect, useState } from "react";
import { dateKey } from "@/lib/metrics";

/**
 * Clave del día local ("YYYY-MM-DD") que se actualiza sola al cambiar de día:
 * al volver el foco a la pestaña (visibilitychange/focus), con un timeout a
 * la próxima medianoche, y con un polling de respaldo cada 60s. Evita que
 * los `useMemo` que capturan `new Date()` queden congelados en el día (o la
 * semana: `weekStart()` depende de esto) en que se montó la app — el timeout
 * a medianoche por sí solo no alcanza porque una laptop que se suspende con
 * la pestaña ya visible no siempre dispara visibilitychange al despertar, y
 * el setTimeout agendado se pierde o se retrasa durante la suspensión.
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
    window.addEventListener("focus", sync);
    // Respaldo: si el timeout se perdió (ej. la laptop se suspendió con la
    // pestaña visible, sin transición de visibilitychange al despertar), esto
    // lo detecta dentro del minuto.
    const poll = setInterval(sync, 60_000);
    return () => {
      clearTimeout(timer);
      clearInterval(poll);
      document.removeEventListener("visibilitychange", onVisible);
      window.removeEventListener("focus", sync);
    };
  }, []);

  return today;
}
