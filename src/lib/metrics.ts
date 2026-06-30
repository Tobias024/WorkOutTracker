import type { WorkoutSet } from "@/lib/types";

/** Volumen de un set = reps × peso (0 si falta alguno). */
export function setVolume(s: Pick<WorkoutSet, "reps" | "weight">): number {
  if (!s.reps || !s.weight) return 0;
  return s.reps * s.weight;
}

export function totalVolume(sets: Pick<WorkoutSet, "reps" | "weight">[]): number {
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
  sets: Pick<WorkoutSet, "reps" | "weight" | "completed">[],
): SessionSummary {
  const done = sets.filter((s) => s.completed);
  return {
    volume: totalVolume(done),
    sets: done.length,
    topWeight: done.reduce((m, s) => Math.max(m, s.weight ?? 0), 0),
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
