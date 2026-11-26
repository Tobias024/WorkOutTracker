// SPDX-License-Identifier: AGPL-3.0-only
"use client";

import { useEffect, useRef } from "react";
import { Button } from "@/components/ui";
import { formatClock } from "@/lib/format";
import { clsx } from "@/lib/clsx";

const R = 18;
const CIRC = 2 * Math.PI * R;

/**
 * Banner de descanso con cuenta regresiva y anillo de progreso. Al llegar a 0
 * vibra una sola vez, se tiñe de verde y sigue contando en positivo ("+0:15"),
 * porque pasarse del objetivo también es información útil para el usuario.
 */
export function RestTimer({
  elapsed,
  startedAt,
  targetSeconds,
  hint,
  onAdd,
  onStart,
}: {
  /** Segundos transcurridos desde que arrancó el descanso. */
  elapsed: number;
  /** Epoch del arranque: identifica el descanso para vibrar una sola vez. */
  startedAt: number;
  targetSeconds: number;
  /** Texto de la banda objetivo, ej. "compuesto 2–3 min". */
  hint: string | null;
  onAdd: (seconds: number) => void;
  onStart: () => void;
}) {
  const remaining = targetSeconds - elapsed;
  const done = remaining <= 0;
  const frac = targetSeconds > 0 ? Math.max(0, remaining) / targetSeconds : 0;

  // Flag por descanso: sumar "+30 s" después de vibrar no debe volver a vibrar
  // salvo que el descanso sea otro (otro startedAt).
  const vibratedFor = useRef<number | null>(null);
  useEffect(() => {
    if (!done || vibratedFor.current === startedAt) return;
    vibratedFor.current = startedAt;
    try {
      navigator.vibrate?.([200, 100, 200]);
    } catch {
      // vibrate no está disponible en todos los navegadores
    }
  }, [done, startedAt]);

  const label = done
    ? `+${formatClock(-remaining)}`
    : formatClock(remaining);

  return (
    <div
      className={clsx(
        "card flex flex-col gap-2 p-3 shadow-lg ring-1",
        done ? "ring-success" : "ring-primary/40",
      )}
    >
      <div className="flex items-center gap-3">
        <svg
          viewBox="0 0 44 44"
          className="size-11 shrink-0 -rotate-90"
          aria-hidden
        >
          <circle
            cx="22"
            cy="22"
            r={R}
            fill="none"
            strokeWidth="4"
            className="stroke-surface-2"
          />
          <circle
            cx="22"
            cy="22"
            r={R}
            fill="none"
            strokeWidth="4"
            strokeLinecap="round"
            strokeDasharray={CIRC}
            strokeDashoffset={CIRC * (1 - frac)}
            className={clsx(
              "transition-[stroke-dashoffset] duration-500 motion-reduce:transition-none",
              done ? "stroke-success" : "stroke-primary",
            )}
          />
        </svg>
        <div className="min-w-0 flex-1" role="timer" aria-label="Descanso">
          <p
            className={clsx(
              "text-2xl font-extrabold tabular-nums leading-none",
              done ? "text-success-fg" : "text-primary",
            )}
          >
            {label}
          </p>
          <p className="mt-1 truncate text-xs text-muted">
            {done ? "Listo para la próxima serie" : `Descanso${hint ? ` · ${hint}` : ""}`}
          </p>
        </div>
      </div>
      <div className="grid grid-cols-[auto_1fr] gap-2">
        <Button
          variant="secondary"
          className="h-11 px-4"
          onClick={() => onAdd(30)}
        >
          +30 s
        </Button>
        <Button className="h-11" onClick={onStart}>
          Arrancar serie
        </Button>
      </div>
    </div>
  );
}
