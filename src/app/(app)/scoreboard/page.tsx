"use client";

import { useState } from "react";
import Link from "next/link";
import {
  Trophy,
  Medal,
  ChevronDown,
  ChevronRight,
  ArrowUp,
  ArrowDown,
} from "lucide-react";
import { PageHeader, Spinner, EmptyState, Button, Tabs } from "@/components/ui";
import { ExercisePickerModal } from "@/components/ExercisePickerModal";
import { NotificationToggle } from "@/components/NotificationToggle";
import { FriendsPanel } from "@/components/FriendsPanel";
import {
  useScoreboard,
  type Metric,
  type Period,
} from "@/hooks/useScoreboard";
import { useCurrentUserId } from "@/hooks/useFriendProfile";
import { formatVolume, formatWeight } from "@/lib/format";
import { clsx } from "@/lib/clsx";
import type { Exercise, Sex } from "@/lib/types";

type MetricDef = { key: Metric; label: string; caption: string };

// Métricas generales (sin elegir ejercicio): las más relevantes, al frente.
const GENERAL: MetricDef[] = [
  {
    key: "frequency",
    label: "Frecuencia",
    caption:
      "Días distintos con entrenamiento en el período. La constancia es lo que más pesa.",
  },
  {
    key: "hard_sets",
    label: "Series",
    caption:
      "Series efectivas (≥5 reps, cerca del fallo). El driver de hipertrofia.",
  },
  {
    key: "volume",
    label: "Volumen",
    caption: "Tonelaje total: reps × peso de las series de trabajo.",
  },
];
// Fuerza por ejercicio (secundaria: requiere elegir un ejercicio).
const STRENGTH: MetricDef[] = [
  {
    key: "strength",
    label: "1RM",
    caption: "1RM estimado (Epley) del ejercicio elegido.",
  },
  {
    key: "strength_bw",
    label: "1RM/peso",
    caption:
      "1RM estimado dividido tu peso corporal. Más justo entre distintos pesos.",
  },
];
const CAPTIONS = new Map(
  [...GENERAL, ...STRENGTH].map((m) => [m.key, m.caption]),
);

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

export default function ScoreboardPage() {
  const [tab, setTab] = useState<"ranking" | "amigos">("ranking");
  const [view, setView] = useState<"general" | "strength">("general");
  const [genMetric, setGenMetric] = useState<Metric>("frequency");
  const [strMetric, setStrMetric] = useState<Metric>("strength");
  const [period, setPeriod] = useState<Period>("week");
  const [sex, setSex] = useState<Sex | "">("");
  const [exercise, setExercise] = useState<Exercise | null>(null);
  const [picker, setPicker] = useState(false);

  const metric = view === "general" ? genMetric : strMetric;
  const needsExercise = view === "strength";

  const { data: meId } = useCurrentUserId();

  const { data, isLoading, isError } = useScoreboard(
    metric,
    period,
    exercise?.id,
    sex || null,
  );

  const caption = CAPTIONS.get(metric) ?? "";

  function fmt(v: number) {
    if (metric === "frequency") return `${v} ${v === 1 ? "día" : "días"}`;
    if (metric === "hard_sets") return `${v} ${v === 1 ? "set" : "sets"}`;
    if (metric === "reps") return `${v} reps`;
    if (metric === "volume") return formatVolume(v);
    if (metric === "strength_bw") return `${Number(v).toFixed(2)}×`;
    return formatWeight(v);
  }

  return (
    <div>
      <PageHeader
        title="Ranking"
        subtitle="Competí con tus amigos · ▲▼ vs el período anterior"
        action={<NotificationToggle />}
      />

      <div className="mb-3">
        <Tabs
          value={tab}
          onChange={setTab}
          options={[
            { value: "ranking", label: "Ranking" },
            { value: "amigos", label: "Amigos" },
          ]}
        />
      </div>

      {tab === "amigos" ? (
        <FriendsPanel />
      ) : (
        <>
      <div className="mb-2">
        <Tabs
          value={view}
          onChange={setView}
          options={[
            { value: "general", label: "General" },
            { value: "strength", label: "Fuerza" },
          ]}
        />
      </div>
      <div className="mb-2">
        {view === "general" ? (
          <Tabs
            value={genMetric}
            onChange={setGenMetric}
            options={GENERAL.map((mt) => ({ value: mt.key, label: mt.label }))}
          />
        ) : (
          <Tabs
            value={strMetric}
            onChange={setStrMetric}
            options={STRENGTH.map((mt) => ({ value: mt.key, label: mt.label }))}
          />
        )}
      </div>
      <div className="mb-2">
        <Tabs
          value={period}
          onChange={setPeriod}
          options={PERIODS.map((p) => ({ value: p.key, label: p.label }))}
        />
      </div>
      <div className="mb-2">
        <Tabs
          value={sex}
          onChange={setSex}
          options={SEXES.map((s) => ({ value: s.key, label: s.label }))}
        />
      </div>

      <p className="text-xs text-muted mb-4 px-1">{caption}</p>

      {needsExercise && (
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

      {needsExercise && !exercise ? (
        <EmptyState
          icon={<Trophy className="size-8" />}
          title="Elegí un ejercicio"
          description="Para comparar la fuerza entre amigos."
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
                    isMe && "bg-primary/5",
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
                  {row.move != null && <MoveChip move={row.move} />}
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
        </>
      )}
    </div>
  );
}

/** Movimiento de puesto vs el período anterior: ▲ subió, ▼ bajó, — se mantuvo. */
function MoveChip({ move }: { move: number }) {
  if (move === 0)
    return (
      <span className="text-muted text-xs w-7 text-right shrink-0">—</span>
    );
  const up = move > 0;
  const Arrow = up ? ArrowUp : ArrowDown;
  return (
    <span
      className={clsx(
        "inline-flex items-center gap-0.5 text-xs font-semibold w-7 justify-end shrink-0",
        up ? "text-success" : "text-danger",
      )}
      title={up ? `Subió ${move}` : `Bajó ${Math.abs(move)}`}
    >
      <Arrow className="size-3" strokeWidth={3} />
      {Math.abs(move)}
    </span>
  );
}
