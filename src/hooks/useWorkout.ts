"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createClient } from "@/lib/supabase/client";
import type {
  WorkoutSession,
  WorkoutExercise,
  WorkoutSet,
} from "@/lib/types";

export interface SessionExercise extends WorkoutExercise {
  sets: WorkoutSet[];
}

export interface FullSession {
  session: WorkoutSession;
  exercises: SessionExercise[];
}

/** Crea una sesión a partir de una rutina, aplicando sustituciones guardadas. */
export function useStartWorkout() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (routineId: string): Promise<string> => {
      const supabase = createClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) throw new Error("No autenticado");

      const [{ data: routine }, { data: rexs }, { data: subs }] =
        await Promise.all([
          supabase.from("routines").select("name").eq("id", routineId).single(),
          supabase
            .from("routine_exercises")
            .select("*")
            .eq("routine_id", routineId)
            .order("position"),
          supabase
            .from("exercise_substitutions")
            .select("routine_exercise_id, substitute_exercise_id")
            .eq("user_id", user.id),
        ]);

      const subMap = new Map(
        (subs ?? []).map((s) => [
          s.routine_exercise_id,
          s.substitute_exercise_id,
        ]),
      );

      const { data: session, error } = await supabase
        .from("workout_sessions")
        .insert({
          user_id: user.id,
          routine_id: routineId,
          name: routine?.name ?? "Entrenamiento",
          started_at: new Date().toISOString(),
        })
        .select()
        .single();
      if (error) throw error;

      for (const rex of rexs ?? []) {
        const sub = subMap.get(rex.id);
        const exerciseId = sub ?? rex.exercise_id;
        const { data: we } = await supabase
          .from("workout_exercises")
          .insert({
            session_id: session.id,
            exercise_id: exerciseId,
            routine_exercise_id: rex.id,
            replaced_from_exercise_id: sub ? rex.exercise_id : null,
            position: rex.position,
            notes: rex.notes,
          })
          .select()
          .single();

        const setCount = Math.max(1, rex.target_sets ?? 3);
        const sets = Array.from({ length: setCount }, (_, i) => ({
          workout_exercise_id: we!.id,
          set_number: i + 1,
          reps: rex.target_reps,
        }));
        await supabase.from("workout_sets").insert(sets);
      }

      qc.invalidateQueries({ queryKey: ["sessions"] });
      return session.id;
    },
  });
}

/** Crea una sesión vacía (entrenamiento libre). */
export function useStartEmptyWorkout() {
  return useMutation({
    mutationFn: async (): Promise<string> => {
      const supabase = createClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) throw new Error("No autenticado");
      const { data, error } = await supabase
        .from("workout_sessions")
        .insert({
          user_id: user.id,
          name: "Entrenamiento libre",
          started_at: new Date().toISOString(),
        })
        .select()
        .single();
      if (error) throw error;
      return data.id;
    },
  });
}

export function useWorkoutSession(sessionId: string) {
  return useQuery({
    queryKey: ["session", sessionId],
    queryFn: async (): Promise<FullSession> => {
      const supabase = createClient();
      const { data: session, error } = await supabase
        .from("workout_sessions")
        .select("*")
        .eq("id", sessionId)
        .single();
      if (error) throw error;

      const { data: exercises } = await supabase
        .from("workout_exercises")
        .select("*, workout_sets(*)")
        .eq("session_id", sessionId)
        .order("position");

      const rows = (exercises ?? []) as unknown as (WorkoutExercise & {
        workout_sets: WorkoutSet[];
      })[];

      const mapped: SessionExercise[] = rows.map((e) => ({
        ...e,
        sets: (e.workout_sets ?? []).sort(
          (a, b) => a.set_number - b.set_number,
        ),
      }));

      return { session: session as WorkoutSession, exercises: mapped };
    },
  });
}
