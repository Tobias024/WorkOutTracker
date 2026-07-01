// Tipos de la base de datos (alineados con supabase/migrations).
// Se usan `type` (no `interface`) para que sean asignables a Record<string, unknown>,
// requisito de los genéricos de supabase-js.

export type FriendshipStatus = "pending" | "accepted";

export type Sex = "male" | "female";

export type Profile = {
  id: string;
  username: string;
  display_name: string | null;
  avatar_url: string | null;
  sex: Sex | null;
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
  /** Bajadas de peso sin descanso dentro de la misma serie. null = serie simple (usar reps/weight). */
  drops: SetDrop[] | null;
};

export type ExerciseSubstitution = {
  id: string;
  user_id: string;
  routine_exercise_id: string;
  substitute_exercise_id: string;
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
      friendships: Table<Friendship>;
      invites: Table<Invite>;
      push_subscriptions: Table<PushSubscription>;
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
        Args: { p_metric: string; p_since: string; p_exercise_id?: string };
        Returns: ScoreboardRow[];
      };
      detect_rank_overtakes: {
        Args: Record<string, never>;
        Returns: { user_id: string; by_name: string | null; by_id: string }[];
      };
    };
  };
};
