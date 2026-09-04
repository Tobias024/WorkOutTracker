// SPDX-License-Identifier: AGPL-3.0-only
"use client";

import { useState } from "react";
import {
  Plus,
  MoreVertical,
  Repeat,
  Trash2,
  Info,
  ChevronDown,
  StickyNote,
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
} from "lucide-react";
import { Button, Badge } from "@/components/ui";
import { ExerciseImage } from "@/components/ExerciseImage";
import { ExerciseDetailModal } from "@/components/ExerciseDetailModal";
import { ExerciseNoteEditor } from "@/components/ExerciseNoteEditor";
import { ReplaceExerciseModal } from "@/components/ReplaceExerciseModal";
import { SetRow, type PlannedSet } from "@/components/SetRow";
import { muscleEs } from "@/lib/i18n-exercise";
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
  onSetStarted,
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
  onDeleteSet: (id: string) => void;
  onRemove: () => void;
  onReplace: (newExercise: Exercise, saveForFuture: boolean) => void;
  onStartMove?: () => void;
  onEndMove?: () => void;
  onMove?: (dir: "up" | "down") => void;
  /** El usuario tildó una serie (para arrancar el cronómetro de descanso). */
  onSetCompleted?: (setId: string) => void;
  /** El usuario empezó a cargar una serie sin tildar → cierra el descanso vivo. */
  onSetStarted?: (setId: string) => void;
}) {
  const [menu, setMenu] = useState(false);
  const [replace, setReplace] = useState(false);
  const [detail, setDetail] = useState(false);
  // Plegados por defecto: sólo se ve el nombre + resumen; tap en el header despliega.
  const [collapsed, setCollapsed] = useState(true);

  const { data: note } = useExerciseNote(we.exercise_id);
  const hasNote = !!note?.trim();
  // Una sola query por card (clave estable, la cachea TanStack): decide las
  // zonas de RIR y la tolerancia de reps de todas las series de este ejercicio.
  const { data: prefs } = useTrainingProfile();
  const profile = prefs?.trainingProfile ?? null;

  const completedSets = we.sets.filter((s) => s.completed);
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
          drops: s.drops,
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

  // Si se completa la última serie del ejercicio, completa también las anteriores
  // (evita tener que tildear una por una cuando se hicieron todas seguidas).
  function handleSetChange(set: WorkoutSet, patch: Partial<WorkoutSet>) {
    onUpdateSet(set.id, adopt(set, patch));
    if (!patch.completed) return;
    // Tildó una serie: arranca el cronómetro de descanso (solo el tick real).
    onSetCompleted?.(set.id);
    const sorted = [...we.sets].sort((a, b) => a.set_number - b.set_number);
    const isLast = sorted[sorted.length - 1]?.id === set.id;
    if (!isLast) return;
    for (const s of sorted) {
      if (s.id !== set.id && !s.completed)
        onUpdateSet(s.id, adopt(s, { completed: true }));
    }
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
      className={clsx(
        "card p-3",
        moveMode && "opacity-50 pointer-events-none",
        // Dorado suave cuando superaste lo de la última vez. Va en la card y no
        // en la fila para que se lea plegado, que es como se recorre la lista.
        improved && "ring-1 ring-accent/40 bg-accent/5",
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
          onClick={() => setCollapsed((c) => !c)}
          className="min-w-0 flex-1 flex items-center gap-2 text-left"
          aria-expanded={!collapsed}
        >
          <div className="min-w-0 flex-1">
            <p className="font-medium truncate">{exercise?.name ?? "…"}</p>
            <div className="flex items-center gap-1.5 flex-wrap mt-0.5">
              {improved && (
                <Badge className="gap-1 bg-accent/15 text-accent ring-accent/30">
                  <ArrowUp className="size-3" /> mejoraste
                </Badge>
              )}
              {exercise?.primary_muscles[0] && (
                <Badge>{muscleEs(exercise.primary_muscles[0])}</Badge>
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
              {collapsed && (
                <Badge>
                  {completedSets.length}/{we.sets.length} series
                </Badge>
              )}
              {collapsed && hasNote && (
                <StickyNote className="size-3.5 text-accent shrink-0" />
              )}
            </div>
          </div>
          <ChevronDown
            className={clsx(
              "size-4 text-muted shrink-0 transition-transform",
              !collapsed && "rotate-180",
            )}
          />
        </button>

        <div className="relative">
          <button
            onClick={() => setMenu((m) => !m)}
            className="size-9 grid place-items-center rounded text-muted hover:text-fg"
          >
            <MoreVertical className="size-5" />
          </button>
          {menu && (
            <>
              <div
                className="fixed inset-0 z-10"
                onClick={() => setMenu(false)}
              />
              <div className="absolute right-0 top-10 z-20 card p-1 w-48 shadow-xl">
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
            </>
          )}
        </div>
      </div>

      {!collapsed && (
        <>
          <div className="flex flex-col gap-1.5 mt-3">
            {we.sets.map((set) => (
              <SetRow
                key={set.id}
                set={set}
                kind={exercise?.metric_kind ?? "reps_weight"}
                ghost={ghostFor(set.set_number)}
                planned={plannedFor(set)}
                profile={profile}
                onChange={(patch) => handleSetChange(set, patch)}
                onDelete={() => onDeleteSet(set.id)}
                onStart={
                  set.completed ? undefined : () => onSetStarted?.(set.id)
                }
              />
            ))}
          </div>

          <Button
            variant="ghost"
            size="sm"
            className="mt-2 w-full"
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
        currentMuscle={exercise?.primary_muscles[0]}
        canSaveForFuture={!!we.routine_exercise_id}
        onReplace={onReplace}
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
        "w-full flex items-center gap-2.5 rounded px-3 py-2 text-sm text-left hover:bg-surface-2",
        danger ? "text-danger" : "text-fg",
      )}
    >
      {icon}
      {children}
    </button>
  );
}
