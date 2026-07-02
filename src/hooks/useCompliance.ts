"use client";

import { useQuery } from "@tanstack/react-query";
import { createClient } from "@/lib/supabase/client";
import { dateKey } from "@/lib/metrics";
import type { ComplianceStats } from "@/lib/types";

export function useCompliance(from: Date, to: Date) {
  const fromKey = dateKey(from.toISOString());
  const toKey = dateKey(to.toISOString());
  return useQuery({
    queryKey: ["compliance", fromKey, toKey],
    queryFn: async (): Promise<ComplianceStats> => {
      const supabase = createClient();
      const { data, error } = await supabase.rpc("compliance_stats", {
        p_from: fromKey,
        p_to: toKey,
      });
      if (error) throw error;
      return (
        (data as ComplianceStats[])[0] ?? {
          planned_days: 0,
          completed_days: 0,
          pct: 0,
        }
      );
    },
  });
}
