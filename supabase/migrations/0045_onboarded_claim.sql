-- SPDX-License-Identifier: AGPL-3.0-only
-- Claim "onboarded" en el JWT para que el layout no consulte profiles en cada
-- navegación.
--
-- Cuando un perfil tiene username (onboarding completo), se marca
-- raw_app_meta_data.onboarded = true en auth.users. Se usa app_metadata y NO
-- user_metadata porque este último lo puede editar el propio usuario; app_metadata
-- sólo se escribe con service role / desde el servidor. El claim viaja en el
-- JWT desde el próximo refresh del token; el layout lo lee con getClaims y sólo
-- consulta profiles cuando falta (usuarios con token viejo o sin onboarding).
--
-- El update a auth.users va en un bloque con exception aislado: si fallara
-- (permisos, cambio de esquema de auth), se emite un warning pero NUNCA se
-- bloquea el alta/edición del perfil.
--
-- SECURITY DEFINER (owner postgres, que puede actualizar auth.users); se
-- revoca la ejecución directa: sólo debe correr como trigger.
--
-- Down:
--   drop trigger profiles_sync_onboarded_claim on profiles;
--   drop function public.sync_onboarded_claim();
--   (el claim ya escrito en auth.users queda; el layout cae a consultar profiles.)

create or replace function public.sync_onboarded_claim()
returns trigger
language plpgsql
security definer
set search_path = public, auth
as $$
begin
  begin
    update auth.users
       set raw_app_meta_data = coalesce(raw_app_meta_data, '{}'::jsonb) || '{"onboarded": true}'::jsonb
     where id = new.id;
  exception when others then
    raise warning 'sync_onboarded_claim: %', sqlerrm;
  end;
  return new;
end $$;

revoke execute on function public.sync_onboarded_claim() from public, anon, authenticated;

drop trigger if exists profiles_sync_onboarded_claim on profiles;
create trigger profiles_sync_onboarded_claim
  after insert or update of username on profiles
  for each row
  when (new.username is not null)
  execute function public.sync_onboarded_claim();

-- Backfill de los usuarios que ya completaron el onboarding.
update auth.users u
   set raw_app_meta_data = coalesce(u.raw_app_meta_data, '{}'::jsonb) || '{"onboarded": true}'::jsonb
  from profiles p
 where p.id = u.id and p.username is not null;
