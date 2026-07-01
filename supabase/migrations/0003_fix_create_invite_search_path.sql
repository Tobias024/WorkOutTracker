-- pgcrypto vive en el esquema "extensions" en Supabase, no en "public".
-- create_invite() necesita ese esquema en el search_path para poder usar gen_random_bytes().
create or replace function create_invite()
returns text language plpgsql security definer set search_path = public, extensions as $$
declare
  v_code text;
begin
  if auth.uid() is null then raise exception 'No autenticado'; end if;
  v_code := encode(gen_random_bytes(8), 'hex');
  insert into invites (code, inviter_id, expires_at)
  values (v_code, auth.uid(), now() + interval '30 days');
  return v_code;
end $$;
