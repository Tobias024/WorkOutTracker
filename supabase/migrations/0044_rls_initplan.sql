-- SPDX-License-Identifier: AGPL-3.0-only
-- RLS: auth.uid() -> (select auth.uid()) en las policies de tablas de usuario.
--
-- Por qué: sin el select envolvente, Postgres re-evalúa auth.uid() (que lee
-- current_setting + jsonb) POR FILA; envuelto en un subselect se convierte en
-- un InitPlan que se calcula una vez por consulta (ver advisor
-- auth_rls_initplan de Supabase). Pesa sobre todo en workout_sets /
-- workout_exercises, que anidan EXISTS.
--
-- Mismo predicado exacto que la definición vigente; sólo cambia el envoltorio
-- y se agrega `to authenticated` (anon nunca pasaba: auth.uid() es null y
-- ningún predicado queda en true, así que el acceso efectivo no cambia).
-- alter policy no cambia el comando (for all/select/...); cuando la policy
-- original no tenía with check, tampoco se agrega (en update cae a using).
--
-- Policies tocadas (definición vigente entre paréntesis):
--   profiles:               profiles_select, profiles_insert, profiles_update (0002)
--   exercises:              exercises_insert, exercises_mutate, exercises_delete (0002)
--   routines:               routines_all (0002)
--   routine_exercises:      routine_exercises_all (0002)
--   workout_sessions:       sessions_all (0002)
--   workout_exercises:      workout_exercises_all (0002)
--   workout_sets:           workout_sets_all (0002)
--   exercise_substitutions: substitutions_all (0002)
--   friendships:            friendships_select, friendships_delete (0002)
--   invites:                invites_select, invites_delete (0002)
--   routine_sets:           routine_sets_all (0006)
--   push_subscriptions:     push_subscriptions_all (0007)
--   weekly_plan_overrides:  weekly_plan_overrides_all (0012)
--   user_exercise_notes:    user_exercise_notes_all (0018)
--   achievements:           achievements_select (0015)
--   sleep_logs:             sleep_logs_all (0023)
--   body_measurements:      body_measurements_all (0024)
--   body_weight_logs:       body_weight_logs_all (0028)
--
-- NO tocadas: exercises_select (0030, using (true): el catálogo se lee sin
-- sesión en /r); routine_schedule (tabla eliminada en 0011); rank_state (RLS
-- sin policies). Si en el dashboard se crearon policies fuera de las
-- migraciones, no se ven acá y quedan como están.
--
-- Down: alter policy <p> on <t> to public using (...) con auth.uid() sin
-- envolver (predicados en 0002/0006/0007/0012/0015/0018/0023/0024/0028).

-- ───────────────────────── profiles ─────────────────────────
alter policy profiles_select on profiles to authenticated using (
  id = (select auth.uid())
  or exists (
    select 1 from friendships f
    where f.status = 'accepted'
      and ((f.requester_id = (select auth.uid()) and f.addressee_id = profiles.id)
        or (f.addressee_id = (select auth.uid()) and f.requester_id = profiles.id))
  )
);

alter policy profiles_insert on profiles to authenticated
  with check (id = (select auth.uid()));

alter policy profiles_update on profiles to authenticated
  using (id = (select auth.uid()));

-- ───────────────────────── exercises ─────────────────────────
alter policy exercises_insert on exercises to authenticated
  with check (is_custom = true and created_by = (select auth.uid()));

alter policy exercises_mutate on exercises to authenticated
  using (created_by = (select auth.uid()));

alter policy exercises_delete on exercises to authenticated
  using (created_by = (select auth.uid()));

-- ───────────────────────── routines ─────────────────────────
alter policy routines_all on routines to authenticated
  using (owner_id = (select auth.uid())) with check (owner_id = (select auth.uid()));

alter policy routine_exercises_all on routine_exercises to authenticated using (
  exists (select 1 from routines r where r.id = routine_exercises.routine_id and r.owner_id = (select auth.uid()))
) with check (
  exists (select 1 from routines r where r.id = routine_exercises.routine_id and r.owner_id = (select auth.uid()))
);

alter policy routine_sets_all on routine_sets to authenticated using (
  exists (
    select 1 from routine_exercises re
    join routines r on r.id = re.routine_id
    where re.id = routine_sets.routine_exercise_id and r.owner_id = (select auth.uid())
  )
) with check (
  exists (
    select 1 from routine_exercises re
    join routines r on r.id = re.routine_id
    where re.id = routine_sets.routine_exercise_id and r.owner_id = (select auth.uid())
  )
);

-- ─────────────────── workout_sessions / exercises / sets ───────────────────
alter policy sessions_all on workout_sessions to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));

alter policy workout_exercises_all on workout_exercises to authenticated using (
  exists (select 1 from workout_sessions s where s.id = workout_exercises.session_id and s.user_id = (select auth.uid()))
) with check (
  exists (select 1 from workout_sessions s where s.id = workout_exercises.session_id and s.user_id = (select auth.uid()))
);

alter policy workout_sets_all on workout_sets to authenticated using (
  exists (
    select 1 from workout_exercises we
    join workout_sessions s on s.id = we.session_id
    where we.id = workout_sets.workout_exercise_id and s.user_id = (select auth.uid())
  )
) with check (
  exists (
    select 1 from workout_exercises we
    join workout_sessions s on s.id = we.session_id
    where we.id = workout_sets.workout_exercise_id and s.user_id = (select auth.uid())
  )
);

-- ─────────────────── tablas simples por user_id ───────────────────
alter policy substitutions_all on exercise_substitutions to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));

alter policy push_subscriptions_all on push_subscriptions to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));

alter policy weekly_plan_overrides_all on weekly_plan_overrides to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));

alter policy user_exercise_notes_all on user_exercise_notes to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));

alter policy sleep_logs_all on sleep_logs to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));

alter policy body_measurements_all on body_measurements to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));

alter policy body_weight_logs_all on body_weight_logs to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));

alter policy achievements_select on achievements to authenticated
  using (user_id = (select auth.uid()));

-- ───────────────────────── friendships / invites ─────────────────────────
alter policy friendships_select on friendships to authenticated
  using (requester_id = (select auth.uid()) or addressee_id = (select auth.uid()));

alter policy friendships_delete on friendships to authenticated
  using (requester_id = (select auth.uid()) or addressee_id = (select auth.uid()));

alter policy invites_select on invites to authenticated
  using (inviter_id = (select auth.uid()));

alter policy invites_delete on invites to authenticated
  using (inviter_id = (select auth.uid()));
