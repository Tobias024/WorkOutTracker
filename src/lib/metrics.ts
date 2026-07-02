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

/** Agrupa por clave ISO de fecha (YYYY-MM-DD). */
export function dateKey(iso: string): string {
  return iso.slice(0, 10);
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

/** Cantidad de días distintos con sesión, agrupados por semana (timestamp del lunes). */
function visitsByWeek(sessions: { created_at: string }[]): Map<number, Set<string>> {
  const map = new Map<number, Set<string>>();
  for (const s of sessions) {
    const wk = weekStart(new Date(s.created_at)).getTime();
    const set = map.get(wk) ?? new Set<string>();
    set.add(dateKey(s.created_at));
    map.set(wk, set);
  }
  return map;
}

/**
 * Racha en semanas según el plan semanal. Una semana "cumple" si tuvo al menos
 * `plannedCount` días distintos con sesión. Cuenta semanas consecutivas hacia
 * atrás desde la última semana completa; suma 1 si la semana en curso ya cumplió.
 * La semana en curso sin cumplir todavía NO rompe la racha (recuperable).
 */
export function weeklyStreak(
  sessions: { created_at: string }[],
  plannedCount: number,
): number {
  if (plannedCount <= 0) return 0;
  const byWeek = visitsByWeek(sessions);
  const met = (wkMs: number) => (byWeek.get(wkMs)?.size ?? 0) >= plannedCount;

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
 * Cumplimiento del mes de `ref`: cuenta los días planificados (según
 * plannedWeekdays) desde el 1° hasta hoy, y cuántos de esos tienen sesión.
 * Los días futuros no entran en el denominador.
 */
export function monthlyCompliance(
  sessions: { created_at: string }[],
  plannedWeekdays: number[],
  ref: Date,
): Compliance {
  const planned = new Set(plannedWeekdays);
  const sessionDays = new Set(sessions.map((s) => dateKey(s.created_at)));
  const todayKey = dateKey(ref.toISOString());
  const year = ref.getFullYear();
  const month = ref.getMonth();
  const daysInMonth = new Date(year, month + 1, 0).getDate();

  let plannedDays = 0;
  let completedDays = 0;
  for (let d = 1; d <= daysInMonth; d++) {
    const date = new Date(year, month, d);
    const key = dateKey(date.toISOString());
    if (key > todayKey) break; // no contar el futuro
    if (!planned.has(date.getDay())) continue;
    plannedDays++;
    if (sessionDays.has(key)) completedDays++;
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
