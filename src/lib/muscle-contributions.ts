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
//   1. override por slug (los 28 que el usuario entrena) → membresía curada
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

// ── Overrides por slug (los 28 ejercicios del usuario) ───────────────────────
// Declaran MEMBRESÍA (qué músculo es directo y cuál indirecto), no pesos: el
// peso lo pone el modelo binario de arriba. Siguen siendo necesarios porque 22
// de los 28 son custom en español con `secondary_muscles` VACÍO en la base — sin
// esto, un compuesto le asignaría todo el volumen al primario.

const EX = (direct: string[], indirect: string[] = []): Contribution[] => [
  ...direct.map((muscle) => ({ muscle, weight: DIRECT })),
  ...indirect.map((muscle) => ({ muscle, weight: INDIRECT })),
];

export const EXERCISE_OVERRIDES: Record<string, Contribution[]> = {
  // Pecho
  "hip5d-d1e1": EX(["chest"], ["triceps", FRONT_DELTS]), // Press banca con barra
  "hip5d-d1e2": EX(["chest"], [FRONT_DELTS, "triceps"]), // Press inclinado con mancuernas
  Dumbbell_Flyes: EX(["chest"], [FRONT_DELTS]),
  "hip5d-d1e4": EX(["chest"], ["triceps", FRONT_DELTS]), // Fondos en paralelas / asistidos
  // Hombros
  "hip5d-d4e1": EX([FRONT_DELTS], [SIDE_DELTS, "triceps"]), // Press militar con mancuernas
  Dumbbell_Shoulder_Press: EX([FRONT_DELTS], [SIDE_DELTS, "triceps"]),
  "hip5d-d4e3": EX([FRONT_DELTS], [SIDE_DELTS, "triceps"]), // Press Arnold
  "hip5d-d4e2": EX([SIDE_DELTS]), // Elevaciones laterales
  "hip5d-d4e4": EX([REAR_DELTS]), // Posterior en máquina (pájaros)
  // Face pull (custom): trabaja trapecio MEDIO/BAJO, que en el vocabulario de
  // free-exercise-db es `middle back` — no `traps`, que ahí significa trapecio
  // SUPERIOR (shrugs, cleans, remo al mentón). La fila inglesa del dataset
  // ("Face Pull") lo confirma: secondary = middle back.
  "hip5d-d2e4": EX([REAR_DELTS], ["middle back"]),
  // Espalda
  "hip5d-d2e1": EX(["lats"], ["biceps"]), // Jalón al pecho (polea alta)
  // Remo con barra: `middle back` directo YA ES el trapecio medio. Sumarle
  // `traps` además contaba dos veces el mismo tejido, y encima bajo la etiqueta
  // del trapecio superior, que el remo casi no entrena.
  "hip5d-d2e2": EX(["middle back"], ["lats", "biceps", REAR_DELTS]), // Remo con barra
  "hip5d-d2e3": EX(["middle back"], ["lats", "biceps"]), // Remo en polea baja
  "One-Arm_Dumbbell_Row": EX(["middle back"], ["lats", "biceps", REAR_DELTS]),
  // Bíceps
  "hip5d-d5e1": EX(["biceps"], ["forearms"]), // Curl con barra
  Barbell_Curl: EX(["biceps"], ["forearms"]),
  "hip5d-d5e5": EX(["biceps"]), // Curl banco Scott
  "hip5d-d5e3": EX(["biceps"], ["forearms"]), // Curl martillo con mancuernas
  // Tríceps
  "EZ-Bar_Skullcrusher": EX(["triceps"], ["forearms"]),
  "hip5d-d5e4": EX(["triceps"]), // Extensión de tríceps en polea
  // Piernas
  "hip5d-d3e2": EX(["quadriceps"], ["glutes"]), // Prensa
  "hip5d-d3e1": EX(["quadriceps"], ["glutes", "hamstrings", "lower back"]), // Sentadilla con barra
  "hip5d-d3e4": EX(["hamstrings"]), // Curl femoral en máquina
  "hip5d-d3e3": EX(["hamstrings"], ["glutes", "lower back"]), // Peso muerto rumano
  "hip5d-d3e5": EX(["calves"]), // Elevación de gemelos
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
