-- Nombre del dueño para las pantallas públicas de invitación y rutina
-- compartida ("{nombre} te invitó a competir en WOLF", "Compartida por {nombre}").
-- Funciones NUEVAS, a propósito: preview_routine mantiene su tipo de retorno.
-- Exponen SOLO el display_name; devuelven null si el código no existe (o la
-- invitación venció). Se pueden llamar sin sesión porque el destinatario
-- todavía no tiene cuenta.

create or replace function public.preview_invite(p_code text)
returns text
language sql stable security definer set search_path = public as $$
  select p.display_name
  from invites i
  join profiles p on p.id = i.inviter_id
  where i.code = p_code
    and (i.expires_at is null or i.expires_at > now())
  limit 1;
$$;

create or replace function public.routine_share_owner(p_share_code text)
returns text
language sql stable security definer set search_path = public as $$
  select p.display_name
  from routines r
  join profiles p on p.id = r.owner_id
  where r.share_code = p_share_code
  limit 1;
$$;

grant execute on function public.preview_invite(text) to anon, authenticated;
grant execute on function public.routine_share_owner(text) to anon, authenticated;
