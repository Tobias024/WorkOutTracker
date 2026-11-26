# Relevamiento de performance: backend y arquitectura

> Fecha: 2026-11-04 · Alcance: capa de datos (Supabase/Postgres), acceso a datos desde el cliente, runtime de Next.js en Vercel y lógica de cómputo de métricas.
> Método: auditoría estática del código, con 4 frentes en paralelo y verificación cruzada de los hallazgos críticos. **No se corrió `EXPLAIN`, ni bundle analyzer, ni se midió en producción.** Los volúmenes están estimados para un usuario con 1 año de uso: unas 250 sesiones, unos 1.500 `workout_exercises` y entre 6.000 y 15.000 sets.

---

## 0. Cómo está armada hoy la app

| Capa | Qué hay |
|---|---|
| Front | Next 16.2 App Router + React 19.2. Casi todas las `page.tsx` son `"use client"` |
| Datos | El browser consulta Supabase **directo** (supabase-js + PostgREST) envuelto en React Query (`staleTime` 60 s, `refetchOnWindowFocus: true`) |
| Seguridad | RLS en todas las tablas y RPCs `security definer` para lo social (scoreboard, amigos, ranking) |
| Server | `middleware.ts` (refresh de sesión), layout `(app)` con chequeo de auth y onboarding, 4 route handlers (`/api/push/*`, `/api/rank/notify`, `/api/cron/rank-check`) |
| Deploy | Vercel, sin `regions` en `vercel.json` (por defecto `iad1`), un cron diario a las 23:07 |
| PWA | `public/sw.js` solo maneja push. No cachea nada y **solo se registra al activar las notificaciones** |

**Diagnóstico general.** La app es un *thick client* que trata a PostgREST como si fuera su API. Eso es válido, pero tiene tres costos que hoy dominan la latencia:

1. **Roundtrips en serie.** Las operaciones de negocio, como iniciar un entreno, terminarlo, importar una rutina o agregar un ejercicio, se arman con 3 a 15 requests encadenados desde el browser, en vez de 1 RPC transaccional.
2. **Datos crudos al cliente para calcular agregados.** El historial completo, con todos los sets anidados, viaja al browser y ahí se calculan métricas que serían agregaciones SQL de pocas filas. Este payload crece sin tope con el uso.
3. **Auth en la red en cada paso.** `getUser()` hace un request HTTP a Supabase Auth y está en 44 lugares, incluido el `queryFn` de casi todos los hooks, además del middleware y el layout.

El mayor impacto viene de **cambiar la forma de la API**: RPCs por operación de negocio, agregados en la base de datos e identidad local. Las librerías importan menos.

---

## 1. Resumen ejecutivo: los 10 de mayor impacto

| # | Hallazgo | Capa | Impacto | Esfuerzo |
|---|---|---|---|---|
| 1 | `getUser()` (red) en middleware, layout y ~40 hooks | Arquitectura | Alto | S–M |
| 2 | Iniciar un entreno: ~15 roundtrips en serie y no atómico | Datos | Alto | M |
| 3 | `useLastExerciseLogs` baja todo el historial de cada ejercicio para usar 1 fila | Datos + DB | Alto | S (índice) + M (RPC) |
| 4 | `useHistory` baja todo el historial anidado (estimado entre 1 y 4 MB/año) y lo usan 4 pantallas | Datos + Cómputo | Alto | S → L por fases |
| 5 | `detect_rank_overtakes` recalcula el ranking de **todos** los usuarios en cada fin de entreno y **cualquiera puede llamarla** | DB + Seguridad | Alto | S (revoke) + M |
| 6 | Scoreboard y perfil de amigo re-agregan decenas de miles de sets con funciones jsonb por fila; no hay rollup | DB | Alto (crece con el tiempo) | L |
| 7 | Faltan índices clave (`workout_exercises.exercise_id`, filtro por `coalesce(started_at, created_at)`, FKs) | DB | Medio–Alto | S |
| 8 | RLS de `workout_sets` con un EXISTS de 2 joins por fila y `auth.uid()` sin envolver | DB | Medio–Alto | S–M |
| 9 | Escrituras de sets: N PATCH, refetch completo tras `addSet` y sin cola offline persistente | Datos | Alto (camino crítico en el gimnasio) | S → L |
| 10 | Layout `(app)`: `getUser` + query a `profiles` en serie en cada navegación, y Functions posiblemente lejos de Supabase | Runtime | Alto | S |

También aparecieron **bugs de correctitud** (sección 7), varios de los cuales se resuelven con el mismo refactor.

---

## 2. Arquitectura y camino crítico (Next/Vercel/Auth)

