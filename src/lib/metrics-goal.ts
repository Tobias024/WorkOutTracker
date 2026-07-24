import type { HistorySession } from "@/hooks/useHistory";
import type { Exercise, SleepLog, BodyMeasurement } from "@/lib/types";
import {
  estimate1RM,
  sessionDate,
  weekStart,
  isCountableSet,
  isHardSet,
  landmarkFor,
  rirOf,
  muscleContributions,
} from "@/lib/metrics";

// Helpers de métricas por objetivo (Fase 2). Todo se calcula desde el historial;
// el objetivo sólo decide qué se muestra. Ver Asset/spec-metricas-por-objetivo.md.

const WEEK = 7 * 86400000;
const DAY = 86400000;

export interface Pt {
  label: string;
  value: number;
}

function weekLabel(ms: number): string {
  const d = new Date(ms);
  return `${d.getDate()}/${d.getMonth() + 1}`;
}

function weeklySorted(map: Map<number, number>): Pt[] {
  return [...map.entries()]
    .sort((a, b) => a[0] - b[0])
    .map(([wk, v]) => ({ label: weekLabel(wk), value: v }));
}

function ms(s: HistorySession): number {
  return new Date(sessionDate(s)).getTime();
}

// ── Fuerza / Hipertrofia: e1RM por ejercicio ────────────────────────────────

export interface ExerciseSeries {
  exId: string;
  name: string;
  series: Pt[];
  count: number;
  last: number;
  deltaPct: number | null;
}

/** Mejor 1RM estimado por semana para cada ejercicio (ordenado por frecuencia). */
export function e1rmSeriesByExercise(
  sessions: HistorySession[],
  exMap: Map<string, Exercise>,
  weeks = 12,
): ExerciseSeries[] {
  const cutoff = Date.now() - weeks * WEEK;
  const byEx = new Map<string, Map<number, number>>();
  const count = new Map<string, number>();
  for (const s of sessions) {
    const t = ms(s);
    if (t < cutoff) continue;
    const wk = weekStart(new Date(t)).getTime();
    for (const we of s.workout_exercises) {
      for (const set of we.workout_sets) {
        if (!isCountableSet(set) || !set.weight || !set.reps) continue;
        const e = estimate1RM(set.weight, set.reps);
        if (e <= 0) continue;
        let m = byEx.get(we.exercise_id);
        if (!m) {
          m = new Map();
          byEx.set(we.exercise_id, m);
        }
        m.set(wk, Math.max(m.get(wk) ?? 0, e));
        count.set(we.exercise_id, (count.get(we.exercise_id) ?? 0) + 1);
      }
    }
  }
  const out: ExerciseSeries[] = [];
  for (const [exId, m] of byEx) {
    const series = weeklySorted(m).map((p) => ({
      label: p.label,
      value: Math.round(p.value),
    }));
    if (series.length === 0) continue;
    const last = series[series.length - 1].value;
    const first = series[0].value;
    out.push({
      exId,
      name: exMap.get(exId)?.name ?? "Ejercicio",
      series,
      count: count.get(exId) ?? 0,
      last,
      deltaPct: first ? Math.round(((last - first) / first) * 100) : null,
    });
  }
  return out.sort((a, b) => b.count - a.count);
}

// ── Fuerza: distribución de intensidad (%1RM) ───────────────────────────────

export interface IntensityDist {
  light: number;
  medium: number;
  heavy: number;
  total: number;
}

function refE1rm(sessions: HistorySession[], cutoff: number): Map<string, number> {
  const ref = new Map<string, number>();
  for (const s of sessions) {
    if (ms(s) < cutoff) continue;
    for (const we of s.workout_exercises)
      for (const set of we.workout_sets) {
        if (!isCountableSet(set) || !set.weight || !set.reps) continue;
        ref.set(
          we.exercise_id,
          Math.max(ref.get(we.exercise_id) ?? 0, estimate1RM(set.weight, set.reps)),
        );
      }
  }
  return ref;
}

