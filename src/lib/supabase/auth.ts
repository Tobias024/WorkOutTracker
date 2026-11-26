// SPDX-License-Identifier: AGPL-3.0-only
import { cache } from "react";
import { createClient } from "./server";

/**
 * Claims del JWT de la sesión. getClaims() verifica la firma localmente
 * (JWKS) cuando la clave es asimétrica, sin round-trip a Supabase Auth; con
 * HS256 cae a getUser(). `cache` lo deduplica dentro de un mismo render.
 */
export const getAuthClaims = cache(async () => {
  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  return data?.claims ?? null;
});

/** id del usuario autenticado (claims.sub) o null. */
export async function getAuthUserId(): Promise<string | null> {
  const claims = await getAuthClaims();
  return claims?.sub ?? null;
}
