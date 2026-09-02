// Tipos de la base de datos (alineados con supabase/migrations).
// Se usan `type` (no `interface`) para que sean asignables a Record<string, unknown>,
// requisito de los genéricos de supabase-js.

export type FriendshipStatus = "pending" | "accepted";

export type Sex = "male" | "female";

/** @deprecated Reemplazado por training_profile + body_objective. Se conserva
 *  la columna y se sincroniza para no romper el scoreboard. */
export type Goal = "fuerza" | "hipertrofia" | "resistencia" | "perdida_grasa";

/** Perfil de entrenamiento: qué métricas de entrenamiento se priorizan. */
export type TrainingProfile = "fuerza" | "hipertrofia" | "resistencia";

/** Objetivo corporal: modificador de composición (énfasis de seguimiento). */
export type BodyObjective = "superavit" | "mantenimiento" | "deficit";

export type Profile = {
  id: string;
  username: string;
  display_name: string | null;
  avatar_url: string | null;
  sex: Sex | null;
  /** @deprecated usar training_profile + body_objective. */
  goal: Goal | null;
  training_profile: TrainingProfile | null;
  body_objective: BodyObjective | null;
  height_cm: number | null;
  weight_kg: number | null;
  /** Días de la semana que el usuario planea entrenar (0=domingo … 6=sábado). */
  planned_weekdays: number[];
  /** Desde cuándo rige la meta de días (para no juzgar días previos). */
  planned_since: string | null;
  created_at: string;
};

export type Exercise = {
  id: string;
  slug: string;
  name: string;
  category: string | null;
  equipment: string | null;
  primary_muscles: string[];
  secondary_muscles: string[];
  mechanic: string | null;
  level: string | null;
  force: string | null;
  instructions: string[];
  images: string[];
  is_custom: boolean;
  created_by: string | null;
  created_at: string;
};

export type Routine = {
  id: string;
  owner_id: string;
  name: string;
  description: string | null;
  share_code: string | null;
  created_at: string;
  updated_at: string;
};

export type RoutineExercise = {
  id: string;
  routine_id: string;
  exercise_id: string;
  position: number;
  target_sets: number | null;
  target_reps: number | null;
  notes: string | null;
  superset_group: number | null;
};

export type RoutineSet = {
  id: string;
  routine_exercise_id: string;
  set_number: number;
  target_reps: number | null;
  target_weight: number | null;
};

export type WorkoutSession = {
  id: string;
  user_id: string;
  routine_id: string | null;
  name: string;
  started_at: string | null;
  ended_at: string | null;
  duration_seconds: number | null;
  body_weight_kg: number | null;
  notes: string | null;
  created_at: string;
};

export type WorkoutExercise = {
  id: string;
  session_id: string;
  exercise_id: string;
  routine_exercise_id: string | null;
  position: number;
  replaced_from_exercise_id: string | null;
  notes: string | null;
};

export type SetDrop = {
  reps: number | null;
  weight: number | null;
};

export type WorkoutSet = {
  id: string;
  workout_exercise_id: string;
  set_number: number;
  reps: number | null;
  weight: number | null;
  rpe: number | null;
  comment: string | null;
  is_warmup: boolean;
  completed: boolean;
  /** Timestamp de cuándo se completó (trigger). */
  completed_at: string | null;
  /** Descanso tomado tras esta serie (segundos), medido con el cronómetro. */
  rest_seconds: number | null;
  /** Bajadas de peso sin descanso dentro de la misma serie. null = serie simple (usar reps/weight). */
  drops: SetDrop[] | null;
};

export type SleepLog = {
  user_id: string;
  slept_on: string;
  hours: number;
  created_at: string;
};

export type BodyWeightLog = {
  user_id: string;
  weighed_on: string;
  weight_kg: number;
  created_at: string;
};

export type BodyMeasurement = {
  id: string;
  user_id: string;
  measured_on: string;
  arm_cm: number | null;
  chest_cm: number | null;
  waist_cm: number | null;
  thigh_cm: number | null;
  bodyfat_pct: number | null;
  created_at: string;
};

/** Nota fija del usuario sobre un ejercicio, compartida entre todas sus rutinas. */
export type UserExerciseNote = {
  user_id: string;
  exercise_id: string;
  note: string;
  updated_at: string;
};

export type ExerciseSubstitution = {
  id: string;
  user_id: string;
  routine_exercise_id: string;
  substitute_exercise_id: string;
  created_at: string;
};

