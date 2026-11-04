// SPDX-License-Identifier: AGPL-3.0-only
"use client";

import { clsx } from "@/lib/clsx";
import { fmtNum, fmtSeries } from "@/lib/format";
import { muscleEs } from "@/lib/i18n-exercise";

export interface MuscleSetRow {
  muscle: string;
  sets: number;
  mev: number;
  mav: number;
  mrv: number;
}

function state(sets: number, mev: number, mrv: number): "warning" | "success" | "danger" {
  if (sets < mev) return "warning";
  if (sets > mrv) return "danger";
  return "success";
}

const FILL: Record<string, string> = {
  warning: "bg-warning",
  success: "bg-success",
  danger: "bg-danger",
};

/** Barras horizontales de series efectivas por músculo con marcas MEV/MAV/MRV.
 *  Cada fila muestra a la derecha el valor y el mínimo ("12,5 series · mín. 10"),
 *  así las marcas no necesitan rótulo propio en cada barra.
 *  `windowDays` es la ventana que se está mostrando (para el empty state). */
export function MuscleSetsBar({
  data,
  windowDays = 30,
}: {
  data: MuscleSetRow[];
  windowDays?: number;
}) {
  if (!data.length) {
    return (
      <p className="text-sm text-muted">
        Todavía no hay series efectivas en los últimos {windowDays} días.
      </p>
    );
  }
  return (
    <div className="flex flex-col gap-3">
      {data.map((r) => {
        const scaleMax = r.mrv * 1.3;
        const st = state(r.sets, r.mev, r.mrv);
        const pct = (v: number) => `${Math.min((v / scaleMax) * 100, 100)}%`;
        return (
          <div key={r.muscle}>
            <div className="flex justify-between gap-2 text-xs mb-1">
              <span>{muscleEs(r.muscle)}</span>
              <span className="text-muted tabular-nums text-right">
                {fmtSeries(r.sets)} · mín. {fmtNum(r.mev, 1)}
              </span>
            </div>
            <div className="relative h-2.5">
              <div className="absolute inset-0 rounded-full bg-surface-2 overflow-hidden">
                <div
                  className={clsx("h-full rounded-full", FILL[st])}
                  style={{ width: pct(r.sets) }}
                />
              </div>
              {/* Marcas distintas: MEV y MRV gruesas y completas, MAV fina y corta. */}
              <span
                aria-hidden
                className="absolute -top-0.5 -bottom-0.5 w-0.5 bg-fg"
                style={{ left: pct(r.mev) }}
              />
              <span
                aria-hidden
                className="absolute top-0.5 bottom-0.5 w-px bg-fg/60"
                style={{ left: pct(r.mav) }}
              />
              <span
                aria-hidden
                className="absolute -top-0.5 -bottom-0.5 w-0.5 bg-fg"
                style={{ left: pct(r.mrv) }}
              />
            </div>
          </div>
        );
      })}
      <div className="mt-1 pt-2.5 border-t border-border flex flex-col gap-1.5">
        <div className="flex gap-3.5 flex-wrap">
          <Legend color="bg-warning" label="Bajo MEV" />
          <Legend color="bg-success" label="Óptimo" />
          <Legend color="bg-danger" label="Sobre MRV" />
        </div>
        <p className="text-xs text-muted">
          Marcas, de izquierda a derecha: MEV (volumen mínimo efectivo), MAV
          (volumen adaptativo máximo, la línea fina) y MRV (volumen máximo
          recuperable).
        </p>
      </div>
    </div>
  );
}

function Legend({ color, label }: { color: string; label: string }) {
  return (
    <span className="inline-flex items-center gap-1.5 text-xs text-muted">
      <span className={clsx("size-3 rounded-sm", color)} />
      {label}
    </span>
  );
}
