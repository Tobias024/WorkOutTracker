// SPDX-License-Identifier: AGPL-3.0-only
"use client";

import {
  Suspense,
  useCallback,
  useMemo,
  useState,
  useSyncExternalStore,
} from "react";
import Link from "next/link";
import dynamic from "next/dynamic";
import { useQueryClient } from "@tanstack/react-query";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import {
  LineChart,
  ChevronRight,
  ChevronDown,
  Download,
  Trophy,
  Flame,
  Trash2,
  Check,
  X,
} from "lucide-react";
import {
  PageHeader,
  Spinner,
  EmptyState,
  ErrorState,
  Skeleton,
  Stat,
  Button,
  buttonClasses,
  IconButton,
  ConfirmDialog,
  Field,
  Modal,
  SectionCard,
  Tabs,
} from "@/components/ui";
import { toast } from "@/lib/toast";
import type { ChartPoint } from "@/components/VolumeChart";
import type { MusclePoint } from "@/components/MuscleDonut";
import { MuscleSetsBar, type MuscleSetRow } from "@/components/MuscleSetsBar";
import { PatternBalance, type BalanceData } from "@/components/PatternBalance";
import { ConsistencyHeatmap, type HeatCell } from "@/components/ConsistencyHeatmap";
import {
  useHistory,
  historyExportQueryOptions,
  type HistorySession,
  type HistorySessionFull,
} from "@/hooks/useHistory";
import { useExerciseMap } from "@/hooks/useExercises";
import { useAchievements } from "@/hooks/useAchievements";
import { useDeleteSession } from "@/hooks/useWorkout";
import { useSleep, useMeasurements } from "@/hooks/useBodyData";
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
import { useAllExerciseNotes } from "@/hooks/useExerciseNotes";
import { goalParams, rirProductiveLabel } from "@/lib/goal-params";
import { downloadWorkbook, type SheetCell } from "@/lib/export-xlsx";
import { fmtNum, formatDate, formatDateTime, formatVolume } from "@/lib/format";
import { muscleEs } from "@/lib/i18n-exercise";
import { Ref } from "@/components/PaperLink";
import { useTrainingProfile } from "@/hooks/useGoal";
import { GoalMetrics, SparklineGridCard, RetentionCard } from "@/components/GoalMetrics";
import { BodyProgress } from "@/components/BodyProgress";
import { e1rmSeriesByExercise, strengthRetentionIndex } from "@/lib/metrics-goal";
import { clsx } from "@/lib/clsx";
import type { Achievement, Exercise, TrainingProfile } from "@/lib/types";

// Semana lunes→domingo (igual que weekStart, la racha y el heatmap). `weekday`
// conserva la convención de getDay() (0=domingo) porque es lo que se guarda en
// el plan: solo cambia el ORDEN en que se muestran.
const WEEKDAYS: { weekday: number; short: string; full: string }[] = [
  { weekday: 1, short: "L", full: "Lunes" },
  { weekday: 2, short: "M", full: "Martes" },
  { weekday: 3, short: "X", full: "Miércoles" },
  { weekday: 4, short: "J", full: "Jueves" },
  { weekday: 5, short: "V", full: "Viernes" },
  { weekday: 6, short: "S", full: "Sábado" },
  { weekday: 0, short: "D", full: "Domingo" },
];
const GOAL_LABEL: Record<TrainingProfile, string> = {
  fuerza: "Fuerza",
  hipertrofia: "Hipertrofia",
  resistencia: "Resistencia",
};

// Estado de UI que sobrevive a ir al detalle de una sesión y volver. Se lee con
// useSyncExternalStore: en el servidor (y en la hidratación) devuelve el valor
// por defecto, así no hay mismatch, y en el cliente toma el de sessionStorage.
const sessionListeners = new Set<() => void>();
const sessionMemory = new Map<string, string>();
function readSession(key: string): string | null {
  try {
    return sessionStorage.getItem(key) ?? sessionMemory.get(key) ?? null;
  } catch {
    return sessionMemory.get(key) ?? null;
  }
}
function subscribeSession(cb: () => void) {
  sessionListeners.add(cb);
  return () => {
    sessionListeners.delete(cb);
  };
}
function useSessionState<T extends string>(
  key: string,
  fallback: T,
): [T, (v: T) => void] {
  const raw = useSyncExternalStore(
    subscribeSession,
    () => readSession(key),
    () => null,
  );
  const set = useCallback(
    (v: T) => {
      sessionMemory.set(key, v);
      try {
        sessionStorage.setItem(key, v);
      } catch {
        /* modo privado / storage bloqueado: queda en memoria */
      }
      sessionListeners.forEach((l) => l());
    },
    [key],
  );
  return [(raw ?? fallback) as T, set];
}
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
 * contra las marcas MEV/MAV/MRV, que son semanales y dependen del objetivo
 * (ver GOAL_LANDMARKS en goal-params.ts).
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
  profile: TrainingProfile | null,
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
        if (!isHardSet(set, profile)) continue;
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
  // Mismo objetivo que decide qué cuenta como serie efectiva decide contra qué
  // se compara: antes el conteo era por objetivo y el MEV era fijo (y de
  // hipertrofia), así que numerador y denominador no eran la misma escala.
  const landmark = landmarkFor(profile);
  return [...byMuscle.entries()]
    .map(([muscle, sets]) => ({
      muscle,
      sets: sets / weeks,
      ...landmark,
    }))
    .sort((a, b) => b.sets - a.sets)
    .slice(0, 8);
}

// useSearchParams requiere un Suspense para no volver dinámica toda la ruta.
export default function RegistroPage() {
  return (
    <Suspense
      fallback={
        <div className="grid place-items-center py-16">
          <Spinner />
        </div>
      }
    >
      <RegistroContent />
    </Suspense>
  );
}