/** Reparto de series por zona de %1RM (ref = mejor 1RM estimado del período). */
export function intensityZones(
  sessions: HistorySession[],
  days = 28,
): IntensityDist {
  const cutoff = Date.now() - days * DAY;
  const ref = refE1rm(sessions, cutoff);
  let light = 0,
    medium = 0,
    heavy = 0;
  for (const s of sessions) {
    if (ms(s) < cutoff) continue;
    for (const we of s.workout_exercises) {
      const r = ref.get(we.exercise_id);
      if (!r) continue;
      for (const set of we.workout_sets) {
        if (!isCountableSet(set) || !set.weight) continue;
        const pct = set.weight / r;
        if (pct < 0.7) light++;
        else if (pct <= 0.85) medium++;
        else heavy++;
      }
    }
  }
  return { light, medium, heavy, total: light + medium + heavy };
}

/** RIR promedio semanal de series pesadas (>85% del 1RM estimado). */
export function heavyRirTrend(
  sessions: HistorySession[],
  weeks = 12,
): Pt[] {
  const cutoff = Date.now() - weeks * WEEK;
  const ref = refE1rm(sessions, cutoff);
  const sum = new Map<number, { s: number; n: number }>();
  for (const s of sessions) {
    const t = ms(s);
    if (t < cutoff) continue;
    const wk = weekStart(new Date(t)).getTime();
    for (const we of s.workout_exercises) {
      const r = ref.get(we.exercise_id);
      if (!r) continue;
      for (const set of we.workout_sets) {
        if (!isCountableSet(set) || !set.weight || set.weight / r < 0.85) continue;
        const rir = rirOf(set);
        if (rir == null) continue;
        const a = sum.get(wk) ?? { s: 0, n: 0 };
        a.s += rir;
        a.n++;
        sum.set(wk, a);
      }
    }
  }
  const m = new Map<number, number>();
  for (const [wk, a] of sum) m.set(wk, a.n ? a.s / a.n : 0);
  return weeklySorted(m).map((p) => ({
    label: p.label,
    value: Math.round(p.value * 10) / 10,
  }));
}

// ── Fuerza: frecuencia por patrón ───────────────────────────────────────────

export interface PatternRow {
  label: string;
  value: number;
}

function patternsOf(ex: Exercise): string[] {
  const out: string[] = [];
  const prim = ex.primary_muscles ?? [];
  if (prim.includes("quadriceps")) out.push("squat");
  if (
    prim.includes("hamstrings") ||
    prim.includes("glutes") ||
    prim.includes("lower back")
  )
    out.push("hinge");
  if (ex.force === "push") out.push("push");
  if (ex.force === "pull") out.push("pull");
  return out;
}

/** Sesiones por semana que trabajaron cada patrón (sentadilla/bisagra/empuje/tirón). */
export function patternFrequency(
  sessions: HistorySession[],
  exMap: Map<string, Exercise>,
  weeks = 8,
): PatternRow[] {
  const cutoff = Date.now() - weeks * WEEK;
  const counts = new Map<string, number>();
  const weeksWith = new Set<number>();
  for (const s of sessions) {
    const t = ms(s);
    if (t < cutoff) continue;
    weeksWith.add(weekStart(new Date(t)).getTime());
    const pats = new Set<string>();
    for (const we of s.workout_exercises) {
      const ex = exMap.get(we.exercise_id);
      if (!ex || !we.workout_sets.some(isCountableSet)) continue;
      for (const p of patternsOf(ex)) pats.add(p);
    }
    for (const p of pats) counts.set(p, (counts.get(p) ?? 0) + 1);
  }
  const wks = Math.max(1, weeksWith.size);
  const LABELS: [string, string][] = [
    ["squat", "Sentadilla"],
    ["hinge", "Bisagra"],
    ["push", "Empuje"],
    ["pull", "Tirón"],
  ];
  return LABELS.map(([key, label]) => ({
    label,
    value: Math.round(((counts.get(key) ?? 0) / wks) * 10) / 10,
  }));
}

// ── Hipertrofia: proximidad al fallo (buckets de RIR por músculo) ────────────

export interface MuscleBuckets {
  muscle: string;
  b01: number;
  b23: number;
  b4: number;
  total: number;
}

