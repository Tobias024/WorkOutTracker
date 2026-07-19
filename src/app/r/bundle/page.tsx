"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Dumbbell, Download, Check } from "lucide-react";
import { Button, Spinner, Badge } from "@/components/ui";
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
  }, []);

  function toggle(code: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(code)) next.delete(code);
      else next.add(code);
      return next;
    });
  }

  async function importSelected() {
    const chosen = items.filter((it) => it.preview && selected.has(it.code));
    if (chosen.length === 0) return;
    if (!authed) {
      router.push(
        `/login?next=${encodeURIComponent(`/r/bundle?c=${codesParam}`)}`,
      );
      return;
    }
    setImporting(true);
    const supabase = createClient();
    for (const it of chosen) {
      await supabase.rpc("import_routine", { p_share_code: it.code });
    }
    setImporting(false);
    router.push("/rutinas");
  }

  if (loading) {
    return (
      <main className="min-h-dvh grid place-items-center">
        <Spinner />
      </main>
    );
  }

  const valid = items.filter((it) => it.preview);

  if (valid.length === 0) {
    return (
      <main className="min-h-dvh flex flex-col items-center justify-center px-6 text-center">
        <div className="card p-8 max-w-sm">
          <h1 className="text-xl font-bold">Rutinas no encontradas</h1>
          <p className="text-sm text-muted mt-1 mb-5">
            El link puede ser inválido.
          </p>
          <Link href="/rutinas">
            <Button variant="secondary" className="w-full">
              Ir al inicio
            </Button>
          </Link>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-dvh px-4 py-8 pb-28">
      <div className="mx-auto max-w-2xl">
        <div className="flex items-center gap-3 mb-1">
          <div className="size-11 rounded-md bg-primary/15 grid place-items-center">
            <Dumbbell className="size-6 text-primary" />
          </div>
          <div>
            <p className="text-xs text-muted">Rutinas compartidas</p>
            <h1 className="text-2xl font-bold">{valid.length} rutinas</h1>
          </div>
        </div>
        <p className="text-sm text-muted mb-4">
          Elegí cuáles querés copiar a tus rutinas.
        </p>

        <ul className="flex flex-col gap-2.5">
          {items.map((it) =>
            it.preview ? (
              <li key={it.code}>
                <button
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
                <div className="card p-4 opacity-60 text-sm text-muted">
                  Una de las rutinas no se encontró (link inválido).
                </div>
              </li>
            ),
          )}
        </ul>
      </div>

      <div className="fixed inset-x-0 bottom-4 px-4">
        <div className="mx-auto max-w-2xl">
          <Button
            size="lg"
            className="w-full shadow-lg"
            disabled={selected.size === 0}
            loading={importing}
            onClick={importSelected}
          >
            <Download className="size-5" />
            {authed
              ? `Copiar ${selected.size || ""} a mis rutinas`
              : "Iniciar sesión y copiar"}
          </Button>
          <p className="text-xs text-muted text-center mt-3">
            Se copia la estructura. Los pesos y las notas no se comparten.
          </p>
        </div>
      </div>
    </main>
  );
}
