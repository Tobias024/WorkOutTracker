"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { LineChart, ChevronRight, Dumbbell, Zap, Info } from "lucide-react";
import {
  PageHeader,
  Spinner,
  EmptyState,
  Stat,
  Button,
  Modal,
} from "@/components/ui";
import { VolumeChart, type ChartPoint } from "@/components/VolumeChart";
import { useHistory, type HistorySession } from "@/hooks/useHistory";
import { useExerciseMap } from "@/hooks/useExercises";
import { useStartEmptyWorkout } from "@/hooks/useWorkout";
import { useWeeklyPlan, useSetWeeklyPlan } from "@/hooks/useWeeklyPlan";
import {
  totalVolume,
  estimate1RM,
  weekStart,
  effectiveDrops,
  weeklyStreak,
  avgDuration,
  monthlyCompliance,
  dateKey,
} from "@/lib/metrics";
import { formatDate, formatDateTime, formatDuration, formatVolume } from "@/lib/format";
import { muscleEs } from "@/lib/i18n-exercise";
import { clsx } from "@/lib/clsx";

const WEEKDAYS = ["D", "L", "M", "M", "J", "V", "S"];

function sessionVolume(s: HistorySession): number {
  return s.workout_exercises.reduce(
    (acc, we) => acc + totalVolume(we.workout_sets.filter((x) => x.completed)),
    0,
  );
}
function sessionSets(s: HistorySession): number {
  return s.workout_exercises.reduce(
    (acc, we) => acc + we.workout_sets.filter((x) => x.completed).length,
    0,
  );
}

