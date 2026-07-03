# Handoff — pantallas de métricas y sesión

Prototipo navegable: `Entreno.dc.html` (mobile, ~394px, dark). Este doc explica
**qué se diseñó, por qué en ese orden, y qué evidencia respalda cada métrica**,
para implementarlo en Next.js 16 sobre el stack actual (Supabase + RLS, TanStack
Query, Zustand, Recharts, Tailwind, shadcn/ui).

## Principios transversales

- **Jerarquía = frecuencia de uso.** Arriba lo que se mira todos los días
  (racha, CTA, deltas); al medio lo de seguimiento semanal (series por músculo,
  e1RM); abajo lo analítico/histórico (heatmap, balance de patrones).
- **Sistema visual: el del código actual, no inventado.** Tokens de
  `globals.css`: `bg #09090a`, `surface #131312`, `surface-2 #1c1c1a`,
  `border #2e2c27`, `fg #f2f1ed`, `muted #9c9a92`, `primary/accent #cda548`,
  `success #34d399`, `danger #f87171`. Falta un token **warning**: agregar
  `--color-warning: #e0913a` (ámbar, distinto del dorado primary). Tipografía
  Archivo. Radio 8–14px. Sin gradientes salvo el relleno de área de los charts.
- **Reglas de copy/UI:** sentence case, español rioplatense (voseo), números
  `es-AR` (`24.850`), deltas siempre **flecha + % redondeado**, máx 2 columnas
  en cualquier grid, íconos lucide (sin emoji).
- **Dark + light:** los colores de charts/heatmap se pasan por token, no
  hardcodeados, para que el `color-scheme` los resuelva. En el prototipo están
  literales por ser dark-only; al portar, leerlos de CSS vars.

---

## 1. Dashboard (Inicio)

**Orden vertical y por qué:**

1. **Racha + CTA "empezar sesión".** Lo primero es la acción del día y el gancho
   motivacional. La racha usa `weeklyStreak()` (semanas que cumplieron el plan),
   no días sueltos — refuerza adherencia, que es el predictor #1 de resultados.
2. **2 stat cards con delta vs período previo.** *Volumen semanal* y *series
   efectivas (hard sets)*. Delta automático con flecha + % (`↑ 8% vs sem
   previa`). El volumen es la métrica clásica, pero las **hard sets** son el
   driver de hipertrofia mejor soportado (Schoenfeld: la relación
   dosis-respuesta se mide en series efectivas semanales, no en tonelaje).
3. **Gráfico de e1RM del ejercicio principal (90 d).** e1RM vía **Epley**
   (`estimate1RM`, ya en `metrics.ts`). Es la señal de fuerza más estable
   sesión a sesión (filtra variación de reps/peso). Área dorada + valor actual +
   delta.
4. **Barras horizontales de hard sets por grupo muscular (semana).** Cada barra
   tiene ticks verticales de **MEV (~10), MAV (~20) y MRV** por músculo
   (Schoenfeld volume landmarks). Color por estado: **bajo MEV → warning**,
   dentro de rango → success, **sobre MRV → danger**. Es la vista que dice
   "dónde falta y dónde te pasaste" de un vistazo.
5. **Heatmap tipo GitHub (12 semanas).** Intensidad por día (dorado sobre
   surface). Consistencia a largo plazo; complementa la racha (corto plazo).
6. **Preview de ranking.** Última en jerarquía porque es social, no diaria;
   entra a la pantalla completa de ranking.
7. **Bottom nav:** Inicio / Rutinas / Progreso / Perfil. El ranking se alcanza
   desde el dashboard y el perfil (se mantuvo el nav en 4 para no diluir el uso
   diario).

**Implementación charts:** en el prototipo son SVG a mano; en producción usar
Recharts. Barras MEV/MAV/MRV = `BarChart` horizontal + `ReferenceLine` por
músculo. Heatmap = grid custom (no hay componente Recharts), 12×7 celdas con
escala de opacidad del primary.

---

## 2. Progreso (tab nueva)

1. **Selector de ejercicio** (chips scrolleables) → **gráfico grande de e1RM en
   el tiempo** con **media móvil (ventana 4)** y **marcador del PR actual**
   (anillo sobre el punto máximo). La media móvil separa la tendencia real del
   ruido día a día; el PR da referencia de techo.