// recharts se carga recién cuando el gráfico se va a mostrar.
const VolumeChart = dynamic(
  () => import("@/components/charts-entry").then((m) => m.VolumeChart),
  { ssr: false, loading: () => <div className="h-[180px] animate-pulse rounded-lg bg-surface-2" /> },
);
const MuscleDonut = dynamic(
  () => import("@/components/charts-entry").then((m) => m.MuscleDonut),
  { ssr: false, loading: () => <div className="h-[132px] animate-pulse rounded-lg bg-surface-2" /> },
);

function RegistroContent() {
  const qc = useQueryClient();
  const history = useHistory();
  const { data, isPending, isError, isFetching, refetch } = history;
  const exMap = useExerciseMap();
  const { data: plan } = useWeeklyPlan();
  const setPlan = useSetWeeklyPlan();
  const { data: plannedSince } = usePlannedSince();
  const { data: achievements, isPending: achievementsPending } = useAchievements();
  const { data: prefs, isPending: prefsPending } = useTrainingProfile();
  const trainingProfile = prefs?.trainingProfile ?? null;
  const deleteSession = useDeleteSession();
  const { data: exerciseNotes } = useAllExerciseNotes();
  const { data: sleepLogs } = useSleep();
  const { data: measurements } = useMeasurements();
  const [pendingDelete, setPendingDelete] = useState<string | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
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
        if (!ex) continue;
        const done = we.workout_sets.filter(isCountableSet).length;
        if (!done) continue;
        // Misma capa de contribución que el resto de las métricas (1 directo /
        // 0,5 indirecto). Antes el donut usaba solo `primary_muscles[0]` y le
        // daba la serie entera a un músculo, así que la app mostraba dos
        // distribuciones musculares distintas en dos pantallas distintas.
        for (const c of muscleContributions(ex))
          muscleSets30.set(c.muscle, (muscleSets30.get(c.muscle) ?? 0) + done * c.weight);
      }
    }
    const muscleDonut: MusclePoint[] = [...muscleSets30.entries()]
      // Los pesos 0,5 dejan medias series; se redondea a 1 decimal para mostrar.
      .map(([m, v]) => ({ label: muscleEs(m), value: Math.round(v * 10) / 10 }))
      .filter((p) => p.value > 0)
      .sort((a, b) => b.value - a.value);

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

    // Heatmap de constancia: 12 semanas × 7 días, SERIES completadas por día.
    // Antes usaba el tonelaje, y una sesión sin tonelaje (solo cardio o solo
    // isométricos) daba 0 → la celda quedaba en blanco y el día se leía como
    // descanso. La constancia es "¿entrenaste?", no "¿cuánto levantaste?".
    const dayVol = new Map<string, number>();
    for (const s of sessions) {
      const k = dateKey(sessionDate(s));
      const done = s.workout_exercises.reduce(
        (acc, we) => acc + we.workout_sets.filter(isCountableSet).length,
        0,
      );
      dayVol.set(k, (dayVol.get(k) ?? 0) + done);
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

    return {
      totalVol,
      weekChart,
      monthChart,
      freq,
      muscleDonut,
      byMonth,
      prs,
      balance,
      heatWeeks,
      heatMax,
      count: sessions.length,
      avgDurationSec: avgDuration(sessions),
      sparklines: e1rmSeriesByExercise(sessions, exMap, 12).slice(0, 12),
      retention: strengthRetentionIndex(sessions, exMap, 16),
    };
    // todayKey no se lee dentro: es solo disparador para recomputar al cambiar de día
    // (el gráfico/ventanas usan new Date()). hardSets vive en su propio memo (trainingProfile).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data, exMap, todayKey]);

  // Series efectivas (hard sets) por músculo como series/semana, para comparar
  // contra las marcas MEV/MAV/MRV (que son semanales). Dos ventanas: 7 días
  // (conteo directo de la última semana, el default correcto) y 30 días
  // (promedio semanal, más suave). Ver computeHardSets. Memo propio porque
  // depende de trainingProfile (umbrales según objetivo).
  const { hardSets7, hardSets30 } = useMemo(() => {
    const sessions = data ?? [];
    const now = new Date();
    const first = firstSessionDate(sessions);
    return {
      hardSets7: computeHardSets(sessions, exMap, 7, first ?? null, now, trainingProfile),
      hardSets30: computeHardSets(sessions, exMap, 30, first ?? null, now, trainingProfile),
    };
    // todayKey: solo disparador para recomputar al cambiar de día (now = new Date()).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data, exMap, todayKey, trainingProfile]);

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
          for (const set of we.workout_sets)
            if (isHardSet(set, trainingProfile)) n++;
      return n;
    });
    const workoutStats = weeklyMetricStats(sessions, (ws) =>
      new Set(ws.map((s) => dateKey(sessionDate(s)))).size,
    );
    return { volStats, hardStats, workoutStats };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data, todayKey, trainingProfile]);

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
    // Semana lunes→domingo: lunes = 0 hueco.
    const leadingBlanks = (new Date(year, month, 1).getDay() + 6) % 7;
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
  // Pestaña de Registro: métricas de entrenamiento vs. avances corporales.
  // Vive en la URL (?vista=cuerpo) para que el back desde una sesión la restaure.
  const regView: "entreno" | "cuerpo" =
    searchParams.get("vista") === "cuerpo" ? "cuerpo" : "entreno";
  function setRegView(v: "entreno" | "cuerpo") {
    router.replace(v === "cuerpo" ? `${pathname}?vista=cuerpo` : pathname, {
      scroll: false,
    });
  }
  const [chartView, setChartView] = useState<"week" | "month">("week");
  // Tonelaje (carga externa) fuera de portada: en "Más métricas" plegable.
  const [moreOpenRaw, setMoreOpenRaw] = useSessionState<"0" | "1">("registro:more", "0");
  const moreOpen = moreOpenRaw === "1";
  const setMoreOpen = (v: boolean) => setMoreOpenRaw(v ? "1" : "0");
  const [historyOpenRaw, setHistoryOpenRaw] = useSessionState<"0" | "1">("registro:history", "0");
  const historyOpen = historyOpenRaw === "1";
  const setHistoryOpen = (v: boolean) => setHistoryOpenRaw(v ? "1" : "0");
  // Ventana de series efectivas: 7 días (default, medida directa vs marcas
  // semanales) o 30 días (promedio, más suave).
  const [hardWindow, setHardWindow] = useSessionState<"7d" | "30d">(
    "registro:window",
    "7d",
  );
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

  /** Devuelve el mensaje de error (para mostrarlo inline en el sheet) o null si
   *  se descargó bien. */
  async function exportPeriod(
    from: Date | null,
    to: Date | null,
    tag: string,
  ): Promise<string | null> {
    let all: HistorySessionFull[];
    try {
      all = await qc.fetchQuery(historyExportQueryOptions);
    } catch {
      return "No se pudo cargar el historial. Probá de nuevo.";
    }
    const sessions = all.filter((s) => {
      const d = new Date(sessionDate(s));
      if (from && d < from) return false;
      if (to && d > to) return false;
      return true;
    });
    if (sessions.length === 0) return "No hay sesiones en este período.";
    const seriesRows = buildSessionsRows(sessions, exMap, exerciseNotes);
    const metricRows = buildMetricsSheet();

    // Hoja "Sesiones": una fila por sesión (tiempos + peso corporal + resumen).
    const sessionRows: SheetCell[][] = [
      [
        "fecha",
        "inicio",
        "fin",
        "duracion_min",
        "peso_corporal_kg",
        "series_efectivas",
        "volumen_kg",
      ],
      ...sessions.map((s): SheetCell[] => {
        const hard = s.workout_exercises
          .flatMap((we) => we.workout_sets)
          .filter((x) => isHardSet(x, trainingProfile)).length;
        return [
          dateKey(sessionDate(s)),
          s.started_at ?? "",
          s.ended_at ?? "",
          s.duration_seconds != null ? Math.round(s.duration_seconds / 60) : "",
          s.body_weight_kg ?? "",
          hard,
          Math.round(sessionVolume(s)),
        ];
      }),
    ];

    const inRange = (iso: string) => {
      const d = new Date(iso);
      if (from && d < from) return false;
      if (to && d > to) return false;
      return true;
    };
    const sleepRows: SheetCell[][] = [
      ["fecha", "horas"],
      ...(sleepLogs ?? [])
        .filter((r) => inRange(r.slept_on))
        .map((r): SheetCell[] => [r.slept_on, r.hours]),
    ];
    const measRows: SheetCell[][] = [
      ["fecha", "brazo_cm", "pecho_cm", "cintura_cm", "muslo_cm", "grasa_pct"],
      ...(measurements ?? [])
        .filter((r) => inRange(r.measured_on))
        .map((r): SheetCell[] => [
          r.measured_on,
          r.arm_cm ?? "",
          r.chest_cm ?? "",
          r.waist_cm ?? "",
          r.thigh_cm ?? "",
          r.bodyfat_pct ?? "",
        ]),
    ];

    // Hoja "Notas": la nota fija por ejercicio. Va aparte y no como columna
    // porque su cardinalidad es por EJERCICIO, no por serie — repetir un texto
    // largo en miles de filas infla el archivo y hace parecer que hay miles de
    // notas distintas. En "Series" queda igual, una sola vez por serie, para
    // que se pueda leer sin cruzar hojas.
    const usedExIds = new Set(
      sessions.flatMap((s) => s.workout_exercises.map((we) => we.exercise_id)),
    );
    const noteRows: SheetCell[][] = [
      ["ejercicio", "nota"],
      ...[...(exerciseNotes ?? new Map<string, string>())]
        .filter(([id]) => usedExIds.has(id))
        .map(([id, note]): SheetCell[] => [exMap.get(id)?.name ?? "", note]),
    ];

    const fileName = `wolf-${tag}.xlsx`;
    try {
      await downloadWorkbook(fileName, [
        { name: "Instrucciones", rows: buildReadmeSheet(sessions) },
        { name: "Series", rows: seriesRows },
        { name: "Sesiones", rows: sessionRows },
        { name: "Sueño", rows: sleepRows },
        { name: "Medidas", rows: measRows },
        { name: "Notas", rows: noteRows },
        { name: "Métricas", rows: metricRows },
      ]);
    } catch (e) {
      console.error("No se pudo generar el Excel:", e);
      return "No se pudo generar el Excel. Probá de nuevo.";
    }
    toast(
      `Descargado ${fileName} (${sessions.length} ${sessions.length === 1 ? "sesión" : "sesiones"})`,
      { tone: "success" },
    );
    return null;
  }

  /**
   * Hoja "Instrucciones": qué significa cada cosa del archivo.
   *
   * El export está pensado para que lo lea una IA, y sin esto se prestaba a
   * conclusiones equivocadas en silencio: un `rir` vacío parece un 0, el número
   * de serie se repite en los drop-sets como si fueran series distintas, y
   * "series efectivas" no significa lo mismo para dos personas con objetivos
   * distintos. Todo eso se explica acá en vez de dejarlo a la inferencia.
   */
  function buildReadmeSheet(sessions: HistorySessionFull[]): SheetCell[][] {
    const gp = goalParams(trainingProfile);
    const objetivo = trainingProfile ?? "hipertrofia (por defecto)";
    return [
      ["WOLF — export de entrenamiento"],
      [`Generado el ${new Date().toLocaleDateString("es-AR")}`],
      [`Sesiones incluidas: ${sessions.length}`],
      [`Objetivo de entrenamiento del usuario: ${objetivo}`],
      [],
      ["Hojas"],
      ["Series", "Una fila por serie registrada. Es la tabla principal."],
      ["Sesiones", "Una fila por entrenamiento: tiempos, peso corporal, resumen."],
      ["Sueño", "Horas dormidas por día, cuando se cargaron."],
      ["Medidas", "Medidas corporales y % de grasa, cuando se cargaron."],
      ["Notas", "Nota fija del usuario sobre un ejercicio (cómo lo hace, molestias, setup)."],
      ["Métricas", "Snapshot del estado ACTUAL. No respeta el período elegido."],
      [],
      ["Cómo leer la hoja Series"],
      [
        "serie",
        "Número de serie dentro del ejercicio. Un drop-set ocupa VARIAS FILAS con el mismo número: cada bajada es una fila. No son series distintas.",
      ],
      [
        "rir",
        "Reps en reserva. VACÍO significa NO CARGADO, no cero. No lo asumas como 0 ni lo promedies como tal.",
      ],
      ["volumen_kg", "reps × peso_kg de esa fila. 0 en series por tiempo o distancia."],
      [
        "duracion_s / distancia_m",
        "Series medidas por tiempo o distancia. Esas filas no tienen reps ni peso y NO suman volumen de fuerza.",
      ],
      [
        "descanso_s",
        "Descanso medido tras esa serie. Sólo se guarda cuando el usuario marcó el arranque de la siguiente, así que faltan muchos. Un vacío no significa que no descansó.",
      ],
      ["completado", "si/no. Las series en 'no' se planearon pero no se hicieron."],
      [
        "plan_reps / plan_peso_kg",
        "Lo que la rutina pedía para esa serie. Vacío = serie agregada a mano. El plan fija sobre todo las REPS; el peso es orientativo y se mueve solo.",
      ],
      ["comentario", "Comentario del usuario en esa serie. Aparece una vez por serie."],
      ["nota_ejercicio", "La nota fija de ese ejercicio, repetida por conveniencia."],
      [
        "bajada",
        "0 = la serie en sí; 1, 2… = cada bajada de un drop-set (mismo número de serie). Para contar series, filtrá bajada = 0; para el volumen, sumá todas las filas.",
      ],
      ["musculo", "Músculo principal ya resuelto, el mismo con el que la app cuenta el volumen."],
      [],
      ["Definiciones que dependen del objetivo"],
      [
        "Serie efectiva",
        `Serie completada, sin calentamiento, con al menos ${gp.hardSetMinReps} reps y RIR ${gp.hardSetMaxRir} o menos. Los umbrales cambian según el objetivo del usuario.`,
      ],
      [
        "Zona de RIR productiva",
        `${rirProductiveLabel(trainingProfile)} para este objetivo.`,
      ],
      [
        "Volumen por músculo",
        "Cada serie suma 1 al músculo principal y 0,5 a cada secundario (series fraccionales).",
      ],
      [],
      ["Qué NO está en este archivo"],
      ["", "Las series de calentamiento están incluidas pero marcadas (is_warmup no se exporta; se reflejan en que no cuentan como efectivas)."],
      ["", "El detalle de las rutinas planificadas: sólo el plan de cada serie que llegó a registrarse."],
    ];
  }

  // Hoja de métricas: snapshot del estado actual (no depende del período de la
  // otra hoja). Resume las tarjetas del dashboard más las tablas por músculo.
  function buildMetricsSheet(): SheetCell[][] {
    const w = weekMetrics;
    const hasPlan = plannedWeekdays.length > 0;
    const statusOf = (r: { sets: number; mev: number; mrv: number }) =>
      r.sets < r.mev ? "Bajo MEV" : r.sets > r.mrv ? "Alto volumen" : "Óptimo";
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
          ? Math.round(w.workoutStats.avgCompleted * 10) / 10
          : "",
        `${w.workoutStats.completedCount} semanas anteriores`,
      ],
      ["Racha (semanas)", hasPlan ? planStats.streakWeeks : "", ""],
      ["Cumplimiento 30d (%)", hasPlan ? planStats.compliance.pct : "", ""],
      ["Duración promedio (min)", Math.round(metrics.avgDurationSec / 60), ""],
      [],
      [
        hardWindow === "7d"
          ? "Series efectivas por músculo (por semana · últ. 7 días)"
          : "Series efectivas por músculo (prom. semanal · últ. 30 días)",
      ],
      ["Músculo", "Series/sem", "MEV", "MAV", "MRV", "Estado"],
      ...(hardWindow === "7d" ? hardSets7 : hardSets30).map((r) => [
        muscleEs(r.muscle),
        Math.round(r.sets * 10) / 10,
        r.mev,
        r.mav,
        r.mrv,
        statusOf(r),
      ]),
      [],
      ["Series por músculo (últ. 30 días)"],
      ["Músculo", "Series"],
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

  // Solo se pide confirmación al QUITAR un día de la semana en curso (bajar la
  // exigencia de una semana ya empezada). Agregar días o armar el plan por
  // primera vez se aplica directo.
  function requestToggle(wkMs: number, weekday: number) {
    const isCurrent = wkMs === thisWeekMs;
    const removing = resolvePlanned(wkMs).includes(weekday);
    if (isCurrent && removing) {
      setPendingToggle({ wkMs, weekday });
      return;
    }
    toggleDayForWeek(wkMs, weekday);
  }

  function handleDayClick(day: PlanDay) {
    if (!day.isEditableWeek) return;
    requestToggle(day.wkMs, day.weekday);
  }

  async function confirmDelete() {
    if (!pendingDelete) return;
    try {
      await deleteSession.mutateAsync(pendingDelete);
      setPendingDelete(null);
      setDeleteError(null);
      toast("Entrenamiento eliminado");
    } catch {
      setDeleteError("No se pudo eliminar. Probá de nuevo.");
    }
  }

  if (isPending || prefsPending) {
    return (
      <div className="grid place-items-center py-16">
        <Spinner />
      </div>
    );
  }

  // Cards que se PROMUEVEN a portada según perfil/objetivo (o van al fijo abajo
  // si no). Se construyen una vez y se ubican en UN solo lugar → sin duplicados.
  const hardWindowDays = hardWindow === "7d" ? 7 : 30;
  const muscleSetsSection = (
    <SectionCard
      title="Series efectivas por grupo"
      subtitle={`Series/semana · últimos ${hardWindowDays} días`}
      info={
        <div className="flex flex-col gap-3">
          <p>
            <span className="text-fg font-medium">Qué es.</span> Las series que
            hacés por semana en cada músculo, contra tres referencias de
            volumen.
          </p>
          <div>
            <p className="text-fg font-medium">Cómo leerlo</p>
            <ul className="mt-1 flex flex-col gap-1">
              <li>
                • Bajo el mínimo efectivo (MEV): todavía es poco estímulo para
                que ese músculo crezca. Sumá series si es una prioridad.
              </li>
              <li>
                • Entre el MEV y el máximo recuperable (MRV): rango de trabajo.
                El máximo volumen adaptativo (MAV) marca dónde rendirías mejor.
              </li>
              <li>
                • Sobre el MRV: es una bandera de fatiga, no un error. Fijate si
                estás recuperando bien.
              </li>
            </ul>
          </div>
          <p>
            {hardWindow === "7d"
              ? "Con 7 días ves el conteo directo de la última semana."
              : "Con 30 días ves el promedio semanal, más suave pero menos puntual."}{" "}
            Una serie sin RIR cargado también cuenta: si no registrás la
            proximidad al fallo, las barras son un techo, no una medición.
          </p>
          <details className="rounded-md bg-surface-2 p-3">
            <summary className="cursor-pointer text-fg font-medium">
              Metodología y fuentes
            </summary>
            <div className="mt-2 flex flex-col gap-2">
              <p>
                Serie efectiva: el piso de reps y la proximidad al fallo salen de
                tu objetivo. Cada serie se reparte entre los músculos del
                ejercicio: 1 para el motor principal y 0,5 para cada secundario,
                el esquema que mejor explicó los datos entre tres probados (1,
                0,5 y 0). <Ref id="16" />
              </p>
              <p>
                Para hipertrofia, las marcas salen de las bandas de volumen
                semanal por grupo muscular: menos de 9 series rinde 5,4%, entre
                10 y 19 rinde 6,6% y 20 o más rinde 9,8%. <Ref id="1" /> De ahí
                MEV 10, MAV 16 y MRV 20; los rendimientos decrecientes cerca de
                11 coinciden. <Ref id="16" />
              </p>
              <p>
                Para fuerza las marcas son más bajas porque su meseta llega
                antes <Ref id="16" /> y las bandas por ejercicio topan cerca de
                10. <Ref id="20" /> Esos tres valores están interpolados, así que
                son los menos firmes.
              </p>
              <p>
                No varían por músculo a propósito: las meta-regresiones agrupan
                todos los músculos y no respaldan un valor distinto para pecho
                que para glúteos. Referencia de campo: <Ref id="rp" />.
              </p>
              <p>
                Pasarse del MRV no es hacer algo mal: la banda de 20+ es la que
                más rinde, pero también la que más cuesta recuperar. Colores:
                bajo el MEV ámbar, entre MEV y MRV verde, sobre el MRV rojo.
              </p>
              <p>
                &ldquo;Volumen&rdquo; acá es el conteo de series cerca del
                fallo, no el tonelaje (series × reps × peso), que sube con más
                trabajo y no con mejor trabajo.
              </p>
            </div>
          </details>
        </div>
      }
    >
      <div className="w-full mb-3">
        <Tabs
          value={hardWindow}
          onChange={setHardWindow}
          ariaLabel="Ventana de tiempo"
          options={[
            { value: "7d", label: "7 días" },
            { value: "30d", label: "30 días" },
          ]}
        />
      </div>
      <MuscleSetsBar
        data={hardWindow === "7d" ? hardSets7 : hardSets30}
        windowDays={hardWindow === "7d" ? 7 : 30}
      />
    </SectionCard>
  );

  const constanciaSection = (
    <SectionCard
      title="Constancia"
      subtitle="Últimas 12 semanas"
      info="Cada celda es un día; más dorado = más series completadas ese día. Se cuentan las series, no el tonelaje, para que un día de solo cardio o de solo isométricos también figure como entrenado. Las columnas son semanas (izquierda = más antigua) y las filas los días (lunes arriba)."
    >
      <ConsistencyHeatmap weeks={metrics.heatWeeks} max={metrics.heatMax} />
    </SectionCard>
  );

  const retentionCard =
    metrics.retention.series.length > 0 ? (
      <RetentionCard r={metrics.retention} />
    ) : null;

  const lastThree = (data ?? []).slice(0, 3);
  const weeklyAvg =
    weekMetrics.workoutStats.completedCount > 0
      ? `${fmtNum(weekMetrics.workoutStats.avgCompleted, 1)}/sem`
      : null;
  const summaryParts = [
    `${fmtNum(metrics.count)} ${metrics.count === 1 ? "entreno" : "entrenos"}`,
    weeklyAvg,
    metrics.avgDurationSec
      ? `${fmtNum(Math.round(metrics.avgDurationSec / 60))} min promedio`
      : null,
  ].filter((x): x is string => x !== null);

  function openFullHistory() {
    setHistoryOpen(true);
    // Esperamos al render para que el bloque ya esté expandido al hacer scroll.
    requestAnimationFrame(() => {
      document
        .getElementById("historial")
        ?.scrollIntoView({ behavior: "smooth", block: "start" });
    });
  }

  return (
    <div>
      <PageHeader
        title="Registro"
        subtitle="Tu progreso y métricas"
        action={
          <div className="flex items-center gap-1">
            {!!data?.length && (
              <IconButton label="Exportar a Excel" onClick={() => setExportOpen(true)}>
                <Download className="size-5" />
              </IconButton>
            )}
          </div>
        }
      />

      {isError && !data ? (
        <ErrorState
          title="No pudimos cargar tu historial"
          description="Revisá tu conexión. Tus datos están guardados."
          onRetry={() => refetch()}
          retrying={isFetching}
        />
      ) : !data?.length ? (
        <EmptyState
          icon={<LineChart className="size-8" />}
          title="Sin entrenamientos todavía"
          description="Cuando completes una rutina vas a ver tus métricas acá."
        />
      ) : (
        <>
          {/* División: métricas de entrenamiento vs. avances corporales. Va
              arriba y fija para llegar a Cuerpo (peso, sueño) sin scrollear. */}
          <div className="sticky top-0 z-10 -mx-4 px-4 py-2 bg-bg/90 backdrop-blur">
            <Tabs
              value={regView}
              onChange={setRegView}
              ariaLabel="Vista de Registro"
              options={[
                { value: "entreno", label: "Entrenamiento" },
                { value: "cuerpo", label: "Cuerpo" },
              ]}
            />
          </div>

        <div className="flex flex-col gap-5 mt-3">
          {regView === "cuerpo" && (
            <div>
              <p className="text-xs text-muted mb-1">
                Peso, sueño y medidas · registralos a diario (igual para todos
                los objetivos).
              </p>
              <BodyProgress sessions={data ?? []} />
            </div>
          )}

          {regView === "entreno" && (
            <>
          {/* Objetivo: sin él casi todas las métricas de portada quedan ocultas. */}
          {prefs && trainingProfile == null && (
            <div className="card rounded-xl p-4 flex flex-col gap-3">
              <p className="text-sm font-medium">
                Elegí tu objetivo para ver las métricas que importan
              </p>
              <Link
                href="/perfil"
                className={buttonClasses({ size: "md", className: "w-full" })}
              >
                Elegir objetivo
              </Link>
            </div>
          )}
          {trainingProfile && (
            <Link
              href="/perfil"
              className="self-start inline-flex items-center min-h-11 -my-2 rounded-full bg-surface-2 px-3 text-xs text-muted hover:text-fg"
            >
              Objetivo: {GOAL_LABEL[trainingProfile]} · cambiar
            </Link>
          )}

          <div className="flex flex-col gap-2.5">
            <div className="grid grid-cols-2 gap-2.5">
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
              <Stat
                label="Días esta semana"
                value={weekMetrics.workoutStats.current}
                unit="días"
                sub="entrenados"
                delta={weekMetrics.workoutStats.currentVsLastPct}
                deltaSuffix="vs sem. pasada"
                secondary={
                  weekMetrics.workoutStats.lastCompleted != null
                    ? `sem. anterior: ${weekMetrics.workoutStats.lastCompleted}`
                    : undefined
                }
                info={
                  "Días distintos entrenados en la semana en curso. La constancia es el driver base: sin adherencia no hay volumen.\n\n" +
                  "El % compara lunes→hoy con el mismo tramo de la semana pasada."
                }
              />
              <Stat
                label="Series efectivas"
                value={weekMetrics.hardStats.current}
                unit="series"
                sub="hasta ahora"
                delta={weekMetrics.hardStats.currentVsLastPct}
                deltaSuffix="vs sem. pasada"
                secondary={
                  weekMetrics.hardStats.lastCompleted != null
                    ? `sem. anterior: ${fmtNum(weekMetrics.hardStats.lastCompleted)} series`
                    : undefined
                }
                info={
                  <>
                    Series de trabajo (≥{goalParams(trainingProfile).hardSetMinReps}{" "}
                    reps y cerca del fallo, según tu objetivo) acumuladas en la
                    semana en curso. Es el mejor indicador de estímulo para
                    hipertrofia (<Ref id="1" />, <Ref id="7" />).{"\n\n"}
                    El % compara lunes→hoy con el mismo tramo de la semana pasada.
                  </>
                }
              />
            </div>
            <button
              type="button"
              onClick={() => setMonthOpen(true)}
              className="flex items-center justify-between gap-2 min-h-11 text-left text-xs text-muted hover:text-fg"
            >
              <span>{summaryParts.join(" · ")}</span>
              <span className="inline-flex items-center gap-0.5 shrink-0">
                mes a mes <ChevronRight className="size-3.5" />
              </span>
            </button>
          </div>

          {/* Últimos entrenos: lo más frecuente es revisar o corregir el de ayer. */}
          <div className="card rounded-xl p-4">
            <p className="text-sm font-semibold mb-3">Últimos entrenos</p>
            <ul className="flex flex-col gap-1.5">
              {lastThree.map((s) => (
                <SessionRow
                  key={s.id}
                  s={s}
                  onDelete={() => {
                    setDeleteError(null);
                    setPendingDelete(s.id);
                  }}
                />
              ))}
            </ul>
            <Button
              variant="ghost"
              className="w-full mt-2"
              onClick={openFullHistory}
            >
              Ver historial completo
            </Button>
          </div>

          <WeeklyPlanCard
            currentWeekPlanned={currentWeekPlanned}
            saveError={setPlan.isError || setOverride.isError}
            planStats={planStats}
            expanded={planExpanded}
            onToggleExpanded={() => setPlanExpanded((v) => !v)}
            onDayClick={handleDayClick}
            onToggleToday={(weekday) => requestToggle(thisWeekMs, weekday)}
          />

          {/* Portada específica del objetivo (métricas promovidas). Hasta
              conocer el perfil se reserva el lugar con un skeleton de alto
              fijo, así las cards no se reordenan bajo el dedo. */}
          <GoalMetrics
            trainingProfile={trainingProfile}
            sessions={data ?? []}
            exMap={exMap}
            muscleSetsBar={
              trainingProfile === "hipertrofia" ? muscleSetsSection : undefined
            }
          />

          {achievementsPending ? (
            <Skeleton className="h-24 w-full rounded-xl" />
          ) : !!achievements?.length && (
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

          {/* Series efectivas por grupo (MEV/MAV/MRV): en Hipertrofia va arriba
              (portada); acá abajo solo en Resistencia / sin perfil. En Fuerza no
              aplica (esos umbrales son de hipertrofia). */}
          {trainingProfile !== "fuerza" &&
            trainingProfile !== "hipertrofia" &&
            muscleSetsSection}

          <SectionCard
            title="Balance de patrones"
            subtitle="Volumen de los últimos 30 días"
            info="Reparto del volumen de los últimos 30 días entre empuje/tirón (según el tipo de fuerza del ejercicio) y compuesto/aislamiento (según si el ejercicio mueve uno o varios músculos). Un reparto muy inclinado hacia un lado puede señalar un desbalance que el volumen total no deja ver, aunque estés entrenando mucho."
          >
            <PatternBalance data={metrics.balance} />
          </SectionCard>

          {constanciaSection}

          {/* Más métricas (off-portada): tonelaje, músculos entrenados, récords. */}
          <button
            onClick={() => setMoreOpen(!moreOpen)}
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
              >
                <div className="w-full mb-3">
                  <Tabs
                    value={chartView}
                    onChange={setChartView}
                    ariaLabel="Período del gráfico"
                    options={[
                      { value: "week", label: "Semanal" },
                      { value: "month", label: "Anual" },
                    ]}
                  />
                </div>
                <VolumeChart
                  data={
                    chartView === "week" ? metrics.weekChart : metrics.monthChart
                  }
                />
              </SectionCard>

              {metrics.muscleDonut.length > 0 && (
                <SectionCard
                  title="Músculos entrenados"
                  subtitle="Series · últimos 30 días"
                  info="Distribución de las series por grupo muscular en los últimos 30 días, con la misma capa de contribución que el resto de las métricas: cada serie cuenta 1 para el motor principal del ejercicio y 0,5 para cada secundario. Por eso los totales son fraccionales y suman más que la cantidad de series hechas — un compuesto alimenta varios grupos a la vez. A diferencia de 'Series efectivas por grupo', acá no se filtra por RIR: es en qué gastás las series, no cuánto volumen efectivo acumulaste."
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
                          {fmtNum(pr.orm)} kg
                        </span>
                      </li>
                    ))}
                  </ul>
                </SectionCard>
              )}

              {/* Progresión por ejercicio: en Hipertrofia va en portada. */}
              {trainingProfile !== "hipertrofia" &&
                metrics.sparklines.length > 0 && (
                  <SparklineGridCard series={metrics.sparklines} />
                )}

              {/* Retención de fuerza: dato de fuerza estable (off-portada). */}
              {retentionCard}
            </div>
          )}

          <div id="historial" className="scroll-mt-16">
            <button
              onClick={() => setHistoryOpen(!historyOpen)}
              className="flex items-center justify-between w-full min-h-11 mb-2"
              aria-expanded={historyOpen}
            >
              <p className="text-sm font-semibold">Historial</p>
              <span className="flex items-center gap-2 text-xs text-muted">
                {fmtNum(data.length)} entrenos
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
                    <p className="text-xs text-muted uppercase tracking-wide mt-3 mb-1.5 capitalize">
                      {g.label} · {g.items.length}
                    </p>
                    <ul className="flex flex-col gap-1.5">
                      {g.items.map((s) => (
                        <SessionRow
                          key={s.id}
                          s={s}
                          onDelete={() => {
                            setDeleteError(null);
                            setPendingDelete(s.id);
                          }}
                        />
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
                    Ver todos ({fmtNum(data.length)})
                  </Button>
                )}
              </>
            )}
          </div>
            </>
          )}
        </div>
        </>
      )}

      <ExportModal
        open={exportOpen}
        onClose={() => setExportOpen(false)}
        onExport={exportPeriod}
        daysAgo={daysAgo}
      />

      <ConfirmDialog
        open={pendingDelete !== null}
        title="Eliminar entrenamiento"
        description="Se va a borrar esta sesión del historial, con sus series y su volumen. No se puede deshacer."
        confirmLabel="Eliminar"
        loading={deleteSession.isPending}
        error={deleteError}
        onConfirm={confirmDelete}
        onCancel={() => {
          setPendingDelete(null);
          setDeleteError(null);
        }}
      />

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

      <ConfirmDialog
        open={pendingToggle !== null}
        title="¿Cambiar la meta de esta semana?"
        description="Vas a quitar un día de la semana en curso. Esto no borra lo que ya entrenaste: solo ajusta cuánto te exigís de acá al domingo."
        confirmLabel="Confirmar"
        tone="primary"
        onConfirm={() => {
          if (pendingToggle) {
            toggleDayForWeek(pendingToggle.wkMs, pendingToggle.weekday);
          }
          setPendingToggle(null);
        }}
        onCancel={() => setPendingToggle(null)}
      />
    </div>
  );
}

