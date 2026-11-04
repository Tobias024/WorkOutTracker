// SPDX-License-Identifier: AGPL-3.0-only
"use client";

import { useQuery } from "@tanstack/react-query";
import { createClient } from "@/lib/supabase/client";
import {
  sinceFor,
  prevRangeFor,
  localTimeZone,
  type Period,
} from "@/lib/period";
import type { ScoreboardRow, Sex } from "@/lib/types";

export type { Period };
export type Metric =
  | "frequency"
  | "volume"
  | "weight"
  | "strength"
  | "strength_bw"
  | "strength_rel"
  | "hard_sets"
  | "reps";

/** Fila del ranking + movimiento de puesto vs el período anterior. */
export type ScoreboardRowWithMove = ScoreboardRow & {
  /** +n subió n puestos, -n bajó, 0 se mantuvo, null sin comparación posible. */
  move: number | null;
  /** Puesto (ranking de competición: empates comparten puesto, 1,1,3). */
  rank: number;
  /** Valor en el período anterior (null si no hubo actividad o no hay comparación). */
  prevValue: number | null;
};

/** Ranking de competición: puesto = 1 + cantidad de filas con valor estrictamente mayor. */
export function competitionRanks(rows: { value: number }[]): number[] {
  return rows.map(
    (r) => 1 + rows.reduce((n, o) => (Number(o.value) > Number(r.value) ? n + 1 : n), 0),
  );
}

/**
 * Asigna `rank` y `move` sobre la lista dada (puede estar filtrada): los puestos
 * actuales y los previos se calculan solo entre las filas presentes.
 */
export function withRanksAndMoves(
  rows: (ScoreboardRow & { prevValue: number | null })[],
): ScoreboardRowWithMove[] {
  const ranks = competitionRanks(rows.map((r) => ({ value: Number(r.value) })));
  // Puesto previo, sólo entre quienes tenían actividad en el período anterior.
  const withPrev = rows.filter((r) => r.prevValue != null && r.prevValue > 0);
  const prevRanks = competitionRanks(withPrev.map((r) => ({ value: r.prevValue as number })));
  const prevRankOf = new Map<string, number>();
  withPrev.forEach((r, i) => prevRankOf.set(r.user_id, prevRanks[i]));
  return rows.map((r, i) => {
    const pr = prevRankOf.get(r.user_id);
    // Movimiento sólo si hubo actividad en ambas ventanas (positivo = subió).
    const move = pr == null || Number(r.value) <= 0 ? null : pr - ranks[i];
    return { ...r, rank: ranks[i], move };
  });
}

const NEEDS_EXERCISE: Metric[] = ["weight", "strength", "strength_bw"];

export function useScoreboard(
  metric: Metric,
  period: Period,
  exerciseId?: string,
  sex?: Sex | null,
) {
  return useQuery({
    queryKey: ["scoreboard", metric, period, exerciseId ?? null, sex ?? null],
    staleTime: 2 * 60_000,
    enabled: !NEEDS_EXERCISE.includes(metric) || !!exerciseId,
    queryFn: async (): Promise<ScoreboardRowWithMove[]> => {
      const supabase = createClient();
      const prev = prevRangeFor(period);
      const tz = localTimeZone();

      const [cur, prior] = await Promise.all([
        supabase.rpc("scoreboard_stats", {
          p_metric: metric,
          p_since: sinceFor(period),
          p_exercise_id: exerciseId,
          p_sex: sex ?? null,
          p_tz: tz,
        }),
        prev
          ? supabase.rpc("scoreboard_stats", {
              p_metric: metric,
              p_since: prev.since,
              p_exercise_id: exerciseId,
              p_sex: sex ?? null,
              p_until: prev.until,
              p_tz: tz,
            })
          : Promise.resolve({ data: null, error: null }),
      ]);

      if (cur.error) throw cur.error;
      const rows = (cur.data ?? []) as ScoreboardRow[];

      const prevValue = new Map<string, number>();
      if (prior && !prior.error && prior.data) {
        (prior.data as ScoreboardRow[]).forEach((r) => {
          if (Number(r.value) > 0) prevValue.set(r.user_id, Number(r.value));
        });
      }

      return withRanksAndMoves(
        rows.map((r) => ({ ...r, prevValue: prevValue.get(r.user_id) ?? null })),
      );
    },
  });
}
