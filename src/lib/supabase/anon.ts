// SPDX-License-Identifier: AGPL-3.0-only
import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/types";

const URL = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "https://placeholder.supabase.co";
const ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "placeholder-anon-key";

/**
 * Cliente stateless (sin cookies, sin sesión) para los endpoints
 * server-to-server del bridge OAuth/MCP (/oauth/register, /oauth/token,
 * /mcp). Ninguna RPC que llaman depende de auth.uid(): cada una deriva su
 * propia identidad del parámetro que recibe (code, refresh_token o
 * access_token), no de una sesión de Supabase — por eso no hace falta el
 * wrapper de cookies de @/lib/supabase/server.
 */
export function createAnonClient() {
  return createSupabaseClient<Database>(URL, ANON_KEY, {
    auth: { persistSession: false },
  });
}
