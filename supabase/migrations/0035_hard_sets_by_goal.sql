-- SPDX-License-Identifier: AGPL-3.0-only
-- "Serie efectiva" (hard set) pasa a depender del OBJETIVO de cada usuario.
--
-- El umbral estaba hardcodeado en reps >= 5 y rpe >= 7 (o sea RIR <= 3): los
-- valores de hipertrofia, aplicados a todo el mundo. Pero una serie de 3 reps
-- pesadas SÍ es volumen efectivo para fuerza, y un RIR 4 rinde para fuerza
-- aunque se quede corto para crecer (Robinson et al. 2024, Sports Med
-- 54:2069-2087: la hipertrofia mejora al acercarse al fallo, pero para fuerza
-- la pendiente del RIR es nula). Espeja src/lib/goal-params.ts.
--
-- Decisión importante en el ranking: las series de CADA persona se cuentan con
-- SU objetivo, no con el de quien mira la tabla. Contar las series de un amigo
-- con el objetivo ajeno sería directamente incorrecto; el costo es que la
-- columna compara definiciones distintas, y por eso la pantalla lo aclara.
--
-- Ojo: esto cambia RETROACTIVAMENTE los números de quien no sea de hipertrofia.
-- Down: re-aplicar 0032.

-- RIR = 10 - RPE, así que "RIR <= max" se escribe "rpe >= 10 - max".
create or replace function is_hard_set(
  p_reps int,
  p_rpe numeric,
  p_profile text
) returns boolean
language sql immutable as $$
  select p_reps is not null
     and p_reps >= case p_profile
                     when 'fuerza'      then 1
                     when 'resistencia' then 12
                     else 5                       -- hipertrofia y sin objetivo
                   end
     and (p_rpe is null or p_rpe >= case p_profile
                                      when 'fuerza'      then 6   -- RIR <= 4
                                      when 'resistencia' then 6   -- RIR <= 4
                                      else 7                      -- RIR <= 3
                                    end);
$$;

-- Sin objetivo elegido se usa hipertrofia: son los valores que la app venía
-- aplicando, así que quien nunca configuró nada no ve cambiar sus números.
create or replace function training_profile_of(p_user uuid) returns text
language sql stable security definer set search_path = public as $$
  select coalesce(training_profile, 'hipertrofia') from profiles where id = p_user;
$$;

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
      left join workout_sessions s on s.user_id = p.id and coalesce(s.started_at, s.created_at) >= p_since and coalesce(s.started_at, s.created_at) < coalesce(p_until, now())
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
      left join workout_sessions s on s.user_id = p.id and coalesce(s.started_at, s.created_at) >= p_since and coalesce(s.started_at, s.created_at) < coalesce(p_until, now())
      left join workout_exercises we on we.session_id = s.id
      left join workout_sets ws on ws.workout_exercise_id = we.id
      where p_sex is null or p.sex = p_sex
      group by p.id, p.username, p.display_name
      order by value desc;

  elsif p_metric = 'frequency' then
    return query
      select p.id, p.username, p.display_name,
             count(distinct date_trunc('day', coalesce(s.started_at, s.created_at) at time zone p_tz))::numeric as value
      from profiles p
      join friend_ids(auth.uid()) f(id) on f.id = p.id
      left join workout_sessions s on s.user_id = p.id and coalesce(s.started_at, s.created_at) >= p_since and coalesce(s.started_at, s.created_at) < coalesce(p_until, now())
      where p_sex is null or p.sex = p_sex
      group by p.id, p.username, p.display_name
      order by value desc;

  elsif p_metric = 'weight' then
    return query
      select p.id, p.username, p.display_name,
             coalesce(max(set_max_weight(ws)), 0)::numeric as value
      from profiles p
      join friend_ids(auth.uid()) f(id) on f.id = p.id
      left join workout_sessions s on s.user_id = p.id and coalesce(s.started_at, s.created_at) >= p_since and coalesce(s.started_at, s.created_at) < coalesce(p_until, now())
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
      left join workout_sessions s on s.user_id = p.id and coalesce(s.started_at, s.created_at) >= p_since and coalesce(s.started_at, s.created_at) < coalesce(p_until, now())
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
      left join workout_sessions s on s.user_id = p.id and coalesce(s.started_at, s.created_at) >= p_since and coalesce(s.started_at, s.created_at) < coalesce(p_until, now())
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
          and coalesce(s.started_at, s.created_at) >= p_since and coalesce(s.started_at, s.created_at) < coalesce(p_until, now())
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
      left join workout_sessions s on s.user_id = p.id and coalesce(s.started_at, s.created_at) >= p_since and coalesce(s.started_at, s.created_at) < coalesce(p_until, now())
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
        select distinct on (we.exercise_id)
          we.exercise_id, set_max_weight(ws) as weight, set_estimate_1rm(ws) as orm
        from workout_sessions s
        join workout_exercises we on we.session_id = s.id
        join workout_sets ws on ws.workout_exercise_id = we.id
          and ws.completed and not coalesce(ws.is_warmup, false)
        where s.user_id = p_friend_id and coalesce(s.started_at, s.created_at) >= p_since
        order by we.exercise_id, set_estimate_1rm(ws) desc
      ) t
      limit 10
    ), '[]'::json)
  ) into v_result;

  return v_result;
end $$;
