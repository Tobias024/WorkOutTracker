"use client";

import { useQuery } from "@tanstack/react-query";
import { useMemo } from "react";
import { createClient } from "@/lib/supabase/client";
import type { Exercise } from "@/lib/types";

/** Catálogo completo (cacheado largo: cambia poco). */
export function useExercises() {
  return useQuery({
    queryKey: ["exercises"],
    staleTime: 1000 * 60 * 60,
    queryFn: async (): Promise<Exercise[]> => {
      const supabase = createClient();
      const { data, error } = await supabase
        .from("exercises")
        .select("*")
        .order("name");
      if (error) throw error;
      return data ?? [];
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
