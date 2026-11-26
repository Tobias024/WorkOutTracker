// SPDX-License-Identifier: AGPL-3.0-only
"use client";

import { create } from "zustand";
import { persist } from "zustand/middleware";
import { useSyncExternalStore } from "react";
import { REST_MAX_SECONDS } from "@/lib/metrics-goal";
import type { TrainingProfile } from "@/lib/types";

/** Un descanso más viejo que esto ya no es un descanso: se descarta al volver. */
export { REST_MAX_SECONDS };

/**
 * Cronómetro de descanso entre series, persistido.
 *
 * Antes vivía en un `useState` de la pantalla de entreno, y eso lo rompía de
 * dos maneras a la vez: al remontar (tocar otra sesión del historial cambia el
 * segmento dinámico, y encima `ActiveSessionGuard` rebota con `router.replace`,
 * o sea dos remontes seguidos) no sólo desaparecía el número — `saveRest` nunca
 * llegaba a correr, así que el `rest_seconds` de esa serie no se guardaba nunca.
 * Un refresh o que el SO matara la PWA hacían lo mismo.
 *
 * Se guarda `startedAt` como epoch y no un contador acumulado porque
 * `setInterval` no corre con la app en background: un contador se desincroniza
 * y un epoch se recalcula solo al volver.
 *
 * `targetSeconds` es el objetivo de la cuenta regresiva; viaja en el store para
 * que sobreviva a una recarga junto con `startedAt`.
 *
 * `sessionId` viaja con el descanso para no cerrarle la serie a otra sesión si
 * el usuario abre una vieja desde el historial.
 */
interface RestState {
  sessionId: string | null;
  setId: string | null;
  /** Epoch ms del arranque del descanso. null = sin descanso corriendo. */
  startedAt: number | null;
  /** Objetivo de descanso en segundos (cuenta regresiva). null = sin objetivo. */
  targetSeconds: number | null;
  start: (sessionId: string, setId: string, targetSeconds: number) => void;
  /** Suma (o resta) segundos al objetivo del descanso vivo. */
  addTarget: (seconds: number) => void;
  clear: () => void;
}

export const useRestStore = create<RestState>()(
  persist(
    (set) => ({
      sessionId: null,
      setId: null,
      startedAt: null,
      targetSeconds: null,
      start: (sessionId, setId, targetSeconds) =>
        set({ sessionId, setId, startedAt: Date.now(), targetSeconds }),
      addTarget: (seconds) =>
        set((s) => ({
          targetSeconds: Math.max(0, (s.targetSeconds ?? 0) + seconds),
        })),
      clear: () =>
        set({ sessionId: null, setId: null, startedAt: null, targetSeconds: null }),
    }),
    { name: "wot-rest" },
  ),
);

/** Objetivo por defecto cuando el store viejo no traía `targetSeconds`. */
export const REST_DEFAULT_SECONDS = 120;

/**
 * Objetivo de descanso según la mecánica del ejercicio y el perfil de
 * entrenamiento: compuesto 3 min, aislamiento 1:30, sin dato 2 min. Fuerza lo
 * estira ×1.5 (tope 5 min) y resistencia lo fija en 1 min.
 */
export function restTargetSeconds(
  mechanic: string | null,
  profile: TrainingProfile | null,
): number {
  if (profile === "resistencia") return 60;
  const base = mechanic === "compound" ? 180 : mechanic === "isolation" ? 90 : 120;
  return profile === "fuerza" ? Math.min(300, Math.round(base * 1.5)) : base;
}

// ── Reloj compartido ────────────────────────────────────────────────────────
// `Date.now()` no se puede llamar en render (es impuro y da resultados
// distintos en cada pasada), así que el "ahora" vive afuera de React y entra
// por `useSyncExternalStore`: el snapshot queda cacheado entre ticks, que es
// justo lo que el hook necesita para ser estable. Un solo intervalo para todos
// los suscriptores.

let nowMs = 0;
const clockListeners = new Set<() => void>();
let clockTimer: ReturnType<typeof setInterval> | null = null;

function subscribeClock(onChange: () => void): () => void {
  clockListeners.add(onChange);
  if (clockTimer == null) {
    nowMs = Date.now();
    clockTimer = setInterval(() => {
      nowMs = Date.now();
      for (const l of clockListeners) l();
    }, 500);
  }
  return () => {
    clockListeners.delete(onChange);
    if (clockListeners.size === 0 && clockTimer != null) {
      clearInterval(clockTimer);
      clockTimer = null;
    }
  };
}

/** Segundos transcurridos del descanso vivo. 0 si no hay ninguno corriendo. */
export function useRestSeconds(): number {
  const startedAt = useRestStore((s) => s.startedAt);
  const now = useSyncExternalStore(
    subscribeClock,
    () => nowMs,
    () => 0,
  );
  if (startedAt == null || now === 0) return 0;
  return Math.max(0, Math.round((now - startedAt) / 1000));
}

/**
 * `true` una vez montado en el cliente. El banner depende de estado persistido
 * en localStorage, así que sin esperar a la hidratación el server renderiza
 * "sin descanso" y el cliente "con descanso".
 */
export function useRestHydrated(): boolean {
  return useSyncExternalStore(
    () => () => {},
    () => true,
    () => false,
  );
}
