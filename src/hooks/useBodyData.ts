"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createClient } from "@/lib/supabase/client";
import type { SleepLog, BodyMeasurement } from "@/lib/types";

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
      const since = new Date(Date.now() - 30 * 86400000)
        .toISOString()
        .slice(0, 10);
      const { data } = await supabase
        .from("sleep_logs")
        .select("*")
        .gte("slept_on", since)
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
