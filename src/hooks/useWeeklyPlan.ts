// SPDX-License-Identifier: AGPL-3.0-only
"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createClient } from "@/lib/supabase/client";

/** Días de la semana que el usuario planea entrenar (0=domingo … 6=sábado). */
export function useWeeklyPlan() {
  return useQuery({
    queryKey: ["weekly-plan"],
    queryFn: async (): Promise<number[]> => {
      const supabase = createClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) return [];
      const { data, error } = await supabase
        .from("profiles")
        .select("planned_weekdays")
        .eq("id", user.id)
        .maybeSingle();
      if (error) throw error;
      return data?.planned_weekdays ?? [];
    },
  });
}

/** Fecha (ISO) desde la cual rige la meta de días prometidos (null si nunca se fijó). */
export function usePlannedSince() {
  return useQuery({
    queryKey: ["planned-since"],
    queryFn: async (): Promise<string | null> => {
      const supabase = createClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) return null;
      const { data } = await supabase
        .from("profiles")
        .select("planned_since")
        .eq("id", user.id)
        .maybeSingle();
      return data?.planned_since ?? null;
    },
  });
}

export function useSetWeeklyPlan() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (weekdays: number[]) => {
      const supabase = createClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) throw new Error("No autenticado");
      // Al cambiar la meta, la vigencia arranca ahora: los días previos no se
      // juzgan como fallados (nunca se prometieron).
      const { error } = await supabase
        .from("profiles")
        .update({
          planned_weekdays: [...weekdays].sort((a, b) => a - b),
          planned_since: new Date().toISOString(),
        })
        .eq("id", user.id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["weekly-plan"] });
      qc.invalidateQueries({ queryKey: ["planned-since"] });
    },
  });
}

export interface WeeklyPlanOverride {
  week_start: string; // "YYYY-MM-DD"
  weekdays: number[];
}

/** Excepciones al plan semanal por semana puntual (pisan la plantilla global
 *  de esa semana en adelante; las semanas sin excepción siguen la plantilla). */
export function useWeeklyPlanOverrides() {
  return useQuery({
    queryKey: ["weekly-plan-overrides"],
    queryFn: async (): Promise<WeeklyPlanOverride[]> => {
      const supabase = createClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) return [];
      const { data, error } = await supabase
        .from("weekly_plan_overrides")
        .select("week_start, weekdays")
        .eq("user_id", user.id);
      if (error) throw error;
      return data ?? [];
    },
  });
}

/** Crea o actualiza la excepción de una semana puntual (`weekStart` en formato
 *  "YYYY-MM-DD", el lunes de esa semana). */
export function useSetWeeklyPlanOverride() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({
      weekStart,
      weekdays,
    }: {
      weekStart: string;
      weekdays: number[];
    }) => {
      const supabase = createClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) throw new Error("No autenticado");
      const { error } = await supabase.from("weekly_plan_overrides").upsert(
        {
          user_id: user.id,
          week_start: weekStart,
          weekdays: [...weekdays].sort((a, b) => a - b),
        },
        { onConflict: "user_id,week_start" },
      );
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["weekly-plan-overrides"] }),
  });
}
