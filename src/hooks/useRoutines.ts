"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { nanoid } from "nanoid";
import { createClient } from "@/lib/supabase/client";
import type { Routine, RoutineExercise, RoutineSet } from "@/lib/types";

export type RoutineExerciseWithSets = RoutineExercise & { sets: RoutineSet[] };

/** Objetivo planeado de una serie (sin id). */
export type SetPlan = { target_reps: number | null; target_weight: number | null };

export function useRoutines() {
  return useQuery({
    queryKey: ["routines"],
    queryFn: async (): Promise<Routine[]> => {
      const supabase = createClient();
      const { data, error } = await supabase
        .from("routines")
        .select("*")
        .order("updated_at", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });
}

export function useRoutine(id: string) {
  return useQuery({
    queryKey: ["routine", id],
    queryFn: async () => {
      const supabase = createClient();
      const [{ data: routine, error: e1 }, { data: exercises, error: e2 }] =
        await Promise.all([
          supabase.from("routines").select("*").eq("id", id).single(),
          supabase
            .from("routine_exercises")
            .select("*, routine_sets(*)")
            .eq("routine_id", id)
            .order("position"),
        ]);
      if (e1) throw e1;
      if (e2) throw e2;

      const rows = (exercises ?? []) as unknown as (RoutineExercise & {
        routine_sets: RoutineSet[];
      })[];
      const mapped: RoutineExerciseWithSets[] = rows.map((e) => {
        const { routine_sets, ...rex } = e;
        return {
          ...rex,
          sets: (routine_sets ?? []).sort(
            (a, b) => a.set_number - b.set_number,
          ),
        };
      });

      return {
        routine: routine as Routine,
        exercises: mapped,
      };
    },
  });
}

export function useCreateRoutine() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (name: string): Promise<Routine> => {
      const supabase = createClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) throw new Error("No autenticado");
      const { data, error } = await supabase
        .from("routines")
        .insert({ name, owner_id: user.id })
        .select()
        .single();
      if (error) throw error;
      return data as Routine;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["routines"] }),
  });
}

export function useDeleteRoutine() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const supabase = createClient();
      const { error } = await supabase.from("routines").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["routines"] }),
  });
}

export function useUpdateRoutine(id: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (patch: Partial<Routine>) => {
      const supabase = createClient();
      const { error } = await supabase
        .from("routines")
        .update(patch)
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["routine", id] });
      qc.invalidateQueries({ queryKey: ["routines"] });
    },
  });
}

/** Operaciones sobre los ejercicios de una rutina. */
export function useRoutineExerciseOps(routineId: string) {
  const qc = useQueryClient();
  const invalidate = () =>
    qc.invalidateQueries({ queryKey: ["routine", routineId] });

  const add = useMutation({
    mutationFn: async ({
      exerciseId,
      position,
    }: {
      exerciseId: string;
      position: number;
    }) => {
      const supabase = createClient();
      const { data: rex, error } = await supabase
        .from("routine_exercises")
        .insert({
          routine_id: routineId,
          exercise_id: exerciseId,
          position,
          target_sets: 3,
          target_reps: 10,
        })
        .select()
        .single();
      if (error) throw error;
      // Series planeadas por defecto: 3×10 sin peso.
      const { error: e2 } = await supabase.from("routine_sets").insert(
        [1, 2, 3].map((n) => ({
          routine_exercise_id: rex.id,
          set_number: n,
          target_reps: 10,
        })),
      );
      if (e2) throw e2;
    },
    onSuccess: invalidate,
  });

  /**
   * Reemplaza el plan de series de un ejercicio. Mantiene set_number contiguo
   * (1..N) vía upsert + borrado del sobrante, y sincroniza target_sets/reps
   * en routine_exercises (que siguen usándose para la vista previa al
   * compartir).
   */
  const saveSets = useMutation({
    mutationFn: async ({
      rexId,
      plans,
    }: {
      rexId: string;
      plans: SetPlan[];
    }) => {
      const supabase = createClient();
      const list = plans.length ? plans : [{ target_reps: null, target_weight: null }];

      const { error: e1 } = await supabase.from("routine_sets").upsert(
        list.map((p, i) => ({
          routine_exercise_id: rexId,
          set_number: i + 1,
          target_reps: p.target_reps,
          target_weight: p.target_weight,
        })),
        { onConflict: "routine_exercise_id,set_number" },
      );
      if (e1) throw e1;

      const { error: e2 } = await supabase
        .from("routine_sets")
        .delete()
        .eq("routine_exercise_id", rexId)
        .gt("set_number", list.length);
      if (e2) throw e2;

      const { error: e3 } = await supabase
        .from("routine_exercises")
        .update({ target_sets: list.length, target_reps: list[0].target_reps })
        .eq("id", rexId);
      if (e3) throw e3;
    },
    onSuccess: invalidate,
  });

  const update = useMutation({
    mutationFn: async ({
      id,
      patch,
    }: {
      id: string;
      patch: Partial<RoutineExercise>;
    }) => {
      const supabase = createClient();
      const { error } = await supabase
        .from("routine_exercises")
        .update(patch)
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: invalidate,
  });

  const remove = useMutation({
    mutationFn: async (id: string) => {
      const supabase = createClient();
      const { error } = await supabase
        .from("routine_exercises")
        .delete()
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: invalidate,
  });

  /** Intercambia la posición de dos ejercicios. */
  const swap = useMutation({
    mutationFn: async ({
      a,
      b,
    }: {
      a: RoutineExercise;
      b: RoutineExercise;
    }) => {
      const supabase = createClient();
      await supabase
        .from("routine_exercises")
        .update({ position: b.position })
        .eq("id", a.id);
      await supabase
        .from("routine_exercises")
        .update({ position: a.position })
        .eq("id", b.id);
    },
    onSuccess: invalidate,
  });

  return { add, update, remove, swap, saveSets };
}

/**
 * Asegura un share_code para cada rutina dada y devuelve los códigos en el
 * mismo orden. Reutiliza la lógica de useShareRoutine para compartir en tanda.
 */
export function useEnsureShareCodes() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (routines: Routine[]): Promise<string[]> => {
      const supabase = createClient();
      const codes: string[] = [];
      const updates: Promise<void>[] = [];
      for (const r of routines) {
        if (r.share_code) {
          codes.push(r.share_code);
          continue;
        }
        const code = nanoid(10);
        codes.push(code);
        updates.push(
          (async () => {
            const { error } = await supabase
              .from("routines")
              .update({ share_code: code })
              .eq("id", r.id);
            if (error) throw error;
          })(),
        );
      }
      await Promise.all(updates);
      return codes;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["routines"] }),
  });
}

/** Genera (o devuelve) el share_code de una rutina. */
export function useShareRoutine() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (routine: Routine): Promise<string> => {
      if (routine.share_code) return routine.share_code;
      const supabase = createClient();
      const code = nanoid(10);
      const { error } = await supabase
        .from("routines")
        .update({ share_code: code })
        .eq("id", routine.id);
      if (error) throw error;
      return code;
    },
    onSuccess: (_code, routine) => {
      qc.invalidateQueries({ queryKey: ["routine", routine.id] });
      qc.invalidateQueries({ queryKey: ["routines"] });
    },
  });
}
