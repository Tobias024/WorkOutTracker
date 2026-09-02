// SPDX-License-Identifier: AGPL-3.0-only
import type { HistorySession } from "@/hooks/useHistory";
import type { Exercise, SleepLog, BodyWeightLog, BodyMeasurement } from "@/lib/types";
import {
  estimate1RM,
  sessionDate,
  weekStart,
  isCountableSet,
  isHardSet,
  landmarkFor,
  rirOf,
  muscleContributions,
  calendarDaysBetween,
  trainsMuscle,
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

/**
 * Sets efectivos por músculo en una sesión, usando la MISMA capa de contribución
 * que el volumen (`muscleContributions`: overrides curados + split de deltoides).
 * Antes leía `secondary_muscles` crudos, que en los ejercicios custom están
 * vacíos → un secundario curado (ej. antebrazos en un curl custom) recibía cero.
 */
function sessionMuscleSets(
  s: HistorySession,
  exMap: Map<string, Exercise>,
): Map<string, number> {
  const per = new Map<string, number>();
  for (const we of s.workout_exercises) {
    const ex = exMap.get(we.exercise_id);
    if (!ex) continue;
    // El cardio no cuenta como trabajo muscular: correr tiene `quadriceps` de
    // primario en el dataset, así que sin esto una corrida resetearía la
    // recencia de cuádriceps. Los isométricos sí cuentan (una plancha entrena
    // el abdomen), aunque no sumen volumen de fuerza.
    if (!trainsMuscle(ex.metric_kind)) continue;
    const n = we.workout_sets.filter(isCountableSet).length;
    if (!n) continue;
    for (const c of muscleContributions(ex))
      per.set(c.muscle, (per.get(c.muscle) ?? 0) + n * c.weight);
  }
  return per;
}

/** Umbral de contribución ponderada (≈1 serie efectiva) para considerar un
 *  músculo "entrenado" ese día e ignorar participación incidental. */
const RECOVERY_MIN_SETS = 1;

/**
 * Los pesos son 1.0 / 0.5, así que las sumas caen en binarios exactos y el
 * épsilon es defensivo, no obligatorio. Se deja igual: la versión anterior usaba
 * 0.3 y `3 * 0.3` da 0.8999999999999999, o sea que un umbral de 0.9 tampoco
 * habría alcanzado. Comparar flotantes acumulados contra un entero sin margen es
 * la clase de bug que ya mordió una vez.
 */
const EPSILON = 1e-9;

/**
 * Grupos que la card de recencia siembra siempre, aunque nunca se hayan
 * entrenado — un grupo en cero es justamente lo que más conviene ver, y antes
 * simplemente no aparecía. Se dejan afuera `neck`, `abductors` y `adductors`
 * (especialidad, no parte de un programa de hipertrofia típico) y `shoulders`
 * (inalcanzable: `baseToGroup` siempre lo reescribe a una cabeza del deltoides).
 */
const RECENCY_GROUPS = [
  "chest", "lats", "middle back", "lower back", "traps",
  "front delts", "side delts", "rear delts",
  "biceps", "triceps", "forearms",
  "quadriceps", "hamstrings", "glutes", "calves", "abdominals",
];

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
  /** null = nunca registró trabajo. NO es lo mismo que "hace mucho". */
  days: number | null;
}

