// SPDX-License-Identifier: AGPL-3.0-only
"use client";

import { useId, useState } from "react";
import { StickyNote } from "lucide-react";
import { Textarea } from "@/components/ui";
import { useUpsertExerciseNote } from "@/hooks/useExerciseNotes";

/**
 * Nota fija del ejercicio: se guarda por exercise_id y viaja entre rutinas y
 * sesiones. Se usa tanto al entrenar como al editar una rutina.
 *
 * Plegada por defecto: ocupa una línea (chip) en vez de un textarea de dos
 * filas por card. Si ya hay texto se muestra de solo lectura y editarla pide
 * un toque, para no abrir el teclado sin querer entre series.
 */
export function ExerciseNoteEditor({
  exerciseId,
  initial,
}: {
  exerciseId: string;
  initial: string;
}) {
  const upsert = useUpsertExerciseNote();
  const id = useId();
  const [editing, setEditing] = useState(false);
  const hasNote = initial.trim() !== "";

  if (!editing) {
    return (
      <div className="mt-3">
        {hasNote && (
          <p className="mb-1.5 whitespace-pre-wrap text-sm text-fg">
            <span className="block text-xs font-semibold text-muted">
              Nota fija
            </span>
            {initial}
          </p>
        )}
        <button
          type="button"
          onClick={() => setEditing(true)}
          className="relative inline-flex h-9 items-center gap-1.5 rounded-md bg-surface-2 px-3 text-xs font-semibold text-muted ring-1 ring-border after:absolute after:-inset-1 after:content-[''] hover:text-fg"
        >
          <StickyNote className="size-3.5" />
          {hasNote ? "Editar nota fija" : "Nota fija"}
        </button>
      </div>
    );
  }

  return (
    <div className="mt-3">
      <label htmlFor={id} className="text-xs text-muted">
        Nota fija · la vas a ver cada vez que hagas este ejercicio
      </label>
      <Textarea
        id={id}
        autoFocus
        key={initial}
        defaultValue={initial}
        rows={2}
        placeholder="Ej: agarre cerrado, banco a 30°, cuidar el hombro…"
        onBlur={(e) => {
          const v = e.target.value;
          if (v.trim() !== initial.trim())
            upsert.mutate({ exerciseId, note: v });
          setEditing(false);
        }}
        className="mt-1 text-sm"
      />
    </div>
  );
}
