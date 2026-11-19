-- SPDX-License-Identifier: AGPL-3.0-only
-- Servidor MCP remoto + bridge OAuth 2.1 (DCR + PKCE) para que cada usuario
-- conecte su propia IA a WOLF, reemplazando el export/import de .xlsx.
--
-- Modelo de confianza (clave para todo lo que sigue): las funciones mcp_*
-- (las "tools" que llama la IA conectada) nunca reciben ni confían en un
-- p_user_id — todas derivan el usuario EXCLUSIVAMENTE de
-- mcp_authenticate(p_access_token). Esto es necesario porque, como toda RPC
-- de este repo, son alcanzables directo vía PostgREST con la anon key, no
-- sólo a través de /mcp — si confiaran en un id recibido como parámetro,
-- cualquiera podría operar "en nombre de" otro usuario adivinando su uuid.
--
-- oauth_clients/oauth_codes/oauth_tokens/oauth_events quedan con RLS
-- habilitada y SIN ninguna policy (deny-all total para anon/authenticated),
-- mismo criterio que la tabla `invites`: sólo se tocan desde funciones
-- security definer. Las dos excepciones de autoservicio
-- (list_my_oauth_connections/revoke_oauth_connection) siguen usando
-- auth.uid() normal porque corren con la sesión del browser en /perfil.

-- ──────────────────────────── Tablas ─────────────────────────────

create table if not exists oauth_clients (
  client_id text primary key,
  client_name text not null,
  redirect_uris text[] not null,
  created_at timestamptz not null default now()
);

create table if not exists oauth_codes (
  code text primary key,
  client_id text not null references oauth_clients (client_id) on delete cascade,
  user_id uuid not null references profiles (id) on delete cascade,
  redirect_uri text not null,
  code_challenge text not null,
  code_challenge_method text not null default 'S256',
  expires_at timestamptz not null default now() + interval '5 minutes',
  used_at timestamptz,
  created_at timestamptz not null default now()
);
create index if not exists oauth_codes_user_idx on oauth_codes (user_id);

-- Nunca se borra una fila al rotar un refresh_token (se marca revoked_at e
-- inserta una fila nueva) — necesario para poder detectar el REUSO de un
-- refresh_token ya rotado, señal clásica de robo (ver refresh_oauth_token).
create table if not exists oauth_tokens (
  id uuid not null default gen_random_uuid(),
  access_token text primary key,
  refresh_token text unique not null,
  client_id text not null references oauth_clients (client_id) on delete cascade,
  user_id uuid not null references profiles (id) on delete cascade,
  access_token_expires_at timestamptz not null,
  refresh_token_expires_at timestamptz,
  revoked_at timestamptz,
  created_at timestamptz not null default now()
);
create index if not exists oauth_tokens_user_idx on oauth_tokens (user_id, revoked_at);
create index if not exists oauth_tokens_refresh_idx on oauth_tokens (refresh_token);

-- Auditoría mínima (registro de cliente, code emitido/canjeado, token
-- refrescado/revocado, reuso de refresh token detectado). Sin RPC de lectura
-- en v1 — sólo consultable por el dueño del proyecto vía el dashboard de
-- Supabase, para tener rastro si alguna vez hay que investigar algo.
create table if not exists oauth_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references profiles (id) on delete cascade,
  client_id text references oauth_clients (client_id) on delete cascade,
  event_type text not null,
  detail jsonb,
  created_at timestamptz not null default now()
);
create index if not exists oauth_events_user_idx on oauth_events (user_id, created_at desc);

alter table oauth_clients enable row level security;
alter table oauth_codes enable row level security;
alter table oauth_tokens enable row level security;
alter table oauth_events enable row level security;
-- A propósito: ninguna policy en las 4 tablas. Deny-all para anon/authenticated.

-- ──────────────────── Bridge OAuth (RPCs) ────────────────────

-- Dynamic Client Registration (RFC 7591). Sin auth.uid(): se llama antes de
-- cualquier login humano. Clientes públicos (sin secret, PKCE-only).
create or replace function register_oauth_client(p_client_name text, p_redirect_uris text[])
returns text language plpgsql security definer set search_path = public, extensions as $$
declare
  v_uri text;
  v_client_id text;