export function daysSinceLastByMuscle(
  sessions: HistorySession[],
  exMap: Map<string, Exercise>,
  now: number = Date.now(),
): MuscleDays[] {
  const last = new Map<string, number>();
  for (const s of sessions) {
    const t = ms(s);
    // Cuenta el músculo (directo o indirecto) solo si superó el umbral de sets
    // ponderados ese día — así el trabajo compuesto real cuenta (2 series
    // indirectas ya llegan a 1.0), pero la participación incidental no.
    for (const [m, sets] of sessionMuscleSets(s, exMap)) {
      if (sets >= RECOVERY_MIN_SETS - EPSILON)
        last.set(m, Math.max(last.get(m) ?? 0, t));
    }
  }
  return RECENCY_GROUPS.map((muscle) => {
    const t = last.get(muscle);
    return { muscle, days: t == null ? null : calendarDaysBetween(t, now) };
  }).sort((a, b) => {
    // Los que nunca se entrenaron van primero: son la señal más fuerte.
    if (a.days == null || b.days == null) return (b.days == null ? 1 : 0) - (a.days == null ? 1 : 0);
    return b.days - a.days;
  });
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
    // Tiempo de las series que no aportan reps (cardio e isométricos). Se
    // descuenta del denominador: si no, una corrida de 20' infla los minutos con
    // numerador cero y la densidad se desploma sin que hayas entrenado peor.
    let noRepSeconds = 0;
    for (const we of s.workout_exercises)
      for (const set of we.workout_sets) {
        if (!isCountableSet(set)) continue;
        if (set.reps) reps += set.reps;
        else if (set.duration_seconds) noRepSeconds += set.duration_seconds;
      }
    const minutes = Math.max(0, s.duration_seconds - noRepSeconds) / 60;
    if (!minutes) continue;
    const a = agg.get(wk) ?? { reps: 0, min: 0 };
    a.reps += reps;
    a.min += minutes;
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

/** Ventana y mínimos de la tasa de cambio de peso (regresión sobre la media móvil). */
const RATE_WINDOW_DAYS = 28;
const RATE_MIN_POINTS = 4;
const RATE_MIN_SPAN_DAYS = 10;

/**
 * Tasa de cambio en %/semana = pendiente OLS de la media móvil de 7 días sobre
 * los últimos 28 días, dividida por el nivel actual de esa media.
 *
 * Antes se calculaba con el primer y el último punto CRUDO de toda la ventana
 * (120 días): dos mediciones sueltas — justo las que la card declara ruidosas
 * (±1-2 kg de agua/glucógeno) — y encima promediadas sobre 4 meses, o sea una
 * tasa histórica presentada como si fuera la actual. La pendiente de la línea
 * que se dibuja es lo que el usuario está mirando y lo que se puede accionar.
 *
 * null si no hay suficientes mediciones recientes o el tramo es muy corto: sin
 * eso la pendiente es ruido, y es preferible no mostrar número.
 */
function trendRatePctPerWeek(
  ma: { t: number; v: number }[],
  ref: number,
): number | null {
  const win = ma.filter((p) => p.t >= ref - RATE_WINDOW_DAYS * DAY);
  if (win.length < RATE_MIN_POINTS) return null;
  const spanDays = (win[win.length - 1].t - win[0].t) / DAY;
  if (spanDays < RATE_MIN_SPAN_DAYS) return null;

  // x en días desde el primer punto de la ventana; y en kg de la media móvil.
  const n = win.length;
  const xs = win.map((p) => (p.t - win[0].t) / DAY);
  const ys = win.map((p) => p.v);
  const mx = xs.reduce((a, x) => a + x, 0) / n;
  const my = ys.reduce((a, y) => a + y, 0) / n;
  let num = 0;
  let den = 0;
  for (let i = 0; i < n; i++) {
    num += (xs[i] - mx) * (ys[i] - my);
    den += (xs[i] - mx) ** 2;
  }
  if (den === 0) return null;
  const level = ys[n - 1]; // nivel actual de la media móvil
  if (!level) return null;
  const pctPerWeek = ((num / den) * 7 * 100) / level;
  return Math.round(pctPerWeek * 100) / 100;
}

/** Media móvil de 7 días + tasa %/semana a partir de puntos {t, w} ordenados. */
function weightTrendFromRaw(
  raw: { t: number; w: number }[],
  ref: number = Date.now(),
): BwSeries {
  if (raw.length === 0)
    return { points: [], ma: [], ratePctPerWeek: null, last: null };
  const points = raw.map((r) => ({ label: weekLabel(r.t), value: r.w }));
  // Media móvil trailing de 7 días en cada medición (con su timestamp, que la
  // regresión necesita: los registros son irregulares, no una serie diaria).
  const maRaw = raw.map((r) => {
    const from = r.t - 7 * DAY;
    const win = raw.filter((x) => x.t >= from && x.t <= r.t);
    return { t: r.t, v: win.reduce((a, x) => a + x.w, 0) / win.length };
  });
  const ma = maRaw.map((p) => ({
    label: weekLabel(p.t),
    value: Math.round(p.v * 10) / 10,
  }));
  return {
    points,
    ma,
    ratePctPerWeek: trendRatePctPerWeek(maRaw, ref),
    last: raw[raw.length - 1].w,
  };
}

/** Peso corporal (solo sesiones): puntos crudos + media móvil + tasa %/semana. */
export function bodyweightSeries(
  sessions: HistorySession[],
  days = 120,
): BwSeries {
  const cutoff = Date.now() - days * DAY;
  const raw = sessions
    .filter((s) => s.body_weight_kg != null && ms(s) >= cutoff)
    .map((s) => ({ t: ms(s), w: s.body_weight_kg as number }))
    .sort((a, b) => a.t - b.t);
  return weightTrendFromRaw(raw);
}

const dayKeyOf = (t: number): string => {
  const d = new Date(t);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
};

/** Descarta pesos claramente erróneos (fat-finger) para que no abran la escala. */
const isPlausibleWeight = (w: number): boolean =>
  Number.isFinite(w) && w >= 25 && w <= 400;

/**
 * Tendencia de peso mergeando los logs diarios (`body_weight_logs`) con el
 * body_weight_kg de las sesiones. Dedup por día calendario; el log gana sobre
 * la sesión (es el registro explícito). Así no se pierde la historia previa.
 */
export function bodyWeightTrend(
  logs: BodyWeightLog[],
  sessions: HistorySession[],
  days = 120,
): BwSeries {
  const cutoff = Date.now() - days * DAY;
  const byDay = new Map<string, { t: number; w: number }>();
  for (const s of sessions) {
    if (s.body_weight_kg == null || !isPlausibleWeight(s.body_weight_kg)) continue;
    const t = ms(s);
    if (t < cutoff) continue;
    byDay.set(dayKeyOf(t), { t, w: s.body_weight_kg });
  }
  for (const l of logs) {
    const w = Number(l.weight_kg);
    if (!isPlausibleWeight(w)) continue;
    const t = new Date(l.weighed_on + "T12:00:00").getTime();
    if (t < cutoff) continue;
    byDay.set(l.weighed_on, { t, w }); // log pisa a la sesión
  }
  const raw = [...byDay.values()].sort((a, b) => a.t - b.t);
  return weightTrendFromRaw(raw);
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

/** Sueño de los últimos `days` días de calendario (barras) + promedio. */
export function sleepSeries(
  rows: SleepLog[],
  days = 14,
): { points: Pt[]; avg: number | null } {
  // Ventana real por FECHA (no las últimas N filas): así el conteo coincide con
  // lo registrado en las 2 semanas y no arrastra logs viejos del historial.
  const cutoff = new Date();
  cutoff.setHours(0, 0, 0, 0);
  cutoff.setDate(cutoff.getDate() - (days - 1));
  const cutoffKey = `${cutoff.getFullYear()}-${String(cutoff.getMonth() + 1).padStart(2, "0")}-${String(cutoff.getDate()).padStart(2, "0")}`;
  // rows viene ordenado asc por slept_on ("YYYY-MM-DD" → comparación lexicográfica ok).
  const recent = rows.filter((r) => r.slept_on >= cutoffKey);
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
  now: number = Date.now(),
): Readiness[] {
  const lastAt = new Map<string, number>();
  for (const s of sessions) {
    const t = ms(s);
    for (const [mu, sets] of sessionMuscleSets(s, exMap)) {
      if (sets >= RECOVERY_MIN_SETS - EPSILON)
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
    const days = calendarDaysBetween(t, now);
    const mev = landmarkFor(mu).mev;
    const sets = hard.get(mu) ?? 0;
    // MEV 0 (ej. deltoide anterior, que se nutre de los press) → sin déficit.
    const lag = mev > 0 ? Math.max(0, Math.min(1, (mev - sets) / mev)) : 0;
    const recovery = Math.min(1, days / 3);
    out.push({ muscle: mu, days, lag, score: recovery * 0.6 + lag * 0.4 });
  }
  return out.sort((a, b) => b.score - a.score).slice(0, 3);
}

/** Descansos mínimos en la ventana para que el promedio signifique algo. */
const REST_MIN_SAMPLES = 5;

/**
 * Descanso medio entre series (segundos), MEDIDO: promedia el `rest_seconds`
 * que guarda el cronómetro de descanso por serie. Se ignoran nulos y outliers
 * (> cap minutos).
 *
 * Ventana móvil de `days` (no todo el historial): el promedio de por vida se
 * congela a los pocos meses y deja de responder a cualquier cambio de conducta.
 * Además ese corte deja afuera los `rest_seconds` viejos, medidos con la regla
 * anterior (se cerraban al COMPLETAR la serie siguiente, así que incluían su
 * ejecución y sobreestimaban el descanso ~20-45 s).
 *
 * avgSec = null con menos de REST_MIN_SAMPLES muestras: el descanso sólo se
 * guarda cuando hubo señal real de arranque de la serie siguiente, así que un
 * usuario puede tener pocas y un promedio de 2 no es un promedio.
 */
export function avgRestBetweenSets(
  sessions: HistorySession[],
  maxMin = 10,
  days = 30,
): { avgSec: number | null; samples: number } {
  let sum = 0;
  let n = 0;
  const capS = maxMin * 60;
  const cutoff = Date.now() - days * DAY;
  for (const s of sessions) {
    if (ms(s) < cutoff) continue;
    for (const we of s.workout_exercises) {
      for (const set of we.workout_sets) {
        const r = set.rest_seconds;
        if (r == null || r <= 0 || r > capS) continue;
        sum += r;
        n++;
      }
    }
  }
  return {
    avgSec: n >= REST_MIN_SAMPLES ? Math.round(sum / n) : null,
    samples: n,
  };
}

