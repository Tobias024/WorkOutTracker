"use client";

import { Textarea } from "@/components/ui";
import { useUpsertExerciseNote } from "@/hooks/useExerciseNotes";

/**
 * Nota fija del ejercicio: se guarda por exercise_id y viaja entre rutinas y
 * sesiones. Se usa tanto al entrenar como al editar una rutina.
 */
export function ExerciseNoteEditor({
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
