"use client";

import { useState } from "react";
import Link from "next/link";
import {
  Dumbbell,
  Plus,
  ChevronRight,
  Library,
  ListChecks,
  Check,
  Share2,
} from "lucide-react";
import {
  PageHeader,
  Button,
  Input,
  Spinner,
  EmptyState,
  Modal,
} from "@/components/ui";
import {
  useRoutines,
  useCreateRoutine,
  useEnsureShareCodes,
} from "@/hooks/useRoutines";
import { copyToClipboard } from "@/lib/clipboard";
import { formatDate } from "@/lib/format";
import { clsx } from "@/lib/clsx";

export default function RoutinesPage() {
  const { data, isLoading } = useRoutines();
  const create = useCreateRoutine();
  const ensureCodes = useEnsureShareCodes();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");

  // Modo selección para compartir varias rutinas a la vez.
  const [selecting, setSelecting] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [shareUrl, setShareUrl] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) return;
    const routine = await create.mutateAsync(name.trim());
    setOpen(false);
    setName("");
    window.location.href = `/rutinas/${routine.id}`;
  }

  function exitSelect() {
    setSelecting(false);
    setSelected(new Set());
  }

  function toggle(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  async function shareSelected() {
    const chosen = (data ?? []).filter((r) => selected.has(r.id));
    if (chosen.length === 0) return;
    const codes = await ensureCodes.mutateAsync(chosen);
    const base =
      process.env.NEXT_PUBLIC_SITE_URL ?? window.location.origin;
    const url = `${base}/r/bundle?c=${codes.join(",")}`;
    setShareUrl(url);
    setCopied(await copyToClipboard(url));
  }

  function closeShare() {
    setShareUrl(null);
    setCopied(false);
    exitSelect();
  }

  const hasRoutines = !!data?.length;

  return (
    <div className={selecting ? "pb-24" : undefined}>
      <PageHeader
        title="Rutinas"
        subtitle="Tus planes de entrenamiento"
        action={
          selecting ? (
            <Button size="sm" variant="ghost" onClick={exitSelect}>
              Cancelar
            </Button>
          ) : (
            <div className="flex gap-2">
              {hasRoutines && (
                <Button
                  size="sm"
                  variant="secondary"
                  onClick={() => setSelecting(true)}
                >
                  <ListChecks className="size-4" /> Compartir
                </Button>
              )}
              <Button size="sm" onClick={() => setOpen(true)}>
                <Plus className="size-4" /> Nueva
              </Button>
            </div>
          )
        }
      />

      {!selecting && (
        <Link
          href="/ejercicios"
          className="card flex items-center gap-3 p-3 mb-4 hover:ring-1 hover:ring-primary transition"
        >
          <div className="size-9 rounded bg-surface-2 grid place-items-center">
            <Library className="size-5 text-muted" />
          </div>
          <span className="text-sm font-medium flex-1">
            Explorar catálogo de ejercicios
          </span>
          <ChevronRight className="size-4 text-muted" />
        </Link>
      )}

      {selecting && (
        <p className="text-sm text-muted mb-3">
          Elegí las rutinas que querés compartir en un solo link.
        </p>
      )}

      {isLoading ? (
        <div className="grid place-items-center py-16">
          <Spinner />
        </div>
      ) : !hasRoutines ? (
        <EmptyState
          icon={<Dumbbell className="size-8" />}
          title="Todavía no tenés rutinas"
          description="Creá tu primera rutina y agregale ejercicios."
          action={
            <Button onClick={() => setOpen(true)}>
              <Plus className="size-4" /> Crear rutina
            </Button>
          }
        />
      ) : (
        <ul className="flex flex-col gap-2.5">
          {data!.map((r) =>
            selecting ? (
              <li key={r.id}>
                <button
                  onClick={() => toggle(r.id)}
                  className={clsx(
                    "card flex items-center gap-3 p-4 w-full text-left transition",
                    selected.has(r.id)
                      ? "ring-1 ring-primary"
                      : "hover:ring-1 hover:ring-border",
                  )}
                >
                  <div
                    className={clsx(
                      "size-6 rounded-md grid place-items-center shrink-0 ring-1 transition",
                      selected.has(r.id)
                        ? "bg-primary text-primary-fg ring-primary"
                        : "bg-surface-2 ring-border text-transparent",
                    )}
                  >
                    <Check className="size-4" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="font-semibold truncate">{r.name}</p>
                    <p className="text-xs text-muted">
                      Actualizada {formatDate(r.updated_at)}
                    </p>
                  </div>
                </button>
              </li>
            ) : (
              <li key={r.id}>
                <Link
                  href={`/rutinas/${r.id}`}
                  className="card flex items-center gap-3 p-4 hover:ring-1 hover:ring-primary transition"
                >
                  <div className="size-10 rounded-md bg-primary/15 grid place-items-center">
                    <Dumbbell className="size-5 text-primary" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="font-semibold truncate">{r.name}</p>
                    <p className="text-xs text-muted">
                      Actualizada {formatDate(r.updated_at)}
                      {r.share_code && " · Compartida"}
                    </p>
                  </div>
                  <ChevronRight className="size-5 text-muted" />
                </Link>
              </li>
            ),
          )}
        </ul>
      )}

      {/* Barra inferior de acción en modo selección (por encima de la TabBar). */}
      {selecting && (
        <div className="fixed inset-x-0 bottom-20 px-4 z-30">
          <div className="mx-auto max-w-2xl">
            <Button
              size="lg"
              className="w-full shadow-lg"
              disabled={selected.size === 0}
              loading={ensureCodes.isPending}
              onClick={shareSelected}
            >
              <Share2 className="size-5" /> Compartir {selected.size || ""}
            </Button>
          </div>
        </div>
      )}

      <Modal open={open} onClose={() => setOpen(false)} title="Nueva rutina">
        <form onSubmit={handleCreate} className="flex flex-col gap-3">
          <Input
            autoFocus
            placeholder="Ej: Push día 1"
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
          <Button type="submit" loading={create.isPending}>
            Crear
          </Button>
        </form>
      </Modal>

      <Modal
        open={!!shareUrl}
        onClose={closeShare}
        title={`Compartir ${selected.size} rutina${selected.size === 1 ? "" : "s"}`}
      >
        <div className="flex flex-col gap-3">
          <p className="text-sm text-muted">
            {copied
              ? "¡Link copiado! Pegáselo a quien quieras."
              : "Copiá este link y pasáselo a quien quieras."}
          </p>
          <Input readOnly value={shareUrl ?? ""} onFocus={(e) => e.target.select()} />
          <Button
            onClick={async () => setCopied(await copyToClipboard(shareUrl ?? ""))}
          >
            {copied ? (
              <>
                <Check className="size-4" /> Copiado
              </>
            ) : (
              "Copiar link"
            )}
          </Button>
          <p className="text-xs text-muted text-center">
            Se comparte la estructura. Tus pesos y notas no se comparten.
          </p>
        </div>
      </Modal>
    </div>
  );
}
