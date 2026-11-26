-- SPDX-License-Identifier: AGPL-3.0-only
-- Cerrar la ejecución pública de tres funciones SECURITY DEFINER que no deben
-- llamarse desde el cliente. Por los default privileges de Supabase eran
-- ejecutables por anon/authenticated vía /rest/v1/rpc:
--   * detect_rank_overtakes(): muta rank_state y devuelve ids/nombres ajenos.
--   * friend_ids(uuid): enumera los amigos de CUALQUIER usuario.
--   * training_profile_of(uuid): filtra el perfil de entrenamiento de cualquiera.
--
-- Verificación previa (grep en migraciones y src/):
--   * friend_ids y training_profile_of solo se usan dentro de funciones
--     SECURITY DEFINER vigentes (scoreboard_stats, friend_metrics,
--     detect_rank_overtakes): corren como owner, el revoke no las afecta. No
--     hay usos en policies RLS, ni en funciones security invoker (compliance_stats
--     de 0010 no las usa), ni en src/ vía .rpc().
--   * detect_rank_overtakes solo se llama desde src/lib/rank-notify.ts con
--     createAdminClient() (service_role) desde el cron y /api/rank/notify, así
--     que el front no se rompe.
-- Verificación en vivo (antes de aplicar, por si hubo cambios fuera de repo):
--   select proname, prosecdef from pg_proc
--    where prosrc ilike '%friend_ids%' or prosrc ilike '%training_profile_of%';
--   (todas las filas deben tener prosecdef = true)
--
-- Down:
--   grant execute on function detect_rank_overtakes() to public, anon, authenticated;
--   grant execute on function friend_ids(uuid) to public, anon, authenticated;
--   grant execute on function training_profile_of(uuid) to public, anon, authenticated;

revoke execute on function public.detect_rank_overtakes() from public, anon, authenticated;
revoke execute on function public.friend_ids(uuid) from public, anon, authenticated;
revoke execute on function public.training_profile_of(uuid) from public, anon, authenticated;

grant execute on function public.detect_rank_overtakes() to service_role;
grant execute on function public.friend_ids(uuid) to service_role;
grant execute on function public.training_profile_of(uuid) to service_role;
