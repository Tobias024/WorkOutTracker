"use client";

import { useState } from "react";
import { Search } from "lucide-react";
import { Modal, Input, Spinner, Badge } from "@/components/ui";
import { ExerciseImage } from "@/components/ExerciseImage";
import { useExercises, filterExercises } from "@/hooks/useExercises";
import { muscleEs, equipmentEs } from "@/lib/i18n-exercise";
import type { Exercise } from "@/lib/types";

export function ReplaceExerciseModal({
  open,
  onClose,
  currentName,
  canSaveForFuture,
  onReplace,
}: {
  open: boolean;
  onClose: () => void;
  currentName: string;
  canSaveForFuture: boolean;
  onReplace: (newExercise: Exercise, saveForFuture: boolean) => void;
}) {
  const { data, isLoading } = useExercises();
  const [query, setQuery] = useState("");
  const [saveForFuture, setSaveForFuture] = useState(false);

  const list = filterExercises(data ?? [], query).slice(0, 60);

  return (
    <Modal open={open} onClose={onClose} title={`Reemplazar "${currentName}"`}>
      <div className="flex flex-col gap-3">
        {canSaveForFuture && (
          <label className="flex items-center gap-2.5 text-sm card p-3 cursor-pointer">
            <input
              type="checkbox"
              checked={saveForFuture}
              onChange={(e) => setSaveForFuture(e.target.checked)}
              className="size-4 accent-[var(--color-primary)]"
            />
            <span>
              Guardar para futuras iteraciones de esta rutina
              <span className="block text-xs text-muted">
                Si no lo marcás, el cambio aplica sólo a este entrenamiento.
              </span>
            </span>
          </label>
        )}

        <div className="relative">
          <Search className="size-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted" />
          <Input
            autoFocus
            placeholder="Buscar reemplazo…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="pl-9"
          />
        </div>

        {isLoading ? (
          <div className="grid place-items-center py-10">
            <Spinner />
          </div>
        ) : (
          <ul className="flex flex-col gap-1.5">
            {list.map((ex) => (
              <li key={ex.id}>
                <button
                  onClick={() => {
                    onReplace(ex, saveForFuture);
                    onClose();
                  }}
                  className="w-full flex items-center gap-3 rounded-xl p-2 hover:bg-surface-2 text-left transition"
                >
                  <ExerciseImage
                    src={ex.images[0]}
                    alt={ex.name}
                    className="size-12 rounded-lg shrink-0"
                  />
                  <div className="min-w-0 flex-1">
                    <p className="font-medium truncate">{ex.name}</p>
                    <div className="flex gap-1.5 mt-0.5 flex-wrap">
                      {ex.primary_muscles[0] && (
                        <Badge>{muscleEs(ex.primary_muscles[0])}</Badge>
                      )}
                      {ex.equipment && <Badge>{equipmentEs(ex.equipment)}</Badge>}
                    </div>
                  </div>
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </Modal>
  );
}
