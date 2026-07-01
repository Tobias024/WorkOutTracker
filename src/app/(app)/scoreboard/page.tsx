"use client";

import { useState } from "react";
import { Trophy, Medal, ChevronDown } from "lucide-react";
import { PageHeader, Spinner, EmptyState, Button } from "@/components/ui";
import { ExercisePickerModal } from "@/components/ExercisePickerModal";
import { NotificationToggle } from "@/components/NotificationToggle";
import {
  useScoreboard,
  type Metric,
  type Period,
} from "@/hooks/useScoreboard";
import { formatVolume, formatWeight } from "@/lib/format";
import { clsx } from "@/lib/clsx";
import type { Exercise } from "@/lib/types";

const METRICS: { key: Metric; label: string }[] = [
  { key: "volume", label: "Volumen" },
  { key: "frequency", label: "Frecuencia" },
  { key: "weight", label: "Peso" },
];
const PERIODS: { key: Period; label: string }[] = [
  { key: "week", label: "Semana" },
  { key: "month", label: "Mes" },
  { key: "all", label: "Todo" },
];

export default function ScoreboardPage() {
  const [metric, setMetric] = useState<Metric>("volume");
  const [period, setPeriod] = useState<Period>("week");
  const [exercise, setExercise] = useState<Exercise | null>(null);
  const [picker, setPicker] = useState(false);

  const { data, isLoading, isError } = useScoreboard(
    metric,
    period,
    exercise?.id,
  );

  function fmt(v: number) {
    if (metric === "frequency") return `${v} ${v === 1 ? "día" : "días"}`;
    if (metric === "volume") return formatVolume(v);
    return formatWeight(v);
  }

  return (
    <div>
      <PageHeader
        title="Ranking"
        subtitle="Competí con tus amigos"
        action={<NotificationToggle />}
      />

      <div className="flex gap-1.5 mb-2">
        {METRICS.map((mt) => (
          <Pill
            key={mt.key}
            active={metric === mt.key}
            onClick={() => setMetric(mt.key)}
          >
            {mt.label}
          </Pill>
        ))}
      </div>
      <div className="flex gap-1.5 mb-4">
        {PERIODS.map((p) => (
          <Pill
            key={p.key}
            active={period === p.key}
            onClick={() => setPeriod(p.key)}
          >
            {p.label}
          </Pill>
        ))}
      </div>

      {metric === "weight" && (
        <Button
          variant="secondary"
          className="w-full mb-4 justify-between"
          onClick={() => setPicker(true)}
        >
          <span className="truncate">
            {exercise ? exercise.name : "Elegí un ejercicio"}
          </span>
          <ChevronDown className="size-4" />
        </Button>
      )}

      {metric === "weight" && !exercise ? (
        <EmptyState
          icon={<Trophy className="size-8" />}
          title="Elegí un ejercicio"
          description="Para comparar pesos máximos entre amigos."
        />
      ) : isLoading ? (
        <div className="grid place-items-center py-16">
          <Spinner />
        </div>
      ) : isError ? (
        <EmptyState title="No se pudo cargar el ranking" />
      ) : !data?.length ? (
        <EmptyState
          icon={<Trophy className="size-8" />}
          title="Sin datos todavía"
          description="Sumá amigos y entrená para aparecer en el ranking."
        />
      ) : (
        <ul className="flex flex-col gap-2">
          {data.map((row, i) => (
            <li
              key={row.user_id}
              className={clsx(
                "card flex items-center gap-3 p-3.5",
                i === 0 && Number(row.value) > 0 && "ring-1 ring-accent/40",
              )}
            >
              <div className="w-7 text-center shrink-0">
                {i < 3 && Number(row.value) > 0 ? (
                  <Medal
                    className={clsx(
                      "size-5 mx-auto",
                      i === 0
                        ? "text-accent"
                        : i === 1
                          ? "text-muted"
                          : "text-amber-700",
                    )}
                  />
                ) : (
                  <span className="text-muted text-sm">{i + 1}</span>
                )}
              </div>
              <div className="min-w-0 flex-1">
                <p className="font-medium truncate">
                  {row.display_name ?? row.username}
                </p>
              </div>
              <span className="font-semibold tabular-nums">
                {fmt(Number(row.value))}
              </span>
            </li>
          ))}
        </ul>
      )}

      <ExercisePickerModal
        open={picker}
        onClose={() => setPicker(false)}
        title="Elegí un ejercicio"
        onSelect={(ex) => setExercise(ex)}
      />
    </div>
  );
}

function Pill({
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
        "flex-1 rounded-md py-2 text-sm font-medium ring-1 transition",
        active
          ? "bg-primary text-primary-fg ring-primary"
          : "bg-surface-2 text-muted ring-border hover:text-fg",
      )}
    >
      {children}
    </button>
  );
}