export default function RegistroPage() {
  const { data, isLoading } = useHistory();
  const exMap = useExerciseMap();
  const router = useRouter();
  const startEmpty = useStartEmptyWorkout();
  const { data: plan } = useWeeklyPlan();
  const setPlan = useSetWeeklyPlan();
  const plannedWeekdays = plan ?? [];

  const metrics = useMemo(() => {
    const sessions = data ?? [];
    const totalVol = sessions.reduce((a, s) => a + sessionVolume(s), 0);

    // Volumen por semana (últimas 8).
    const weekMap = new Map<number, number>();
    for (const s of sessions) {
      const wk = weekStart(new Date(s.created_at)).getTime();
      weekMap.set(wk, (weekMap.get(wk) ?? 0) + sessionVolume(s));
    }
    const now = new Date();
    const chart: ChartPoint[] = [];
    for (let i = 7; i >= 0; i--) {
      const wk = weekStart(new Date(now.getTime() - i * 7 * 86400000));
      chart.push({
        label: wk.toLocaleDateString("es-AR", { day: "2-digit", month: "2-digit" }),
        value: Math.round(weekMap.get(wk.getTime()) ?? 0),
      });
    }

    // Frecuencia esta semana.
    const thisWeek = weekStart(now).getTime();
    const freq = sessions.filter(
      (s) => weekStart(new Date(s.created_at)).getTime() === thisWeek,
    ).length;

    // Volumen por músculo (atribuido al primer músculo principal).
    const muscleVol = new Map<string, number>();
    for (const s of sessions) {
      for (const we of s.workout_exercises) {
        const ex = exMap.get(we.exercise_id);
        const m = ex?.primary_muscles[0];
        if (!m) continue;
        const v = totalVolume(we.workout_sets.filter((x) => x.completed));
        muscleVol.set(m, (muscleVol.get(m) ?? 0) + v);
      }
    }
    const byMuscle = [...muscleVol.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 6);
    const maxMuscle = byMuscle[0]?.[1] ?? 1;

    // Récords por ejercicio (mejor 1RM estimado).
    const prMap = new Map<string, { weight: number; orm: number; date: string }>();
    for (const s of sessions) {
      for (const we of s.workout_exercises) {
        for (const set of we.workout_sets) {
          if (!set.completed) continue;
          for (const d of effectiveDrops(set)) {
            if (!d.weight || !d.reps) continue;
            const orm = estimate1RM(d.weight, d.reps);
            const cur = prMap.get(we.exercise_id);
            if (!cur || orm > cur.orm) {
              prMap.set(we.exercise_id, { weight: d.weight, orm, date: s.created_at });
            }
          }
        }
      }
    }
    const prs = [...prMap.entries()]
      .sort((a, b) => b[1].orm - a[1].orm)
      .slice(0, 6);

    return {
      totalVol,
      chart,
      freq,
      byMuscle,
      maxMuscle,
      prs,
      count: sessions.length,
      avgDurationSec: avgDuration(sessions),
      favoriteMuscle: byMuscle[0]?.[0] ?? null,
    };
  }, [data, exMap]);

  // Racha semanal + calendario de cumplimiento (dependen del plan).
  const planStats = useMemo(() => {
    const sessions = data ?? [];
    const now = new Date();
    const streakWeeks = weeklyStreak(sessions, plannedWeekdays.length);
    const compliance = monthlyCompliance(sessions, plannedWeekdays, now);

    const planned = new Set(plannedWeekdays);
    const sessionDays = new Set(sessions.map((s) => dateKey(s.created_at)));
    const todayKey = dateKey(now.toISOString());
    const year = now.getFullYear();
    const month = now.getMonth();
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const leadingBlanks = new Date(year, month, 1).getDay();
    const days = [];
    for (let d = 1; d <= daysInMonth; d++) {
      const date = new Date(year, month, d);
      const key = dateKey(date.toISOString());
      days.push({
        day: d,
        planned: planned.has(date.getDay()),
        completed: sessionDays.has(key),
        isPast: key <= todayKey,
      });
    }
    return { streakWeeks, compliance, days, leadingBlanks };
  }, [data, plannedWeekdays]);

  const [volumeInfo, setVolumeInfo] = useState(false);

  if (isLoading) {
    return (
      <div className="grid place-items-center py-16">
        <Spinner />
      </div>
    );
  }

  return (
    <div>
      <PageHeader
        title="Registro"
        subtitle="Tu progreso y métricas"
        action={
          <Button
            size="sm"
            variant="secondary"
            loading={startEmpty.isPending}
            onClick={async () => {
              const id = await startEmpty.mutateAsync();
              router.push(`/entrenar/${id}`);
            }}
          >
            <Zap className="size-4" /> Libre
          </Button>
        }
      />

      {!data?.length ? (
        <EmptyState
          icon={<LineChart className="size-8" />}
          title="Sin entrenamientos todavía"
          description="Cuando completes una rutina vas a ver tus métricas acá."
        />
      ) : (
        <div className="flex flex-col gap-5">
          <div className="grid grid-cols-3 gap-2.5">
            <Stat label="Entrenos" value={metrics.count} />
            <Stat label="Volumen total" value={formatVolume(metrics.totalVol)} />
            <Stat label="Esta semana" value={metrics.freq} />
          </div>

          <div className="grid grid-cols-3 gap-2.5">
            <Stat
              label="Racha"
              value={
                plannedWeekdays.length === 0
                  ? "—"
                  : `${planStats.streakWeeks} sem`
              }
            />
            <Stat
              label="Duración promedio"
              value={
                metrics.avgDurationSec
                  ? formatDuration(metrics.avgDurationSec)
                  : "—"
              }
            />
            <Stat
              label="Músculo preferido"
              value={
                metrics.favoriteMuscle ? muscleEs(metrics.favoriteMuscle) : "—"
              }
            />
          </div>

          <div className="card p-4">
            <p className="text-sm font-medium mb-1">Plan semanal</p>
            <p className="text-xs text-muted mb-3">
              Elegí los días que planeás entrenar. Tu meta es{" "}
              {plannedWeekdays.length || "—"}{" "}
              {plannedWeekdays.length === 1 ? "día" : "días"} por semana.
            </p>
            <div className="flex gap-1.5 mb-4">
              {WEEKDAYS.map((label, weekday) => {
                const active = plannedWeekdays.includes(weekday);
                return (
                  <button
                    key={weekday}
                    onClick={() => {
                      const next = active
                        ? plannedWeekdays.filter((d) => d !== weekday)
                        : [...plannedWeekdays, weekday];
                      setPlan.mutate(next);
                    }}
                    className={clsx(
                      "size-9 rounded-md text-sm font-medium transition",
                      active
                        ? "bg-primary text-primary-fg"
                        : "bg-surface-2 text-muted hover:text-fg",
                    )}
                  >
                    {label}
                  </button>
                );
              })}
            </div>
            {setPlan.isError && (
              <p className="text-xs text-danger mb-3">
                No se pudo guardar. Probá de nuevo.
              </p>
            )}

            {plannedWeekdays.length > 0 && (
              <>
                <div className="flex items-center justify-between mb-3">
                  <span className="text-sm text-muted">Cumplimiento del mes</span>
                  <span className="text-lg font-bold">
                    {planStats.compliance.pct}%
                  </span>
                </div>
                <div className="grid grid-cols-7 gap-1.5 text-center text-xs text-muted mb-1.5">
                  {WEEKDAYS.map((d, i) => (
                    <span key={i}>{d}</span>
                  ))}
                </div>
                <div className="grid grid-cols-7 gap-1.5">
                  {Array.from({ length: planStats.leadingBlanks }).map((_, i) => (
                    <div key={`blank-${i}`} />
                  ))}
                  {planStats.days.map(({ day, planned, completed, isPast }) => (
                    <div
                      key={day}
                      className={clsx(
                        "aspect-square rounded-md grid place-items-center text-xs font-medium",
                        !planned && "bg-surface-2 text-muted",
                        planned && completed && "bg-success/20 text-success",
                        planned && !completed && isPast && "bg-danger/20 text-danger",
                        planned &&
                          !completed &&
                          !isPast &&
                          "ring-1 ring-primary/40 text-fg",
                      )}
                    >
                      {day}
                    </div>
                  ))}
                </div>
              </>
            )}
          </div>

          <div className="card p-4">
            <div className="flex items-center gap-1.5 mb-2">
              <p className="text-sm font-medium">Volumen semanal</p>
              <button
                onClick={() => setVolumeInfo(true)}
                className="text-muted hover:text-fg"
                aria-label="¿Cómo se calcula el volumen?"
              >
                <Info className="size-3.5" />
              </button>
            </div>
            <VolumeChart data={metrics.chart} />
          </div>

          {metrics.byMuscle.length > 0 && (
            <div className="card p-4">
              <p className="text-sm font-medium mb-3">Volumen por músculo</p>
              <div className="flex flex-col gap-2.5">
                {metrics.byMuscle.map(([m, v]) => (
                  <div key={m}>
                    <div className="flex justify-between text-xs mb-1">
                      <span>{muscleEs(m)}</span>
                      <span className="text-muted">{formatVolume(v)}</span>
                    </div>
                    <div className="h-2 rounded-full bg-surface-2 overflow-hidden">
                      <div
                        className="h-full bg-primary rounded-full"
                        style={{ width: `${(v / metrics.maxMuscle) * 100}%` }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {metrics.prs.length > 0 && (
            <div className="card p-4">
              <p className="text-sm font-medium mb-3">Récords (1RM estimado)</p>
              <ul className="flex flex-col gap-2">
                {metrics.prs.map(([exId, pr]) => (
                  <li
                    key={exId}
                    className="flex items-center justify-between text-sm"
                  >
                    <span className="min-w-0 mr-2">
                      <span className="block truncate">
                        {exMap.get(exId)?.name ?? "—"}
                      </span>
                      <span className="block text-xs text-muted">
                        {formatDateTime(pr.date)}
                      </span>
                    </span>
                    <span className="text-accent font-medium shrink-0">
                      {pr.orm} kg
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          <div>
            <p className="text-sm font-medium mb-2">Historial</p>
            <ul className="flex flex-col gap-2">
              {data.map((s) => (
                <li key={s.id}>
                  <Link
                    href={`/entrenar/${s.id}`}
                    className="card flex items-center gap-3 p-3.5 hover:ring-1 hover:ring-primary transition"
                  >
                    <div className="size-10 rounded-md bg-surface-2 grid place-items-center">
                      <Dumbbell className="size-5 text-muted" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="font-medium truncate">{s.name}</p>
                      <p className="text-xs text-muted">
                        {formatDate(s.created_at)} · {sessionSets(s)} series ·{" "}
                        {formatVolume(sessionVolume(s))}
                        {s.duration_seconds
                          ? ` · ${formatDuration(s.duration_seconds)}`
                          : ""}
                      </p>
                    </div>
                    <ChevronRight className="size-5 text-muted" />
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        </div>
      )}

      <Modal
        open={volumeInfo}
        onClose={() => setVolumeInfo(false)}
        title="¿Cómo se calcula el volumen?"
      >
        <p className="text-sm text-muted">
          Volumen = reps × peso de cada serie completada. Si una serie tiene
          bajadas (drop set), se suman todas las bajadas.
        </p>
      </Modal>
    </div>
  );
}