begin
  if p_client_name is null or length(trim(p_client_name)) = 0 then
    raise exception 'client_name es requerido';
  end if;
  if p_redirect_uris is null or array_length(p_redirect_uris, 1) is null then
    raise exception 'redirect_uris es requerido';
  end if;

  -- https para cualquier cliente, o loopback (RFC 8252) para clientes
  -- nativos tipo Claude Desktop, que redirigen a un puerto local efímero.
  foreach v_uri in array p_redirect_uris loop
    if not (
      v_uri like 'https://%'
      or v_uri like 'http://localhost:%' or v_uri like 'http://localhost/%' or v_uri = 'http://localhost'
      or v_uri like 'http://127.0.0.1:%' or v_uri like 'http://127.0.0.1/%' or v_uri = 'http://127.0.0.1'
    ) then
      raise exception 'redirect_uri inválida (debe ser https:// o loopback http://localhost|127.0.0.1): %', v_uri;
    end if;
  end loop;

  v_client_id := encode(gen_random_bytes(16), 'hex');
  insert into oauth_clients (client_id, client_name, redirect_uris)
  values (v_client_id, trim(p_client_name), p_redirect_uris);

  insert into oauth_events (client_id, event_type, detail)
  values (v_client_id, 'client_registered', jsonb_build_object('client_name', p_client_name));

  return v_client_id;
end $$;

-- Sólo el nombre del cliente, para mostrar en la pantalla de consentimiento.
-- Safe de exponer sin auth (no hay nada sensible en un client_name).
create or replace function get_oauth_client_public_info(p_client_id text)
returns text language sql stable security definer set search_path = public as $$
  select client_name from oauth_clients where client_id = p_client_id;
$$;

-- Emite un authorization code. Requiere auth.uid(): corre con la sesión del
-- browser logueado en WOLF (desde /oauth/authorize/approve).
create or replace function create_oauth_code(
  p_client_id text,
  p_redirect_uri text,
  p_code_challenge text,
  p_code_challenge_method text default 'S256',
  p_resource text default null -- RFC 8707, se acepta pero se ignora (AS+RS combinado para un solo recurso)
)
returns text language plpgsql security definer set search_path = public, extensions as $$
declare
  v_me uuid := auth.uid();
  v_client oauth_clients%rowtype;
  v_code text;
begin
  if v_me is null then raise exception 'No autenticado'; end if;
  if p_code_challenge_method <> 'S256' then
    raise exception 'code_challenge_method no soportado (sólo S256): %', p_code_challenge_method;
  end if;

  select * into v_client from oauth_clients where client_id = p_client_id;
  if v_client.client_id is null then
    raise exception 'Cliente OAuth desconocido';
  end if;
  -- Match exacto contra lo registrado, nunca por prefijo (evita open redirect).
  if not (p_redirect_uri = any (v_client.redirect_uris)) then
    raise exception 'redirect_uri no registrada para este cliente';
  end if;

  v_code := encode(gen_random_bytes(32), 'hex');
  insert into oauth_codes (code, client_id, user_id, redirect_uri, code_challenge, code_challenge_method)
  values (v_code, p_client_id, v_me, p_redirect_uri, p_code_challenge, p_code_challenge_method);

  insert into oauth_events (user_id, client_id, event_type)
  values (v_me, p_client_id, 'code_issued');

  return v_code;
end $$;

-- Canjea el code por tokens. SIN auth.uid(): es server-to-server (sin cookie
-- de sesión); la autoridad es poseer un code de un solo uso + el
-- code_verifier correcto (PKCE S256 — nunca se acepta "plain").
create or replace function exchange_oauth_code(
  p_code text,
  p_code_verifier text,
  p_client_id text,
  p_redirect_uri text,
  p_resource text default null
)
returns table (access_token text, refresh_token text, expires_in int)
language plpgsql security definer set search_path = public, extensions as $$
declare
  v_row oauth_codes%rowtype;
  v_computed text;
  v_access text;
  v_refresh text;