/** Fila del historial: el Link y el botón de borrar son hermanos (un button
 *  dentro de un a es HTML inválido y confunde al lector de pantalla). */
function SessionRow({
  s,
  onDelete,
}: {
  s: HistorySession;
  onDelete: () => void;
}) {
  const date = formatDate(sessionDate(s));
  return (
    <li>
      <div className="card flex items-center pr-1 hover:ring-1 hover:ring-primary transition">
        <Link
          href={`/entrenar/${s.id}`}
          className="flex min-w-0 flex-1 items-center gap-3 pl-3 py-2.5 min-h-11"
        >
          <div className="min-w-0 flex-1">
            <p className="font-medium text-sm truncate">{s.name}</p>
            <p className="text-xs text-muted">
              {date} · {fmtNum(sessionSets(s))} series · {formatVolume(sessionVolume(s))}
              {s.duration_seconds
                ? ` · ${fmtNum(Math.round(s.duration_seconds / 60))} min`
                : ""}
            </p>
          </div>
          <ChevronRight className="size-4 text-muted shrink-0" />
        </Link>
        <IconButton
          label={`Eliminar entreno del ${date}`}
          tone="danger"
          onClick={onDelete}
        >
          <Trash2 className="size-4" />
        </IconButton>
      </div>
    </li>
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
  onExport: (from: Date | null, to: Date | null, tag: string) => Promise<string | null>;
  daysAgo: (n: number) => Date;
}) {
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  // Tag del preset en curso: el sheet queda abierto con ese botón en loading.
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function run(f: Date | null, t: Date | null, tag: string) {
    setBusy(tag);
    setError(null);
    const err = await onExport(f, t, tag);
    setBusy(null);
    if (err) setError(err);
    else onClose();
  }

  const presets: { label: string; tag: string; from: () => Date | null }[] = [
    { label: "Últimos 7 días", tag: "7d", from: () => daysAgo(7) },
    { label: "Últimos 30 días", tag: "30d", from: () => daysAgo(30) },
    { label: "Últimos 90 días", tag: "90d", from: () => daysAgo(90) },
    { label: "Todo", tag: "todo", from: () => null },
  ];

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Exportar Excel"
      dismissible={busy === null}
    >
      <p className="text-sm text-muted mb-3">
        Elegí un período. Se descarga un Excel con tus series (una fila por
        serie), sesiones, sueño, medidas, comentarios y métricas. La primera
        pestaña explica qué significa cada columna, así una IA lo puede leer sin
        adivinar.
      </p>
      <div className="flex flex-col gap-2">
        {presets.map((p) => (
          <Button
            key={p.tag}
            variant="secondary"
            className="w-full justify-between"
            loading={busy === p.tag}
            disabled={busy !== null}
            onClick={() => run(p.from(), null, p.tag)}
          >
            {p.label}
            <Download className="size-4 text-muted" />
          </Button>
        ))}
      </div>

      <div className="mt-4 border-t border-border pt-4">
        <p className="text-xs text-muted mb-2">Rango personalizado</p>
        <div className="grid grid-cols-2 gap-2">
          <Field label="Desde">
            <input
              type="date"
              value={from}
              max={to || undefined}
              onChange={(e) => setFrom(e.target.value)}
              className="h-11 w-full rounded-md bg-surface-2 px-2 text-base text-fg outline-none ring-1 ring-border focus:ring-primary"
            />
          </Field>
          <Field label="Hasta">
            <input
              type="date"
              value={to}
              min={from || undefined}
              onChange={(e) => setTo(e.target.value)}
              className="h-11 w-full rounded-md bg-surface-2 px-2 text-base text-fg outline-none ring-1 ring-border focus:ring-primary"
            />
          </Field>
        </div>
        <Button
          className="w-full mt-3"
          loading={busy === "rango"}
          disabled={(!from && !to) || busy !== null}
          onClick={() => {
            const toEnd = toDate(to);
            if (toEnd) toEnd.setHours(23, 59, 59, 999);
            run(toDate(from), toEnd, "rango");
          }}
        >
          Exportar rango
        </Button>
      </div>
      {error && (
        <p role="alert" className="text-xs text-danger mt-3">
          {error}
        </p>
      )}
    </Modal>
  );
}

