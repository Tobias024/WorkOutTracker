"use client";

import { useQuery } from "@tanstack/react-query";
import { createClient } from "@/lib/supabase/client";
import type { SetDrop } from "@/lib/types";

export interface HistorySet {
  reps: number | null;
  weight: number | null;
  completed: boolean;
  is_warmup: boolean;
  rpe: number | null;
  completed_at: string | null;
  drops: SetDrop[] | null;
}
export interface HistoryExercise {
  exercise_id: string;
  replaced_from_exercise_id: string | null;
  workout_sets: HistorySet[];
}
export interface HistorySession {
  id: string;
  name: string;
  created_at: string;
  started_at: string | null;
  ended_at: string | null;
  duration_seconds: number | null;
  body_weight_kg: number | null;
  workout_exercises: HistoryExercise[];
}

/** Historial completo del usuario con sets anidados (para métricas). */
export function useHistory() {
  return useQuery({
    queryKey: ["history"],
    staleTime: 5 * 60_000,
    queryFn: async (): Promise<HistorySession[]> => {
      const supabase = createClient();
      const { data, error } = await supabase
        .from("workout_sessions")
        .select(
          "id, name, created_at, started_at, ended_at, duration_seconds, body_weight_kg, workout_exercises(exercise_id, replaced_from_exercise_id, workout_sets(reps, weight, completed, is_warmup, rpe, completed_at, drops))",
        )
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as unknown as HistorySession[];
    },
  });
}
