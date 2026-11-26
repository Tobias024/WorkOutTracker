// SPDX-License-Identifier: AGPL-3.0-only
import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { safeNext } from "@/lib/safe-next";

// Intercambia el código OAuth / OTP por una sesión y redirige.
export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const tokenHash = searchParams.get("token_hash");
  const type = searchParams.get("type");
  const next = safeNext(searchParams.get("next"));

  const supabase = await createClient();

  /**
   * Una sesión de recuperación va SIEMPRE a elegir la contraseña nueva, venga
   * o no el `next`: si Supabase cayó a la Site URL (redirectTo fuera de la
   * allow list), el `next=/auth/reset-password` se perdió en el camino y el
   * usuario terminaba logueado en /rutinas sin poder cambiarla. El JWT marca
   * el método en `amr` ("recovery").
   */
  async function destination(isRecovery = false): Promise<string> {
    if (isRecovery) return "/auth/reset-password";
    try {
      const { data } = await supabase.auth.getClaims();
      const amr = (data?.claims as { amr?: { method?: string }[] } | undefined)?.amr;
      if (amr?.some((a) => a.method === "recovery")) return "/auth/reset-password";
    } catch {
      // Sin claims legibles se respeta el next.
    }
    return next;
  }

  if (code) {
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) return NextResponse.redirect(`${origin}${await destination()}`);
    console.error("auth/callback: exchangeCodeForSession falló", error);
    return NextResponse.redirect(
      `${origin}/login?error=${encodeURIComponent(error.message)}`,
    );
  } else if (tokenHash && type) {
    const { error } = await supabase.auth.verifyOtp({
      type: type as "email" | "magiclink" | "recovery",
      token_hash: tokenHash,
    });
    if (!error)
      return NextResponse.redirect(
        `${origin}${await destination(type === "recovery")}`,
      );
    console.error("auth/callback: verifyOtp falló", error);
    return NextResponse.redirect(
      `${origin}/login?error=${encodeURIComponent(error.message)}`,
    );
  }

  return NextResponse.redirect(`${origin}/login?error=auth`);
}
