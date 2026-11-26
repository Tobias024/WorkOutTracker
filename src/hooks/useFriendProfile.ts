// SPDX-License-Identifier: AGPL-3.0-only
"use client";

import { useQuery } from "@tanstack/react-query";
import { createClient } from "@/lib/supabase/client";
import { sinceFor, localTimeZone, type Period } from "@/lib/period";
import type { CommonExerciseMax, FriendMetrics } from "@/lib/types";

export function useFriendMetrics(friendId: string | undefined, period: Period) {
  return useQuery({
    queryKey: ["friend-metrics", friendId, period],
    enabled: !!friendId,
    queryFn: async (): Promise<FriendMetrics> => {
      const supabase = createClient();
      const { data, error } = await supabase.rpc("friend_metrics", {
        p_friend_id: friendId as string,
        p_since: sinceFor(period),
        p_tz: localTimeZone(),
      });
      if (error) throw error;
      return data as FriendMetrics;
    },
  });
}

export { useCurrentUserId } from "@/hooks/useUser";

export function useCommonExercises(friendId: string | undefined) {
  return useQuery({
    queryKey: ["common-exercises", friendId],
    enabled: !!friendId,
    queryFn: async (): Promise<CommonExerciseMax[]> => {
      const supabase = createClient();
      const { data, error } = await supabase.rpc("common_exercise_maxes", {
        p_friend_id: friendId as string,
      });
      if (error) throw error;
      return (data ?? []) as CommonExerciseMax[];
    },
  });
}
