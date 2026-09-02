-- SPDX-License-Identifier: AGPL-3.0-only
-- WorkOutTracker — esquema inicial
-- Tablas, índices, RLS y funciones (RPC). Idempotente donde es razonable.

create extension if not exists "pgcrypto";

-- ───────────────────────────── Tipos ─────────────────────────────
do $$ begin
  create type friendship_status as enum ('pending', 'accepted');
exception when duplicate_object then null; end $$;

-- ──────────────────────────── Tablas ─────────────────────────────

create table if not exists profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  username text unique,
  display_name text,
  avatar_url text,
  created_at timestamptz not null default now()
);

create table if not exists exercises (
  id uuid primary key default gen_random_uuid(),
  slug text unique not null,
  name text not null,
  category text,
  equipment text,
  primary_muscles text[] not null default '{}',
  secondary_muscles text[] not null default '{}',
  mechanic text,
  level text,
  force text,
  instructions text[] not null default '{}',
  images text[] not null default '{}',
  is_custom boolean not null default false,
  created_by uuid references profiles (id) on delete cascade,
  created_at timestamptz not null default now()
);
create index if not exists exercises_name_idx on exercises using gin (to_tsvector('simple', name));
create index if not exists exercises_custom_idx on exercises (is_custom, created_by);

create table if not exists routines (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references profiles (id) on delete cascade,
  name text not null,
  description text,
  share_code text unique,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists routines_owner_idx on routines (owner_id);

create table if not exists routine_exercises (
  id uuid primary key default gen_random_uuid(),
  routine_id uuid not null references routines (id) on delete cascade,
  exercise_id uuid not null references exercises (id),
  position integer not null default 0,
  target_sets integer,
  target_reps integer,
  notes text,
  superset_group integer
);
create index if not exists routine_exercises_routine_idx on routine_exercises (routine_id, position);

create table if not exists workout_sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references profiles (id) on delete cascade,
  routine_id uuid references routines (id) on delete set null,
  name text not null default 'Entrenamiento',
  started_at timestamptz,
  ended_at timestamptz,
  duration_seconds integer,
  notes text,
  created_at timestamptz not null default now()
);
create index if not exists sessions_user_idx on workout_sessions (user_id, created_at desc);

create table if not exists workout_exercises (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references workout_sessions (id) on delete cascade,
  exercise_id uuid not null references exercises (id),
  routine_exercise_id uuid references routine_exercises (id) on delete set null,
  position integer not null default 0,
  replaced_from_exercise_id uuid references exercises (id),
  notes text
);
create index if not exists workout_exercises_session_idx on workout_exercises (session_id, position);

create table if not exists workout_sets (
  id uuid primary key default gen_random_uuid(),
  workout_exercise_id uuid not null references workout_exercises (id) on delete cascade,
  set_number integer not null default 1,
  reps integer,
  weight numeric(7, 2),
  rpe numeric(3, 1),
  comment text,
  is_warmup boolean not null default false,
  completed boolean not null default false
);
create index if not exists workout_sets_we_idx on workout_sets (workout_exercise_id, set_number);

create table if not exists exercise_substitutions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references profiles (id) on delete cascade,
  routine_exercise_id uuid not null references routine_exercises (id) on delete cascade,
  substitute_exercise_id uuid not null references exercises (id),
  created_at timestamptz not null default now(),
  unique (user_id, routine_exercise_id)
);

create table if not exists friendships (
  id uuid primary key default gen_random_uuid(),
  requester_id uuid not null references profiles (id) on delete cascade,
  addressee_id uuid not null references profiles (id) on delete cascade,
  status friendship_status not null default 'accepted',
  created_at timestamptz not null default now(),
  check (requester_id <> addressee_id),
  unique (requester_id, addressee_id)
);
create index if not exists friendships_requester_idx on friendships (requester_id);
create index if not exists friendships_addressee_idx on friendships (addressee_id);

create table if not exists invites (
  code text primary key,
  inviter_id uuid not null references profiles (id) on delete cascade,
  expires_at timestamptz,
  used_by uuid references profiles (id),
  created_at timestamptz not null default now()
);

-- ─────────────────── Triggers de soporte ───────────────────

-- updated_at automático en routines.
create or replace function set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at := now();
  return new;
end $$;

drop trigger if exists routines_updated_at on routines;
create trigger routines_updated_at before update on routines
  for each row execute function set_updated_at();

-- Crea el perfil al registrarse un usuario.
create or replace function handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, display_name)
  values (new.id, coalesce(new.raw_user_meta_data ->> 'name', new.raw_user_meta_data ->> 'full_name'))
  on conflict (id) do nothing;
  return new;
end $$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created after insert on auth.users
  for each row execute function handle_new_user();

-- ──────────────────────── Funciones (RPC) ────────────────────────

-- Conjunto de IDs "visibles" para métricas sociales: uno mismo + amigos aceptados.
create or replace function friend_ids(p_uid uuid)
returns setof uuid language sql stable security definer set search_path = public as $$
  select p_uid
  union
  select case when requester_id = p_uid then addressee_id else requester_id end
  from friendships
  where status = 'accepted' and (requester_id = p_uid or addressee_id = p_uid);
