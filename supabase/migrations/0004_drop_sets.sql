-- Soporte para "drop sets": bajadas de peso sin descanso dentro de la misma serie.
-- drops = null           -> serie simple, usar reps/weight como siempre.
-- drops = [{reps,weight}, ...] -> cada elemento es una bajada; reps/weight guardan un espejo
--                                 de la primera bajada (para compatibilidad con lecturas simples).
alter table workout_sets add column if not exists drops jsonb;

-- Bajadas efectivas de un set: las propias, o un único par reps/peso si es una serie simple.
create or replace function set_volume(ws workout_sets)
returns numeric language sql immutable as $$
  select coalesce(sum((d->>'reps')::numeric * (d->>'weight')::numeric), 0)
  from jsonb_array_elements(
    coalesce(ws.drops, jsonb_build_array(jsonb_build_object('reps', ws.reps, 'weight', ws.weight)))
  ) d
  where d->>'reps' is not null and d->>'weight' is not null;
$$;

create or replace function set_max_weight(ws workout_sets)
returns numeric language sql immutable as $$
  select coalesce(max((d->>'weight')::numeric), 0)
  from jsonb_array_elements(
    coalesce(ws.drops, jsonb_build_array(jsonb_build_object('reps', ws.reps, 'weight', ws.weight)))
  ) d
  where d->>'weight' is not null;
$$;

create or replace function scoreboard_stats(p_metric text, p_since timestamptz, p_exercise_id uuid default null)
returns table (user_id uuid, username text, display_name text, value numeric)
language plpgsql stable security definer set search_path = public as $$
begin
  if p_metric = 'volume' then
    return query
      select p.id, p.username, p.display_name,
             coalesce(sum(set_volume(ws)), 0)::numeric as value
      from profiles p
      join friend_ids(auth.uid()) f(id) on f.id = p.id
      left join workout_sessions s on s.user_id = p.id and s.created_at >= p_since
      left join workout_exercises we on we.session_id = s.id
      left join workout_sets ws on ws.workout_exercise_id = we.id and ws.completed
      group by p.id, p.username, p.display_name
      order by value desc;

  elsif p_metric = 'frequency' then
    return query
      select p.id, p.username, p.display_name,
             count(distinct date_trunc('day', s.created_at))::numeric as value
      from profiles p
      join friend_ids(auth.uid()) f(id) on f.id = p.id
      left join workout_sessions s on s.user_id = p.id and s.created_at >= p_since
      group by p.id, p.username, p.display_name
      order by value desc;

  elsif p_metric = 'weight' then
    return query
      select p.id, p.username, p.display_name,
             coalesce(max(set_max_weight(ws)), 0)::numeric as value
      from profiles p
      join friend_ids(auth.uid()) f(id) on f.id = p.id
      left join workout_sessions s on s.user_id = p.id and s.created_at >= p_since
      left join workout_exercises we on we.session_id = s.id
        and (we.exercise_id = p_exercise_id or we.replaced_from_exercise_id = p_exercise_id)
      left join workout_sets ws on ws.workout_exercise_id = we.id and ws.completed
      group by p.id, p.username, p.display_name
      order by value desc;
  else
    raise exception 'Métrica inválida: %', p_metric;
  end if;
end $$;
