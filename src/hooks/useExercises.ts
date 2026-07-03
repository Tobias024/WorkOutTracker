"use client";

import { useQuery } from "@tanstack/react-query";
import { useMemo } from "react";
import { createClient } from "@/lib/supabase/client";
import type { Exercise } from "@/lib/types";

// Catálogo sin el array `instructions` (el más pesado y sólo lo usa el modal de
// detalle, que lo trae on-demand con useExerciseInstructions). Aliviana el fetch
// que alimenta a useExerciseMap, usado en muchas pantallas.
const LIST_COLUMNS =
  "id, slug, name, category, equipment, primary_muscles, secondary_muscles, mechanic, level, force, images, is_custom, created_by, created_at";

/** Catálogo completo (cacheado largo: cambia poco). Sin `instructions`. */
export function useExercises() {
  return useQuery({
    queryKey: ["exercises"],
    staleTime: 1000 * 60 * 60,
    queryFn: async (): Promise<Exercise[]> => {
      const supabase = createClient();
      const { data, error } = await supabase
        .from("exercises")
        .select(LIST_COLUMNS)
        .order("name");
      if (error) throw error;
      return (data ?? []) as unknown as Exercise[];
    },
  });
}

/** Instrucciones de un ejercicio, on-demand (para el modal de detalle). */
export function useExerciseInstructions(exerciseId?: string) {
  return useQuery({
    queryKey: ["exercise-instructions", exerciseId],
    enabled: !!exerciseId,
    staleTime: 1000 * 60 * 60,
    queryFn: async (): Promise<string[]> => {
      const supabase = createClient();
      const { data, error } = await supabase
        .from("exercises")
        .select("instructions")
        .eq("id", exerciseId as string)
        .single();
      if (error) throw error;
      return data?.instructions ?? [];
    },
  });
}

export function useExerciseMap() {
  const { data } = useExercises();
  return useMemo(() => {
    const map = new Map<string, Exercise>();
    (data ?? []).forEach((e) => map.set(e.id, e));
    return map;
  }, [data]);
}

/** Filtra el catálogo en memoria por texto / músculo / equipo. */
export function filterExercises(
  list: Exercise[],
  query: string,
  muscle?: string,
  equipment?: string,
): Exercise[] {
  const q = query.trim().toLowerCase();
  return list.filter((e) => {
    if (q && !e.name.toLowerCase().includes(q)) return false;
    if (muscle && !e.primary_muscles.includes(muscle)) return false;
    if (equipment && e.equipment !== equipment) return false;
    return true;
  });
}
