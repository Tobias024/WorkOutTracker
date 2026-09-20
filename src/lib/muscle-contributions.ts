// SPDX-License-Identifier: AGPL-3.0-only
// Capa de contribución muscular (atribución de volumen por grupo).
//
// El peso por serie es BINARIO, no un gradiente:
//   directo (motor primario)   = 1.0
//   indirecto (secundario)     = 0.5
//
// Por qué binario y no fracciones finas por ejercicio: Pelland et al. (Sports
// Medicine 2026, 67 estudios / 2058 sujetos) es la única meta-regresión que puso
// a prueba esquemas de conteo — comparó indirectas a 1.0 ("total"), 0.5
// ("fractional") y 0 ("direct"), y la de 0.5 tuvo la evidencia relativa más
// fuerte. Y Vigotsky et al. (Sports Medicine 2022) muestra que la amplitud de
// EMG NO es un predictor validado de hipertrofia, así que afinar un 0.3 contra
// un 0.4 por ejercicio es precisión inventada. Versiones anteriores de este
// archivo lo hacían: además de no tener sustento, dejaban el peso curado (0.3)
// POR DEBAJO del fallback genérico (0.35), o sea que curar un ejercicio a mano
// lo volvía más estricto que no curarlo.
//
// Resuelve la contribución de un ejercicio a cada GRUPO-APP con esta precedencia:
//   1. override por slug (los ejercicios de la rutina) → membresía curada
//   2. derivado de primary/secondary de free-exercise-db
// En ambos casos se aplica el SPLIT del deltoides: `shoulders` (un único músculo
// en el dataset) se reparte en anterior/lateral/posterior según name+force.
//
// La clave de grupo es la misma cadena que los músculos base en inglés
// (chest, lats, …) más las 3 cabezas del deltoides; el español lo pone muscleEs().
// Nada de esto vive en la DB: es 100% TS, como el resto de las métricas.

import type { Exercise } from "@/lib/types";

export const FRONT_DELTS = "front delts";
export const SIDE_DELTS = "side delts";
export const REAR_DELTS = "rear delts";

/** Motor primario del movimiento. */
export const DIRECT = 1;
/** Músculo secundario. Único peso indirecto: ver el cabezal (Pelland 2026). */
export const INDIRECT = 0.5;

export type Contribution = { muscle: string; weight: number };

type ExLike = Pick<
  Exercise,
  "slug" | "name" | "force" | "mechanic" | "primary_muscles" | "secondary_muscles"
>;

// ── Split del deltoides (shoulders → cabeza) ─────────────────────────────────

const isRow = (n: string) => /\brow\b/.test(n);
/** Empuje vertical de hombro (recluta deltoide lateral como secundario). */
const isVerticalPress = (n: string) =>
  /press|military|overhead|\bjerk\b|arnold/.test(n);

/**
 * Deriva la cabeza del deltoides desde `name` (+ si es un remo con shoulders
 * secundario). Prioridad: posterior > lateral > anterior > (default anterior).
 * `role` distingue el caso "remo con shoulders secundario" → posterior.
 */
export function deltoidHead(ex: ExLike, role: "primary" | "secondary"): string {
  const n = (ex.name ?? "").toLowerCase();
  // 1. Posterior
  if (
    /\brear\b|reverse fly|reverse flye|rear delt|rear lateral|face pull|band pull apart|reverse machine|external rotation|bent[- ]over.*(raise|lateral)/.test(
      n,
    ) ||
    (role === "secondary" && isRow(n))
  )
    return REAR_DELTS;
  // 2. Lateral
  if (/lateral raise|side lateral|side raise|\bupright\b|scaption|deltoid raise|cuban/.test(n))
    return SIDE_DELTS;
  // 3. Anterior (todo empuje vertical)
  if (/press|military|overhead|push press|\bjerk\b|arnold|front raise|front .*raise/.test(n))
    return FRONT_DELTS;
  // 4. Default / ambiguo (circles, stretches, "shoulder raise" sin más).
  return FRONT_DELTS;
}

/** Mapea un músculo base a su grupo-app, aplicando el split de deltoides. */
export function baseToGroup(
  muscle: string,
  ex: ExLike,
  role: "primary" | "secondary",
): string {
  return muscle === "shoulders" ? deltoidHead(ex, role) : muscle;
}