begin
  select * into v_row from oauth_codes where code = p_code;
  if v_row.code is null then
    raise exception 'invalid_grant: code inválido';
  end if;
  if v_row.used_at is not null then
    raise exception 'invalid_grant: code ya utilizado';
  end if;
  if v_row.expires_at <= now() then
    raise exception 'invalid_grant: code vencido';
  end if;
  if v_row.client_id <> p_client_id or v_row.redirect_uri <> p_redirect_uri then
    raise exception 'invalid_grant: client_id o redirect_uri no coinciden';
  end if;

  if length(p_code_verifier) < 43 or length(p_code_verifier) > 128 then
    raise exception 'invalid_grant: code_verifier con longitud inválida';
  end if;

  -- base64url(sha256(code_verifier)), sin padding. digest()/gen_random_bytes
  -- viven en el schema "extensions" en Supabase (de ahí el search_path).
  v_computed := replace(replace(
    rtrim(encode(digest(p_code_verifier, 'sha256'), 'base64'), '='),
  '+', '-'), '/', '_');
  if v_computed <> v_row.code_challenge then
    raise exception 'invalid_grant: PKCE inválido';
  end if;

  update oauth_codes set used_at = now() where code = p_code;

  v_access := 'wolf_at_' || encode(gen_random_bytes(32), 'hex');
  v_refresh := 'wolf_rt_' || encode(gen_random_bytes(32), 'hex');

  insert into oauth_tokens
    (access_token, refresh_token, client_id, user_id, access_token_expires_at, refresh_token_expires_at)
  values
    (v_access, v_refresh, p_client_id, v_row.user_id, now() + interval '1 hour', now() + interval '180 days');

  insert into oauth_events (user_id, client_id, event_type)
  values (v_row.user_id, p_client_id, 'token_issued');

  return query select v_access, v_refresh, 3600;
end $$;

-- Rota access+refresh token. Sin auth.uid() (misma lógica de confianza:
-- posesión del refresh_token). Si el refresh_token presentado ya estaba
-- revocado por una rotación previa (no por un logout manual), es la señal
-- clásica de robo: se revoca en cascada TODO lo de ese user+client.
create or replace function refresh_oauth_token(p_refresh_token text, p_client_id text)
returns table (access_token text, refresh_token text, expires_in int)
language plpgsql security definer set search_path = public, extensions as $$
declare
  v_row oauth_tokens%rowtype;
  v_access text;
  v_refresh text;
begin
  select * into v_row from oauth_tokens where refresh_token = p_refresh_token;

  if v_row.access_token is null then
    raise exception 'invalid_grant: refresh_token inválido';
  end if;
  if v_row.client_id <> p_client_id then
    raise exception 'invalid_grant: client_id no coincide';
  end if;

  if v_row.revoked_at is not null then
    update oauth_tokens set revoked_at = now()
    where user_id = v_row.user_id and client_id = v_row.client_id and revoked_at is null;

    insert into oauth_events (user_id, client_id, event_type)
    values (v_row.user_id, v_row.client_id, 'refresh_token_reuse_detected');

    raise exception 'invalid_grant: refresh_token ya utilizado';
  end if;

  if v_row.refresh_token_expires_at is not null and v_row.refresh_token_expires_at <= now() then
    raise exception 'invalid_grant: refresh_token vencido';
  end if;

  update oauth_tokens set revoked_at = now() where access_token = v_row.access_token;

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

-- ──────────────── Autenticación de las tools MCP ────────────────

-- El punto central de seguridad de todo este archivo: toda función mcp_*
-- deriva el usuario EXCLUSIVAMENTE de acá, nunca de un p_user_id.
create or replace function mcp_authenticate(p_access_token text)
returns uuid language plpgsql stable security definer set search_path = public as $$
declare
  v_user uuid;
begin
  select user_id into v_user from oauth_tokens
  where access_token = p_access_token
    and revoked_at is null
    and access_token_expires_at > now();
  if v_user is null then
    raise exception 'Token inválido o vencido';
  end if;
  return v_user;
end $$;

-- ──────────── Autoservicio de conexiones (para /perfil) ────────────
-- Usan auth.uid() normal (corren con la sesión del browser). Nunca exponen
-- el token crudo — sólo un id de fila + metadata para mostrar/revocar.

create or replace function list_my_oauth_connections()
returns table (id uuid, client_name text, created_at timestamptz, access_token_expires_at timestamptz)
language sql stable security definer set search_path = public as $$
  select t.id, c.client_name, t.created_at, t.access_token_expires_at
  from oauth_tokens t
  join oauth_clients c on c.client_id = t.client_id
  where t.user_id = auth.uid() and t.revoked_at is null
  order by t.created_at desc;
$$;

create or replace function revoke_oauth_connection(p_id uuid)
returns void language plpgsql security definer set search_path = public as $$
declare
  v_me uuid := auth.uid();
