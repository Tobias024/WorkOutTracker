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

/**
 * Racha de días consecutivos con al menos una sesión, contando hacia atrás
 * desde hoy (o desde ayer, si hoy todavía no hay sesión registrada).
 */
export function streak(sessions: { created_at: string }[]): number {
  const days = new Set(sessions.map((s) => dateKey(s.created_at)));
  const cursor = new Date();
  if (!days.has(dateKey(cursor.toISOString()))) {
    cursor.setDate(cursor.getDate() - 1);
  }
  let count = 0;
  while (days.has(dateKey(cursor.toISOString()))) {
    count++;
    cursor.setDate(cursor.getDate() - 1);
  }
  return count;
}

/** Promedio de duración (segundos) de las sesiones finalizadas. */
export function avgDuration(sessions: { duration_seconds: number | null }[]): number {
  const done = sessions.filter((s) => s.duration_seconds != null);
  if (!done.length) return 0;
  return done.reduce((acc, s) => acc + (s.duration_seconds ?? 0), 0) / done.length;
}
