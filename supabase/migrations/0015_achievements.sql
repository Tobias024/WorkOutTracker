-- SPDX-License-Identifier: AGPL-3.0-only
-- Logros / achievements: PRs de e1RM, hitos de racha y récords de volumen semanal.
-- Se calculan al finalizar la sesión vía RPC (sin triggers ni matviews).
-- Down: drop table achievements cascade; drop function record_session_achievements(uuid);

create table if not exists achievements (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references profiles(id) on delete cascade,
  kind text not null, -- 'e1rm_pr' | 'streak_milestone' | 'volume_pr_week'
  payload jsonb not null default '{}',
  created_at timestamptz not null default now()
);
create index if not exists achievements_user_idx on achievements(user_id, created_at desc);

alter table achievements enable row level security;
-- Lectura: sólo los propios. Alta: sólo vía el RPC security-definer (sin policy de insert).
drop policy if exists achievements_select on achievements;
create policy achievements_select on achievements for select using (user_id = auth.uid());

-- Detecta y registra logros de una sesión. Devuelve los PRs de e1RM (para el
-- modal de celebración). security definer: escribe achievements aunque no haya
-- policy de insert, pero valida que la sesión sea del caller.
create or replace function record_session_achievements(p_session_id uuid)
returns table (exercise_id uuid, weight numeric, orm numeric, prev_orm numeric)
language plpgsql security definer set search_path = public as $$
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
