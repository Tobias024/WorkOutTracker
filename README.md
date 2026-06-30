# WorkOut Tracker

WebApp para crear rutinas de gimnasio, ejecutarlas registrando series/reps/peso,
llevar el historial con métricas, y competir con amigos.

Construida con **Next.js (App Router) + TypeScript + Tailwind + Supabase**, lista
para deploy en **Vercel**. UI en español, tema oscuro y mobile-first.

## Funcionalidades

- **Rutinas**: creá rutinas, agregá ejercicios de un catálogo (~870, con imágenes),
  definí series/reps objetivo y reordená.
- **Ejecución**: registrá peso, reps y comentarios por serie. **Cronómetro** flotante
  opcional para descansos, y tiempo de sesión con inicio/fin **editable**.
- **Reemplazar por…**: durante el entrenamiento cambiá un ejercicio sólo por esta vez
  o guardalo para futuras iteraciones de la rutina.
- **Registro**: historial, volumen total/semanal, volumen por músculo, frecuencia y
  récords (1RM estimado) con gráficos.
- **Ranking**: competí con amigos por **volumen**, **frecuencia** o **peso** en un
  ejercicio (semana / mes / histórico).
- **Amigos**: se agregan por **link de invitación**.
- **Compartir rutinas**: generá un link para que otros copien tu rutina (sin tus pesos).

## Stack

- Next.js 16 (App Router, RSC) · TypeScript · Tailwind CSS v4
- Supabase: Postgres + Auth (magic link / Google) + RLS
- TanStack Query · Zustand · Recharts · lucide-react

## Puesta en marcha

### 1. Dependencias

```bash
npm install
```

### 2. Proyecto Supabase

1. Creá un proyecto en [supabase.com](https://supabase.com).
2. Copiá las credenciales: **Settings → API**.
3. Creá `.env.local` a partir de `.env.example`:

```bash
cp .env.example .env.local
```

```env
NEXT_PUBLIC_SUPABASE_URL=https://TU-PROYECTO.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=tu-anon-key
SUPABASE_SERVICE_ROLE_KEY=tu-service-role-key   # sólo para el seed
NEXT_PUBLIC_SITE_URL=http://localhost:3000
```

### 3. Migraciones (esquema + RLS + funciones)

Con el [Supabase CLI](https://supabase.com/docs/guides/cli):

```bash
supabase link --project-ref TU-REF
supabase db push
```

O bien, copiá y ejecutá manualmente en el **SQL Editor** del dashboard, en orden:
`supabase/migrations/0001_init.sql` y luego `supabase/migrations/0002_rls.sql`.

### 4. Cargar el catálogo de ejercicios

Importa ~870 ejercicios con imágenes desde
[free-exercise-db](https://github.com/yuhonas/free-exercise-db) (MIT):

```bash
npm run seed
```

### 5. Auth

En el dashboard de Supabase, **Authentication → URL Configuration**:
agregá `http://localhost:3000/auth/callback` (y la URL de Vercel) como Redirect URL.
Para Google, habilitá el provider en **Authentication → Providers**.

### 6. Correr

```bash
npm run dev
```

## Deploy en Vercel

1. Importá el repo en Vercel.
2. Cargá las mismas variables de entorno (con `NEXT_PUBLIC_SITE_URL` apuntando al dominio).
3. Agregá `https://TU-DOMINIO/auth/callback` a las Redirect URLs de Supabase.

## Estructura

```
src/
  app/
    (app)/            # rutas protegidas con tab bar (rutinas, registro, ranking, amigos, ejercicios)
    entrenar/         # pantalla de ejecución de la sesión
    login, onboarding, auth/callback
    invite/[code]     # aceptar invitación de amigo
    r/[shareCode]     # importar rutina compartida
  components/         # UI, modales, tarjetas, cronómetro, gráficos
  hooks/              # data hooks (TanStack Query) + cronómetro (Zustand)
  lib/                # clientes Supabase, tipos, métricas, i18n de ejercicios
supabase/migrations/  # esquema, RLS y RPCs
scripts/seed-exercises.ts
```

## Privacidad de datos

- Cada usuario sólo accede a sus datos (RLS). Los flujos entre usuarios pasan por
  funciones `security definer`.
- Compartir una rutina copia su estructura, **nunca los pesos**.
- El ranking expone sólo agregados de amigos (volumen, frecuencia, peso máximo),
  no el detalle de cada serie.