begin
  if v_me is null then raise exception 'No autenticado'; end if;

  update oauth_tokens set revoked_at = now()
  where id = p_id and user_id = v_me and revoked_at is null;

  if found then
    insert into oauth_events (user_id, event_type) values (v_me, 'token_revoked_by_user');
  end if;
end $$;

-- ──────────────────────── Tools del servidor MCP ────────────────────────
-- Todas arrancan con v_user := mcp_authenticate(p_access_token). Las que
-- escriben validan tamaño/forma del jsonb de entrada y levantan excepciones
-- describiendo QUÉ ítem falló, para que la IA conectada pueda autocorregirse.

create or replace function mcp_list_exercises(p_access_token text)
returns setof exercises
language plpgsql stable security definer set search_path = public as $$
declare
  v_user uuid := mcp_authenticate(p_access_token);
begin
  return query select * from exercises order by name;
end $$;

-- Reusa set_estimate_1rm() (fórmula de Epley, ya existente desde 0009) para
-- el mejor 1RM estimado; last_weight/last_reps toman el valor "plano" del
-- set más reciente (igual que hacía src/lib/routine-template.ts en JS).
create or replace function mcp_get_progress(p_access_token text)
returns table (
  exercise_id uuid,
  best_e1rm numeric,
  last_weight numeric,
  last_reps integer,
  last_date date,
  times integer
)
language plpgsql stable security definer set search_path = public as $$
declare
  v_user uuid := mcp_authenticate(p_access_token);
begin
  return query
    with sets as (
      select we.exercise_id as ex_id, ws as ws_row, ws.weight, ws.reps, ws.set_number,
             coalesce(s.started_at, s.created_at) as occurred_at
      from workout_sessions s
      join workout_exercises we on we.session_id = s.id
      join workout_sets ws on ws.workout_exercise_id = we.id and ws.completed
      where s.user_id = v_user
    ),
    agg as (
      select ex_id, max(set_estimate_1rm(ws_row)) as best_e1rm, count(*) as times
      from sets
      group by ex_id
    ),
    last_per_ex as (
      select distinct on (ex_id) ex_id, weight as last_weight, reps as last_reps,
             occurred_at::date as last_date
      from sets
      order by ex_id, occurred_at desc, set_number desc
    )
    select agg.ex_id, agg.best_e1rm, last_per_ex.last_weight, last_per_ex.last_reps,
           last_per_ex.last_date, agg.times::integer
    from agg
    join last_per_ex using (ex_id)
    order by agg.times desc;
end $$;

create or replace function mcp_list_routines(p_access_token text)
returns setof routines
language plpgsql stable security definer set search_path = public as $$
declare
  v_user uuid := mcp_authenticate(p_access_token);
begin
  return query select * from routines where owner_id = v_user order by updated_at desc;
end $$;

create or replace function mcp_get_routine(p_access_token text, p_routine_id uuid)
returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare
  v_user uuid := mcp_authenticate(p_access_token);
  v_routine routines%rowtype;
  v_result jsonb;
begin
  select * into v_routine from routines where id = p_routine_id and owner_id = v_user;
  if v_routine.id is null then
    raise exception 'Rutina no encontrada';
  end if;

  select jsonb_build_object(
    'id', v_routine.id,
    'name', v_routine.name,
    'description', v_routine.description,
    'exercises', coalesce(jsonb_agg(jsonb_build_object(
      'exercise_id', re.exercise_id,
      'slug', e.slug,
      'name', e.name,
      'position', re.position,
      'notes', re.notes,
      'sets', (
        select coalesce(jsonb_agg(jsonb_build_object(
          'set_number', rs.set_number,
          'target_reps', rs.target_reps,
          'target_weight', rs.target_weight,
          'target_duration_seconds', rs.target_duration_seconds,
          'target_distance_m', rs.target_distance_m
        ) order by rs.set_number), '[]'::jsonb)
        from routine_sets rs where rs.routine_exercise_id = re.id
      )
    ) order by re.position), '[]'::jsonb)
  )
  into v_result
  from routine_exercises re
  join exercises e on e.id = re.exercise_id
  where re.routine_id = v_routine.id;

  return v_result;
end $$;

