-- SPDX-License-Identifier: AGPL-3.0-only
-- RPCs livianos para reemplazar el historial completo anidado en el cliente
-- (RELEVAMIENTO-PERFORMANCE.md §4.2-4.3): en vez de traer todas las sesiones
-- con todos sus sets para sacar "último uso" o "sesión anterior", el servidor
-- devuelve sólo lo necesario.
--
--   * exercise_last_used(): última fecha de uso por ejercicio (todas las
--     sesiones del usuario, incluidas las activas).
--   * last_session_by_routine(): la sesión más reciente (por created_at) de
--     cada rutina, con su created_at y su started_at (incluye activas).
--   * previous_routine_session_sets(p_routine_id, p_exclude): las series de la
--     última sesión TERMINADA de una rutina, excluyendo p_exclude.
--
-- SECURITY INVOKER: la RLS filtra; además se filtra explícitamente por
-- s.user_id = (select auth.uid()) para poder usar los índices por usuario.
-- Requiere 0042 (started_at not null).
--
-- Down: drop function exercise_last_used(); drop function last_session_by_routine();
--       drop function previous_routine_session_sets(uuid, uuid);

create or replace function public.exercise_last_used()
returns table (exercise_id uuid, last_at timestamptz)
language sql stable security invoker set search_path = public as $$
  select we.exercise_id, max(s.started_at) as last_at
  from workout_sessions s
  join workout_exercises we on we.session_id = s.id
  where s.user_id = (select auth.uid())
  group by we.exercise_id;
$$;

create or replace function public.last_session_by_routine()
returns table (routine_id uuid, created_at timestamptz, last_at timestamptz)
language sql stable security invoker set search_path = public as $$
  select distinct on (s.routine_id) s.routine_id, s.created_at, s.started_at as last_at
  from workout_sessions s
  where s.user_id = (select auth.uid()) and s.routine_id is not null
  order by s.routine_id, s.created_at desc;
$$;

create or replace function public.previous_routine_session_sets(p_routine_id uuid, p_exclude uuid)
returns table (reps integer, weight numeric, completed boolean, is_warmup boolean, rpe numeric, drops jsonb)
language sql stable security invoker set search_path = public as $$
  select ws.reps, ws.weight, ws.completed, ws.is_warmup, ws.rpe, ws.drops
  from (
    select s.id
    from workout_sessions s
    where s.user_id = (select auth.uid())
      and s.routine_id = p_routine_id
      and s.ended_at is not null
      and s.id is distinct from p_exclude
    order by s.created_at desc
    limit 1
  ) last
  join workout_exercises we on we.session_id = last.id
  join workout_sets ws on ws.workout_exercise_id = we.id;
$$;

revoke execute on function public.exercise_last_used() from public, anon;
revoke execute on function public.last_session_by_routine() from public, anon;
revoke execute on function public.previous_routine_session_sets(uuid, uuid) from public, anon;
grant execute on function public.exercise_last_used() to authenticated;
grant execute on function public.last_session_by_routine() to authenticated;
grant execute on function public.previous_routine_session_sets(uuid, uuid) to authenticated;
