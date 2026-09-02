// SPDX-License-Identifier: AGPL-3.0-only
"use client";

import { useState } from "react";
import { Search } from "lucide-react";
import { PageHeader, Input, Spinner, Badge, Tabs } from "@/components/ui";
import { ExerciseImage } from "@/components/ExerciseImage";
import { useExercises, filterExercises } from "@/hooks/useExercises";
import { MUSCLES_ES, MUSCLE_FILTERS, equipmentEs, categoryEs } from "@/lib/i18n-exercise";
import type { Exercise } from "@/lib/types";
import { ExerciseDetailModal } from "@/components/ExerciseDetailModal";

export default function ExercisesPage() {
  const { data, isLoading } = useExercises();
  const [query, setQuery] = useState("");
  const [muscle, setMuscle] = useState("");
  const [selected, setSelected] = useState<Exercise | null>(null);

  const list = filterExercises(data ?? [], query, muscle || undefined).slice(
    0,
    120,
  );

  return (
    <div>
      <PageHeader
        title="Ejercicios"
        subtitle={`${data?.length ?? 0} en el catálogo`}
      />

      <div className="relative mb-3">
        <Search className="size-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted" />
        <Input
          placeholder="Buscar…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          className="pl-9"
        />
      </div>

      <div className="mb-4">
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
        <div className="grid place-items-center py-16">
          <Spinner />
        </div>
      ) : (
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
      )}

      <ExerciseDetailModal
        exercise={selected}
        onClose={() => setSelected(null)}
      />
    </div>
  );
}
