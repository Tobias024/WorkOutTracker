// SPDX-License-Identifier: AGPL-3.0-only
"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo } from "react";
import { nanoid } from "nanoid";
import { createClient } from "@/lib/supabase/client";
import type { Exercise, MetricKind } from "@/lib/types";

// Catálogo sin el array `instructions` (el más pesado y sólo lo usa el modal de
// detalle, que lo trae on-demand con useExerciseInstructions). Aliviana el fetch
// que alimenta a useExerciseMap, usado en muchas pantallas.
const LIST_COLUMNS =
  "id, slug, name, metric_kind, category, equipment, primary_muscles, secondary_muscles, mechanic, level, force, images, is_custom, created_by, created_at";

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

/** Datos mínimos para crear un ejercicio custom (los que alimentan los cálculos). */
export type NewExercise = {
  name: string;
  metric_kind: MetricKind;
  primary_muscles: string[]; // ≥1
  secondary_muscles: string[];
  mechanic: string; // compound | isolation
  force: string; // push | pull | static
  equipment: string | null;
  imageUrl: string | null;
  description: string | null;
};

function slugify(s: string): string {
  return (
    s
      .toLowerCase()
      .normalize("NFD")
      .replace(/[̀-ͯ]/g, "")
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 40) || "ex"
  );
}

/** Crea un ejercicio custom (is_custom=true, propio). Con la RLS global (0030)
 *  queda visible para todos. Devuelve el ejercicio creado para seleccionarlo. */
export function useCreateExercise() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (ex: NewExercise): Promise<Exercise> => {
      const supabase = createClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) throw new Error("No autenticado");
      const row = {
        slug: `${slugify(ex.name)}-${nanoid(6)}`,
        name: ex.name.trim(),
        metric_kind: ex.metric_kind,
        // La categoría se deriva del tipo de medición: antes estaba clavada en
        // "strength", así que era imposible crear un ejercicio de cardio.
        category: ex.metric_kind === "distance_time" ? "cardio" : "strength",
        equipment: ex.equipment,
        primary_muscles: ex.primary_muscles,
        secondary_muscles: ex.secondary_muscles,
        mechanic: ex.mechanic,
        level: null,
        force: ex.force,
        instructions: ex.description ? [ex.description] : [],
        images: ex.imageUrl ? [ex.imageUrl] : [],
        is_custom: true,
        created_by: user.id,
      };
      const { data, error } = await supabase
        .from("exercises")
        .insert(row)
        .select(LIST_COLUMNS)
        .single();
      if (error) throw error;
      return data as unknown as Exercise;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["exercises"] }),
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
