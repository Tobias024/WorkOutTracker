<!-- SPDX-License-Identifier: AGPL-3.0-only -->
# Pendiente de verificar contra Supabase

Las migraciones **0034** y **0035** se escribieron sin acceso a la base: en la
sesión donde se implementaron no había `.env.local`, el MCP de Supabase pedía
autorización y docker estaba sin permisos, así que **nunca se ejecutaron**.
El código TypeScript sí está verificado (`npx tsc --noEmit` limpio, `npm run
build` pasa, lint sin errores nuevos).

Borrá este archivo cuando las dos hayan corrido bien.

## Qué hay que correr

```bash
supabase db push          # aplica 0034 y 0035
```

### `0034_planned_set_targets.sql`

Agrega `planned_reps` / `planned_weight` / `planned_duration_seconds` /
`planned_distance_m` a `workout_sets` y hace un backfill.

- **El backfill es la parte delicada.** Copia `reps`/`weight` → `planned_*`
  **sólo** en sesiones con `ended_at is null` y series con `completed = false`,
  porque únicamente ahí el valor guardado es el plan que copiaba la versión
  vieja de `useStartWorkout`. Las sesiones cerradas quedan intactas a propósito.
- Verificá que no haya tocado historial:

  ```sql
  -- Tiene que dar 0: ninguna serie de una sesión cerrada con plan inventado.
  select count(*)
  from workout_sets ws
  join workout_exercises we on we.id = ws.workout_exercise_id
  join workout_sessions s on s.id = we.session_id
  where s.ended_at is not null and ws.planned_reps is not null;
  ```

### `0035_hard_sets_by_goal.sql`

Crea `is_hard_set(int, numeric, text)` y `training_profile_of(uuid)`, y
**redefine `scoreboard_stats` y `friend_metrics`** para que las series
efectivas de cada persona se cuenten con **su propio** objetivo.

- Se generó mecánicamente a partir de `0032_scoreboard_local_days.sql`
  reemplazando sólo los dos predicados de `hard_sets`. El diff contra la 0032
  confirma que no hay ninguna otra diferencia, y las 4 funciones tienen sus
  `$$` balanceados — pero eso es revisión estática, no ejecución.
- Las firmas son idénticas a las de la 0032, así que `create or replace` alcanza
  y **no** hacen falta los `drop function` que sí necesitó la 0032.
- Si algo sale mal: **down = re-aplicar `0032_scoreboard_local_days.sql`**
  (restaura las dos funciones con el umbral fijo). Las funciones nuevas quedan
  huérfanas pero son inertes.
- Chequeo rápido después de aplicar:

  ```sql
  select is_hard_set(3, 8.0, 'fuerza');       -- true  (RIR 2, ≥1 rep)
  select is_hard_set(3, 8.0, 'hipertrofia');  -- false (pide ≥5 reps)
  select is_hard_set(10, 6.0, 'fuerza');      -- true  (RIR 4 sirve para fuerza)
  select is_hard_set(10, 6.0, 'hipertrofia'); -- false (RIR 4 se queda corto)
  select is_hard_set(20, null, 'resistencia');-- true  (sin RIR cargado cuenta)
  select is_hard_set(null, 8.0, 'fuerza');    -- false (serie por tiempo/distancia)
  select training_profile_of(auth.uid());     -- 'hipertrofia' si nunca elegiste
  ```

  Los umbrales tienen que coincidir con `src/lib/goal-params.ts`: son la misma
  tabla escrita dos veces (TS para el cliente, SQL para los RPC del ranking).
  Si tocás una, tocá la otra.

## Ojo con esto al aplicar

**Los números históricos cambian para quien no sea de hipertrofia.** Es
consecuencia buscada de hacer `isHardSet()` dependiente del objetivo, no un bug:
un usuario de fuerza va a ver subir sus series efectivas (ahora cuentan las
series de menos de 5 reps) y su posición en el ranking. Sin objetivo elegido no
cambia nada, porque el default es hipertrofia — los valores que la app venía
usando hardcodeados.

Vale la pena avisarlo en la app la primera vez que se ve el número nuevo; no está
implementado.

## Verificación funcional (tampoco se pudo correr)

Con `npm run dev` y una cuenta real:

1. **Sesión con plan**: rutina con `routine_sets` (ej. 3 × 75 × 10) → arrancar
   sesión. Peso y reps **vacíos**; gris = última vez si existe, si no el plan;
   chip `ⓘ plan 75 kg × 10 reps · RIR …` en cada fila.
2. **Repetir sin tocar nada**: tildar una serie vacía → adopta el ghost (o el
   plan si nunca hiciste el ejercicio). El chip ⓘ **sigue visible**: ése era el
   bug de fondo.
3. **Coloreo**: con perfil *hipertrofia* (tolerancia ±2) y plan de 10 reps →
   cargar 10 (ring celeste), 8 (celeste, borde), 7 (ámbar + ↓ bajá el peso),
   3 (rojo + ↓), 14 (rojo + ↑ subí el peso). Cambiar a *fuerza* en Perfil
   (tolerancia ±1) y confirmar que 8 pasa a ámbar.
4. **Dorado**: una serie con el mismo peso y 1 rep más que la última sesión → la
   card toma el ring dorado + badge "↑ mejoraste", **también plegada**. Recargar:
   sigue. Sesión nueva la semana siguiente: arranca sin dorado.
5. **RIR por objetivo**: en *fuerza*, RIR 4 pinta `success` y 0-1 `danger`. En
   *hipertrofia*, 0-3 pintan `success` — **esto cambió**: antes 0-1 era rojo. Ver
   la nota de abajo.
6. **Ranking**: probar con dos usuarios de objetivos distintos y confirmar que
   cada uno se cuenta con el suyo.
7. **Splash**: `/manifest.webmanifest` ya devuelve `"WorkOut, Logs & Friends"`
   (verificado en el build). Pero el WebAPK **congela el `name` al instalarse**:
   la PWA ya instalada va a seguir diciendo "WOLF" hasta que Chrome corra su
   chequeo de actualización (~1 día). Para verlo hay que **desinstalar y volver a
   agregar a la pantalla de inicio** — si no, parece que el fix no funcionó.
8. **Novedades**: con `localStorage` limpio → no aparece nada y queda guardada
   `wot-seen-version = "0.2.0"`. Poniéndola a mano en `"0.1.0"` y recargando →
   aparece el bottom sheet; cerrarlo y recargar → ya no vuelve.

## Decisión de diseño que conviene revisar

Para **hipertrofia, RIR 0 y 1 ahora pintan verde** (zona productiva); antes
pintaban rojo. Es deliberado: [Robinson et al. 2024](https://doi.org/10.1007/s40279-024-02069-2)
(*Sports Med* 54:2069-2087) encontró que la hipertrofia mejora cuanto más cerca
del fallo, así que pintarlo de rojo decía "hiciste algo mal" justo donde el paper
dice lo contrario. Para *fuerza* el rojo en 0-1 sí se mantiene, porque ahí la
pendiente del RIR es nula y acercarse al fallo es fatiga sin rédito.

Si se prefiere volver al rojo en hipertrofia como señal de costo de fatiga, es un
solo campo: `rirTooCloseBelow: 2` en `src/lib/goal-params.ts`.
