# Handoff — pantallas de métricas, progreso y sesión

## Overview
Rediseño de las pantallas de datos de la webapp de tracking de gimnasio:
**dashboard**, **progreso** (tab nueva), **ranking**, **modal de PR** y **sesión
activa** con RIR + timer de descanso. Objetivo: subir la jerarquía visual (lo
diario arriba, lo analítico abajo) y sumar métricas con respaldo en literatura
de fuerza.

## Sobre los archivos de este bundle
`Entreno.dc.html` es una **referencia de diseño hecha en HTML** — un prototipo
navegable que muestra la apariencia y el comportamiento buscados, **no código
para copiar tal cual**. La tarea es **recrear estos diseños dentro del codebase
existente** (Next.js 16 App Router, Supabase + RLS, TanStack Query, Zustand,
Recharts, Tailwind, shadcn/ui) usando sus patrones y componentes ya definidos.
`spec-pantallas.md` tiene la prosa de jerarquía + qué métrica respalda cada
decisión. `support.js` es solo el runtime del prototipo (ignorar en producción).

Para abrir el prototipo: `Entreno.dc.html` corre en el navegador. En el panel de
Tweaks se puede fijar la pantalla inicial (`startTab`), abrir el modal de PR
(`demoPr`) y cambiar el descanso de compuestos (`restCompound`).

## Fidelidad
**Alta (hifi).** Colores, tipografía, espaciados e interacciones son los
finales, tomados de los tokens reales del repo (`globals.css`). Recrear la UI
pixel-perfect con los componentes del codebase. Única incógnita menor: los
charts del prototipo son SVG a mano — en producción usar Recharts.

## Sistema visual (tokens reales del repo)
De `src/app/globals.css` (`@theme`):

| Token | Hex | Uso |
|---|---|---|
| bg | `#09090a` | fondo app |
| surface | `#131312` | cards |
| surface-2 | `#1c1c1a` | inputs, chips, filas |
| border | `#2e2c27` | bordes / divisores |
| fg | `#f2f1ed` | texto |
| muted | `#9c9a92` | texto secundario |
| primary / accent | `#cda548` / `#e8c468` | dorado de marca, CTAs, charts |
| primary-fg | `#14120c` | texto sobre dorado |
| success | `#34d399` | verde (óptimo / completado) |
| danger | `#f87171` | rojo (sobre MRV / cerca del fallo) |
| **warning (FALTA)** | `#e0913a` | **agregar** — estado "bajo MEV" |

- Tipografía: **Archivo** (`--font-archivo`), pesos 400–800.
- Radio: 8px base (`--radius`), 12–14px en cards de sección.
- Sin gradientes salvo el relleno de área de los charts (dorado → transparente).
- Íconos: **lucide** (sin emoji). Números `es-AR` (`24.850`). Sentence case,
  voseo. Deltas siempre **flecha + % redondeado**. Máx 2 columnas por grid.
- **Dark + light:** pasar los colores de charts/heatmap por CSS var, no
  hardcodear (en el prototipo están literales por ser dark-only).

## Pantallas
Ver `spec-pantallas.md` para el detalle de jerarquía y respaldo de cada métrica.
Resumen:

1. **Dashboard (Inicio)** — orden: racha (`weeklyStreak`) + CTA "empezar sesión"
   → 2 stat cards con delta (volumen semanal, series efectivas) → chart e1RM 90d
   (Epley) → **barras de series por grupo con ticks MEV(~10)/MAV(~20)/MRV por
   músculo** (Schoenfeld; color: bajo MEV=warning, en rango=success, sobre
   MRV=danger) → heatmap 12 semanas → preview de ranking. Bottom nav: Inicio /
   Rutinas / Progreso / Perfil.
2. **Progreso** — selector de ejercicio (chips) → chart grande de e1RM con
   **media móvil (4)** y **marcador de PR** → 4 cards: descanso prom, **RIR
   prom 4 sem** (Helms), ratio peso corporal, frecuencia (≥2×/sem) →
   **balance de patrones** (push/pull, compuesto/aislamiento).
