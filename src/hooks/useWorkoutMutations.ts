// SPDX-License-Identifier: AGPL-3.0-only
"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { createClient, getUserId } from "@/lib/supabase/client";
import type { FullSession } from "@/hooks/useWorkout";
import type { WorkoutSession, WorkoutSet } from "@/lib/types";
import {
  findExercise,
  findSet,
  insertExercise,
  insertSet,
  makeSet,
  patchExercise,
  patchSession,
  patchSet,
  previousExerciseValues,
  previousSessionValues,
  previousSetValues,
  reinsertExercise,
  reinsertSet,
  removeExerciseById,
  removeSetById,
  swapExercises,
} from "@/lib/session-cache";

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
  // Todas las mutations de la sesión comparten scope: TanStack las ejecuta de a
  // una, en orden de creación (insert -> patch/delete de la misma serie;
  // updateSession al final). onMutate corre igual de inmediato.
  const scope = { id: `session-${sessionId}` };

  /** Aplica una transformación pura sobre el cache actual (si existe). */
  function apply(fn: (s: FullSession) => FullSession) {
    qc.setQueryData<FullSession>(sessionKey, (s) => (s ? fn(s) : s));
  }
  /** Lee el cache actual (para capturar valores previos antes de aplicar). */
  const current = () => qc.getQueryData<FullSession>(sessionKey);

  /** 23505 = unique_violation: el id ya existe (reintento cuya respuesta se perdió). */
  const isDuplicate = (e: { code?: string } | null) => e?.code === "23505";

  const updateSet = useMutation({
    scope,
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
      const cur = current();
      const prevValues = cur ? previousSetValues(cur, id, patch) : undefined;
      apply((s) => patchSet(s, id, patch));
      return { prevValues };
    },
    onError: (_e, { id }, ctx) => {
      if (ctx?.prevValues) apply((s) => patchSet(s, id, ctx.prevValues!));
    },
    // Sin refetch de la sesión: el optimistic ya es correcto para un patch.
    onSettled: markStaleBackground,
  });

  const addSet = useMutation({
    scope,
    mutationFn: async ({
      id,
      workoutExerciseId,
      setNumber,
      reps,
      weight,
      durationSeconds,
      distanceM,
    }: {
      id: string;
      workoutExerciseId: string;
      setNumber: number;
      reps?: number | null;
      weight?: number | null;
      durationSeconds?: number | null;
      distanceM?: number | null;
    }) => {
      const supabase = createClient();
      const { error } = await supabase.from("workout_sets").insert({
        id,
        workout_exercise_id: workoutExerciseId,
        set_number: setNumber,
        reps: reps ?? null,
        weight: weight ?? null,
        duration_seconds: durationSeconds ?? null,
        distance_m: distanceM ?? null,
      });
      if (error && !isDuplicate(error)) throw error;
    },
    onMutate: async ({
      id,
      workoutExerciseId,
      setNumber,
      reps,
      weight,
      durationSeconds,
      distanceM,
    }) => {
      await qc.cancelQueries({ queryKey: sessionKey });
      const newSet = makeSet({
        id,
        workout_exercise_id: workoutExerciseId,
        set_number: setNumber,
        reps: reps ?? null,
        weight: weight ?? null,
        duration_seconds: durationSeconds ?? null,
        distance_m: distanceM ?? null,
      });
      apply((s) => insertSet(s, workoutExerciseId, newSet));
    },
    onError: (_e, { id }) => apply((s) => removeSetById(s, id)),
    onSettled: markStaleBackground,
  });

  const deleteSet = useMutation({
    scope,
    mutationFn: async (id: string) => {
      const supabase = createClient();
      const { error } = await supabase.from("workout_sets").delete().eq("id", id);
      if (error) throw error;
    },
    onMutate: async (id) => {
      await qc.cancelQueries({ queryKey: sessionKey });
      const cur = current();
      const removed = cur ? findSet(cur, id) : undefined;
      apply((s) => removeSetById(s, id));
      return { removed };
    },
    onError: (_e, _id, ctx) => {
      const r = ctx?.removed;
      if (r) apply((s) => reinsertSet(s, r.exerciseId, r.index, r.set));
    },
    onSettled: markStaleBackground,
  });

  const addExercise = useMutation({
    scope,
    mutationFn: async ({
      id,
      setIds,
      exerciseId,
      position,
    }: {
      id: string;
      setIds: string[];
      exerciseId: string;
      position: number;
    }) => {
      const supabase = createClient();
      const { error } = await supabase.from("workout_exercises").insert({
        id,
        session_id: sessionId,
        exercise_id: exerciseId,
        position,
      });
      if (error && !isDuplicate(error)) throw error;
      const { error: setsError } = await supabase.from("workout_sets").insert(
        setIds.map((setId, i) => ({
          id: setId,
          workout_exercise_id: id,
          set_number: i + 1,
        })),
      );
      if (setsError && !isDuplicate(setsError)) throw setsError;
    },
    onMutate: async ({ id, setIds, exerciseId, position }) => {
      await qc.cancelQueries({ queryKey: sessionKey });
      apply((s) =>
        insertExercise(s, {
          id,
          session_id: sessionId,
          exercise_id: exerciseId,
          position,
          routine_exercise_id: null,
          replaced_from_exercise_id: null,
          notes: null,
          sets: setIds.map((setId, i) =>
            makeSet({ id: setId, workout_exercise_id: id, set_number: i + 1 }),
          ),
        }),
      );
    },
    onError: (_e, { id }) => apply((s) => removeExerciseById(s, id)),
    onSettled: markStaleBackground,
  });

  const removeExercise = useMutation({
    scope,
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
      const cur = current();
      const removed = cur ? findExercise(cur, workoutExerciseId) : undefined;
      apply((s) => removeExerciseById(s, workoutExerciseId));
      return { removed };
    },
    onError: (_e, _id, ctx) => {
      const r = ctx?.removed;
      if (r) apply((s) => reinsertExercise(s, r.index, r.exercise));
    },
    onSettled: markStaleBackground,
  });

  /**
   * Reemplaza el ejercicio de un workout_exercise.
   * saveForFuture=true guarda la sustitución para próximas veces (si viene de una rutina).
   */
  const replaceExercise = useMutation({
    scope,
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
      const userId = await getUserId();

      const { error } = await supabase
        .from("workout_exercises")
        .update({
          exercise_id: newExerciseId,
          replaced_from_exercise_id: originalExerciseId,
        })
        .eq("id", workoutExerciseId);
      if (error) throw error;

      if (saveForFuture && routineExerciseId && userId) {
        const { error: subError } = await supabase
          .from("exercise_substitutions")
          .upsert(
          {
            user_id: userId,
            routine_exercise_id: routineExerciseId,
            substitute_exercise_id: newExerciseId,
          },
          { onConflict: "user_id,routine_exercise_id" },
        );
        if (subError) throw subError;
      }
    },
    // Optimista: la card cambia de ejercicio al toque; si falla vuelve el snapshot.
    onMutate: async ({
      workoutExerciseId,
      originalExerciseId,
      newExerciseId,
    }) => {
      await qc.cancelQueries({ queryKey: sessionKey });
      const patch = {
        exercise_id: newExerciseId,
        replaced_from_exercise_id: originalExerciseId,
      };
      const cur = current();
      const prevValues = cur
        ? previousExerciseValues(cur, workoutExerciseId, [
            "exercise_id",
            "replaced_from_exercise_id",
          ])
        : undefined;
      apply((s) => patchExercise(s, workoutExerciseId, patch));
      return { prevValues };
    },
    onError: (_e, { workoutExerciseId }, ctx) => {
      if (ctx?.prevValues)
        apply((s) => patchExercise(s, workoutExerciseId, ctx.prevValues!));
    },
    onSettled: markStaleBackground,
  });

  /**
   * Reordena dos ejercicios de la sesión intercambiando su `position`
   * (dos updates, como el swap de rutinas) y el lugar en el cache de forma
   * optimista. `position` es un entero arbitrario para ORDER BY, así que el
   * swap por valor es robusto aunque no sea contiguo.
   */
  const reorder = useMutation({
    scope,
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
      apply((s) => swapExercises(s, a.id, b.id));
    },
    onError: (_e, { a, b }) => apply((s) => swapExercises(s, a.id, b.id)),
    onSettled: markStaleBackground,
  });

  const updateSession = useMutation({
    scope,
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
      const cur = current();
      const prevValues = cur ? previousSessionValues(cur, patch) : undefined;
      apply((s) => patchSession(s, patch));
      return { prevValues };
    },
    onError: (_e, _patch, ctx) => {
      if (ctx?.prevValues) apply((s) => patchSession(s, ctx.prevValues!));
    },
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