// ── Overrides por slug (sólo catálogo global) ───────────────────────────────
// Declaran MEMBRESÍA (qué músculo es directo y cuál indirecto), no pesos: el
// peso lo pone el modelo binario de arriba.
//
// Acá quedan únicamente filas del catálogo de free-exercise-db, que tienen
// `created_by` null: no las puede corregir nadie desde la app, así que su
// curación tiene que vivir en el código.
//
// Los ejercicios custom del usuario NO están más acá. Estaban porque nacieron
// con `secondary_muscles` vacío, y eso dejaba a la app con dos verdades: las
// métricas leían el override y la ficha leía la fila cruda. Ahora la fila dice
// lo mismo que decía el override (`scripts/backfill-muscles.ts`), así que el
// override sobraba — y encima le ganaba a lo que el usuario editara desde la
// app, que era la forma de que "Editar músculos" no hiciera nada.

const EX = (direct: string[], indirect: string[] = []): Contribution[] => [
  ...direct.map((muscle) => ({ muscle, weight: DIRECT })),
  ...indirect.map((muscle) => ({ muscle, weight: INDIRECT })),
];

export const EXERCISE_OVERRIDES: Record<string, Contribution[]> = {
  // Pecho
  Dumbbell_Flyes: EX(["chest"], [FRONT_DELTS]),
  // Hombros
  Dumbbell_Shoulder_Press: EX([FRONT_DELTS], [SIDE_DELTS, "triceps"]),
  // Espalda
  "One-Arm_Dumbbell_Row": EX(["middle back"], ["lats", "biceps", REAR_DELTS]),
  // Bíceps
  Barbell_Curl: EX(["biceps"], ["forearms"]),
  // Tríceps
  "EZ-Bar_Skullcrusher": EX(["triceps"], ["forearms"]),
  // Piernas
  Smith_Machine_Calf_Raise: EX(["calves"]),
  // Abdominales
  "Bent-Knee_Hip_Raise": EX(["abdominals"]),
  Flat_Bench_Lying_Leg_Raise: EX(["abdominals"]),
};

// ── Resolver de contribución (modelo de VOLUMEN) ─────────────────────────────

const accMax = (m: Map<string, number>, k: string, w: number) =>
  m.set(k, Math.max(m.get(k) ?? 0, w));

/**
 * Contribución del ejercicio a cada grupo-app (1.0 directo / 0.5 indirecto).
 * Precedencia override → derivado; con split de deltoides. La clave `muscle` es
 * el grupo-app (inglés + las 3 cabezas del deltoides).
 */
export function muscleContributions(ex: ExLike): Contribution[] {
  const ov = EXERCISE_OVERRIDES[ex.slug];
  if (ov) return ov;

  const acc = new Map<string, number>();
  for (const m of ex.primary_muscles ?? []) {
    const g = baseToGroup(m, ex, "primary");
    accMax(acc, g, DIRECT);
    // Empuje vertical con hombro primario: el deltoide lateral es secundario
    // (solo presses reales; no elevaciones frontales ni ambiguos).
    if (g === FRONT_DELTS && isVerticalPress((ex.name ?? "").toLowerCase()))
      accMax(acc, SIDE_DELTS, INDIRECT);
  }
  for (const m of ex.secondary_muscles ?? [])
    accMax(acc, baseToGroup(m, ex, "secondary"), INDIRECT);

  return [...acc.entries()].map(([muscle, weight]) => ({ muscle, weight }));
}

// ── Display: la MISMA capa que las métricas ─────────────────────────────────
//
// Hasta acá la app tenía dos verdades sobre qué entrena un ejercicio. Las
// métricas usaban `muscleContributions`, pero cada badge, la ficha del
// ejercicio, los filtros del catálogo y el export leían `primary_muscles[0]`
// crudo de la base. Como 22 de los ejercicios del usuario son custom con
// `secondary_muscles` VACÍO, la ficha mostraba bastante menos de lo que el
// volumen contaba — y para los hombros mostraba otra cosa directamente
// ("Hombros" en la card, "Deltoides lateral" en las métricas).
//
// Todo lo que se muestre tiene que salir de acá.

const byWeight = (ex: ExLike, w: number) =>
  muscleContributions(ex)
    .filter((c) => c.weight === w)
    .map((c) => c.muscle);

/** Motores primarios del ejercicio (grupo-app). */
export function directMuscles(ex: ExLike): string[] {
  return byWeight(ex, DIRECT);
}

/** Músculos que participan sin ser el motor (grupo-app). */
export function indirectMuscles(ex: ExLike): string[] {
  return byWeight(ex, INDIRECT);
}

/**
 * Titular para los badges de una línea. `null` si el ejercicio no tiene ningún
 * músculo resuelto (cardio sin primario, una fila del dataset incompleta).
 */
export function primaryMuscle(ex: ExLike): string | null {
  return directMuscles(ex)[0] ?? null;
}

/** ¿El ejercicio trabaja este grupo-app, directa o indirectamente? */
export function worksMuscle(ex: ExLike, muscle: string): boolean {
  return muscleContributions(ex).some((c) => c.muscle === muscle);
}
