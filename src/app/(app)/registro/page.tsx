"use client";

import { useCallback, useMemo, useState } from "react";
import Link from "next/link";
import {
  LineChart,
  ChevronRight,
  ChevronDown,
  Download,
  Trophy,
  Flame,
  Trash2,
  UserCog,
} from "lucide-react";
import {
  PageHeader,
  Spinner,
  EmptyState,
  Stat,
  Button,
  Modal,
  SectionCard,
  Tabs,
} from "@/components/ui";
import { VolumeChart, type ChartPoint } from "@/components/VolumeChart";
import { MuscleDonut, type MusclePoint } from "@/components/MuscleDonut";
import { MuscleSetsBar, type MuscleSetRow } from "@/components/MuscleSetsBar";
import { PatternBalance, type BalanceData } from "@/components/PatternBalance";
import { ConsistencyHeatmap, type HeatCell } from "@/components/ConsistencyHeatmap";
import { useHistory, type HistorySession } from "@/hooks/useHistory";
import { useExerciseMap } from "@/hooks/useExercises";
import { useAchievements } from "@/hooks/useAchievements";
import { useDeleteSession } from "@/hooks/useWorkout";
import { useToday } from "@/hooks/useToday";
import {
  useWeeklyPlan,
  useSetWeeklyPlan,
  usePlannedSince,
  useWeeklyPlanOverrides,
  useSetWeeklyPlanOverride,
} from "@/hooks/useWeeklyPlan";
import {
  totalVolume,
  estimate1RM,
  weekStart,
  effectiveDrops,
  weeklyStreak,
  avgDuration,
  rollingCompliance,
  sessionDate,
  firstSessionDate,
  dateKey,
  localMidnight,
  isCountableSet,
  isHardSet,
  muscleContributions,
  landmarkFor,
  weeklyMetricStats,
  type PlanResolver,
} from "@/lib/metrics";
import { buildSessionsRows } from "@/lib/export-csv";
import { downloadWorkbook, type SheetCell } from "@/lib/export-xlsx";
import { formatDate, formatDateTime, formatDuration, formatVolume } from "@/lib/format";
import { muscleEs } from "@/lib/i18n-exercise";
import { PaperLink, Ref } from "@/components/PaperLink";
import { useGoal } from "@/hooks/useGoal";
import { GoalMetrics, SparklineGridCard } from "@/components/GoalMetrics";
import { e1rmSeriesByExercise } from "@/lib/metrics-goal";
import { clsx } from "@/lib/clsx";
import type { Achievement, Exercise } from "@/lib/types";

const WEEKDAYS = ["D", "L", "M", "M", "J", "V", "S"];
const HISTORY_PREVIEW = 8;

function achievementText(
  a: Achievement,
  nameOf: (exerciseId: string) => string | undefined,
): string {
  const p = a.payload;
  if (a.kind === "e1rm_pr") {
    const name = nameOf(String(p.exercise_id)) ?? "un ejercicio";
    return `Récord de fuerza en ${name}: ${Math.round(Number(p.orm))} kg (1RM est.)`;
  }
  if (a.kind === "streak_milestone") {
    return `¡Racha de ${p.days} días consecutivos!`;
  }
  if (a.kind === "volume_pr_week") {
    return `Récord de volumen semanal: ${formatVolume(Number(p.volume))}`;
  }
  return "Logro";
}

interface PlanDay {
  day: number;
  weekday: number;
  wkMs: number;
  planned: boolean;
  completed: boolean;
  isPast: boolean;
  /** El día está dentro de la vigencia del plan (se juzga como cumplido/fallado). */
  judged: boolean;
  isEditableWeek: boolean;
  isCurrentWeek: boolean;
}

function sessionVolume(s: HistorySession): number {
  return s.workout_exercises.reduce(
    (acc, we) => acc + totalVolume(we.workout_sets.filter(isCountableSet)),
    0,
  );
}
function sessionSets(s: HistorySession): number {
  return s.workout_exercises.reduce(
    (acc, we) => acc + we.workout_sets.filter(isCountableSet).length,
    0,
  );
}

/**
 * Series efectivas por músculo expresadas como series/semana, para compararlas
 * contra las marcas MEV/MAV/MRV (que son semanales: Schoenfeld / RP).
 * - windowDays=7: conteo directo de la última semana (sin dilución) → es la
 *   medida correcta contra marcas semanales, y el default.
 * - windowDays=30: promedio semanal sobre las semanas con datos (mín. 1), que
 *   suaviza pero puede subestimar cuando la frecuencia varía.
 */
function computeHardSets(
  sessions: HistorySession[],
  exMap: Map<string, Exercise>,
  windowDays: number,
  first: Date | null,
  now: Date,
): MuscleSetRow[] {
  const cutoff = new Date(now);
  cutoff.setDate(cutoff.getDate() - windowDays);
  const byMuscle = new Map<string, number>();
  for (const s of sessions) {
    if (new Date(sessionDate(s)) < cutoff) continue;
    for (const we of s.workout_exercises) {
      const ex = exMap.get(we.exercise_id);
      if (!ex) continue;
      const contribs = muscleContributions(ex);
      for (const set of we.workout_sets) {
        if (!isHardSet(set)) continue;
        for (const c of contribs) {
          byMuscle.set(c.muscle, (byMuscle.get(c.muscle) ?? 0) + c.weight);
        }
      }
    }
  }
  const windowStart = Math.max(
    cutoff.getTime(),
    first?.getTime() ?? cutoff.getTime(),
  );
  const weeks = Math.max(1, (now.getTime() - windowStart) / (7 * 86400000));
  return [...byMuscle.entries()]
    .map(([muscle, sets]) => ({
      muscle,
      sets: sets / weeks,
      ...landmarkFor(muscle),
    }))
    .sort((a, b) => b.sets - a.sets)
    .slice(0, 8);
}

