"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { createClient } from "@/lib/supabase/client";
import type { WorkoutSession, WorkoutSet } from "@/lib/types";

/** Mutaciones sobre una sesión activa. Todas invalidan ["session", sessionId]. */
export function useSessionMutations(sessionId: string) {
  const qc = useQueryClient();
  const invalidate = () =>
    qc.invalidateQueries({ queryKey: ["session", sessionId] });

  const updateSet = useMutation({
    mutationFn: async ({
      id,
      patch,
    }: {
      id: string;
      patch: Partial<WorkoutSet>;
    }) => {
      const supabase = createClient();
      const { error } = await supabase
        .from("workout_sets")
        .update(patch)
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: invalidate,
  });

  const addSet = useMutation({
    mutationFn: async ({
      workoutExerciseId,
      setNumber,
      reps,
      weight,
    }: {
      workoutExerciseId: string;
      setNumber: number;
      reps?: number | null;
      weight?: number | null;
    }) => {
      const supabase = createClient();
      const { error } = await supabase.from("workout_sets").insert({
        workout_exercise_id: workoutExerciseId,
        set_number: setNumber,
        reps: reps ?? null,
        weight: weight ?? null,
      });
      if (error) throw error;
    },
    onSuccess: invalidate,
  });

  const deleteSet = useMutation({
    mutationFn: async (id: string) => {
      const supabase = createClient();
      const { error } = await supabase.from("workout_sets").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: invalidate,
  });

  const addExercise = useMutation({
    mutationFn: async ({
      exerciseId,
      position,
    }: {
      exerciseId: string;
      position: number;
    }) => {
      const supabase = createClient();
      const { data: we, error } = await supabase
        .from("workout_exercises")
        .insert({
          session_id: sessionId,
          exercise_id: exerciseId,
          position,
        })
        .select()
        .single();
      if (error) throw error;
      await supabase.from("workout_sets").insert([
        { workout_exercise_id: we.id, set_number: 1 },
        { workout_exercise_id: we.id, set_number: 2 },
        { workout_exercise_id: we.id, set_number: 3 },
      ]);
    },
    onSuccess: invalidate,
  });

  const removeExercise = useMutation({
    mutationFn: async (workoutExerciseId: string) => {
      const supabase = createClient();
      const { error } = await supabase
        .from("workout_exercises")
        .delete()
        .eq("id", workoutExerciseId);
      if (error) throw error;
    },
    onSuccess: invalidate,
  });

  /**
   * Reemplaza el ejercicio de un workout_exercise.
   * saveForFuture=true guarda la sustitución para próximas veces (si viene de una rutina).
   */
  const replaceExercise = useMutation({
    mutationFn: async ({
      workoutExerciseId,
      originalExerciseId,
      newExerciseId,
      routineExerciseId,
      saveForFuture,
    }: {
      workoutExerciseId: string;
      originalExerciseId: string;
      newExerciseId: string;
      routineExerciseId: string | null;
      saveForFuture: boolean;
    }) => {
      const supabase = createClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();

      const { error } = await supabase
        .from("workout_exercises")
        .update({
          exercise_id: newExerciseId,
          replaced_from_exercise_id: originalExerciseId,
        })
        .eq("id", workoutExerciseId);
      if (error) throw error;

      if (saveForFuture && routineExerciseId && user) {
        await supabase.from("exercise_substitutions").upsert(
          {
            user_id: user.id,
            routine_exercise_id: routineExerciseId,
            substitute_exercise_id: newExerciseId,
          },
          { onConflict: "user_id,routine_exercise_id" },
        );
      }
    },
    onSuccess: invalidate,
  });

  const updateSession = useMutation({
    mutationFn: async (patch: Partial<WorkoutSession>) => {
      const supabase = createClient();
      const { error } = await supabase
        .from("workout_sessions")
        .update(patch)
        .eq("id", sessionId);
      if (error) throw error;
    },
    // Además de la sesión activa, esto puede tocar ended_at/duration_seconds
    // al terminar el entrenamiento — Registro necesita verlo de inmediato.
    onSuccess: () => {
      invalidate();
      qc.invalidateQueries({ queryKey: ["history"] });
    },
  });

  return {
    updateSet,
    addSet,
    deleteSet,
    addExercise,
    removeExercise,
    replaceExercise,
    updateSession,
  };
}
