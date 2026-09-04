// SPDX-License-Identifier: AGPL-3.0-only
"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { createClient } from "@/lib/supabase/client";
import type { FullSession } from "@/hooks/useWorkout";
import type { WorkoutSession, WorkoutSet } from "@/lib/types";

/** Mutaciones sobre una sesión activa. */
export function useSessionMutations(sessionId: string) {
  const qc = useQueryClient();
  const sessionKey = ["session", sessionId];

  // Marca Registro/Ranking como stale SIN refetch inmediato: se refrescan la
  // próxima vez que se abren, no en cada tap durante el entrenamiento.
  const markStaleBackground = () => {
    qc.invalidateQueries({ queryKey: ["history"], refetchType: "none" });
    qc.invalidateQueries({ queryKey: ["scoreboard"], refetchType: "none" });
  };
  // Cambios estructurales (ids nuevos del server): además refetchea la sesión.
  const refetchSession = () => qc.invalidateQueries({ queryKey: sessionKey });

  /** Escribe optimísticamente en el cache de la sesión y devuelve el snapshot. */
  function optimistic(mutate: (s: FullSession) => FullSession) {
    const prev = qc.getQueryData<FullSession>(sessionKey);
    if (prev) qc.setQueryData<FullSession>(sessionKey, mutate(prev));
    return { prev };
  }
  function rollback(ctx: { prev?: FullSession } | undefined) {
    if (ctx?.prev) qc.setQueryData(sessionKey, ctx.prev);
  }

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
    onMutate: async ({ id, patch }) => {
      await qc.cancelQueries({ queryKey: sessionKey });
      return optimistic((s) => ({
        ...s,
        exercises: s.exercises.map((ex) => ({
          ...ex,
          sets: ex.sets.map((set) =>
            set.id === id ? { ...set, ...patch } : set,
          ),
        })),
      }));
    },
    onError: (_e, _v, ctx) => rollback(ctx),
    // Sin refetch de la sesión: el optimistic ya es correcto para un patch.
    onSettled: markStaleBackground,
  });

  const addSet = useMutation({
    mutationFn: async ({
      workoutExerciseId,
      setNumber,
      reps,
      weight,
      durationSeconds,
      distanceM,
    }: {
      workoutExerciseId: string;
      setNumber: number;
      reps?: number | null;
      weight?: number | null;
      durationSeconds?: number | null;
      distanceM?: number | null;
    }) => {
      const supabase = createClient();
      const { error } = await supabase.from("workout_sets").insert({
        workout_exercise_id: workoutExerciseId,
        set_number: setNumber,
        reps: reps ?? null,
        weight: weight ?? null,
        duration_seconds: durationSeconds ?? null,
        distance_m: distanceM ?? null,
      });
      if (error) throw error;
    },
    onMutate: async ({
      workoutExerciseId,
      setNumber,
      reps,
      weight,
      durationSeconds,
      distanceM,
    }) => {
      await qc.cancelQueries({ queryKey: sessionKey });
      const tempSet: WorkoutSet = {
        id: `temp-${setNumber}-${workoutExerciseId}`,
        workout_exercise_id: workoutExerciseId,
        set_number: setNumber,
        reps: reps ?? null,
        weight: weight ?? null,
        rpe: null,
        comment: null,
        is_warmup: false,
        completed: false,
        completed_at: null,
        rest_seconds: null,
        drops: null,
        duration_seconds: durationSeconds ?? null,
        distance_m: distanceM ?? null,
        // Una serie agregada durante el entreno no sale de la rutina: no tiene
        // plan contra el cual compararse, y por eso no se colorea.
        planned_reps: null,
        planned_weight: null,
        planned_duration_seconds: null,
        planned_distance_m: null,
      };
      return optimistic((s) => ({
        ...s,
        exercises: s.exercises.map((ex) =>
          ex.id === workoutExerciseId
            ? { ...ex, sets: [...ex.sets, tempSet] }
            : ex,
        ),
      }));
    },
    onError: (_e, _v, ctx) => rollback(ctx),
    // Refetchea para reemplazar el id temporal por el real.
    onSettled: () => {
      refetchSession();
      markStaleBackground();
    },
  });

  const deleteSet = useMutation({
    mutationFn: async (id: string) => {
      const supabase = createClient();
      const { error } = await supabase.from("workout_sets").delete().eq("id", id);
      if (error) throw error;
    },
    onMutate: async (id) => {
      await qc.cancelQueries({ queryKey: sessionKey });
      return optimistic((s) => ({
        ...s,
        exercises: s.exercises.map((ex) => ({
          ...ex,
          sets: ex.sets.filter((set) => set.id !== id),
        })),
      }));
    },
    onError: (_e, _v, ctx) => rollback(ctx),
    onSettled: markStaleBackground,
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
    onSuccess: () => {
      refetchSession();
      markStaleBackground();
    },
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
    onMutate: async (workoutExerciseId) => {
      await qc.cancelQueries({ queryKey: sessionKey });
      return optimistic((s) => ({
        ...s,
        exercises: s.exercises.filter((ex) => ex.id !== workoutExerciseId),
      }));
    },
    onError: (_e, _v, ctx) => rollback(ctx),
    onSettled: markStaleBackground,
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
    onSuccess: () => {
      refetchSession();
      markStaleBackground();
    },
  });

  /**
   * Reordena dos ejercicios de la sesión intercambiando su `position`
   * (dos updates, como el swap de rutinas) y el lugar en el cache de forma
   * optimista. `position` es un entero arbitrario para ORDER BY, así que el
   * swap por valor es robusto aunque no sea contiguo.
   */
  const reorder = useMutation({
    mutationFn: async ({
      a,
      b,
    }: {
      a: { id: string; position: number };
      b: { id: string; position: number };
    }) => {
      const supabase = createClient();
      const { error: e1 } = await supabase
        .from("workout_exercises")
        .update({ position: b.position })
        .eq("id", a.id);
      if (e1) throw e1;
      const { error: e2 } = await supabase
        .from("workout_exercises")
        .update({ position: a.position })
        .eq("id", b.id);
      if (e2) throw e2;
    },
    onMutate: async ({ a, b }) => {
      await qc.cancelQueries({ queryKey: sessionKey });
      return optimistic((s) => {
        const exs = [...s.exercises];
        const ia = exs.findIndex((e) => e.id === a.id);
        const ib = exs.findIndex((e) => e.id === b.id);
        if (ia === -1 || ib === -1) return s;
        const newA = { ...exs[ia], position: exs[ib].position };
        const newB = { ...exs[ib], position: exs[ia].position };
        exs[ia] = newB;
        exs[ib] = newA;
        return { ...s, exercises: exs };
      });
    },
    onError: (_e, _v, ctx) => rollback(ctx),
    onSettled: markStaleBackground,
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
    onMutate: async (patch) => {
      await qc.cancelQueries({ queryKey: sessionKey });
      return optimistic((s) => ({ ...s, session: { ...s.session, ...patch } }));
    },
    onError: (_e, _v, ctx) => rollback(ctx),
    onSettled: markStaleBackground,
  });

  return {
    updateSet,
    addSet,
    deleteSet,
    addExercise,
    removeExercise,
    replaceExercise,
    reorder,
    updateSession,
  };
}
