-- SPDX-License-Identifier: AGPL-3.0-only
-- Arregla dos funciones que fallaban SIEMPRE en prod con 42702 (columna
-- ambigua), el mismo bug que refresh_oauth_token (0048): las columnas OUT de
-- `returns table (...)` son variables PL/pgSQL y chocan con columnas de igual
-- nombre usadas sin calificar.
--
--   * record_session_achievements (0015): OUT `orm` vs. la columna `orm` de
--     los CTE prs/ins ("column reference orm is ambiguous", RETURN QUERY).
--     Consecuencia: al terminar un entreno no se registraba NINGÚN logro (PRs
--     de e1RM, récord semanal, rachas) ni se mostraba el festejo de PR.
--   * detect_rank_overtakes (0027): OUT `user_id` vs. `on conflict (user_id)`
--     de rank_state. Consecuencia: nunca salían los avisos de ranking
--     (subiste / te pasaron) y rank_state no se actualizaba.
--
-- Fix: `#variable_conflict use_column` al inicio del cuerpo. Revisado una por
-- una: todas las referencias sin calificar a esos nombres son columnas; las
-- asignaciones a los OUT (`user_id := ...`) no se ven afectadas. El resto del
-- cuerpo es idéntico al que corre en prod (verificado por hash contra
-- pg_proc.prosrc el 2026-11-25). `create or replace` conserva los permisos
-- (0038 dejó detect_rank_overtakes sólo para service_role).

create or replace function record_session_achievements(p_session_id uuid)
returns table (exercise_id uuid, weight numeric, orm numeric, prev_orm numeric)
language plpgsql security definer set search_path = public as $$
#variable_conflict use_column
declare
  v_me uuid := auth.uid();
  v_created timestamptz;
  v_week_vol numeric;
  v_prev_max_week numeric;
  v_streak int;
  v_threshold int;
  v_cur date;
begin
  if v_me is null then raise exception 'No autenticado'; end if;

  select s.user_id, s.created_at into v_me, v_created
  from workout_sessions s where s.id = p_session_id;
  if v_me is null or v_me <> auth.uid() then
    raise exception 'Sesión no encontrada o ajena';
  end if;
  v_me := auth.uid();

  -- Re-cálculo idempotente: borra los logros por-sesión de esta sesión y recrea.
  delete from achievements
  where user_id = v_me
    and kind in ('e1rm_pr', 'volume_pr_week')
    and (payload->>'session_id')::uuid = p_session_id;

  -- ── e1RM PRs ──
  return query
  with session_best as (
    select we.exercise_id as ex_id, max(set_estimate_1rm(ws)) as orm,
           max(set_max_weight(ws)) as w
    from workout_exercises we
    join workout_sets ws on ws.workout_exercise_id = we.id
      and ws.completed and not coalesce(ws.is_warmup, false)
    where we.session_id = p_session_id
    group by we.exercise_id
  ),
  prior_best as (
    select we.exercise_id as ex_id, coalesce(max(set_estimate_1rm(ws)), 0) as orm
    from workout_sessions s
    join workout_exercises we on we.session_id = s.id
    join workout_sets ws on ws.workout_exercise_id = we.id
      and ws.completed and not coalesce(ws.is_warmup, false)
    where s.user_id = v_me and s.created_at < v_created
    group by we.exercise_id
  ),
  prs as (
    select sb.ex_id, sb.w, sb.orm, coalesce(pb.orm, 0) as prev
    from session_best sb
    left join prior_best pb on pb.ex_id = sb.ex_id
    where sb.orm > 0 and coalesce(pb.orm, 0) > 0 and sb.orm > coalesce(pb.orm, 0)
  ),
  ins as (
    insert into achievements (user_id, kind, payload)
    select v_me, 'e1rm_pr', jsonb_build_object(
      'session_id', p_session_id, 'exercise_id', ex_id,
      'weight', w, 'orm', orm, 'prev_orm', prev)
    from prs
    returning (payload->>'exercise_id')::uuid as ex_id,
              (payload->>'weight')::numeric as w,
              (payload->>'orm')::numeric as orm,
              (payload->>'prev_orm')::numeric as prev
  )
  select ex_id, w, orm, prev from ins;

  -- ── récord de volumen semanal ──
  select coalesce(sum(set_volume(ws)), 0) into v_week_vol
  from workout_sessions s
  join workout_exercises we on we.session_id = s.id
  join workout_sets ws on ws.workout_exercise_id = we.id
    and ws.completed and not coalesce(ws.is_warmup, false)
  where s.user_id = v_me
    and date_trunc('week', s.created_at) = date_trunc('week', v_created);

  select coalesce(max(wv), 0) into v_prev_max_week from (
    select date_trunc('week', s.created_at) as wk, sum(set_volume(ws)) as wv
    from workout_sessions s
    join workout_exercises we on we.session_id = s.id
    join workout_sets ws on ws.workout_exercise_id = we.id
      and ws.completed and not coalesce(ws.is_warmup, false)
    where s.user_id = v_me
      and date_trunc('week', s.created_at) < date_trunc('week', v_created)
    group by 1
  ) t;

  if v_week_vol > 0 and v_prev_max_week > 0 and v_week_vol > v_prev_max_week then
    insert into achievements (user_id, kind, payload)
    values (v_me, 'volume_pr_week', jsonb_build_object(
      'session_id', p_session_id, 'volume', v_week_vol, 'prev', v_prev_max_week));
  end if;

  -- ── hitos de racha: días consecutivos con sesión, contando hacia atrás
  -- desde el último día entrenado hasta el primer hueco ──
  v_streak := 0;
  select max(s.created_at)::date into v_cur
  from workout_sessions s where s.user_id = v_me;
  while v_cur is not null and exists (
    select 1 from workout_sessions s
    where s.user_id = v_me and s.created_at::date = v_cur
  ) loop
    v_streak := v_streak + 1;
    v_cur := v_cur - 1;
  end loop;

  foreach v_threshold in array array[7, 30, 100] loop
    if v_streak >= v_threshold and not exists (
      select 1 from achievements
      where user_id = v_me and kind = 'streak_milestone'
        and (payload->>'days')::int = v_threshold
    ) then
      insert into achievements (user_id, kind, payload)
      values (v_me, 'streak_milestone', jsonb_build_object('days', v_threshold));
    end if;
  end loop;
