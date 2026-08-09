"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createClient } from "@/lib/supabase/client";
import type { SleepLog, BodyWeightLog, BodyMeasurement } from "@/lib/types";

/** Registros de sueño recientes (para la card Sueño). */
export function useSleep() {
  return useQuery({
    queryKey: ["sleep"],
    queryFn: async (): Promise<SleepLog[]> => {
      const supabase = createClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) return [];
      const { data } = await supabase
        .from("sleep_logs")
        .select("*")
        .order("slept_on", { ascending: true });
      return data ?? [];
    },
  });
}

export function useLogSleep() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ sleptOn, hours }: { sleptOn: string; hours: number }) => {
      const supabase = createClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) throw new Error("No autenticado");
      const { error } = await supabase
        .from("sleep_logs")
        .upsert(
          { user_id: user.id, slept_on: sleptOn, hours },
          { onConflict: "user_id,slept_on" },
        );
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["sleep"] }),
  });
}

/** Registros de peso corporal (para la card Peso y la tendencia). */
export function useBodyWeight() {
  return useQuery({
    queryKey: ["body-weight"],
    queryFn: async (): Promise<BodyWeightLog[]> => {
      const supabase = createClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) return [];
      const { data } = await supabase
        .from("body_weight_logs")
        .select("*")
        .order("weighed_on", { ascending: true });
      return data ?? [];
    },
  });
}

export function useLogBodyWeight() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({
      weighedOn,
      weightKg,
    }: {
      weighedOn: string;
      weightKg: number;
    }) => {
      const supabase = createClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) throw new Error("No autenticado");
      const { error } = await supabase
        .from("body_weight_logs")
        .upsert(
          { user_id: user.id, weighed_on: weighedOn, weight_kg: weightKg },
          { onConflict: "user_id,weighed_on" },
        );
      if (error) throw error;
      // El peso actual del perfil sigue a lo último registrado (una sola verdad).
      await supabase.from("profiles").update({ weight_kg: weightKg }).eq("id", user.id);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["body-weight"] });
      qc.invalidateQueries({ queryKey: ["last-bodyweight"] });
    },
  });
}

/** Medidas corporales (circunferencias). */
export function useMeasurements() {
  return useQuery({
    queryKey: ["measurements"],
    queryFn: async (): Promise<BodyMeasurement[]> => {
      const supabase = createClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) return [];
      const { data } = await supabase
        .from("body_measurements")
        .select("*")
        .order("measured_on", { ascending: true });
      return data ?? [];
    },
  });
}

export function useAddMeasurement() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (
      m: Omit<BodyMeasurement, "id" | "user_id" | "created_at">,
    ) => {
      const supabase = createClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) throw new Error("No autenticado");
      const { error } = await supabase
        .from("body_measurements")
        .insert({ ...m, user_id: user.id });
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["measurements"] }),
  });
}
