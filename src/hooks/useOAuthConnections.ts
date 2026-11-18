// SPDX-License-Identifier: AGPL-3.0-only
"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createClient } from "@/lib/supabase/client";
import type { OAuthConnection } from "@/lib/types";

export function useOAuthConnections() {
  return useQuery({
    queryKey: ["oauth-connections"],
    queryFn: async (): Promise<OAuthConnection[]> => {
      const supabase = createClient();
      const { data, error } = await supabase.rpc("list_my_oauth_connections");
      if (error) throw error;
      return data ?? [];
    },
  });
}

export function useRevokeOAuthConnection() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const supabase = createClient();
      const { error } = await supabase.rpc("revoke_oauth_connection", { p_id: id });
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["oauth-connections"] }),
  });
}
