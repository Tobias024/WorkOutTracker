"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { nanoid } from "nanoid";
import { createClient } from "@/lib/supabase/client";
import type { Routine, RoutineExercise } from "@/lib/types";

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
            .select("*")
            .eq("routine_id", id)
            .order("position"),
        ]);
      if (e1) throw e1;
      if (e2) throw e2;
      return {
        routine: routine as Routine,
        exercises: (exercises ?? []) as RoutineExercise[],
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
      const { error } = await supabase.from("routine_exercises").insert({
        routine_id: routineId,
        exercise_id: exerciseId,
        position,
        target_sets: 3,
        target_reps: 10,
      });
      if (error) throw error;
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

  return { add, update, remove, swap };
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
