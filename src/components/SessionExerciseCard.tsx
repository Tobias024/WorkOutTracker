"use client";

import { useState } from "react";
import { Plus, MoreVertical, Repeat, Trash2, Info } from "lucide-react";
import { Button, Badge } from "@/components/ui";
import { ExerciseImage } from "@/components/ExerciseImage";
import { ExerciseDetailModal } from "@/components/ExerciseDetailModal";
import { ReplaceExerciseModal } from "@/components/ReplaceExerciseModal";
import { SetRow } from "@/components/SetRow";
import { muscleEs } from "@/lib/i18n-exercise";
import { totalVolume } from "@/lib/metrics";
import { formatVolume } from "@/lib/format";
import type { Exercise, WorkoutSet } from "@/lib/types";
import type { SessionExercise } from "@/hooks/useWorkout";
import { clsx } from "@/lib/clsx";

export function SessionExerciseCard({
  we,
  exercise,
  originalExercise,
  onUpdateSet,
  onAddSet,
  onDeleteSet,
  onRemove,
  onReplace,
}: {
  we: SessionExercise;
  exercise?: Exercise;
  originalExercise?: Exercise;
  onUpdateSet: (id: string, patch: Partial<WorkoutSet>) => void;
  onAddSet: () => void;
  onDeleteSet: (id: string) => void;
  onRemove: () => void;
  onReplace: (newExercise: Exercise, saveForFuture: boolean) => void;
}) {
  const [menu, setMenu] = useState(false);
  const [replace, setReplace] = useState(false);
  const [detail, setDetail] = useState(false);

  const volume = totalVolume(we.sets.filter((s) => s.completed));

  // Si se completa la última serie del ejercicio, completa también las anteriores
  // (evita tener que tildear una por una cuando se hicieron todas seguidas).
  function handleSetChange(set: WorkoutSet, patch: Partial<WorkoutSet>) {
    onUpdateSet(set.id, patch);
    if (!patch.completed) return;
    const sorted = [...we.sets].sort((a, b) => a.set_number - b.set_number);
    const isLast = sorted[sorted.length - 1]?.id === set.id;
    if (!isLast) return;
    for (const s of sorted) {
      if (s.id !== set.id && !s.completed) onUpdateSet(s.id, { completed: true });
    }
  }

  return (
    <div className="card p-3">
      <div className="flex items-center gap-3">
        <button onClick={() => setDetail(true)} className="shrink-0">
          <ExerciseImage
            src={exercise?.images[0]}
            alt={exercise?.name ?? ""}
            className="size-12 rounded"
          />
        </button>
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
          </div>
        </div>

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

      <div className="flex flex-col gap-1.5 mt-3">
        {we.sets.map((set) => (
          <SetRow
            key={set.id}
            set={set}
            onChange={(patch) => handleSetChange(set, patch)}
            onDelete={() => onDeleteSet(set.id)}
          />
        ))}
      </div>

      <Button variant="ghost" size="sm" className="mt-2 w-full" onClick={onAddSet}>
        <Plus className="size-4" /> Agregar serie
      </Button>

      <ReplaceExerciseModal
        open={replace}
        onClose={() => setReplace(false)}
        currentName={exercise?.name ?? ""}
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
