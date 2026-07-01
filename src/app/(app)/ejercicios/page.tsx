"use client";

import { useState } from "react";
import { Search } from "lucide-react";
import { PageHeader, Input, Spinner, Badge } from "@/components/ui";
import { ExerciseImage } from "@/components/ExerciseImage";
import { useExercises, filterExercises } from "@/hooks/useExercises";
import { MUSCLES_ES, equipmentEs, categoryEs } from "@/lib/i18n-exercise";
import { clsx } from "@/lib/clsx";
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

      <div className="flex gap-2 overflow-x-auto no-scrollbar pb-1 mb-4">
        <Chip active={!muscle} onClick={() => setMuscle("")}>
          Todos
        </Chip>
        {Object.keys(MUSCLES_ES).map((m) => (
          <Chip key={m} active={muscle === m} onClick={() => setMuscle(m)}>
            {MUSCLES_ES[m]}
          </Chip>
        ))}
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

function Chip({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      className={clsx(
        "shrink-0 rounded-md px-3 py-1 text-xs ring-1 transition",
        active
          ? "bg-primary text-primary-fg ring-primary"
          : "bg-surface-2 text-muted ring-border hover:text-fg",
      )}
    >
      {children}
    </button>
  );
}