-- Interno: valida slugs, borra los ejercicios/series actuales de la rutina y
-- los reinserta desde p_items. Usado por mcp_create_routine (donde el delete
-- es un no-op, la rutina recién se creó) y mcp_update_routine (reemplazo
-- total, sin diff parcial). Recibe el token y re-valida ownership — NO es
-- un atajo inseguro aunque no se exponga como tool propia: sigue siendo
-- alcanzable directo vía PostgREST como cualquier otra función de este archivo.
create or replace function mcp_set_routine_items(p_access_token text, p_routine_id uuid, p_items jsonb)
returns void language plpgsql security definer set search_path = public as $$
declare
  v_user uuid := mcp_authenticate(p_access_token);
  v_owner uuid;
  v_item jsonb;
  v_set jsonb;
  v_position int := 0;
  v_rex_id uuid;
  v_set_number int;
  v_exercise_id uuid;
  v_unmatched text[] := '{}';
begin
  select owner_id into v_owner from routines where id = p_routine_id;
  if v_owner is null or v_owner <> v_user then
    raise exception 'Rutina no encontrada';
  end if;

  if jsonb_typeof(p_items) is distinct from 'array' or jsonb_array_length(p_items) = 0 then
    raise exception 'p_items debe ser un array con al menos un ejercicio';
  end if;
  if jsonb_array_length(p_items) > 50 then
    raise exception 'Demasiados ejercicios (máximo 50)';
  end if;

  -- Valida TODOS los slugs antes de tocar nada.
  for v_item in select * from jsonb_array_elements(p_items)
  loop
    if not exists (select 1 from exercises where slug = v_item->>'slug') then
      v_unmatched := array_append(v_unmatched, v_item->>'slug');
    end if;
  end loop;
  if array_length(v_unmatched, 1) > 0 then
    raise exception 'Ejercicios no encontrados (usá mcp_list_exercises para ver los slugs válidos): %',
      array_to_string(v_unmatched, ', ');
  end if;

  delete from routine_exercises where routine_id = p_routine_id; -- cascada a routine_sets

  for v_item in select * from jsonb_array_elements(p_items)
  loop
    if jsonb_typeof(v_item->'sets') is distinct from 'array' or jsonb_array_length(v_item->'sets') = 0 then
      raise exception 'El ejercicio % necesita al menos una serie en "sets"', v_item->>'slug';
    end if;
    if jsonb_array_length(v_item->'sets') > 20 then
      raise exception 'El ejercicio % tiene demasiadas series (máximo 20)', v_item->>'slug';
    end if;

    select id into v_exercise_id from exercises where slug = v_item->>'slug';

    insert into routine_exercises (routine_id, exercise_id, position, target_sets, target_reps)
    values (
      p_routine_id, v_exercise_id, v_position,
      jsonb_array_length(v_item->'sets'),
      ((v_item->'sets'->0)->>'reps')::int
    )
    returning id into v_rex_id;

    v_set_number := 0;
    for v_set in select * from jsonb_array_elements(v_item->'sets')
    loop
      v_set_number := v_set_number + 1;
      insert into routine_sets (
        routine_exercise_id, set_number, target_reps, target_weight,
        target_duration_seconds, target_distance_m
      ) values (
        v_rex_id, v_set_number,
        (v_set->>'reps')::int, (v_set->>'weight')::numeric,
        (v_set->>'duration_seconds')::int, (v_set->>'distance_m')::int
      );
    end loop;

    v_position := v_position + 1;
  end loop;
end $$;

-- Atómico (a diferencia de useImportRoutine, que hace inserts secuenciales
-- no atómicos) y popula target_duration_seconds/target_distance_m (gap
-- conocido de useImportRoutine que no hay que heredar acá).
create or replace function mcp_create_routine(p_access_token text, p_name text, p_description text, p_items jsonb)
returns uuid language plpgsql security definer set search_path = public as $$
declare
  v_user uuid := mcp_authenticate(p_access_token);
  v_routine_id uuid;
begin
  insert into routines (owner_id, name, description)
  values (v_user, p_name, p_description)
  returning id into v_routine_id;

  perform mcp_set_routine_items(p_access_token, v_routine_id, p_items);

  return v_routine_id;
end $$;

create or replace function mcp_update_routine(
  p_access_token text, p_routine_id uuid, p_name text, p_description text, p_items jsonb
)
returns void language plpgsql security definer set search_path = public as $$
declare
  v_user uuid := mcp_authenticate(p_access_token);
  v_owner uuid;