export function rirBucketsByMuscle(
  sessions: HistorySession[],
  exMap: Map<string, Exercise>,
  days = 30,
): MuscleBuckets[] {
  const cutoff = Date.now() - days * DAY;
  const acc = new Map<string, { b01: number; b23: number; b4: number }>();
  for (const s of sessions) {
    if (ms(s) < cutoff) continue;
    for (const we of s.workout_exercises) {
      const ex = exMap.get(we.exercise_id);
      if (!ex) continue;
      const contribs = muscleContributions(ex);
      for (const set of we.workout_sets) {
        if (!isCountableSet(set)) continue;
        const rir = rirOf(set);
        if (rir == null) continue;
        const key = rir <= 1 ? "b01" : rir <= 3 ? "b23" : "b4";
        for (const c of contribs) {
          const a = acc.get(c.muscle) ?? { b01: 0, b23: 0, b4: 0 };
          a[key] += c.weight;
          acc.set(c.muscle, a);
        }
      }
    }
  }
  return [...acc.entries()]
    .map(([muscle, a]) => ({ muscle, ...a, total: a.b01 + a.b23 + a.b4 }))
    .filter((x) => x.total > 0)
    .sort((a, b) => b.total - a.total)
    .slice(0, 8);
}

// ── Hipertrofia: días desde la última sesión por músculo ────────────────────

export interface MuscleDays {
  muscle: string;
  days: number;
}

export function daysSinceLastByMuscle(
  sessions: HistorySession[],
  exMap: Map<string, Exercise>,
): MuscleDays[] {
  const last = new Map<string, number>();
  for (const s of sessions) {
    const t = ms(s);
    for (const we of s.workout_exercises) {
      const ex = exMap.get(we.exercise_id);
      if (!ex || !we.workout_sets.some(isCountableSet)) continue;
      // Cuenta primarios y secundarios: un músculo exigido de forma compuesta
      // (ej. tríceps en un press) igual se fatigó y cuenta para recuperación.
      for (const m of [...ex.primary_muscles, ...ex.secondary_muscles])
        last.set(m, Math.max(last.get(m) ?? 0, t));
    }
  }
  const now = Date.now();
  return [...last.entries()]
    .map(([muscle, t]) => ({ muscle, days: Math.floor((now - t) / DAY) }))
    .sort((a, b) => b.days - a.days)
    .slice(0, 12);
}

// ── Resistencia: reps por serie / densidad / test de reps ───────────────────

export function repsPerSetWeekly(
  sessions: HistorySession[],
  weeks = 12,
): Pt[] {
  const cutoff = Date.now() - weeks * WEEK;
  const sum = new Map<number, { s: number; n: number }>();
  for (const s of sessions) {
    const t = ms(s);
    if (t < cutoff) continue;
    const wk = weekStart(new Date(t)).getTime();
    for (const we of s.workout_exercises)
      for (const set of we.workout_sets) {
        if (!isCountableSet(set) || set.reps == null) continue;
        const a = sum.get(wk) ?? { s: 0, n: 0 };
        a.s += set.reps;
        a.n++;
        sum.set(wk, a);
      }
  }
  const m = new Map<number, number>();
  for (const [wk, a] of sum) m.set(wk, a.n ? a.s / a.n : 0);
  return weeklySorted(m).map((p) => ({
    label: p.label,
    value: Math.round(p.value * 10) / 10,
  }));
}

export function sessionDensityWeekly(
  sessions: HistorySession[],
  weeks = 12,
): Pt[] {
  const cutoff = Date.now() - weeks * WEEK;
  const agg = new Map<number, { reps: number; min: number }>();
  for (const s of sessions) {
    const t = ms(s);
    if (t < cutoff || !s.duration_seconds) continue;
    const wk = weekStart(new Date(t)).getTime();
    let reps = 0;
    for (const we of s.workout_exercises)
      for (const set of we.workout_sets)
        if (isCountableSet(set) && set.reps) reps += set.reps;
    const a = agg.get(wk) ?? { reps: 0, min: 0 };
    a.reps += reps;
    a.min += s.duration_seconds / 60;
    agg.set(wk, a);
  }
  const m = new Map<number, number>();
  for (const [wk, a] of agg) m.set(wk, a.min ? a.reps / a.min : 0);
  return weeklySorted(m).map((p) => ({
    label: p.label,
    value: Math.round(p.value * 10) / 10,
  }));
}

export interface MaxRepsRow {
  name: string;
  current: number;
  previous: number;
}

