-- SPDX-License-Identifier: AGPL-3.0-only
-- workout_sessions.started_at pasa a NOT NULL con default now().
--
-- Por qué: todas las lecturas hacían coalesce(started_at, created_at), lo que
-- impide usar un índice por rango sobre started_at. Con la columna siempre
-- poblada, `s.started_at` es equivalente y el planner puede usar
-- (user_id, started_at desc).
--
-- Seguridad con el front ya desplegado: el cliente actual puede mandar
-- started_at = null (editTime al borrar el campo). El trigger BEFORE
-- INSERT/UPDATE lo convierte en created_at (o now() en un insert), que es lo
-- que ya asumían las lecturas vía coalesce, así que el null nunca llega al
-- NOT NULL.
--
-- Orden: backfill -> trigger -> default -> not null -> índice -> funciones.
--
-- Además corrige un bug de producción en scoreboard_stats: la rama
-- 'strength_bw' fallaba con 42702 (column reference "user_id" is ambiguous)
-- porque RETURNS TABLE(user_id ...) choca con el user_id sin calificar del
-- lateral. Se califica con alias (ws2). friend_metrics hoistea
-- training_profile_of(p_friend_id) a una variable calculada una vez (antes se
-- evaluaba por fila). Resto de la lógica idéntico a 0035 / 0039; create or
-- replace conserva firmas y grants.
--
-- Down: alter table workout_sessions alter column started_at drop not null,
--         alter column started_at drop default;
--       drop trigger workout_sessions_started_at on workout_sessions;
--       drop function workout_sessions_default_started_at();
--       drop index workout_sessions_user_started_idx;
--       y re-aplicar scoreboard_stats (0035) y friend_metrics (0039).

update workout_sessions set started_at = created_at where started_at is null;

create or replace function workout_sessions_default_started_at()
returns trigger language plpgsql as $$
begin
  new.started_at := coalesce(new.started_at, new.created_at, now());
  return new;
end $$;

drop trigger if exists workout_sessions_started_at on workout_sessions;
create trigger workout_sessions_started_at
  before insert or update on workout_sessions
  for each row execute function workout_sessions_default_started_at();

alter table workout_sessions alter column started_at set default now();
alter table workout_sessions alter column started_at set not null;

create index if not exists workout_sessions_user_started_idx
  on workout_sessions (user_id, started_at desc);

create or replace function scoreboard_stats(
  p_metric text,
  p_since timestamptz,
  p_exercise_id uuid default null,
  p_sex text default null,
  p_until timestamptz default null,
  p_tz text default 'UTC'
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
      left join workout_sessions s on s.user_id = p.id and s.started_at >= p_since and s.started_at < coalesce(p_until, now())
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
                 and is_hard_set(ws.reps, ws.rpe, p.training_profile)
             ), 0)::numeric as value
      from profiles p
      join friend_ids(auth.uid()) f(id) on f.id = p.id
      left join workout_sessions s on s.user_id = p.id and s.started_at >= p_since and s.started_at < coalesce(p_until, now())
      left join workout_exercises we on we.session_id = s.id
      left join workout_sets ws on ws.workout_exercise_id = we.id
      where p_sex is null or p.sex = p_sex
      group by p.id, p.username, p.display_name
      order by value desc;

  elsif p_metric = 'frequency' then
    return query
      select p.id, p.username, p.display_name,
             count(distinct date_trunc('day', s.started_at at time zone p_tz))::numeric as value
      from profiles p
      join friend_ids(auth.uid()) f(id) on f.id = p.id
      left join workout_sessions s on s.user_id = p.id and s.started_at >= p_since and s.started_at < coalesce(p_until, now())
      where p_sex is null or p.sex = p_sex
      group by p.id, p.username, p.display_name
      order by value desc;

  elsif p_metric = 'weight' then
    return query
      select p.id, p.username, p.display_name,
             coalesce(max(set_max_weight(ws)), 0)::numeric as value
      from profiles p
      join friend_ids(auth.uid()) f(id) on f.id = p.id
      left join workout_sessions s on s.user_id = p.id and s.started_at >= p_since and s.started_at < coalesce(p_until, now())
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
      left join workout_sessions s on s.user_id = p.id and s.started_at >= p_since and s.started_at < coalesce(p_until, now())
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
        select ws2.body_weight_kg as w from workout_sessions ws2
        where ws2.user_id = p.id and ws2.body_weight_kg is not null
        order by ws2.created_at desc limit 1
      ) bw on true
      left join workout_sessions s on s.user_id = p.id and s.started_at >= p_since and s.started_at < coalesce(p_until, now())
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
          and s.started_at >= p_since and s.started_at < coalesce(p_until, now())
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
      left join workout_sessions s on s.user_id = p.id and s.started_at >= p_since and s.started_at < coalesce(p_until, now())
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
  v_profile text;
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

  v_profile := training_profile_of(p_friend_id);

  select json_build_object(
    'total_volume', coalesce((
      select sum(set_volume(ws))
      from workout_sessions s
      join workout_exercises we on we.session_id = s.id
      join workout_sets ws on ws.workout_exercise_id = we.id
        and ws.completed and not coalesce(ws.is_warmup, false)
      where s.user_id = p_friend_id and s.started_at >= p_since
    ), 0),
    'session_count', (
      select count(*) from workout_sessions s
      where s.user_id = p_friend_id and s.started_at >= p_since
    ),
    'frequency_days', (
      select count(distinct date_trunc('day', s.started_at at time zone p_tz))
      from workout_sessions s
      where s.user_id = p_friend_id and s.started_at >= p_since
    ),
    'hard_sets', coalesce((
      select count(*) filter (
        where ws.completed and not coalesce(ws.is_warmup, false)
          and is_hard_set(ws.reps, ws.rpe, v_profile)
      )
      from workout_sessions s
      join workout_exercises we on we.session_id = s.id
      join workout_sets ws on ws.workout_exercise_id = we.id
      where s.user_id = p_friend_id and s.started_at >= p_since
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
      where s.user_id = p_friend_id and s.started_at >= p_since
    ), 0),
    'avg_duration', coalesce((
      select avg(s.duration_seconds)
      from workout_sessions s
      where s.user_id = p_friend_id and s.started_at >= p_since
        and s.duration_seconds is not null
    ), 0),
    'distinct_exercises', coalesce((
      select count(distinct we.exercise_id)
      from workout_sessions s
      join workout_exercises we on we.session_id = s.id
      join workout_sets ws on ws.workout_exercise_id = we.id
        and ws.completed and not coalesce(ws.is_warmup, false)
      where s.user_id = p_friend_id and s.started_at >= p_since
    ), 0),
    'weekly_volume', coalesce((
      select json_agg(json_build_object('week', wk, 'volume', vol) order by wk)
      from (
        select date_trunc('week', s.started_at at time zone p_tz) as wk,
               sum(set_volume(ws)) as vol
        from workout_sessions s
        join workout_exercises we on we.session_id = s.id
        join workout_sets ws on ws.workout_exercise_id = we.id
          and ws.completed and not coalesce(ws.is_warmup, false)
        where s.user_id = p_friend_id and s.started_at >= p_since
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
        where s.user_id = p_friend_id and s.started_at >= p_since
        order by we.exercise_id, set_estimate_1rm(ws) desc
        ) t
        order by orm desc
        limit 10
      ) u
    ), '[]'::json)
  ) into v_result;

  return v_result;
end $$;
