// SPDX-License-Identifier: AGPL-3.0-only
"use client";

import { useEffect, useRef, useState } from "react";
import {
  Plus,
  MoreVertical,
  Repeat,
  Trash2,
  Info,
  ChevronDown,
  CheckCircle2,
  StickyNote,
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
} from "lucide-react";
import { Button, Badge, IconButton, Modal } from "@/components/ui";
import { toast, undoable } from "@/lib/toast";
import { ExerciseImage } from "@/components/ExerciseImage";
import { ExerciseDetailModal } from "@/components/ExerciseDetailModal";
import { ExerciseNoteEditor } from "@/components/ExerciseNoteEditor";
import { ReplaceExerciseModal } from "@/components/ReplaceExerciseModal";
import { SetRow, SetRowHeader, type PlannedSet } from "@/components/SetRow";
import { muscleEs } from "@/lib/i18n-exercise";
import { primaryMuscle } from "@/lib/muscle-contributions";
import { countsForStrengthVolume, totalVolume } from "@/lib/metrics";
import { formatDistance, formatDuration, formatVolume } from "@/lib/format";
import { useExerciseNote } from "@/hooks/useExerciseNotes";
import { useTrainingProfile } from "@/hooks/useGoal";
import type { Exercise, MetricKind, SetDrop, WorkoutSet } from "@/lib/types";
import type { SessionExercise, LastExerciseLog } from "@/hooks/useWorkout";
import { clsx } from "@/lib/clsx";

