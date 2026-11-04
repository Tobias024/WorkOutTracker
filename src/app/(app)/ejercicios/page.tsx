// SPDX-License-Identifier: AGPL-3.0-only
"use client";

import { useState } from "react";
import { Search, SearchX } from "lucide-react";
import {
  PageHeader,
  Input,
  Badge,
  Tabs,
  Button,
  EmptyState,
  QueryState,
} from "@/components/ui";
import { ExerciseImage } from "@/components/ExerciseImage";
import { useExercises, filterExercises } from "@/hooks/useExercises";
import { MUSCLES_ES, MUSCLE_GROUPS, equipmentEs, categoryEs } from "@/lib/i18n-exercise";
import type { Exercise } from "@/lib/types";
import { ExerciseDetailModal } from "@/components/ExerciseDetailModal";

const LIMIT = 120;

export default function ExercisesPage() {
  const exercisesQuery = useExercises();
  const [query, setQuery] = useState("");
  const [muscle, setMuscle] = useState("");
  const [selected, setSelected] = useState<Exercise | null>(null);

  const filtered = filterExercises(exercisesQuery.data ?? [], query, muscle || undefined);
  const list = filtered.slice(0, LIMIT);
  const q = query.trim();

  return (
    <div>
      <PageHeader
        title="Ejercicios"
        back="/rutinas"
        subtitle={
          exercisesQuery.data
            ? `${exercisesQuery.data.length} en el catálogo`
            : undefined
        }
      />

      <div className="relative mb-3">
        <Search className="size-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted" />
        <Input
          placeholder="Buscar ejercicio…"
          aria-label="Buscar ejercicio"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          className="pl-9"
        />
      </div>

      <div className="mb-4">
        <Tabs
          scroll
          ariaLabel="Filtrar por músculo"
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
        errorTitle="No pudimos cargar el catálogo"
      >
        {() =>
          list.length === 0 ? (
            <EmptyState
              icon={<SearchX className="size-8" />}
              title={q ? `Sin resultados para «${q}»` : "Sin resultados"}
              description={
                muscle
                  ? `Probá sin el filtro de ${MUSCLES_ES[muscle] ?? muscle}.`
                  : "Probá con otra búsqueda."
              }
              action={
                <Button
                  variant="secondary"
                  onClick={() => {
                    setQuery("");
                    setMuscle("");
                  }}
                >
                  Limpiar filtros
                </Button>
              }
            />
          ) : (
            <>
              <ul className="grid grid-cols-2 gap-3">
                {list.map((ex) => (
                  <li key={ex.id}>
                    <button
                      onClick={() => setSelected(ex)}
                      className="card overflow-hidden text-left w-full hover:ring-1 hover:ring-primary transition"
                    >
                      <ExerciseImage
                        src={ex.images[0]}
                        alt={ex.name}
                        className="h-28 w-full"
                      />
                      <div className="p-3">
                        <p className="font-medium text-sm leading-tight line-clamp-2">
                          {ex.name}
                        </p>
                        <div className="flex flex-wrap gap-1 mt-2">
                          {ex.category && <Badge>{categoryEs(ex.category)}</Badge>}
                          {ex.equipment && <Badge>{equipmentEs(ex.equipment)}</Badge>}
                        </div>
                      </div>
                    </button>
                  </li>
                ))}
              </ul>
              {filtered.length > LIMIT && (
                <p className="mt-4 text-center text-xs text-muted">
                  Mostrando {LIMIT} de {filtered.length}. Escribí para afinar.
                </p>
              )}
            </>
          )
        }
      </QueryState>

      <ExerciseDetailModal
        exercise={selected}
        onClose={() => setSelected(null)}
      />
    </div>
  );
}
