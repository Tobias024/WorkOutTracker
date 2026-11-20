// SPDX-License-Identifier: AGPL-3.0-only
import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { siteOrigin } from "@/lib/site-origin";

export const runtime = "nodejs";

/**
 * Mitigación CSRF explícita: al usar un Route Handler (no una Server Action,
 * para no romper la convención del repo) se pierde la verificación
 * automática de Origin que Next hace para Server Actions. Sin esto, un sitio
 * malicioso podría auto-enviar este form con SU PROPIO client_id/redirect_uri
 * y, si la víctima tiene sesión abierta en WOLF, conseguir un code atado a su
 * cuenta sin que vea nunca la pantalla de consentimiento real.
 */
function isTrustedOrigin(request: Request): boolean {
  const origin = request.headers.get("origin");
  const site = siteOrigin(request);
  if (origin) return origin === site;
  const referer = request.headers.get("referer");
  return !!referer && referer.startsWith(site);
}

export async function POST(request: Request) {
  if (!isTrustedOrigin(request)) {
    return new NextResponse("Origin no confiable", { status: 403 });
  }

  const form = await request.formData();
  const decision = form.get("decision");
  const redirectUri = String(form.get("redirect_uri") ?? "");
  const state = String(form.get("state") ?? "");

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    // No debería pasar (el middleware ya protege esta ruta), pero por las
    // dudas no seguimos sin sesión.
    return NextResponse.redirect(
      `${siteOrigin(request)}/login?next=${encodeURIComponent("/oauth/authorize")}`,
      303,
    );
  }

  if (decision === "cancel") {
    const url = new URL(redirectUri);
    url.searchParams.set("error", "access_denied");
    if (state) url.searchParams.set("state", state);
    return NextResponse.redirect(url, 303);
  }

  const clientId = String(form.get("client_id") ?? "");
  const codeChallenge = String(form.get("code_challenge") ?? "");
  const codeChallengeMethod = String(form.get("code_challenge_method") ?? "S256");
  const resource = String(form.get("resource") ?? "") || null;

  const { data: code, error } = await supabase.rpc("create_oauth_code", {
    p_client_id: clientId,
    p_redirect_uri: redirectUri,
    p_code_challenge: codeChallenge,
    p_code_challenge_method: codeChallengeMethod,
    p_resource: resource,
  });

  if (error || !code) {
    // No redirigimos a un redirect_uri que acabamos de descubrir que es
    // inválido/no coincide con lo registrado — mejor un error plano acá.
    return new NextResponse(error?.message ?? "No se pudo autorizar", {
      status: 400,
    });
  }

  const url = new URL(redirectUri);
  url.searchParams.set("code", code);
  if (state) url.searchParams.set("state", state);
  // 303 explícito: NextResponse.redirect() por defecto usa 307 (preserva el
  // método). Esta ruta siempre se llega por POST (el form de consentimiento);
  // sin forzar 303 ("See Other" → GET), el browser repite el POST contra el
  // redirect_uri del cliente MCP, que sólo acepta GET en su callback → 405.
  return NextResponse.redirect(url, 303);
}
