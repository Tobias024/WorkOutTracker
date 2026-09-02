-- SPDX-License-Identifier: AGPL-3.0-only
-- Ejercicios custom pasan a ser GLOBALES: cualquiera ve todo el catálogo.
-- Antes `is_custom=true` solo lo veía su creador (RLS), así que un ejercicio
-- custom (ej. un "Gemelos") no aparecía para otros usuarios buscando lo mismo.
-- El INSERT sigue restringido a is_custom=true AND created_by=auth.uid()
-- (policy exercises_insert de 0002), así que nadie puede crear ejercicios de
-- catálogo global ajenos; solo los suyos, que ahora todos pueden ver/usar.
-- Down: recrear `using (is_custom = false or created_by = auth.uid())`.
drop policy if exists exercises_select on exercises;
create policy exercises_select on exercises for select using (true);
