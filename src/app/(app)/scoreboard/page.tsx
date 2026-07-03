"use client";

import { useState } from "react";
import Link from "next/link";
import { Trophy, Medal, ChevronDown, ChevronRight } from "lucide-react";
import { PageHeader, Spinner, EmptyState, Button, Tabs } from "@/components/ui";
import { ExercisePickerModal } from "@/components/ExercisePickerModal";
import { NotificationToggle } from "@/components/NotificationToggle";
import {
  useScoreboard,
  type Metric,
  type Period,
} from "@/hooks/useScoreboard";
import { useCurrentUserId } from "@/hooks/useFriendProfile";
import { formatVolume, formatWeight } from "@/lib/format";
import { clsx } from "@/lib/clsx";
import type { Exercise, Sex } from "@/lib/types";

const METRICS: { key: Metric; label: string }[] = [
  { key: "volume", label: "Volumen" },
  { key: "frequency", label: "Frecuencia" },
  { key: "strength", label: "Fuerza" },
];
const PERIODS: { key: Period; label: string }[] = [
  { key: "week", label: "Semana" },
  { key: "month", label: "Mes" },
  { key: "all", label: "Todo" },
];
const SEXES: { key: Sex | ""; label: string }[] = [
  { key: "", label: "Todos" },
  { key: "male", label: "Varones" },
  { key: "female", label: "Mujeres" },
];
const NEEDS_EXERCISE: Metric[] = ["weight", "strength"];

export default function ScoreboardPage() {
  const [metric, setMetric] = useState<Metric>("volume");
  const [period, setPeriod] = useState<Period>("week");
  const [sex, setSex] = useState<Sex | "">("");
  const [exercise, setExercise] = useState<Exercise | null>(null);
  const [picker, setPicker] = useState(false);

  const { data: meId } = useCurrentUserId();

  const { data, isLoading, isError } = useScoreboard(
    metric,
    period,
    exercise?.id,
    sex || null,
  );

  function fmt(v: number) {
    if (metric === "frequency") return `${v} ${v === 1 ? "día" : "días"}`;
    if (metric === "reps") return `${v} reps`;
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

      <div className="mb-2">
        <Tabs
          value={metric}
          onChange={setMetric}
          options={METRICS.map((mt) => ({ value: mt.key, label: mt.label }))}
        />
      </div>
      <div className="mb-2">
        <Tabs
          value={period}
          onChange={setPeriod}
          options={PERIODS.map((p) => ({ value: p.key, label: p.label }))}
        />
      </div>
      <div className="mb-4">
        <Tabs
          value={sex}
          onChange={setSex}
          options={SEXES.map((s) => ({ value: s.key, label: s.label }))}
        />
      </div>

      {NEEDS_EXERCISE.includes(metric) && (
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

      {NEEDS_EXERCISE.includes(metric) && !exercise ? (
        <EmptyState
          icon={<Trophy className="size-8" />}
          title="Elegí un ejercicio"
          description="Para comparar entre amigos."
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
          {data.map((row, i) => {
            const isMe = row.user_id === meId;
            return (
              <li key={row.user_id}>
                <Link
                  href={isMe ? "/perfil" : `/amigos/${row.user_id}`}
                  className={clsx(
                    "card flex items-center gap-3 p-3.5 hover:ring-1 hover:ring-primary transition",
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
                      {isMe ? "Vos" : row.display_name ?? row.username}
                    </p>
                  </div>
                  <span className="font-semibold tabular-nums">
                    {fmt(Number(row.value))}
                  </span>
                  <ChevronRight className="size-4 text-muted shrink-0" />
                </Link>
              </li>
            );
          })}
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
