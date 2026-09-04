@AGENTS.md

# ⚠ Migraciones sin aplicar

`supabase/migrations/0034_planned_set_targets.sql` y `0035_hard_sets_by_goal.sql`
se escribieron sin acceso a la base y **nunca se ejecutaron**. Antes de tocar
nada del esquema, del ranking o de las series efectivas, leé **`PENDIENTE.md`**
en la raíz: tiene qué correr, qué chequear después, el down de cada una y una
decisión de diseño abierta sobre las zonas de RIR.

Borrá `PENDIENTE.md` y esta sección cuando las dos migraciones hayan corrido bien.