export default function RegistroPage() {
  const { data, isLoading } = useHistory();
  const exMap = useExerciseMap();
  const { data: plan } = useWeeklyPlan();
  const setPlan = useSetWeeklyPlan();
  const { data: plannedSince } = usePlannedSince();
  const { data: achievements } = useAchievements();
  const { data: goal } = useGoal();
  const deleteSession = useDeleteSession();
  const [pendingDelete, setPendingDelete] = useState<string | null>(null);
  const plannedWeekdays = useMemo(() => plan ?? [], [plan]);
  const { data: overrides } = useWeeklyPlanOverrides();
  const setOverride = useSetWeeklyPlanOverride();
  const todayKey = useToday();

  // Plan efectivo por semana: la excepción de esa semana si existe, si no la
  // plantilla global. Ver "plantilla + excepciones" en useWeeklyPlan.ts.
  const overrideMap = useMemo(() => {
    const m = new Map<number, number[]>();
    for (const o of overrides ?? []) {
      m.set(weekStart(localMidnight(o.week_start)).getTime(), o.weekdays);
    }
    return m;
  }, [overrides]);
  const resolvePlanned: PlanResolver = useCallback(
    (wkMs: number) => overrideMap.get(wkMs) ?? plannedWeekdays,
    [overrideMap, plannedWeekdays],
  );

  // Lunes de la semana en curso — recalculado al cambiar de día para que la
  // fila corta de "Plan semanal" (que representa la semana actual) no quede
  // pegada a la semana en la que se montó la app.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const thisWeekMs = useMemo(() => weekStart(new Date()).getTime(), [todayKey]);
  const currentWeekPlanned = useMemo(
    () => resolvePlanned(thisWeekMs),
    [resolvePlanned, thisWeekMs],
  );

  const metrics = useMemo(() => {
    const sessions = data ?? [];
    const totalVol = sessions.reduce((a, s) => a + sessionVolume(s), 0);

    const now = new Date();

    // Volumen semana a semana (últimas 10) — vista por defecto del gráfico.
    const weekVolMap = new Map<number, number>();
    for (const s of sessions) {
      const wk = weekStart(new Date(sessionDate(s))).getTime();
      weekVolMap.set(wk, (weekVolMap.get(wk) ?? 0) + sessionVolume(s));
    }
    const weekChart: ChartPoint[] = [];
    for (let i = 9; i >= 0; i--) {
      const wk = weekStart(new Date(now.getTime() - i * 7 * 86400000));
      weekChart.push({
        label: wk.toLocaleDateString("es-AR", { day: "2-digit", month: "2-digit" }),
        value: Math.round(weekVolMap.get(wk.getTime()) ?? 0),
      });
    }

    // Volumen mes a mes (vista "anual"): desde el mes de la primera sesión (tope 12).
    const monthVolMap = new Map<string, number>();
    for (const s of sessions) {
      const d = new Date(sessionDate(s));
      const k = `${d.getFullYear()}-${d.getMonth()}`;
      monthVolMap.set(k, (monthVolMap.get(k) ?? 0) + sessionVolume(s));
    }
    const first = firstSessionDate(sessions);
    const monthsBack = first
      ? Math.min(
          11,
          (now.getFullYear() - first.getFullYear()) * 12 +
            (now.getMonth() - first.getMonth()),
        )
      : 0;
    const monthChart: ChartPoint[] = [];
    for (let i = monthsBack; i >= 0; i--) {
      const m = new Date(now.getFullYear(), now.getMonth() - i, 1);
      monthChart.push({
        label: m.toLocaleDateString("es-AR", { month: "short" }),
        value: Math.round(monthVolMap.get(`${m.getFullYear()}-${m.getMonth()}`) ?? 0),
      });
    }

    // Frecuencia esta semana.
    const thisWeek = weekStart(now).getTime();
    const freq = sessions.filter(
      (s) => weekStart(new Date(sessionDate(s))).getTime() === thisWeek,
    ).length;

    // Sets por músculo de los últimos 30 días (para el donut y el músculo estrella).
    const cutoff = new Date(now);
    cutoff.setDate(cutoff.getDate() - 30);
    const muscleSets30 = new Map<string, number>();
    for (const s of sessions) {
      if (new Date(sessionDate(s)) < cutoff) continue;
      for (const we of s.workout_exercises) {
        const ex = exMap.get(we.exercise_id);
        const m = ex?.primary_muscles[0];
        if (!m) continue;
        const done = we.workout_sets.filter(isCountableSet).length;
        muscleSets30.set(m, (muscleSets30.get(m) ?? 0) + done);
      }
    }
    const muscleDonut: MusclePoint[] = [...muscleSets30.entries()].map(
      ([m, v]) => ({ label: muscleEs(m), value: v }),
    );

    // Métricas mes a mes (últimos 6 meses con datos).
    const monthMap = new Map<string, { workouts: number; volume: number }>();
    for (const s of sessions) {
      const d = new Date(sessionDate(s));
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
      const cur = monthMap.get(key) ?? { workouts: 0, volume: 0 };
      cur.workouts += 1;
      cur.volume += sessionVolume(s);
      monthMap.set(key, cur);
    }
    const byMonth = [...monthMap.entries()]
      .sort((a, b) => (a[0] < b[0] ? 1 : -1))
      .slice(0, 6);

    // Récords por ejercicio (mejor 1RM estimado).
    const prMap = new Map<string, { weight: number; orm: number; date: string }>();
    for (const s of sessions) {
      for (const we of s.workout_exercises) {
        for (const set of we.workout_sets) {
          if (!isCountableSet(set)) continue;
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

    // Series efectivas (hard sets) por músculo como series/semana, para comparar
    // contra las marcas MEV/MAV/MRV (que son semanales). Se calculan dos ventanas:
    // 7 días (conteo directo de la última semana, el default correcto) y 30 días
    // (promedio semanal, más suave). Ver computeHardSets.
    const hardSets7 = computeHardSets(sessions, exMap, 7, first ?? null, now);
    const hardSets30 = computeHardSets(sessions, exMap, 30, first ?? null, now);

    // Balance de patrones (últimos 30 días): push/pull de force, comp/aisl de mechanic.
    const cutoff30 = new Date(now);
    cutoff30.setDate(cutoff30.getDate() - 30);
    const balance: BalanceData = { push: 0, pull: 0, compound: 0, isolation: 0 };
    for (const s of sessions) {
      if (new Date(sessionDate(s)) < cutoff30) continue;
      for (const we of s.workout_exercises) {
        const ex = exMap.get(we.exercise_id);
        if (!ex) continue;
        const vol = totalVolume(we.workout_sets.filter(isCountableSet));
        if (ex.force === "push") balance.push += vol;
        else if (ex.force === "pull") balance.pull += vol;
        if (ex.mechanic === "compound") balance.compound += vol;
        else if (ex.mechanic === "isolation") balance.isolation += vol;
      }
    }

    // Heatmap de constancia: 12 semanas × 7 días, volumen por día.
    const dayVol = new Map<string, number>();
    for (const s of sessions) {
      const k = dateKey(sessionDate(s));
      dayVol.set(k, (dayVol.get(k) ?? 0) + sessionVolume(s));
    }
    const monday = weekStart(now);
    const heatWeeks: HeatCell[][] = [];
    let heatMax = 0;
    for (let w = 11; w >= 0; w--) {
      const col: HeatCell[] = [];
      for (let d = 0; d < 7; d++) {
        const day = new Date(monday);
        day.setDate(day.getDate() - w * 7 + d);
        const k = dateKey(day.toISOString());
        const v = dayVol.get(k) ?? 0;
        heatMax = Math.max(heatMax, v);
        col.push({ key: k, value: v });
      }
      heatWeeks.push(col);
    }

    // Músculo estrella: top de la ventana de 30 días por sets (igual que el donut).
    const favoriteMuscle =
      [...muscleSets30.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? null;

    return {
      totalVol,
      weekChart,
      monthChart,
      freq,
      muscleDonut,
      byMonth,
      prs,
      hardSets7,
      hardSets30,
      balance,
      heatWeeks,
      heatMax,
      count: sessions.length,
      avgDurationSec: avgDuration(sessions),
      favoriteMuscle,
      sparklines: e1rmSeriesByExercise(sessions, exMap, 12).slice(0, 12),
    };
    // todayKey: recomputar al cambiar de día para que el gráfico/ventanas avancen.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data, exMap, todayKey]);

  // Métricas por semana (distingue semana en curso de semanas anteriores).
  const weekMetrics = useMemo(() => {
    const sessions = data ?? [];
    const volStats = weeklyMetricStats(sessions, (ws) =>
      ws.reduce((a, s) => a + sessionVolume(s), 0),
    );
    const hardStats = weeklyMetricStats(sessions, (ws) => {
      let n = 0;
      for (const s of ws)
        for (const we of s.workout_exercises)
          for (const set of we.workout_sets) if (isHardSet(set)) n++;
      return n;
    });
    const workoutStats = weeklyMetricStats(sessions, (ws) =>
      new Set(ws.map((s) => dateKey(sessionDate(s)))).size,
    );
    return { volStats, hardStats, workoutStats };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data, todayKey]);

  // Racha semanal + calendario de cumplimiento (dependen del plan, resuelto
  // por semana: excepción puntual si existe, si no la plantilla global).
  const planStats = useMemo(() => {
    const sessions = data ?? [];
    const now = new Date();
    const planSince = plannedSince ? new Date(plannedSince) : null;
    const streakWeeks = weeklyStreak(sessions, resolvePlanned, planSince);
    const compliance = rollingCompliance(
      sessions,
      resolvePlanned,
      now,
      30,
      planSince,
    );

    const sessionDays = new Set(sessions.map((s) => dateKey(sessionDate(s))));
    const today = dateKey(now.toISOString());
    // Se juzgan (rojo/verde) sólo los días desde que rige el plan; si nunca se
    // fijó, se cae a la primera sesión.
    const first = firstSessionDate(sessions);
    const judgeKey = planSince
      ? dateKey(planSince.toISOString())
      : first
        ? dateKey(first.toISOString())
        : "";
    const thisWeekMs = weekStart(now).getTime();
    const year = now.getFullYear();
    const month = now.getMonth();
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const leadingBlanks = new Date(year, month, 1).getDay();
    const days: PlanDay[] = [];
    for (let d = 1; d <= daysInMonth; d++) {
      const date = new Date(year, month, d);
      const key = dateKey(date.toISOString());
      const wkMs = weekStart(date).getTime();
      const planned = new Set(resolvePlanned(wkMs));
      days.push({
        day: d,
        weekday: date.getDay(),
        wkMs,
        planned: planned.has(date.getDay()),
        completed: sessionDays.has(key),
        isPast: key <= today,
        judged: key >= judgeKey,
        isEditableWeek: wkMs >= thisWeekMs,
        isCurrentWeek: wkMs === thisWeekMs,
      });
    }
    return { streakWeeks, compliance, days, leadingBlanks };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data, resolvePlanned, plannedSince, todayKey]);

  const [planExpanded, setPlanExpanded] = useState(false);
  const [exportOpen, setExportOpen] = useState(false);
  const [monthOpen, setMonthOpen] = useState(false);
  const [chartView, setChartView] = useState<"week" | "month">("week");
  // Tonelaje (carga externa) fuera de portada: en "Más métricas" plegable.
  const [moreOpen, setMoreOpen] = useState(false);
  const [historyOpen, setHistoryOpen] = useState(false);
  // Ventana de series efectivas: 7 días (default, medida directa vs marcas
  // semanales) o 30 días (promedio, más suave).
  const [hardWindow, setHardWindow] = useState<"7d" | "30d">("7d");
  const [showAllHistory, setShowAllHistory] = useState(false);

  // Historial agrupado por mes (orden desc de `data`), acotado a los últimos
  // HISTORY_PREVIEW salvo que se expanda con "Ver todos".
  const historyGroups = useMemo(() => {
    const shown = showAllHistory
      ? data ?? []
      : (data ?? []).slice(0, HISTORY_PREVIEW);
    const groups: { key: string; label: string; items: HistorySession[] }[] = [];
    for (const s of shown) {
      const d = new Date(sessionDate(s));
      const key = `${d.getFullYear()}-${d.getMonth()}`;
      let g = groups.find((x) => x.key === key);
      if (!g) {
        g = {
          key,
          label: d.toLocaleDateString("es-AR", {
            month: "long",
            year: "numeric",
          }),
          items: [],
        };
        groups.push(g);
      }
      g.items.push(s);
    }
    return groups;
  }, [data, showAllHistory]);

  const [pendingToggle, setPendingToggle] = useState<{
    wkMs: number;
    weekday: number;
  } | null>(null);

  async function exportPeriod(from: Date | null, to: Date | null, tag: string) {
    const sessions = (data ?? []).filter((s) => {
      const d = new Date(sessionDate(s));
      if (from && d < from) return false;
      if (to && d > to) return false;
      return true;
    });
    // Hoja 1: series (según el período elegido). Hoja 2: tus métricas actuales.
    const seriesRows = buildSessionsRows(sessions, exMap);
    const metricRows = buildMetricsSheet();
    setExportOpen(false);
    try {
      await downloadWorkbook(`wolf-${tag}.xlsx`, [
        { name: "Series", rows: seriesRows },
        { name: "Métricas", rows: metricRows },
      ]);
    } catch (e) {
      console.error("No se pudo generar el Excel:", e);
    }
  }

  // Hoja de métricas: snapshot del estado actual (no depende del período de la
  // otra hoja). Resume las tarjetas del dashboard más las tablas por músculo.
  function buildMetricsSheet(): SheetCell[][] {
    const w = weekMetrics;
    const hasPlan = plannedWeekdays.length > 0;
    const statusOf = (r: { sets: number; mev: number; mrv: number }) =>
      r.sets < r.mev ? "Bajo MEV" : r.sets > r.mrv ? "Excede MRV" : "Óptimo";
    const rows: SheetCell[][] = [
      ["WOLF — Métricas (estado actual)"],
      [],
      ["Métrica", "Valor", "Detalle"],
      ["Entrenos totales", metrics.count, ""],
      ["Volumen total (kg)", Math.round(metrics.totalVol), ""],
      [
        "Volumen semana actual (kg)",
        Math.round(w.volStats.current),
        w.volStats.lastCompleted != null
          ? `sem. anterior: ${Math.round(w.volStats.lastCompleted)}`
          : "",
      ],
      [
        "Series efectivas semana actual",
        w.hardStats.current,
        w.hardStats.lastCompleted != null
          ? `sem. anterior: ${w.hardStats.lastCompleted}`
          : "",
      ],
      [
        "Promedio entrenos/semana",
        w.workoutStats.completedCount > 0
          ? Number(w.workoutStats.avgCompleted.toFixed(1))
          : "",
        `${w.workoutStats.completedCount} semanas anteriores`,
      ],
      ["Racha (semanas)", hasPlan ? planStats.streakWeeks : "", ""],
      ["Cumplimiento 30d (%)", hasPlan ? planStats.compliance.pct : "", ""],
      ["Duración promedio (min)", Math.round(metrics.avgDurationSec / 60), ""],
      [
        "Músculo estrella",
        metrics.favoriteMuscle ? muscleEs(metrics.favoriteMuscle) : "",
        "",
      ],
      [],
      [
        hardWindow === "7d"
          ? "Series efectivas por músculo (por semana · últ. 7 días)"
          : "Series efectivas por músculo (prom. semanal · últ. 30 días)",
      ],
      ["Músculo", "Series/sem", "MEV", "MAV", "MRV", "Estado"],
      ...(hardWindow === "7d" ? metrics.hardSets7 : metrics.hardSets30).map((r) => [
        muscleEs(r.muscle),
        Number(r.sets.toFixed(1)),
        r.mev,
        r.mav,
        r.mrv,
        statusOf(r),
      ]),
      [],
      ["Sets por músculo (últ. 30 días)"],
      ["Músculo", "Sets"],
      ...metrics.muscleDonut.map((m) => [m.label, m.value]),
      [],
      ["Balance de patrones (volumen · últ. 30 días)"],
      ["Empuje", Math.round(metrics.balance.push)],
      ["Tirón", Math.round(metrics.balance.pull)],
      ["Compuesto", Math.round(metrics.balance.compound)],
      ["Aislamiento", Math.round(metrics.balance.isolation)],
    ];
    return rows;
  }

  function daysAgo(n: number) {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    d.setDate(d.getDate() - n);
    return d;
  }

  function toggleDayForWeek(wkMs: number, weekday: number) {
    const current = resolvePlanned(wkMs);
    const next = current.includes(weekday)
      ? current.filter((d) => d !== weekday)
      : [...current, weekday];
    // La semana actual, mientras no tenga una excepción propia todavía: el
    // toggle edita la plantilla, así el cambio queda como meta permanente
    // (y no hay que repetirlo semana a semana). Si ya existe una excepción
    // para esta semana, o es una semana futura, se ajusta la excepción
    // puntual de esa semana sin tocar la plantilla.
    if (wkMs === thisWeekMs && !overrideMap.has(wkMs)) {
      setPlan.mutate(next);
      return;
    }
    const d = new Date(wkMs);
    const weekStartKey = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
    setOverride.mutate({ weekStart: weekStartKey, weekdays: next });
  }

  function handleDayClick(day: PlanDay) {
    if (!day.isEditableWeek) return;
    if (day.isCurrentWeek) {
      setPendingToggle({ wkMs: day.wkMs, weekday: day.weekday });
      return;
    }
    toggleDayForWeek(day.wkMs, day.weekday);
  }

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
          <div className="flex items-center gap-1">
            <Link href="/perfil" aria-label="Mi perfil">
              <Button size="sm" variant="ghost">
                <UserCog className="size-4" />
              </Button>
            </Link>
            {!!data?.length && (
              <Button
                size="sm"
                variant="ghost"
                onClick={() => setExportOpen(true)}
                aria-label="Exportar Excel"
              >
                <Download className="size-4" />
              </Button>
            )}
          </div>
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
          <div className="grid grid-cols-2 gap-2.5">
            <Stat
              label="Días esta semana"
              value={weekMetrics.workoutStats.current}
              unit="días"
              sub="entrenados"
              delta={weekMetrics.workoutStats.deltaPct}
              secondary={
                weekMetrics.workoutStats.lastCompleted != null
                  ? `sem. anterior: ${weekMetrics.workoutStats.lastCompleted}`
                  : undefined
              }
              info={
                "Días distintos entrenados en la semana en curso. La constancia es el driver base: sin adherencia no hay volumen.\n\n" +
                "El % compara las dos últimas semanas anteriores."
              }
            />
            <Stat
              label="Series efectivas"
              value={weekMetrics.hardStats.current}
              unit="sets"
              sub="hasta ahora"
              delta={weekMetrics.hardStats.deltaPct}
              secondary={
                weekMetrics.hardStats.lastCompleted != null
                  ? `sem. anterior: ${weekMetrics.hardStats.lastCompleted} sets`
                  : undefined
              }
              info={
                <>
                  Series de trabajo (≥5 reps y cerca del fallo) acumuladas en la
                  semana en curso. Es el mejor indicador de estímulo para
                  hipertrofia (<Ref id="1" />, <Ref id="7" />).{"\n\n"}
                  El % compara las dos últimas semanas anteriores.
                </>
              }
            />
          </div>

          <div className="grid grid-cols-3 gap-2.5">
            <button
              onClick={() => setMonthOpen(true)}
              className="card p-3.5 rounded-lg text-left hover:ring-1 hover:ring-primary transition"
            >
              <div className="flex items-center justify-between">
                <p className="text-xs text-muted">Entrenos</p>
                <ChevronRight className="size-3.5 text-muted" />
              </div>
              <p className="text-xl font-bold mt-1.5 tracking-tight">
                {metrics.count}
              </p>
              <p className="text-[10px] text-muted mt-1">ver mes a mes</p>
            </button>
            <Stat
              label="Racha"
              info={
                "Semanas consecutivas en las que cumpliste tu plan (los días que te propusiste entrenar). Se corta si una semana no llegás a la meta."
              }
              value={
                plannedWeekdays.length === 0 ? (
                  "—"
                ) : (
                  <span
                    className={clsx(
                      "inline-flex items-center gap-1",
                      planStats.streakWeeks > 0 && "text-warning",
                    )}
                  >
                    {planStats.streakWeeks} sem
                    {planStats.streakWeeks > 0 && (
                      <Flame className="size-4" fill="currentColor" />
                    )}
                  </span>
                )
              }
            />
            <Stat
              label="Cumplimiento 30d"
              info={
                "Porcentaje de días planificados que efectivamente entrenaste en los últimos 30 días."
              }
              value={
                plannedWeekdays.length === 0
                  ? "—"
                  : `${planStats.compliance.pct}%`
              }
            />
          </div>

          <div className="grid grid-cols-3 gap-2.5">
            <Stat
              label="Promedio semanal"
              value={
                weekMetrics.workoutStats.completedCount > 0
                  ? weekMetrics.workoutStats.avgCompleted.toFixed(1)
                  : "—"
              }
              unit="/sem"
              delta={weekMetrics.workoutStats.deltaPct}
              secondary={`${weekMetrics.workoutStats.completedCount} semanas anteriores`}
              info={
                "Promedio de entrenos por semana sobre las semanas anteriores (ya terminadas): Σ(entrenos por semana) / cantidad de semanas anteriores.\n\n" +
                "El % compara la última semana anterior con la previa."
              }
            />
            <Stat
              label="Duración promedio"
              info="Promedio de duración de tus sesiones finalizadas."
              value={
                metrics.avgDurationSec
                  ? formatDuration(metrics.avgDurationSec)
                  : "—"
              }
            />
            <Stat
              label="Músculo estrella"
              info="El músculo que más entrenaste (por cantidad de series) en los últimos 30 días. Coincide con el más grande del gráfico 'Músculos entrenados'."
              value={
                metrics.favoriteMuscle ? muscleEs(metrics.favoriteMuscle) : "—"
              }
            />
          </div>

          <WeeklyPlanCard
            currentWeekPlanned={currentWeekPlanned}
            saveError={setPlan.isError || setOverride.isError}
            planStats={planStats}
            expanded={planExpanded}
            onToggleExpanded={() => setPlanExpanded((v) => !v)}
            onDayClick={handleDayClick}
            onToggleToday={(weekday) =>
              setPendingToggle({ wkMs: thisWeekMs, weekday })
            }
          />

          {/* Portada específica del objetivo (métricas promovidas). */}
          <GoalMetrics goal={goal ?? null} sessions={data ?? []} exMap={exMap} />

          {!!achievements?.length && (
            <SectionCard
              title="Logros"
              subtitle="Récords e hitos recientes"
              info="Se registran al finalizar una sesión: récords de fuerza (1RM estimado), récord de volumen semanal e hitos de racha (7/30/100 días)."
            >
              <ul className="flex flex-col gap-2.5">
                {achievements.map((a) => (
                  <li key={a.id} className="flex items-center gap-2.5 text-sm">
                    <Trophy className="size-4 text-primary shrink-0" />
                    <span className="flex-1">
                      {achievementText(a, (id) => exMap.get(id)?.name)}
                    </span>
                    <span className="text-xs text-muted shrink-0">
                      {formatDate(a.created_at)}
                    </span>
                  </li>
                ))}
              </ul>
            </SectionCard>
          )}


          {/* Fuerza: MEV/MAV/MRV son umbrales de hipertrofia, no aplican. */}
          {goal !== "fuerza" && (
          <SectionCard
            title="Series efectivas por grupo"
            subtitle={
              hardWindow === "7d"
                ? "Series por semana · últimos 7 días · marcas MEV / MAV / MRV"
                : "Promedio semanal · últimos 30 días · marcas MEV / MAV / MRV"
            }
            action={
              <div className="w-28">
                <Tabs
                  value={hardWindow}
                  onChange={setHardWindow}
                  options={[
                    { value: "7d", label: "7 días" },
                    { value: "30d", label: "30 días" },
                  ]}
                />
              </div>
            }
            info={
              <>
                {hardWindow === "7d"
                  ? "Series de trabajo (≥5 reps y cerca del fallo) por músculo, contadas en los últimos 7 días. Como las marcas son semanales, este es el conteo directo (sin promediar). "
                  : "Series de trabajo (≥5 reps y cerca del fallo) por músculo, promediadas por semana sobre los últimos 30 días. "}
                Cada ejercicio reparte sus series entre sus músculos (primarios
                enteros, secundarios a la mitad).{"\n\n"}
                Las marcas verticales son las series por semana de referencia (
                <PaperLink
                  label="Schoenfeld"
                  url="https://pubmed.ncbi.nlm.nih.gov/27433992/"
                />
                {" / "}
                <PaperLink
                  label="Renaissance Periodization"
                  url="https://rpstrength.com/expert-advice/training-volume-landmarks-muscle-growth"
                />
                ):{"\n"}
                • MEV (Mínimo Volumen Efectivo): el piso para que un músculo
                crezca.{"\n"}
                • MAV (Máximo Volumen Adaptativo): el rango donde más rendís.
                {"\n"}
                • MRV (Máximo Volumen Recuperable): el techo; pasarte acumula
                fatiga sin más ganancia.{"\n\n"}
                Color: bajo MEV = ámbar (te falta), entre MEV y MRV = verde
                (óptimo), sobre MRV = rojo (demasiado).{"\n\n"}
                Ojo: "volumen" acá es el <span className="text-fg">conteo de
                series</span> cerca del fallo, que es lo que impulsa la
                hipertrofia (<PaperLink label="Baz-Valle 2021" url="https://doi.org/10.1519/JSC.0000000000002776" />)
                — no el tonelaje (series×reps×peso), que no moderó la hipertrofia
                (<PaperLink label="Refalo 2023" url="https://www.ncbi.nlm.nih.gov/pmc/articles/PMC9935748/" />).
              </>
            }
          >
            <MuscleSetsBar
              data={hardWindow === "7d" ? metrics.hardSets7 : metrics.hardSets30}
            />
          </SectionCard>
          )}

          <SectionCard
            title="Balance de patrones"
            subtitle="Volumen de los últimos 30 días"
            info="Reparto del volumen de los últimos 30 días entre empuje/tirón (según el tipo de fuerza del ejercicio) y compuesto/aislamiento (según si el ejercicio mueve uno o varios músculos). Un reparto muy inclinado hacia un lado puede señalar un desbalance que el volumen total no deja ver, aunque estés entrenando mucho."
          >
            <PatternBalance data={metrics.balance} />
          </SectionCard>

          <SectionCard
            title="Constancia"
            subtitle="Últimas 12 semanas"
            info="Cada celda es un día; más dorado = más volumen ese día. Las columnas son semanas (izquierda = más antigua) y las filas los días (lunes arriba)."
          >
            <ConsistencyHeatmap weeks={metrics.heatWeeks} max={metrics.heatMax} />
          </SectionCard>

          {/* Más métricas (off-portada): tonelaje, músculos entrenados, récords. */}
          <button
            onClick={() => setMoreOpen((v) => !v)}
            className="card rounded-xl flex items-center justify-between w-full p-4"
            aria-expanded={moreOpen}
          >
            <span className="text-sm font-semibold">Más métricas</span>
            <ChevronDown
              className={clsx(
                "size-4 text-muted transition-transform",
                moreOpen && "rotate-180",
              )}
            />
          </button>
          {moreOpen && (
            <div className="flex flex-col gap-5">
              <SectionCard
                title="Volumen (tonelaje)"
                subtitle="Carga externa · no es tu progreso"
                info="Series × reps × peso. Sirve para comparar la misma rutina en el tiempo, no como indicador de progreso: sube con más trabajo, no con mejor trabajo. Lo que impulsa la hipertrofia es el conteo de series efectivas."
                action={
                  <div className="w-40">
                    <Tabs
                      value={chartView}
                      onChange={setChartView}
                      options={[
                        { value: "week", label: "Semanal" },
                        { value: "month", label: "Anual" },
                      ]}
                    />
                  </div>
                }
              >
                <VolumeChart
                  data={
                    chartView === "week" ? metrics.weekChart : metrics.monthChart
                  }
                />
              </SectionCard>

              {metrics.muscleDonut.length > 0 && (
                <SectionCard
                  title="Músculos entrenados"
                  subtitle="Sets · últimos 30 días"
                  info="Distribución de las series por grupo muscular en los últimos 30 días. Cada ejercicio reparte sus series entre sus músculos (primarios enteros, secundarios a la mitad)."
                >
                  <MuscleDonut data={metrics.muscleDonut} />
                </SectionCard>
              )}

              {metrics.prs.length > 0 && (
                <SectionCard
                  title="Récords (1RM estimado)"
                  info={
                    <>
                      Mejor 1RM estimado por ejercicio, con la fórmula de Epley
                      (peso × (1 + reps/30)). Es un dato de fuerza estable, no un
                      indicador de avance: para ver progreso mirá la tendencia de
                      1RM de tu objetivo. Precisión de las fórmulas: <Ref id="3" />
                      .
                    </>
                  }
                >
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
                </SectionCard>
              )}

              {metrics.sparklines.length > 0 && (
                <SparklineGridCard series={metrics.sparklines} />
              )}
            </div>
          )}

          <div>
            <button
              onClick={() => setHistoryOpen((v) => !v)}
              className="flex items-center justify-between w-full mb-2"
              aria-expanded={historyOpen}
            >
              <p className="text-sm font-medium">Historial</p>
              <span className="flex items-center gap-2 text-xs text-muted">
                {data.length} entrenos
                <ChevronDown
                  className={clsx(
                    "size-4 transition-transform",
                    historyOpen && "rotate-180",
                  )}
                />
              </span>
            </button>
            {historyOpen && (
              <>
            {historyGroups.map((g) => (
              <div key={g.key}>
                <p className="text-[11px] text-muted uppercase tracking-wide mt-3 mb-1.5 capitalize">
                  {g.label} · {g.items.length}
                </p>
                <ul className="flex flex-col gap-1.5">
                  {g.items.map((s) => (
                    <li key={s.id}>
                      <Link
                        href={`/entrenar/${s.id}`}
                        className="card flex items-center gap-3 px-3 py-2.5 hover:ring-1 hover:ring-primary transition"
                      >
                        <div className="min-w-0 flex-1">
                          <p className="font-medium text-sm truncate">{s.name}</p>
                          <p className="text-[11px] text-muted">
                            {formatDate(sessionDate(s))} · {sessionSets(s)} series ·{" "}
                            {formatVolume(sessionVolume(s))}
                            {s.duration_seconds
                              ? ` · ${formatDuration(s.duration_seconds)}`
                              : ""}
                          </p>
                        </div>
                        <button
                          onClick={(e) => {
                            e.preventDefault();
                            e.stopPropagation();
                            setPendingDelete(s.id);
                          }}
                          aria-label="Eliminar entrenamiento"
                          className="size-8 grid place-items-center rounded text-muted hover:text-danger shrink-0"
                        >
                          <Trash2 className="size-4" />
                        </button>
                        <ChevronRight className="size-4 text-muted shrink-0" />
                      </Link>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
            {!showAllHistory && data.length > HISTORY_PREVIEW && (
              <Button
                variant="ghost"
                className="w-full mt-3"
                onClick={() => setShowAllHistory(true)}
              >
                Ver todos ({data.length})
              </Button>
            )}
              </>
            )}
          </div>
        </div>
      )}

      <ExportModal
        open={exportOpen}
        onClose={() => setExportOpen(false)}
        onExport={exportPeriod}
        daysAgo={daysAgo}
      />

      <Modal
        open={pendingDelete !== null}
        onClose={() => setPendingDelete(null)}
        title="Eliminar entrenamiento"
      >
        <p className="text-sm text-muted mb-4">
          Se va a borrar esta sesión del historial, con sus series y su volumen.
          No se puede deshacer.
        </p>
        <div className="flex gap-2 justify-end">
          <Button variant="secondary" onClick={() => setPendingDelete(null)}>
            Cancelar
          </Button>
          <Button
            variant="danger"
            loading={deleteSession.isPending}
            onClick={async () => {
              if (pendingDelete) await deleteSession.mutateAsync(pendingDelete);
              setPendingDelete(null);
            }}
          >
            Eliminar
          </Button>
        </div>
      </Modal>

      <Modal
        open={monthOpen}
        onClose={() => setMonthOpen(false)}
        title="Mes a mes"
      >
        {metrics.byMonth.length === 0 ? (
          <p className="text-sm text-muted">Todavía no hay datos.</p>
        ) : (
          <ul className="flex flex-col gap-2">
            {metrics.byMonth.map(([key, mo]) => {
              const [y, month] = key.split("-").map(Number);
              const label = new Date(y, month - 1, 1).toLocaleDateString(
                "es-AR",
                { month: "long", year: "numeric" },
              );
              return (
                <li
                  key={key}
                  className="flex items-center justify-between text-sm border-b border-border pb-2 last:border-0"
                >
                  <span className="capitalize">{label}</span>
                  <span className="text-muted">
                    {mo.workouts} {mo.workouts === 1 ? "entreno" : "entrenos"} ·{" "}
                    {formatVolume(mo.volume)}
                  </span>
                </li>
              );
            })}
          </ul>
        )}
      </Modal>

      <Modal
        open={pendingToggle !== null}
        onClose={() => setPendingToggle(null)}
        title="Solo te mentís a vos"
      >
        <p className="text-sm text-muted mb-4">
          Estás editando el plan de esta semana, la que ya está en curso.
          Cambiar la meta ahora no borra lo que ya entrenaste (o no
          entrenaste) — solo ajusta cuánto te exigís de acá al domingo.
          ¿Confirmás el cambio?
        </p>
        <div className="flex gap-2 justify-end">
          <Button variant="secondary" onClick={() => setPendingToggle(null)}>
            Cancelar
          </Button>
          <Button
            onClick={() => {
              if (pendingToggle) {
                toggleDayForWeek(pendingToggle.wkMs, pendingToggle.weekday);
              }
              setPendingToggle(null);
            }}
          >
            Confirmar
          </Button>
        </div>
      </Modal>
    </div>
  );
}

function toDate(value: string): Date | null {
  return value ? new Date(`${value}T00:00:00`) : null;
}

function ExportModal({
  open,
  onClose,
  onExport,
  daysAgo,
}: {
  open: boolean;
  onClose: () => void;
  onExport: (from: Date | null, to: Date | null, tag: string) => void;
  daysAgo: (n: number) => Date;
}) {
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");

  const presets: { label: string; run: () => void }[] = [
    { label: "Últimos 7 días", run: () => onExport(daysAgo(7), null, "7d") },
    { label: "Últimos 30 días", run: () => onExport(daysAgo(30), null, "30d") },
    { label: "Últimos 90 días", run: () => onExport(daysAgo(90), null, "90d") },
    { label: "Todo", run: () => onExport(null, null, "todo") },
  ];

  return (
    <Modal open={open} onClose={onClose} title="Exportar Excel">
      <p className="text-sm text-muted mb-3">
        Elegí un período. Se descarga un Excel con dos pestañas: una con tus
        series (una fila por serie, según el período) y otra con tus métricas.
      </p>
      <div className="flex flex-col gap-2">
        {presets.map((p) => (
          <button
            key={p.label}
            onClick={p.run}
            className="flex items-center justify-between rounded-md bg-surface-2 px-3 py-2.5 text-sm hover:text-fg text-left"
          >
            {p.label}
            <Download className="size-4 text-muted" />
          </button>
        ))}
      </div>

      <div className="mt-4 border-t border-border pt-4">
        <p className="text-xs text-muted mb-2">Rango personalizado</p>
        <div className="flex items-center gap-2">
          <input
            type="date"
            value={from}
            onChange={(e) => setFrom(e.target.value)}
            className="h-9 flex-1 rounded bg-surface-2 px-2 text-sm text-fg outline-none ring-1 ring-border focus:ring-primary"
          />
          <span className="text-muted text-xs">a</span>
          <input
            type="date"
            value={to}
            onChange={(e) => setTo(e.target.value)}
            className="h-9 flex-1 rounded bg-surface-2 px-2 text-sm text-fg outline-none ring-1 ring-border focus:ring-primary"
          />
        </div>
        <Button
          className="w-full mt-3"
          disabled={!from && !to}
          onClick={() => {
            const toEnd = toDate(to);
            if (toEnd) toEnd.setHours(23, 59, 59, 999);
            onExport(toDate(from), toEnd, "rango");
          }}
        >
          Exportar rango
        </Button>
      </div>
    </Modal>
  );
}

function WeeklyPlanCard({
  currentWeekPlanned,
  saveError,
  planStats,
  expanded,
  onToggleExpanded,
  onDayClick,
  onToggleToday,
}: {
  currentWeekPlanned: number[];
  saveError: boolean;
  planStats: {
    days: PlanDay[];
    leadingBlanks: number;
  };
  expanded: boolean;
  onToggleExpanded: () => void;
  onDayClick: (day: PlanDay) => void;
  onToggleToday: (weekday: number) => void;
}) {
  return (
    <div className="card p-4">
      <button
        onClick={onToggleExpanded}
        className="flex items-center justify-between w-full mb-1"
        aria-expanded={expanded}
      >
        <p className="text-sm font-medium">Plan semanal</p>
        <ChevronDown
          className={clsx(
            "size-4 text-muted transition-transform",
            expanded && "rotate-180",
          )}
        />
      </button>
      <p className="text-xs text-muted mb-3">
        Elegí los días que planeás entrenar esta semana: {currentWeekPlanned.length || "—"}{" "}
        {currentWeekPlanned.length === 1 ? "día" : "días"}.
      </p>
      <div className="flex gap-1.5 mb-1">
        {WEEKDAYS.map((label, weekday) => {
          const active = currentWeekPlanned.includes(weekday);
          return (
            <button
              key={weekday}
              onClick={() => onToggleToday(weekday)}
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
      {saveError && (
        <p className="text-xs text-danger mt-2">
          No se pudo guardar. Probá de nuevo.
        </p>
      )}

      {expanded && (
        <div className="mt-4">
          <div className="grid grid-cols-7 gap-1.5 text-center text-xs text-muted mb-1.5">
            {WEEKDAYS.map((d, i) => (
              <span key={i}>{d}</span>
            ))}
          </div>
          <div className="grid grid-cols-7 gap-1.5">
            {Array.from({ length: planStats.leadingBlanks }).map((_, i) => (
              <div key={`blank-${i}`} />
            ))}
            {planStats.days.map((pd) => (
              <button
                key={pd.day}
                type="button"
                disabled={!pd.isEditableWeek}
                onClick={() => onDayClick(pd)}
                className={clsx(
                  "aspect-square rounded-md grid place-items-center text-xs font-medium",
                  pd.isEditableWeek && "cursor-pointer",
                  !pd.isEditableWeek && "cursor-default",
                  !pd.planned && !pd.completed && "bg-surface-2 text-muted",
                  // Entrenaste un día que no estaba planeado: se marca igual
                  // (ring en vez de relleno, para distinguir del día cumplido).
                  !pd.planned &&
                    pd.completed &&
                    "ring-1 ring-success/50 text-success",
                  // Antes de la vigencia del plan: neutro (nunca se prometió).
                  pd.planned && !pd.judged && "bg-surface-2 text-muted",
                  pd.planned &&
                    pd.judged &&
                    pd.completed &&
                    "bg-success/20 text-success",
                  pd.planned &&
                    pd.judged &&
                    !pd.completed &&
                    pd.isPast &&
                    "bg-danger/20 text-danger",
                  pd.planned &&
                    pd.judged &&
                    !pd.completed &&
                    !pd.isPast &&
                    "ring-1 ring-primary/40 text-fg",
                )}
              >
                {pd.day}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