export function SessionExerciseCard({
  we,
  exercise,
  originalExercise,
  lastLog,
  moving,
  moveMode,
  isFirst,
  isLast,
  onUpdateSet,
  onAddSet,
  onDeleteSet,
  onRemove,
  onReplace,
  onStartMove,
  onEndMove,
  onMove,
  onSetCompleted,
  expanded: expandedProp,
  onExpandedChange,
  onExerciseCompleted,
}: {
  we: SessionExercise;
  exercise?: Exercise;
  originalExercise?: Exercise;
  /** Última vez que se hizo este ejercicio (peso/reps por serie), para el ghost. */
  lastLog?: LastExerciseLog;
  /** Esta card está seleccionada para mover. */
  moving?: boolean;
  /** Alguna card está en modo mover (bloquea el resto). */
  moveMode?: boolean;
  isFirst?: boolean;
  isLast?: boolean;
  onUpdateSet: (id: string, patch: Partial<WorkoutSet>) => void;
  onAddSet: () => void;
  /** Puede devolver la promesa de la mutación: flushUndoables() la espera. */
  onDeleteSet: (id: string) => void | Promise<unknown>;
  onRemove: () => void;
  onReplace: (newExercise: Exercise, saveForFuture: boolean) => void;
  onStartMove?: () => void;
  onEndMove?: () => void;
  onMove?: (dir: "up" | "down") => void;
  /** El usuario tildó una serie (para arrancar el cronómetro de descanso). */
  onSetCompleted?: (
    setId: string,
    info: { isWarmup: boolean; mechanic: string | null },
  ) => void;
  /** Card desplegada. Lo controla la página (para auto-expandir la siguiente). */
  expanded?: boolean;
  onExpandedChange?: (v: boolean) => void;
  /** Todas las series de trabajo pasaron a completadas (una vez por transición). */
  onExerciseCompleted?: () => void;
}) {
  const cardRef = useRef<HTMLDivElement>(null);
  // Series escondidas mientras corre el "Deshacer" de eliminar serie.
  const [hiddenSets, setHiddenSets] = useState<Set<string>>(new Set());
  const [menu, setMenu] = useState(false);
  const [replace, setReplace] = useState(false);
  const [detail, setDetail] = useState(false);
  // Plegada por defecto: sólo se ve el nombre + resumen; tap en el header despliega.
  // Si la página no controla el estado, cae a uno interno.
  const [innerExpanded, setInnerExpanded] = useState(false);
  const expanded = expandedProp ?? innerExpanded;
  const setExpanded = (v: boolean) => {
    if (onExpandedChange) onExpandedChange(v);
    else setInnerExpanded(v);
  };

  // Al pasar la app a segundo plano, un input enfocado todavía no commiteó (el
  // commit es en blur): se lo blurea para que el valor tipeado no se pierda.
  useEffect(() => {
    const onHide = () => {
      const el = document.activeElement;
      if (
        document.hidden &&
        el instanceof HTMLElement &&
        (el instanceof HTMLInputElement || el instanceof HTMLTextAreaElement) &&
        cardRef.current?.contains(el)
      )
        el.blur();
    };
    document.addEventListener("visibilitychange", onHide);
    return () => document.removeEventListener("visibilitychange", onHide);
  }, []);

  const { data: note } = useExerciseNote(we.exercise_id);
  const hasNote = !!note?.trim();
  // Una sola query por card (clave estable, la cachea TanStack): decide las
  // zonas de RIR y la tolerancia de reps de todas las series de este ejercicio.
  const { data: prefs } = useTrainingProfile();
  const profile = prefs?.trainingProfile ?? null;

  const visibleSets = we.sets.filter((s) => !hiddenSets.has(s.id));
  const completedSets = visibleSets.filter((s) => s.completed);
  const workSets = visibleSets.filter((s) => !s.is_warmup);
  const workDone = workSets.filter((s) => s.completed).length;
  // Terminada: todas las series de trabajo completas (el calentamiento no cuenta).
  const finished = workSets.length > 0 && workDone === workSets.length;
  // Próxima pendiente: la primera sin tildar, en orden de serie.
  const nextSetId = visibleSets.find((s) => !s.completed)?.id;
  const kind: MetricKind = exercise?.metric_kind ?? "reps_weight";
  const volume = countsForStrengthVolume(kind) ? totalVolume(completedSets) : 0;
  // Un ejercicio por tiempo o distancia no tiene tonelaje: el resumen util es
  // cuanto tiempo estuvo bajo tension o cuantos km hizo.
  const doneSeconds = completedSets.reduce(
    (acc, x) => acc + (x.duration_seconds ?? 0),
    0,
  );
  const doneMeters = completedSets.reduce(
    (acc, x) => acc + (x.distance_m ?? 0),
    0,
  );

  /** Peso/reps + bajadas de la última vez para esta serie (por número de serie). */
  function ghostFor(setNumber: number) {
    if (!lastLog || lastLog.sets.length === 0) return null;
    const s =
      lastLog.sets.find((x) => x.set_number === setNumber) ??
      lastLog.sets[lastLog.sets.length - 1];
    return s
      ? {
          weight: s.weight,
          reps: s.reps,
          drops: adoptableDrops(s),
          duration_seconds: s.duration_seconds,
          distance_m: s.distance_m,
        }
      : null;
  }

  /** Lo que la rutina pedía para esta serie (snapshot guardado al arrancar). */
  function plannedFor(set: WorkoutSet): PlannedSet | null {
    if (
      set.planned_reps == null &&
      set.planned_weight == null &&
      set.planned_duration_seconds == null &&
      set.planned_distance_m == null
    )
      return null;
    return {
      reps: set.planned_reps,
      weight: set.planned_weight,
      duration_seconds: set.planned_duration_seconds,
      distance_m: set.planned_distance_m,
    };
  }

  /**
   * ¿Superaste lo de la última vez en este ejercicio? Alguna serie completada
   * tiene que DOMINAR a la misma serie de la sesión anterior: mismo peso y más
   * reps, o más peso y las mismas reps. No se persiste nada — se recalcula
   * contra `lastLog` en cada render, así que la marca no se arrastra a sesiones
   * futuras: la semana que viene la base de comparación se mueve sola.
   */
  function improvedVsLast(): boolean {
    return we.sets.some((s) => {
      if (!s.completed || s.is_warmup) return false;
      const g = ghostFor(s.set_number);
      if (!g) return false;
      if (
        s.weight == null ||
        s.reps == null ||
        g.weight == null ||
        g.reps == null
      )
        return false;
      return (
        s.weight >= g.weight &&
        s.reps >= g.reps &&
        (s.weight > g.weight || s.reps > g.reps)
      );
    });
  }
  const improved = countsForStrengthVolume(kind) && improvedVsLast();

  /**
   * Al completar una serie vacía, adopta lo de la última vez (repetir = no
   * tocar nada). Si nunca hiciste el ejercicio, adopta el plan: es la única
   * referencia que hay, y ahora que los campos nacen vacíos es la que evita
   * tener que tipear una serie que se cumplió tal cual estaba escrita.
   */
  function adopt(
    set: WorkoutSet,
    patch: Partial<WorkoutSet>,
  ): Partial<WorkoutSet> {
    if (!patch.completed) return patch;
    const fallback = plannedFor(set);
    // El plan no tiene bajadas (la rutina no las planifica), sólo el ghost.
    const g =
      ghostFor(set.set_number) ??
      (fallback ? { ...fallback, drops: null as SetDrop[] | null } : null);
    if (!g) return patch;
    const next = { ...patch };
    // Si la serie está vacía y la última vez tuvo bajadas, adoptar el array
    // entero (incluye peso/reps de la primer bajada) → repetir sin tocar nada.
    const empty =
      set.weight == null &&
      set.reps == null &&
      (!set.drops || set.drops.length <= 1) &&
      next.weight == null &&
      next.reps == null &&
      next.drops == null;
    if (empty && g.drops && g.drops.length > 1) {
      next.drops = g.drops;
      next.weight = g.drops[0]?.weight ?? null;
      next.reps = g.drops[0]?.reps ?? null;
      return next;
    }
    if (set.weight == null && next.weight == null && g.weight != null)
      next.weight = g.weight;
    if (set.reps == null && next.reps == null && g.reps != null)
      next.reps = g.reps;
    // Mismo criterio para las series por tiempo y por distancia: tildar una
    // serie vacia repite lo de la ultima vez.
    if (
      set.duration_seconds == null &&
      next.duration_seconds == null &&
      g.duration_seconds != null
    )
      next.duration_seconds = g.duration_seconds;
    if (
      set.distance_m == null &&
      next.distance_m == null &&
      g.distance_m != null
    )
      next.distance_m = g.distance_m;
    return next;
  }

  /**
   * Una serie de reps (no warmup) no se puede dar por hecha sin reps: no suma
   * volumen ni e1RM pero contaba como completada. El peso puede faltar
   * (ejercicios con peso corporal).
   */
  function missingReps(set: WorkoutSet, next: Partial<WorkoutSet>): boolean {
    if (kind !== "reps_weight" || set.is_warmup || next.is_warmup) return false;
    const reps = "reps" in next ? next.reps : set.reps;
    return reps == null;
  }

  // Si se completa la última serie del ejercicio, completa también las anteriores
  // (evita tener que tildear una por una cuando se hicieron todas seguidas).
  // `set` es la versión más reciente que conoce la fila (SetRow la adelanta a
  // las props), así adopt() no confunde con "vacía" una serie recién tipeada.
  function handleSetChange(
    set: WorkoutSet,
    patch: Partial<WorkoutSet>,
  ): Partial<WorkoutSet> | false {
    const next = adopt(set, patch);
    if (next.completed && missingReps(set, next)) return false;
    onUpdateSet(set.id, next);
    if (!patch.completed) return next;
    // Tildó una serie: arranca el cronómetro de descanso (solo el tick real).
    // Las series de calentamiento no disparan el descanso.
    if (!set.is_warmup && patch.is_warmup !== true)
      onSetCompleted?.(set.id, {
        isWarmup: false,
        mechanic: exercise?.mechanic ?? null,
      });
    // Las escondidas (eliminación pendiente) no se autocompletan.
    const sorted = [...visibleSets].sort((a, b) => a.set_number - b.set_number);
    const isLastSet = sorted[sorted.length - 1]?.id === set.id;
    const auto: WorkoutSet[] = [];
    const reverts: Array<{ id: string; prev: Partial<WorkoutSet> }> = [];
    if (isLastSet) {
      for (const s of sorted) {
        if (s.id === set.id || s.completed) continue;
        const applied = adopt(s, { completed: true });
        // Las que siguen sin reps quedan sin tildar, a la vista para cargarlas.
        if (missingReps(s, applied)) continue;
        // Valores previos de TODO lo que adopt() toca, capturados antes de mutar.
        const prev: Record<string, unknown> = {};
        for (const k of Object.keys(applied))
          prev[k] = (s as unknown as Record<string, unknown>)[k];
        reverts.push({ id: s.id, prev: prev as Partial<WorkoutSet> });
        auto.push(s);
        onUpdateSet(s.id, applied);
      }
    }
    if (auto.length > 0) {
      const nums = auto.map((s) => s.set_number);
      const list =
        nums.length === 1
          ? `la serie ${nums[0]}`
          : `las series ${nums.slice(0, -1).join(", ")} y ${nums[nums.length - 1]}`;
      toast(`Se completaron también ${list}`, {
        action: {
          label: "Deshacer",
          onClick: () => reverts.forEach((r) => onUpdateSet(r.id, r.prev)),
        },
      });
    }
    // ¿Esta acción cerró el ejercicio? Solo si antes no estaba terminado.
    if (!set.is_warmup && !finished) {
      const autoIds = new Set(auto.map((s) => s.id));
      const allDone = workSets.every(
        (s) => s.id === set.id || s.completed || autoIds.has(s.id),
      );
      if (allDone) onExerciseCompleted?.();
    }
    return next;
  }

  /** Esconde la fila y deja 5 s para deshacer antes de borrar de verdad. */
  function handleDeleteSet(set: WorkoutSet) {
    const unhide = () =>
      setHiddenSets((h) => {
        const next = new Set(h);
        next.delete(set.id);
        return next;
      });
    setHiddenSets((h) => new Set(h).add(set.id));
    undoable({
      message: `Serie ${set.set_number} eliminada`,
      commit: () => {
        const done = onDeleteSet(set.id);
        // Si el borrado falla, el rollback devuelve la serie al cache: se la
        // vuelve a mostrar en vez de dejarla escondida para siempre.
        setTimeout(unhide, 3000);
        return done;
      },
      undo: unhide,
    });
  }

  // Modo "mover": esta card seleccionada muestra flechas y bloquea lo demás.
  if (moving) {
    return (
      <div className="card p-3 ring-1 ring-primary bg-primary/5">
        <div className="flex items-center gap-3">
          <ExerciseImage
            src={exercise?.images[0]}
            alt={exercise?.name ?? ""}
            className="size-12 rounded shrink-0"
          />
          <div className="min-w-0 flex-1">
            <p className="font-medium truncate">{exercise?.name ?? "…"}</p>
            <p className="text-xs text-muted">Moviendo — usá las flechas</p>
          </div>
          <div className="flex items-center gap-1 shrink-0">
            <button
              disabled={isFirst}
              onClick={() => onMove?.("up")}
              aria-label="Subir"
              className="size-9 grid place-items-center rounded bg-surface ring-1 ring-border text-fg disabled:opacity-30"
            >
              <ArrowUp className="size-4" />
            </button>
            <button
              disabled={isLast}
              onClick={() => onMove?.("down")}
              aria-label="Bajar"
              className="size-9 grid place-items-center rounded bg-surface ring-1 ring-border text-fg disabled:opacity-30"
            >
              <ArrowDown className="size-4" />
            </button>
            <Button size="sm" onClick={onEndMove}>
              Listo
            </Button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div
      ref={cardRef}
      className={clsx(
        "card p-3",
        moveMode && "opacity-50 pointer-events-none",
        // Dorado suave cuando superaste lo de la última vez. Va en la card y no
        // en la fila para que se lea plegado, que es como se recorre la lista.
        improved && "bg-accent/5",
        finished
          ? "ring-1 ring-success/40"
          : expanded && workSets.length > 0
            ? "ring-1 ring-primary/60"
            : improved && "ring-1 ring-accent/40",
      )}
    >
      <div className="flex items-center gap-3">
        <button
          onClick={() => setDetail(true)}
          className="shrink-0"
          aria-label="Ver detalle del ejercicio"
        >
          <ExerciseImage
            src={exercise?.images[0]}
            alt={exercise?.name ?? ""}
            className="size-12 rounded"
          />
        </button>

        {/* Tap en el header (nombre + badges) pliega/despliega las series. */}
        <button
          onClick={() => setExpanded(!expanded)}
          className="min-w-0 flex-1 flex items-center gap-2 text-left"
          aria-expanded={expanded}
        >
          <div className="min-w-0 flex-1">
            <p
              className={clsx(
                "flex items-center gap-1.5 font-medium",
                finished && "text-muted",
              )}
            >
              {finished && (
                <CheckCircle2 className="size-4 shrink-0 text-success" />
              )}
              <span className="truncate">{exercise?.name ?? "…"}</span>
            </p>
            <div className="flex items-center gap-1.5 flex-wrap mt-0.5">
              {improved && (
                <Badge className="gap-1 bg-accent/15 text-accent ring-accent/30">
                  <ArrowUp className="size-3" /> mejoraste
                </Badge>
              )}
              {exercise && primaryMuscle(exercise) && (
                <Badge>{muscleEs(primaryMuscle(exercise))}</Badge>
              )}
              {we.replaced_from_exercise_id && originalExercise && (
                <Badge className="bg-accent/15 text-accent ring-accent/30">
                  Reemplaza a {originalExercise.name}
                </Badge>
              )}
              {volume > 0 && <Badge>{formatVolume(volume)}</Badge>}
              {kind === "distance_time" && doneMeters > 0 && (
                <Badge>{formatDistance(doneMeters)}</Badge>
              )}
              {kind !== "reps_weight" && doneSeconds > 0 && (
                <Badge>{formatDuration(doneSeconds)}</Badge>
              )}
              {workSets.length > 0 && (
                <Badge
                  className={clsx(
                    finished && "bg-success/15 text-success-fg ring-success/30",
                  )}
                >
                  {workDone}/{workSets.length}
                  {!expanded && " series"}
                </Badge>
              )}
              {!expanded && hasNote && (
                <StickyNote className="size-3.5 text-accent shrink-0" />
              )}
            </div>
          </div>
          <ChevronDown
            className={clsx(
              "size-4 text-muted shrink-0 transition-transform",
              expanded && "rotate-180",
            )}
          />
        </button>

        <IconButton
          label="Opciones del ejercicio"
          aria-haspopup="dialog"
          aria-expanded={menu}
          onClick={() => setMenu(true)}
        >
          <MoreVertical className="size-5" />
        </IconButton>
      </div>

      {/* Hoja inferior y no dropdown: en la última card un menú absoluto se
          cortaba contra el borde de la pantalla. */}
      <Modal
        open={menu}
        onClose={() => setMenu(false)}
        title={exercise?.name ?? "Ejercicio"}
      >
        <div className="flex flex-col">
          <MenuItem
            icon={<ArrowUpDown className="size-4" />}
            onClick={() => {
              setMenu(false);
              onStartMove?.();
            }}
          >
            Mover
          </MenuItem>
          <MenuItem
            icon={<Repeat className="size-4" />}
            onClick={() => {
              setMenu(false);
              setReplace(true);
            }}
          >
            Reemplazar por…
          </MenuItem>
          <MenuItem
            icon={<Info className="size-4" />}
            onClick={() => {
              setMenu(false);
              setDetail(true);
            }}
          >
            Ver detalle
          </MenuItem>
          <div className="mt-1 border-t border-border pt-1">
            <MenuItem
              icon={<Trash2 className="size-4" />}
              danger
              onClick={() => {
                setMenu(false);
                onRemove();
              }}
            >
              Quitar del entreno
            </MenuItem>
          </div>
        </div>
      </Modal>

      {expanded && (
        <>
          <div className="mt-3 mb-1">
            <SetRowHeader kind={kind} />
          </div>
          <div className="flex flex-col gap-1.5">
            {visibleSets.map((set) => (
              <SetRow
                key={set.id}
                set={set}
                kind={kind}
                isNext={set.id === nextSetId}
                ghost={ghostFor(set.set_number)}
                planned={plannedFor(set)}
                profile={profile}
                onChange={(patch, latest) => handleSetChange(latest, patch)}
                onDelete={() => handleDeleteSet(set)}
              />
            ))}
          </div>

          <Button
            variant="secondary"
            size="md"
            className="mt-2 w-full border border-dashed border-border"
            onClick={onAddSet}
          >
            <Plus className="size-4" /> Agregar serie
          </Button>

          <ExerciseNoteEditor exerciseId={we.exercise_id} initial={note ?? ""} />
        </>
      )}

      <ReplaceExerciseModal
        open={replace}
        onClose={() => setReplace(false)}
        currentName={exercise?.name ?? ""}
        currentMuscle={exercise ? primaryMuscle(exercise) ?? undefined : undefined}
        canSaveForFuture={!!we.routine_exercise_id}
        onReplace={(ex, save) => {
          onReplace(ex, save);
          toast(`Cambiado por ${ex.name}`);
        }}
      />
      <ExerciseDetailModal
        exercise={detail ? exercise ?? null : null}
        onClose={() => setDetail(false)}
      />
    </div>
  );
}

function MenuItem({
  icon,
  children,
  onClick,
  danger,
}: {
  icon: React.ReactNode;
  children: React.ReactNode;
  onClick: () => void;
  danger?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      className={clsx(
        "w-full min-h-11 flex items-center gap-2.5 rounded-md px-3 text-sm text-left hover:bg-surface-2",
        danger ? "text-danger" : "text-fg",
      )}
    >
      {icon}
      {children}
    </button>
  );
}

/**
 * Bajadas de la última vez que vale la pena repetir al tildar una serie vacía.
 * Los drop-sets viejos quedaron con huecos (la primera bajada sin reps, o
 * bajadas vacías): copiarlos tal cual propagaba la corrupción de sesión en
 * sesión. La primera se completa con la serie base; del resto sólo quedan las
 * completas; si no sobrevive ninguna bajada extra, no hay drop-set que adoptar.
 */
function adoptableDrops(s: {
  reps: number | null;
  weight: number | null;
  drops?: SetDrop[] | null;
}): SetDrop[] | null {
  if (!s.drops || s.drops.length <= 1) return null;
  const [d0, ...rest] = s.drops;
  const first = { reps: d0.reps ?? s.reps, weight: d0.weight ?? s.weight };
  if (first.reps == null || first.weight == null) return null;
  const tail = rest.filter((d) => d.reps != null && d.weight != null);
  return tail.length > 0 ? [first, ...tail] : null;
}
