"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { Dumbbell, Download } from "lucide-react";
import { Button, Spinner, Badge } from "@/components/ui";
import { ExerciseImage } from "@/components/ExerciseImage";
import { createClient } from "@/lib/supabase/client";
import type { RoutinePreview } from "@/lib/types";

export default function SharedRoutinePage() {
  const { shareCode } = useParams<{ shareCode: string }>();
  const router = useRouter();
  const [preview, setPreview] = useState<RoutinePreview | null>(null);
  const [loading, setLoading] = useState(true);
  const [authed, setAuthed] = useState(false);
  const [importing, setImporting] = useState(false);

  useEffect(() => {
    (async () => {
      const supabase = createClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();
      setAuthed(!!user);
      const { data } = await supabase.rpc("preview_routine", {
        p_share_code: shareCode,
      });
      setPreview(data as RoutinePreview | null);
      setLoading(false);
    })();
  }, [shareCode]);

  async function importRoutine() {
    if (!authed) {
      router.push(`/login?next=${encodeURIComponent(`/r/${shareCode}`)}`);
      return;
    }
    setImporting(true);
    const supabase = createClient();
    const { data, error } = await supabase.rpc("import_routine", {
      p_share_code: shareCode,
    });
    setImporting(false);
    if (error) {
      alert(error.message);
      return;
    }
    router.push(`/rutinas/${data}`);
  }

  if (loading) {
    return (
      <main className="min-h-dvh grid place-items-center">
        <Spinner />
      </main>
    );
  }

  if (!preview) {
    return (
      <main className="min-h-dvh flex flex-col items-center justify-center px-6 text-center">
        <div className="card p-8 max-w-sm">
          <h1 className="text-xl font-bold">Rutina no encontrada</h1>
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
    <main className="min-h-dvh px-4 py-8">
      <div className="mx-auto max-w-2xl">
        <div className="flex items-center gap-3 mb-1">
          <div className="size-11 rounded-xl bg-primary/15 grid place-items-center">
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
                className="size-11 rounded-lg shrink-0"
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

        <Button
          size="lg"
          className="w-full"
          onClick={importRoutine}
          loading={importing}
        >
          <Download className="size-5" />
          {authed ? "Copiar a mis rutinas" : "Iniciar sesión y copiar"}
        </Button>
        <p className="text-xs text-muted text-center mt-3">
          Se copia la estructura de la rutina. Los pesos no se comparten.
        </p>
      </div>
    </main>
  );
}
