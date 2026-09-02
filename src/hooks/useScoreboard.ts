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
};

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

      // Puesto en el período anterior, sólo entre quienes tenían actividad.
      const prevRank = new Map<string, number>();
      if (prior && !prior.error && prior.data) {
        (prior.data as ScoreboardRow[]).forEach((r, i) => {
          if (Number(r.value) > 0) prevRank.set(r.user_id, i);
        });
      }

      return rows.map((r, i) => {
        const pr = prevRank.get(r.user_id);
        // Movimiento sólo si hubo actividad en ambas ventanas (positivo = subió).
        const move = pr == null || Number(r.value) <= 0 ? null : pr - i;
        return { ...r, move };
      });
    },
  });
}
