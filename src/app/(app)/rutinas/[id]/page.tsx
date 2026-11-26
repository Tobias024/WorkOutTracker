// SPDX-License-Identifier: AGPL-3.0-only
"use client";

import { useEffect, useRef, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { useIsMutating, useQueryClient } from "@tanstack/react-query";
import Link from "next/link";
import {
  ArrowLeft,
  Plus,
  Share2,
  Trash2,
  ChevronUp,
  ChevronDown,
  Play,
  Check,
  CopyPlus,
  Repeat,
  X,
  MoreHorizontal,
} from "lucide-react";
import {
  Button,
  buttonClasses,
  iconButtonClasses,
  IconButton,
  Input,
  Spinner,
  Skeleton,
  Badge,
  Modal,
  ConfirmDialog,
  EmptyState,
} from "@/components/ui";
import { createClient } from "@/lib/supabase/client";
import { undoable } from "@/lib/toast";
import { newId } from "@/lib/uuid";
import { ExerciseImage } from "@/components/ExerciseImage";
import { ExercisePickerModal } from "@/components/ExercisePickerModal";
import { ExerciseDetailModal } from "@/components/ExerciseDetailModal";
import { ExerciseNoteEditor } from "@/components/ExerciseNoteEditor";
import { ReplaceExerciseModal } from "@/components/ReplaceExerciseModal";
import { ShareLinkModal, SheetMenuItem } from "@/components/ShareLinkModal";
import { DurationField } from "@/components/DurationField";
import type { MetricKind, TrainingProfile } from "@/lib/types";
import { planOutOfRange, repRangeLabel } from "@/lib/goal-params";
import {
  useRoutine,
  useUpdateRoutine,
  useRoutineExerciseOps,
  useDeleteRoutine,
  useShareRoutine,
  type RoutineExerciseWithSets,
  type SetPlan,
} from "@/hooks/useRoutines";
import {
  START_WORKOUT_KEY,
  useStartWorkout,
  useLastExerciseLogs,
  type LastExerciseLog,
} from "@/hooks/useWorkout";
import { useExerciseNote } from "@/hooks/useExerciseNotes";
import { useTrainingProfile } from "@/hooks/useGoal";
import { useExerciseMap } from "@/hooks/useExercises";
import { muscleEs } from "@/lib/i18n-exercise";
import { primaryMuscle } from "@/lib/muscle-contributions";
import { clsx } from "@/lib/clsx";
import type { Exercise } from "@/lib/types";

export default function RoutineEditorPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const qc = useQueryClient();
  const routineQuery = useRoutine(id);
  const { data } = routineQuery;
  const exMap = useExerciseMap();
  const updateRoutine = useUpdateRoutine(id);
  const ops = useRoutineExerciseOps(id);
  const del = useDeleteRoutine();
  const share = useShareRoutine();
  const start = useStartWorkout();
  // Las mutaciones en vuelo de la rutina cuentan como "guardando". Arrancar el
  // entreno no: no guarda cambios de la rutina, y mostrarlo como guardado hacía
  // creer que "Empezar" esperaba a un guardado.
  const saving =
    useIsMutating({
      predicate: (m) => m.options.mutationKey?.[0] !== START_WORKOUT_KEY[0],
    }) > 0;
  // Último peso/reps por ejercicio (sesión terminada más reciente). Solo se
  // muestra como referencia: no pisa el plan de la rutina.
  const { data: lastLogs } = useLastExerciseLogs(
    (data?.exercises ?? []).map((r) => r.exercise_id),
  );
  const { data: prefs } = useTrainingProfile();
  const trainingProfile = prefs?.trainingProfile ?? null;

  const [picker, setPicker] = useState(false);
  const [menu, setMenu] = useState(false);
  const [shareUrl, setShareUrl] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [copying, setCopying] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  // Ejercicios "quitados" mientras corre el toast de Deshacer: se esconden
  // acá y la mutación real recién sale al vencer el toast.
  const [hidden, setHidden] = useState<Set<string>>(new Set());
  // Card recién movida: ring breve para que se vea adónde fue.
  const [movedId, setMovedId] = useState<string | null>(null);
  const movedTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(
    () => () => {
      if (movedTimer.current) clearTimeout(movedTimer.current);
    },
    [],
  );

  if (!data) {
    if (routineQuery.isPending) {
      return (
        <div className="flex flex-col gap-3" aria-busy="true">
          <Skeleton className="h-11 w-full" />
          <Skeleton className="h-40 w-full" />
          <Skeleton className="h-40 w-full" />
        </div>
      );
    }
    return (
      <EmptyState
        title="No encontramos esta rutina"
        description="Puede que la hayas borrado o que no tengas acceso. Si fue un problema de conexión, reintentá."
        action={
          <div className="flex flex-wrap justify-center gap-2">
            <Link href="/rutinas" className={buttonClasses({ variant: "secondary" })}>
              Volver a rutinas
            </Link>
            <Button
              loading={routineQuery.isFetching}
              onClick={() => void routineQuery.refetch()}
            >
              Reintentar
            </Button>
          </div>
        }
      />
    );
  }

  const { routine } = data;
  const exercises = data.exercises.filter((r) => !hidden.has(r.id));
  const addedIds = new Set(exercises.map((r) => r.exercise_id));

  async function handleShare() {
    setMenu(false);
    setActionError(null);
    try {
      const code = await share.mutateAsync(routine);
      const base = process.env.NEXT_PUBLIC_SITE_URL ?? window.location.origin;
      setShareUrl(`${base}/r/${code}`);
    } catch {
      setActionError("No pudimos generar el link. Probá de nuevo.");
    }
  }

  async function handleStart() {
    if (!exercises.length) return;
    try {
      const sessionId = await start.mutateAsync(id);
      router.push(`/entrenar/${sessionId}`);
    } catch {
      // El toast global de mutaciones ya avisa del error.
    }
  }

  async function handleDelete() {
    setDeleteError(null);
    try {
      await del.mutateAsync(id);
      router.push("/rutinas");
    } catch {
      setDeleteError("No pudimos eliminar la rutina. Probá de nuevo.");
    }
  }

  function removeExercise(rex: RoutineExerciseWithSets) {
    setHidden((h) => new Set(h).add(rex.id));
    undoable({
      message: "Ejercicio quitado",
      commit: () => ops.remove.mutate(rex.id),
      undo: () =>
        setHidden((h) => {
          const next = new Set(h);
          next.delete(rex.id);
          return next;
        }),
    });
  }

  function move(rex: RoutineExerciseWithSets, other: RoutineExerciseWithSets) {
    ops.swap.mutate({ a: rex, b: other });
    setMovedId(rex.id);
    if (movedTimer.current) clearTimeout(movedTimer.current);
    movedTimer.current = setTimeout(() => setMovedId(null), 1000);
  }

  async function handleCopy() {
    setMenu(false);
    setCopying(true);
    setActionError(null);
    try {
      const supabase = createClient();
      // duplicate_routine aún no está en los tipos generados de la DB.
      const { data: newId, error } = await (
        supabase.rpc as unknown as (
          fn: string,
          args: Record<string, unknown>,
        ) => PromiseLike<{ data: unknown; error: { code?: string; status?: number } | null }>
      ).call(supabase, "duplicate_routine", { p_routine_id: routine.id });
      let targetId = newId as string | null;
      if (error) {
        const missing =
          error.code === "PGRST202" ||
          error.code === "42883" ||
          error.status === 404;
        if (!missing) throw error;
        // Fallback (migración 0036 sin aplicar): compartir a uno mismo e importar.
        // Si la rutina no tenía share_code, se lo sacamos después para no dejarla pública.
        const hadCode = !!routine.share_code;
        const code = await share.mutateAsync(routine);
        const { data: importedId, error: e2 } = await supabase.rpc(
          "import_routine",
          { p_share_code: code },
        );
        if (!hadCode) {
          await supabase
            .from("routines")
            .update({ share_code: null })
            .eq("id", routine.id);
        }
        if (e2) throw e2;
        targetId = importedId as string;
      }
      qc.invalidateQueries({ queryKey: ["routines"] });
      router.push(`/rutinas/${targetId}`);
    } catch {
      setActionError("No pudimos duplicar la rutina. Probá de nuevo.");
      setCopying(false);
    }
  }

  return (
    <div className="pb-44">
      <div className="flex items-center gap-1">
        <Link
          href="/rutinas"
          aria-label="Volver a rutinas"
          className={iconButtonClasses({ size: "md", tone: "muted" })}
        >
          <ArrowLeft className="size-5" />
        </Link>
        {/* Nombre con estilo de título; el borde aparece recién en foco. */}
        <input
          key={routine.name}
          aria-label="Nombre de la rutina"
          defaultValue={routine.name}
          maxLength={60}
          onKeyDown={(e) => {
            if (e.key === "Enter") e.currentTarget.blur();
          }}
          onBlur={(e) => {
            const v = e.target.value.trim();
            if (!v) {
              // Vacío no es un nombre válido: se vuelve al anterior.
              e.target.value = routine.name;
              return;
            }
            if (v !== routine.name) updateRoutine.mutate({ name: v });
          }}
          className="min-h-11 min-w-0 flex-1 rounded-md bg-transparent px-2 text-2xl font-bold text-fg outline-none focus:ring-2 focus:ring-primary"
        />
        <IconButton label="Más opciones" onClick={() => setMenu(true)}>
          <MoreHorizontal className="size-5" />
        </IconButton>
      </div>
      <div
        className="mb-4 mt-1 flex items-center justify-between gap-2 px-2 text-xs text-muted"
        aria-live="polite"
      >
        <span>Los cambios se guardan solos</span>
        <span className="inline-flex items-center gap-1">
          {copying ? (
            "Duplicando…"
          ) : saving ? (
            <>
              <Spinner className="size-3" /> Guardando…
            </>
          ) : (
            <>
              <Check className="size-3.5" /> Guardado
            </>
          )}
        </span>
      </div>
      {actionError && (
        <p role="alert" className="mb-4 text-sm text-danger">
          {actionError}
        </p>
      )}

      {exercises.length === 0 ? (
        <div className="mb-4">
          <EmptyState
            title="Esta rutina está vacía"
            description="Agregá los ejercicios que querés hacer."
            action={
              <Button onClick={() => setPicker(true)}>
                <Plus className="size-4" /> Agregar ejercicio
              </Button>
            }
          />
        </div>
      ) : (
        <ul className="flex flex-col gap-2.5 mb-4">
          {exercises.map((rex, i) => (
            <RoutineExerciseRow
              key={rex.id}
              rex={rex}
              exercise={exMap.get(rex.exercise_id)}
              last={lastLogs?.get(rex.exercise_id)}
              profile={trainingProfile}
              isFirst={i === 0}
              isLast={i === exercises.length - 1}
              moved={movedId === rex.id}
              onSaveSets={(plans) =>
                ops.saveSets.mutate({ rexId: rex.id, plans })
              }
              onRemove={() => removeExercise(rex)}
              onReplace={(newEx) =>
                ops.replace.mutate({ id: rex.id, exerciseId: newEx.id })
              }
              onMoveUp={() => move(rex, exercises[i - 1])}
              onMoveDown={() => move(rex, exercises[i + 1])}
            />
          ))}
        </ul>
      )}

      {exercises.length > 0 && (
        <>
          <Button
            variant="secondary"
            className="w-full"
            onClick={() => setPicker(true)}
          >
            <Plus className="size-4" /> Agregar ejercicio
          </Button>

          <div className="fixed bottom-20 inset-x-0 px-4">
            <div className="mx-auto max-w-2xl">
              <Button
                size="lg"
                className="w-full shadow-lg"
                onClick={handleStart}
                loading={start.isPending}
              >
                <Play className="size-5" /> Empezar entrenamiento
              </Button>
            </div>
          </div>
        </>
      )}

      <ExercisePickerModal
        open={picker}
        onClose={() => setPicker(false)}
        multi
        addedIds={addedIds}
        onSelect={(ex) =>
          ops.add.mutate({
            id: newId(),
            exerciseId: ex.id,
            position:
              exercises.reduce((m, r) => Math.max(m, r.position), -1) + 1,
          })
        }
      />

      <Modal open={menu} onClose={() => setMenu(false)} title="Opciones de la rutina">
        <div className="flex flex-col">
          <SheetMenuItem
            icon={<Share2 className="size-5" />}
            onClick={handleShare}
          >
            Compartir
          </SheetMenuItem>
          <SheetMenuItem
            icon={<CopyPlus className="size-5" />}
            onClick={handleCopy}
          >
            Duplicar
          </SheetMenuItem>
          <div className="my-1 border-t border-border" />
          <SheetMenuItem
            danger
            icon={<Trash2 className="size-5" />}
            onClick={() => {
              setMenu(false);
              setDeleteError(null);
              setConfirmDelete(true);
            }}
          >
            Eliminar rutina
          </SheetMenuItem>
        </div>
      </Modal>

      <ConfirmDialog
        open={confirmDelete}
        title={`¿Eliminar «${routine.name}»?`}
        description="Se borra el plan. Tus entrenamientos registrados se mantienen."
        confirmLabel="Eliminar"
        tone="danger"
        loading={del.isPending}
        error={deleteError}
        onConfirm={handleDelete}
        onCancel={() => setConfirmDelete(false)}
      />

      <ShareLinkModal
        open={!!shareUrl}
        onClose={() => setShareUrl(null)}
        url={shareUrl ?? ""}
        title="Compartir rutina"
        privacyNote="Cualquiera con este link puede copiar tu rutina (sin tus pesos ni notas)."
      />
    </div>
  );
}

