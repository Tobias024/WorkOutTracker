// SPDX-License-Identifier: AGPL-3.0-only
"use client";

import { Suspense, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { ShieldCheck } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { Button, Spinner } from "@/components/ui";

type State =
  | { kind: "loading" }
  | { kind: "invalid"; message: string }
  | { kind: "ready"; clientName: string; redirectHost: string };

function isValidUrl(value: string): boolean {
  try {
    new URL(value);
    return true;
  } catch {
    return false;
  }
}

function AuthorizeForm() {
  const params = useSearchParams();
  const [asyncState, setAsyncState] = useState<State>({ kind: "loading" });

  const clientId = params.get("client_id") ?? "";
  const redirectUri = params.get("redirect_uri") ?? "";
  const codeChallenge = params.get("code_challenge") ?? "";
  const codeChallengeMethod = params.get("code_challenge_method") ?? "S256";
  const stateParam = params.get("state") ?? "";
  const resource = params.get("resource") ?? "";

  // Validación de los params: se computa en el render (no en el efecto), así
  // el efecto nunca llama a setState de forma síncrona (sólo lo hace después
  // de un await, mismo criterio que el resto de las páginas del repo).
  const paramsError = !clientId || !redirectUri || !codeChallenge
    ? "Faltan parámetros en el link (client_id, redirect_uri o code_challenge)."
    : !isValidUrl(redirectUri)
      ? "redirect_uri inválida."
      : null;

  useEffect(() => {
    if (paramsError) return;

    (async () => {
      const supabase = createClient();
      const { data: clientName, error } = await supabase.rpc(
        "get_oauth_client_public_info",
        { p_client_id: clientId },
      );
      if (error || !clientName) {
        setAsyncState({ kind: "invalid", message: "Cliente OAuth desconocido." });
        return;
      }
      setAsyncState({ kind: "ready", clientName, redirectHost: new URL(redirectUri).host });
    })();
  }, [paramsError, clientId, redirectUri]);

  const state: State = paramsError
    ? { kind: "invalid", message: paramsError }
    : asyncState;

  return (
    <main className="min-h-dvh flex flex-col items-center justify-center px-6">
      <div className="w-full max-w-sm">
        <div className="flex flex-col items-center gap-3 mb-6 text-center">
          <div className="size-14 rounded-lg bg-primary/15 grid place-items-center">
            <ShieldCheck className="size-7 text-primary" />
          </div>
          <h1 className="text-xl font-bold">Conectar tu IA a WOLF</h1>
        </div>

        {state.kind === "loading" && (
          <div className="card p-6 grid place-items-center">
            <Spinner />
          </div>
        )}

        {state.kind === "invalid" && (
          <div className="card p-6 text-center">
            <p className="font-medium">No se pudo continuar</p>
            <p className="text-sm text-muted mt-2">{state.message}</p>
          </div>
        )}

        {state.kind === "ready" && (
          <div className="card p-6 flex flex-col gap-4">
            <div className="text-sm text-center">
              <p>
                <strong>{state.clientName}</strong> quiere conectarse a tu
                cuenta de WOLF.
              </p>
              <p className="text-muted mt-2">
                Va a poder ver tu catálogo de ejercicios y tu progreso, crear
                y editar tus rutinas, y registrar tus entrenamientos.
              </p>
              <p className="text-xs text-muted mt-3">
                Esto va a redirigir a: <strong>{state.redirectHost}</strong>
              </p>
            </div>

            <form method="POST" action="/oauth/authorize/approve">
              <input type="hidden" name="decision" value="allow" />
              <input type="hidden" name="client_id" value={clientId} />
              <input type="hidden" name="redirect_uri" value={redirectUri} />
              <input type="hidden" name="code_challenge" value={codeChallenge} />
              <input
                type="hidden"
                name="code_challenge_method"
                value={codeChallengeMethod}
              />
              <input type="hidden" name="state" value={stateParam} />
              <input type="hidden" name="resource" value={resource} />
              <Button type="submit" className="w-full">
                Permitir
              </Button>
            </form>

            <form method="POST" action="/oauth/authorize/approve">
              <input type="hidden" name="decision" value="cancel" />
              <input type="hidden" name="redirect_uri" value={redirectUri} />
              <input type="hidden" name="state" value={stateParam} />
              <Button type="submit" variant="secondary" className="w-full">
                Cancelar
              </Button>
            </form>
          </div>
        )}
      </div>
    </main>
  );
}

export default function AuthorizePage() {
  return (
    <Suspense>
      <AuthorizeForm />
    </Suspense>
  );
}
