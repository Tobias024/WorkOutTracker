// SPDX-License-Identifier: AGPL-3.0-only
import type {
  MetricKind,
  SetDrop,
  TrainingProfile,
  WorkoutSet,
} from "@/lib/types";
import { goalParams } from "@/lib/goal-params";

type SetLike = Pick<WorkoutSet, "reps" | "weight" | "drops">;

/**
 * Bajadas efectivas de un set: las suyas propias, o un único par reps/peso si
 * es una serie simple. Una serie sin reps NI peso (por tiempo o distancia) no
 * tiene bajadas: devolver `[{reps: null, weight: null}]` sería un par fantasma
 * que todos los consumidores recorren — y `export-csv` llegaría a emitir una
 * fila vacía por él.
 */
export function effectiveDrops(s: SetLike): SetDrop[] {
  if (s.drops && s.drops.length > 0) return s.drops;
  if (s.reps == null && s.weight == null) return [];
  return [{ reps: s.reps, weight: s.weight }];
}

// ── Tipo de medición del ejercicio ──────────────────────────────────────────

/** Lleva carga en kg (el campo `weight` de la serie tiene sentido). */
export function isLoadTracked(kind: MetricKind): boolean {
  return kind === "reps_weight" || kind === "time_load";
}

/**
 * Cuenta como volumen de fuerza (series efectivas, MEV/MAV/MRV, tonelaje, 1RM).
 * Solo reps × peso: la evidencia de dosis-respuesta está medida en series de
 * entrenamiento de resistencia, así que meter minutos de cinta o segundos de
 * plancha en la misma cuenta compara cosas que no son comparables.
 */
export function countsForStrengthVolume(kind: MetricKind): boolean {
  return kind === "reps_weight";
}

/**
 * Estimula un músculo, aunque no sume volumen de fuerza. Los isométricos sí
 * (una plancha entrena el abdomen); el cardio no — y esto importa: correr tiene
 * `quadriceps` como primario en free-exercise-db, así que sin este filtro una
 * corrida resetearía la recencia de cuádriceps.
 */
export function trainsMuscle(kind: MetricKind): boolean {
  return kind !== "distance_time";
}

/** RIR (reps en reserva) derivado de la columna rpe (rpe = 10 − rir). null si no cargado. */
export function rirOf(s: { rpe: number | null }): number | null {
  return s.rpe == null ? null : 10 - s.rpe;
}

/** Un set "cuenta" para las métricas si está completado y no es calentamiento. */
export function isCountableSet(s: {
  completed: boolean;
  is_warmup?: boolean | null;
}): boolean {
  return s.completed && !s.is_warmup;
}

/**
 * "Hard set" (serie efectiva): set contable, con suficientes reps y suficiente
 * cercanía al fallo. Los dos umbrales dependen del objetivo (ver goal-params.ts):
 * una serie de 3 reps pesadas es volumen efectivo para fuerza y no para
 * hipertrofia, y un RIR 4 rinde para fuerza pero se queda corto para crecer.
 * Sin perfil cargado se usa hipertrofia, que son los valores históricos
 * (reps ≥ 5, RIR ≤ 3) — así quien nunca eligió objetivo no ve cambiar sus números.
 *
 * Una serie por tiempo o distancia no tiene reps, así que queda afuera — y debe
 * quedar afuera: no es volumen de fuerza (ver countsForStrengthVolume). Se
 * chequea `reps == null` explícito en vez de dejar que `(null ?? 0) < min` lo
 * resuelva de casualidad.
 */
export function isHardSet(
  s: {
    completed: boolean;
    is_warmup?: boolean | null;
    reps: number | null;
    rpe: number | null;
  },
  profile?: TrainingProfile | null,
): boolean {
  if (!isCountableSet(s)) return false;
  if (s.reps == null) return false;
  const p = goalParams(profile);
  if (s.reps < p.hardSetMinReps) return false;
  const rir = rirOf(s);
  return rir == null || rir <= p.hardSetMaxRir;
}

// El reparto fraccional por músculo vive ahora en la capa de contribución
// (overrides por slug + split de deltoides + fallback). Se re-exporta acá para
// no cambiar los imports existentes.
export { muscleContributions, baseToGroup } from "./muscle-contributions";

