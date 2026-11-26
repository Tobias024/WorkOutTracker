// SPDX-License-Identifier: AGPL-3.0-only
import { type NextRequest } from "next/server";
import { updateSession } from "@/lib/supabase/middleware";

export async function proxy(request: NextRequest) {
  return await updateSession(request);
}

export const config = {
  matcher: [
    /*
     * Coincide con todas las rutas excepto:
     * - _next/static, _next/image
     * - favicon, archivos de imagen
     * - api/cron (autentica con su propio secreto), sw.js, manifest.webmanifest
     */
    "/((?!_next/static|_next/image|favicon.ico|api/cron|sw\\.js|manifest\\.webmanifest|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
