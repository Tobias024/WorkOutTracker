// SPDX-License-Identifier: AGPL-3.0-only
import { createBrowserClient } from "@supabase/ssr";
import type { Database } from "@/lib/types";

// Placeholders sólo para que el build prerenderice sin secrets.
// En runtime (dev/prod) deben venir de variables de entorno reales.
const URL = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "https://placeholder.supabase.co";
const ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "placeholder-anon-key";

/** Cliente de Supabase para el browser (componentes client). */
export function createClient() {
  return createBrowserClient<Database>(URL, ANON_KEY);
}

/**
 * Id del usuario logueado SIN ir a la red: lee la sesión local (cookie) que
 * @supabase/ssr mantiene y refresca. Alcanza para filtrar/decidir en el
 * cliente: la seguridad real la da la RLS, que valida el JWT en Postgres.
 * `auth.getUser()` hace un request a Supabase Auth en cada llamada.
 */
export async function getUserId(): Promise<string | null> {
  const { data } = await createClient().auth.getSession();
  return data.session?.user.id ?? null;
}
