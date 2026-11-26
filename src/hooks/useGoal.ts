// SPDX-License-Identifier: AGPL-3.0-only
"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createClient, getUserId } from "@/lib/supabase/client";
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
      const uid = await getUserId();
      if (!uid) return { trainingProfile: null };
      const { data } = await supabase
        .from("profiles")
        .select("training_profile")
        .eq("id", uid)
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
      const uid = await getUserId();
      if (!uid) throw new Error("No autenticado");
      const { error } = await supabase
        .from("profiles")
        .update({
          training_profile: prefs.trainingProfile,
          goal: goalFromPrefs(prefs), // sincroniza el legacy para el scoreboard
        })
        .eq("id", uid);
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
      const uid = await getUserId();
      if (!uid) return null;
      const { data } = await supabase
        .from("profiles")
        .select("goal")
        .eq("id", uid)
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
      const uid = await getUserId();
      if (!uid) throw new Error("No autenticado");
      const { error } = await supabase
        .from("profiles")
        .update({ goal })
        .eq("id", uid);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["goal"] }),
  });
}