begin
  select owner_id into v_owner from routines where id = p_routine_id;
  if v_owner is null or v_owner <> v_user then
    raise exception 'Rutina no encontrada';
  end if;

  update routines set name = p_name, description = p_description where id = p_routine_id;

  perform mcp_set_routine_items(p_access_token, p_routine_id, p_items);
end $$;

create or replace function mcp_delete_routine(p_access_token text, p_routine_id uuid)
returns void language plpgsql security definer set search_path = public as $$
declare
  v_user uuid := mcp_authenticate(p_access_token);
  v_owner uuid;
begin
  select owner_id into v_owner from routines where id = p_routine_id;
  if v_owner is null or v_owner <> v_user then
    raise exception 'Rutina no encontrada';
  end if;
  delete from routines where id = p_routine_id;
end $$;

-- Crea una sesión YA completa (completed=true, valores reales, no "target").
-- completed_at se setea a mano: el trigger stamp_set_completed (0025) es
-- "before UPDATE", no dispara en INSERT.
create or replace function mcp_log_workout_session(
  p_access_token text,
  p_name text,
  p_started_at timestamptz,
  p_ended_at timestamptz,
  p_routine_id uuid,
  p_exercises jsonb
)
returns uuid language plpgsql security definer set search_path = public as $$
declare
  v_user uuid := mcp_authenticate(p_access_token);
  v_session_id uuid;
  v_item jsonb;
  v_set jsonb;
  v_position int := 0;
  v_we_id uuid;
  v_set_number int;
  v_exercise_id uuid;
  v_unmatched text[] := '{}';
  v_completed_at timestamptz := coalesce(p_ended_at, p_started_at, now());
  v_duration int;
begin
  if p_routine_id is not null and not exists (
    select 1 from routines where id = p_routine_id and owner_id = v_user
  ) then
    raise exception 'Rutina no encontrada';
  end if;

  if jsonb_typeof(p_exercises) is distinct from 'array' or jsonb_array_length(p_exercises) = 0 then
    raise exception 'p_exercises debe ser un array con al menos un ejercicio';
  end if;
  if jsonb_array_length(p_exercises) > 50 then
    raise exception 'Demasiados ejercicios (máximo 50)';
  end if;

  for v_item in select * from jsonb_array_elements(p_exercises)
  loop
    if not exists (select 1 from exercises where slug = v_item->>'slug') then
      v_unmatched := array_append(v_unmatched, v_item->>'slug');
    end if;
  end loop;
  if array_length(v_unmatched, 1) > 0 then
    raise exception 'Ejercicios no encontrados (usá mcp_list_exercises para ver los slugs válidos): %',
      array_to_string(v_unmatched, ', ');
  end if;

  v_duration := case
    when p_started_at is not null and p_ended_at is not null
    then extract(epoch from (p_ended_at - p_started_at))::int
    else null
  end;

  insert into workout_sessions (user_id, routine_id, name, started_at, ended_at, duration_seconds)
  values (v_user, p_routine_id, coalesce(p_name, 'Entrenamiento'), p_started_at, p_ended_at, v_duration)
  returning id into v_session_id;

  for v_item in select * from jsonb_array_elements(p_exercises)
  loop
    if jsonb_typeof(v_item->'sets') is distinct from 'array' or jsonb_array_length(v_item->'sets') = 0 then
      raise exception 'El ejercicio % necesita al menos una serie en "sets"', v_item->>'slug';
    end if;
    if jsonb_array_length(v_item->'sets') > 20 then
      raise exception 'El ejercicio % tiene demasiadas series (máximo 20)', v_item->>'slug';
    end if;

    select id into v_exercise_id from exercises where slug = v_item->>'slug';

    insert into workout_exercises (session_id, exercise_id, position, notes)
    values (v_session_id, v_exercise_id, v_position, v_item->>'notes')
    returning id into v_we_id;

    v_set_number := 0;
    for v_set in select * from jsonb_array_elements(v_item->'sets')
    loop
      v_set_number := v_set_number + 1;
      insert into workout_sets (
        workout_exercise_id, set_number, reps, weight,
        duration_seconds, distance_m, comment, completed, completed_at
      ) values (
        v_we_id, v_set_number,
        (v_set->>'reps')::int, (v_set->>'weight')::numeric,
        (v_set->>'duration_seconds')::int, (v_set->>'distance_m')::int,
        v_set->>'comment', true, v_completed_at
      );
    end loop;

    v_position := v_position + 1;
  end loop;

  return v_session_id;
end $$;
