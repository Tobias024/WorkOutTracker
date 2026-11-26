-- SPDX-License-Identifier: AGPL-3.0-only
-- Índices faltantes (ver RELEVAMIENTO-PERFORMANCE.md §3.3).
--
-- Por qué: las FKs sin índice obligan a seq scan en cada DELETE/UPDATE del
-- padre (cascade / set null) y los joins por exercise_id (historial, PRs,
-- scoreboard) no tenían un índice por el que entrar. Los parciales excluyen
-- los null (la mayoría) y quedan chicos. workout_sessions (user_id, ended_at
-- is null) acelera la búsqueda de la sesión activa.
--
-- Se retiran dos índices redundantes (verificado en las migraciones):
--   * friendships_requester_idx (requester_id): prefijo del unique
--     (requester_id, addressee_id) de 0001, que ya crea un índice.
--   * routine_sets_rex_idx (routine_exercise_id, set_number): idéntico al
--     unique (routine_exercise_id, set_number) de 0006.
-- No se toca exercises_name_idx.
--
-- No usa CONCURRENTLY: tablas chicas y corre dentro de la transacción.
--
-- Down:
--   drop index if exists workout_exercises_exercise_session_idx,
--     workout_exercises_replaced_from_idx, workout_exercises_routine_exercise_idx,
--     workout_sessions_routine_idx, workout_sessions_active_idx,
--     routine_exercises_exercise_idx, exercise_substitutions_rex_idx;
--   create index if not exists friendships_requester_idx on friendships (requester_id);
--   create index if not exists routine_sets_rex_idx on routine_sets (routine_exercise_id, set_number);

create index if not exists workout_exercises_exercise_session_idx
  on workout_exercises (exercise_id, session_id);

create index if not exists workout_exercises_replaced_from_idx
  on workout_exercises (replaced_from_exercise_id)
  where replaced_from_exercise_id is not null;

create index if not exists workout_exercises_routine_exercise_idx
  on workout_exercises (routine_exercise_id)
  where routine_exercise_id is not null;

create index if not exists workout_sessions_routine_idx
  on workout_sessions (routine_id)
  where routine_id is not null;

create index if not exists workout_sessions_active_idx
  on workout_sessions (user_id, started_at desc)
  where ended_at is null;

create index if not exists routine_exercises_exercise_idx
  on routine_exercises (exercise_id);

create index if not exists exercise_substitutions_rex_idx
  on exercise_substitutions (routine_exercise_id);

drop index if exists friendships_requester_idx;
drop index if exists routine_sets_rex_idx;
