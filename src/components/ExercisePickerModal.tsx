"use client";

import { useState } from "react";
import { Search } from "lucide-react";
import { Modal, Input, Spinner, Badge, Tabs } from "@/components/ui";
import { ExerciseImage } from "@/components/ExerciseImage";
import { useExercises, filterExercises } from "@/hooks/useExercises";
import { MUSCLES_ES, muscleEs, equipmentEs } from "@/lib/i18n-exercise";
import type { Exercise } from "@/lib/types";

export function ExercisePickerModal({
  open,
  onClose,
  onSelect,
  title = "Agregar ejercicio",
}: {
  open: boolean;
  onClose: () => void;
  onSelect: (exercise: Exercise) => void;
  title?: string;
}) {
  const { data, isLoading } = useExercises();
  const [query, setQuery] = useState("");
  const [muscle, setMuscle] = useState<string>("");

  const list = filterExercises(data ?? [], query, muscle || undefined).slice(
    0,
    80,
  );

  return (
    <Modal open={open} onClose={onClose} title={title}>
      <div className="flex flex-col gap-3">
        <div className="relative">
          <Search className="size-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted" />
          <Input
            autoFocus
            placeholder="Buscar ejercicio…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="pl-9"
          />
        </div>

        <Tabs
          scroll
          value={muscle}
          onChange={setMuscle}
          options={[
            { value: "", label: "Todos" },
            ...Object.keys(MUSCLES_ES).map((m) => ({ value: m, label: MUSCLES_ES[m] })),
          ]}
        />

        {isLoading ? (
          <div className="grid place-items-center py-10">
            <Spinner />
          </div>
        ) : list.length === 0 ? (
          <p className="text-sm text-muted text-center py-10">
            No se encontraron ejercicios.
          </p>
        ) : (
          <ul className="flex flex-col gap-1.5">
            {list.map((ex) => (
              <li key={ex.id}>
                <button
                  onClick={() => {
                    onSelect(ex);
                    onClose();
                  }}
                  className="w-full flex items-center gap-3 rounded-md p-2 hover:bg-surface-2 text-left transition"
                >
                  <ExerciseImage
                    src={ex.images[0]}
                    alt={ex.name}
                    className="size-12 rounded shrink-0"
                  />
                  <div className="min-w-0 flex-1">
                    <p className="font-medium truncate">{ex.name}</p>
                    <div className="flex gap-1.5 mt-0.5 flex-wrap">
                      {ex.primary_muscles[0] && (
                        <Badge>{muscleEs(ex.primary_muscles[0])}</Badge>
                      )}
                      {ex.equipment && (
                        <Badge>{equipmentEs(ex.equipment)}</Badge>
                      )}
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
