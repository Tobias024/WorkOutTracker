// SPDX-License-Identifier: AGPL-3.0-only
"use client";

import { useMemo, useState } from "react";
import { Search, Plus, Check } from "lucide-react";
import { Modal, Input, Badge, Tabs, Button, QueryState } from "@/components/ui";
import { ExerciseImage } from "@/components/ExerciseImage";
import { CreateExerciseModal } from "@/components/CreateExerciseModal";
import { useExercises, filterExercises } from "@/hooks/useExercises";
import { useQuery } from "@tanstack/react-query";
import { createClient } from "@/lib/supabase/client";
import { toast } from "@/lib/toast";
import { MUSCLES_ES, MUSCLE_GROUPS, muscleEs, equipmentEs } from "@/lib/i18n-exercise";
import { primaryMuscle } from "@/lib/muscle-contributions";
import type { Exercise } from "@/lib/types";

/** Máximo de filas renderizadas: el catálogo ronda el millar. */
const LIMIT = 80;

export function ExercisePickerModal({
  open,
  onClose,
  onSelect,
  title = "Agregar ejercicio",
  multi = false,
  addedIds,
}: {
  open: boolean;
  onClose: () => void;
  onSelect: (exercise: Exercise) => void;
  title?: string;
  /**
   * Selección múltiple: tocar una fila llama a `onSelect` y el picker queda
   * abierto (cierra el botón "Listo"). Sin esto cierra al elegir.
   */
  multi?: boolean;
  /** Ejercicios ya presentes (modo multi): se marcan y no se pueden volver a tocar. */
  addedIds?: Set<string>;
}) {
  const exercisesQuery = useExercises();
  const data = exercisesQuery.data;
  const { data: lastUsed } = useQuery({
    queryKey: ["history", "exercise-last-used"],
    staleTime: 5 * 60_000,
    queryFn: async () => {
      const { data, error } = await createClient().rpc("exercise_last_used");
      if (error) throw error;
      return data ?? [];
    },
  });
  const [query, setQuery] = useState("");
  const [muscle, setMuscle] = useState<string>("");
  const [creating, setCreating] = useState(false);

  // Fecha del último uso por ejercicio, para sugerir primero los ya realizados.
  const doneAt = useMemo(() => {
    const m = new Map<string, number>();
    for (const r of lastUsed ?? []) {
      m.set(r.exercise_id, new Date(r.last_at).getTime());
    }
    return m;
  }, [lastUsed]);

  // Filtrado + orden: realizados primero (más reciente arriba), luego el resto
  // en su orden alfabético original (Array.sort estable).
  // Al cerrar el picker se limpian búsqueda y filtro.
  function handleClose() {
    setQuery("");
    setMuscle("");
    onClose();
  }

  const { list, total } = useMemo(() => {
    const filtered = filterExercises(data ?? [], query, muscle || undefined);
    const sorted = [...filtered].sort(
      (a, b) => (doneAt.get(b.id) ?? 0) - (doneAt.get(a.id) ?? 0),
    );
    return { list: sorted.slice(0, LIMIT), total: sorted.length };
  }, [data, query, muscle, doneAt]);

  function pick(ex: Exercise) {
    if (!multi) {
      onSelect(ex);
      handleClose();
      return;
    }
    if (addedIds?.has(ex.id)) return;
    onSelect(ex);
    // `id` fijo: varios toques seguidos reemplazan el toast en vez de apilarlos.
    toast(`Agregado: ${ex.name}`, { id: "picker-added", duration: 1500 });
  }

  const muscleLabel = muscle ? MUSCLES_ES[muscle] ?? muscle : "";
  const q = query.trim();

  return (
    <>
    <Modal
      open={open}
      onClose={handleClose}
      title={title}
      footer={
        multi ? (
          <Button size="lg" className="w-full" onClick={handleClose}>
            Listo
          </Button>
        ) : undefined
      }
    >
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
              ...MUSCLE_GROUPS.map((m) => ({ value: m, label: MUSCLES_ES[m] })),
            ]}
          />
        </div>

        <QueryState
          query={exercisesQuery}
          errorTitle="No pudimos cargar los ejercicios"
        >
          {() =>
            list.length === 0 ? (
              <div className="text-center py-8 flex flex-col items-center gap-3">
                <p className="text-sm text-muted">
                  {q && muscle
                    ? `Sin resultados para «${q}» en ${muscleLabel}.`
                    : q
                      ? `Sin resultados para «${q}».`
                      : muscle
                        ? `No hay ejercicios de ${muscleLabel}.`
                        : "El catálogo está vacío."}
                </p>
                {muscle && (
                  <Button variant="secondary" size="sm" onClick={() => setMuscle("")}>
                    Buscar en todos los músculos
                  </Button>
                )}
                <Button
                  variant={muscle ? "ghost" : "secondary"}
                  size="sm"
                  onClick={() => setCreating(true)}
                >
                  <Plus className="size-4" /> Crear &ldquo;{q || "ejercicio"}&rdquo;
                </Button>
              </div>
            ) : (
              <>
                <ul className="flex flex-col gap-1.5">
                  {list.map((ex) => {
                    const added = !!multi && !!addedIds?.has(ex.id);
                    return (
                      <li key={ex.id}>
                        <button
                          onClick={() => pick(ex)}
                          aria-disabled={added || undefined}
                          className={
                            "w-full flex items-center gap-3 rounded-md p-2 text-left transition " +
                            (added ? "bg-primary/10" : "hover:bg-surface-2")
                          }
                        >
                          <ExerciseImage
                            src={ex.images[0]}
                            alt={ex.name}
                            className="size-12 rounded shrink-0"
                          />
                          <div className="min-w-0 flex-1">
                            <p className="font-medium truncate">{ex.name}</p>
                            <div className="flex gap-1.5 mt-0.5 flex-wrap">
                              {added && (
                                <Badge className="bg-primary/15 text-primary ring-primary/30">
                                  En la rutina
                                </Badge>
                              )}
                              {doneAt.has(ex.id) && (
                                <Badge className="bg-primary/15 text-primary ring-primary/30">
                                  Hecho
                                </Badge>
                              )}
                              {primaryMuscle(ex) && (
                                <Badge>{muscleEs(primaryMuscle(ex))}</Badge>
                              )}
                              {ex.equipment && (
                                <Badge>{equipmentEs(ex.equipment)}</Badge>
                              )}
                            </div>
                          </div>
                          {added && (
                            <Check className="size-5 shrink-0 text-primary" aria-hidden />
                          )}
                        </button>
                      </li>
                    );
                  })}
                </ul>
                {total > LIMIT && (
                  <p className="text-center text-xs text-muted">
                    Mostrando {LIMIT} de {total}. Escribí para afinar.
                  </p>
                )}
              </>
            )
          }
        </QueryState>

        {!exercisesQuery.isError && list.length > 0 && (
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
        key={creating ? `open-${query.trim()}` : "closed"}
        open={creating}
        onClose={() => setCreating(false)}
        initialName={query.trim()}
        onCreated={(ex) => {
          setCreating(false);
          onSelect(ex);
          // En modo multi el picker sigue abierto para seguir sumando.
          if (!multi) handleClose();
        }}
      />
    </>
  );
}