2. **Debajo, 4 mini-cards:** descanso promedio entre sets, **RIR promedio
   últimas 4 semanas** (autorregulación à la Helms — reps en reserva como
   control de proximidad al fallo; menor RIR = más cerca del fallo), **ratio
   peso corporal** (e1RM / bodyweight, hace
   comparable la fuerza entre pesos) y frecuencia (marca si supera el mínimo
   **2×/sem** por grupo, umbral de frecuencia con evidencia).
3. **Balance de patrones:** ratio **push/pull** y **compuesto/aislamiento** como
   barras divididas. Previene desbalances (salud articular / estética) que las
   métricas de volumen total no muestran.

---

## 3. Ranking (scoreboard mejorado)

- **Métricas evidence-based** en vez de solo tonelaje:
  - **Series efectivas / semana** — driver de hipertrofia (Schoenfeld).
  - **e1RM relativo al peso corporal** (`×`) — justo entre distintos pesos.
  - **Consistencia** (% de días planificados entrenados) — premia adherencia,
    no picos.
- **Delta de ranking:** flecha ▲/▼ por fila (verde/danger) según cambio de
  posición; medallas para top-3.
- **Animación al cambiar de ranking:** la fila que subió entra con un glow
  (`riseGlow`, ~1.4s). En producción, animar reordenamiento con layout
  animation (Framer Motion o `FLIP`) al refrescar la query.
- **Notificación push:** banner al ser pasado / pasar a alguien. Ya existe el
  endpoint `api/rank/notify` + `api/push/subscribe`; el banner in-app es el
  espejo visual del push.
- Caption bajo los tabs explica la métrica (educa sin cargar la UI).

---

## 4. PR celebration (modal)

- Bottom sheet que aparece **al terminar sesión si se rompió un récord**.
- Muestra ejercicio + peso del PR, **salto de e1RM** (Epley), delta vs PR previo
  y ratio peso corporal.
- CTA primaria **"compartir con amigos"** (cierra el loop de competencia →
  motivación) + "seguir".
- Trigger: al guardar la sesión, comparar cada `topWeight`/e1RM contra el
  histórico del ejercicio; si supera, abrir modal antes de volver al home.

---

## 5. Sesión activa

- **Header sticky** con nombre del día, cronómetro de sesión y "terminar".
- **Timer de descanso auto-iniciado** al completar un set (no warmup): anillo de
  progreso + cuenta regresiva + recomendación por tipo de ejercicio
  (**compuesto 2–3 min, aislamiento 1–2 min**) + `+30s` / saltar. Configurable
  por ejercicio.
- **Fila de set:** kg × reps, **RIR 0–5+ (segmented)** — reps en reserva, color
  por zona: **0–1 danger** (al fallo o muy cerca), **2–3 success** (zona
  productiva para hipertrofia), **4–5+ muted** (lejos del fallo). **Toggle de
  warmup (W)** que saca esa serie del cómputo de hard sets y oculta el RIR, y
  check de completado. Nota: RPE = 10 − RIR; el modelo puede guardar cualquiera
  de los dos y derivar el otro.
- **Dropsets** ("+ bajada") en la misma serie, ya soportado en el modelo
  (`SetDrop[]` en `SetRow.tsx`). El botón "+ dropset" agrega bajada a la última
  serie.
- Al completar la última serie de un ejercicio se autocompleta el resto (patrón
  ya presente en `SessionExerciseCard`).

---

## Notas de implementación

- Reusar `metrics.ts` tal cual: `estimate1RM` (Epley), `totalVolume`,
  `weeklyStreak`, `rollingCompliance`, `avgWeeklyWorkouts`.
- Formato con `format.ts` (`formatVolume` → `t` sobre 1000 kg, `formatWeight`,
  `formatClock`).
- Componentes existentes a extender: `Tabs` (segmented) para métrica/período,
  `Stat`/`Badge`, `SetRow` (sumar RIR + warmup), `Stopwatch` (base del rest
  timer), `VolumeChart` (plantilla de los charts de e1RM).
- **Agregar token `--color-warning`** y su alias Tailwind (`bg-warning`,
  `text-warning`) para el estado "bajo MEV".