/** Máximo de reps en una serie, mes actual vs mes anterior, top ejercicios. */
export function maxRepsTest(
  sessions: HistorySession[],
  exMap: Map<string, Exercise>,
  topN = 6,
): MaxRepsRow[] {
  const now = new Date();
  const curStart = new Date(now.getFullYear(), now.getMonth(), 1).getTime();
  const prevStart = new Date(now.getFullYear(), now.getMonth() - 1, 1).getTime();
  const cur = new Map<string, number>();
  const prev = new Map<string, number>();
  const count = new Map<string, number>();
  for (const s of sessions) {
    const t = ms(s);
    for (const we of s.workout_exercises)
      for (const set of we.workout_sets) {
        if (!isCountableSet(set) || set.reps == null) continue;
        count.set(we.exercise_id, (count.get(we.exercise_id) ?? 0) + 1);
        if (t >= curStart)
          cur.set(we.exercise_id, Math.max(cur.get(we.exercise_id) ?? 0, set.reps));
        else if (t >= prevStart)
          prev.set(
            we.exercise_id,
            Math.max(prev.get(we.exercise_id) ?? 0, set.reps),
          );
      }
  }
  return [...count.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, topN)
    .map(([exId]) => ({
      name: exMap.get(exId)?.name ?? "Ejercicio",
      current: cur.get(exId) ?? 0,
      previous: prev.get(exId) ?? 0,
    }))
    .filter((r) => r.current > 0 || r.previous > 0);
}

// ── Composición: peso corporal / retención de fuerza ────────────────────────

export interface BwSeries {
  points: Pt[];
  ma: Pt[];
  ratePctPerWeek: number | null;
  last: number | null;
}

/** Peso corporal: puntos crudos + media móvil de 7 días + tasa %/semana. */
export function bodyweightSeries(
  sessions: HistorySession[],
  days = 120,
): BwSeries {
  const cutoff = Date.now() - days * DAY;
  const raw = sessions
    .filter((s) => s.body_weight_kg != null && ms(s) >= cutoff)
    .map((s) => ({ t: ms(s), w: s.body_weight_kg as number }))
    .sort((a, b) => a.t - b.t);
  if (raw.length === 0)
    return { points: [], ma: [], ratePctPerWeek: null, last: null };
  const points = raw.map((r) => ({ label: weekLabel(r.t), value: r.w }));
  const ma = raw.map((r) => {
    const from = r.t - 7 * DAY;
    const win = raw.filter((x) => x.t >= from && x.t <= r.t);
    const avg = win.reduce((a, x) => a + x.w, 0) / win.length;
    return { label: weekLabel(r.t), value: Math.round(avg * 10) / 10 };
  });
  const first = raw[0];
  const lastp = raw[raw.length - 1];
  const spanWeeks = (lastp.t - first.t) / WEEK;
  const ratePctPerWeek =
    spanWeeks > 0.5 && first.w
      ? Math.round((((lastp.w - first.w) / first.w) * 100) / spanWeeks * 100) / 100
      : null;
  return { points, ma, ratePctPerWeek, last: lastp.w };
}

/** Índice de retención de fuerza: e1RM del ejercicio más frecuente, base=100. */
export function strengthRetentionIndex(
  sessions: HistorySession[],
  exMap: Map<string, Exercise>,
  weeks = 16,
): { name: string; series: Pt[] } {
  const series = e1rmSeriesByExercise(sessions, exMap, weeks);
  const top = series[0];
  if (!top || !top.series[0]?.value) return { name: "", series: [] };
  const base = top.series[0].value;
  return {
    name: top.name,
    series: top.series.map((p) => ({
      label: p.label,
      value: Math.round((p.value / base) * 100),
    })),
  };
}

// ── Datos capturados (Fase 3): sueño / medidas / descanso ───────────────────

function labelFromDate(iso: string): string {
  const [, m, d] = iso.split("-").map(Number);
  return `${d}/${m}`;
}

/** Sueño de los últimos `days` días (barras) + promedio. */
export function sleepSeries(
  rows: SleepLog[],
  days = 14,
): { points: Pt[]; avg: number | null } {
  const recent = rows.slice(-days);
  const points = recent.map((r) => ({
    label: labelFromDate(r.slept_on),
    value: r.hours,
  }));
  const avg = recent.length
    ? Math.round((recent.reduce((a, r) => a + r.hours, 0) / recent.length) * 10) /
      10
    : null;
  return { points, avg };
}

