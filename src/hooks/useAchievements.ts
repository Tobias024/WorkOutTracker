// SPDX-License-Identifier: AGPL-3.0-only
"use client";

import { useQuery } from "@tanstack/react-query";
import { createClient, getUserId } from "@/lib/supabase/client";
import type { Achievement } from "@/lib/types";

export function useAchievements(limit = 10) {
  return useQuery({
    queryKey: ["achievements"],
    queryFn: async (): Promise<Achievement[]> => {
      const supabase = createClient();
      const uid = await getUserId();
      if (!uid) return [];
      const { data, error } = await supabase
        .from("achievements")
        .select("*")
        .eq("user_id", uid)
        .order("created_at", { ascending: false })
        .limit(limit);
      if (error) throw error;
      return (data ?? []) as Achievement[];
    },
  });
}
