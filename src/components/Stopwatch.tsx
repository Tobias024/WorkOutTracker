"use client";

import { useState } from "react";
import { Timer, Play, Pause, RotateCcw } from "lucide-react";
import {
  useStopwatchStore,
  useStopwatchSeconds,
} from "@/hooks/useStopwatch";
import { formatClock } from "@/lib/format";
import { clsx } from "@/lib/clsx";

/**
 * Cronómetro flotante opcional ("Cron"). Botón visible que se expande.
 * Útil para medir descansos entre series.
 */
export function StopwatchFab() {
  const [open, setOpen] = useState(false);
  const { running, start, pause, reset } = useStopwatchStore();
  const seconds = useStopwatchSeconds();

  return (
    <div className="fixed bottom-36 right-4 z-30">
      {open ? (
        <div className="card p-3 flex items-center gap-2 shadow-xl">
          <span
            className={clsx(
              "font-mono text-lg tabular-nums w-20 text-center",
              running ? "text-success" : "text-fg",
            )}
          >
            {formatClock(seconds)}
          </span>
          <button
            onClick={running ? pause : start}
            className="size-9 rounded bg-primary text-primary-fg grid place-items-center"
          >
            {running ? <Pause className="size-4" /> : <Play className="size-4" />}
          </button>
          <button
            onClick={reset}
            className="size-9 rounded bg-surface-2 grid place-items-center text-muted hover:text-fg"
          >
            <RotateCcw className="size-4" />
          </button>
          <button
            onClick={() => setOpen(false)}
            className="text-xs text-muted px-1"
          >
            Cerrar
          </button>
        </div>
      ) : (
        <button
          onClick={() => setOpen(true)}
          className={clsx(
            "size-14 rounded-full grid place-items-center shadow-xl ring-1 ring-border",
            running ? "bg-success text-bg" : "bg-surface text-primary",
          )}
        >
          {running ? (
            <span className="font-mono text-xs tabular-nums">
              {formatClock(seconds)}
            </span>
          ) : (
            <Timer className="size-6" />
          )}
        </button>
      )}
    </div>
  );
}
