// SPDX-License-Identifier: AGPL-3.0-only
"use client";

import { useState } from "react";
import { Modal, Button } from "@/components/ui";
import { MusclePicker } from "@/components/MusclePicker";
import { useUpdateExerciseMuscles } from "@/hooks/useExercises";
import { directMuscles, indirectMuscles } from "@/lib/muscle-contributions";
import type { Exercise } from "@/lib/types";

/**
 * Corrige a qué músculos se le acredita el volumen de un ejercicio propio.
 *
 * Existe porque hasta acá el mapeo sólo se arreglaba tocando el repo, y eso lo
 * volvía inarreglable en la práctica: los ejercicios custom nacieron con los
 * secundarios vacíos, así que un compuesto le daba todo el volumen a un solo
 * músculo hasta que alguien escribiera un override a mano.
 *
 * Arranca con lo que la app está usando HOY (la capa de contribución, no las
 * columnas crudas): si el ejercicio tiene un override curado, se ve ese, y
 * guardarlo lo vuelca a la base.
 */
export function EditMusclesModal({
  exercise,
  onClose,
}: {
  exercise: Exercise | null;
  onClose: () => void;
}) {
  const update = useUpdateExerciseMuscles();
  const [primary, setPrimary] = useState<string[]>([]);
  const [secondary, setSecondary] = useState<string[]>([]);
  const [seeded, setSeeded] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Siembra al abrir (y al cambiar de ejercicio) sin pisar lo que se esté
  // editando: `seeded` recuerda para qué id se cargó el formulario.
  if (exercise && seeded !== exercise.id) {
    setSeeded(exercise.id);
    setPrimary(directMuscles(exercise));
    setSecondary(indirectMuscles(exercise));
    setError(null);
  }

  async function save() {
    if (!exercise) return;
    if (primary.length === 0) {
      setError("Elegí al menos un músculo principal.");
      return;
    }
    try {
      await update.mutateAsync({
        id: exercise.id,
        primary_muscles: primary,
        secondary_muscles: secondary,
      });
      onClose();
    } catch {
      setError("No se pudo guardar. Reintentá.");
    }
  }

  return (
    <Modal open={!!exercise} onClose={onClose} title="Editar músculos">
      <div className="flex flex-col gap-4">
        <p className="text-sm text-muted">
          Define cómo se reparte el volumen de este ejercicio. Cada serie suma 1
          a los principales y 0,5 a los secundarios.
        </p>

        <MusclePicker
          primary={primary}
          secondary={secondary}
          onChange={(p, sec) => {
            setPrimary(p);
            setSecondary(sec);
          }}
        />

        {error && (
          <p role="alert" className="text-sm text-danger">
            {error}
          </p>
        )}

        {/* El cambio es retroactivo: las métricas se recalculan sobre todo el
            historial, no sólo sobre lo que venga después. */}
        <p className="text-xs text-muted">
          Cambiar esto recalcula tus métricas por músculo de todo el historial.
        </p>

        <div className="flex gap-2">
          <Button onClick={save} loading={update.isPending} className="flex-1">
            Guardar
          </Button>
          <Button variant="ghost" onClick={onClose}>
            Cancelar
          </Button>
        </div>
      </div>
    </Modal>
  );
}
