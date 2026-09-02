// SPDX-License-Identifier: AGPL-3.0-only
"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createClient } from "@/lib/supabase/client";
import type { Goal, TrainingProfile } from "@/lib/types";

export type TrainingPrefs = {
  trainingProfile: TrainingProfile | null;
};

/** goal (deprecado) derivado del perfil, para el scoreboard. */
export function goalFromPrefs(p: TrainingPrefs): Goal | null {
  return p.trainingProfile;
}

/** Perfil de entrenamiento del usuario. */
export function useTrainingProfile() {
  return useQuery({
    queryKey: ["training-profile"],
    queryFn: async (): Promise<TrainingPrefs> => {
      const supabase = createClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) return { trainingProfile: null };
      const { data } = await supabase
        .from("profiles")
        .select("training_profile")
        .eq("id", user.id)
        .maybeSingle();
      return {
        trainingProfile: (data?.training_profile as TrainingProfile | null) ?? null,
      };
    },
  });
}

export function useSetTrainingProfile() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (prefs: TrainingPrefs) => {
      const supabase = createClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) throw new Error("No autenticado");
      const { error } = await supabase
        .from("profiles")
        .update({
          training_profile: prefs.trainingProfile,
          goal: goalFromPrefs(prefs), // sincroniza el legacy para el scoreboard
        })
        .eq("id", user.id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["training-profile"] });
      qc.invalidateQueries({ queryKey: ["goal"] });
    },
  });
}

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
