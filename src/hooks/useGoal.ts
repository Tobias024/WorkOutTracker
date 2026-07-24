"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createClient } from "@/lib/supabase/client";
import type { Goal } from "@/lib/types";

/** Objetivo de entrenamiento del usuario (null = General). */
export function useGoal() {
  return useQuery({
    queryKey: ["goal"],
    queryFn: async (): Promise<Goal | null> => {
      const supabase = createClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) return null;
      const { data } = await supabase
        .from("profiles")
        .select("goal")
        .eq("id", user.id)
        .maybeSingle();
      return (data?.goal as Goal | null) ?? null;
    },
  });
}

export function useSetGoal() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (goal: Goal | null) => {
      const supabase = createClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) throw new Error("No autenticado");
      const { error } = await supabase
        .from("profiles")
        .update({ goal })
        .eq("id", user.id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["goal"] }),
  });
}
