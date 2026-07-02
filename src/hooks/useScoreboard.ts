"use client";

import { useQuery } from "@tanstack/react-query";
import { createClient } from "@/lib/supabase/client";
import { sinceFor, type Period } from "@/lib/period";
import type { ScoreboardRow, Sex } from "@/lib/types";

export type { Period };
export type Metric = "frequency" | "volume" | "weight" | "strength" | "reps";

const NEEDS_EXERCISE: Metric[] = ["weight", "strength"];

export function useScoreboard(
  metric: Metric,
  period: Period,
  exerciseId?: string,
  sex?: Sex | null,
) {
  return useQuery({
    queryKey: ["scoreboard", metric, period, exerciseId ?? null, sex ?? null],
    enabled: !NEEDS_EXERCISE.includes(metric) || !!exerciseId,
    queryFn: async (): Promise<ScoreboardRow[]> => {
      const supabase = createClient();
      const { data, error } = await supabase.rpc("scoreboard_stats", {
        p_metric: metric,
        p_since: sinceFor(period),
        p_exercise_id: exerciseId,
        p_sex: sex ?? null,
      });
      if (error) throw error;
      return (data ?? []) as ScoreboardRow[];
    },
  });
}
