// SPDX-License-Identifier: AGPL-3.0-only
"use client";

import { queryOptions, useQuery } from "@tanstack/react-query";
import { createClient } from "@/lib/supabase/client";
import type { SetDrop } from "@/lib/types";

export interface HistorySet {
  reps: number | null;
  weight: number | null;
  completed: boolean;
  is_warmup: boolean;
  rpe: number | null;
  rest_seconds: number | null;
  drops: SetDrop[] | null;
  duration_seconds: number | null;
  distance_m: number | null;
}
export interface HistoryExercise {
  exercise_id: string;
  workout_sets: HistorySet[];
}
export interface HistorySession {
  id: string;
  name: string;
  routine_id: string | null;
  created_at: string;
  started_at: string | null;
  ended_at: string | null;
  duration_seconds: number | null;
  body_weight_kg: number | null;
  workout_exercises: HistoryExercise[];
}

/** Variante completa (solo para exportar): suma las columnas que ninguna
 *  pantalla usa. Es asignable a HistorySession. */
export interface HistorySetFull extends HistorySet {
  completed_at: string | null;
  /** Comentario libre que el usuario escribió en la serie. */
  comment: string | null;
  /** Plan de la rutina al arrancar la sesión (migración 0034). */
  planned_reps: number | null;
  planned_weight: number | null;
}
export interface HistoryExerciseFull extends HistoryExercise {
  replaced_from_exercise_id: string | null;
  workout_sets: HistorySetFull[];
}
export interface HistorySessionFull extends HistorySession {
  workout_exercises: HistoryExerciseFull[];
}

const SESSION_COLS =
  "id, name, routine_id, created_at, started_at, ended_at, duration_seconds, body_weight_kg";

/** Historial completo del usuario con sets anidados (para métricas). */
export const historyQueryOptions = queryOptions({
  queryKey: ["history"],
  staleTime: 5 * 60_000,
  queryFn: async (): Promise<HistorySession[]> => {
    const supabase = createClient();
    const { data, error } = await supabase
      .from("workout_sessions")
      .select(
        `${SESSION_COLS}, workout_exercises(exercise_id, workout_sets(reps, weight, completed, is_warmup, rpe, rest_seconds, drops, duration_seconds, distance_m))`,
      )
      .order("created_at", { ascending: false });
    if (error) throw error;
    return (data ?? []) as unknown as HistorySession[];
  },
});

/**
 * Sólo las sesiones de los últimos `days` días (mismas columnas que el
 * historial), para lo que mira una ventana corta sin bajar todo el historial.
 * `now` es el instante de la consulta: referencia estable para calcular días
 * sin llamar a Date.now() en el render.
 */
export function recentHistoryQueryOptions(days: number) {
  return queryOptions({
    queryKey: ["history", "recent", days],
    staleTime: 5 * 60_000,
    queryFn: async (): Promise<{ sessions: HistorySession[]; now: number }> => {
      const now = Date.now();
      const since = new Date(now - days * 86_400_000).toISOString();
      const { data, error } = await createClient()
        .from("workout_sessions")
        .select(
          `${SESSION_COLS}, workout_exercises(exercise_id, workout_sets(reps, weight, completed, is_warmup, rpe, rest_seconds, drops, duration_seconds, distance_m))`,
        )
        .gte("started_at", since)
        .order("started_at", { ascending: false });
      if (error) throw error;
      return { sessions: (data ?? []) as unknown as HistorySession[], now };
    },
  });
}

/** Historial con TODAS las columnas; usar con `queryClient.fetchQuery` solo al
 *  exportar. Cuelga de ["history"] para que las invalidaciones lo marquen stale. */
export const historyExportQueryOptions = queryOptions({
  queryKey: ["history", "export"],
  staleTime: 5 * 60_000,
  queryFn: async (): Promise<HistorySessionFull[]> => {
    const supabase = createClient();
    const { data, error } = await supabase
      .from("workout_sessions")
      .select(
        `${SESSION_COLS}, workout_exercises(exercise_id, replaced_from_exercise_id, workout_sets(reps, weight, completed, is_warmup, rpe, completed_at, rest_seconds, drops, duration_seconds, distance_m, comment, planned_reps, planned_weight))`,
      )
      .order("created_at", { ascending: false });
    if (error) throw error;
    return (data ?? []) as unknown as HistorySessionFull[];
  },
});

export function useHistory() {
  return useQuery(historyQueryOptions);
}
