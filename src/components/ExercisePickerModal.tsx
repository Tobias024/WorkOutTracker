"use client";

import { useMemo, useState } from "react";
import { Search, Plus } from "lucide-react";
import { Modal, Input, Spinner, Badge, Tabs, Button } from "@/components/ui";
import { ExerciseImage } from "@/components/ExerciseImage";
import { CreateExerciseModal } from "@/components/CreateExerciseModal";
import { useExercises, filterExercises } from "@/hooks/useExercises";
import { useHistory } from "@/hooks/useHistory";
import { sessionDate } from "@/lib/metrics";
import { MUSCLES_ES, MUSCLE_FILTERS, muscleEs, equipmentEs } from "@/lib/i18n-exercise";
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
  const { data: history } = useHistory();
  const [query, setQuery] = useState("");
  const [muscle, setMuscle] = useState<string>("");
  const [creating, setCreating] = useState(false);

  // Fecha del último uso por ejercicio, para sugerir primero los ya realizados.
  const doneAt = useMemo(() => {
    const m = new Map<string, number>();
    for (const s of history ?? []) {
      const t = new Date(sessionDate(s)).getTime();
      for (const we of s.workout_exercises) {
        if (t > (m.get(we.exercise_id) ?? 0)) m.set(we.exercise_id, t);
      }
    }
    return m;
  }, [history]);

  // Filtrado + orden: realizados primero (más reciente arriba), luego el resto
  // en su orden alfabético original (Array.sort estable).
  const list = useMemo(() => {
    const filtered = filterExercises(data ?? [], query, muscle || undefined);
    return [...filtered]
      .sort((a, b) => (doneAt.get(b.id) ?? 0) - (doneAt.get(a.id) ?? 0))
      .slice(0, 80);
  }, [data, query, muscle, doneAt]);

  return (
    <>
    <Modal open={open} onClose={onClose} title={title}>
      <div className="flex flex-col gap-3">
        {/* Búsqueda + filtro pegados arriba: el teclado no tapa los resultados
            (la hoja usa dvh y esto queda sticky mientras scrolleás la lista). */}
        <div className="sticky top-0 z-10 bg-surface -mx-4 -mt-4 px-4 pt-4 pb-2 flex flex-col gap-3 border-b border-border">
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
              ...MUSCLE_FILTERS.map((m) => ({ value: m, label: MUSCLES_ES[m] })),
            ]}
          />
        </div>

        {isLoading ? (
          <div className="grid place-items-center py-10">
            <Spinner />
          </div>
        ) : list.length === 0 ? (
          <div className="text-center py-8 flex flex-col items-center gap-3">
            <p className="text-sm text-muted">No se encontraron ejercicios.</p>
            <Button variant="secondary" size="sm" onClick={() => setCreating(true)}>
              <Plus className="size-4" /> Crear &ldquo;{query.trim() || "ejercicio"}&rdquo;
            </Button>
          </div>
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
                      {doneAt.has(ex.id) && (
                        <Badge className="bg-primary/15 text-primary ring-primary/30">
                          Hecho
                        </Badge>
                      )}
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

        {list.length > 0 && (
          <Button
            variant="ghost"
            size="sm"
            className="w-full"
            onClick={() => setCreating(true)}
          >
            <Plus className="size-4" /> Crear ejercicio nuevo
          </Button>
        )}
      </div>
    </Modal>

      <CreateExerciseModal
        open={creating}
        onClose={() => setCreating(false)}
        initialName={query.trim()}
        onCreated={(ex) => {
          setCreating(false);
          onSelect(ex);
          onClose();
        }}
      />
    </>
  );
}
