"use client";

import { useQuery } from "@tanstack/react-query";
import { createClient } from "@/lib/supabase/client";
import type { ScoreboardRow } from "@/lib/types";

export type Metric = "frequency" | "volume" | "weight";
export type Period = "week" | "month" | "all";

function sinceFor(period: Period): string {
  const now = Date.now();
  if (period === "week") return new Date(now - 7 * 86400000).toISOString();
  if (period === "month") return new Date(now - 30 * 86400000).toISOString();
  return new Date("1970-01-01").toISOString();
}

export function useScoreboard(
  metric: Metric,
  period: Period,
  exerciseId?: string,
) {
  return useQuery({
    queryKey: ["scoreboard", metric, period, exerciseId ?? null],
    enabled: metric !== "weight" || !!exerciseId,
    queryFn: async (): Promise<ScoreboardRow[]> => {
      const supabase = createClient();
      const { data, error } = await supabase.rpc("scoreboard_stats", {
        p_metric: metric,
        p_since: sinceFor(period),
        p_exercise_id: exerciseId,
      });
      if (error) throw error;
      return (data ?? []) as ScoreboardRow[];
    },
  });
}