/** Series por sitio de circunferencia (para líneas mensuales). */
export function measurementSeries(
  rows: BodyMeasurement[],
): { name: string; points: Pt[] }[] {
  const sites: [keyof BodyMeasurement, string][] = [
    ["arm_cm", "Brazo"],
    ["chest_cm", "Pecho"],
    ["waist_cm", "Cintura"],
    ["thigh_cm", "Muslo"],
  ];
  return sites
    .map(([key, name]) => ({
      name,
      points: rows
        .filter((r) => r[key] != null)
        .map((r) => ({ label: labelFromDate(r.measured_on), value: Number(r[key]) })),
    }))
    .filter((s) => s.points.length > 0);
}

/** Serie de cintura (para Pérdida de grasa). */
export function waistSeries(rows: BodyMeasurement[]): Pt[] {
  return rows
    .filter((r) => r.waist_cm != null)
    .map((r) => ({ label: labelFromDate(r.measured_on), value: Number(r.waist_cm) }));
}

// ── Base (Fase 4): Listo para entrenar ──────────────────────────────────────

export interface Readiness {
  muscle: string;
  days: number;
  lag: number;
  score: number;
}

/**
 * Ranking de grupos musculares "listos": combina recuperación (días desde la
 * última vez) y rezago de volumen (series efectivas de la última semana por
 * debajo del MEV). Responde "qué conviene entrenar hoy". Diseño propio.
 */
export function readinessByMuscle(
  sessions: HistorySession[],
  exMap: Map<string, Exercise>,
): Readiness[] {
  const now = Date.now();
  const lastAt = new Map<string, number>();
  for (const s of sessions) {
    const t = ms(s);
    for (const we of s.workout_exercises) {
      const ex = exMap.get(we.exercise_id);
      if (!ex || !we.workout_sets.some(isCountableSet)) continue;
      // Primarios + secundarios (participación compuesta cuenta para recuperación).
      for (const mu of [...ex.primary_muscles, ...ex.secondary_muscles])
        lastAt.set(mu, Math.max(lastAt.get(mu) ?? 0, t));
    }
  }
  const cutoff = now - 7 * DAY;
  const hard = new Map<string, number>();
  for (const s of sessions) {
    if (ms(s) < cutoff) continue;
    for (const we of s.workout_exercises) {
      const ex = exMap.get(we.exercise_id);
      if (!ex) continue;
      const contribs = muscleContributions(ex);
      for (const set of we.workout_sets) {
        if (!isHardSet(set)) continue;
        for (const c of contribs)
          hard.set(c.muscle, (hard.get(c.muscle) ?? 0) + c.weight);
      }
    }
  }
  const out: Readiness[] = [];
  for (const [mu, t] of lastAt) {
    const days = Math.floor((now - t) / DAY);
    const mev = landmarkFor(mu).mev;
    const sets = hard.get(mu) ?? 0;
    const lag = Math.max(0, Math.min(1, (mev - sets) / mev));
    const recovery = Math.min(1, days / 3);
    out.push({ muscle: mu, days, lag, score: recovery * 0.6 + lag * 0.4 });
  }
  return out.sort((a, b) => b.score - a.score).slice(0, 3);
}

/** Descanso medio entre series (segundos). Sólo gaps del mismo ejercicio, cap 10 min. */
export function avgRestBetweenSets(
  sessions: HistorySession[],
  maxMin = 10,
): { avgSec: number | null; samples: number } {
  let sum = 0;
  let n = 0;
  const cap = maxMin * 60000;
  const floor = 10000; // <10 s = auto-completado en lote, no descanso real.
  for (const s of sessions) {
    for (const we of s.workout_exercises) {
      const times = we.workout_sets
        .filter((x) => x.completed && x.completed_at)
        .map((x) => new Date(x.completed_at as string).getTime())
        .sort((a, b) => a - b);
      for (let i = 1; i < times.length; i++) {
        const gap = times[i] - times[i - 1];
        if (gap >= floor && gap <= cap) {
          sum += gap;
          n++;
        }
      }
    }
  }
  return { avgSec: n ? Math.round(sum / n / 1000) : null, samples: n };
}

