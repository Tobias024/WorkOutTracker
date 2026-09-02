// SPDX-License-Identifier: AGPL-3.0-only
"use client";

import { clsx } from "@/lib/clsx";
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

/** Barras horizontales de series efectivas por músculo con marcas MEV/MAV/MRV. */
export function MuscleSetsBar({ data }: { data: MuscleSetRow[] }) {
  if (!data.length) {
    return (
      <p className="text-sm text-muted">
        Todavía no hay series efectivas en los últimos 30 días.
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
            <div className="flex justify-between text-xs mb-1">
              <span>{muscleEs(r.muscle)}</span>
              <span className="text-muted tabular-nums">
                {r.sets.toFixed(1).replace(/\.0$/, "")} sets
              </span>
            </div>
            <div className="relative h-2.5 rounded-full bg-surface-2 overflow-hidden">
              <div
                className={clsx("h-full rounded-full", FILL[st])}
                style={{ width: pct(r.sets) }}
              />
              {[r.mev, r.mav, r.mrv].map((tick, i) => (
                <span
                  key={i}
                  className="absolute top-0 h-full w-px bg-fg/40"
                  style={{ left: pct(tick) }}
                />
              ))}
            </div>
          </div>
        );
      })}
      <div className="flex gap-3.5 flex-wrap mt-1 pt-2.5 border-t border-border">
        <Legend color="bg-warning" label="Bajo MEV" />
        <Legend color="bg-success" label="Óptimo" />
        <Legend color="bg-danger" label="Sobre MRV" />
      </div>
    </div>
  );
}

function Legend({ color, label }: { color: string; label: string }) {
  return (
    <span className="inline-flex items-center gap-1.5 text-[10.5px] text-muted">
      <span className={clsx("size-2.5 rounded-sm", color)} />
      {label}
    </span>
  );
}
