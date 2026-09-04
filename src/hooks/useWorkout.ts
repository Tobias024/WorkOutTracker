// SPDX-License-Identifier: AGPL-3.0-only
"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createClient } from "@/lib/supabase/client";
import type {
  WorkoutSession,
  WorkoutExercise,
  WorkoutSet,
  SetDrop,
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
            .select("*, routine_sets(*)")
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

        // Usa el plan por serie (reps + peso) si existe; si no, cae a los
        // valores "flat" target_sets/target_reps.
        const planned = (
          (rex as unknown as {
            routine_sets?: {
              set_number: number;
              target_reps: number | null;
              target_weight: number | null;
              target_duration_seconds: number | null;
              target_distance_m: number | null;
            }[];
          }).routine_sets ?? []
        ).sort((a, b) => a.set_number - b.set_number);

        // El plan va a las columnas planned_*, NO a reps/weight: la serie nace
        // vacía y lo que quede en reps/weight es siempre lo que el usuario
        // registró. Así el plan sigue disponible como referencia toda la sesión
        // (antes se pisaba al primer tecleo) y se puede comparar contra él.
        const sets =
          planned.length > 0
            ? planned.map((p, i) => ({
                workout_exercise_id: we!.id,
                set_number: i + 1,
                reps: null,
                weight: null,
                duration_seconds: null,
                distance_m: null,
                planned_reps: p.target_reps,
                planned_weight: p.target_weight,
                planned_duration_seconds: p.target_duration_seconds,
                planned_distance_m: p.target_distance_m,
              }))
            : Array.from({ length: Math.max(1, rex.target_sets ?? 3) }, (_, i) => ({
                workout_exercise_id: we!.id,
                set_number: i + 1,
                reps: null,
                weight: null,
                duration_seconds: null,
                distance_m: null,
                planned_reps: rex.target_reps,
                planned_weight: null,
                planned_duration_seconds: null,
                planned_distance_m: null,
              }));
        await supabase.from("workout_sets").insert(sets);
      }

      qc.invalidateQueries({ queryKey: ["history"] });
      qc.invalidateQueries({ queryKey: ["active-session"] });
      rememberActiveSession(session.id);
      return session.id;
    },
  });
}

/** Crea una sesión vacía (entrenamiento libre). */
export function useStartEmptyWorkout() {
  const qc = useQueryClient();
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
      rememberActiveSession(data.id);
      return data.id;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["history"] });
      qc.invalidateQueries({ queryKey: ["active-session"] });
    },
  });
}

/** Último peso corporal registrado en una sesión (para prefill del input). */
export function useLastBodyWeight() {
  return useQuery({
    queryKey: ["last-bodyweight"],
    queryFn: async (): Promise<number | null> => {
      const supabase = createClient();
      const { data } = await supabase
        .from("workout_sessions")
        .select("body_weight_kg")
        .not("body_weight_kg", "is", null)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      return data?.body_weight_kg ?? null;
    },
  });
}

/** Registro por serie (peso/reps + bajadas) de un ejercicio en una sesión previa. */
export interface LastExerciseLog {
  sets: {
    set_number: number;
    weight: number | null;
    reps: number | null;
    drops: SetDrop[] | null;
    duration_seconds: number | null;
    distance_m: number | null;
  }[];
}

/**
 * Último peso/reps registrado por serie para cada ejercicio, tomado de la
 * sesión FINALIZADA más reciente en la que aparece (por `exercise_id`, así se
 * comparte entre rutinas). Se usa como placeholder "ghost" al entrenar: si
 * repetís el mismo peso, no tenés que cambiar nada. Nunca se comparte al
 * compartir una rutina (son datos propios del historial).
 */