// Los landmarks de volumen (MEV/MAV/MRV) dejaron de variar por músculo y pasaron
// a depender del OBJETIVO: viven en goal-params.ts junto al resto de los
// umbrales por perfil. Se re-exportan acá para no cambiar los imports.
export { landmarkFor, GOAL_LANDMARKS, type Landmark } from "./goal-params";

/**
 * Delta de un valor entre el período actual y el anterior (semana o mes).
 * `valueOf` recibe el subconjunto de sesiones de cada ventana. deltaPct = null
 * si el período previo fue 0 (no hay base de comparación).
 */
export function periodDelta<T extends SessionDateLike>(
  sessions: T[],
  valueOf: (subset: T[]) => number,
  period: "week" | "month",
): { current: number; previous: number; deltaPct: number | null } {
  const now = new Date();
  let curStart: Date;
  let prevStart: Date;
  if (period === "week") {
    curStart = weekStart(now);
    prevStart = new Date(curStart);
    prevStart.setDate(prevStart.getDate() - 7);
  } else {
    curStart = new Date(now.getFullYear(), now.getMonth(), 1);
    prevStart = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  }
  const inRange = (s: T, start: Date, end: Date) => {
    const d = new Date(sessionDate(s));
    return d >= start && d < end;
  };
  const cur = valueOf(sessions.filter((s) => inRange(s, curStart, now)));
  const prev = valueOf(sessions.filter((s) => inRange(s, prevStart, curStart)));
  const deltaPct = prev > 0 ? ((cur - prev) / prev) * 100 : null;
  return { current: cur, previous: prev, deltaPct };
}

/** Volumen de un set = suma de reps × peso de cada bajada (0 si falta alguno). */
export function setVolume(s: SetLike): number {
  return effectiveDrops(s).reduce(
    (acc, d) => acc + (d.reps && d.weight ? d.reps * d.weight : 0),
    0,
  );
}

export function totalVolume(sets: SetLike[]): number {
  return sets.reduce((acc, s) => acc + setVolume(s), 0);
}

/** Estimación de 1RM (fórmula de Epley). */
export function estimate1RM(weight: number, reps: number): number {
  if (reps <= 0 || weight <= 0) return 0;
  if (reps === 1) return weight;
  return Math.round(weight * (1 + reps / 30));
}

/** Agrupa por clave de fecha local (YYYY-MM-DD). Usa getters locales, no UTC:
 *  slicear el ISO crudo desalinea el día para usuarios en UTC negativo que
 *  entrenan de noche (el timestamptz ya rodó al día UTC siguiente). */