end $$;

create or replace function detect_rank_overtakes()
returns table (
  user_id uuid,
  kind text,
  other_name text,
  other_id uuid,
  new_rank integer
)
language plpgsql security definer set search_path = public as $$
#variable_conflict use_column
declare
  r record;
  v_since timestamptz := now() - interval '7 days';
  v_rank integer;
  v_prev integer;
  v_myvol numeric;
  v_ahead uuid;
  v_ahead_val numeric;
  v_behind uuid;
  v_name text;
begin
  for r in
    select p.id as uid from profiles p
    where exists (
      select 1 from friendships f
      where f.status = 'accepted'
        and (f.requester_id = p.id or f.addressee_id = p.id)
    )
  loop
    with scope as (
      select id from friend_ids(r.uid) as t(id)
    ),
    vols as (
      select sc.id as id,
             coalesce(count(ws.id) filter (
               where ws.completed and not coalesce(ws.is_warmup, false)
                 and coalesce(ws.reps, 0) >= 5
                 and (ws.rpe is null or ws.rpe >= 7)
             ), 0)::numeric as vol
      from scope sc
      left join workout_sessions ses
        on ses.user_id = sc.id and ses.created_at >= v_since
      left join workout_exercises we on we.session_id = ses.id
      left join workout_sets ws on ws.workout_exercise_id = we.id
      group by sc.id
    ),
    ranked as (
      select id, vol,
             row_number() over (order by vol desc, id) as rnk
      from vols
    )
    select me.rnk, me.vol, ah.id, ah.vol, be.id
    into v_rank, v_myvol, v_ahead, v_ahead_val, v_behind
    from ranked me
    left join ranked ah on ah.rnk = me.rnk - 1
    left join ranked be on be.rnk = me.rnk + 1
    where me.id = r.uid;

    select rank into v_prev from rank_state where rank_state.user_id = r.uid;

    insert into rank_state (user_id, rank, ahead_id, updated_at)
    values (r.uid, v_rank, v_ahead, now())
    on conflict (user_id) do update
      set rank = excluded.rank, ahead_id = excluded.ahead_id, updated_at = now();

    if v_prev is not null then
      -- Bajaste: te pasó quien ahora está arriba tuyo (con series reales).
      if v_rank > v_prev and v_ahead is not null and coalesce(v_ahead_val, 0) > 0 then
        select coalesce(display_name, username) into v_name from profiles where id = v_ahead;
        user_id := r.uid; kind := 'overtaken'; other_name := v_name;
        other_id := v_ahead; new_rank := v_rank;
        return next;
      -- Subiste: pasaste a quien ahora quedó abajo (si tenés series > 0).
      elsif v_rank < v_prev and coalesce(v_myvol, 0) > 0 then
        if v_behind is not null then
          select coalesce(display_name, username) into v_name from profiles where id = v_behind;
        else
          v_name := null;
        end if;
        user_id := r.uid; kind := 'gained'; other_name := v_name;
        other_id := v_behind; new_rank := v_rank;
        return next;
      end if;
    end if;
  end loop;
end $$;
