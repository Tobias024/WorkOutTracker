-- Alinea la métrica de detect_rank_overtakes con la del ranking (scoreboard):
-- usa set_volume(ws) y excluye calentamientos, en vez de reps*weight crudo con
-- todos los sets completados. Así "quién te pasó" coincide con lo que muestra el
-- scoreboard. El resto de la lógica (ventana 7 días, siembra rank_state, condición
-- de aviso) queda igual que en 0007.
-- Down: re-aplicar 0007 (create or replace con sum(ws.reps * ws.weight)).

create or replace function detect_rank_overtakes()
returns table (user_id uuid, by_name text, by_id uuid)
language plpgsql security definer set search_path = public as $$
declare
  r record;
  v_since timestamptz := now() - interval '7 days';
  v_rank integer;
  v_prev integer;
  v_ahead uuid;
  v_ahead_val numeric;
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
             coalesce(sum(set_volume(ws)), 0)::numeric as vol
      from scope sc
      left join workout_sessions ses
        on ses.user_id = sc.id and ses.created_at >= v_since
      left join workout_exercises we on we.session_id = ses.id
      left join workout_sets ws
        on ws.workout_exercise_id = we.id
        and ws.completed and not coalesce(ws.is_warmup, false)
      group by sc.id
    ),
    ranked as (
      select id, vol,
             row_number() over (order by vol desc, id) as rnk
      from vols
    )
    select me.rnk, ah.id, ah.vol
    into v_rank, v_ahead, v_ahead_val
    from ranked me
    left join ranked ah on ah.rnk = me.rnk - 1
    where me.id = r.uid;

    select rank into v_prev from rank_state where rank_state.user_id = r.uid;

    insert into rank_state (user_id, rank, ahead_id, updated_at)
    values (r.uid, v_rank, v_ahead, now())
    on conflict (user_id) do update
      set rank = excluded.rank,
          ahead_id = excluded.ahead_id,
          updated_at = now();

    -- Notifica sólo si: había estado previo, empeoró el puesto, y quien está
    -- ahora arriba tiene volumen real (>0). Evita ruido del primer cálculo y
    -- de rankings todos-en-cero.
    if v_prev is not null and v_rank > v_prev
       and v_ahead is not null and coalesce(v_ahead_val, 0) > 0 then
      select coalesce(display_name, username) into v_name
      from profiles where id = v_ahead;
      user_id := r.uid;
      by_name := v_name;
      by_id := v_ahead;
      return next;
    end if;
  end loop;
end $$;
