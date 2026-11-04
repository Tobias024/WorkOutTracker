// SPDX-License-Identifier: AGPL-3.0-only
import type { FullSession, SessionExercise } from "@/hooks/useWorkout";
import type { WorkoutSession, WorkoutSet } from "@/lib/types";

/**
 * Transformaciones puras sobre el cache de la sesión. Cada mutation optimista
 * aplica una y, si falla, aplica la inversa DIRIGIDA (solo lo que ella tocó):
 * restaurar un snapshot completo pisaría cambios optimistas de otras mutations
 * encoladas en el mismo scope.
 */

/** Valores previos de `keys` en `obj` (para revertir un patch parcial). */
function pick<T extends object>(obj: T, keys: (keyof T)[]): Partial<T> {
  const out: Partial<T> = {};
  for (const k of keys) out[k] = obj[k];
  return out;
}

// ---- sets ------------------------------------------------------------------

export function findSet(
  fs: FullSession,
  setId: string,
): { exerciseId: string; index: number; set: WorkoutSet } | undefined {
  for (const ex of fs.exercises) {
    const index = ex.sets.findIndex((s) => s.id === setId);
    if (index !== -1) return { exerciseId: ex.id, index, set: ex.sets[index] };
  }
  return undefined;
}

export function patchSet(
  fs: FullSession,
  setId: string,
  patch: Partial<WorkoutSet>,
): FullSession {
  return {
    ...fs,
    exercises: fs.exercises.map((ex) =>
      ex.sets.some((s) => s.id === setId)
        ? {
            ...ex,
            sets: ex.sets.map((s) => (s.id === setId ? { ...s, ...patch } : s)),
          }
        : ex,
    ),
  };
}

/** Valores actuales de las claves de `patch` en ese set; revert = patchSet(fs, id, esto). */
export function previousSetValues(
  fs: FullSession,
  setId: string,
  patch: Partial<WorkoutSet>,
): Partial<WorkoutSet> | undefined {
  const found = findSet(fs, setId);
  return found
    ? pick(found.set, Object.keys(patch) as (keyof WorkoutSet)[])
    : undefined;
}

/** Agrega al final de las series del ejercicio (no-op si ya existe). */
export function insertSet(
  fs: FullSession,
  exerciseId: string,
  set: WorkoutSet,
): FullSession {
  if (findSet(fs, set.id)) return fs;
  return {
    ...fs,
    exercises: fs.exercises.map((ex) =>
      ex.id === exerciseId ? { ...ex, sets: [...ex.sets, set] } : ex,
    ),
  };
}

export function removeSetById(fs: FullSession, setId: string): FullSession {
  if (!findSet(fs, setId)) return fs;
  return {
    ...fs,
    exercises: fs.exercises.map((ex) =>
      ex.sets.some((s) => s.id === setId)
        ? { ...ex, sets: ex.sets.filter((s) => s.id !== setId) }
        : ex,
    ),
  };
}

/** Reinserta una serie borrada en su índice original (no-op si ya está). */
export function reinsertSet(
  fs: FullSession,
  exerciseId: string,
  index: number,
  set: WorkoutSet,
): FullSession {
  if (findSet(fs, set.id)) return fs;
  return {
    ...fs,
    exercises: fs.exercises.map((ex) => {
      if (ex.id !== exerciseId) return ex;
      const sets = [...ex.sets];
      sets.splice(Math.min(index, sets.length), 0, set);
      return { ...ex, sets };
    }),
  };
}

/** Serie vacía con los defaults de una serie agregada durante el entreno. */
export function makeSet(
  base: Pick<WorkoutSet, "id" | "workout_exercise_id" | "set_number"> &
    Partial<
      Pick<WorkoutSet, "reps" | "weight" | "duration_seconds" | "distance_m">
    >,
): WorkoutSet {
  return {
    reps: null,
    weight: null,
    duration_seconds: null,
    distance_m: null,
    rpe: null,
    comment: null,
    is_warmup: false,
    completed: false,
    completed_at: null,
    rest_seconds: null,
    drops: null,
    // Una serie agregada durante el entreno no sale de la rutina: no tiene
    // plan contra el cual compararse, y por eso no se colorea.
    planned_reps: null,
    planned_weight: null,
    planned_duration_seconds: null,
    planned_distance_m: null,
    ...base,
  };
}

// ---- ejercicios ------------------------------------------------------------

export function findExercise(
  fs: FullSession,
  exerciseId: string,
): { index: number; exercise: SessionExercise } | undefined {
  const index = fs.exercises.findIndex((e) => e.id === exerciseId);
  return index === -1 ? undefined : { index, exercise: fs.exercises[index] };
}

export function insertExercise(
  fs: FullSession,
  exercise: SessionExercise,
): FullSession {
  if (findExercise(fs, exercise.id)) return fs;
  return { ...fs, exercises: [...fs.exercises, exercise] };
}

export function removeExerciseById(
  fs: FullSession,
  exerciseId: string,
): FullSession {
  if (!findExercise(fs, exerciseId)) return fs;
  return { ...fs, exercises: fs.exercises.filter((e) => e.id !== exerciseId) };
}

export function reinsertExercise(
  fs: FullSession,
  index: number,
  exercise: SessionExercise,
): FullSession {
  if (findExercise(fs, exercise.id)) return fs;
  const exercises = [...fs.exercises];
  exercises.splice(Math.min(index, exercises.length), 0, exercise);
  return { ...fs, exercises };
}

type ExercisePatch = Pick<
  SessionExercise,
  "exercise_id" | "replaced_from_exercise_id"
>;

export function patchExercise(
  fs: FullSession,
  exerciseId: string,
  patch: Partial<ExercisePatch>,
): FullSession {
  return {
    ...fs,
    exercises: fs.exercises.map((ex) =>
      ex.id === exerciseId ? { ...ex, ...patch } : ex,
    ),
  };
}

export function previousExerciseValues(
  fs: FullSession,
  exerciseId: string,
  keys: (keyof ExercisePatch)[],
): Partial<ExercisePatch> | undefined {
  const found = findExercise(fs, exerciseId);
  return found ? pick(found.exercise, keys) : undefined;
}

/**
 * Intercambia de lugar (y de `position`) dos ejercicios. Es su propia inversa:
 * aplicarlo de nuevo con los mismos ids deshace el swap.
 */
export function swapExercises(
  fs: FullSession,
  aId: string,
  bId: string,
): FullSession {
  const exs = [...fs.exercises];
  const ia = exs.findIndex((e) => e.id === aId);
  const ib = exs.findIndex((e) => e.id === bId);
  if (ia === -1 || ib === -1) return fs;
  const newA = { ...exs[ia], position: exs[ib].position };
  const newB = { ...exs[ib], position: exs[ia].position };
  exs[ia] = newB;
  exs[ib] = newA;
  return { ...fs, exercises: exs };
}

// ---- sesión ----------------------------------------------------------------

export function patchSession(
  fs: FullSession,
  patch: Partial<WorkoutSession>,
): FullSession {
  return { ...fs, session: { ...fs.session, ...patch } };
}

export function previousSessionValues(
  fs: FullSession,
  patch: Partial<WorkoutSession>,
): Partial<WorkoutSession> {
  return pick(fs.session, Object.keys(patch) as (keyof WorkoutSession)[]);
}
