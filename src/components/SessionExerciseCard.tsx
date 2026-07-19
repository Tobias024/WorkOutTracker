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
} from "lucide-react";
import { Button, Badge, Textarea } from "@/components/ui";
import { ExerciseImage } from "@/components/ExerciseImage";
import { ExerciseDetailModal } from "@/components/ExerciseDetailModal";
import { ReplaceExerciseModal } from "@/components/ReplaceExerciseModal";
import { SetRow } from "@/components/SetRow";
import { muscleEs } from "@/lib/i18n-exercise";
import { totalVolume } from "@/lib/metrics";
import { formatVolume } from "@/lib/format";
import { useExerciseNote, useUpsertExerciseNote } from "@/hooks/useExerciseNotes";
import type { Exercise, WorkoutSet } from "@/lib/types";
import type { SessionExercise, LastExerciseLog } from "@/hooks/useWorkout";
import { clsx } from "@/lib/clsx";

export function SessionExerciseCard({
  we,
  exercise,
  originalExercise,
  lastLog,
  onUpdateSet,
  onAddSet,
  onDeleteSet,
  onRemove,
  onReplace,
}: {
  we: SessionExercise;
  exercise?: Exercise;
  originalExercise?: Exercise;
  /** Última vez que se hizo este ejercicio (peso/reps por serie), para el ghost. */
  lastLog?: LastExerciseLog;
  onUpdateSet: (id: string, patch: Partial<WorkoutSet>) => void;
  onAddSet: () => void;
  onDeleteSet: (id: string) => void;
  onRemove: () => void;
  onReplace: (newExercise: Exercise, saveForFuture: boolean) => void;
}) {
  const [menu, setMenu] = useState(false);
  const [replace, setReplace] = useState(false);
  const [detail, setDetail] = useState(false);
  // Plegados por defecto: sólo se ve el nombre + resumen; tap en el header despliega.
  const [collapsed, setCollapsed] = useState(true);

  const { data: note } = useExerciseNote(we.exercise_id);
  const hasNote = !!note?.trim();

  const completedSets = we.sets.filter((s) => s.completed);
  const volume = totalVolume(completedSets);

  /** Peso/reps + bajadas de la última vez para esta serie (por número de serie). */
  function ghostFor(setNumber: number) {
    if (!lastLog || lastLog.sets.length === 0) return null;
    const s =
      lastLog.sets.find((x) => x.set_number === setNumber) ??
      lastLog.sets[lastLog.sets.length - 1];
    return s ? { weight: s.weight, reps: s.reps, drops: s.drops } : null;
  }

  /** Al completar una serie vacía, adopta el ghost (repetir = no tocar nada). */
  function adopt(
    set: WorkoutSet,
    patch: Partial<WorkoutSet>,
  ): Partial<WorkoutSet> {
    if (!patch.completed) return patch;
    const g = ghostFor(set.set_number);
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
    return next;
  }

  // Si se completa la última serie del ejercicio, completa también las anteriores
  // (evita tener que tildear una por una cuando se hicieron todas seguidas).
  function handleSetChange(set: WorkoutSet, patch: Partial<WorkoutSet>) {
    onUpdateSet(set.id, adopt(set, patch));
    if (!patch.completed) return;
    const sorted = [...we.sets].sort((a, b) => a.set_number - b.set_number);
    const isLast = sorted[sorted.length - 1]?.id === set.id;
    if (!isLast) return;
    for (const s of sorted) {
      if (s.id !== set.id && !s.completed)
        onUpdateSet(s.id, adopt(s, { completed: true }));
    }
  }

  return (
    <div className="card p-3">
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
              {exercise?.primary_muscles[0] && (
                <Badge>{muscleEs(exercise.primary_muscles[0])}</Badge>
              )}
              {we.replaced_from_exercise_id && originalExercise && (
                <Badge className="bg-accent/15 text-accent ring-accent/30">
                  Reemplaza a {originalExercise.name}
                </Badge>
              )}
              {volume > 0 && <Badge>{formatVolume(volume)}</Badge>}
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
                ghost={ghostFor(set.set_number)}
                onChange={(patch) => handleSetChange(set, patch)}
                onDelete={() => onDeleteSet(set.id)}
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

/** Nota fija del ejercicio: se guarda por exercise_id y viaja entre rutinas. */
function ExerciseNoteEditor({
  exerciseId,
  initial,
}: {
  exerciseId: string;
  initial: string;
}) {
  const upsert = useUpsertExerciseNote();
  return (
    <div className="mt-3">
      <label className="text-xs text-muted">Nota del ejercicio</label>
      <Textarea
        key={initial}
        defaultValue={initial}
        rows={2}
        placeholder="Ej: agarre cerrado, banco a 30°, cuidar el hombro…"
        onBlur={(e) => {
          const v = e.target.value;
          if (v.trim() !== initial.trim())
            upsert.mutate({ exerciseId, note: v });
        }}
        className="mt-1 text-sm"
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
