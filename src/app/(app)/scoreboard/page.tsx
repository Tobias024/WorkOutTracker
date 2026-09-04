// SPDX-License-Identifier: AGPL-3.0-only
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
  Users,
  SlidersHorizontal,
} from "lucide-react";
import {
  PageHeader,
  Spinner,
  EmptyState,
  Button,
  Tabs,
  Modal,
} from "@/components/ui";
import { ExercisePickerModal } from "@/components/ExercisePickerModal";
import { NotificationToggle } from "@/components/NotificationToggle";
import { FriendsPanel } from "@/components/FriendsPanel";
import {
  useScoreboard,
  type Metric,
  type Period,
} from "@/hooks/useScoreboard";
import { useCurrentUserId } from "@/hooks/useFriendProfile";
import { useFriends } from "@/hooks/useFriends";
import { useGoal } from "@/hooks/useGoal";
import { formatVolume, formatWeight } from "@/lib/format";
import { clsx } from "@/lib/clsx";
import type { Exercise, Sex, Goal } from "@/lib/types";

type BoardKey = "constancia" | "series" | "1rm" | "fuerza_rel" | "reps";

const BOARDS: { key: BoardKey; label: string; caption: string }[] = [
  {
    key: "constancia",
    label: "Constancia",
    caption: "Días distintos con entrenamiento. La constancia es lo que más pesa.",
  },
  {
    key: "series",
    label: "Series",
    caption:
      "Series efectivas: el volumen que impulsa el progreso (no el tonelaje). Cada uno se mide contra su propio objetivo, así que el mínimo de reps y de cercanía al fallo cambia entre personas.",
  },
  {
    key: "1rm",
    label: "1RM",
    caption: "1RM estimado (Epley) del ejercicio elegido.",
  },
  {
    key: "fuerza_rel",
    label: "Fuerza rel.",
    caption:
      "Fuerza relativa general: promedio de tu 1RM estimado por ejercicio ÷ tu peso corporal. No hace falta elegir ejercicio.",
  },
  {
    key: "reps",
    label: "Reps",
    caption: "Repeticiones totales de las series de trabajo.",
  },
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

const GOAL_SHORT: Record<Goal, string> = {
  fuerza: "Fue",
  hipertrofia: "Hip",
  resistencia: "Res",
  perdida_grasa: "Grasa",
};

function boardForGoal(goal: Goal | null): BoardKey {
  if (goal === "fuerza") return "1rm";
  if (goal === "hipertrofia") return "series";
  if (goal === "resistencia") return "reps";
  return "constancia";
}

export default function ScoreboardPage() {
  const [board, setBoard] = useState<BoardKey | null>(null);
  const [bwMode, setBwMode] = useState(false); // 1RM ÷ peso
  const [period, setPeriod] = useState<Period>("week");
  const [sex, setSex] = useState<Sex | "">("");
  const [sameGoal, setSameGoal] = useState(false);
  const [exercise, setExercise] = useState<Exercise | null>(null);
  const [picker, setPicker] = useState(false);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [friendsOpen, setFriendsOpen] = useState(false);

  const { data: meId } = useCurrentUserId();
  const { data: myGoal } = useGoal();
  const { data: friends } = useFriends();

  const activeBoard = board ?? boardForGoal(myGoal ?? null);
  const metric: Metric =
    activeBoard === "constancia"
      ? "frequency"
      : activeBoard === "series"
        ? "hard_sets"
        : activeBoard === "reps"
          ? "reps"
          : activeBoard === "fuerza_rel"
            ? "strength_rel"
            : bwMode
              ? "strength_bw"
              : "strength";
  const needsExercise = activeBoard === "1rm";

  const { data, isLoading, isError } = useScoreboard(
    metric,
    period,
    exercise?.id,
    sex || null,
  );

  // Objetivo por usuario (para badges + filtro "mi objetivo").
  const goalOf = new Map<string, Goal | null>();
  (friends ?? []).forEach((f) => goalOf.set(f.id, f.goal));
  if (meId) goalOf.set(meId, myGoal ?? null);

  const caption = BOARDS.find((b) => b.key === activeBoard)?.caption ?? "";

  // Filtro "solo mi objetivo": recorta y reindexa el podio.
  const rows =
    sameGoal && myGoal
      ? (data ?? []).filter((r) => goalOf.get(r.user_id) === myGoal)
      : data ?? [];

  const myIndex = rows.findIndex((r) => r.user_id === meId);
  const myRow = myIndex >= 0 ? rows[myIndex] : null;

  function fmt(v: number) {
    if (metric === "frequency") return `${v} ${v === 1 ? "día" : "días"}`;
    if (metric === "hard_sets") return `${v} ${v === 1 ? "set" : "sets"}`;
    if (metric === "reps") return `${v} reps`;
    if (metric === "strength_bw" || metric === "strength_rel")
      return `${Number(v).toFixed(2)}×`;
    return formatWeight(v);
  }

  return (
    <div>
      <PageHeader
        title="Ranking"
        subtitle="Competí con tus amigos · ▲▼ vs el período anterior"
        action={
          <div className="flex items-center gap-1">
            <button
              onClick={() => setFriendsOpen(true)}
              aria-label="Amigos"
              className="size-9 grid place-items-center rounded-md text-muted hover:text-fg ring-1 ring-border"
            >
              <Users className="size-4" />
            </button>
            <NotificationToggle />
          </div>
        }
      />

      {/* Tu puesto */}
      {myRow && Number(myRow.value) > 0 && (
        <div className="card flex items-center gap-3 p-3 mb-3">
          <span className="text-xs text-muted">Tu puesto</span>
          <span className="font-bold text-lg">{myIndex + 1}º</span>
          {myRow.move != null && <MoveChip move={myRow.move} />}
          {myGoal && (
            <span className="ml-auto text-xs text-muted">
              {GOAL_SHORT[myGoal]}
            </span>
          )}
        </div>
      )}

      {/* Boards */}
      <div className="mb-2">
        <Tabs
          scroll
          value={activeBoard}
          onChange={setBoard}
          options={BOARDS.map((b) => ({
            value: b.key,
            label:
              boardForGoal(myGoal ?? null) === b.key ? `★ ${b.label}` : b.label,
          }))}
        />
      </div>
      <div className="flex items-center gap-2 mb-2">
        <div className="flex-1">
          <Tabs
            value={period}
            onChange={setPeriod}
            options={PERIODS.map((p) => ({ value: p.key, label: p.label }))}
          />
        </div>
        <button
          onClick={() => setFiltersOpen((v) => !v)}
          aria-label="Filtros"
          className={clsx(
            "size-9 grid place-items-center rounded-md ring-1 shrink-0 transition",
            filtersOpen || sex || sameGoal
              ? "text-primary ring-primary/40 bg-primary/10"
              : "text-muted ring-border hover:text-fg",
          )}
        >
          <SlidersHorizontal className="size-4" />
        </button>
      </div>

      {filtersOpen && (
        <div className="card p-3 mb-2 flex flex-col gap-3">
          <div>
            <p className="text-xs text-muted mb-1.5">Sexo</p>
            <Tabs
              value={sex}
              onChange={setSex}
              options={SEXES.map((s) => ({ value: s.key, label: s.label }))}
            />
          </div>
          {myGoal && (
            <button
              onClick={() => setSameGoal((v) => !v)}
              className="flex items-center justify-between text-sm"
            >
              <span>Solo mi objetivo ({GOAL_SHORT[myGoal]})</span>
              <span
                className={clsx(
                  "px-2 py-0.5 rounded text-xs font-medium ring-1",
                  sameGoal
                    ? "bg-primary/15 text-primary ring-primary/40"
                    : "text-muted ring-border",
                )}
              >
                {sameGoal ? "On" : "Off"}
              </span>
            </button>
          )}
        </div>
      )}

      {activeBoard === "1rm" && (
        <div className="flex gap-2 mb-3">
          <Button
            variant="secondary"
            className="flex-1 justify-between"
            onClick={() => setPicker(true)}
          >
            <span className="truncate">
              {exercise ? exercise.name : "Elegí un ejercicio"}
            </span>
            <ChevronDown className="size-4" />
          </Button>
          <div className="w-28 shrink-0">
            <Tabs
              value={bwMode ? "bw" : "abs"}
              onChange={(v) => setBwMode(v === "bw")}
              options={[
                { value: "abs", label: "kg" },
                { value: "bw", label: "÷peso" },
              ]}
            />
          </div>
        </div>
      )}

      <p className="text-xs text-muted mb-4 px-1">{caption}</p>

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
      ) : !rows.length ? (
        <EmptyState
          icon={<Trophy className="size-8" />}
          title="Sin datos todavía"
          description={
            sameGoal
              ? "Ningún amigo con tu mismo objetivo apareció acá."
              : "Sumá amigos y entrená para aparecer en el ranking."
          }
        />
      ) : (
        <ul className="flex flex-col gap-2">
          {rows.map((row, i) => {
            const isMe = row.user_id === meId;
            const g = goalOf.get(row.user_id);
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
                  {g && (
                    <span className="text-[10px] text-muted ring-1 ring-border rounded px-1.5 py-0.5 shrink-0">
                      {GOAL_SHORT[g]}
                    </span>
                  )}
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

      <Modal open={friendsOpen} onClose={() => setFriendsOpen(false)} title="Amigos">
        <FriendsPanel />
      </Modal>
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
