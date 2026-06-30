import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import type { Database } from "@/lib/types";

// Placeholders sólo para que el server no crashee si faltan las env vars
// (mismo criterio que src/lib/supabase/client.ts). En runtime real deben
// venir configuradas; si no, las llamadas a Supabase fallarán de forma
// controlada (error de auth) en vez de tirar un 500 de proceso.
const URL = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "https://placeholder.supabase.co";
const ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "placeholder-anon-key";

/** Cliente de Supabase para Server Components / Route Handlers. */
export async function createClient() {
  const cookieStore = await cookies();

  return createServerClient<Database>(URL, ANON_KEY, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        try {
          cookiesToSet.forEach(({ name, value, options }) =>
            cookieStore.set(name, value, options),
          );
        } catch {
          // Llamado desde un Server Component: lo maneja el middleware.
        }
      },
    },
  });
}
