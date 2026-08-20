"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { UserCheck, Users } from "lucide-react";
import { Button, Spinner } from "@/components/ui";
import { createClient } from "@/lib/supabase/client";

type State =
  | { kind: "loading" }
  | { kind: "needs-auth" }
  | { kind: "ok" }
  | { kind: "error"; message: string };

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
        setState({ kind: "needs-auth" });
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
  }, [code]);

  return (
    <main className="min-h-dvh flex flex-col items-center justify-center px-6 text-center">
      <div className="w-full max-w-sm card p-8">
        {state.kind === "loading" && <Spinner className="mx-auto" />}

        {state.kind === "needs-auth" && (
          <>
            <Users className="size-10 text-primary mx-auto mb-3" />
            <h1 className="text-xl font-bold">Te invitaron a competir</h1>
            <p className="text-sm text-muted mt-1 mb-5">
              Iniciá sesión para aceptar la invitación.
            </p>
            <Button
              className="w-full"
              onClick={() =>
                router.push(`/login?next=${encodeURIComponent(`/invite/${code}`)}`)
              }
            >
              Iniciar sesión
            </Button>
          </>
        )}

        {state.kind === "ok" && (
          <>
            <UserCheck className="size-10 text-success mx-auto mb-3" />
            <h1 className="text-xl font-bold">¡Ya son amigos! 🎉</h1>
            <p className="text-sm text-muted mt-1 mb-5">
              Ahora pueden competir en el ranking.
            </p>
            <Link href="/scoreboard">
              <Button className="w-full">Ver amigos</Button>
            </Link>
          </>
        )}

        {state.kind === "error" && (
          <>
            <h1 className="text-xl font-bold">Ups…</h1>
            <p className="text-sm text-danger mt-1 mb-5">{state.message}</p>
            <Link href="/rutinas">
              <Button variant="secondary" className="w-full">
                Ir al inicio
              </Button>
            </Link>
          </>
        )}
      </div>
    </main>
  );
}
