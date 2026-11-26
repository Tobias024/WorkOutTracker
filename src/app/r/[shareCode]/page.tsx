// SPDX-License-Identifier: AGPL-3.0-only
"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { Dumbbell, Download } from "lucide-react";
import { Button, Spinner, Badge, buttonClasses } from "@/components/ui";
import { ExerciseImage } from "@/components/ExerciseImage";
import { createClient, getUserId } from "@/lib/supabase/client";
import type { RoutinePreview } from "@/lib/types";

type Load =
  | { kind: "loading" }
  | { kind: "network" }
  | { kind: "notfound" }
  | { kind: "ok"; preview: RoutinePreview; owner: string | null };

/**
 * routine_share_owner (migración 0037) aún no está en los tipos generados de la
 * DB. Si la migración no corrió (PGRST202) o falla, la UI va sin el nombre.
 */
async function fetchOwnerName(
  supabase: ReturnType<typeof createClient>,
  shareCode: string,
): Promise<string | null> {
  try {
    const { data, error } = await (
      supabase.rpc as unknown as (
        fn: string,
        args: Record<string, unknown>,
      ) => PromiseLike<{ data: unknown; error: unknown }>
    ).call(supabase, "routine_share_owner", { p_share_code: shareCode });
    if (error || typeof data !== "string") return null;
    return data;
  } catch {
    return null;
  }
}

function Brand() {
  return (
    <Link href="/" className="inline-flex items-center gap-2 min-h-11">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src="/logo.png" alt="" width={32} height={32} className="size-8" />
      <span className="text-lg font-bold tracking-wide">WOLF</span>
    </Link>
  );
}

export default function SharedRoutinePage() {
  const { shareCode } = useParams<{ shareCode: string }>();
  const router = useRouter();
  const [load, setLoad] = useState<Load>({ kind: "loading" });
  const [attempt, setAttempt] = useState(0);
  const [authed, setAuthed] = useState(false);
  const [importing, setImporting] = useState(false);
  const [importError, setImportError] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      const supabase = createClient();
      const uid = await getUserId();
      setAuthed(!!uid);
      if (uid) {
        // /r está fuera de (app): un usuario nuevo sin perfil pasa primero por
        // onboarding y vuelve acá.
        const { data: profile } = await supabase
          .from("profiles")
          .select("username")
          .eq("id", uid)
          .maybeSingle();
        if (!profile?.username) {
          router.replace(
            `/onboarding?next=${encodeURIComponent(`/r/${shareCode}`)}`,
          );
          return;
        }
      }
      const [{ data, error }, owner] = await Promise.all([
        supabase.rpc("preview_routine", { p_share_code: shareCode }),
        fetchOwnerName(supabase, shareCode),
      ]);
      // Un error de red no es "link inválido": se distingue para poder reintentar.
      if (error) setLoad({ kind: "network" });
      else if (!data) setLoad({ kind: "notfound" });
      else setLoad({ kind: "ok", preview: data as RoutinePreview, owner });
    })();
  }, [shareCode, attempt, router]);

  function retry() {
    setLoad({ kind: "loading" });
    setAttempt((n) => n + 1);
  }

  async function importRoutine() {
    setImportError(null);
    setImporting(true);
    const supabase = createClient();
    const { data, error } = await supabase.rpc("import_routine", {
      p_share_code: shareCode,
    });
    setImporting(false);
    if (error) {
      setImportError("No pudimos copiar la rutina. Probá de nuevo.");
      return;
    }
    router.push(`/rutinas/${data}`);
  }

  const loginNext = encodeURIComponent(`/r/${shareCode}`);

  if (load.kind === "loading") {
    return (
      <main className="min-h-dvh grid place-items-center">
        <Spinner />
      </main>
    );
  }

  if (load.kind !== "ok") {
    const network = load.kind === "network";
    return (
      <main className="min-h-dvh flex flex-col items-center justify-center px-6 text-center">
        <div className="card p-8 max-w-sm">
          <h1 className="text-xl font-bold">
            {network ? "No pudimos cargar la rutina" : "Rutina no encontrada"}
          </h1>
          <p className="text-sm text-muted mt-1 mb-5">
            {network
              ? "No pudimos cargar la rutina. Revisá tu conexión."
              : "Este link ya no existe o la rutina se dejó de compartir."}
          </p>
          {network ? (
            <Button className="w-full" onClick={retry}>
              Reintentar
            </Button>
          ) : authed ? (
            <Link
              href="/rutinas"
              className={buttonClasses({ variant: "secondary", className: "w-full" })}
            >
              Ir al inicio
            </Link>
          ) : (
            <Link
              href="/login?mode=signup"
              className={buttonClasses({ className: "w-full" })}
            >
              Crear cuenta
            </Link>
          )}
        </div>
      </main>
    );
  }

  const { preview, owner } = load;

  return (
    <main className="min-h-dvh px-4 pt-[max(2rem,env(safe-area-inset-top))] pb-48">
      <div className="mx-auto max-w-2xl">
        <div className="mb-4">
          <Brand />
          {owner && (
            <p className="text-sm text-muted">
              Compartida por <strong className="text-fg">{owner}</strong>
            </p>
          )}
        </div>
        <div className="flex items-center gap-3 mb-1">
          <div className="size-11 rounded-md bg-primary/15 grid place-items-center">
            <Dumbbell className="size-6 text-primary" />
          </div>
          <div>
            <p className="text-xs text-muted">Rutina compartida</p>
            <h1 className="text-2xl font-bold">{preview.name}</h1>
          </div>
        </div>
        {preview.description && (
          <p className="text-sm text-muted mb-4">{preview.description}</p>
        )}

        <ul className="flex flex-col gap-2 my-5">
          {preview.exercises.map((ex, i) => (
            <li key={i} className="card flex items-center gap-3 p-3">
              <ExerciseImage
                src={ex.image ?? undefined}
                alt={ex.name}
                className="size-11 rounded shrink-0"
              />
              <span className="font-medium flex-1 truncate">{ex.name}</span>
              {ex.target_sets && (
                <Badge>
                  {ex.target_sets}×{ex.target_reps ?? "—"}
                </Badge>
              )}
            </li>
          ))}
        </ul>
      </div>

      {/* CTA fijo, igual que en el bundle: con rutinas largas no queda bajo el pliegue. */}
      <div className="fixed inset-x-0 bottom-0 px-4 pt-3 pb-[calc(1rem+env(safe-area-inset-bottom))] bg-bg/95 backdrop-blur border-t border-border">
        <div className="mx-auto max-w-2xl flex flex-col gap-2">
          {importError && (
            <p role="alert" className="text-sm text-danger">
              {importError}
            </p>
          )}
          {authed ? (
            <Button
              size="lg"
              className="w-full"
              onClick={importRoutine}
              loading={importing}
            >
              <Download className="size-5" />
              Copiar a mis rutinas
            </Button>
          ) : (
            <>
              <Link
                href={`/login?mode=signup&next=${loginNext}`}
                className={buttonClasses({ size: "lg", className: "w-full" })}
              >
                Crear cuenta y copiar
              </Link>
              <Link
                href={`/login?next=${loginNext}`}
                className={buttonClasses({
                  variant: "ghost",
                  className: "w-full",
                })}
              >
                Ya tengo cuenta
              </Link>
            </>
          )}
          <p className="text-xs text-muted text-center">
            Se copia la estructura de la rutina. Los pesos no se comparten.
          </p>
        </div>
      </div>
    </main>
  );
}
