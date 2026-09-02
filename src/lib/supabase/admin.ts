// SPDX-License-Identifier: AGPL-3.0-only
import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/types";

// Cliente con service_role: bypassa RLS. SÓLO para código de servidor
// (rutas API / cron). Nunca importar desde componentes cliente.
export function createAdminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    throw new Error(
      "Faltan NEXT_PUBLIC_SUPABASE_URL o SUPABASE_SERVICE_ROLE_KEY",
    );
  }
  return createClient<Database>(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}
