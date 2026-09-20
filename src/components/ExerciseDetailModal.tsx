// SPDX-License-Identifier: AGPL-3.0-only
"use client";

import { useState } from "react";
import { Pencil } from "lucide-react";
import { Modal, Badge, Button } from "@/components/ui";
import { ExerciseImage } from "@/components/ExerciseImage";
import { useExerciseInstructions } from "@/hooks/useExercises";
import {
  muscleEs,
  equipmentEs,
  categoryEs,
  levelEs,
  forceEs,
  mechanicEs,
} from "@/lib/i18n-exercise";
import { directMuscles, indirectMuscles } from "@/lib/muscle-contributions";
import { useCurrentUserId } from "@/hooks/useUser";
import { EditMusclesModal } from "@/components/EditMusclesModal";
import type { Exercise } from "@/lib/types";

export function ExerciseDetailModal({
  exercise,
  onClose,
}: {
  exercise: Exercise | null;
  onClose: () => void;
}) {
  const { data: instructions } = useExerciseInstructions(exercise?.id);
  const direct = exercise ? directMuscles(exercise) : [];
  const indirect = exercise ? indirectMuscles(exercise) : [];
  const { data: userId } = useCurrentUserId();
  const [editing, setEditing] = useState(false);
  // Sólo los propios: los del catálogo global tienen `created_by` null y la RLS
  // no deja tocarlos (rechaza en silencio, así que el botón ni se ofrece).
  const canEdit = !!exercise && !!userId && exercise.created_by === userId;
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
                  className="h-44 w-60 rounded-md shrink-0"
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

          {/* Los músculos salen de la capa de contribución, no de las columnas
              crudas: es el mismo reparto con el que se cuenta el volumen. La
              ficha mostraba menos (los custom nacieron sin secundarios) y para
              los hombros mostraba otra cosa ("Hombros" acá, "Deltoides lateral"
              en las métricas). */}
          {direct.length > 0 && (
            <div>
              <p className="text-xs text-muted mb-1.5">
                Músculos principales{indirect.length > 0 && " y secundarios"}
              </p>
              <div className="flex flex-wrap gap-1.5">
                {direct.map((m) => (
                  <Badge key={m} className="bg-primary/15 text-primary ring-primary/30">
                    {muscleEs(m)}
                  </Badge>
                ))}
                {indirect.map((m) => (
                  <Badge key={m}>{muscleEs(m)}</Badge>
                ))}
              </div>
            </div>
          )}

          {canEdit && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setEditing(true)}
              className="self-start"
            >
              <Pencil className="size-4" /> Editar músculos
            </Button>
          )}

          {instructions && instructions.length > 0 && (
            <div>
              <p className="text-xs text-muted mb-1.5">Instrucciones</p>
              <ol className="list-decimal list-inside text-sm space-y-1.5 text-muted">
                {instructions.map((step, i) => (
                  <li key={i}>{step}</li>
                ))}
              </ol>
            </div>
          )}
        </div>
      )}
      <EditMusclesModal
        exercise={editing ? exercise : null}
        onClose={() => setEditing(false)}
      />
    </Modal>
  );
}