export type WeeklyPlanOverrideRow = {
  user_id: string;
  week_start: string;
  weekdays: number[];
  created_at: string;
};

export type PushSubscription = {
  id: string;
  user_id: string;
  endpoint: string;
  p256dh: string;
  auth: string;
  created_at: string;
};

export type Friendship = {
  id: string;
  requester_id: string;
  addressee_id: string;
  status: FriendshipStatus;
  created_at: string;
};

export type Invite = {
  code: string;
  inviter_id: string;
  expires_at: string | null;
  used_by: string | null;
  created_at: string;
};

export type RoutinePreview = {
  name: string;
  description: string | null;
  exercises: {
    name: string;
    image: string | null;
    target_sets: number | null;
    target_reps: number | null;
  }[];
};

// Filas devueltas por RPCs de scoreboard.
export type ScoreboardRow = {
  user_id: string;
  username: string;
  display_name: string | null;
  value: number;
};

export type FriendMetrics = {
  total_volume: number;
  session_count: number;
  frequency_days: number;
  hard_sets: number;
  total_reps: number;
  avg_duration: number;
  distinct_exercises: number;
  weekly_volume: { week: string; volume: number }[];
  top_prs: { exercise_id: string; weight: number; orm: number }[];
};

export type CommonExerciseMax = {
  exercise_id: string;
  my_weight: number;
  my_orm: number;
  friend_weight: number;
  friend_orm: number;
};

export type AchievementKind = "e1rm_pr" | "streak_milestone" | "volume_pr_week";

export type Achievement = {
  id: string;
  user_id: string;
  kind: AchievementKind;
  payload: Record<string, unknown>;
  created_at: string;
};

/** Fila devuelta por record_session_achievements (PR de e1RM para el modal). */
export type SessionPr = {
  exercise_id: string;
  weight: number;
  orm: number;
  prev_orm: number;
};

type Table<T extends Record<string, unknown>> = {
  Row: T;
  Insert: Partial<T>;
  Update: Partial<T>;
  Relationships: [];
};

export type Database = {
  public: {
    Tables: {
      profiles: Table<Profile>;
      exercises: Table<Exercise>;
      routines: Table<Routine>;
      routine_exercises: Table<RoutineExercise>;
      routine_sets: Table<RoutineSet>;
      workout_sessions: Table<WorkoutSession>;
      workout_exercises: Table<WorkoutExercise>;
      workout_sets: Table<WorkoutSet>;
      exercise_substitutions: Table<ExerciseSubstitution>;
      user_exercise_notes: Table<UserExerciseNote>;
      sleep_logs: Table<SleepLog>;
      body_weight_logs: Table<BodyWeightLog>;
      body_measurements: Table<BodyMeasurement>;
      friendships: Table<Friendship>;
      invites: Table<Invite>;
      push_subscriptions: Table<PushSubscription>;
      weekly_plan_overrides: Table<WeeklyPlanOverrideRow>;
      achievements: Table<Achievement>;
    };
    Views: Record<string, never>;
    Functions: {
      import_routine: {
        Args: { p_share_code: string };
        Returns: string;
      };
      accept_invite: {
        Args: { p_code: string };
        Returns: string;
      };
      create_invite: {
        Args: Record<string, never>;
        Returns: string;
      };
      preview_routine: {
        Args: { p_share_code: string };
        Returns: RoutinePreview;
      };
      scoreboard_stats: {
        Args: {
          p_metric: string;
          p_since: string;
          p_exercise_id?: string;
          p_sex?: string | null;
          p_until?: string | null;
          /** Zona IANA para agrupar por día local (default 'UTC' en la RPC). */
          p_tz?: string;
        };
        Returns: ScoreboardRow[];
      };
      detect_rank_overtakes: {
        Args: Record<string, never>;
        Returns: {
          user_id: string;
          kind: "overtaken" | "gained";
          other_name: string | null;
          other_id: string | null;
          new_rank: number;
        }[];
      };
      friend_metrics: {
        Args: { p_friend_id: string; p_since: string; p_tz?: string };
        Returns: FriendMetrics;
      };
      common_exercise_maxes: {
        Args: { p_friend_id: string; p_since?: string };
        Returns: CommonExerciseMax[];
      };
      record_session_achievements: {
        Args: { p_session_id: string };
        Returns: SessionPr[];
      };
    };
  };
};
