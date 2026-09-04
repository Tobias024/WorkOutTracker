// SPDX-License-Identifier: AGPL-3.0-only
// Traducción del vocabulario controlado de free-exercise-db a español.
// Los nombres de ejercicio quedan en inglés (del dataset).

export const MUSCLES_ES: Record<string, string> = {
  abdominals: "Abdominales",
  abductors: "Abductores",
  adductors: "Aductores",
  biceps: "Bíceps",
  calves: "Pantorrillas",
  chest: "Pecho",
  forearms: "Antebrazos",
  glutes: "Glúteos",
  hamstrings: "Isquiotibiales",
  lats: "Dorsales",
  "lower back": "Espalda baja",
  // El vocabulario de free-exercise-db parte la espalda alta en dos: `traps`
  // es SOLO el trapecio superior (sus 15 ejercicios primarios son shrugs,
  // cleans, snatches y remo al mentón) y el trapecio medio/bajo cae dentro de
  // `middle back` junto a los romboides. Con las etiquetas genéricas de antes
  // ("Trapecios" / "Espalda media") la app parecía decir que no entrenabas nada
  // de trapecio cuando en realidad el remo sí trabaja el medio — solo que
  // contado en la otra fila.
  "middle back": "Espalda media y trapecio medio",
  neck: "Cuello",
  quadriceps: "Cuádriceps",
  shoulders: "Hombros",
  // Cabezas del deltoides (grupo derivado del split de "shoulders" para métricas).
  "front delts": "Deltoides anterior",
  "side delts": "Deltoides lateral",
  "rear delts": "Deltoides posterior",
  traps: "Trapecio superior",
  triceps: "Tríceps",
};

/**
 * Músculos para los chips de filtro del catálogo: son los valores REALES que
 * aparecen en `primary_muscles` (incluye "shoulders"). NO incluye las cabezas
 * de deltoides, que son un grupo DERIVADO para métricas, no un tag de datos —
 * filtrar por ellas no matchearía ninguna fila.
 */
export const MUSCLE_FILTERS: string[] = [
  "abdominals", "abductors", "adductors", "biceps", "calves", "chest",
  "forearms", "glutes", "hamstrings", "lats", "lower back", "middle back",
  "neck", "quadriceps", "shoulders", "traps", "triceps",
];

/** Cómo se mide una serie. Ver `MetricKind` en types.ts y la migración 0033. */
export const METRIC_KIND_ES: Record<string, string> = {
  reps_weight: "Reps × peso",
  time: "Tiempo",
  time_load: "Tiempo + carga",
  distance_time: "Distancia + tiempo",
};

export const EQUIPMENT_ES: Record<string, string> = {
  "body only": "Peso corporal",
  machine: "Máquina",
  "other": "Otro",
  cable: "Polea",
  barbell: "Barra",
  dumbbell: "Mancuerna",
  bands: "Bandas",
  kettlebells: "Kettlebell",
  "medicine ball": "Balón medicinal",
  "exercise ball": "Pelota de ejercicio",
  "e-z curl bar": "Barra Z",
  "foam roll": "Rodillo",
};

export const CATEGORY_ES: Record<string, string> = {
  strength: "Fuerza",
  stretching: "Elongación",
  plyometrics: "Pliometría",
  strongman: "Strongman",
  powerlifting: "Powerlifting",
  cardio: "Cardio",
  "olympic weightlifting": "Halterofilia",
};

export const LEVEL_ES: Record<string, string> = {
  beginner: "Principiante",
  intermediate: "Intermedio",
  expert: "Avanzado",
};

export const FORCE_ES: Record<string, string> = {
  push: "Empuje",
  pull: "Tracción",
  static: "Estático",
};

export const MECHANIC_ES: Record<string, string> = {
  compound: "Compuesto",
  isolation: "Aislamiento",
};

const lookup = (map: Record<string, string>, key?: string | null) =>
  key ? map[key.toLowerCase()] ?? key : "";

export const muscleEs = (k?: string | null) => lookup(MUSCLES_ES, k);
export const equipmentEs = (k?: string | null) => lookup(EQUIPMENT_ES, k);
export const categoryEs = (k?: string | null) => lookup(CATEGORY_ES, k);
export const levelEs = (k?: string | null) => lookup(LEVEL_ES, k);
export const forceEs = (k?: string | null) => lookup(FORCE_ES, k);
export const mechanicEs = (k?: string | null) => lookup(MECHANIC_ES, k);