function RoutineExerciseRow({
  rex,
  exercise,
  last,
  profile,
  isFirst,
  isLast,
  moved,
  onSaveSets,
  onRemove,
  onReplace,
  onMoveUp,
  onMoveDown,
}: {
  rex: RoutineExerciseWithSets;
  exercise?: Exercise;
  last?: LastExerciseLog;
  /** Objetivo del usuario: marca las series planeadas fuera de su rango de reps. */
  profile?: TrainingProfile | null;
  isFirst: boolean;
  isLast: boolean;
  /** Se acaba de mover: resalta la card un instante. */
  moved: boolean;
  onSaveSets: (plans: SetPlan[]) => void;
  onRemove: () => void;
  onReplace: (newExercise: Exercise) => void;
  onMoveUp: () => void;
  onMoveDown: () => void;
}) {
  const [detail, setDetail] = useState(false);
  const [replace, setReplace] = useState(false);
  const { data: note } = useExerciseNote(rex.exercise_id);

  return (
    <li
      className={clsx(
        "card p-3 transition-shadow",
        moved && "ring-1 ring-primary",
      )}
    >
      <button
        onClick={() => setDetail(true)}
        className="flex w-full items-center gap-3 min-w-0 text-left"
      >
        <ExerciseImage
          src={exercise?.images[0]}
          alt={exercise?.name ?? ""}
          className="size-12 rounded shrink-0"
        />
        <div className="min-w-0 flex-1">
          <p className="font-medium truncate">{exercise?.name ?? "…"}</p>
          {exercise && primaryMuscle(exercise) && (
            <Badge>{muscleEs(primaryMuscle(exercise))}</Badge>
          )}
        </div>
      </button>
      {/* Controles en su propia fila: a 360px cuatro botones al lado del
          nombre lo dejaban en ~90px. Reemplazar y Quitar van separados. */}
      <div className="mt-2 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <IconButton
            size="sm"
            label="Mover arriba"
            disabled={isFirst}
            onClick={onMoveUp}
            className="disabled:opacity-40"
          >
            <ChevronUp className="size-4" />
          </IconButton>
          <IconButton
            size="sm"
            label="Mover abajo"
            disabled={isLast}
            onClick={onMoveDown}
            className="disabled:opacity-40"
          >
            <ChevronDown className="size-4" />
          </IconButton>
        </div>
        <div className="flex items-center gap-2">
          <IconButton
            size="sm"
            label="Reemplazar ejercicio"
            onClick={() => setReplace(true)}
          >
            <Repeat className="size-4" />
          </IconButton>
          <IconButton
            size="sm"
            tone="danger"
            label="Quitar ejercicio"
            onClick={onRemove}
            className="ml-2"
          >
            <Trash2 className="size-4" />
          </IconButton>
        </div>
      </div>

      <SetPlanner
        sets={rex.sets}
        kind={exercise?.metric_kind ?? "reps_weight"}
        last={last}
        profile={profile}
        onSave={onSaveSets}
      />

      <ExerciseNoteEditor exerciseId={rex.exercise_id} initial={note ?? ""} />

      <ExerciseDetailModal
        exercise={detail ? exercise ?? null : null}
        onClose={() => setDetail(false)}
      />
      <ReplaceExerciseModal
        open={replace}
        onClose={() => setReplace(false)}
        currentName={exercise?.name ?? ""}
        currentMuscle={exercise ? primaryMuscle(exercise) ?? undefined : undefined}
        canSaveForFuture={false}
        onReplace={(newEx) => {
          onReplace(newEx);
          setReplace(false);
        }}
      />
    </li>
  );
}

