-- SPDX-License-Identifier: AGPL-3.0-only
-- previous_routine_session_sets (0046) devolvía la ÚLTIMA sesión terminada de
-- la rutina distinta de p_exclude. Para la sesión activa da igual (es la más
-- nueva), pero al abrir una sesión vieja desde el historial el "% vs
-- anterior" la comparaba con una sesión POSTERIOR (ej. la del 1/11 contra la
-- del 15/11). Ahora se toma la última terminada ANTES de p_exclude.
--
-- Si p_exclude es null o no existe, el límite es infinito: mismo resultado
-- que antes. Firma, retorno y permisos iguales a 0046.

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
      and s.created_at < coalesce(
        (select x.created_at from workout_sessions x where x.id = p_exclude),
        'infinity'::timestamptz
      )
    order by s.created_at desc
    limit 1
  ) last
  join workout_exercises we on we.session_id = last.id
  join workout_sets ws on ws.workout_exercise_id = we.id;
$$;
