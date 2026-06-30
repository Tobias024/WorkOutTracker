-- WorkOutTracker — Row Level Security
-- Cada usuario sólo accede a sus datos. Los flujos cross-user pasan por RPCs (security definer).

alter table profiles enable row level security;
alter table exercises enable row level security;
alter table routines enable row level security;
alter table routine_exercises enable row level security;
alter table workout_sessions enable row level security;
alter table workout_exercises enable row level security;
alter table workout_sets enable row level security;
alter table exercise_substitutions enable row level security;
alter table friendships enable row level security;
alter table invites enable row level security;

-- ───────────────────────── profiles ─────────────────────────
-- Lectura: uno mismo + amigos aceptados (para amigos/scoreboard).
drop policy if exists profiles_select on profiles;
create policy profiles_select on profiles for select using (
  id = auth.uid()
  or exists (
    select 1 from friendships f
    where f.status = 'accepted'
      and ((f.requester_id = auth.uid() and f.addressee_id = profiles.id)
        or (f.addressee_id = auth.uid() and f.requester_id = profiles.id))
  )
);

drop policy if exists profiles_insert on profiles;
create policy profiles_insert on profiles for insert with check (id = auth.uid());

drop policy if exists profiles_update on profiles;
create policy profiles_update on profiles for update using (id = auth.uid());

-- ───────────────────────── exercises ─────────────────────────
-- Catálogo global legible por todos; ejercicios custom sólo por su creador.
drop policy if exists exercises_select on exercises;
create policy exercises_select on exercises for select using (
  is_custom = false or created_by = auth.uid()
);

drop policy if exists exercises_insert on exercises;
create policy exercises_insert on exercises for insert with check (
  is_custom = true and created_by = auth.uid()
);

drop policy if exists exercises_mutate on exercises;
create policy exercises_mutate on exercises for update using (created_by = auth.uid());

drop policy if exists exercises_delete on exercises;
create policy exercises_delete on exercises for delete using (created_by = auth.uid());

-- ───────────────────────── routines ─────────────────────────
drop policy if exists routines_all on routines;
create policy routines_all on routines for all
  using (owner_id = auth.uid()) with check (owner_id = auth.uid());

drop policy if exists routine_exercises_all on routine_exercises;
create policy routine_exercises_all on routine_exercises for all using (
  exists (select 1 from routines r where r.id = routine_exercises.routine_id and r.owner_id = auth.uid())
) with check (
  exists (select 1 from routines r where r.id = routine_exercises.routine_id and r.owner_id = auth.uid())
);

-- ─────────────────── workout_sessions / exercises / sets ───────────────────
drop policy if exists sessions_all on workout_sessions;
create policy sessions_all on workout_sessions for all
  using (user_id = auth.uid()) with check (user_id = auth.uid());

drop policy if exists workout_exercises_all on workout_exercises;
create policy workout_exercises_all on workout_exercises for all using (
  exists (select 1 from workout_sessions s where s.id = workout_exercises.session_id and s.user_id = auth.uid())
) with check (
  exists (select 1 from workout_sessions s where s.id = workout_exercises.session_id and s.user_id = auth.uid())
);

drop policy if exists workout_sets_all on workout_sets;
create policy workout_sets_all on workout_sets for all using (
  exists (
    select 1 from workout_exercises we
    join workout_sessions s on s.id = we.session_id
    where we.id = workout_sets.workout_exercise_id and s.user_id = auth.uid()
  )
) with check (
  exists (
    select 1 from workout_exercises we
    join workout_sessions s on s.id = we.session_id
    where we.id = workout_sets.workout_exercise_id and s.user_id = auth.uid()
  )
);

-- ─────────────────── exercise_substitutions ───────────────────
drop policy if exists substitutions_all on exercise_substitutions;
create policy substitutions_all on exercise_substitutions for all
  using (user_id = auth.uid()) with check (user_id = auth.uid());

-- ───────────────────────── friendships ─────────────────────────
-- Lectura de las propias; alta vía accept_invite (RPC). Baja: cualquiera de las dos partes.
drop policy if exists friendships_select on friendships;
create policy friendships_select on friendships for select using (
  requester_id = auth.uid() or addressee_id = auth.uid()
);

drop policy if exists friendships_delete on friendships;
create policy friendships_delete on friendships for delete using (
  requester_id = auth.uid() or addressee_id = auth.uid()
);

-- ───────────────────────── invites ─────────────────────────
-- Listar/borrar los propios; alta vía create_invite, aceptación vía accept_invite.
drop policy if exists invites_select on invites;
create policy invites_select on invites for select using (inviter_id = auth.uid());

drop policy if exists invites_delete on invites;
create policy invites_delete on invites for delete using (inviter_id = auth.uid());
