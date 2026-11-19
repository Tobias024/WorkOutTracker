// SPDX-License-Identifier: AGPL-3.0-only
import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import type { Database } from "@/lib/types";

// Rutas accesibles sin sesión. /oauth/authorize y /oauth/authorize/approve
// quedan deliberadamente FUERA: son páginas normales protegidas (requieren
// sesión, como cualquier otra ruta) — /oauth/token, /oauth/register,
// /.well-known y /mcp en cambio son server-to-server (sin cookie de sesión),
// cada uno valida su propio bearer/no necesita nada acá.
//
// "/.well-known" (no sólo "/api/well-known"): el middleware corre ANTES que
// los rewrites de next.config.ts, así que ve la ruta original. Sin esto el
// descubrimiento OAuth devolvía un 307 a /login y los clientes MCP abortaban
// con "Couldn't start, try signing in".
const PUBLIC_PATHS = [
  "/login",
  "/auth",
  "/invite",
  "/r",
  "/oauth/token",
  "/oauth/register",
  "/.well-known",
  "/api/well-known",
  "/mcp",
];

// Archivos que el navegador pide sin sesión (manifest/SW) para validar la
// instalación de la PWA: si se redirigen a /login, Brave/Chrome descartan
// el manifest o el service worker y ya no ofrecen "Instalar app".
const PUBLIC_FILES = ["/manifest.webmanifest", "/sw.js"];

function isPublic(pathname: string) {
  return PUBLIC_PATHS.some(
    (p) => pathname === p || pathname.startsWith(p + "/"),
  );
}

// Placeholders sólo para que el middleware no crashee el sitio entero si
// faltan las env vars (mismo criterio que client.ts/server.ts).
const URL = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "https://placeholder.supabase.co";
const ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "placeholder-anon-key";

/** Refresca la sesión y protege rutas privadas. */
export async function updateSession(request: NextRequest) {
  // Los prefetch de Next.js (Link precargando otras tabs en segundo plano)
  // no deben disparar un refresh de sesión: si el access token está por
  // vencer, varias requests de prefetch en simultáneo pueden refrescarlo
  // a la vez y Supabase invalida el refresh token para todas menos la
  // primera, cortando la sesión sin motivo aparente. La navegación real
  // (sin estos headers) sí hace el refresh normalmente.
  if (
    request.headers.get("next-router-prefetch") ||
    request.headers.get("next-router-segment-prefetch") ||
    PUBLIC_FILES.includes(request.nextUrl.pathname)
  ) {
    return NextResponse.next({ request });
  }

  let response = NextResponse.next({ request });

  const supabase = createServerClient<Database>(URL, ANON_KEY, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value }) =>
          request.cookies.set(name, value),
        );
        response = NextResponse.next({ request });
        cookiesToSet.forEach(({ name, value, options }) =>
          response.cookies.set(name, value, options),
        );
      },
    },
  });

  // Un error acá (config inválida, red, etc.) no debe tirar abajo todo el
  // sitio con un 500 — se trata como "sin sesión" y se deja que el guard
  // de rutas privadas redirija a /login normalmente.
  let user = null;
  try {
    const { data } = await supabase.auth.getUser();
    user = data.user;
  } catch (err) {
    console.error("middleware: fallo al obtener la sesión", err);
  }

  const { pathname } = request.nextUrl;

  if (!user && !isPublic(pathname)) {
    // .clone() + reset de "search" (no new URL(): la constante URL de arriba
    // tapa el constructor global en este módulo). Antes, pisar sólo
    // "pathname" dejaba los query params originales pegados sueltos en la
    // URL de /login, y "next" se guardaba sin su propio query string —
    // rompía cualquier flujo que dependa de params a través del login
    // intermedio (p. ej. /oauth/authorize?client_id=...&code_challenge=...).
    const loginUrl = request.nextUrl.clone();
    loginUrl.pathname = "/login";
    loginUrl.search = "";
    loginUrl.searchParams.set("next", pathname + request.nextUrl.search);
    return NextResponse.redirect(loginUrl);
  }

  return response;
}
