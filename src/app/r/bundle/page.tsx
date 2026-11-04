// SPDX-License-Identifier: AGPL-3.0-only
"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Dumbbell, Download, Check, AlertCircle } from "lucide-react";
import { Button, Spinner, Badge, buttonClasses } from "@/components/ui";
import { createClient } from "@/lib/supabase/client";
import { clsx } from "@/lib/clsx";
import type { RoutinePreview } from "@/lib/types";

type Item = { code: string; preview: RoutinePreview | null };

export default function SharedBundlePage() {
  const router = useRouter();
  const [items, setItems] = useState<Item[]>([]);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [authed, setAuthed] = useState(false);
  const [importing, setImporting] = useState(false);
  const [progress, setProgress] = useState({ done: 0, total: 0 });
  const [failMsg, setFailMsg] = useState<string | null>(null);
  const [codesParam, setCodesParam] = useState("");

  useEffect(() => {
    (async () => {
      const codes = (new URLSearchParams(window.location.search).get("c") ?? "")
        .split(",")
        .map((c) => c.trim())
        .filter(Boolean);
      setCodesParam(codes.join(","));

      const supabase = createClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();
      setAuthed(!!user);
      if (user) {
        // /r está fuera de (app): un usuario nuevo sin perfil pasa primero por
        // onboarding y vuelve acá.
        const { data: profile } = await supabase
          .from("profiles")
          .select("username")
          .eq("id", user.id)
          .maybeSingle();
        if (!profile?.username) {
          router.replace(
            `/onboarding?next=${encodeURIComponent(`/r/bundle?c=${codes.join(",")}`)}`,
          );
          return;
        }
      }

      const results = await Promise.all(
        codes.map(async (code): Promise<Item> => {
          const { data } = await supabase.rpc("preview_routine", {
            p_share_code: code,
          });
          return { code, preview: (data as RoutinePreview | null) ?? null };
        }),
      );
      setItems(results);
      // Por defecto vienen todas tildadas (las válidas).
      setSelected(new Set(results.filter((r) => r.preview).map((r) => r.code)));
      setLoading(false);
    })();
  }, [router]);

  function toggle(code: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(code)) next.delete(code);
      else next.add(code);
      return next;
    });
  }

  function toggleAll() {
    setSelected((prev) =>
      prev.size === items.filter((it) => it.preview).length
        ? new Set()
        : new Set(items.filter((it) => it.preview).map((it) => it.code)),
    );
  }

  async function importSelected() {
    const chosen = items.filter((it) => it.preview && selected.has(it.code));
    if (chosen.length === 0) return;
    if (!authed) return; // sin sesión el CTA es un link a /login, no llega acá
    setImporting(true);
    setFailMsg(null);
    setProgress({ done: 0, total: chosen.length });
    const okCodes: string[] = [];
    const failed: Item[] = [];
    try {
      const supabase = createClient();
      for (let i = 0; i < chosen.length; i++) {
        const it = chosen[i];
        const { error } = await supabase.rpc("import_routine", {
          p_share_code: it.code,
        });
        if (error) failed.push(it);
        else okCodes.push(it.code);
        setProgress({ done: i + 1, total: chosen.length });
      }
    } catch {
      // Si algo explota a mitad de camino, lo que no se procesó cuenta como fallido.
      for (const it of chosen) {
        if (!okCodes.includes(it.code) && !failed.includes(it)) failed.push(it);
      }
    } finally {
      setImporting(false);
    }
    if (failed.length === 0) {
      router.push("/rutinas");
      return;
    }
    // Las copiadas se destildan; las fallidas quedan para reintentar.
    setSelected(new Set(failed.map((f) => f.code)));
    setFailMsg(
      `Se copiaron ${okCodes.length} de ${chosen.length}. No pudimos copiar: ${failed
        .map((f) => f.preview?.name ?? f.code)
        .join(", ")}.`,
    );
  }

  if (loading) {
    return (
      <main className="min-h-dvh grid place-items-center">
        <Spinner />
      </main>
    );
  }

  const valid = items.filter((it) => it.preview);
  const loginNext = encodeURIComponent(`/r/bundle?c=${codesParam}`);

  if (valid.length === 0) {
    return (
      <main className="min-h-dvh flex flex-col items-center justify-center px-6 text-center">
        <div className="card p-8 max-w-sm">
          <h1 className="text-xl font-bold">Rutinas no encontradas</h1>
          <p className="text-sm text-muted mt-1 mb-5">
            El link puede ser inválido.
          </p>
          <Link
            href={authed ? "/rutinas" : "/login?mode=signup"}
            className={buttonClasses({
              variant: authed ? "secondary" : "primary",
              className: "w-full",
            })}
          >
            {authed ? "Ir al inicio" : "Crear cuenta"}
          </Link>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-dvh px-4 pt-[max(2rem,env(safe-area-inset-top))] pb-56">
      <div className="mx-auto max-w-2xl">
        <div className="flex items-center gap-3 mb-1">
          <div className="size-11 rounded-md bg-primary/15 grid place-items-center">
            <Dumbbell className="size-6 text-primary" />
          </div>
          <div>
            <p className="text-xs text-muted">Rutinas compartidas</p>
            <h1 className="text-2xl font-bold">{valid.length} {valid.length === 1 ? "rutina" : "rutinas"}</h1>
          </div>
        </div>
        <div className="flex items-center justify-between gap-3 mb-2">
          <p className="text-sm text-muted">
            Elegí cuáles querés copiar a tus rutinas.
          </p>
          <button
            type="button"
            onClick={toggleAll}
            className="min-h-11 px-2 shrink-0 text-sm font-medium text-primary"
          >
            {selected.size === valid.length ? "Ninguna" : "Elegir todas"}
          </button>
        </div>

        <ul className="flex flex-col gap-2.5">
          {items.map((it) =>
            it.preview ? (
              <li key={it.code}>
                <button
                  type="button"
                  role="checkbox"
                  aria-checked={selected.has(it.code)}
                  onClick={() => toggle(it.code)}
                  className={clsx(
                    "card w-full text-left p-4 transition",
                    selected.has(it.code)
                      ? "ring-1 ring-primary"
                      : "hover:ring-1 hover:ring-border",
                  )}
                >
                  <div className="flex items-center gap-3">
                    <div
                      className={clsx(
                        "size-6 rounded-md grid place-items-center shrink-0 ring-1 transition",
                        selected.has(it.code)
                          ? "bg-primary text-primary-fg ring-primary"
                          : "bg-surface-2 ring-border text-transparent",
                      )}
                    >
                      <Check className="size-4" />
                    </div>
                    <span className="font-semibold flex-1 truncate">
                      {it.preview.name}
                    </span>
                    <Badge>{it.preview.exercises.length} ej.</Badge>
                  </div>
                  {it.preview.exercises.length > 0 && (
                    <p className="text-xs text-muted mt-2 line-clamp-2 pl-9">
                      {it.preview.exercises.map((e) => e.name).join(" · ")}
                    </p>
                  )}
                </button>
              </li>
            ) : (
              <li key={it.code}>
                <div className="card p-4 flex items-center gap-3 text-sm text-muted">
                  <AlertCircle className="size-5 shrink-0" />
                  Una de las rutinas no se encontró (link inválido).
                </div>
              </li>
            ),
          )}
        </ul>
      </div>

      <div className="fixed inset-x-0 bottom-0 px-4 pt-3 pb-[calc(1rem+env(safe-area-inset-bottom))] bg-bg/95 backdrop-blur border-t border-border">
        <div className="mx-auto max-w-2xl">
          {failMsg && (
            <p role="alert" className="text-sm text-danger mb-2">
              {failMsg}
            </p>
          )}
          {authed ? (
            <Button
              size="lg"
              className="w-full"
              disabled={selected.size === 0}
              loading={importing}
              onClick={importSelected}
            >
              <Download className="size-5" />
              {importing
                ? `Copiando ${Math.min(progress.done + 1, progress.total)} de ${progress.total}…`
                : `Copiar ${selected.size || ""} a mis rutinas`}
            </Button>
          ) : (
            <div className="flex flex-col gap-2">
              <Link
                href={`/login?mode=signup&next=${loginNext}`}
                className={buttonClasses({ size: "lg", className: "w-full" })}
              >
                Crear cuenta y copiar
              </Link>
              <Link
                href={`/login?next=${loginNext}`}
                className={buttonClasses({ variant: "ghost", className: "w-full" })}
              >
                Ya tengo cuenta
              </Link>
            </div>
          )}
          <p className="text-xs text-muted text-center mt-3">
            Se copia la estructura. Los pesos y las notas no se comparten.
          </p>
        </div>
      </div>
    </main>
  );
}