export function dateKey(iso: string): string {
  const d = new Date(iso);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

/** Medianoche local a partir de una columna `date` de Postgres ("YYYY-MM-DD",
 *  sin hora). `new Date("YYYY-MM-DD")` sin la hora se interpreta como UTC, lo
 *  que reintroduciría el mismo desfase que dateKey corrige arriba. */
export function localMidnight(dateOnly: string): Date {
  return new Date(`${dateOnly}T00:00:00`);
}

/**
 * Días CALENDARIO entre dos instantes, en zona local. `Math.floor(ms / DAY)`
 * cuenta períodos de 24 h, que no es lo mismo: entrenaste el lunes 20:00 y mirás
 * el miércoles 08:00 → 36 h → diría "1 día" cuando pasaron 2. Se comparan
 * medianoches locales. `round` (y no `floor`) porque un día con cambio de horario
 * dura 23 o 25 h y arruinaría la división exacta.
 */
export function calendarDaysBetween(
  from: number | string | Date,
  to: number | string | Date,
): number {
  const a = new Date(from);
  const b = new Date(to);
  a.setHours(0, 0, 0, 0);
  b.setHours(0, 0, 0, 0);
  return Math.round((b.getTime() - a.getTime()) / 86400000);
}

/** Inicio de semana (lunes) para una fecha dada. */
export function weekStart(d: Date): Date {
  const date = new Date(d);
  const day = (date.getDay() + 6) % 7; // lunes = 0
  date.setHours(0, 0, 0, 0);
  date.setDate(date.getDate() - day);
  return date;
}

/** Índice de masa corporal. */
export function bmi(heightCm: number, weightKg: number): number {
  const heightM = heightCm / 100;
  return weightKg / (heightM * heightM);
}

export type BmiCategory = "bajo peso" | "normal" | "sobrepeso" | "obesidad";

export function bmiCategory(value: number): BmiCategory {
  if (value < 18.5) return "bajo peso";
  if (value < 25) return "normal";
  if (value < 30) return "sobrepeso";
  return "obesidad";
}

/** Datos mínimos para ubicar una sesión en el tiempo. */
export type SessionDateLike = { created_at: string; started_at?: string | null };

/** Fecha efectiva de una sesión: la de inicio si está (editable a mano), si no
 *  la de creación. Todas las métricas de fecha usan esto, así editar el inicio
 *  de una sesión pasada la reubica en el gráfico/calendario. */
export function sessionDate(s: SessionDateLike): string {
  return s.started_at ?? s.created_at;
}

/** Fecha (ms local, medianoche) de la primera sesión; null si no hay sesiones. */
export function firstSessionDate(sessions: SessionDateLike[]): Date | null {
  if (sessions.length === 0) return null;
  const earliest = Math.min(
    ...sessions.map((s) => new Date(sessionDate(s)).getTime()),
  );
  const d = new Date(earliest);
  d.setHours(0, 0, 0, 0);
  return d;
}

export interface WeeklyStats {
  /** Valor de la semana en curso (parcial, "hasta ahora"). */
  current: number;
  /** Última y penúltima semana ANTERIOR (pasada, ya terminada), o null. */
  lastCompleted: number | null;
  prevCompleted: number | null;
  /** % de la última semana anterior vs la previa (null si no hay base). */
  deltaPct: number | null;
  /** Promedio del valor sobre todas las semanas anteriores con datos. */
  avgCompleted: number;
  completedCount: number;
}

/**
 * Estadísticas semanales de una métrica, distinguiendo la semana en curso de las
 * semanas anteriores (pasadas, ya terminadas). `valueOf` calcula la métrica para
 * las sesiones de una semana. Se consideran todas las semanas pasadas con al
 * menos una sesión, sin importar si se alcanzó el plan.
 */
export function weeklyMetricStats<T extends SessionDateLike>(
  sessions: T[],
  valueOf: (weekSessions: T[]) => number,
): WeeklyStats {
  const curMs = weekStart(new Date()).getTime();
  const byWeek = new Map<number, T[]>();
  for (const s of sessions) {
    const wk = weekStart(new Date(sessionDate(s))).getTime();
    const arr = byWeek.get(wk);
    if (arr) arr.push(s);
    else byWeek.set(wk, [s]);
  }

  const current = valueOf(byWeek.get(curMs) ?? []);

  const completed: { wkMs: number; value: number }[] = [];
  for (const [wkMs, ws] of byWeek) {
    if (wkMs >= curMs) continue; // solo semanas anteriores (ya terminadas)
    completed.push({ wkMs, value: valueOf(ws) });
  }
  completed.sort((a, b) => b.wkMs - a.wkMs);

  const lastCompleted = completed[0]?.value ?? null;
  const prevCompleted = completed[1]?.value ?? null;
  const deltaPct =
    lastCompleted != null && prevCompleted != null && prevCompleted > 0
      ? ((lastCompleted - prevCompleted) / prevCompleted) * 100
      : null;
  const avgCompleted =
    completed.length > 0
      ? completed.reduce((a, c) => a + c.value, 0) / completed.length
      : 0;

  return {
    current,
    lastCompleted,
    prevCompleted,
    deltaPct,
    avgCompleted,
    completedCount: completed.length,
  };
}

/** Cantidad de días distintos con sesión, agrupados por semana (timestamp del lunes). */
function visitsByWeek(sessions: SessionDateLike[]): Map<number, Set<string>> {
  const map = new Map<number, Set<string>>();
  for (const s of sessions) {
    const iso = sessionDate(s);
    const wk = weekStart(new Date(iso)).getTime();
    const set = map.get(wk) ?? new Set<string>();
    set.add(dateKey(iso));
    map.set(wk, set);
  }
  return map;
}

/** Resuelve los días planificados (0=domingo…6=sábado) vigentes para la
 *  semana que arranca en `weekStartMs` (timestamp del lunes 00:00 local). */
export type PlanResolver = (weekStartMs: number) => number[];

/**
 * Racha en semanas según el plan semanal (resuelto por semana). Una semana
 * "cumple" si tuvo al menos tantos días distintos con sesión como días
 * planificados esa semana. Cuenta semanas consecutivas hacia atrás desde la
 * última semana completa; suma 1 si la semana en curso ya cumplió. La semana
 * en curso sin cumplir todavía NO rompe la racha (recuperable).
 */
export function weeklyStreak(
  sessions: SessionDateLike[],
  resolvePlanned: PlanResolver,
  planSince?: Date | null,
): number {
  const byWeek = visitsByWeek(sessions);
  const met = (wkMs: number) => {
    const plannedCount = resolvePlanned(wkMs).length;
    return plannedCount > 0 && (byWeek.get(wkMs)?.size ?? 0) >= plannedCount;
  };

  // No contar semanas anteriores a la vigencia del plan (nunca se prometieron).
  const sinceWeekMs = planSince ? weekStart(planSince).getTime() : -Infinity;
  const thisWeek = weekStart(new Date());
  let count = 0;
  if (met(thisWeek.getTime())) count++;

  const cursor = new Date(thisWeek);
  cursor.setDate(cursor.getDate() - 7);
  while (cursor.getTime() >= sinceWeekMs && met(cursor.getTime())) {
    count++;
    cursor.setDate(cursor.getDate() - 7);
  }
  return count;
}

export interface Compliance {
  plannedDays: number;
  completedDays: number;
  pct: number;
}

/**
 * Cumplimiento rolling de los últimos `days` días (incluye hoy): cuenta los
 * días planificados en esa ventana (según el plan vigente de cada semana,
 * plantilla u override) y cuántos tienen sesión.
 */
export function rollingCompliance(
  sessions: SessionDateLike[],
  resolvePlanned: PlanResolver,
  ref: Date,
  days = 30,
  planSince?: Date | null,
): Compliance {
  const sessionDays = new Set(sessions.map((s) => dateKey(sessionDate(s))));
  const today = new Date(ref);
  today.setHours(0, 0, 0, 0);
  // No contar días anteriores a la primera sesión NI a la vigencia del plan
  // (días previos a prometerlos no cuentan como fallados).
  const firstMs = firstSessionDate(sessions)?.getTime() ?? -Infinity;
  let sinceMs = -Infinity;
  if (planSince) {
    const p = new Date(planSince);
    p.setHours(0, 0, 0, 0);
    sinceMs = p.getTime();
  }
  const startMs = Math.max(firstMs, sinceMs);

  let plannedDays = 0;
  let completedDays = 0;
  for (let i = 0; i < days; i++) {
    const date = new Date(today);
    date.setDate(date.getDate() - i);
    if (date.getTime() < startMs) break; // antes del inicio del juicio
    const planned = new Set(resolvePlanned(weekStart(date).getTime()));
    if (!planned.has(date.getDay())) continue;
    plannedDays++;
    if (sessionDays.has(dateKey(date.toISOString()))) completedDays++;
  }
  const pct =
    plannedDays === 0 ? 0 : Math.round((completedDays / plannedDays) * 1000) / 10;
  return { plannedDays, completedDays, pct };
}

/** Promedio de duración (segundos) de las sesiones finalizadas. */
export function avgDuration(sessions: { duration_seconds: number | null }[]): number {
  const done = sessions.filter((s) => s.duration_seconds != null);
  if (!done.length) return 0;
  return done.reduce((acc, s) => acc + (s.duration_seconds ?? 0), 0) / done.length;
}

/** Promedio de entrenamientos por semana en las últimas 8 semanas (ventana
 *  móvil, no desde la primera sesión histórica): un promedio de toda la vida
 *  se diluye con historial viejo y no refleja el ritmo actual. Si el usuario
 *  tiene menos de 8 semanas de historia, promedia desde su primera sesión
 *  (weeksElapsed se acota a mínimo 1 para no inflar el número en usuarios
 *  nuevos, ej. 2 sesiones en 3 días no debería mostrar "4.7/sem"). */
export function avgWeeklyWorkouts(
  sessions: SessionDateLike[],
  ref: Date = new Date(),
): number {
  if (sessions.length === 0) return 0;
  const WINDOW_DAYS = 8 * 7;
  const earliest = Math.min(
    ...sessions.map((s) => new Date(sessionDate(s)).getTime()),
  );
  const windowStart = Math.max(earliest, ref.getTime() - WINDOW_DAYS * 86400000);
  const weeksElapsed = Math.max(1, (ref.getTime() - windowStart) / (7 * 86400000));
  const recent = sessions.filter(
    (s) => new Date(sessionDate(s)).getTime() >= windowStart,
  ).length;
  return recent / weeksElapsed;
}