### 2.1 `getUser()` en todas partes: la identidad es un request de red
- **Zona:**
  - [src/lib/supabase/middleware.ts:70](src/lib/supabase/middleware.ts#L70)
  - [src/app/(app)/layout.tsx:17](src/app/(app)/layout.tsx#L17)
  - [src/app/page.tsx](src/app/page.tsx)
  - Route handlers en [src/app/api/](src/app/api/)
  - ~40 llamadas en `src/hooks/*`: `useWorkout`, `useBodyData` (7), `useGoal` (4), `useWeeklyPlan` (4), `useRoutines`, `useAchievements`, `useFriends`, etc.
- **Por qué se releva:**
  - `auth.getUser()` hace un HTTP a Supabase Auth cada vez.
  - Cada navegación paga al menos 2 en serie (middleware y luego layout) antes de renderizar.
  - En el cliente, cada `queryFn` hace `getUser()` y recién después su query. Al abrir **Registro** se montan unos 8 hooks: son unos 16 roundtrips, de los cuales la mitad solo sirve para conocer un id que ya está en el JWT. Lo mismo vuelve a pasar con cada `refetchOnWindowFocus`.
  - Además hay **dos** `useCurrentUserId` distintos, con keys `["current-user-id"]` en [src/hooks/useUser.ts](src/hooks/useUser.ts) y `["me"]` en [src/hooks/useFriendProfile.ts](src/hooks/useFriendProfile.ts).
- **Propuesta:**
  1. **Cliente (S, riesgo bajo).** Crear un helper `getUserId()` en `lib/supabase/client.ts` que use `auth.getSession()`, que es local y no hace red, y reemplazarlo en todos los hooks. Unificar `useCurrentUserId` en una sola key. La seguridad no cambia porque la sigue dando la RLS: Postgres valida el JWT en cada query. En las tablas que la RLS ya filtra por `user_id = auth.uid()`, el `.eq("user_id", …)` es redundante, aunque conviene mantenerlo porque ayuda al planner.
  2. **Server (M).** Reemplazar `getUser()` por `getClaims()`, que existe en la versión instalada de `@supabase/auth-js` (2.110) y verifica el JWT localmente con JWKS. Envolverlo en un helper con `cache()` de React para que el layout, la page y los handlers lo compartan dentro del request:
     ```ts
     import { cache } from "react";
     export const getAuthUser = cache(async () => {
       const supabase = await createClient();
       const { data } = await supabase.auth.getClaims();
       return data?.claims ? { id: data.claims.sub as string, claims: data.claims } : null;
     });
     ```
     **Requisito a verificar:** el proyecto Supabase tiene que usar **JWT Signing Keys asimétricas**. Con el secreto HS256 legacy, `getClaims()` cae a `getUser()` y no gana nada. Se revisa en Dashboard → Auth → Signing Keys.
- **Riesgo:** un usuario baneado o borrado sigue "logueado" hasta que expira el JWT (1 h por defecto). Es aceptable para esta app.
- **Referencias:** `node_modules/next/dist/docs/01-app/01-getting-started/16-proxy.md`, donde el proxy se describe como "optimistic checks" y no como lugar para fetch lento, y `02-guides/authentication.md` (patrón DAL con `cache()`).

### 2.2 El layout `(app)` consulta `profiles` en cada navegación
- **Zona:** [src/app/(app)/layout.tsx:21-28](src/app/(app)/layout.tsx#L21-L28)
- **Por qué se releva:** después de `getUser()` hace `select username from profiles` en serie, en **cada** carga de cualquier ruta privada, solo para saber si el onboarding está completo. Es un dato que cambia una vez en la vida del usuario.
- **Propuesta (S–M, riesgo bajo).** Hay dos opciones; la recomendada es la **(a)**.
  - **(a)** Al terminar el onboarding, guardar `onboarded: true` en `app_metadata` (Admin API o Custom Access Token Hook) y leerlo desde `claims` con `getClaims()`. Así son 0 roundtrips. Hay que refrescar el token después del onboarding.
  - **(b)** Usar una cookie `onb=1` httpOnly, seteada al completar el onboarding. Se consulta `profiles` solo si la cookie falta.
- Con 2.1 y 2.2 juntos, el layout pasa de unos 3 roundtrips seriales a 0.

### 2.3 Región de las Functions y región de Supabase (a verificar, potencialmente el mayor multiplicador)
- **Zona:** [vercel.json](vercel.json), que no define `regions`.
- **Por qué se releva:** sin `regions`, Vercel ejecuta las Functions en `iad1` (Washington). La app es `es-AR`. Si el proyecto Supabase está en `sa-east-1` (São Paulo), cada roundtrip server-side del middleware, el layout o los handlers cruza el continente dos veces, unos 120–150 ms por roundtrip. Con 3 roundtrips seriales por navegación, eso suma casi medio segundo de TTFB sin que el código haga nada malo.
- **Propuesta (S, riesgo bajo):** colocar las Functions en la región de la base, por ejemplo `"regions": ["gru1"]` si Supabase está en `sa-east-1`. Verificar también que *Fluid compute* esté activo en el proyecto de Vercel.

### 2.4 Todas las páginas son client components que arrancan vacías
- **Zona:**
  - `"use client"` en todas las `src/app/(app)/*/page.tsx`
  - [registro/page.tsx](src/app/(app)/registro/page.tsx) (1.887 líneas)
  - [entrenar/[sessionId]/page.tsx](src/app/(app)/entrenar/[sessionId]/page.tsx) (932)
  - [rutinas/page.tsx](src/app/(app)/rutinas/page.tsx) (679)
- **Por qué se releva:** el primer contenido útil espera esta cadena en serie: HTML → JS → hidratación → `getUser()` → query. El servidor **ya** autenticó y consultó la base en el layout, y descarta esos datos.
- **Propuesta (L, riesgo medio):** prefetch en un Server Component y `HydrationBoundary` de React Query, solo en las pantallas de entrada:
  - `/rutinas`, que es la landing (`/` redirige ahí).
  - `/scoreboard`.

  `entrenar` y `registro` quedan como client, por interactividad y porque tienen que funcionar con mala red. Las secciones lentas (gráficos, rankings) van con `<Suspense>`. Doc: `02-guides/streaming.md`. **Hacerlo después de 2.1–2.3**, porque sin auth local y región correcta, mover el fetch al server solo traslada la latencia.

### 2.5 Middleware: matcher amplio y convención deprecada
- **Zona:** [src/middleware.ts](src/middleware.ts)
- **Por qué se releva:**
  - El middleware corre también en `/api/*`, incluido el cron, que se autentica con `CRON_SECRET` y no necesita sesión.
  - En Next 16, `middleware` está **deprecado y renombrado a `proxy`**, con runtime Node por defecto. Fuente: `docs/01-app/01-getting-started/16-proxy.md` y el changelog v16.0.0.
- **Propuesta (S, riesgo bajo):**
  - Renombrar a `src/proxy.ts` (`export function proxy`).
  - Excluir del matcher `api/cron`, `sw.js` y `manifest.webmanifest`. Hoy esos dos archivos hacen early-return, pero igual invocan la función.
  - Usar `getClaims()` en el refresh (ver 2.1).

---

## 3. Base de datos (Supabase/Postgres)

> Las funciones vigentes son: `scoreboard_stats` y `friend_metrics` en 0035, `common_exercise_maxes` en 0013, `detect_rank_overtakes` en 0027 y `record_session_achievements` en 0015.

### 3.1 `detect_rank_overtakes`: cálculo global en cada fin de entreno y ejecutable por cualquiera
- **Zona:**
  - [supabase/migrations/0027_rank_overtakes_both.sql:9](supabase/migrations/0027_rank_overtakes_both.sql#L9)
  - Se invoca desde [src/lib/rank-notify.ts:24](src/lib/rank-notify.ts#L24).
  - Se dispara en [entrenar/[sessionId]/page.tsx:350](src/app/(app)/entrenar/[sessionId]/page.tsx#L350) y en el cron.
- **Por qué se releva:**
  - Cada vez que *cualquier* usuario termina un entreno se recorre **cada usuario con amigos**. Por cada uno se arma su ranking completo con sesiones, ejercicios y sets de 7 días, más un select y un upsert a `rank_state`.
  - El costo es O(usuarios × amigos × sets), y los sets de una persona se re-agregan una vez por cada amigo que la tiene.
  - Es `security definer` y **no hay ningún `revoke` en las migraciones** (verificado). Con los grants por defecto de Supabase, `anon` y `authenticated` pueden llamarla con `POST /rest/v1/rpc/detect_rank_overtakes`. Eso abre la puerta a un DoS barato, muta `rank_state` y devuelve ids y nombres ajenos.
  - Pasa lo mismo con `friend_ids(uuid)` ([0001_init.sql:162](supabase/migrations/0001_init.sql#L162)): acepta cualquier uid y permite enumerar los amigos de otro usuario.
- **Propuesta:**
  1. **Ya (S, riesgo nulo):** el cron y `/api/rank/notify` usan `service_role`, así que esto no los rompe.
     ```sql
     revoke execute on function detect_rank_overtakes() from public, anon, authenticated;
     grant  execute on function detect_rank_overtakes() to service_role;
     revoke execute on function friend_ids(uuid) from public, anon, authenticated;
     ```
     Antes de revocar `friend_ids`, verificar que solo la usen otras funciones `security definer`, que corren como owner.
  2. **Acotar (M):** `detect_rank_overtakes(p_user uuid)` evalúa solo el grupo de amigos de quien terminó, con un único CTE de `hard_sets` por usuario y un ranking por grupo. El cron diario queda como barrido completo.
  3. **Semántica:** usa `reps >= 5 and rpe >= 7` fijo, mientras que el scoreboard usa `is_hard_set(..., training_profile)` desde 0035. La notificación puede contradecir lo que se ve en el ranking. Hay que unificarlos.

### 3.2 No hay rollup: todo se re-agrega desde `workout_sets` en cada consulta
- **Zona:**
  - `scoreboard_stats` y `friend_metrics` en [0035_hard_sets_by_goal.sql:46](supabase/migrations/0035_hard_sets_by_goal.sql#L46) y [:205](supabase/migrations/0035_hard_sets_by_goal.sql#L205).
  - `common_exercise_maxes` en [0013:171](supabase/migrations/0013_exclude_warmups.sql#L171).
  - `record_session_achievements` en [0015:23](supabase/migrations/0015_achievements.sql#L23).
- **Por qué se releva:**
  - Volumen, series efectivas, reps, e1RM por ejercicio y volumen semanal se recalculan sobre todos los sets del período, con dos llamadas (período actual y anterior). Con el período "all" se recorre el historial completo de todos los amigos.
  - `friend_metrics` repite el mismo join sesiones → ejercicios → sets en **5 subconsultas** independientes.
  - Las funciones `set_volume`, `set_max_weight` y `set_estimate_1rm` ([0004:9](supabase/migrations/0004_drop_sets.sql#L9), [0009:6](supabase/migrations/0009_friend_profiles.sql#L6)) construyen `jsonb_build_array(jsonb_build_object(...))` y lo recorren con `jsonb_array_elements` **por cada set**, aunque `drops` sea null, que es el caso común. Postgres no las puede inlinear.
  - `record_session_achievements` recorre todo el historial del usuario al finalizar **cada** sesión.
  - En resumen: el costo crece lineal con el tiempo de uso y multiplicado por la cantidad de amigos.
- **Propuesta (L, riesgo medio):** una tabla de resumen por (sesión, ejercicio), mantenida al cerrar una sesión y al editar sets de sesiones ya cerradas.
  ```sql
  create table session_exercise_stats (
    session_id uuid references workout_sessions on delete cascade,
    exercise_id uuid not null, replaced_from_exercise_id uuid,
    user_id uuid not null, effective_at timestamptz not null,
    volume numeric, reps numeric, work_sets int,
    hard_sets_hyp int, hard_sets_str int, hard_sets_end int, -- por perfil: 0035 exige retroactividad
    best_weight numeric, best_e1rm numeric,
    primary key (session_id, exercise_id)
  );
  create index on session_exercise_stats (user_id, effective_at desc);
  create index on session_exercise_stats (user_id, exercise_id, best_e1rm desc);
  ```
  - Scoreboard, perfil de amigo, PRs y ranking pasan a sumar sobre **cientos** de filas en vez de decenas de miles.
  - Mantenimiento: un trigger statement-level sobre `workout_sets` marca la sesión como *dirty* y se recomputa al finalizar o por cron. Así se evita el costo por cada tecla durante el entreno.
  - Arranque seguro: empezar con una `materialized view` refrescada por cron y medir antes de pasar a triggers.
- **Mientras tanto (S):**
  - Agregar un camino rápido en las funciones `set_*`: `case when ws.drops is null then coalesce(ws.reps*ws.weight,0) else (…jsonb…) end`. Hay que preservar exacto el comportamiento con nulls.
  - Compartir un único CTE `base as materialized (…)` entre las 5 subconsultas de `friend_metrics`.
  - Hoistear `training_profile_of(p_friend_id)` a una variable plpgsql, porque hoy puede evaluarse una vez por set.
  - Calcular período actual y anterior en **una** llamada con `filter (where …)`.

### 3.3 Índices faltantes
- **Zona:** [0001_init.sql:76-100](supabase/migrations/0001_init.sql#L76-L100), que solo indexa `workout_sessions(user_id, created_at desc)`, `workout_exercises(session_id, position)` y `workout_sets(workout_exercise_id, set_number)`.
- **Por qué se releva:**
  - **`workout_exercises.exercise_id` sin índice.** `useLastExerciseLogs` (al abrir cada entreno) y las ramas por ejercicio del scoreboard hacen seq scan de la tabla del medio del historial.
  - **Filtros de período sobre `coalesce(s.started_at, s.created_at)`** en todas las ramas de `scoreboard_stats` y `friend_metrics`. El índice es sobre `created_at`, así que **el rango no es indexable**: solo se usa el prefijo `user_id`.
  - **FKs `on delete set null` sin índice** (`workout_exercises.routine_exercise_id`, `workout_sessions.routine_id`). Borrar una rutina o un ejercicio de rutina hace seq scan de `workout_exercises` por cada fila borrada.
  - **`useActiveSession`** (`ended_at is null order by started_at`) corre al cargar y cada 30 s sin un índice que lo cubra.
- **Propuesta (S, riesgo nulo):**
  ```sql
  create index on workout_exercises (exercise_id, session_id);
  create index on workout_exercises (replaced_from_exercise_id) where replaced_from_exercise_id is not null;
  create index on workout_exercises (routine_exercise_id)       where routine_exercise_id is not null;
  create index on workout_sessions (routine_id)                 where routine_id is not null;
  create index on workout_sessions (user_id, started_at desc)   where ended_at is null;      -- sesión activa
  create index on routine_exercises (exercise_id);
  create index on exercise_substitutions (routine_exercise_id);
  ```
  Para el `coalesce`, la opción limpia es hacer backfill `started_at = created_at where started_at is null`, después `set default now()` y `not null`, crear el índice `(user_id, started_at desc)` y reescribir los filtros. La alternativa sin tocar las funciones es un índice de expresión `(user_id, (coalesce(started_at, created_at)))`.
- **Para limpiar (S):**
  - `friendships_requester_idx` es prefijo del unique.
  - `routine_sets_rex_idx` duplica el unique.
  - El GIN `exercises_name_idx` no lo usa nadie en `src/`, porque el catálogo se filtra en el cliente. Confirmar con `pg_stat_user_indexes.idx_scan` antes de borrarlo.

### 3.4 RLS: EXISTS anidados por fila en la tabla más grande
- **Zona:** [0002_rls.sql:70-91](supabase/migrations/0002_rls.sql#L70-L91) (`workout_exercises_all`, `workout_sets_all`) y `routine_sets_all` en 0006.
- **Por qué se releva:**
  - Cada set leído o escrito evalúa `exists (select 1 from workout_exercises we join workout_sessions s … where s.user_id = auth.uid())`. En escrituras se evalúa en `using` y otra vez en `with check`.
  - `auth.uid()` no está envuelto en `(select …)`.
  - Ninguna policy declara `to authenticated`.
  - Esto multiplica el costo de `useHistory` y `useLastExerciseLogs`, que devuelven miles de sets.
- **Propuesta:**
  1. **(S, riesgo nulo)** Reescribir todas las policies con `(select auth.uid())` y `to authenticated`. Es el patrón recomendado por Supabase: el valor se calcula una vez como initPlan.
  2. **(M, riesgo medio)** Desnormalizar `user_id` en `workout_exercises` y `workout_sets`, completado por un trigger `before insert` a partir de la sesión, con backfill. La policy queda en `using (user_id = (select auth.uid()))`, sin joins. Además habilita índices `(user_id, exercise_id)`. El `with check` debe seguir validando que la sesión padre sea del caller.
  3. Medir antes y después con `explain (analyze, buffers)` ejecutado como `authenticated` (`set local role authenticated; set local request.jwt.claims = '{"sub":"…"}'`).

### 3.5 Racha de logros con un loop de una query por día
- **Zona:** [0015_achievements.sql:120](supabase/migrations/0015_achievements.sql#L120)
- **Por qué se releva:** `while … exists (… s.created_at::date = v_cur) loop` hace una consulta por cada día de racha, con un cast sobre la columna que no es indexable. Además usa el día UTC, mientras que el resto de la app usa el día local (0032).
- **Propuesta (S):** reescribirla con *gaps and islands* en una sola query (`d - row_number() over (order by d)`), usando el día local (`at time zone p_tz`) para que coincida con el scoreboard.

---

## 4. Acceso a datos desde el cliente (la "API de facto")

### 4.1 Iniciar un entreno: ~15 roundtrips en serie y no atómico
- **Zona:** [src/hooks/useWorkout.ts:23-143](src/hooks/useWorkout.ts#L23-L143) (`useStartWorkout`, loop en la línea 66).
- **Por qué se releva:** la secuencia es `getUser`, 3 lecturas en paralelo, el INSERT de la sesión y después un `for` secuencial con `insert workout_exercises` + `insert workout_sets` **por ejercicio**. Con 6 ejercicios son unos 15 requests seriales: entre 1,2 y 2,2 s en 4G con el botón "Empezar" colgado. Si falla a mitad de camino queda una sesión a medias.
- **Propuesta (M, riesgo bajo):** una RPC transaccional `start_workout_from_routine(p_routine_id) returns jsonb` que inserte la sesión, los ejercicios (con sustituciones) y los sets planificados, y que **devuelva la sesión completa**. El cliente la guarda con `setQueryData(["session", id], …)`, así `/entrenar/[id]` abre sin fetch.
  - **Alternativa (S):** dos `insert([...]).select()` en batch (todos los ejercicios y después todos los sets), mapeando por `routine_exercise_id`. Son 3–4 roundtrips, pero sigue sin ser atómico.

### 4.2 `useLastExerciseLogs` trae el historial completo de cada ejercicio
- **Zona:** [src/hooks/useWorkout.ts:214-282](src/hooks/useWorkout.ts#L214-L282)
- **Por qué se releva:** `.from("workout_exercises").select("…, workout_sessions!inner(…), workout_sets(…)").in("exercise_id", ids)` no tiene límite, orden en el servidor ni filtro de sesión terminada. Trae todas las apariciones de cada ejercicio, con todos sus sets (cientos de filas y miles de sets), y en JS se queda con 1 por ejercicio. Descarta alrededor del 97% de lo que baja, en el momento más sensible: abrir el entreno. A eso se suman el seq scan (3.3) y la RLS por fila (3.4).
- **Propuesta (M, riesgo bajo):**
  ```sql
  create function last_exercise_logs(p_ids uuid[], p_exclude uuid default null)
  returns jsonb language sql stable security invoker as $$
    with last as (
      select distinct on (we.exercise_id) we.exercise_id, we.id as we_id, s.started_at
      from workout_exercises we join workout_sessions s on s.id = we.session_id
      where we.exercise_id = any(p_ids) and s.ended_at is not null
        and s.id is distinct from p_exclude
      order by we.exercise_id, s.started_at desc nulls last)
    select coalesce(jsonb_agg(jsonb_build_object(
      'exercise_id', l.exercise_id, 'started_at', l.started_at,
      'sets', (select jsonb_agg(to_jsonb(ws) order by ws.set_number)
               from workout_sets ws where ws.workout_exercise_id = l.we_id))), '[]')
    from last l;
  $$;
  ```
  Con `security invoker` respeta la RLS. Va acompañada del índice de 3.3. Hay que replicar exactamente los filtros de sets actuales (no warmup, con algún valor).

### 4.3 `useHistory`: todo el historial anidado, sin límite, en 4 pantallas
- **Zona:** [src/hooks/useHistory.ts:43-58](src/hooks/useHistory.ts#L43-L58). Lo consumen:
  - [registro](src/app/(app)/registro/page.tsx#L266)
  - [rutinas](src/app/(app)/rutinas/page.tsx#L121)
  - [entrenar](src/app/(app)/entrenar/[sessionId]/page.tsx#L149)
  - [ExercisePickerModal](src/components/ExercisePickerModal.tsx#L42)
- **Por qué se releva:**
  - **Payload.** Trae sesiones → ejercicios → sets con 13 columnas, sin `limit` ni rango. Se estima entre 1 y 4 MB de JSON por año de uso, más el armado del JSON anidado en PostgREST, la RLS por set y el `structuralSharing` de React Query sobre todo ese árbol.
  - **Refetch.** Se invalida al **iniciar** un entreno ([useWorkout.ts:139](src/hooks/useWorkout.ts#L139) y [:171](src/hooks/useWorkout.ts#L171)), y como `/rutinas` lo tiene montado, el refetch completo compite por la red justo mientras se crea la sesión.
  - **Uso real de cada consumidor:**
    - **rutinas**, para "seguir entrenando": necesita la última sesión por rutina, que es una fila.
    - **ExercisePicker**: necesita la fecha de último uso por ejercicio, unas 40 filas.
    - **entrenar**: necesita el `prevTonnage` de la sesión anterior, que es un escalar, y además lo carga aunque la sesión esté en curso.
  - **Columnas sobrantes.** `comment`, `planned_reps`, `planned_weight` y `completed_at` solo los usa el export CSV y representan cerca del 40% del peso de cada set.
- **Propuesta (por fases):**
  - **Fase 1 (S, riesgo nulo):**
    - Sacar esas 4 columnas y crear `useHistoryForExport`, habilitado solo al exportar.
    - Reemplazar los 3 consumidores livianos por queries chicas o RPCs (`exercise_last_used()`, `last_session_by_routine()`, `previous_tonnage(routine_id, exclude)`).
    - Quitar `["history"]` de las invalidaciones de `useStartWorkout`/`useStartEmptyWorkout`; un entreno recién iniciado no cambia el historial.
    - En `useDeleteSession`, usar `setQueryData(old => old.filter(...))` en vez de invalidar.
  - **Fase 2 (M):** acotar el `useHistory` de Registro a una ventana, por ejemplo 120 días con `.gte(...)`, y que los datos de todo el tiempo salgan de una RPC agregada.
  - **Fase 3 (L):** una RPC `registro_summary(p_tz, p_profile)` que devuelva agregados por (día, ejercicio) y por (semana, ejercicio, reps): son entre 700 y 2.200 filas, unos 60–120 KB, **y no crece con los sets**. La resolución de músculos sigue en TS (`muscleContributions`) para no duplicar lógica.
- **Riesgo numérico:** no calcular el e1RM en SQL (ver 7.6). Hay que devolver `max(weight)` por (ejercicio, reps, semana) y aplicar `estimate1RM` en JS. Como el e1RM es monótono en el peso a reps fijas, el resultado es idéntico.

### 4.4 Sesión activa: waterfall, refetch tras cada alta y escrituras sin batch
- **Zona:**
  - `useWorkoutSession` en [src/hooks/useWorkout.ts:286](src/hooks/useWorkout.ts#L286).
  - `addSet` en [src/hooks/useWorkoutMutations.ts:95-135](src/hooks/useWorkoutMutations.ts#L95-L135).
  - `addExercise` en [:160](src/hooks/useWorkoutMutations.ts#L160).
  - El autocompletado de series en [src/components/SessionExerciseCard.tsx:283-303](src/components/SessionExerciseCard.tsx#L283-L303).
- **Por qué se releva:**
  - **Carga en serie.** Primero se pide `workout_sessions` y recién después `workout_exercises(*, workout_sets(*))`, aunque son 2 GET independientes.
  - **Altas.** `addSet`, `addExercise` y `replaceExercise` hacen `refetchSession()` (2 GET) solo para reemplazar el id temporal por el real. Cada "+ serie" cuesta 1 INSERT y 2 GET.
  - **Autocompletado.** Al tildar la última serie se hacen N−1 PATCH, uno por serie, y "Deshacer" hace otros N.
  - **Offline.** No hay persistencia de la caché ni de las mutations. Si la PWA se cierra con mala señal (escenario típico de gimnasio), se pierden las escrituras pendientes.
- **Propuesta:**
  - **(S)** Una sola query con embed: `.from("workout_sessions").select("*, workout_exercises(*, workout_sets(*))").eq("id", id).order("position", { referencedTable: "workout_exercises" }).single()`.
  - **(S)** **Generar el uuid en el cliente** (`crypto.randomUUID()`) para sesiones, ejercicios y sets nuevos, y mandarlo en el INSERT. El id nunca cambia y no hace falta ningún refetch. También arregla el bug 7.1.
  - **(S)** Un batch al autocompletar: `upsert(rows, { onConflict: "id" })` o una RPC `update_sets(p_patches jsonb)`.
  - **(M)** Coalescer los parches por `set.id` en una ventana de 300–500 ms.
  - **(L)** Una cola offline persistente con `@tanstack/query-persist-client-core` + `idb-keyval` (IndexedDB), con `mutationKey` + `setMutationDefaults` para poder reanudar después de recargar, y `networkMode: "offlineFirst"` en las mutations de sesión.
  - **Config de la sesión activa (S):** `staleTime: Infinity` y `refetchOnWindowFocus: false`, porque el dispositivo es el único que escribe. Hoy, cada vuelta de otra app (música, mensajes) refetchea la sesión, y si hay un PATCH en vuelo el GET puede pisar el valor optimista.

### 4.5 Finalizar un entreno: cadena serial
- **Zona:** [entrenar/[sessionId]/page.tsx:314-376](src/app/(app)/entrenar/[sessionId]/page.tsx#L314-L376)
- **Por qué se releva:** se ejecuta `flushUndoables` → `updateSession` → `fetch /api/rank/notify` → `rpc record_session_achievements` → navegación. Son 3 o más roundtrips antes de que el usuario vea el resumen, además del cold start de la Function del ranking compitiendo por la red.
- **Propuesta (M):**
  - Una RPC `finish_session(p_session_id, p_ended_at, p_duration)` que haga el UPDATE y los logros dentro de una transacción y devuelva los PRs (1 roundtrip).
  - El ranking se dispara del lado del servidor (ver 5.1); como mínimo, en paralelo y no antes de los logros.
  - Si se implementa el rollup (3.2), esta RPC es el punto natural para mantenerlo.

### 4.6 `profiles` consultada 4–5 veces por pantalla
- **Zona:** `useTrainingProfile`/`useGoal` en [useGoal.ts](src/hooks/useGoal.ts), `useWeeklyPlan`/`usePlannedSince` en [useWeeklyPlan.ts](src/hooks/useWeeklyPlan.ts), [perfil/page.tsx](src/app/(app)/perfil/page.tsx) (con un `useEffect` manual) y el layout.
- **Por qué se releva:** en Registro se pide la misma fila con 4 keys distintas, cada una con su `getUser()`. `goal` se deriva de `training_profile`, así que son redundantes entre sí.
- **Propuesta (M, riesgo bajo):** un `useMyProfile()` con key `["profile","me"]` y las columnas necesarias. Los hooks actuales pasan a ser `select` derivados (`select: p => p.planned_weekdays`), las mutations usan `setQueryData` y perfil lee del mismo caché.

### 4.7 Otros N+1 y sobrecarga de datos (menor)
- **[useImportRoutine](src/hooks/useRoutines.ts#L110):** hace 2 INSERT seriales por ejercicio, unos 18 roundtrips. Reemplazar por una RPC `import_routine_from_plan(p_name, p_items jsonb)`.
- **[swap](src/hooks/useRoutines.ts#L394):** hace 2 UPDATE seriales **sin chequear errores** y no es atómico (ver 7.4). Usar una RPC `swap_positions(a, b)`.
- **`useBodyWeight`:** en `entrenar` se usa solo el último registro, pero se trae toda la serie. Ya existe `useLastBodyWeight` para eso.
- **`useSleep`/`useMeasurements`:** `select("*")` sin rango.
- **`useFriends`:** hace 2 queries en serie y `profiles.select("*")` de los amigos, que incluye peso, altura y perfil de entrenamiento que la lista no muestra. Es overfetch y además **expone datos de más**. Pedir columnas explícitas, embed o una RPC `my_friends()`.
- **`useActiveSession`** ([useWorkout.ts:334](src/hooks/useWorkout.ts#L334)): `staleTime` de 30 s con focus refetch en todas las pantallas. Solo cambia cuando la app misma inicia o termina un entreno, y eso ya se resuelve con `setQueryData`. Usar `staleTime: Infinity`.
- **Sin prefetch:** no hay ningún `prefetchQuery` ni `initialData` en el código. Casos claros:
  - Hacer `prefetchQuery(["routine", id])` en `onPointerDown` de la card.
  - `useRoutine` con `initialData` desde `["routines"]`.
  - Guardar en caché la sesión al iniciar (4.1).
- **Scoreboard:** hace 2 RPC por interacción (período actual y anterior). Unificarlas en una sola (3.2).
- **`friend_metrics`, `top_prs`:** el `limit 10` no limita (ver 7.3), así que devuelve los PRs de todos los ejercicios.

---

## 5. Route handlers, cron y push

### 5.1 `/api/rank/notify` bloquea la Function y el envío de push es secuencial
- **Zona:**
  - [src/app/api/rank/notify/route.ts](src/app/api/rank/notify/route.ts) (`maxDuration = 60`).
  - [src/lib/rank-notify.ts:30](src/lib/rank-notify.ts#L30) y [:52](src/lib/rank-notify.ts#L52).
- **Por qué se releva:**
  - Por cada *overtake* se hace una query a `push_subscriptions` (N+1).
  - Dentro de ese loop, `await webpush.sendNotification` va **uno por uno**, a 100–500 ms cada uno contra FCM, Mozilla o Apple.
  - Los borrados de endpoints muertos también son seriales.
  - Todo corre antes de responder: se factura tiempo de Function y se acerca al `maxDuration`.
- **Propuesta (S–M, riesgo bajo):**
  - Una sola query `.in("user_id", ids)` agrupada en un `Map`.
  - Envíos con `Promise.allSettled` en lotes de unos 10.
  - Un solo `delete … in (dead)`.
  - Responder enseguida y ejecutar el trabajo en `after()` de `next/server` (doc: `03-api-reference/04-functions/after.md`).
  - A futuro, disparar el ranking desde la base (trigger + `pg_net`, o una cola) en vez de desde el browser.
- **Menor:** memoizar `createAdminClient()` y `webpush.setVapidDetails` a nivel de módulo.

---

## 6. Cómputo en el cliente (métricas)

> Regla para todo este bloque: **las métricas están ancladas a papers**. Cualquier refactor tiene que preservar el resultado numérico exacto, así que primero conviene sumar un test de paridad (ver 7.6).

### 6.1 La pantalla de entreno se re-renderiza 2–3 veces por segundo
- **Zona:**
  - [src/hooks/useRestTimer.ts:94-122](src/hooks/useRestTimer.ts#L94-L122).
  - [entrenar/[sessionId]/page.tsx:233](src/app/(app)/entrenar/[sessionId]/page.tsx#L233) (`useRestSeconds` en `SessionView`) y [:251](src/app/(app)/entrenar/[sessionId]/page.tsx#L251) (un `setInterval` de 1 s).
- **Por qué se releva:**
  - El snapshot de `useSyncExternalStore` es `nowMs`, que cambia cada 500 ms aunque **no haya ningún descanso corriendo**. A eso se suma el reloj de sesión de 1 s.
  - Cada tick re-renderiza toda la `SessionView`: unas 6 `SessionExerciseCard` y sus `SetRow`, sin `React.memo` y con lambdas inline.
  - En celulares de gama baja eso es batería y frames perdidos al scrollear.
- **Propuesta (S, riesgo bajo):**
  - Que el snapshot sea el entero derivado: `() => startedAt == null ? 0 : Math.round((nowMs - startedAt) / 1000)`. React descarta los renders sin cambio.
  - Suscribirse al reloj solo si hay un descanso activo.
  - Aislar `<ElapsedClock/>` y `<RestBanner/>` como componentes hoja.
  - Usar selectores de zustand en lugar de `useRestStore()` completo.

### 6.2 Recalcular todo, siempre y varias veces
- **Zona:**
  - El `useMemo` de `metrics` en [registro/page.tsx:315-501](src/app/(app)/registro/page.tsx#L315-L501).
  - [GoalMetrics.tsx:62-91](src/components/GoalMetrics.tsx#L62-L91).
  - [metrics-goal.ts](src/lib/metrics-goal.ts).
- **Por qué se releva:**
  - **Por pestaña.** `metrics` se calcula aunque la pestaña visible sea "cuerpo".
  - **Por perfil.** `GoalMetrics` calcula las 11 métricas cuando cada perfil usa un subconjunto.
  - **Al montar.** `GoalMetrics` arranca con `now = undefined` y hace `tick()` sincrónico, así que calcula todo **dos veces**. Además cada `visibilitychange` recalcula todo aunque el día no haya cambiado.
  - **e1RM semanal.** Se calcula 3 veces sobre el mismo historial (`sparklines`, `retention` y `GoalMetrics.e1rm`).
  - **Volumen por sesión.** `sessionVolume(s)` se calcula 5 veces por sesión.
  - **Fechas.** `new Date(sessionDate(s))` se ejecuta en cada una de las 11 funciones.
  - **Contribuciones musculares.** `muscleContributions` ([muscle-contributions.ts:136](src/lib/muscle-contributions.ts#L136)) se recalcula por (sesión × ejercicio) con regex y `Map` nuevos, unas 4.500 llamadas.
  - En total son unas 12 pasadas por los sets en cada recálculo: unos 10–20 ms en desktop y 50–100 ms en celular, duplicados al montar.
- **Propuesta:**
  - **(S)** Cachear `muscleContributions` con un `WeakMap<Exercise, Contribution[]>` y congelar el resultado.
  - **(S)** Calcular `sessionMuscleSets` una sola vez por sesión y compartirla.
  - **(S)** `now` truncado al día (`useToday`), sin `tick()` sincrónico.
  - **(S)** Reutilizar el resultado del e1RM.
  - **(S–M)** Calcular solo lo que muestra la pestaña o el perfil activo, con un `useMemo` por card.
  - **(M)** Un índice enriquecido de sesiones (`{ t, dayKey, wkMs, volume, countableSets }`) calculado una vez en el `select` de React Query y pasado a todas las funciones. Si se implementa 4.3 Fase 3, casi todo este bloque desaparece.

### 6.3 Menores
- **Formateo de fechas:** `formatDate` ([format.ts](src/lib/format.ts)) construye un `Intl.DateTimeFormat` nuevo por fila con `toLocaleDateString` y opciones. Hoistearlo a nivel de módulo. Lo mismo en `ConsistencyHeatmap`.
- **`SessionRow`:** sin `React.memo` y con `onDelete` inline.
- **`WeightCard`:** recalcula `bodyWeightTrend` (media móvil O(n²)) en cada tecla del input. Envolverlo en `useMemo`.
- **`isHardSet`:** llama a `goalParams(profile)` por set. Hoistearlo fuera del loop.
- **Export xlsx con 15k sets:** corre en el hilo principal. Si llega a molestar, moverlo a un Web Worker.

---

## 7. Bugs de correctitud encontrados de paso

| # | Bug | Zona | Fix |
|---|---|---|---|
| 7.1 | **Editar una serie recién agregada antes del refetch falla.** El id optimista es `temp-…` y `SetRow` solo bloquea el *borrado* (`saving` en `SetRow.tsx:119`, usado únicamente en `:531`), así que un PATCH de peso o reps sale con `id = 'temp-…'` contra una columna uuid, falla, revierte y muestra el toast "No se pudo guardar". | [useWorkoutMutations.ts:102](src/hooks/useWorkoutMutations.ts#L102), [SetRow.tsx:119](src/components/SetRow.tsx#L119) | uuid generado en el cliente (4.4) |
| 7.2 | **Series efectivas con umbrales viejos.** `computeHardSets(…, trainingProfile)` está dentro de un `useMemo` cuyas deps (`[data, exMap, todayKey]`, con `eslint-disable`) no incluyen `trainingProfile`. Si el perfil llega después del historial, Registro muestra los umbrales de hipertrofia a un usuario de fuerza o resistencia, y contradice a `weekMetrics`. | [registro/page.tsx:428-434](src/app/(app)/registro/page.tsx#L428-L434), [:501](src/app/(app)/registro/page.tsx#L501) | agregar la dep y separar el memo |
| 7.3 | **`top_prs` no limita.** El `limit 10` está después del `json_agg`, que devuelve una sola fila. | [0035:298-313](supabase/migrations/0035_hard_sets_by_goal.sql#L298-L313) | `order by … limit 10` dentro de la subconsulta (cambia lo que se ve: avisar) |
| 7.4 | **`swap` de rutina no atómico y sin chequear errores.** Si falla el segundo UPDATE quedan 2 ejercicios en la misma `position`, y eso además puede duplicar `routine_sets` en `import_routine`/`duplicate_routine`, que emparejan por `(exercise_id, position)`. | [useRoutines.ts:394-411](src/hooks/useRoutines.ts#L394-L411), 0033/0036 | RPC `swap_positions` + ids pre-generados en las funciones SQL |
| 7.5 | **`addExercise` ignora el error del insert de sets.** Es el mismo patrón que `useStartWorkout` ya corrigió. | [useWorkoutMutations.ts:179](src/hooks/useWorkoutMutations.ts#L179) | chequear `error` / RPC `add_exercise_to_session` |
| 7.6 | **El e1RM difiere entre TS y SQL.** `Math.round` en float y `round()` en `numeric` discrepan en los empates .5 (34 combinaciones con pasos de 2,5 kg; ej. 7,5 kg × 20 reps da 12 en JS y 13 en SQL). Además SQL considera los `drops` y `e1rmSeriesByExercise` no. | [metrics.ts:156](src/lib/metrics.ts#L156), [0009:6](supabase/migrations/0009_friend_profiles.sql#L6) | test de paridad **antes** de mover cálculo a SQL y un criterio único para los drops |
| 7.7 | **Ranking con otra métrica.** Las notificaciones de ranking usan un umbral fijo (`reps>=5 and rpe>=7`) y el scoreboard usa `is_hard_set` por perfil. | 0027 vs 0035 | unificar |
| 7.8 | **Racha de logros en UTC** y el resto de la app en día local. | [0015:120](supabase/migrations/0015_achievements.sql#L120) | ver 3.5 |
| 7.9 | **Permisos de más.** `detect_rank_overtakes` y `friend_ids` se pueden ejecutar con la anon key. | 3.1 | `revoke` |

---

## 8. Librerías y bundle

El impacto acá es menor. El cuello de botella es la arquitectura, no las dependencias.

| Propuesta | Por qué | Esfuerzo |
|---|---|---|
| `next/dynamic` para `VolumeChart`, `MuscleDonut`, `charts.tsx` (recharts) | Hoy entran estáticos al bundle de registro, amigos, `BodyProgress` y `GoalMetrics`, aunque estén bajo el fold o en otra pestaña. No hay ningún `next/dynamic` en `src/`. Doc: `02-guides/lazy-loading.md` | S |
| `@tanstack/query-persist-client-core` + `idb-keyval` | Cola de mutations offline y caché persistente para catálogo, rutinas y última sesión. Es la mejora de *velocidad percibida* más grande para una PWA de gimnasio | M–L |
| `@next/bundle-analyzer` (dev) | Medir antes y después; hoy no hay números de KB por ruta | S |
| Quitar `date-fns` | Está en `package.json` y no se importa en ningún lugar de `src/` | S |
| Service worker con caché de `/_next/static` (cache-first) y del shell (SWR), registrado siempre y no solo con push | Arranque instantáneo con wifi malo. No cachear `/api/*` ni respuestas autenticadas | M |
| Imágenes de ejercicios fuera de `raw.githubusercontent.com` | No es un CDN de producción: no optimiza ni cachea bien. Copiarlas a Supabase Storage o `public/`, con `width`/`height` fijos para evitar CLS | M |
| `exceljs` | **Ya** se carga con `import()` dinámico. No tocar | — |
| `optimizePackageImports` | `lucide-react` y `recharts` ya vienen optimizados por defecto en Next 16. No hace falta | — |

---

## 9. Plan de implementación sugerido

Cada ola se puede desplegar sola y mide su impacto antes de pasar a la siguiente.

**Ola 0: seguridad y correctitud (1 día, riesgo bajo)**
- `revoke` en `detect_rank_overtakes` y `friend_ids` (3.1)
- Bugs 7.1 (uuid en el cliente), 7.2 (deps del memo), 7.3, 7.4 y 7.5
- Columnas explícitas en `useFriends` (deja de exponer peso y altura)

**Ola 1: quick wins sin cambiar la forma de la API (2–3 días)**
- Verificar la región de Supabase/Vercel y alinearlas (2.3), y las JWT Signing Keys asimétricas
- `getSession()` en el cliente, `getClaims()` + `cache()` en el server, y el onboarding en un claim (2.1, 2.2)
- Índices (3.3) y RLS con `(select auth.uid())` + `to authenticated` (3.4.1)
- React Query: sesión activa con `staleTime: Infinity`, sacar las invalidaciones de `history` al iniciar, `useActiveSession` (4.4, 4.7)
- `useHistory` Fase 1 (4.3) y aislar los ticks del timer (6.1)
- `next/dynamic` para recharts y renombrar a `proxy.ts` con el matcher nuevo (2.5, 8)

**Ola 2: RPCs del camino crítico (1–2 semanas)**
- `start_workout_from_routine`, `last_exercise_logs`, `finish_session`, la sesión con embed y `update_sets` en batch
- Ranking acotado al grupo + push en paralelo + `after()` (3.1.2, 5.1)
- `useMyProfile` unificado (4.6) y el cómputo de métricas con caché (6.2 S)

**Ola 3: arquitectura (2–4 semanas)**
- Test de paridad TS/SQL (7.6), después el rollup `session_exercise_stats` (3.2) y después `registro_summary` (4.3 Fase 3)
- Persistencia offline de la caché y las mutations
- Prefetch en el server con `HydrationBoundary` para `/rutinas` y `/scoreboard` (2.4)
- Service worker con caché del shell

---

## 10. Qué hay que medir o verificar (no se pudo desde el repo)

1. **Región** del proyecto Supabase y región de las Functions en Vercel, y si *Fluid compute* está activo.
2. **Tipo de JWT** (HS256 legacy o asimétrico). Condiciona 2.1.
3. **`explain (analyze, buffers)`** como `authenticated` de: la query de `useHistory`, `useLastExerciseLogs`, `scoreboard_stats('hard_sets', …)` y `friend_metrics(…, 'all')`.
4. **Payload real** de `useHistory` en la pestaña Network con una cuenta de más de 6 meses de uso.
5. **`pg_stat_user_indexes`** para confirmar los índices sin uso, y `pg_stat_statements` para el top de queries por tiempo total.
6. **Bundle por ruta** con `@next/bundle-analyzer`.
7. Cantidad de filas con `workout_sessions.started_at is null`, que condiciona el backfill de 3.3.

---

## 11. Lo que está bien (no tocar)

- Las mutations de la sesión tienen optimistic update con rollback, y `markStaleBackground` usa `refetchType: "none"`.
- Los inputs de `SetRow` son no controlados y commitean en blur, así que tipear no re-renderiza.
- `useExercises` omite `instructions` y tiene un `staleTime` de 1 h.
- `useScoreboard` paraleliza y usa `keepPreviousData`.
- `useStartWorkout` paraleliza sus 3 lecturas iniciales.
- `exceljs` se carga con import dinámico.
- Todas las funciones `security definer` tienen `search_path` fijo.
- Las RPCs de lectura son `stable` y las `set_*` son `immutable`.
- La conversión de zona horaria está en el `select`/`group by` y no en el `where`.
- La limpieza de suscripciones push 404/410 ya está implementada.
- La paridad de umbrales `is_hard_set` (SQL) con `goalParams` (TS) coincide.

---

## Anexo: skills recomendadas para implementar esto

No se instalaron, porque modifican la configuración de Claude Code. Para sumarlas:

- **Supabase `postgres-best-practices`** (oficial, [supabase/agent-skills](https://github.com/supabase/agent-skills)): reglas priorizadas de RLS, índices y queries. Es útil en las olas 1–3 de DB.
  `/plugin marketplace add supabase/agent-skills` → `/plugin install postgres-best-practices@supabase-agent-skills`
- **Vercel `react-best-practices`** (oficial, `vercel-labs/agent-skills`, MIT): reglas de waterfalls, bundle y re-renders para React/Next.
  `npx skills add https://github.com/vercel-labs/agent-skills --skill vercel-react-best-practices`

Conviene evitar los mirrors de terceros (skillselion, llmbase, etc.) y usar solo los repos oficiales.
