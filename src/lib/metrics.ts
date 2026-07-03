import type { SetDrop, WorkoutSet } from "@/lib/types";

type SetLike = Pick<WorkoutSet, "reps" | "weight" | "drops">;

/** Bajadas efectivas de un set: las suyas propias, o un único par reps/peso si es una serie simple. */
export function effectiveDrops(s: SetLike): SetDrop[] {
  return s.drops && s.drops.length > 0
    ? s.drops
    : [{ reps: s.reps, weight: s.weight }];
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

export interface SessionSummary {
  volume: number;
  sets: number;
  topWeight: number;
}

export function summarizeSets(
  sets: (SetLike & Pick<WorkoutSet, "completed">)[],
): SessionSummary {
  const done = sets.filter((s) => s.completed);
  return {
    volume: totalVolume(done),
    sets: done.length,
    topWeight: done.reduce(
      (m, s) => Math.max(m, ...effectiveDrops(s).map((d) => d.weight ?? 0)),
      0,
    ),
  };
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
): number {
  const byWeek = visitsByWeek(sessions);
  const met = (wkMs: number) => {
    const plannedCount = resolvePlanned(wkMs).length;
    return plannedCount > 0 && (byWeek.get(wkMs)?.size ?? 0) >= plannedCount;
  };

  const thisWeek = weekStart(new Date());
  let count = 0;
  if (met(thisWeek.getTime())) count++;

  const cursor = new Date(thisWeek);
  cursor.setDate(cursor.getDate() - 7);
  while (met(cursor.getTime())) {
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
): Compliance {
  const sessionDays = new Set(sessions.map((s) => dateKey(sessionDate(s))));
  const today = new Date(ref);
  today.setHours(0, 0, 0, 0);

  let plannedDays = 0;
  let completedDays = 0;
  for (let i = 0; i < days; i++) {
    const date = new Date(today);
    date.setDate(date.getDate() - i);
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

/** Promedio de entrenamientos por semana desde la primera sesión hasta hoy.
 *  weeksElapsed se acota a mínimo 1 para no inflar el promedio en usuarios
 *  nuevos (ej. 2 sesiones en 3 días no debería mostrar "4.7/sem"). */
export function avgWeeklyWorkouts(sessions: SessionDateLike[]): number {
  if (sessions.length === 0) return 0;
  const earliest = Math.min(
    ...sessions.map((s) => new Date(sessionDate(s)).getTime()),
  );
  const weeksElapsed = Math.max(1, (Date.now() - earliest) / (7 * 86400000));
  return sessions.length / weeksElapsed;
}