type DayState = "done" | "missed" | "extra" | "planned" | "none";
function state(pd: PlanDay): DayState {
  if (!pd.planned) return pd.completed ? "extra" : "none";
  if (!pd.judged) return "none";
  if (pd.completed) return "done";
  return pd.isPast ? "missed" : "planned";
}
function dayStateLabel(pd: PlanDay): string {
  switch (state(pd)) {
    case "done":
      return "cumplido";
    case "missed":
      return "faltó";
    case "extra":
      return "entrenaste sin plan";
    case "planned":
      return "planeado";
    default:
      return "sin plan";
  }
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
        {WEEKDAYS.map(({ weekday, short, full }) => {
          const active = currentWeekPlanned.includes(weekday);
          return (
            <button
              key={weekday}
              type="button"
              onClick={() => onToggleToday(weekday)}
              aria-label={full}
              aria-pressed={active}
              className={clsx(
                "size-11 rounded-md text-sm font-medium transition",
                active
                  ? "bg-primary text-primary-fg"
                  : "bg-surface-2 text-muted hover:text-fg",
              )}
            >
              {short}
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
            {WEEKDAYS.map((d) => (
              <span key={d.weekday} aria-hidden="true">
                {d.short}
              </span>
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
                aria-label={`${pd.day}: ${dayStateLabel(pd)}${pd.isEditableWeek ? ". Tocá para cambiar el plan" : ""}`}
                disabled={!pd.isEditableWeek}
                onClick={() => onDayClick(pd)}
                className={clsx(
                  "aspect-square rounded-md flex flex-col items-center justify-center text-xs font-medium",
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
                {state(pd) === "done" && <Check className="size-2.5" aria-hidden="true" />}
                {state(pd) === "missed" && <X className="size-2.5" aria-hidden="true" />}
              </button>
            ))}
          </div>
          <ul className="mt-3 flex flex-wrap gap-x-3 gap-y-1 text-xs text-muted">
            <li className="inline-flex items-center gap-1">
              <span className="size-2.5 rounded-sm bg-success/20" /> Cumplido
            </li>
            <li className="inline-flex items-center gap-1">
              <span className="size-2.5 rounded-sm bg-danger/20" /> Faltó
            </li>
            <li className="inline-flex items-center gap-1">
              <span className="size-2.5 rounded-sm ring-1 ring-success/50" /> Extra
            </li>
            <li className="inline-flex items-center gap-1">
              <span className="size-2.5 rounded-sm ring-1 ring-primary/40" /> Planeado
            </li>
          </ul>
          <p className="mt-2 text-xs text-muted">
            Tocá un día de las próximas semanas para ajustar solo esa semana.
          </p>
        </div>
      )}
    </div>
  );
}
