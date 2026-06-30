"use client";

import { Modal, Badge } from "@/components/ui";
import { ExerciseImage } from "@/components/ExerciseImage";
import {
  muscleEs,
  equipmentEs,
  categoryEs,
  levelEs,
  forceEs,
  mechanicEs,
} from "@/lib/i18n-exercise";
import type { Exercise } from "@/lib/types";

export function ExerciseDetailModal({
  exercise,
  onClose,
}: {
  exercise: Exercise | null;
  onClose: () => void;
}) {
  return (
    <Modal open={!!exercise} onClose={onClose} title={exercise?.name}>
      {exercise && (
        <div className="flex flex-col gap-4">
          {exercise.images.length > 0 && (
            <div className="flex gap-2 overflow-x-auto no-scrollbar">
              {exercise.images.map((img) => (
                <ExerciseImage
                  key={img}
                  src={img}
                  alt={exercise.name}
                  className="h-44 w-60 rounded-xl shrink-0"
                />
              ))}
            </div>
          )}

          <div className="flex flex-wrap gap-1.5">
            {exercise.category && <Badge>{categoryEs(exercise.category)}</Badge>}
            {exercise.equipment && <Badge>{equipmentEs(exercise.equipment)}</Badge>}
            {exercise.level && <Badge>{levelEs(exercise.level)}</Badge>}
            {exercise.force && <Badge>{forceEs(exercise.force)}</Badge>}
            {exercise.mechanic && <Badge>{mechanicEs(exercise.mechanic)}</Badge>}
          </div>

          {exercise.primary_muscles.length > 0 && (
            <div>
              <p className="text-xs text-muted mb-1.5">Músculos principales</p>
              <div className="flex flex-wrap gap-1.5">
                {exercise.primary_muscles.map((m) => (
                  <Badge key={m} className="bg-primary/15 text-primary ring-primary/30">
                    {muscleEs(m)}
                  </Badge>
                ))}
                {exercise.secondary_muscles.map((m) => (
                  <Badge key={m}>{muscleEs(m)}</Badge>
                ))}
              </div>
            </div>
          )}

          {exercise.instructions.length > 0 && (
            <div>
              <p className="text-xs text-muted mb-1.5">Instrucciones</p>
              <ol className="list-decimal list-inside text-sm space-y-1.5 text-muted">
                {exercise.instructions.map((step, i) => (
                  <li key={i}>{step}</li>
                ))}
              </ol>
            </div>
          )}
        </div>
      )}
    </Modal>
  );
}