3. **Ranking** — métricas evidence-based: **series/sem**, **e1RM relativo al
   peso**, **consistencia (%)**. Delta ▲▼ por fila, medallas top-3, animación de
   ascenso (`riseGlow`), banner de push (endpoints `api/rank/notify` +
   `api/push/subscribe` ya existen).
4. **Modal de PR** — bottom sheet al terminar sesión si se rompió récord:
   ejercicio + peso, salto de e1RM, delta vs PR previo, CTA "compartir".
5. **Sesión activa** — header sticky con cronómetro; **timer de descanso con
   anillo, auto-iniciado al completar set** (compuesto 2–3 min / aislamiento
   1–2 min, +30s/saltar); fila de set con kg×reps, **RIR 0–5+ segmented**
   (0–1 danger / 2–3 success / 4–5 muted), **toggle warmup (W)**, check, y
   **dropsets** ("+ bajada", ya soportado en `SetDrop[]`).

## Interacciones y comportamiento
- Navegación por bottom nav (4 tabs); ranking y sesión son vistas full con back.
- Timer de descanso: al `toggle` de un set no-warmup → arranca cuenta regresiva
  según tipo de ejercicio; anillo con `transition: stroke-dashoffset 1s linear`.
- Completar la última serie autocompleta las anteriores (patrón ya en
  `SessionExerciseCard`).
- Animaciones: `popIn` (modales/toasts ~0.3s), `riseGlow` (fila que sube ~1.4s),
  `ringPulse` (CTA/PR), `confFall` (confetti del PR). En producción, reordenar
  el ranking con layout animation (Framer Motion / FLIP) al refrescar la query.

## State
- `tab` (inicio/rutinas/sesion/progreso/perfil/ranking), `prModal`.
- Sesión: `session[]` (ejercicios → sets con `kind` warm/work, `weight`, `reps`,
  `rir`, `done`, `drop?`), timer: `restActive`/`restSeconds`/`restTarget`,
  `elapsed`.
- Progreso: `prog` (ejercicio elegido). Ranking: `metric` (0–2), `period` (0–2).

## Métricas y su respaldo (para decidir qué medir)
- **Series efectivas / semana (hard sets)** — driver de hipertrofia; volume
  landmarks MEV/MAV/MRV (Schoenfeld).
- **e1RM** vía **Epley** (`estimate1RM` en `metrics.ts`) — señal de fuerza
  estable; en ranking, relativo al peso corporal para ser justo.
- **RIR** — autorregulación (Helms). RPE = 10 − RIR; guardar uno y derivar.
- **Frecuencia ≥ 2×/sem** por grupo muscular.
- **Consistencia** (% días planificados entrenados) — adherencia.

## Reutilizar del repo
- `src/lib/metrics.ts`: `estimate1RM`, `totalVolume`, `weeklyStreak`,
  `rollingCompliance`, `avgWeeklyWorkouts`.
- `src/lib/format.ts`: `formatVolume` (`t` sobre 1000 kg), `formatWeight`,
  `formatClock`.
- Componentes: `Tabs` (segmented), `Stat`, `Badge`, `SetRow` (+RIR, +warmup),
  `Stopwatch` (base del rest timer), `VolumeChart` (plantilla de charts).
- **Agregar token `--color-warning: #e0913a`** + alias Tailwind
  (`bg-warning` / `text-warning`) para el estado "bajo MEV".

## Charts (Recharts)
- e1RM: `AreaChart` dorado (patrón de `VolumeChart`) + `Line` de media móvil
  (dashed muted) + punto/`ReferenceDot` para el PR.
- Series por músculo: `BarChart` horizontal + `ReferenceLine` (MEV/MAV/MRV) por
  fila; fill según estado.
- Heatmap: grid custom 12×7 (no hay componente Recharts), escala de opacidad del
  primary; celdas `aspect-ratio:1`, radio 3px.

## Archivos
- `Entreno.dc.html` — prototipo navegable (referencia de diseño).
- `spec-pantallas.md` — jerarquía + respaldo de métricas (prosa).
- `support.js` — runtime del prototipo (ignorar en producción).
