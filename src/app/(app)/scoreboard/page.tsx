// SPDX-License-Identifier: AGPL-3.0-only
"use client";

import { Suspense, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import {
  Trophy,
  Medal,
  ChevronDown,
  ChevronRight,
  ArrowUp,
  ArrowDown,
  Users,
  UserPlus,
  SlidersHorizontal,
  X,
} from "lucide-react";
import {
  PageHeader,
  EmptyState,
  Button,
  Tabs,
  Modal,
  Switch,
  Skeleton,
  QueryState,
} from "@/components/ui";
import { ExercisePickerModal } from "@/components/ExercisePickerModal";
import { FriendsPanel, InviteCard } from "@/components/FriendsPanel";
import {
  useScoreboard,
  type Metric,
  type Period,
  withRanksAndMoves,
  type ScoreboardRowWithMove,
} from "@/hooks/useScoreboard";
import { useCurrentUserId } from "@/hooks/useFriendProfile";
import { useFriends } from "@/hooks/useFriends";
import { useGoal } from "@/hooks/useGoal";
import { useExerciseMap } from "@/hooks/useExercises";
import { fmtNum, formatWeight } from "@/lib/format";
import { clsx } from "@/lib/clsx";
import type { Sex, Goal } from "@/lib/types";

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

const BOARD_KEYS = BOARDS.map((b) => b.key);

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

const GOAL_LABEL: Record<Goal, string> = {
  fuerza: "Fuerza",
  hipertrofia: "Hipertrofia",
  resistencia: "Resistencia",
  perdida_grasa: "Pérdida de grasa",
};

function boardForGoal(goal: Goal | null): BoardKey {
  if (goal === "fuerza") return "1rm";
  if (goal === "hipertrofia") return "series";
  if (goal === "resistencia") return "reps";
  return "constancia";
}

const PERIOD_WORD: Record<Period, string> = {
  week: "esta semana",
  month: "este mes",
  all: "todavía",
};

function plural(n: number, one: string, many: string): string {
  return `${fmtNum(n, 0)} ${n === 1 ? one : many}`;
}

/** Valor mostrado según la métrica (también sirve para diferencias de valor). */
function formatMetric(metric: Metric, v: number): string {
  if (metric === "frequency") return plural(v, "día", "días");
  if (metric === "hard_sets") return plural(v, "serie", "series");
  if (metric === "reps") return plural(v, "rep", "reps");
  if (metric === "strength_bw" || metric === "strength_rel")
    return `${fmtNum(v, 2)}×`;
  return formatWeight(v);
}

/**
 * Los filtros viven en la URL (?board=&period=&ex=&sexo=&obj=&bw=) para que
 * sobrevivan a un reload o a volver desde el perfil de un amigo. useSearchParams
 * exige un Suspense (Next lo renderiza en cliente hasta esa frontera).
 */
export default function ScoreboardPage() {
  return (
    <Suspense fallback={<ScoreboardFallback />}>
      <Scoreboard />
    </Suspense>
  );
}

function ScoreboardFallback() {
  return (
    <div>
      <PageHeader title="Ranking" subtitle="Competí con tus amigos" />
      <RowsSkeleton />
    </div>
  );
}

function RowsSkeleton() {
  return (
    <div className="flex flex-col gap-2">
      {Array.from({ length: 5 }, (_, i) => (
        <Skeleton key={i} className="h-[60px] rounded-lg" />
      ))}
    </div>
  );
}

function Scoreboard() {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();

  const [picker, setPicker] = useState(false);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [friendsOpen, setFriendsOpen] = useState(false);

  const { data: meId } = useCurrentUserId();
  const { data: myGoal } = useGoal();
  const friendsQuery = useFriends();
  const friends = friendsQuery.data;
  const exMap = useExerciseMap();

  // Estado desde la URL, validado: un valor inválido cae al default.
  const boardParam = params.get("board") as BoardKey | null;
  const board = boardParam && BOARD_KEYS.includes(boardParam) ? boardParam : null;
  const periodParam = params.get("period");
  const period: Period =
    periodParam === "month" || periodParam === "all" ? periodParam : "week";
  const sexParam = params.get("sexo");
  const sex: Sex | "" =
    sexParam === "male" || sexParam === "female" ? sexParam : "";
  const sameGoal = params.get("obj") === "1";
  const bwMode = params.get("bw") === "1";
  const exerciseId = params.get("ex");
  const exercise = exerciseId ? (exMap.get(exerciseId) ?? null) : null;

  function setParams(patch: Record<string, string | null>) {
    const next = new URLSearchParams(params.toString());
    for (const [k, v] of Object.entries(patch)) {
      if (v == null || v === "") next.delete(k);
      else next.set(k, v);
    }
    const qs = next.toString();
    router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
  }

  const activeBoard = board ?? boardForGoal(myGoal ?? null);
  const needsExercise = activeBoard === "1rm";
  const useBw = needsExercise && bwMode;
  const metric: Metric =
    activeBoard === "constancia"
      ? "frequency"
      : activeBoard === "series"
        ? "hard_sets"
        : activeBoard === "reps"
          ? "reps"
          : activeBoard === "fuerza_rel"
            ? "strength_rel"
            : useBw
              ? "strength_bw"
              : "strength";

  const query = useScoreboard(metric, period, exerciseId ?? undefined, sex || null);

  // Objetivo por usuario (para el subtítulo de cada fila + filtro "mi objetivo").
  const goalOf = new Map<string, Goal | null>();
  (friends ?? []).forEach((f) => goalOf.set(f.id, f.goal));
  if (meId) goalOf.set(meId, myGoal ?? null);

  const caption = BOARDS.find((b) => b.key === activeBoard)?.caption ?? "";

  // Filtro "solo mi objetivo": recorta la lista y recalcula puestos y movimiento
  // sobre lo que queda.
  const rows: ScoreboardRowWithMove[] =
    sameGoal && myGoal
      ? withRanksAndMoves(
          (query.data ?? []).filter((r) => goalOf.get(r.user_id) === myGoal),
        )
      : (query.data ?? []);

  // Filtros activos (para el badge del botón y los chips descartables).
  const activeFilters: { key: string; label: string; clear: () => void }[] = [];
  if (sex)
    activeFilters.push({
      key: "sexo",
      label: sex === "male" ? "Varones" : "Mujeres",
      clear: () => setParams({ sexo: null }),
    });
  if (sameGoal && myGoal)
    activeFilters.push({
      key: "obj",
      label: `Mi objetivo: ${GOAL_LABEL[myGoal]}`,
      clear: () => setParams({ obj: null }),
    });
  if (useBw)
    activeFilters.push({
      key: "bw",
      label: "÷ peso corporal",
      clear: () => setParams({ bw: null }),
    });

  const noFriends = friendsQuery.isSuccess && friendsQuery.data.length === 0;
  const listReady = !needsExercise || !!exerciseId;

  return (
    <div>
      <PageHeader
        title="Ranking"
        subtitle="Competí con tus amigos"
        action={
          <Button
            variant="secondary"
            size="sm"
            onClick={() => setFriendsOpen(true)}
            aria-haspopup="dialog"
          >
            <Users className="size-4" />
            {friends ? `Amigos (${friends.length})` : "Amigos"}
          </Button>
        }
      />

      {noFriends && (
        <div className="card p-4 mb-3 flex flex-col gap-3">
          <div className="flex items-center gap-3">
            <UserPlus className="size-5 text-primary shrink-0" />
            <p className="font-semibold">Invitá a tus amigos para competir</p>
          </div>
          <InviteCard />
        </div>
      )}

      {listReady && rows.length > 0 && (
        <MyPlace rows={rows} meId={meId ?? null} metric={metric} period={period} />
      )}

      {/* Tablero y período: lo único siempre visible. */}
      <div className="mb-2">
        <Tabs
          scroll
          ariaLabel="Tablero"
          value={activeBoard}
          onChange={(v) => setParams({ board: v })}
          options={BOARDS.map((b) => ({
            value: b.key,
            label:
              boardForGoal(myGoal ?? null) === b.key ? `★ ${b.label}` : b.label,
          }))}
        />
      </div>
      <div className="flex items-center gap-2 mb-2">
        <div className="flex-1 min-w-0">
          <Tabs
            ariaLabel="Período"
            value={period}
            onChange={(v) => setParams({ period: v === "week" ? null : v })}
            options={PERIODS.map((p) => ({ value: p.key, label: p.label }))}
          />
        </div>
        <Button
          variant="secondary"
          size="sm"
          className="shrink-0"
          aria-expanded={filtersOpen}
          aria-haspopup="dialog"
          onClick={() => setFiltersOpen(true)}
        >
          <SlidersHorizontal className="size-4" />
          {activeFilters.length > 0
            ? `Filtros · ${activeFilters.length}`
            : "Filtros"}
        </Button>
      </div>

      {activeFilters.length > 0 && (
        <ul className="flex flex-wrap gap-2 mb-2" aria-label="Filtros activos">
          {activeFilters.map((f) => (
            <li key={f.key}>
              <button
                type="button"
                onClick={f.clear}
                aria-label={`Quitar filtro: ${f.label}`}
                className="relative inline-flex items-center gap-1 h-8 rounded-full bg-primary/10 px-3 text-xs font-medium text-primary ring-1 ring-primary/40 after:absolute after:-inset-y-1.5 after:inset-x-0 after:content-[''] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
              >
                {f.label}
                <X className="size-3.5" />
              </button>
            </li>
          ))}
        </ul>
      )}

      {needsExercise && (
        <Button
          variant="secondary"
          className="w-full justify-between mb-3"
          onClick={() => setPicker(true)}
        >
          <span className="truncate">
            {exercise ? exercise.name : "Elegí un ejercicio"}
          </span>
          <ChevronDown className="size-4 shrink-0" />
        </Button>
      )}

      <p className="text-xs text-muted mb-1 px-1">{caption}</p>
      {period !== "all" && (
        <p className="text-xs text-muted mb-4 px-1">
          ▲▼ = puestos vs {period === "week" ? "la semana pasada" : "el mes pasado"}
        </p>
      )}
      {period === "all" && <div className="mb-3" />}

      {!listReady ? (
        <EmptyState
          icon={<Trophy className="size-8" />}
          title="Elegí un ejercicio"
          description="Para comparar la fuerza entre amigos."
        />
      ) : (
        <div
          className={clsx(
            "transition-opacity",
            query.isFetching && !query.isPending && "opacity-60",
          )}
          aria-busy={query.isFetching}
        >
          <QueryState
            query={query}
            loading={<RowsSkeleton />}
            errorTitle="No se pudo cargar el ranking"
            errorDescription="Revisá tu conexión."
            isEmpty={() => rows.length === 0}
            empty={
              <EmptyState
                icon={<Trophy className="size-8" />}
                title="Sin datos todavía"
                description={
                  sameGoal
                    ? "Ningún amigo con tu mismo objetivo apareció acá."
                    : "Sumá amigos y entrená para aparecer en el ranking."
                }
                action={noFriends ? <InviteCard /> : undefined}
              />
            }
          >
            {() => (
              <ul className="flex flex-col gap-2">
                {rows.map((row) => (
                  <ScoreRow
                    key={row.user_id}
                    row={row}
                    isMe={row.user_id === meId}
                    goal={goalOf.get(row.user_id) ?? null}
                    metric={metric}
                    period={period}
                  />
                ))}
              </ul>
            )}
          </QueryState>
        </div>
      )}

      <ExercisePickerModal
        open={picker}
        onClose={() => setPicker(false)}
        title="Elegí un ejercicio"
        onSelect={(ex) => setParams({ ex: ex.id })}
      />

      <Modal
        open={filtersOpen}
        onClose={() => setFiltersOpen(false)}
        title="Filtros"
        footer={
          <div className="flex gap-3">
            <Button
              variant="ghost"
              className="flex-1"
              disabled={activeFilters.length === 0}
              onClick={() => setParams({ sexo: null, obj: null, bw: null })}
            >
              Limpiar
            </Button>
            <Button className="flex-1" onClick={() => setFiltersOpen(false)}>
              Listo
            </Button>
          </div>
        }
      >
        <div className="flex flex-col gap-4">
          <div>
            <p className="text-sm text-muted mb-1.5">Sexo</p>
            <Tabs
              ariaLabel="Sexo"
              value={sex}
              onChange={(v) => setParams({ sexo: v })}
              options={SEXES.map((s) => ({ value: s.key, label: s.label }))}
            />
          </div>
          {myGoal && (
            <Switch
              checked={sameGoal}
              onChange={(v) => setParams({ obj: v ? "1" : null })}
              label={`Solo mi objetivo (${GOAL_LABEL[myGoal]})`}
            />
          )}
          {needsExercise && (
            <div>
              <p className="text-sm text-muted mb-1.5">Unidad del 1RM</p>
              <Tabs
                ariaLabel="Unidad del 1RM"
                value={bwMode ? "bw" : "abs"}
                onChange={(v) => setParams({ bw: v === "bw" ? "1" : null })}
                options={[
                  { value: "abs", label: "kg" },
                  { value: "bw", label: "÷ peso" },
                ]}
              />
            </div>
          )}
        </div>
      </Modal>

      <Modal open={friendsOpen} onClose={() => setFriendsOpen(false)} title="Amigos">
        <FriendsPanel />
      </Modal>
    </div>
  );
}

/** "Tu puesto": 3º de 8 · 12 series · a 2 series de Meli. */
function MyPlace({
  rows,
  meId,
  metric,
  period,
}: {
  rows: ScoreboardRowWithMove[];
  meId: string | null;
  metric: Metric;
  period: Period;
}) {
  const me = rows.find((r) => r.user_id === meId) ?? null;
  const myValue = me ? Number(me.value) : 0;

  if (!me || myValue <= 0) {
    return (
      <div className="card p-3 mb-3">
        <p className="text-sm text-muted">
          {period === "all"
            ? "Todavía no sumaste nada. Entrená para entrar al ranking"
            : `Todavía no sumaste ${PERIOD_WORD[period]}. Entrená para entrar al ranking`}
        </p>
      </div>
    );
  }

  const tied = rows.some((r) => r.user_id !== me.user_id && r.rank === me.rank);
  // El siguiente a alcanzar: el de valor más bajo entre los que van adelante.
  const ahead = rows
    .filter((r) => Number(r.value) > myValue)
    .sort((a, b) => Number(a.value) - Number(b.value))[0];

  return (
    <div className="card p-3 mb-3">
      <p className="text-xs text-muted">Tu puesto</p>
      <div className="flex items-center gap-2 flex-wrap">
        <span className="font-bold text-lg">
          {me.rank}º de {rows.length}
          {tied ? " (empate)" : ""}
        </span>
        {me.move != null && <MoveChip move={me.move} />}
      </div>
      <p className="text-sm text-muted">
        {formatMetric(metric, myValue)}
        {ahead
          ? ` · a ${formatMetric(metric, Number(ahead.value) - myValue)} de ${
              ahead.display_name ?? ahead.username
            }`
          : " · Vas primero"}
      </p>
    </div>
  );
}

function ScoreRow({
  row,
  isMe,
  goal,
  metric,
  period,
}: {
  row: ScoreboardRowWithMove;
  isMe: boolean;
  goal: Goal | null;
  metric: Metric;
  period: Period;
}) {
  const name = isMe ? "Vos" : (row.display_name ?? row.username);
  const medal = row.rank <= 3 && Number(row.value) > 0;
  return (
    <li>
      <Link
        // Tu propia fila lleva a tus números (Registro), no al formulario de perfil.
        href={isMe ? "/registro" : `/amigos/${row.user_id}?period=${period}`}
        className={clsx(
          "card flex items-center gap-2.5 p-3 min-h-[60px] hover:ring-1 hover:ring-primary transition",
          isMe && "ring-1 ring-primary/40 bg-primary/10",
        )}
      >
        <div className="w-6 text-center shrink-0">
          {medal ? (
            <Medal
              aria-label={`Puesto ${row.rank}`}
              className={clsx(
                "size-5 mx-auto",
                row.rank === 1
                  ? "text-accent"
                  : row.rank === 2
                    ? "text-medal-silver"
                    : "text-medal-bronze",
              )}
            />
          ) : (
            <span className="text-muted text-sm">{row.rank}</span>
          )}
        </div>
        {/* Slot del delta siempre reservado: así los valores no se corren. */}
        <div className="w-9 shrink-0 flex justify-center">
          {row.move != null && <MoveChip move={row.move} />}
        </div>
        <div
          className={clsx(
            "size-8 rounded-full grid place-items-center text-sm font-semibold uppercase shrink-0",
            isMe ? "bg-primary/20 text-primary" : "bg-surface-2 text-muted",
          )}
          aria-hidden
        >
          {(row.display_name ?? row.username ?? "?").slice(0, 1)}
        </div>
        <div className="min-w-0 flex-1">
          <p className={clsx("font-medium truncate", isMe && "text-primary")}>
            {name}
          </p>
          {goal && (
            <p className="text-xs text-muted truncate">{GOAL_LABEL[goal]}</p>
          )}
        </div>
        <span
          className={clsx(
            "font-semibold tabular-nums shrink-0",
            isMe && "text-primary",
          )}
        >
          {formatMetric(metric, Number(row.value))}
        </span>
        <ChevronRight className="size-4 text-muted shrink-0" />
      </Link>
    </li>
  );
}

/** Movimiento de puesto vs el período anterior: ▲ subió, ▼ bajó, — se mantuvo. */
function MoveChip({ move }: { move: number }) {
  if (move === 0)
    return (
      <span role="img" aria-label="Sin cambios" className="text-muted text-xs">
        <span aria-hidden>—</span>
      </span>
    );
  const up = move > 0;
  const n = Math.abs(move);
  const Arrow = up ? ArrowUp : ArrowDown;
  return (
    <span
      role="img"
      aria-label={
        up
          ? `Subió ${n} ${n === 1 ? "puesto" : "puestos"}`
          : `Bajó ${n} ${n === 1 ? "puesto" : "puestos"}`
      }
      className={clsx(
        "inline-flex items-center gap-0.5 text-xs font-semibold",
        up ? "text-success" : "text-danger",
      )}
    >
      <Arrow className="size-3" strokeWidth={3} aria-hidden />
      <span aria-hidden>{n}</span>
    </span>
  );
}
