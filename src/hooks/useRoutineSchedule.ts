"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createClient } from "@/lib/supabase/client";
import type { RoutineScheduleEntry } from "@/lib/types";

export function useRoutineSchedule(routineId: string) {
  return useQuery({
    queryKey: ["routine-schedule", routineId],
    queryFn: async (): Promise<number[]> => {
      const supabase = createClient();
      const { data, error } = await supabase
        .from("routine_schedule")
        .select("weekday")
        .eq("routine_id", routineId);
      if (error) throw error;
      return (data ?? []).map((r: Pick<RoutineScheduleEntry, "weekday">) => r.weekday);
    },
  });
}

/** Reemplaza por completo los días planificados de una rutina. */
export function useSetRoutineSchedule(routineId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (weekdays: number[]) => {
      const supabase = createClient();
      const { error: delError } = await supabase
        .from("routine_schedule")
        .delete()
        .eq("routine_id", routineId);
      if (delError) throw delError;
      if (weekdays.length === 0) return;
      const { error: insError } = await supabase.from("routine_schedule").insert(
        weekdays.map((weekday) => ({ routine_id: routineId, weekday })),
      );
      if (insError) throw insError;
    },
    onSuccess: () =>
      qc.invalidateQueries({ queryKey: ["routine-schedule", routineId] }),
  });
}
