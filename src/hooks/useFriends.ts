// SPDX-License-Identifier: AGPL-3.0-only
"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createClient } from "@/lib/supabase/client";
import type { Profile } from "@/lib/types";

export function useFriends() {
  return useQuery({
    queryKey: ["friends"],
    queryFn: async (): Promise<Profile[]> => {
      const supabase = createClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) return [];

      const { data: rels, error } = await supabase
        .from("friendships")
        .select("requester_id, addressee_id")
        .eq("status", "accepted");
      if (error) throw error;

      const ids = (rels ?? []).map((r) =>
        r.requester_id === user.id ? r.addressee_id : r.requester_id,
      );
      if (ids.length === 0) return [];

      const { data: profiles } = await supabase
        .from("profiles")
        .select("*")
        .in("id", ids);
      return (profiles ?? []) as Profile[];
    },
  });
}

/** Genera un link de invitación (vía RPC). */
export function useCreateInvite() {
  return useMutation({
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
    onSuccess: () => qc.invalidateQueries({ queryKey: ["friends"] }),
  });
}
