-- SPDX-License-Identifier: AGPL-3.0-only
-- Notificaciones de ranking en AMBAS direcciones y con la métrica correcta:
-- (a) usa SERIES EFECTIVAS (hard_sets) en vez de tonelaje; (b) además de avisar
-- al que fue superado ('overtaken'), avisa al que subió de puesto ('gained') —
-- así el usuario activo también recibe. Return: kind + el otro usuario + tu
-- nuevo puesto. Down: re-aplicar 0021.
drop function if exists detect_rank_overtakes();

create or replace function detect_rank_overtakes()
returns table (
  user_id uuid,
  kind text,
  other_name text,
  other_id uuid,
  new_rank integer
)
language plpgsql security definer set search_path = public as $$
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
