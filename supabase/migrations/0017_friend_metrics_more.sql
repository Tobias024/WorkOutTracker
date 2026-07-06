-- Más métricas para la comparación head-to-head con amigos.
-- Se reescribe friend_metrics (base: 0013) agregando 4 claves escalares nuevas
-- reutilizando fórmulas ya probadas en scoreboard_stats (0016):
--   hard_sets, total_reps, avg_duration, distinct_exercises.
-- Todo respeta el mismo período (p_since) y la exclusión de warmups/no completados.

create or replace function friend_metrics(p_friend_id uuid, p_since timestamptz)
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
      where s.user_id = p_friend_id and s.created_at >= p_since
    ), 0),
    'session_count', (
      select count(*) from workout_sessions s
      where s.user_id = p_friend_id and s.created_at >= p_since
    ),
    'frequency_days', (
      select count(distinct date_trunc('day', s.created_at))
      from workout_sessions s
      where s.user_id = p_friend_id and s.created_at >= p_since
    ),
    'hard_sets', coalesce((
      select count(*) filter (
        where ws.completed and not coalesce(ws.is_warmup, false)
          and coalesce(ws.reps, 0) >= 5
          and (ws.rpe is null or ws.rpe >= 7)
      )
      from workout_sessions s
      join workout_exercises we on we.session_id = s.id
      join workout_sets ws on ws.workout_exercise_id = we.id
      where s.user_id = p_friend_id and s.created_at >= p_since
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
      where s.user_id = p_friend_id and s.created_at >= p_since
    ), 0),
    'avg_duration', coalesce((
      select avg(s.duration_seconds)
      from workout_sessions s
      where s.user_id = p_friend_id and s.created_at >= p_since
        and s.duration_seconds is not null
    ), 0),
    'distinct_exercises', coalesce((
      select count(distinct we.exercise_id)
      from workout_sessions s
      join workout_exercises we on we.session_id = s.id
      join workout_sets ws on ws.workout_exercise_id = we.id
        and ws.completed and not coalesce(ws.is_warmup, false)
      where s.user_id = p_friend_id and s.created_at >= p_since
    ), 0),
    'weekly_volume', coalesce((
      select json_agg(json_build_object('week', wk, 'volume', vol) order by wk)
      from (
        select date_trunc('week', s.created_at) as wk,
               sum(set_volume(ws)) as vol
        from workout_sessions s
        join workout_exercises we on we.session_id = s.id
        join workout_sets ws on ws.workout_exercise_id = we.id
          and ws.completed and not coalesce(ws.is_warmup, false)
        where s.user_id = p_friend_id and s.created_at >= p_since
        group by 1
      ) t
    ), '[]'::json),
    'top_prs', coalesce((
      select json_agg(json_build_object(
        'exercise_id', exercise_id, 'weight', weight, 'orm', orm
      ) order by orm desc)
      from (
        select distinct on (we.exercise_id)
          we.exercise_id, set_max_weight(ws) as weight, set_estimate_1rm(ws) as orm
        from workout_sessions s
        join workout_exercises we on we.session_id = s.id
        join workout_sets ws on ws.workout_exercise_id = we.id
          and ws.completed and not coalesce(ws.is_warmup, false)
        where s.user_id = p_friend_id and s.created_at >= p_since
        order by we.exercise_id, set_estimate_1rm(ws) desc
      ) t
      limit 10
    ), '[]'::json)
  ) into v_result;

  return v_result;
end $$;
