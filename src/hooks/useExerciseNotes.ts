// SPDX-License-Identifier: AGPL-3.0-only
"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createClient } from "@/lib/supabase/client";

/**
 * Nota fija del usuario sobre un ejercicio, compartida entre TODAS sus rutinas
 * y sesiones (indexada por exercise_id). No se comparte al compartir la rutina.
 */
export function useExerciseNote(exerciseId?: string) {
  return useQuery({
    queryKey: ["exercise-note", exerciseId],
    enabled: !!exerciseId,
    staleTime: 1000 * 60,
    queryFn: async (): Promise<string> => {
      const supabase = createClient();
      const { data } = await supabase
        .from("user_exercise_notes")
        .select("note")
        .eq("exercise_id", exerciseId as string)
        .maybeSingle();
      return data?.note ?? "";
    },
  });
}

/**
 * Todas las notas del usuario, indexadas por `exercise_id`.
 *
 * `useExerciseNote` trae de a una porque la sesión muestra la del ejercicio
 * abierto. El export las necesita todas de una: son contexto que el usuario
 * escribió sobre cómo hace cada movimiento, y hasta ahora no salía del teléfono.
 */
export function useAllExerciseNotes() {
  return useQuery({
    queryKey: ["exercise-notes"],
    staleTime: 5 * 60_000,
    queryFn: async (): Promise<Map<string, string>> => {
      const supabase = createClient();
      const { data, error } = await supabase
        .from("user_exercise_notes")
        .select("exercise_id, note");
      if (error) throw error;
      return new Map(
        (data ?? []).map((r) => [r.exercise_id as string, r.note as string]),
      );
    },
  });
}

export function useUpsertExerciseNote() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({
      exerciseId,
      note,
    }: {
      exerciseId: string;
      note: string;
    }) => {
      const supabase = createClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) throw new Error("No autenticado");

      const trimmed = note.trim();
      if (trimmed === "") {
        // Nota vaciada → borra la fila para no dejar registros vacíos.
        const { error } = await supabase
          .from("user_exercise_notes")
          .delete()
          .eq("user_id", user.id)
          .eq("exercise_id", exerciseId);
        if (error) throw error;
        return "";
      }

      const { error } = await supabase.from("user_exercise_notes").upsert(
        { user_id: user.id, exercise_id: exerciseId, note: trimmed },
        { onConflict: "user_id,exercise_id" },
      );
      if (error) throw error;
      return trimmed;
    },
    onSuccess: (value, { exerciseId }) => {
      qc.setQueryData(["exercise-note", exerciseId], value);
      qc.invalidateQueries({ queryKey: ["exercise-notes"] });
    },
  });
}
