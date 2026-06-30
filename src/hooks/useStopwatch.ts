"use client";

import { create } from "zustand";
import { persist } from "zustand/middleware";
import { useEffect, useState } from "react";

interface StopwatchState {
  running: boolean;
  // timestamp (ms) en que arrancó el tramo actual; null si está pausado
  startedAt: number | null;
  // segundos acumulados de tramos previos
  accumulated: number;
  start: () => void;
  pause: () => void;
  reset: () => void;
}

/** Cronómetro global persistido (sobrevive refresh). Cuenta hacia arriba. */
export const useStopwatchStore = create<StopwatchState>()(
  persist(
    (set, get) => ({
      running: false,
      startedAt: null,
      accumulated: 0,
      start: () => {
        if (get().running) return;
        set({ running: true, startedAt: Date.now() });
      },
      pause: () => {
        const { running, startedAt, accumulated } = get();
        if (!running || startedAt == null) return;
        const extra = (Date.now() - startedAt) / 1000;
        set({ running: false, startedAt: null, accumulated: accumulated + extra });
      },
      reset: () => set({ running: false, startedAt: null, accumulated: 0 }),
    }),
    { name: "wot-stopwatch" },
  ),
);

/** Devuelve los segundos transcurridos, actualizándose en vivo. */
export function useStopwatchSeconds(): number {
  const { running, startedAt, accumulated } = useStopwatchStore();
  const [seconds, setSeconds] = useState(0);

  useEffect(() => {
    const compute = () => {
      const live = running && startedAt ? (Date.now() - startedAt) / 1000 : 0;
      setSeconds(Math.floor(accumulated + live));
    };
    compute();
    if (!running) return;
    const t = setInterval(compute, 250);
    return () => clearInterval(t);
  }, [running, startedAt, accumulated]);

  return seconds;
}
