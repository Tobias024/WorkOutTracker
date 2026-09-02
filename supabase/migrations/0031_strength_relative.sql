-- SPDX-License-Identifier: AGPL-3.0-only
-- Agrega la métrica 'strength_rel' a scoreboard_stats: ranking de FUERZA RELATIVA
-- GENERAL, sin elegir ejercicio. Por usuario = promedio del mejor e1RM por
-- ejercicio (Epley, sin warmups) dividido por su peso corporal (profiles.weight_kg,
-- que mantiene actualizado el registro diario de peso). Los que no tienen peso o
-- lifts quedan en 0. Se re-declara la función completa (create or replace).
-- Down: re-aplicar 0019.

create or replace function scoreboard_stats(
  p_metric text,
  p_since timestamptz,
  p_exercise_id uuid default null,
  p_sex text default null,
  p_until timestamptz default null
)
returns table (user_id uuid, username text, display_name text, value numeric)
language plpgsql stable security definer set search_path = public as $$
begin
  if p_metric = 'volume' then
    return query
      select p.id, p.username, p.display_name,
             coalesce(sum(set_volume(ws)), 0)::numeric as value
      from profiles p
      join friend_ids(auth.uid()) f(id) on f.id = p.id
      left join workout_sessions s on s.user_id = p.id and s.created_at >= p_since and s.created_at < coalesce(p_until, now())
      left join workout_exercises we on we.session_id = s.id
      left join workout_sets ws on ws.workout_exercise_id = we.id
        and ws.completed and not coalesce(ws.is_warmup, false)
      where p_sex is null or p.sex = p_sex
      group by p.id, p.username, p.display_name
      order by value desc;

  elsif p_metric = 'hard_sets' then
    return query
      select p.id, p.username, p.display_name,
             coalesce(count(ws.id) filter (
               where ws.completed and not coalesce(ws.is_warmup, false)
                 and coalesce(ws.reps, 0) >= 5
                 and (ws.rpe is null or ws.rpe >= 7)
             ), 0)::numeric as value
      from profiles p
      join friend_ids(auth.uid()) f(id) on f.id = p.id
      left join workout_sessions s on s.user_id = p.id and s.created_at >= p_since and s.created_at < coalesce(p_until, now())
      left join workout_exercises we on we.session_id = s.id
      left join workout_sets ws on ws.workout_exercise_id = we.id
      where p_sex is null or p.sex = p_sex
      group by p.id, p.username, p.display_name
      order by value desc;

  elsif p_metric = 'frequency' then
    return query
      select p.id, p.username, p.display_name,
             count(distinct date_trunc('day', s.created_at))::numeric as value
      from profiles p
      join friend_ids(auth.uid()) f(id) on f.id = p.id
      left join workout_sessions s on s.user_id = p.id and s.created_at >= p_since and s.created_at < coalesce(p_until, now())
      where p_sex is null or p.sex = p_sex
      group by p.id, p.username, p.display_name
      order by value desc;

  elsif p_metric = 'weight' then
    return query
      select p.id, p.username, p.display_name,
             coalesce(max(set_max_weight(ws)), 0)::numeric as value
      from profiles p
      join friend_ids(auth.uid()) f(id) on f.id = p.id
      left join workout_sessions s on s.user_id = p.id and s.created_at >= p_since and s.created_at < coalesce(p_until, now())
      left join workout_exercises we on we.session_id = s.id
        and (we.exercise_id = p_exercise_id or we.replaced_from_exercise_id = p_exercise_id)
      left join workout_sets ws on ws.workout_exercise_id = we.id
        and ws.completed and not coalesce(ws.is_warmup, false)
      where p_sex is null or p.sex = p_sex
      group by p.id, p.username, p.display_name
      order by value desc;

  elsif p_metric = 'strength' then
    if p_exercise_id is null then
      raise exception 'p_exercise_id es requerido para la métrica strength';
    end if;
    return query
      select p.id, p.username, p.display_name,
             coalesce(max(set_estimate_1rm(ws)), 0)::numeric as value
      from profiles p
      join friend_ids(auth.uid()) f(id) on f.id = p.id
      left join workout_sessions s on s.user_id = p.id and s.created_at >= p_since and s.created_at < coalesce(p_until, now())
      left join workout_exercises we on we.session_id = s.id
        and (we.exercise_id = p_exercise_id or we.replaced_from_exercise_id = p_exercise_id)
      left join workout_sets ws on ws.workout_exercise_id = we.id
        and ws.completed and not coalesce(ws.is_warmup, false)
      where p_sex is null or p.sex = p_sex
      group by p.id, p.username, p.display_name
      order by value desc;

  elsif p_metric = 'strength_bw' then
    if p_exercise_id is null then
      raise exception 'p_exercise_id es requerido para la métrica strength_bw';
    end if;
    return query
      select p.id, p.username, p.display_name,
             case when bw.w is null or bw.w = 0 then 0
               else round(coalesce(max(set_estimate_1rm(ws)), 0) / bw.w, 2) end as value
      from profiles p
      join friend_ids(auth.uid()) f(id) on f.id = p.id
      left join lateral (
        select body_weight_kg as w from workout_sessions
        where user_id = p.id and body_weight_kg is not null
        order by created_at desc limit 1
      ) bw on true
      left join workout_sessions s on s.user_id = p.id and s.created_at >= p_since and s.created_at < coalesce(p_until, now())
      left join workout_exercises we on we.session_id = s.id
        and (we.exercise_id = p_exercise_id or we.replaced_from_exercise_id = p_exercise_id)
      left join workout_sets ws on ws.workout_exercise_id = we.id
        and ws.completed and not coalesce(ws.is_warmup, false)
      where p_sex is null or p.sex = p_sex
      group by p.id, p.username, p.display_name, bw.w
      order by value desc;

  elsif p_metric = 'strength_rel' then
    return query
      with per_ex as (
        select p.id as uid, we.exercise_id as ex,
               max(set_estimate_1rm(ws)) as best
        from profiles p
        join friend_ids(auth.uid()) f(id) on f.id = p.id
        join workout_sessions s on s.user_id = p.id
          and s.created_at >= p_since and s.created_at < coalesce(p_until, now())
        join workout_exercises we on we.session_id = s.id
        join workout_sets ws on ws.workout_exercise_id = we.id
          and ws.completed and not coalesce(ws.is_warmup, false)
        group by p.id, we.exercise_id
        having max(set_estimate_1rm(ws)) > 0
      )
      select p.id, p.username, p.display_name,
             case when p.weight_kg is null or p.weight_kg = 0 then 0
               else round(coalesce(avg(pe.best), 0) / p.weight_kg, 2) end as value
      from profiles p
      join friend_ids(auth.uid()) f(id) on f.id = p.id
      left join per_ex pe on pe.uid = p.id
      where p_sex is null or p.sex = p_sex
      group by p.id, p.username, p.display_name, p.weight_kg
      order by value desc;

  elsif p_metric = 'reps' then
    return query
      select p.id, p.username, p.display_name,
             coalesce(sum(
               (select sum((d->>'reps')::numeric)
                from jsonb_array_elements(
                  coalesce(ws.drops, jsonb_build_array(jsonb_build_object('reps', ws.reps, 'weight', ws.weight)))
                ) d
                where d->>'reps' is not null)
             ), 0)::numeric as value
      from profiles p
      join friend_ids(auth.uid()) f(id) on f.id = p.id
      left join workout_sessions s on s.user_id = p.id and s.created_at >= p_since and s.created_at < coalesce(p_until, now())
      left join workout_exercises we on we.session_id = s.id
      left join workout_sets ws on ws.workout_exercise_id = we.id
        and ws.completed and not coalesce(ws.is_warmup, false)
      where p_sex is null or p.sex = p_sex
      group by p.id, p.username, p.display_name
      order by value desc;

  else
    raise exception 'Métrica inválida: %', p_metric;
  end if;
end $$;