/** Editor de series planeadas: reps + peso por serie, para planear la progresión. */
function SetPlanner({
  sets,
  kind,
  last,
  profile,
  onSave,
}: {
  sets: {
    target_reps: number | null;
    target_weight: number | null;
    target_duration_seconds?: number | null;
    target_distance_m?: number | null;
  }[];
  /** Mismo criterio que SetRow: el tipo del ejercicio decide qué se planifica. */
  kind: MetricKind;
  last?: LastExerciseLog;
  profile?: TrainingProfile | null;
  onSave: (plans: SetPlan[]) => void;
}) {
  const showsLoad = kind === "reps_weight" || kind === "time_load";
  const showsReps = kind === "reps_weight";
  const showsDuration = kind !== "reps_weight";
  const showsDistance = kind === "distance_time";
  const [rows, setRows] = useState<SetPlan[]>(
    sets.length
      ? sets.map((s) => ({
          target_reps: s.target_reps,
          target_weight: s.target_weight,
          target_duration_seconds: s.target_duration_seconds ?? null,
          target_distance_m: s.target_distance_m ?? null,
        }))
      : [
          {
            target_reps: showsReps ? 10 : null,
            target_weight: null,
            target_duration_seconds: null,
            target_distance_m: null,
          },
        ],
  );

  // Últimos valores para el commit/undo del toast, que se ejecutan segundos
  // después (y quizá con la fila ya desmontada).
  const rowsRef = useRef(rows);
  const onSaveRef = useRef(onSave);
  useEffect(() => {
    rowsRef.current = rows;
    onSaveRef.current = onSave;
  });

  function updateRow(i: number, patch: Partial<SetPlan>) {
    setRows((rs) => rs.map((r, idx) => (idx === i ? { ...r, ...patch } : r)));
  }

  /**
   * Actualiza y guarda en el mismo paso, con las filas YA actualizadas.
   *
   * Los campos que editan en `onChange` pueden guardar después en un `onBlur`
   * suelto, porque para entonces el componente ya re-renderizó y `rows` está
   * fresco. El de duración no: actualiza y guarda en el mismo `onBlur`, así que
   * un `onSave(rows)` ahí manda el estado del render ANTERIOR — el mm:ss recién
   * tipeado no viajaba, y se perdía salvo que después se tocara otra celda.
   */
  function commitRow(i: number, patch: Partial<SetPlan>) {
    setRows((rs) => {
      const next = rs.map((r, idx) => (idx === i ? { ...r, ...patch } : r));
      onSave(next);
      return next;
    });
  }

  function addRow() {
    setRows((rs) => {
      const last = rs[rs.length - 1];
      const next = [
        ...rs,
        {
          target_reps: last?.target_reps ?? (showsReps ? 10 : null),
          target_weight: last?.target_weight ?? null,
          target_duration_seconds: last?.target_duration_seconds ?? null,
          target_distance_m: last?.target_distance_m ?? null,
        },
      ];
      onSave(next);
      return next;
    });
  }

  /**
   * Quita la serie de la UI al instante; el guardado real espera al toast.
   * Si se deshace, se reinserta en su lugar y se vuelve a guardar por si algún
   * blur de otra celda ya había mandado el plan sin ella.
   */
  function removeRow(i: number) {
    if (rows.length <= 1) return;
    const removed = rows[i];
    setRows(rows.filter((_, idx) => idx !== i));
    undoable({
      message: "Serie quitada",
      commit: () => onSaveRef.current(rowsRef.current),
      undo: () => {
        const restored = [...rowsRef.current];
        restored.splice(Math.min(i, restored.length), 0, removed);
        setRows(restored);
        onSaveRef.current(restored);
      },
    });
  }

  /** Peso/reps de la última vez para esta serie (por número de serie; si esa
   *  serie no existe en el registro anterior, cae a la última que sí). */
  function lastFor(setNumber: number) {
    if (!last || last.sets.length === 0) return null;
    const s =
      last.sets.find((x) => x.set_number === setNumber) ??
      last.sets[last.sets.length - 1];
    if (!s || (s.weight == null && s.reps == null)) return null;
    const w = s.weight != null ? `${s.weight} kg` : "—";
    const r = s.reps != null ? ` × ${s.reps}` : "";
    return `últ. ${w}${r}`;
  }

  return (
    <div className="mt-3 flex flex-col gap-1.5">
      <div className="flex items-center gap-2 px-1 text-xs uppercase tracking-wide text-muted">
        <span className="w-8">Serie</span>
        {/* Peso primero: es el orden que usa el resto de la app ("75 kg x 10"),
            el chip del plan y el "ult." de abajo. Aca estaba al reves, asi que
            plan y ultimo logrado se leian en ordenes distintos. */}
        {showsLoad && <span className="flex-1 text-center">Peso (kg)</span>}
        {showsDistance && <span className="flex-1 text-center">km</span>}
        {showsDuration && <span className="flex-1 text-center">mm:ss</span>}
        {showsReps && <span className="flex-1 text-center">Reps</span>}
        <span className="w-9" />
      </div>
      {rows.map((r, i) => {
        const hint = lastFor(i + 1);
        // Un plan fuera del rango de reps del objetivo se ignora al sugerir
        // carga durante la sesión, así que se avisa acá, que es donde nace.
        const outOfRange = showsReps && planOutOfRange(r.target_reps, profile);
        return (
          <div key={i}>
            <div className="flex items-center gap-2">
              <span className="w-8 text-center text-sm text-muted tabular-nums">
                {i + 1}
              </span>
              {showsLoad && (
                <Input
                  type="number"
                  inputMode="decimal"
                  min={0}
                  step="0.5"
                  placeholder="—"
                  value={r.target_weight ?? ""}
                  onChange={(e) =>
                    updateRow(i, {
                      target_weight:
                        e.target.value === "" ? null : Number(e.target.value),
                    })
                  }
                  onBlur={() => onSave(rows)}
                  className="flex-1 text-center"
                />
              )}
              {showsDistance && (
                <Input
                  type="number"
                  inputMode="decimal"
                  min={0}
                  step="0.1"
                  placeholder="—"
                  value={
                    r.target_distance_m == null ? "" : r.target_distance_m / 1000
                  }
                  onChange={(e) =>
                    updateRow(i, {
                      target_distance_m:
                        e.target.value === ""
                          ? null
                          : Math.round(Number(e.target.value) * 1000),
                    })
                  }
                  onBlur={() => onSave(rows)}
                  className="flex-1 text-center"
                />
              )}
              {showsDuration && (
                <DurationField
                  key={r.target_duration_seconds ?? "empty"}
                  value={r.target_duration_seconds ?? null}
                  onCommit={(v) =>
                    commitRow(i, { target_duration_seconds: v })
                  }
                  className="flex-1"
                />
              )}
              {showsReps && (
                <Input
                  type="number"
                  inputMode="numeric"
                  min={0}
                  placeholder="—"
                  value={r.target_reps ?? ""}
                  onChange={(e) =>
                    updateRow(i, {
                      target_reps:
                        e.target.value === "" ? null : Number(e.target.value),
                    })
                  }
                  onBlur={() => onSave(rows)}
                  className="flex-1 text-center"
                />
              )}
              <IconButton
                size="sm"
                tone="danger"
                label="Quitar serie"
                onClick={() => removeRow(i)}
                disabled={rows.length <= 1}
                className="w-9 disabled:opacity-40"
              >
                <X className="size-4" />
              </IconButton>
            </div>
            {(hint || outOfRange) && (
              <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 pl-10 text-xs tabular-nums">
                {hint && <span className="text-muted">{hint}</span>}
                {outOfRange && (
                  <Badge className="bg-warning/15 text-warning-fg ring-warning/30">
                    Fuera de tu rango ({repRangeLabel(profile)})
                  </Badge>
                )}
              </div>
            )}
          </div>
        );
      })}
      <button
        type="button"
        onClick={addRow}
        className="mt-1 flex items-center justify-center gap-1.5 rounded-md py-2 text-sm font-medium text-muted ring-1 ring-border hover:text-fg"
      >
        <Plus className="size-4" /> Agregar serie
      </button>
    </div>
  );
}