export function useLastExerciseLogs(
  exerciseIds: string[],
  excludeSessionId?: string,
) {
  const ids = [...new Set(exerciseIds)].sort();
  return useQuery({
    queryKey: ["last-exercise-logs", ids, excludeSessionId ?? null],
    enabled: ids.length > 0,
    queryFn: async (): Promise<Map<string, LastExerciseLog>> => {
      const supabase = createClient();
      const { data } = await supabase
        .from("workout_exercises")
        .select(
          "exercise_id, session_id, workout_sessions!inner(started_at, ended_at), workout_sets(set_number, weight, reps, is_warmup, drops, duration_seconds, distance_m)",
        )
        .in("exercise_id", ids);

      type Row = {
        exercise_id: string;
        session_id: string;
        workout_sessions: { started_at: string | null; ended_at: string | null };
        workout_sets: {
          set_number: number;
          weight: number | null;
          reps: number | null;
          is_warmup: boolean;
          drops: SetDrop[] | null;
          duration_seconds: number | null;
          distance_m: number | null;
        }[];
      };
      const rows = (data ?? []) as unknown as Row[];
      // Más reciente primero (por inicio de la sesión).
      rows.sort((a, b) =>
        (b.workout_sessions?.started_at ?? "").localeCompare(
          a.workout_sessions?.started_at ?? "",
        ),
      );

      const out = new Map<string, LastExerciseLog>();
      for (const r of rows) {
        if (out.has(r.exercise_id)) continue; // ya tenemos el más reciente
        if (!r.workout_sessions?.ended_at) continue; // sólo sesiones terminadas
        if (excludeSessionId && r.session_id === excludeSessionId) continue;
        const sets = (r.workout_sets ?? [])
          // Sin duración/distancia acá, una serie por tiempo o por km quedaba
          // descartada y el ejercicio nunca mostraba fantasma.
          .filter(
            (s) =>
              !s.is_warmup &&
              (s.weight != null ||
                s.reps != null ||
                s.duration_seconds != null ||
                s.distance_m != null),
          )
          .sort((a, b) => a.set_number - b.set_number)
          .map((s) => ({
            set_number: s.set_number,
            weight: s.weight,
            reps: s.reps,
            drops: s.drops,
            duration_seconds: s.duration_seconds,
            distance_m: s.distance_m,
          }));
        if (sets.length === 0) continue;
        out.set(r.exercise_id, { sets });
      }
      return out;
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

/** Id de la sesión en curso (sin finalizar), o null. Para el candado de sesión. */
/** Clave del fallback local de sesión activa (para que el candado bloquee aún
 *  sin red, cuando la query no puede consultar la DB). */
export const ACTIVE_SESSION_KEY = "wot-active-session";

export function rememberActiveSession(id: string | null) {
  try {
    if (id) localStorage.setItem(ACTIVE_SESSION_KEY, id);
    else localStorage.removeItem(ACTIVE_SESSION_KEY);
  } catch {
    // localStorage no disponible: no pasa nada, la query sigue siendo la fuente.
  }
}

export function useActiveSession() {
  return useQuery({
    queryKey: ["active-session"],
    staleTime: 30_000,
    queryFn: async (): Promise<string | null> => {
      const supabase = createClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) return null;
      const { data, error } = await supabase
        .from("workout_sessions")
        .select("id")
        .eq("user_id", user.id)
        .is("ended_at", null)
        .order("started_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      // IMPORTANTE: propagar el error (offline/token) en vez de tragarlo como
      // "no hay sesión" — así el guard sabe distinguir y usa el fallback local.
      if (error) throw error;
      const id = data?.id ?? null;
      rememberActiveSession(id); // mantiene el fallback en sync cuando hay red
      return id;
    },
  });
}

/**
 * Borra una sesión (y por cascade sus ejercicios/series). Lo usan el historial
 * (#3) y el "Descartar" de una sesión activa (#1). Los logros huérfanos no se
 * tocan (la RLS de achievements no permite delete desde el cliente).
 */
export function useDeleteSession() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (sessionId: string) => {
      const supabase = createClient();
      const { error } = await supabase
        .from("workout_sessions")
        .delete()
        .eq("id", sessionId);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["history"] });
      qc.invalidateQueries({ queryKey: ["scoreboard"] });
      qc.invalidateQueries({ queryKey: ["achievements"] });
      // Se borró la sesión (activa al descartar): soltamos el candado ya.
      qc.setQueryData(["active-session"], null);
    },
  });
}
