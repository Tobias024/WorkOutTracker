-- SPDX-License-Identifier: AGPL-3.0-only
-- Dos RPCs nuevas (aditivas: el front actual no las usa, es seguro aplicarlas antes del deploy).
--
-- 1) swap_positions: intercambia la posición de dos routine_exercises de la
--    misma rutina en UN solo UPDATE atómico. Las posiciones se leen de la DB
--    (no las manda el cliente). SECURITY INVOKER: la RLS de routine_exercises
--    ya limita a rutinas propias; si alguna fila no es visible, falla.
-- 2) my_friends: perfiles mínimos (id, username, display_name, goal) de los
--    amigos ACEPTADOS del caller, sin incluirse. Es el primer paso para dejar
--    de exponer peso/altura de amigos por la policy profiles_select; la
--    restricción de esa policy va en una migración posterior, cuando el front
--    ya no lea profiles ajenos.
--
-- Down:
--   drop function if exists public.swap_positions(uuid, uuid);
--   drop function if exists public.my_friends();

create or replace function public.swap_positions(p_a uuid, p_b uuid)
returns void language plpgsql security invoker set search_path = public as $$
declare
  v_a routine_exercises%rowtype;
  v_b routine_exercises%rowtype;
begin
  if p_a is null or p_b is null or p_a = p_b then
    raise exception 'Ejercicios inválidos para intercambiar';
  end if;

  -- Lock en orden determinista para evitar deadlocks entre swaps cruzados.
  perform 1 from routine_exercises
    where id in (p_a, p_b) order by id for update;

  select * into v_a from routine_exercises where id = p_a;
  select * into v_b from routine_exercises where id = p_b;

  if v_a.id is null or v_b.id is null then
    raise exception 'Ejercicio de rutina no encontrado';
  end if;
  if v_a.routine_id is distinct from v_b.routine_id then
    raise exception 'Los ejercicios pertenecen a rutinas distintas';
  end if;

  update routine_exercises
     set position = case when id = p_a then v_b.position else v_a.position end
   where id in (p_a, p_b);
end $$;

revoke execute on function public.swap_positions(uuid, uuid) from public, anon;
grant execute on function public.swap_positions(uuid, uuid) to authenticated;

create or replace function public.my_friends()
returns table (id uuid, username text, display_name text, goal text)
language sql stable security definer set search_path = public as $$
  select p.id, p.username, p.display_name, p.goal
  from profiles p
  where auth.uid() is not null
    and p.id <> auth.uid()
    and exists (
      select 1 from friendships f
      where f.status = 'accepted'
        and ((f.requester_id = auth.uid() and f.addressee_id = p.id)
          or (f.addressee_id = auth.uid() and f.requester_id = p.id))
    );
$$;

revoke execute on function public.my_friends() from public, anon;
grant execute on function public.my_friends() to authenticated;
