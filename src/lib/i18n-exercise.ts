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
  "middle back": "Espalda media",
  neck: "Cuello",
  quadriceps: "Cuádriceps",
  shoulders: "Hombros",
  traps: "Trapecios",
  triceps: "Tríceps",
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
