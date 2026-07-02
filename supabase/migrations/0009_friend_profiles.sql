-- Perfiles de amigos: métricas detalladas de un amigo específico, ranking de
-- ejercicios en común, y filtros nuevos (fuerza, reps, género) en el scoreboard.

-- 1RM estimado server-side (fórmula de Epley, espeja src/lib/metrics.ts)
create or replace function set_estimate_1rm(ws workout_sets)
returns numeric language sql immutable as $$
  select coalesce(max(
    case
      when (d->>'reps')::numeric <= 0 or (d->>'weight')::numeric <= 0 then 0
      when (d->>'reps')::numeric = 1 then (d->>'weight')::numeric
      else round((d->>'weight')::numeric * (1 + (d->>'reps')::numeric / 30))
    end
  ), 0)
  from jsonb_array_elements(
    coalesce(ws.drops, jsonb_build_array(jsonb_build_object('reps', ws.reps, 'weight', ws.weight)))
  ) d
  where d->>'reps' is not null and d->>'weight' is not null;
$$;

-- scoreboard_stats: + strength, + reps, + p_sex.
-- "create or replace" no reemplaza una función si cambia la lista de
-- parámetros (crea un overload nuevo en vez de reemplazar) — hay que borrar
-- la firma vieja de 3 parámetros explícitamente para no dejar dos versiones
-- ambiguas conviviendo.
drop function if exists scoreboard_stats(text, timestamptz, uuid);

create or replace function scoreboard_stats(
  p_metric text,
  p_since timestamptz,
  p_exercise_id uuid default null,
  p_sex text default null
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
      left join workout_sessions s on s.user_id = p.id and s.created_at >= p_since
      left join workout_exercises we on we.session_id = s.id
      left join workout_sets ws on ws.workout_exercise_id = we.id and ws.completed
      where p_sex is null or p.sex = p_sex
      group by p.id, p.username, p.display_name
      order by value desc;

  elsif p_metric = 'frequency' then
    return query
      select p.id, p.username, p.display_name,
             count(distinct date_trunc('day', s.created_at))::numeric as value
      from profiles p
      join friend_ids(auth.uid()) f(id) on f.id = p.id
      left join workout_sessions s on s.user_id = p.id and s.created_at >= p_since
      where p_sex is null or p.sex = p_sex
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
      left join workout_sessions s on s.user_id = p.id and s.created_at >= p_since
      left join workout_exercises we on we.session_id = s.id
        and (we.exercise_id = p_exercise_id or we.replaced_from_exercise_id = p_exercise_id)
      left join workout_sets ws on ws.workout_exercise_id = we.id and ws.completed
      where p_sex is null or p.sex = p_sex
      group by p.id, p.username, p.display_name
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
      left join workout_sessions s on s.user_id = p.id and s.created_at >= p_since
      left join workout_exercises we on we.session_id = s.id
      left join workout_sets ws on ws.workout_exercise_id = we.id and ws.completed
      where p_sex is null or p.sex = p_sex
      group by p.id, p.username, p.display_name
      order by value desc;

  else
    raise exception 'Métrica inválida: %', p_metric;
  end if;
end $$;

-- friend_metrics: detalle completo de UN amigo (o uno mismo)
-- Solo accesible si p_friend_id es el propio caller o un amigo aceptado.
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
      join workout_sets ws on ws.workout_exercise_id = we.id and ws.completed
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
    'weekly_volume', coalesce((
      select json_agg(json_build_object('week', wk, 'volume', vol) order by wk)
      from (
        select date_trunc('week', s.created_at) as wk,
               sum(set_volume(ws)) as vol
        from workout_sessions s
        join workout_exercises we on we.session_id = s.id
        join workout_sets ws on ws.workout_exercise_id = we.id and ws.completed
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
        join workout_sets ws on ws.workout_exercise_id = we.id and ws.completed
        where s.user_id = p_friend_id and s.created_at >= p_since
        order by we.exercise_id, set_estimate_1rm(ws) desc
      ) t
      limit 10
    ), '[]'::json)
  ) into v_result;

  return v_result;
end $$;

-- common_exercise_maxes: ejercicios en común entre caller y un amigo
create or replace function common_exercise_maxes(p_friend_id uuid, p_since timestamptz default '1970-01-01')
returns table (
  exercise_id uuid,
  my_weight numeric,
  my_orm numeric,
  friend_weight numeric,
  friend_orm numeric
)
language plpgsql stable security definer set search_path = public as $$
declare
  v_me uuid := auth.uid();
  v_allowed boolean;
begin
  if v_me is null then raise exception 'No autenticado'; end if;

  select exists (
    select 1 from friendships f
    where f.status = 'accepted'
      and ((f.requester_id = v_me and f.addressee_id = p_friend_id)
        or (f.addressee_id = v_me and f.requester_id = p_friend_id))
  ) into v_allowed;

  if not v_allowed then
    raise exception 'No autorizado: % no es tu amigo', p_friend_id;
  end if;

  return query
    with mine as (
      select we.exercise_id as ex_id,
             max(set_max_weight(ws)) as w,
             max(set_estimate_1rm(ws)) as orm
      from workout_sessions s
      join workout_exercises we on we.session_id = s.id
      join workout_sets ws on ws.workout_exercise_id = we.id and ws.completed
      where s.user_id = v_me and s.created_at >= p_since
      group by we.exercise_id
    ),
    theirs as (
      select we.exercise_id as ex_id,
             max(set_max_weight(ws)) as w,
             max(set_estimate_1rm(ws)) as orm
      from workout_sessions s
      join workout_exercises we on we.session_id = s.id
      join workout_sets ws on ws.workout_exercise_id = we.id and ws.completed
      where s.user_id = p_friend_id and s.created_at >= p_since
      group by we.exercise_id
    )
    select mine.ex_id, mine.w, mine.orm, theirs.w, theirs.orm
    from mine
    join theirs on theirs.ex_id = mine.ex_id
    order by mine.orm desc;
end $$;
