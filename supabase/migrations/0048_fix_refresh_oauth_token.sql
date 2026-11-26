-- SPDX-License-Identifier: AGPL-3.0-only
-- Arregla refresh_oauth_token (0047): fallaba SIEMPRE con
--   42702 column reference "refresh_token" is ambiguous
-- porque `returns table (access_token, refresh_token, expires_in)` declara
-- variables OUT con el mismo nombre que las columnas de oauth_tokens, y el
-- `where refresh_token = p_refresh_token` sin calificar no compilaba. Ningún
-- refresh funcionó nunca: al vencer el access token (1h) el cliente MCP
-- recibía invalid_grant, descartaba las credenciales y había que re-autorizar
-- a mano. 0047 queda como registro histórico; esta versión la reemplaza.
--
-- Cambios respecto de 0047:
--   * Todas las columnas calificadas con alias (sin ambigüedad con los OUT).
--   * `for update` al leer la fila: dos refresh concurrentes del mismo token
--     ya no pueden rotar ambos; el segundo espera y ve la fila revocada.
--   * Se saca la revocación en cascada + evento "reuse_detected": el `raise`
--     que la seguía hacía rollback de ambas, así que nunca tuvo efecto. El
--     comportamiento observable no cambia (un refresh_token ya rotado se
--     rechaza con invalid_grant); sólo deja de prometer algo que no hacía.

create or replace function refresh_oauth_token(p_refresh_token text, p_client_id text)
returns table (access_token text, refresh_token text, expires_in int)
language plpgsql security definer set search_path = public, extensions as $$
declare
  v_row oauth_tokens%rowtype;
  v_access text;
  v_refresh text;
begin
  select t.* into v_row
  from oauth_tokens t
  where t.refresh_token = p_refresh_token
  for update;

  if v_row.id is null then
    raise exception 'invalid_grant: refresh_token inválido';
  end if;
  if v_row.client_id <> p_client_id then
    raise exception 'invalid_grant: client_id no coincide';
  end if;
  if v_row.revoked_at is not null then
    raise exception 'invalid_grant: refresh_token ya utilizado';
  end if;
  if v_row.refresh_token_expires_at is not null and v_row.refresh_token_expires_at <= now() then
    raise exception 'invalid_grant: refresh_token vencido';
  end if;

  update oauth_tokens t set revoked_at = now() where t.id = v_row.id;

  v_access := 'wolf_at_' || encode(gen_random_bytes(32), 'hex');
  v_refresh := 'wolf_rt_' || encode(gen_random_bytes(32), 'hex');

  insert into oauth_tokens
    (access_token, refresh_token, client_id, user_id, access_token_expires_at, refresh_token_expires_at)
  values
    (v_access, v_refresh, v_row.client_id, v_row.user_id, now() + interval '1 hour', now() + interval '180 days');

  insert into oauth_events (user_id, client_id, event_type)
  values (v_row.user_id, v_row.client_id, 'token_refreshed');

  return query select v_access, v_refresh, 3600;
end $$;
