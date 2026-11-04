// SPDX-License-Identifier: AGPL-3.0-only
"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createClient } from "@/lib/supabase/client";
import type { FriendSummary } from "@/lib/types";

export function useFriends() {
  return useQuery({
    queryKey: ["friends"],
    queryFn: async (): Promise<FriendSummary[]> => {
      const supabase = createClient();
      const { data, error } = await supabase.rpc("my_friends");
      if (error) throw error;
      return (data ?? []) as FriendSummary[];
    },
  });
}

/** Genera un link de invitación (vía RPC). */
export function useCreateInvite() {
  return useMutation({
    // El error se muestra inline en la tarjeta de invitación.
    meta: { silent: true },
    mutationFn: async (): Promise<string> => {
      const supabase = createClient();
      const { data, error } = await supabase.rpc("create_invite");
      if (error) throw error;
      return data as string;
    },
  });
}

export function useAcceptInvite() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (code: string) => {
      const supabase = createClient();
      const { error } = await supabase.rpc("accept_invite", { p_code: code });
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["friends"] }),
  });
}

export function useRemoveFriend() {
  const qc = useQueryClient();
  return useMutation({
    // El error se muestra inline en el diálogo de confirmación.
    meta: { silent: true },
    mutationFn: async (friendId: string) => {
      const supabase = createClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) throw new Error("No autenticado");
      const { error } = await supabase
        .from("friendships")
        .delete()
        .or(
          `and(requester_id.eq.${user.id},addressee_id.eq.${friendId}),and(requester_id.eq.${friendId},addressee_id.eq.${user.id})`,
        );
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["friends"] });
      // El ranking solo muestra amigos: sin esto seguiría apareciendo.
      qc.invalidateQueries({ queryKey: ["scoreboard"] });
    },
  });
}
