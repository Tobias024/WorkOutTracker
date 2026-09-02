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
