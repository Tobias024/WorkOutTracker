"use client";

import { useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Dumbbell,
  Plus,
  ChevronRight,
  Library,
  ListChecks,
  Check,
  Share2,
  Zap,
  Upload,
  FileDown,
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
  useImportRoutine,
} from "@/hooks/useRoutines";
import { useStartEmptyWorkout } from "@/hooks/useWorkout";
import { useExercises, useExerciseMap } from "@/hooks/useExercises";
import { useHistory } from "@/hooks/useHistory";
import { copyToClipboard } from "@/lib/clipboard";
import { readWorkbook } from "@/lib/import-xlsx";
import { buildRoutineTemplate } from "@/lib/routine-template";
import { downloadWorkbook } from "@/lib/export-xlsx";
import { formatDate } from "@/lib/format";
import { clsx } from "@/lib/clsx";

type ImportPreview = {
  name: string;
  items: { exerciseId: string; plans: { target_reps: number | null; target_weight: number | null }[] }[];
  unmatched: string[];
  exCount: number;
  setCount: number;
};

function numOrNull(v: string | number | null): number | null {
  if (v == null || v === "") return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

export default function RoutinesPage() {
  const router = useRouter();
  const { data, isLoading } = useRoutines();
  const create = useCreateRoutine();
  const ensureCodes = useEnsureShareCodes();
  const startEmpty = useStartEmptyWorkout();
  const importRoutine = useImportRoutine();
  const { data: exercises } = useExercises();
  const { data: history } = useHistory();
  const exMap = useExerciseMap();
  const fileRef = useRef<HTMLInputElement>(null);
  const [importPreview, setImportPreview] = useState<ImportPreview | null>(null);
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

  async function handleTemplate() {
    await downloadWorkbook(
      "wolf-template-rutina.xlsx",
      buildRoutineTemplate(exercises ?? [], history ?? [], exMap),
    );
  }

  async function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = ""; // permite re-elegir el mismo archivo
    if (!file) return;
    try {
      const sheets = await readWorkbook(file);
      const key =
        Object.keys(sheets).find((k) => k.toLowerCase().startsWith("rutina")) ??
        Object.keys(sheets)[0];
      const rows = sheets[key] ?? [];
      const body =
        rows.length && String(rows[0]?.[0] ?? "").toLowerCase() === "slug"
          ? rows.slice(1)
          : rows;

      const slugMap = new Map(
        (exercises ?? []).map((x) => [x.slug.toLowerCase(), x]),
      );
      const nameMap = new Map(
        (exercises ?? []).map((x) => [x.name.trim().toLowerCase(), x]),
      );

      const order: string[] = [];
      const byEx = new Map<
        string,
        { target_reps: number | null; target_weight: number | null }[]
      >();
      const unmatched = new Set<string>();
      for (const r of body) {
        const slug = String(r[0] ?? "").trim();
        const nm = String(r[1] ?? "").trim();
        if (!slug && !nm) continue;
        const ex =
          (slug && slugMap.get(slug.toLowerCase())) ||
          (nm && nameMap.get(nm.toLowerCase())) ||
          null;
        if (!ex) {
          unmatched.add(slug || nm);
          continue;
        }
        if (!byEx.has(ex.id)) {
          byEx.set(ex.id, []);
          order.push(ex.id);
        }
        byEx
          .get(ex.id)!
          .push({ target_reps: numOrNull(r[3]), target_weight: numOrNull(r[4]) });
      }

      const items = order.map((id) => ({ exerciseId: id, plans: byEx.get(id)! }));
      setImportPreview({
        name: file.name.replace(/\.(xlsx|xls)$/i, "").trim() || "Rutina importada",
        items,
        unmatched: [...unmatched],
        exCount: items.length,
        setCount: items.reduce((a, it) => a + it.plans.length, 0),
      });
    } catch {
      alert("No se pudo leer el archivo. Usá el template .xlsx descargado.");
    }
  }

  async function doImport() {
    if (!importPreview || importPreview.items.length === 0) return;
    const id = await importRoutine.mutateAsync({
      name: importPreview.name,
      items: importPreview.items,
    });
    setImportPreview(null);
    router.push(`/rutinas/${id}`);
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
        <div className="grid grid-cols-2 gap-2.5 mb-4">
          <button
            disabled={startEmpty.isPending}
            onClick={async () => {
              const id = await startEmpty.mutateAsync();
              router.push(`/entrenar/${id}`);
            }}
            className="card flex items-center gap-2.5 p-3 text-left hover:ring-1 hover:ring-primary transition disabled:opacity-60"
          >
            <div className="size-9 rounded bg-primary/15 grid place-items-center shrink-0">
              <Zap className="size-5 text-primary" />
            </div>
            <span className="text-sm font-medium">Entrenar libre</span>
          </button>
          <Link
            href="/ejercicios"
            className="card flex items-center gap-2.5 p-3 hover:ring-1 hover:ring-primary transition"
          >
            <div className="size-9 rounded bg-surface-2 grid place-items-center shrink-0">
              <Library className="size-5 text-muted" />
            </div>
            <span className="text-sm font-medium">Catálogo</span>
          </Link>
          <button
            onClick={() => fileRef.current?.click()}
            className="card flex items-center gap-2.5 p-3 text-left hover:ring-1 hover:ring-primary transition"
          >
            <div className="size-9 rounded bg-surface-2 grid place-items-center shrink-0">
              <Upload className="size-5 text-muted" />
            </div>
            <span className="text-sm font-medium">Importar Excel</span>
          </button>
          <button
            onClick={handleTemplate}
            className="card flex items-center gap-2.5 p-3 text-left hover:ring-1 hover:ring-primary transition"
          >
            <div className="size-9 rounded bg-surface-2 grid place-items-center shrink-0">
              <FileDown className="size-5 text-muted" />
            </div>
            <span className="text-sm font-medium">Template Excel</span>
          </button>
          <input
            ref={fileRef}
            type="file"
            accept=".xlsx"
            className="hidden"
            onChange={handleFile}
          />
        </div>
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

      <Modal
        open={!!importPreview}
        onClose={() => setImportPreview(null)}
        title="Importar rutina"
      >
        {importPreview && (
          <div className="flex flex-col gap-3">
            {importPreview.items.length === 0 ? (
              <p className="text-sm text-muted">
                No se reconoció ningún ejercicio. Revisá que los slugs coincidan
                con la hoja “Ejercicios” del template.
              </p>
            ) : (
              <p className="text-sm text-muted">
                Vas a crear{" "}
                <span className="text-fg font-medium">{importPreview.name}</span>{" "}
                con {importPreview.exCount} ejercicios y {importPreview.setCount}{" "}
                series.
              </p>
            )}
            {importPreview.unmatched.length > 0 && (
              <div className="text-sm">
                <p className="text-danger mb-1">
                  No reconocidos ({importPreview.unmatched.length}):
                </p>
                <p className="text-muted text-xs break-words">
                  {importPreview.unmatched.join(", ")}
                </p>
              </div>
            )}
            <div className="flex gap-2 justify-end">
              <Button
                variant="secondary"
                onClick={() => setImportPreview(null)}
              >
                Cancelar
              </Button>
              <Button
                disabled={importPreview.items.length === 0}
                loading={importRoutine.isPending}
                onClick={doImport}
              >
                Importar
              </Button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
