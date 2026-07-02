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

export function useSetWeeklyPlan() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (weekdays: number[]) => {
      const supabase = createClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) throw new Error("No autenticado");
      const { error } = await supabase
        .from("profiles")
        .update({ planned_weekdays: [...weekdays].sort((a, b) => a - b) })
        .eq("id", user.id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["weekly-plan"] }),
  });
}
