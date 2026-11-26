// SPDX-License-Identifier: AGPL-3.0-only
"use client";

import { useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { createClient } from "@/lib/supabase/client";
import { useRouter } from "next/navigation";
import {
  Dumbbell,
  Plus,
  Library,
  ListChecks,
  Check,
  Share2,
  Zap,
  Upload,
  FileDown,
  MoreHorizontal,
  Play,
} from "lucide-react";
import {
  PageHeader,
  Button,
  buttonClasses,
  IconButton,
  Input,
  Field,
  Spinner,
  Badge,
  EmptyState,
  Modal,
  QueryState,
} from "@/components/ui";
import { ShareLinkModal, SheetMenuItem } from "@/components/ShareLinkModal";
import {
  useRoutines,
  useCreateRoutine,
  useEnsureShareCodes,
  useImportRoutine,
  type SetPlan,
} from "@/hooks/useRoutines";
import { useStartEmptyWorkout, useStartWorkout } from "@/hooks/useWorkout";
import { useExercises, useExerciseMap } from "@/hooks/useExercises";
import {
  historyQueryOptions,
  recentHistoryQueryOptions,
} from "@/hooks/useHistory";
import { useTrainingProfile } from "@/hooks/useGoal";
import { SUGGEST_WINDOW_DAYS, suggestRoutine } from "@/lib/metrics-goal";
import { readWorkbook } from "@/lib/import-xlsx";
import { buildRoutineTemplate } from "@/lib/routine-template";
import { downloadWorkbook } from "@/lib/export-xlsx";
import { formatDate } from "@/lib/format";
import { muscleEs } from "@/lib/i18n-exercise";
import { primaryMuscle } from "@/lib/muscle-contributions";
import { clsx } from "@/lib/clsx";

/** Estado del flujo de importar: leyendo el archivo, con error, o con vista previa. */
type ImportState =
  | { status: "reading" }
  | { status: "error"; message: string }
  | { status: "ready"; preview: ImportPreview };

type ImportPreview = {
  items: { exerciseId: string; plans: SetPlan[] }[];
  unmatched: string[];
  exCount: number;
  setCount: number;
};

function numOrNull(v: string | number | null): number | null {
  if (v == null || v === "") return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

/**
 * Igual que `numOrNull` pero redondeando: `duracion_seg` y `distancia_m` son
 * columnas `integer`, y una planilla armada a mano trae decimales sin querer
 * (una celda con fórmula, un `62,7`). Mandarlos crudos deja que la base decida
 * qué hacer con el resto.
 */
function intOrNull(v: string | number | null): number | null {
  const n = numOrNull(v);
  return n == null ? null : Math.round(n);
}

/** "Mi_rutina (3).xlsx" -> "Mi rutina": sin extensión, sin sufijo de copia ni guiones bajos. */
function cleanRoutineName(fileName: string): string {
  const base = fileName
    .replace(/\.(xlsx|xls)$/i, "")
    .replace(/[_]+/g, " ")
    .replace(/\s*\(\d+\)\s*$/, "")
    .replace(/\s+/g, " ")
    .trim();
  return (base || "Rutina importada").slice(0, 60);
}

/** Resumen de músculos principales más frecuentes de una rutina (máx. 3). */
function topMuscles(
  ids: string[],
  exMap: ReturnType<typeof useExerciseMap>,
): string[] {
  const count = new Map<string, number>();
  for (const id of ids) {
    const ex = exMap.get(id);
    const m = ex ? primaryMuscle(ex) : null;
    if (m) count.set(m, (count.get(m) ?? 0) + 1);
  }
  return [...count.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3)
    .map(([m]) => muscleEs(m));
}

export default function RoutinesPage() {
  const router = useRouter();
  const routinesQuery = useRoutines();
  const data = routinesQuery.data;
  const create = useCreateRoutine();
  const ensureCodes = useEnsureShareCodes();
  const startEmpty = useStartEmptyWorkout();
  const startRoutine = useStartWorkout();
  const importRoutine = useImportRoutine();
  const { data: exercises } = useExercises();
  const qc = useQueryClient();
  const { data: lastSessions } = useQuery({
    queryKey: ["history", "last-session-by-routine"],
    staleTime: 5 * 60_000,
    queryFn: async () => {
      const { data, error } = await createClient().rpc("last_session_by_routine");
      if (error) throw error;
      return data ?? [];
    },
  });
  const exMap = useExerciseMap();
  const { data: recent } = useQuery(
    recentHistoryQueryOptions(SUGGEST_WINDOW_DAYS),
  );
  const { data: prefs } = useTrainingProfile();
  const profile = prefs?.trainingProfile ?? null;
  const fileRef = useRef<HTMLInputElement>(null);
  const [importState, setImportState] = useState<ImportState | null>(null);
  const [importName, setImportName] = useState("");
  const [importError, setImportError] = useState<string | null>(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [createError, setCreateError] = useState<string | null>(null);

  // Modo selección para compartir varias rutinas a la vez.
  const [selecting, setSelecting] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [shareUrl, setShareUrl] = useState<string | null>(null);
  const [shareError, setShareError] = useState<string | null>(null);
  const [shareCount, setShareCount] = useState(0);

  // "Seguir entrenando": no la última hecha (recién la hiciste), sino la que
  // mejor combina músculos listos + más tiempo sin hacerla (ver suggestRoutine).
  // Sólo baja las sesiones de la ventana, no el historial entero.
  const lastRoutine = useMemo(() => {
    if (!data || !lastSessions || !recent || exMap.size === 0) return null;
    const lastBy = new Map(
      lastSessions.map((s) => [s.routine_id, new Date(s.last_at).getTime()]),
    );
    const pick = suggestRoutine(
      data,
      lastBy,
      recent.sessions,
      exMap,
      recent.now,
      profile,
    );
    const routine = pick && data.find((r) => r.id === pick.routineId);
    if (!pick || !routine) return null;
    const last = lastSessions.find((s) => s.routine_id === routine.id);
    return {
      routine,
      when: last?.last_at ?? null,
      readyMuscles: pick.readyMuscles.map((m, i) =>
        i === 0 ? muscleEs(m) : muscleEs(m).toLowerCase(),
      ),
    };
  }, [data, lastSessions, recent, exMap, profile]);

  const startingId = startRoutine.isPending ? startRoutine.variables : null;

  function handleStart(routineId: string) {
    startRoutine.mutate(routineId, {
      onSuccess: (sessionId) => router.push(`/entrenar/${sessionId}`),
    });
  }

  function closeCreate() {
    setOpen(false);
    setName("");
    setCreateError(null);
  }

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) return;
    setCreateError(null);
    try {
      const routine = await create.mutateAsync(name.trim());
      closeCreate();
      router.push(`/rutinas/${routine.id}`);
    } catch {
      setCreateError("No pudimos crear la rutina. Probá de nuevo.");
    }
  }

  function exitSelect() {
    setSelecting(false);
    setSelected(new Set());
    setShareError(null);
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
    setShareError(null);
    try {
      const codes = await ensureCodes.mutateAsync(chosen);
      const base = process.env.NEXT_PUBLIC_SITE_URL ?? window.location.origin;
      setShareCount(chosen.length);
      setShareUrl(`${base}/r/bundle?c=${codes.join(",")}`);
    } catch {
      setShareError("No pudimos generar el link. Probá de nuevo.");
    }
  }

  function closeShare() {
    setShareUrl(null);
    exitSelect();
  }

  async function handleTemplate() {
    const history = await qc.fetchQuery(historyQueryOptions);
    await downloadWorkbook(
      "wolf-template-rutina.xlsx",
      buildRoutineTemplate(exercises ?? [], history, exMap),
    );
  }

  async function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = ""; // permite re-elegir el mismo archivo
    if (!file) return;
    setImportError(null);
    setImportState({ status: "reading" });
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
        SetPlan[]
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
          .push({
            target_reps: numOrNull(r[3]),
            target_weight: numOrNull(r[4]),
            // Columnas agregadas al final: una plantilla vieja no las trae y
            // `numOrNull(undefined)` da null, así que sigue importando igual.
            target_duration_seconds: intOrNull(r[5]),
            target_distance_m: intOrNull(r[6]),
          });
      }

      const items = order.map((id) => ({ exerciseId: id, plans: byEx.get(id)! }));
      setImportName(cleanRoutineName(file.name));
      setImportState({
        status: "ready",
        preview: {
          items,
          unmatched: [...unmatched],
          exCount: items.length,
          setCount: items.reduce((a, it) => a + it.plans.length, 0),
        },
      });
    } catch {
      setImportState({
        status: "error",
        message: "No se pudo leer el archivo. Usá el template .xlsx descargado.",
      });
    }
  }

  function closeImport() {
    setImportState(null);
    setImportError(null);
  }

  async function doImport() {
    if (importState?.status !== "ready") return;
    const { preview } = importState;
    const finalName = importName.trim();
    if (preview.items.length === 0 || !finalName) return;
    setImportError(null);
    try {
      const id = await importRoutine.mutateAsync({
        name: finalName,
        items: preview.items,
      });
      closeImport();
      router.push(`/rutinas/${id}`);
    } catch {
      setImportError("No pudimos importar la rutina. Probá de nuevo.");
    }
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
            <div className="flex items-center gap-1">
              <Button size="md" onClick={() => setOpen(true)}>
                <Plus className="size-4" /> Nueva
              </Button>
              <IconButton label="Más opciones" onClick={() => setMenuOpen(true)}>
                <MoreHorizontal className="size-5" />
              </IconButton>
            </div>
          )
        }
      />

      <input
        ref={fileRef}
        type="file"
        accept=".xlsx"
        className="hidden"
        onChange={handleFile}
      />

      {!selecting && lastRoutine && (
        <section
          aria-label="Seguir entrenando"
          className="card mb-3 flex flex-col gap-3 p-4"
        >
          <div className="min-w-0">
            <p className="text-xs uppercase tracking-wide text-muted">
              Seguir entrenando
            </p>
            <p className="mt-0.5 truncate text-lg font-semibold">
              {lastRoutine.routine.name}
            </p>
            <p className="text-xs text-muted">
              {lastRoutine.when && `Última vez: ${formatDate(lastRoutine.when)}`}
              {lastRoutine.when && lastRoutine.readyMuscles.length > 0 && " · "}
              {lastRoutine.readyMuscles.length > 0 &&
                `${lastRoutine.readyMuscles.join(" y ")} ${lastRoutine.readyMuscles.length > 1 ? "listos" : "listo"}`}
            </p>
          </div>
          <Button
            size="lg"
            className="w-full"
            loading={startingId === lastRoutine.routine.id}
            disabled={startRoutine.isPending}
            onClick={() => handleStart(lastRoutine.routine.id)}
          >
            <Play className="size-5" /> Empezar {lastRoutine.routine.name}
          </Button>
        </section>
      )}

      {!selecting && (
        <div className="grid grid-cols-2 gap-2.5 mb-4">
          <Button
            variant="secondary"
            loading={startEmpty.isPending}
            onClick={async () => {
              try {
                const id = await startEmpty.mutateAsync();
                router.push(`/entrenar/${id}`);
              } catch {
                // El toast global de mutaciones ya avisa del error.
              }
            }}
          >
            <Zap className="size-4" /> Entrenar libre
          </Button>
          <Link href="/ejercicios" className={buttonClasses({ variant: "secondary" })}>
            <Library className="size-4" /> Catálogo
          </Link>
        </div>
      )}

      {selecting && (
        <p className="text-sm text-muted mb-3">
          Elegí las rutinas que querés compartir en un solo link.
        </p>
      )}

      <QueryState
        query={routinesQuery}
        errorTitle="No pudimos cargar tus rutinas"
        isEmpty={(d) => d.length === 0}
        empty={
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
        }
      >
        {(routines) => (
          <ul className="flex flex-col gap-2.5">
            {routines.map((r) => {
              const n = r.exercise_ids.length;
              const muscles = topMuscles(r.exercise_ids, exMap);
              const summary = [
                n === 0 ? "Sin ejercicios" : `${n} ejercicio${n === 1 ? "" : "s"}`,
                ...(muscles.length ? [muscles.join(", ")] : []),
              ].join(" · ");
              return selecting ? (
                <li key={r.id}>
                  <button
                    onClick={() => toggle(r.id)}
                    aria-pressed={selected.has(r.id)}
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
                      <p className="text-xs text-muted truncate">{summary}</p>
                    </div>
                  </button>
                </li>
              ) : (
                <li
                  key={r.id}
                  className="card flex items-center pr-2 hover:ring-1 hover:ring-primary transition"
                >
                  {/* El play es hermano del Link (no hijo): un botón dentro de
                      un <a> es HTML inválido y el tap navegaría igual. */}
                  <Link
                    href={`/rutinas/${r.id}`}
                    className="flex min-w-0 flex-1 items-center gap-3 p-4"
                  >
                    <div className="size-10 shrink-0 rounded-md bg-primary/15 grid place-items-center">
                      <Dumbbell className="size-5 text-primary" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="font-semibold truncate">{r.name}</p>
                      <p className="text-xs text-muted truncate">{summary}</p>
                      <p className="mt-0.5 flex items-center gap-1.5 text-xs text-muted">
                        Actualizada {formatDate(r.updated_at)}
                        {r.share_code && <Badge>Compartida</Badge>}
                      </p>
                    </div>
                  </Link>
                  <IconButton
                    label={`Empezar ${r.name}`}
                    tone="primary"
                    disabled={n === 0 || startRoutine.isPending}
                    onClick={() => handleStart(r.id)}
                  >
                    {startingId === r.id ? (
                      <Spinner />
                    ) : (
                      <Play className="size-5" />
                    )}
                  </IconButton>
                </li>
              );
            })}
          </ul>
        )}
      </QueryState>

      {/* Barra inferior de acción en modo selección (por encima de la TabBar). */}
      {selecting && (
        <div className="fixed inset-x-0 bottom-20 px-4 z-30">
          <div className="mx-auto max-w-2xl flex flex-col gap-2">
            {shareError && (
              <p role="alert" className="card px-3 py-2 text-sm text-danger">
                {shareError}
              </p>
            )}
            <Button
              size="lg"
              className="w-full shadow-lg"
              disabled={selected.size === 0}
              loading={ensureCodes.isPending}
              onClick={shareSelected}
            >
              <Share2 className="size-5" />{" "}
              {selected.size === 0
                ? "Elegí al menos una"
                : `Compartir ${selected.size} ${selected.size === 1 ? "rutina" : "rutinas"}`}
            </Button>
          </div>
        </div>
      )}

      <Modal open={menuOpen} onClose={() => setMenuOpen(false)} title="Más opciones">
        <div className="flex flex-col">
          <SheetMenuItem
            icon={<Upload className="size-5" />}
            onClick={() => {
              setMenuOpen(false);
              fileRef.current?.click();
            }}
          >
            Importar Excel
          </SheetMenuItem>
          <SheetMenuItem
            icon={<FileDown className="size-5" />}
            onClick={() => {
              setMenuOpen(false);
              void handleTemplate();
            }}
          >
            Template Excel
          </SheetMenuItem>
          {hasRoutines && (
            <SheetMenuItem
              icon={<ListChecks className="size-5" />}
              onClick={() => {
                setMenuOpen(false);
                setSelecting(true);
              }}
            >
              Compartir varias
            </SheetMenuItem>
          )}
        </div>
      </Modal>

      <Modal open={open} onClose={closeCreate} title="Nueva rutina">
        <form onSubmit={handleCreate} className="flex flex-col gap-3">
          <Field label="Nombre de la rutina" error={createError}>
            <Input
              autoFocus
              maxLength={60}
              placeholder="Ej: Push día 1"
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          </Field>
          <Button
            type="submit"
            loading={create.isPending}
            disabled={!name.trim()}
          >
            Crear
          </Button>
        </form>
      </Modal>

      <ShareLinkModal
        open={!!shareUrl}
        onClose={closeShare}
        url={shareUrl ?? ""}
        title={`Compartir ${shareCount} ${shareCount === 1 ? "rutina" : "rutinas"}`}
      />

      <Modal
        open={!!importState}
        onClose={closeImport}
        title="Importar rutina"
      >
        {importState?.status === "reading" && (
          <div className="flex items-center justify-center gap-3 py-8 text-sm text-muted">
            <Spinner /> Leyendo el archivo…
          </div>
        )}
        {importState?.status === "error" && (
          <div className="flex flex-col gap-3">
            <p role="alert" className="text-sm text-danger">
              {importState.message}
            </p>
            <div className="flex gap-2 justify-end">
              <Button variant="secondary" onClick={closeImport}>
                Cerrar
              </Button>
              <Button
                onClick={() => {
                  closeImport();
                  fileRef.current?.click();
                }}
              >
                Elegir otro archivo
              </Button>
            </div>
          </div>
        )}
        {importState?.status === "ready" && (
          <div className="flex flex-col gap-3">
            {importState.preview.items.length === 0 ? (
              <p className="text-sm text-muted">
                No se reconoció ningún ejercicio. Revisá que los slugs coincidan
                con la hoja “Ejercicios” del template.
              </p>
            ) : (
              <>
                <Field label="Nombre de la rutina">
                  <Input
                    maxLength={60}
                    value={importName}
                    onChange={(e) => setImportName(e.target.value)}
                  />
                </Field>
                <p className="text-sm text-muted">
                  {importState.preview.exCount} ejercicios y{" "}
                  {importState.preview.setCount} series.
                </p>
              </>
            )}
            {importState.preview.unmatched.length > 0 && (
              <div className="text-sm">
                <p className="text-danger mb-1">
                  No reconocidos ({importState.preview.unmatched.length}):
                </p>
                <p className="text-muted text-xs break-words">
                  {importState.preview.unmatched.join(", ")}
                </p>
              </div>
            )}
            {importError && (
              <p role="alert" className="text-sm text-danger">
                {importError}
              </p>
            )}
            <div className="flex gap-2 justify-end">
              <Button variant="secondary" onClick={closeImport}>
                Cancelar
              </Button>
              <Button
                disabled={
                  importState.preview.items.length === 0 || !importName.trim()
                }
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
