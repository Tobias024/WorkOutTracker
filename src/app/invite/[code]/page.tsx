// SPDX-License-Identifier: AGPL-3.0-only
"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { UserCheck } from "lucide-react";
import { Spinner, buttonClasses } from "@/components/ui";
import { createClient } from "@/lib/supabase/client";

type State =
  | { kind: "loading" }
  | { kind: "needs-auth"; inviter: string | null }
  | { kind: "ok" }
  | { kind: "error"; message: string };

/**
 * preview_invite (migración 0037) aún no está en los tipos generados de la DB.
 * Si la migración no corrió (PGRST202) o falla, devuelve null y la UI se
 * muestra sin el nombre.
 */
async function fetchInviterName(
  supabase: ReturnType<typeof createClient>,
  code: string,
): Promise<string | null> {
  try {
    const { data, error } = await (
      supabase.rpc as unknown as (
        fn: string,
        args: Record<string, unknown>,
      ) => PromiseLike<{ data: unknown; error: unknown }>
    ).call(supabase, "preview_invite", { p_code: code });
    if (error || typeof data !== "string") return null;
    return data;
  } catch {
    return null;
  }
}

export default function InvitePage() {
  const { code } = useParams<{ code: string }>();
  const router = useRouter();
  const [state, setState] = useState<State>({ kind: "loading" });

  useEffect(() => {
    (async () => {
      const supabase = createClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) {
        // Persistimos el code: si la cadena de redirects del registro se corta
        // (confirmación cross-device, onboarding, etc.), PendingInviteHandler lo
        // consume al llegar autenticado. Antes se perdía → había que reclickear.
        try {
          localStorage.setItem("wot-pending-invite", code);
        } catch {
          // localStorage no disponible: seguimos con el flujo por `next`.
        }
        const inviter = await fetchInviterName(supabase, code);
        setState({ kind: "needs-auth", inviter });
        return;
      }
      // /invite está fuera de (app): el layout no frena a un usuario nuevo sin
      // perfil, así que lo mandamos a onboarding y volvemos acá después.
      const { data: profile } = await supabase
        .from("profiles")
        .select("username")
        .eq("id", user.id)
        .maybeSingle();
      if (!profile?.username) {
        router.replace(
          `/onboarding?next=${encodeURIComponent(`/invite/${code}`)}`,
        );
        return;
      }
      const { error } = await supabase.rpc("accept_invite", { p_code: code });
      try {
        localStorage.removeItem("wot-pending-invite");
      } catch {
        // no-op
      }
      if (error) setState({ kind: "error", message: error.message });
      else setState({ kind: "ok" });
    })();
  }, [code, router]);

  const loginNext = encodeURIComponent(`/invite/${code}`);

  return (
    <main className="min-h-dvh flex flex-col items-center justify-center px-6 text-center">
      <div className="w-full max-w-sm card p-8">
        {state.kind === "loading" && <Spinner className="mx-auto" />}

        {state.kind === "needs-auth" && (
          <>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src="/logo.png"
              alt="WOLF"
              width={72}
              height={72}
              className="size-20 mx-auto mb-3"
            />
            <h1 className="text-xl font-bold">
              {state.inviter ? (
                <>
                  <strong className="text-primary">{state.inviter}</strong> te
                  invitó a competir en WOLF
                </>
              ) : (
                "Te invitaron a competir en WOLF"
              )}
            </h1>
            <p className="text-sm text-muted mt-1 mb-5">
              Rutinas, registro y ranking con amigos.
            </p>
            <div className="flex flex-col gap-2">
              <Link
                href={`/login?mode=signup&next=${loginNext}`}
                className={buttonClasses({ className: "w-full" })}
              >
                Crear cuenta
              </Link>
              <Link
                href={`/login?next=${loginNext}`}
                className={buttonClasses({
                  variant: "secondary",
                  className: "w-full",
                })}
              >
                Ya tengo cuenta
              </Link>
            </div>
          </>
        )}

        {state.kind === "ok" && (
          <>
            <UserCheck className="size-10 text-success mx-auto mb-3" />
            <h1 className="text-xl font-bold">¡Ya son amigos! 🎉</h1>
            <p className="text-sm text-muted mt-1 mb-5">
              Ahora pueden competir en el ranking.
            </p>
            <Link
              href="/scoreboard"
              className={buttonClasses({ className: "w-full" })}
            >
              Ver ranking
            </Link>
          </>
        )}

        {state.kind === "error" && (
          <>
            <h1 className="text-xl font-bold">Ups…</h1>
            <p role="alert" className="text-sm text-danger mt-1 mb-5">
              {state.message}
            </p>
            <Link
              href="/rutinas"
              className={buttonClasses({
                variant: "secondary",
                className: "w-full",
              })}
            >
              Ir al inicio
            </Link>
          </>
        )}
      </div>
    </main>
  );
}