$$;

-- Genera un link de invitación (código corto). Devuelve el código.
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

-- Acepta una invitación y crea la amistad. Devuelve el id del invitador.
create or replace function accept_invite(p_code text)
returns uuid language plpgsql security definer set search_path = public as $$
declare
  v_inviter uuid;
  v_me uuid := auth.uid();
begin
  if v_me is null then raise exception 'No autenticado'; end if;

  select inviter_id into v_inviter from invites
  where code = p_code and (expires_at is null or expires_at > now());

  if v_inviter is null then raise exception 'Invitación inválida o vencida'; end if;
  if v_inviter = v_me then raise exception 'No podés agregarte a vos mismo'; end if;

  insert into friendships (requester_id, addressee_id, status)
  values (v_inviter, v_me, 'accepted')
  on conflict (requester_id, addressee_id) do update set status = 'accepted';

  -- evita duplicado en sentido inverso
  delete from friendships
  where requester_id = v_me and addressee_id = v_inviter;

  update invites set used_by = v_me where code = p_code and used_by is null;
  return v_inviter;
end $$;

-- Importa una rutina compartida (copia rutina + ejercicios, sin pesos). Devuelve el nuevo id.
create or replace function import_routine(p_share_code text)
returns uuid language plpgsql security definer set search_path = public as $$
declare
  v_src routines%rowtype;
  v_new uuid;
  v_me uuid := auth.uid();
begin
  if v_me is null then raise exception 'No autenticado'; end if;

  select * into v_src from routines where share_code = p_share_code;
  if v_src.id is null then raise exception 'Rutina no encontrada'; end if;

  insert into routines (owner_id, name, description)
  values (v_me, v_src.name, v_src.description)
  returning id into v_new;

  insert into routine_exercises (routine_id, exercise_id, position, target_sets, target_reps, notes, superset_group)
  select v_new, exercise_id, position, target_sets, target_reps, notes, superset_group
  from routine_exercises where routine_id = v_src.id;

  return v_new;
end $$;

-- Vista previa de una rutina compartida (sin exponer pesos ni dueño).
create or replace function preview_routine(p_share_code text)
returns json language plpgsql stable security definer set search_path = public as $$
declare
  v_routine routines%rowtype;
  v_exercises json;
begin
  select * into v_routine from routines where share_code = p_share_code;
  if v_routine.id is null then return null; end if;

  select coalesce(json_agg(json_build_object(
           'name', e.name,
           'image', case when array_length(e.images, 1) > 0 then e.images[1] else null end,
           'target_sets', re.target_sets,
           'target_reps', re.target_reps
         ) order by re.position), '[]'::json)
  into v_exercises
  from routine_exercises re
  join exercises e on e.id = re.exercise_id
  where re.routine_id = v_routine.id;

  return json_build_object(
    'name', v_routine.name,
    'description', v_routine.description,
    'exercises', v_exercises
  );
end $$;

-- Estadísticas de scoreboard entre amigos.
-- p_metric: 'volume' | 'frequency' | 'weight'. p_exercise_id requerido para 'weight'.
create or replace function scoreboard_stats(p_metric text, p_since timestamptz, p_exercise_id uuid default null)
returns table (user_id uuid, username text, display_name text, value numeric)
language plpgsql stable security definer set search_path = public as $$
begin
  if p_metric = 'volume' then
    return query
      select p.id, p.username, p.display_name,
             coalesce(sum(ws.reps * ws.weight), 0)::numeric as value
      from profiles p
      join friend_ids(auth.uid()) f(id) on f.id = p.id
      left join workout_sessions s on s.user_id = p.id and s.created_at >= p_since
      left join workout_exercises we on we.session_id = s.id
      left join workout_sets ws on ws.workout_exercise_id = we.id and ws.completed
      group by p.id, p.username, p.display_name
      order by value desc;

  elsif p_metric = 'frequency' then
    return query
      select p.id, p.username, p.display_name,
             count(distinct date_trunc('day', s.created_at))::numeric as value
      from profiles p
      join friend_ids(auth.uid()) f(id) on f.id = p.id
      left join workout_sessions s on s.user_id = p.id and s.created_at >= p_since
      group by p.id, p.username, p.display_name
      order by value desc;

  elsif p_metric = 'weight' then
    return query
      select p.id, p.username, p.display_name,
             coalesce(max(ws.weight), 0)::numeric as value
      from profiles p
      join friend_ids(auth.uid()) f(id) on f.id = p.id
      left join workout_sessions s on s.user_id = p.id and s.created_at >= p_since
      left join workout_exercises we on we.session_id = s.id
        and (we.exercise_id = p_exercise_id or we.replaced_from_exercise_id = p_exercise_id)
      left join workout_sets ws on ws.workout_exercise_id = we.id and ws.completed
      group by p.id, p.username, p.display_name
      order by value desc;
  else
    raise exception 'Métrica inválida: %', p_metric;
  end if;
end $$;
