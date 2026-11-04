-- SPDX-License-Identifier: AGPL-3.0-only
-- friend_metrics: el `limit 10` de top_prs estaba FUERA de la subconsulta,
-- después del json_agg (una sola fila agregada), así que no limitaba nada y
-- devolvía un PR por cada ejercicio. Ahora se ordena por orm desc y se limita
-- a 10 ANTES de agregar. El resto de la función es idéntico a 0035 (mismas
-- columnas y filtros); create or replace conserva los grants existentes.
-- Down: re-aplicar la definición de friend_metrics de 0035.

create or replace function friend_metrics(
  p_friend_id uuid,
  p_since timestamptz,
  p_tz text default 'UTC'
)
returns json language plpgsql stable security definer set search_path = public as $$
declare
  v_me uuid := auth.uid();
  v_allowed boolean;
  v_result json;
begin
  if v_me is null then raise exception 'No autenticado'; end if;

  select (p_friend_id = v_me) or exists (
    select 1 from friendships f
    where f.status = 'accepted'
      and ((f.requester_id = v_me and f.addressee_id = p_friend_id)
        or (f.addressee_id = v_me and f.requester_id = p_friend_id))
  ) into v_allowed;

  if not v_allowed then
    raise exception 'No autorizado: % no es tu amigo', p_friend_id;
  end if;

  select json_build_object(
    'total_volume', coalesce((
      select sum(set_volume(ws))
      from workout_sessions s
      join workout_exercises we on we.session_id = s.id
      join workout_sets ws on ws.workout_exercise_id = we.id
        and ws.completed and not coalesce(ws.is_warmup, false)
      where s.user_id = p_friend_id and coalesce(s.started_at, s.created_at) >= p_since
    ), 0),
    'session_count', (
      select count(*) from workout_sessions s
      where s.user_id = p_friend_id and coalesce(s.started_at, s.created_at) >= p_since
    ),
    'frequency_days', (
      select count(distinct date_trunc('day', coalesce(s.started_at, s.created_at) at time zone p_tz))
      from workout_sessions s
      where s.user_id = p_friend_id and coalesce(s.started_at, s.created_at) >= p_since
    ),
    'hard_sets', coalesce((
      select count(*) filter (
        where ws.completed and not coalesce(ws.is_warmup, false)
          and is_hard_set(ws.reps, ws.rpe, training_profile_of(p_friend_id))
      )
      from workout_sessions s
      join workout_exercises we on we.session_id = s.id
      join workout_sets ws on ws.workout_exercise_id = we.id
      where s.user_id = p_friend_id and coalesce(s.started_at, s.created_at) >= p_since
    ), 0),
    'total_reps', coalesce((
      select sum(
        (select sum((d->>'reps')::numeric)
         from jsonb_array_elements(
           coalesce(ws.drops, jsonb_build_array(jsonb_build_object('reps', ws.reps, 'weight', ws.weight)))
         ) d
         where d->>'reps' is not null)
      )
      from workout_sessions s
      join workout_exercises we on we.session_id = s.id
      join workout_sets ws on ws.workout_exercise_id = we.id
        and ws.completed and not coalesce(ws.is_warmup, false)
      where s.user_id = p_friend_id and coalesce(s.started_at, s.created_at) >= p_since
    ), 0),
    'avg_duration', coalesce((
      select avg(s.duration_seconds)
      from workout_sessions s
      where s.user_id = p_friend_id and coalesce(s.started_at, s.created_at) >= p_since
        and s.duration_seconds is not null
    ), 0),
    'distinct_exercises', coalesce((
      select count(distinct we.exercise_id)
      from workout_sessions s
      join workout_exercises we on we.session_id = s.id
      join workout_sets ws on ws.workout_exercise_id = we.id
        and ws.completed and not coalesce(ws.is_warmup, false)
      where s.user_id = p_friend_id and coalesce(s.started_at, s.created_at) >= p_since
    ), 0),
    'weekly_volume', coalesce((
      select json_agg(json_build_object('week', wk, 'volume', vol) order by wk)
      from (
        select date_trunc('week', coalesce(s.started_at, s.created_at) at time zone p_tz) as wk,
               sum(set_volume(ws)) as vol
        from workout_sessions s
        join workout_exercises we on we.session_id = s.id
        join workout_sets ws on ws.workout_exercise_id = we.id
          and ws.completed and not coalesce(ws.is_warmup, false)
        where s.user_id = p_friend_id and coalesce(s.started_at, s.created_at) >= p_since
        group by 1
      ) t
    ), '[]'::json),
    'top_prs', coalesce((
      select json_agg(json_build_object(
        'exercise_id', exercise_id, 'weight', weight, 'orm', orm
      ) order by orm desc)
      from (
        select exercise_id, weight, orm
        from (
        select distinct on (we.exercise_id)
          we.exercise_id, set_max_weight(ws) as weight, set_estimate_1rm(ws) as orm
        from workout_sessions s
        join workout_exercises we on we.session_id = s.id
        join workout_sets ws on ws.workout_exercise_id = we.id
          and ws.completed and not coalesce(ws.is_warmup, false)
        where s.user_id = p_friend_id and coalesce(s.started_at, s.created_at) >= p_since
        order by we.exercise_id, set_estimate_1rm(ws) desc
        ) t
        order by orm desc
        limit 10
      ) u
    ), '[]'::json)
  ) into v_result;

  return v_result;
end $$;
