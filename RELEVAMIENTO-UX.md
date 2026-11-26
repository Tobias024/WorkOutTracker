# Relevamiento UX/UI · WOLF (WorkOut, Logs & Friends)

> **Fecha:** 2026-11-04 · **Alcance:** todos los flujos de la app (auth y páginas públicas, rutinas y catálogo, sesión de entrenamiento, registro y métricas, social/ranking/perfil) más el sistema de diseño transversal.
> **Método:** auditoría estática sobre el código (Next.js + Tailwind). Las medidas salen de las clases y los contrastes se calcularon con WCAG 2.1 sobre los tokens de [globals.css](src/app/globals.css). Ancho de referencia: **360 px** (mobile chico). Los hallazgos que afirman un bug de lógica se verificaron contra el código. Falta validarlo todo en dispositivo real.
> **Referencias de buenas prácticas:** Apple HIG (tap target 44 pt) / Material (48 dp), WCAG 2.1 AA (contraste 4.5:1 en texto y 3:1 en UI, 1.4.4 resize, 2.4.7 foco visible), Nielsen (visibilidad del estado, prevención de errores, control y libertad del usuario) y el handoff interno (`# Diseño de pantallas métricas/design_handoff_metricas/`).

## Cómo leer cada hallazgo

Cada ítem tiene un ID estable para usar en tickets o en el plan (`GLB-`, `AUTH-`, `RUT-`, `ENT-`, `REG-`, `SOC-`) y sigue esta estructura:

- **Caso de uso** (por pantalla): por qué y cómo llega el usuario ahí.
- **Ubicación**: archivo y línea; el link es clickeable.
- **Vista**: qué ve el usuario.
- **Acción**: qué intenta hacer.
- **Problema**: el error frente a la buena práctica.
- **Propuesta**: el cambio concreto.
- **Severidad**:
  - **Alta**: provoca pérdida de datos o acciones irreversibles por error, bloquea el flujo o incumple accesibilidad básica en el camino principal.
  - **Media**: genera fricción o confusión frecuente.
  - **Baja**: es pulido o consistencia.

## Resumen

| Alcance | Alta | Media | Baja | Total |
|---|:-:|:-:|:-:|:-:|
| [0. Sistema de diseño y navegación global](#0-sistema-de-diseño-y-navegación-global) | 4 | 4 | 6 | 14 |
| [1. Auth, onboarding y páginas públicas](#1-auth-onboarding-y-páginas-públicas) | 4 | 11 | 6 | 21 |
| [2. Rutinas y catálogo de ejercicios](#2-rutinas-y-catálogo-de-ejercicios) | 6 | 14 | 6 | 26 |
| [3. Sesión de entrenamiento activa](#3-sesión-de-entrenamiento-activa) | 9 | 15 | 2 | 26 |
| [4. Registro y métricas](#4-registro-y-métricas) | 5 | 19 | 4 | 28 |
| [5. Social, ranking y perfil](#5-social-ranking-y-perfil) | 6 | 13 | 3 | 22 |
| **Total** | **34** | **76** | **27** | **137** |

El flujo más comprometido es **Entrenar**: concentra 9 de las 34 Altas. Es justo donde el usuario tiene menos atención disponible (una mano, entre series).

## Patrones transversales

La mayoría de los hallazgos son síntomas de **8 problemas de fondo**. Si se resuelven como componentes o patrones del sistema, se cierran decenas de ítems de una vez.

| # | Patrón | Hallazgos relacionados | Solución de sistema |
|---|---|---|---|
| P1 | **Un error se ve como vacío o como spinner infinito.** Solo se lee `isLoading`; si la query falla, el usuario "pierde" sus datos o queda trabado. | RUT-01, RUT-09, REG-01, SOC-10, SOC-15, SOC-16, ENT-03, AUTH-12, SOC-19 | Componente `QueryState` (loading → skeleton, error → mensaje + "Reintentar", vacío → `EmptyState`) y regla: nunca usar `!data` como sinónimo de "cargando". |
| P2 | **Acciones destructivas sin confirmación ni deshacer**, con íconos chicos pegados a la acción principal. | RUT-10, RUT-11, ENT-01, ENT-10, ENT-11, ENT-13, SOC-12, REG-26, AUTH-14 | `IconButton` (≥44 px de área), `ConfirmDialog` para lo irreversible y toast con **"Deshacer"** para lo frecuente (borrar serie o ejercicio). Separar lo destructivo de lo primario (≥16 px o moverlo a un menú ⋯). |
| P3 | **Fallos silenciosos y sin feedback de éxito.** No hay un sistema de toasts; se usa `alert()`/`confirm()`. | GLB-08, ENT-02, RUT-06, RUT-08, RUT-14, REG-27, REG-28, SOC-13, SOC-20, AUTH-06, AUTH-17, AUTH-18 | `Toaster` global y `onError` por defecto en el `QueryClient` para las mutaciones. Indicador "Guardado · hace 2 s" en los editores con autosave. |
| P4 | **Tap targets chicos** en las primitivas y en controles ad hoc. | GLB-01, ENT-14, ENT-15, ENT-19, RUT-11, RUT-12, RUT-15, RUT-24, AUTH-03, SOC-02, SOC-12 | Corregir `Button sm`, `Tabs` y crear `IconButton`. Mínimo 44 px general y 48 px en Entrenar. |
| P5 | **Tema claro "girly" sin contraste suficiente** y colores hardcodeados que lo ignoran. | GLB-02, REG-13, REG-20, REG-21, AUTH-02 | Recalibrar los tokens del tema claro (AA) y pasar todos los colores de charts por `chart-theme`/CSS vars. |
| P6 | **Formularios sin `<label>` asociado**, solo con placeholder, sin `autocomplete` ni `inputMode` correcto. | AUTH-02, AUTH-10, RUT-05, RUT-23, ENT-16, REG-24, SOC-19 | Componente `Field` (label + input + hint + error con `aria-describedby`). |
| P7 | **Modales apilados y no accesibles**: Escape cierra todos y el scroll del fondo se libera. | GLB-06, RUT-25, SOC-14, SOC-22 | Stack de modales en el `Modal` (solo cierra el superior; el lock de scroll se cuenta por referencia), `role="dialog"`, focus trap. |
| P8 | **Navegación y arquitectura de información**: ajustes y perfil escondidos, pantallas con demasiado antes del contenido. | GLB-05, SOC-01, SOC-03, RUT-02, REG-02, REG-04, REG-07, ENT-04, ENT-09 | Tab "Perfil" en la TabBar (que agrupe perfil, amigos y ajustes), CTA "Entrenar" directo en la home, jerarquía "lo diario arriba, lo analítico abajo" como dice el handoff. |

## Bugs funcionales detectados durante el relevamiento

No son "de diseño", pero se manifiestan como mala experiencia (datos incorrectos, duplicados o pérdidas) y conviene resolverlos **antes** de los cambios visuales. Todos están verificados contra el código.

| ID | Bug | Impacto |
|---|---|---|
| GLB-14 | `Button` aplica `{...props}` después de `disabled`, así que con `loading` sigue clickeable. | Envíos dobles en toda la app. Es un fix de una línea. |
| AUTH-18 | Import de bundle sin bloqueo y sin manejo de error (consecuencia de GLB-14). | Rutinas duplicadas o importación parcial sin aviso. |
| RUT-21 | `CreateExerciseModal` siempre montado y `useState(initialName)` lee solo el primer render. | "Crear «X»" abre el formulario con el nombre vacío. |
| RUT-07 | El import de Excel descarta la duración y la distancia que la vista previa sí cuenta. | Pérdida silenciosa de datos. |
| RUT-17 | "Copiar" genera un link público sobre la rutina original. | La rutina queda marcada como "Compartida" sin que el usuario lo haya pedido. |
| REG-03 | El delta de "esta semana" compara las dos semanas anteriores; un 0 % sale verde ▲. | Métrica engañosa. |
| REG-16 | El tooltip del heatmap dice "kg" cuando el valor son series. | Dato mal rotulado. |
| REG-18 | `labelKey` en [charts.tsx:81](src/components/charts.tsx#L81) ordena por mes×100+día, sin año. | Gráficos que zigzaguean entre noviembre y marzo; puntos de años distintos se fusionan. |
| SOC-19 | Si falla la carga del perfil, el formulario arranca vacío y "Guardar" pisa sexo, altura y peso con `null`. | Pérdida de datos del perfil. |
| AUTH-07 | `next` no se valida en el callback ni en el login. | **Open redirect** (seguridad, no UX); detallado dentro de AUTH-07. |

## Plan sugerido por fases

1. **Fase 0: correctness (1–2 días).** La tabla de bugs de arriba.
2. **Fase 1: fundaciones del sistema (P1–P7).** `IconButton`, `ConfirmDialog`, `Toaster` + `onError` global, `QueryState` + `Skeleton`, `Field`, `Modal` accesible con stack, tokens del tema claro, escala tipográfica cerrada (GLB-04) y foco visible. Sin esto, cada pantalla se arregla "a mano" y vuelve a romperse.
3. **Fase 2: flujo crítico de Entrenar.** Las 9 Altas de ENT (confirmación de finalizar, guardado offline y errores, fila de serie con targets de 48 px y teclado decimal, RIR, foco en la serie actual, timer de descanso según el handoff).
4. **Fase 3: navegación y arquitectura de información (P8).** Tab "Perfil" y centralización de ajustes, home de Rutinas con "Entrenar" directo, reorden de Registro (KPIs a 2 columnas, sub-navegación arriba, historial accesible) y simplificación de los filtros del Ranking.
5. **Fase 4: dataviz y métricas.** Leyendas, paletas distinguibles, unidades y formato es-AR, jerga explicada (REG-13, 15, 17, 20–25).
6. **Fase 5: pulido.** Severidades Bajas, consistencia de headers y copy.

---


# 0. Sistema de diseño y navegación global

## Sistema de diseño y navegación global
**Caso de uso:** Aplica a todas las pantallas. Son las primitivas de [ui.tsx](src/components/ui.tsx), los tokens de [globals.css](src/app/globals.css), la [TabBar](src/components/TabBar.tsx) y los layouts. Si se corrige acá, el arreglo se propaga solo a cada flujo.

### GLB-01 · Tap targets por debajo de 44px en las primitivas
- **Ubicación:** [ui.tsx:29](src/components/ui.tsx#L29), [ui.tsx:372](src/components/ui.tsx#L372)
- **Vista:** `Button size="sm"` (`h-8` = 32px), segmentos de `Tabs` (`py-1.5` + `text-sm` ≈ 32px), botones de info "i" (`size-3`/`size-3.5` = 12–14px sin padding) y la X del Modal (`size-5` = 20px sin padding).
- **Acción:** Tocar filtros, acciones secundarias, cerrar hojas o abrir la explicación de una métrica.
- **Problema:** Apple HIG pide 44pt y Material pide 48dp. Con 12–20px el usuario falla toques, sobre todo con una mano o transpirado. El botón "i" de 12px casi no se puede tocar.
- **Propuesta:** Que `sm` quede en `h-9` (36px) de alto visual pero con área táctil de 44px vía `relative after:absolute after:-inset-1.5` (o `min-h-11` si se puede). `Tabs`: `py-2.5` / `min-h-10`. Botones solo-ícono: wrapper `grid place-items-center size-11 -m-3` que conserve el ícono visual. Conviene crear un `IconButton` en ui.tsx y reemplazar los usos sueltos.
- **Severidad:** Alta   ·   **Categoría:** tap-target

### GLB-02 · Contraste insuficiente en el tema claro "girly"
- **Ubicación:** [globals.css:32-45](src/app/globals.css#L32-L45)
- **Vista:** Todo el texto secundario, los placeholders, los estados y los CTAs cuando el tema "Floral" está activo.
- **Acción:** Leer labels, subtítulos, deltas y textos de botones.
- **Problema:** Ratios medidos (WCAG AA pide 4.5:1 para texto normal y 3:1 para UI): `muted` sobre `surface` **3.98**, sobre `surface-2` **3.35**; placeholder (`muted/60` sobre `surface-2`) **1.95**; `success` sobre `surface` **2.91**; `warning` **2.67**; `primary` como texto sobre `bg` **3.79**; texto de `Button danger` (danger sobre danger/15) **3.36**. En el tema oscuro, en cambio, todo pasa con holgura (muted 6.6, danger 6.7). Solo el placeholder queda justo (3.05).
- **Propuesta:** Oscurecer los tokens del tema claro: `muted` ≈ `#7d5562`, `success` ≈ `#2f7a8a`, `warning` ≈ `#a8681f`, `primary` ≈ `#9a4568` (mantiene el tono y llega a ≥4.5). Placeholder: `placeholder:text-muted` sin opacidad. Validar cada par con un checker antes de mergear.
- **Severidad:** Alta   ·   **Categoría:** contraste

### GLB-03 · El zoom está bloqueado (`maximumScale: 1`)
- **Ubicación:** [layout.tsx:27](src/app/layout.tsx#L27)
- **Vista:** Toda la app.
- **Acción:** Hacer pinch-zoom para leer un número chico o un gráfico.
- **Problema:** Incumple WCAG 1.4.4 (Resize text). Sumado a los textos de 9–11px (GLB-04), deja sin salida a quien ve poco. Suele usarse para evitar el auto-zoom de iOS en inputs, pero eso ya se resuelve porque los inputs usan `font: inherit` ≥16px.
- **Propuesta:** Sacar `maximumScale`. Revisar que todo input/select tenga `text-base` (16px) para que iOS no haga zoom al enfocar.
- **Severidad:** Media   ·   **Categoría:** accesibilidad

### GLB-04 · Escala tipográfica con tamaños arbitrarios por debajo del mínimo legible
- **Ubicación:** [ui.tsx:253](src/components/ui.tsx#L253), [ui.tsx:259](src/components/ui.tsx#L259) y otros 25 usos en `src/`
- **Vista:** Subtextos de `Stat`, chips, ejes y leyendas.
- **Acción:** Leer información secundaria (comparativas, "últ. sem", unidades).
- **Problema:** Conviven `text-[9px]`, `[10px]` (10 usos), `[10.5px]`, `[11px]` (9 usos), `[11.5px]` y `[13px]`, fuera de la escala de Tailwind. En mobile, menos de 11–12px no se lee y la escala fragmentada rompe el ritmo visual.
- **Propuesta:** Definir una escala cerrada en `@theme`: `--text-2xs: 11px` (piso absoluto, solo para ejes de gráficos), `xs 12`, `sm 14`, `base 16`, `lg 18`, `xl 20`, `2xl 24`. Reemplazar todos los `text-[Npx]` y prohibirlos por lint (regla `no-arbitrary-value` para font-size).
- **Severidad:** Media   ·   **Categoría:** tipografía

### GLB-05 · Navegación principal incompleta: Perfil y Ejercicios no tienen entrada fija
- **Ubicación:** [TabBar.tsx:9-13](src/components/TabBar.tsx#L9-L13)
- **Vista:** La TabBar muestra solo Rutinas, Registro y Ranking.
- **Acción:** Ir a mi perfil o ajustes (tema, notificaciones, cerrar sesión), gestionar amigos o ver el catálogo de ejercicios.
- **Problema:** A `/perfil` se llega solo por un ícono en Registro ([registro/page.tsx:903](src/app/(app)/registro/page.tsx#L903)), por FriendsPanel o tocando la fila propia en el ranking. A `/ejercicios`, solo desde un link en Rutinas. Son entradas escondidas y que dependen del contexto: el usuario no forma un modelo mental de dónde están los ajustes. Además, cuando se está en `/perfil` o `/amigos/*` ningún tab queda activo, así que se pierde la orientación.
- **Propuesta:** Agregar un 4.º tab "Perfil" (ícono `User`) que agrupe perfil, amigos y ajustes, o poner un avatar fijo en el header de todas las pantallas. Marcar el tab padre activo en las sub-rutas (`/amigos/*` → Ranking o Perfil).
- **Severidad:** Alta   ·   **Categoría:** navegación

### GLB-06 · El Modal no es un diálogo accesible
- **Ubicación:** [ui.tsx:127-192](src/components/ui.tsx#L127-L192)
- **Vista:** Todas las hojas y diálogos (picker de ejercicios, info, reemplazar, etc.).
- **Acción:** Abrir y cerrar una hoja, o navegar dentro de ella.
- **Problema:** No tiene `role="dialog"`, `aria-modal` ni `aria-labelledby`. No atrapa el foco ni lo devuelve al disparador. La X no tiene `aria-label`. El `h2` se renderiza vacío cuando no hay `title`. Tampoco hay handle visual de "arrastrar para cerrar", que es lo que el usuario espera de un bottom sheet en mobile.
- **Propuesta:** `role="dialog" aria-modal="true" aria-labelledby={titleId}`, focus trap (`inert` en el resto o librería), `aria-label="Cerrar"` en la X, un handle `w-10 h-1 rounded-full bg-border mx-auto mt-2` en modo sheet y, opcionalmente, swipe-down para cerrar.
- **Severidad:** Media   ·   **Categoría:** accesibilidad

### GLB-07 · No hay indicador de foco visible
- **Ubicación:** [ui.tsx:34-40](src/components/ui.tsx#L34-L40) (0 usos de `focus-visible` en todo `src/`)
- **Vista:** Botones, links, tabs y filas clicables.
- **Acción:** Navegar con teclado, switch control o teclado Bluetooth.
- **Problema:** Solo `Input` y `Textarea` tienen ring de foco. El resto depende del outline por defecto, que sobre fondos oscuros casi no se ve y que algunos navegadores ocultan. Incumple WCAG 2.4.7.
- **Propuesta:** Agregar `focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-bg` a `Button`, `Tabs`, los links de la TabBar y el futuro `IconButton`.
- **Severidad:** Baja   ·   **Categoría:** accesibilidad

### GLB-08 · Feedback del sistema con `alert()` / `confirm()` nativos y sin toasts
- **Ubicación:** [rutinas/page.tsx:202](src/app/(app)/rutinas/page.tsx#L202), [r/[shareCode]/page.tsx:48](src/app/r/[shareCode]/page.tsx#L48), [FriendsPanel.tsx:42](src/components/FriendsPanel.tsx#L42), [rutinas/[id]/page.tsx:148](src/app/(app)/rutinas/[id]/page.tsx#L148)
- **Vista:** Errores de importación o de copia de rutina, confirmación de cerrar sesión y de eliminar rutina o amigo.
- **Acción:** Confirmar una acción destructiva o recibir el resultado de una acción.
- **Problema:** Los diálogos nativos rompen la estética, en una PWA standalone muestran el dominio, bloquean el hilo y no se pueden personalizar (botón destructivo en rojo, copy de las opciones). Además no hay un sistema de toasts para confirmar éxitos ("Rutina guardada", "Link copiado") ni para ofrecer "Deshacer", que suele ser mejor patrón que confirmar.
- **Propuesta:** Crear `ConfirmDialog` (sobre el `Modal center`, con `Button variant="danger"` a la derecha y "Cancelar" ghost) y un `Toaster` liviano (p. ej. `sonner`) con soporte para acción "Deshacer". Reemplazar todos los `alert` y `confirm`.
- **Severidad:** Media   ·   **Categoría:** feedback

### GLB-09 · Encabezados de página inconsistentes
- **Ubicación:** [perfil/page.tsx:119](src/app/(app)/perfil/page.tsx#L119), [amigos/[id]/page.tsx:117](src/app/(app)/amigos/[id]/page.tsx#L117), [ui.tsx:96](src/components/ui.tsx#L96)
- **Vista:** El título de cada pantalla.
- **Acción:** Orientarse al cambiar de sección.
- **Problema:** Rutinas, Registro, Ranking y Ejercicios usan `PageHeader` (`text-2xl` + `tracking-tight`). Perfil, Amigos, Onboarding, Invite y las rutinas compartidas arman su `h1` a mano con `text-xl` o `text-2xl` y sin tracking. El título "salta" de tamaño entre pantallas del mismo nivel, y las sub-pantallas no tienen un patrón común de "volver + título".
- **Propuesta:** Usar `PageHeader` en todas las pantallas y agregarle una prop `back?: string | () => void` que muestre un `IconButton` `ChevronLeft` a la izquierda, para unificar las sub-pantallas (detalle de rutina, perfil de amigo, perfil).
- **Severidad:** Baja   ·   **Categoría:** consistencia

### GLB-10 · Estados de carga con spinner genérico en lugar de skeletons
- **Ubicación:** [(app)/loading.tsx](src/app/(app)/loading.tsx), 13 páginas con `Spinner`
- **Vista:** Al entrar a cualquier tab aparece un spinner centrado con `py-24`.
- **Acción:** Cambiar de tab o abrir una pantalla.
- **Problema:** El spinner no anticipa la estructura, provoca saltos de layout (CLS) cuando llega el contenido y hace sentir la app más lenta. No hay ni un `animate-pulse` en el código.
- **Propuesta:** Un componente `Skeleton` (`animate-pulse rounded-md bg-surface-2`) y `loading.tsx` por ruta, que imiten el layout real (header + 2–3 cards).
- **Severidad:** Baja   ·   **Categoría:** estados

### GLB-11 · Escala de radios y espaciado sin reglas claras
- **Ubicación:** [globals.css:84](src/app/globals.css#L84), [ui.tsx:236](src/components/ui.tsx#L236), [ui.tsx:310](src/components/ui.tsx#L310)
- **Vista:** Cards, chips, botones e inputs.
- **Acción:** Escanear la pantalla.
- **Problema:** `.card` usa `--radius` de 8px, pero `Stat` lo pisa con `rounded-lg` y `SectionCard` con `rounded-xl`. Hay además `rounded`, `rounded-md`, `rounded-sm` y `rounded-[3px]` mezclados. En el gap se usan 8 valores distintos (0.5, 1, 1.5, 2, 2.5, 3, 3.5, 4, 5). El resultado es una densidad irregular entre cards hermanas.
- **Propuesta:** Documentar tres niveles de radio (`control` 6px = botones e inputs; `card` 12px = todas las cards; `pill` = chips y avatares) y una escala de espaciado de 4/8/12/16/24. Ajustar `.card` a 12px y sacar los overrides.
- **Severidad:** Baja   ·   **Categoría:** espaciado

### GLB-12 · Semántica de color "success" en azul y desalineada del handoff
- **Ubicación:** [globals.css:13](src/app/globals.css#L13)
- **Vista:** Deltas positivos, series completadas, estados "óptimo".
- **Acción:** Interpretar si algo está bien o mal.
- **Problema:** `--color-success` es `#38bdf8` (celeste), mientras que el handoff de diseño define `#34d399` (verde). Puede ser una decisión deliberada por daltonismo (el tema claro lo comenta), pero no está documentada, y el par azul/rojo para subir/bajar no es una convención. En el tema claro, encima, no pasa contraste (GLB-02).
- **Propuesta:** Decidirlo explícitamente: si se queda el celeste por accesibilidad, documentarlo en el handoff y acompañar siempre el color con un ícono (flecha o check), algo que `DeltaChip` ya hace. Si no, volver al verde del handoff.
- **Severidad:** Baja   ·   **Categoría:** consistencia

### GLB-13 · Tabs y TabBar sin semántica ARIA de navegación
- **Ubicación:** [TabBar.tsx:26-41](src/components/TabBar.tsx#L26-L41), [ui.tsx:349-384](src/components/ui.tsx#L349-L384)
- **Vista:** La barra inferior y los segmented controls.
- **Acción:** Usar lector de pantalla para saber en qué sección o filtro se está.
- **Problema:** La TabBar no marca `aria-current="page"` en el link activo. `Tabs` no usa `role="tablist"`/`role="tab"` + `aria-selected` (o `aria-pressed` si es un filtro). El estado activo solo se comunica con color.
- **Propuesta:** `aria-current={active ? "page" : undefined}` en la TabBar. En `Tabs`, `role="radiogroup"` + `role="radio"` + `aria-checked` (son filtros, no paneles).
- **Severidad:** Baja   ·   **Categoría:** accesibilidad

### GLB-14 · `Button` queda habilitado mientras está en `loading` si se le pasa `disabled`
- **Ubicación:** [ui.tsx:41-42](src/components/ui.tsx#L41-L42)
- **Vista:** Cualquier botón con spinner de carga que además reciba `disabled` explícito: importar bundle, login, guardar rutina, perfil, notificaciones, medidas corporales, entrenar (al menos 9 archivos combinan ambas props).
- **Acción:** Tocar un CTA y, mientras procesa, volver a tocarlo (doble tap, impaciencia).
- **Problema:** Se aplica `disabled={loading || props.disabled}` y después `{...props}`, que vuelve a escribir `disabled` con el valor original. Si el caller pasa `disabled={false}` (o una condición que da false), el botón muestra el spinner pero sigue aceptando toques. Resultado: acciones duplicadas, como rutinas importadas dos veces o mutaciones repetidas.
- **Propuesta:** Desestructurar `disabled` y aplicarlo después del spread: `({ disabled, ...props }) => <button {...props} disabled={loading || disabled} aria-busy={loading || undefined}>`. Es un fix de una línea con impacto en toda la app; conviene hacerlo primero.
- **Severidad:** Alta   ·   **Categoría:** feedback

---

# 1. Auth, onboarding y páginas públicas

## Login / Registro / Link mágico
**Caso de uso:** Primera pantalla para quien no tiene sesión: llega desde el ícono de la PWA, desde un link de invitación o de rutina compartida (`/login?next=...`), o rebotado por el middleware. Desde acá inicia sesión, crea una cuenta, pide link mágico o recupera la contraseña.

### AUTH-01 · Pantalla "Revisá tu mail" sin salida
- **Ubicación:** [login/page.tsx:150](src/app/login/page.tsx#L150)
- **Vista:** Al enviar el link mágico, registrarse con confirmación o pedir el reset, la card se reemplaza por "Revisá tu mail ✉️ / Te enviamos un link a {email}".
- **Acción:** Darse cuenta de que escribió mal el mail, reenviar porque no llegó, o volver a iniciar sesión.
- **Problema:** `sent` nunca vuelve a `false`, así que la pantalla no tiene salida: no hay "Usar otro mail", ni "Reenviar", ni "Volver". La única forma de salir es recargar. Además el mensaje es el mismo en los tres flujos (confirmar la cuenta, entrar o resetear la contraseña), así que el usuario no sabe qué hace el link ni qué esperar al tocarlo. No sugiere revisar spam.
- **Propuesta:** Guardar el motivo (`sent: "magic" | "signup" | "reset" | null`) y adaptar el copy: "Confirmá tu cuenta desde el mail que te mandamos a X", "Te mandamos un link para entrar", "Te mandamos un link para cambiar tu contraseña". Sumar "Si no lo ves, revisá spam." Agregar `Button variant="secondary"` "Reenviar mail" (respetando el cooldown que ya traduce `translateError`) y un link "Usar otro mail" que haga `setSent(false)`.
- **Severidad:** Alta   ·   **Categoría:** estados

### AUTH-02 · Campos sin label, sin autocomplete y placeholder casi invisible en tema girly
- **Ubicación:** [login/page.tsx:161](src/app/login/page.tsx#L161)
- **Vista:** Formulario con dos `Input` (mail y contraseña), y otro de mail en el modo link mágico (L207).
- **Acción:** Completar mail y contraseña, idealmente con el autocompletado o el gestor de contraseñas del teléfono.
- **Problema:** El placeholder ("tu@email.com", "Contraseña") es el único label: desaparece al escribir y los lectores de pantalla no reciben un nombre accesible. No hay `autoComplete="email"` ni `autoComplete="current-password"`/`"new-password"` según `isSignup`, así que iOS y Android no ofrecen bien las contraseñas guardadas ni sugieren una contraseña fuerte al registrarse. Tampoco hay botón para mostrar la contraseña, algo clave cuando se escribe en un teclado mobile. En el tema girly el placeholder (`placeholder:text-muted/60` sobre `surface-2`) da ≈1.95:1, prácticamente ilegible (en el oscuro ≈3.05:1).
- **Propuesta:** Labels visibles `text-sm text-muted` con `htmlFor`/`id` (como en onboarding, pero asociados). Agregar `autoComplete="email"`, `autoCapitalize="none"`, `autoCorrect="off"` en el mail y `autoComplete={isSignup ? "new-password" : "current-password"}` en la contraseña. Sumar un toggle de ojo (`Eye`/`EyeOff`, `size-11`, `aria-label="Mostrar contraseña"`) dentro del input. En signup, ayuda inline "Mínimo 6 caracteres".
- **Severidad:** Alta   ·   **Categoría:** formulario

### AUTH-03 · Acciones secundarias: links de texto de 12px apilados y con tap target mínimo
- **Ubicación:** [login/page.tsx:182](src/app/login/page.tsx#L182)
- **Vista:** Debajo del CTA hay tres `<button>` de texto seguidos: "¿No tenés cuenta? Creá una", "¿Olvidaste tu contraseña?" y "Prefiero un link mágico por mail" (L220).
- **Acción:** Pasar a registrarse, recuperar la contraseña o cambiar de método.
- **Problema:** `text-xs text-muted` sin padding: el área tocable mide unos 16px de alto, con `gap-3`/`gap-4` (12-16px) entre botones, muy por debajo de 44px y con riesgo alto de tocar el que no era. A la vez, "Crear cuenta", que es el camino de cualquier usuario nuevo (la mayoría de los que llegan por invitación o rutina compartida), tiene el mismo peso visual que "Olvidaste tu contraseña". En el tema girly, `muted` sobre `surface` da ≈3.98:1 con 12px, por debajo de AA (4.5:1).
- **Propuesta:** Darles `min-h-11 px-2 text-sm` (o `Button variant="ghost"` md). Separar los roles: un toggle de modo arriba de la card ("Entrar | Crear cuenta", con un segmented de 44px), "¿Olvidaste tu contraseña?" alineado a la derecha debajo del campo de contraseña, y el cambio a link mágico como botón secundario con divisor "o".
- **Severidad:** Media   ·   **Categoría:** tap-target

### AUTH-04 · El modo (entrar vs crear cuenta) solo se distingue por el texto del botón
- **Ubicación:** [login/page.tsx:180](src/app/login/page.tsx#L180)
- **Vista:** Card de login: el único h1 es la marca "WOLF" (L137), y al pasar a registro solo cambia el label del botón a "Crear cuenta".
- **Acción:** Saber si está creando una cuenta o entrando.
- **Problema:** No hay un título de formulario. El cambio de modo es casi imperceptible, se puede intentar entrar con una cuenta que no existe (y recibir "Mail o contraseña incorrectos") o registrarse sin querer. El modo link mágico tampoco explica qué va a pasar.
- **Propuesta:** Agregar un `h2 text-lg font-semibold` dentro de la card ("Iniciá sesión" / "Creá tu cuenta" / "Entrá con un link por mail") con una línea `text-sm text-muted` de contexto (p. ej. "Te mandamos un link para entrar sin contraseña"). Aceptar `?mode=signup` en la URL para entrar directo al registro (ver AUTH-13).
- **Severidad:** Media   ·   **Categoría:** jerarquía

### AUTH-05 · Errores lejos del campo, sin anunciarse y a veces sin traducir
- **Ubicación:** [login/page.tsx:233](src/app/login/page.tsx#L233)
- **Vista:** El error aparece al fondo de la card, debajo del link "Prefiero un link mágico…".
- **Acción:** Entender por qué falló y corregirlo.
- **Problema:** (1) El mensaje queda separado del CTA y de los campos por los links secundarios, y con el teclado abierto suele quedar fuera de la pantalla. (2) No tiene `role="alert"`/`aria-live`, así que los lectores de pantalla no lo anuncian. (3) `translateError` devuelve el mensaje crudo cuando no lo reconoce. El callback redirige con `?error=auth` ([callback/route.ts:34](src/app/auth/callback/route.ts#L34)), así que el usuario ve literalmente "auth". Los casos más comunes de un link vencido o ya usado ("Email link is invalid or has expired", "Email not confirmed", "Token has expired or is invalid") se muestran en inglés. (4) Cuando el usuario toca "¿Olvidaste tu contraseña?" sin mail, aparece "Escribí tu mail primero." pero el foco no va al campo. En girly, `text-danger` sobre `surface` da ≈4.07:1, apenas debajo de AA.
- **Propuesta:** Mover el `<p role="alert" className="text-sm text-danger">` justo debajo del botón principal (o inline bajo el campo afectado) y hacer `emailRef.current?.focus()` en el caso del mail vacío. Ampliar `AUTH_ERROR_ES` con `auth` → "No pudimos validar el link. Pedí uno nuevo.", `otp_expired`/"expired" → "El link venció o ya se usó. Pedí uno nuevo." y "Email not confirmed" → "Confirmá tu mail antes de entrar (revisá tu bandeja).", con un fallback genérico en español en vez del texto crudo.
- **Severidad:** Alta   ·   **Categoría:** feedback

### AUTH-06 · "¿Olvidaste tu contraseña?" dispara el mail sin confirmar y sin feedback visible
- **Ubicación:** [login/page.tsx:195](src/app/login/page.tsx#L195)
- **Vista:** Link de texto "¿Olvidaste tu contraseña?".
- **Acción:** Recuperar la contraseña.
- **Problema:** Un toque envía el mail de reset al instante a lo que haya en el campo, sin mostrar a qué dirección ni pedir confirmación. Mientras carga solo pasa a `disabled:opacity-50` sobre un texto de 12px gris, que no se percibe. Un toque por error consume el rate-limit de mails ("Se enviaron demasiados mails…").
- **Propuesta:** Abrir un paso propio de recuperar contraseña: título "Recuperar contraseña", campo de mail precargado y `Button` "Mandarme el link" con `loading`, más un "Volver" para salir. Al terminar, usar el estado `sent` específico de AUTH-01.
- **Severidad:** Media   ·   **Categoría:** feedback

### AUTH-07 · Usuario ya logueado que entra a /login ve el formulario
- **Ubicación:** [login/page.tsx:32](src/app/login/page.tsx#L32)
- **Vista:** Formulario completo de login aunque haya una sesión activa (por ejemplo, al volver atrás después de entrar o al abrir un `/login?next=` viejo).
- **Acción:** Seguir usando la app.
- **Problema:** Ni el middleware ([middleware.ts:73](src/lib/supabase/middleware.ts#L73)) ni la página redirigen a `next` cuando ya hay usuario, así que el usuario duda si se le cerró la sesión. Como el login usa `router.replace`, el atrás del sistema suele no traerlo de vuelta, pero los links guardados sí.
- **Propuesta:** En el middleware, si `user && pathname === "/login"`, redirigir a `next ?? "/rutinas"`. Además, validar que `next` empiece con `/` y no con `//` antes de redirigir. Esto también cierra un open redirect en `router.replace(next)` y en el callback, que concatena `${origin}${next}`.
- **Severidad:** Baja   ·   **Categoría:** navegación

## Nueva contraseña (reset)
**Caso de uso:** El usuario tocó el link de recuperación del mail. El callback crea la sesión y lo manda a `/auth/reset-password` para elegir una contraseña nueva.

### AUTH-08 · Reset sin validar la sesión, con errores en inglés y sin confirmación de éxito
- **Ubicación:** [reset-password/page.tsx:24](src/app/auth/reset-password/page.tsx#L24)
- **Vista:** Card "Nueva contraseña" con un solo `Input` y el botón "Guardar".
- **Acción:** Escribir la contraseña nueva y guardarla.
- **Problema:** (1) No se chequea la sesión al montar: si el link venció o se abrió en otro dispositivo, el usuario completa el formulario y recién al enviar ve `error.message` crudo en inglés ("Auth session missing!", "New password should be different from the old password."), porque esta pantalla no usa `translateError`. (2) Al guardar bien, `router.replace("/rutinas")` lo saca sin decirle que la contraseña cambió. (3) No hay "Volver al login" ni forma de salir. (4) No hay `autoComplete="new-password"`, ni label visible, ni ayuda "mínimo 6 caracteres", ni campo de confirmación o toggle de mostrar contraseña, así que un typo deja al usuario sin acceso otra vez.
- **Propuesta:** Al montar, `getUser()`. Si no hay sesión, mostrar el estado "El link venció o ya se usó" con `Button` "Pedir otro link" → `/login`. Extraer `translateError` a `lib/` y reutilizarlo acá. Agregar label, `autoComplete="new-password"`, ayuda inline y un toggle de ojo. Al guardar, mostrar "Listo, actualizamos tu contraseña" (un toast o un estado `success` de 1-2 s) antes de redirigir, y cambiar el CTA a "Guardar contraseña".
- **Severidad:** Media   ·   **Categoría:** estados

## Onboarding (perfil inicial)
**Caso de uso:** Primera vez después de crear la cuenta: el layout autenticado redirige a `/onboarding` si el perfil no tiene `username`. Se pide nombre y sexo para el ranking.

### AUTH-09 · El onboarding descarta el destino original (invitación / rutina compartida)
- **Ubicación:** [onboarding/page.tsx:86](src/app/onboarding/page.tsx#L86)
- **Vista:** Botón "Empezar" → redirige siempre a `/rutinas`.
- **Acción:** Un usuario nuevo que llegó por `/r/{code}` o `/r/bundle` quiere terminar de copiar la rutina que le pasaron.
- **Problema:** `/invite` y `/r` están fuera de `(app)`, así que el usuario nuevo llega a esas pantallas sin pasar por onboarding. Al copiar la rutina, `router.push("/rutinas/{id}")` lo rebota a `/onboarding` (layout L27), y "Empezar" lo manda a `/rutinas` en vez de a la rutina recién copiada. En la invitación, "Ver amigos" → `/scoreboard` → onboarding → `/rutinas`. Así se pierde el contexto justo en el primer uso, el momento más sensible.
- **Propuesta:** Que el layout redirija a `/onboarding?next=<pathname actual>` y que onboarding haga `router.replace(safeNext ?? "/rutinas")`. Como alternativa, verificar el perfil en `/r/*` e `/invite/*` antes de la acción y mandar a onboarding con `next`.
- **Severidad:** Media   ·   **Categoría:** navegación

### AUTH-10 · Labels no asociados, grupo "Sexo" sin semántica y errores genéricos
- **Ubicación:** [onboarding/page.tsx:114](src/app/onboarding/page.tsx#L114)
- **Vista:** `<label>Nombre</label>` + `Input`, `<label>Sexo</label>` + dos `SexButton`, y el error al pie de la card (L144).
- **Acción:** Completar el nombre, elegir el sexo y tocar "Empezar".
- **Problema:** Los `<label>` no tienen `htmlFor` ni envuelven el control: tocar "Nombre" no enfoca el input y el input no tiene nombre accesible. "Sexo" es una pregunta de opción única, pero se maqueta como dos botones `aria-pressed` sin `fieldset`/`legend` ni `role="radiogroup"`. Los errores ("Escribí tu nombre.", "Elegí una opción.") aparecen en un único `<p>` al fondo, lejos del campo, sin `role="alert"`. "Escribí tu nombre." también se muestra cuando escribió 1 letra, y "Elegí una opción." no dice de qué. Si falla el upsert, se muestra `lastError.message` crudo de Postgres en inglés.
- **Propuesta:** `<label htmlFor="name">` + `id="name"`, `autoComplete="given-name"`, `maxLength={30}`. Envolver Sexo en `<fieldset><legend className="text-sm text-muted">`, con `role="radio"`/`aria-checked` en los botones. Errores inline bajo cada campo con `role="alert"`: "Tu nombre tiene que tener al menos 2 letras.", "Elegí una categoría para el ranking." Fallback "No pudimos guardar tu perfil. Probá de nuevo."
- **Severidad:** Media   ·   **Categoría:** formulario

### AUTH-11 · Se pide el sexo sin explicar para qué
- **Ubicación:** [onboarding/page.tsx:124](src/app/onboarding/page.tsx#L124)
- **Vista:** Campo "Sexo" con ♂ Masculino / ♀ Femenino, obligatorio.
- **Acción:** Decidir si responder un dato personal.
- **Problema:** Es un dato sensible pedido en el primer contacto, sin contexto. El subtítulo habla solo del nombre ("Así te van a ver tus amigos en el ranking"). Sin la razón, genera fricción y desconfianza.
- **Propuesta:** Agregar una ayuda `text-xs text-muted` bajo el legend: "Lo usamos para separar el ranking por categoría. Podés cambiarlo en tu perfil." Considerar renombrar el label a "Categoría del ranking".
- **Severidad:** Baja   ·   **Categoría:** copy

### AUTH-12 · Onboarding sin salida y con spinner que puede quedar colgado
- **Ubicación:** [onboarding/page.tsx:74](src/app/onboarding/page.tsx#L74)
- **Vista:** Card de onboarding: no hay forma de cerrar sesión ni de volver.
- **Acción:** Salir porque entró con la cuenta equivocada (link mágico a otro mail, por ejemplo).
- **Problema:** El layout de `(app)` siempre redirige acá mientras no haya `username`, así que el usuario queda atrapado sin opción de "Cerrar sesión". Además, si `getUser()` devuelve null en `save`, el `return` deja `loading=true` y el botón girando para siempre, sin mensaje.
- **Propuesta:** Agregar al pie un `Button variant="ghost"` "No soy {email} · Cerrar sesión". En la rama `if (!user)`, hacer `setLoading(false)` y `router.replace("/login")` o mostrar "Tu sesión venció. Iniciá sesión de nuevo."
- **Severidad:** Baja   ·   **Categoría:** navegación

## Invitación de amistad
**Caso de uso:** Un amigo comparte `/invite/{code}`. Si el destinatario no tiene sesión, se le pide entrar. Si ya está logueado, la invitación se acepta sola y quedan conectados en el ranking.

### AUTH-13 · Invitación anónima y CTA que solo contempla a quien ya tiene cuenta
- **Ubicación:** [invite/[code]/page.tsx:56](src/app/invite/[code]/page.tsx#L56)
- **Vista:** Estado `needs-auth`: ícono `Users`, "Te invitaron a competir", "Iniciá sesión para aceptar la invitación." y un único botón "Iniciar sesión".
- **Acción:** Una persona que todavía no usa WOLF quiere aceptar.
- **Problema:** No dice quién invita ni qué es WOLF (no hay logo ni tagline), lo que baja la confianza y la conversión. El único CTA es "Iniciar sesión" y lleva a `/login` en modo login, aunque la mayoría de los invitados son usuarios nuevos: tienen que encontrar el link de 12px "¿No tenés cuenta? Creá una" (AUTH-03). Lo mismo pasa con "Iniciar sesión y copiar" en [r/[shareCode]/page.tsx:121](src/app/r/[shareCode]/page.tsx#L121) y en el bundle.
- **Propuesta:** Mostrar el logo de WOLF + "**{nombre}** te invitó a competir en WOLF" (requiere una RPC `preview_invite` que devuelva el `display_name`). Poner dos CTAs: primario "Crear cuenta" → `/login?mode=signup&next=…` y secundario "Ya tengo cuenta". Aplicar el mismo patrón en `/r/*`.
- **Severidad:** Media   ·   **Categoría:** jerarquía

### AUTH-14 · La invitación se acepta sola, sin confirmar, y la aceptación diferida es invisible
- **Ubicación:** [invite/[code]/page.tsx:40](src/app/invite/[code]/page.tsx#L40)
- **Vista:** Para un usuario logueado, el spinner pasa directo a "¡Ya son amigos! 🎉". Para uno que se registró, [PendingInviteHandler.tsx:32](src/components/PendingInviteHandler.tsx#L32) acepta en segundo plano sin mostrar nada.
- **Acción:** Abrir un link de invitación y decidir si quiere sumar a esa persona.
- **Problema:** Solo abrir el link (incluso por una vista previa o por un toque accidental en un chat) crea la amistad sin consentimiento explícito. En el flujo diferido el usuario nunca se entera de que quedó conectado, y si falla (`if (error) return`, L33) tampoco ve nada.
- **Propuesta:** Con sesión, mostrar "{nombre} te invitó · Aceptar / Ahora no" antes de llamar a `accept_invite`. En `PendingInviteHandler`, al aceptar, mostrar un toast "Ya sos amigo de {nombre} 🎉" con link al ranking. Si el error es definitivo ("Invitación inválida o vencida"), avisar y limpiar el pendiente en vez de reintentar en silencio.
- **Severidad:** Media   ·   **Categoría:** feedback

### AUTH-15 · "Ver amigos" lleva al Ranking, no a Amigos
- **Ubicación:** [invite/[code]/page.tsx:81](src/app/invite/[code]/page.tsx#L81)
- **Vista:** Estado `ok`: "¡Ya son amigos! 🎉 Ahora pueden competir en el ranking." + botón "Ver amigos".
- **Acción:** Ver al amigo recién agregado.
- **Problema:** El botón dice "Ver amigos" pero navega a `/scoreboard`, aunque existe `/amigos`. El copy no coincide con el destino, y el título "Ranking" de la TabBar tampoco coincide con lo que prometía el botón. Además, `<Link><Button>` anida un `<button>` dentro de un `<a>` (HTML inválido, doble foco con teclado); se repite en L91 y en `/r/*`.
- **Propuesta:** Cambiar el copy a "Ver ranking" (coherente con el texto) o apuntar a `/amigos` y mantener "Ver amigos". Reemplazar `<Link><Button/></Link>` por un `Link` con las clases del botón (por ejemplo, un `buttonClasses()` exportado de `ui.tsx`).
- **Severidad:** Baja   ·   **Categoría:** consistencia

## Rutina compartida (/r/[shareCode])
**Caso de uso:** Alguien comparte una rutina por link. El destinatario, con o sin cuenta, ve la vista previa (nombre, ejercicios, series×reps) y la copia a sus rutinas.

### AUTH-16 · Página pública sin identidad de marca, sin volver y con CTA al final de la lista
- **Ubicación:** [r/[shareCode]/page.tsx:81](src/app/r/[shareCode]/page.tsx#L81)
- **Vista:** `main px-4 py-8` con el ícono `Dumbbell`, "Rutina compartida", el nombre, la lista de ejercicios y el `Button size="lg"` "Copiar a mis rutinas" recién al final (L114).
- **Acción:** Entender qué es esto y copiar la rutina.
- **Problema:** Un visitante sin cuenta no ve ni el logo ni el nombre WOLF ni para qué sirve la app, y tampoco quién compartió la rutina. Con rutinas largas (8-12 ejercicios de ~70px) el CTA queda debajo del pliegue, a diferencia del bundle, donde es sticky, lo que es inconsistente entre las dos pantallas. Para un usuario logueado no hay "Volver" ni salida a la app. Con `statusBarStyle: "black-translucent"` en la PWA instalada, `py-8` puede quedar bajo la barra de estado de iOS.
- **Propuesta:** Un header mínimo con logo + "WOLF" (link a `/`) y "Compartida por {nombre}" (sumarlo a `preview_routine`). CTA sticky igual que el bundle, con fondo (ver AUTH-18), o duplicarlo arriba. Usar `pt-[max(2rem,env(safe-area-inset-top))]`.
- **Severidad:** Media   ·   **Categoría:** jerarquía

### AUTH-17 · Error al copiar con `alert()` nativo y "no encontrada" mezclado con fallo de red
- **Ubicación:** [r/[shareCode]/page.tsx:48](src/app/r/[shareCode]/page.tsx#L48)
- **Vista:** Si `import_routine` falla, aparece un `alert(error.message)` del navegador. Si `preview_routine` falla por cualquier motivo, se muestra "Rutina no encontrada / El link puede ser inválido." (L62).
- **Acción:** Copiar la rutina o entender por qué no carga.
- **Problema:** El `alert()` rompe el estilo de la app, bloquea la UI y en la PWA muestra el dominio como título. El error de `preview_routine` se descarta (`const { data }`), así que un corte de red se presenta como "link inválido", sin "Reintentar". El "Ir al inicio" de una persona sin sesión lleva a `/login`, cuando el texto promete otra cosa.
- **Propuesta:** Mostrar el error inline bajo el CTA (`<p role="alert" className="text-sm text-danger">`) o con el toast de la app. Distinguir `error` de `!data`: para red, "No pudimos cargar la rutina. Revisá tu conexión." + `Button` "Reintentar"; para no encontrada, "Este link ya no existe o la rutina se dejó de compartir." Si no hay sesión, el CTA de salida debería ser "Conocé WOLF" o "Crear cuenta".
- **Severidad:** Media   ·   **Categoría:** feedback

## Paquete de rutinas compartidas (/r/bundle)
**Caso de uso:** Link `/r/bundle?c=a,b,c` con varias rutinas. El destinatario elige cuáles copiar (todas vienen tildadas) y las importa juntas.

### AUTH-18 · La importación puede duplicar rutinas y fallar en silencio
- **Ubicación:** [r/bundle/page.tsx:73](src/app/r/bundle/page.tsx#L73)
- **Vista:** CTA sticky "Copiar N a mis rutinas" con `loading={importing}` (L172-184).
- **Acción:** Copiar las rutinas elegidas.
- **Problema:** (1) Como se pasa `disabled={selected.size === 0}` de forma explícita, en `Button` el `{...props}` pisa a `disabled={loading || props.disabled}` ([ui.tsx:41](src/components/ui.tsx#L41)). Durante la importación el botón sigue habilitado aunque muestre el spinner, y un doble toque importa todo dos veces. (2) El loop `await supabase.rpc("import_routine")` ignora `error`: si falla una o todas, igual navega a `/rutinas` sin aviso. (3) No hay progreso ("Copiando 2 de 5…") ni confirmación de cuántas se copiaron.
- **Propuesta:** En `Button`, poner `disabled` después del spread o hacer `const { disabled, ...rest } = props` (es un arreglo global, pero acá causa duplicados). Guardar en `importing` el progreso (`{done, total}`) y mostrarlo en el label. Juntar los errores: si falla alguna, quedarse en la pantalla con "Se copiaron 3 de 5. No pudimos copiar: X, Y." + "Reintentar". Si salen todas bien, toast "Copiamos 5 rutinas" al llegar a `/rutinas`.
- **Severidad:** Alta   ·   **Categoría:** feedback

### AUTH-19 · Barra fija inferior sin fondo ni safe area: el texto de ayuda se superpone a la lista
- **Ubicación:** [r/bundle/page.tsx:171](src/app/r/bundle/page.tsx#L171)
- **Vista:** `div fixed inset-x-0 bottom-4 px-4` con el botón y el texto `text-xs text-muted` "Se copia la estructura…".
- **Acción:** Hacer scroll por la lista y leer o tocar el CTA.
- **Problema:** El contenedor no tiene fondo, así que las cards pasan por detrás del texto de ayuda de 12px gris y lo vuelven ilegible. Solo el botón tiene `shadow-lg`. `bottom-4` (16px) no suma `env(safe-area-inset-bottom)`: en iPhone sin botón home el CTA queda pegado o encima del indicador de inicio (el `padding-bottom` del body no afecta a los elementos `fixed`).
- **Propuesta:** `fixed inset-x-0 bottom-0 px-4 pt-3 pb-[calc(1rem+env(safe-area-inset-bottom))] bg-bg/95 backdrop-blur border-t border-border`. Ajustar el `pb-28` del `main` a la altura real de la barra.
- **Severidad:** Media   ·   **Categoría:** espaciado

### AUTH-20 · Items seleccionables sin semántica de checkbox y título sin plural correcto
- **Ubicación:** [r/bundle/page.tsx:128](src/app/r/bundle/page.tsx#L128)
- **Vista:** Cada rutina es un `<button>` card con un check visual `size-6`. El header dice "{valid.length} rutinas" (L117).
- **Acción:** Tildar o destildar rutinas.
- **Problema:** El `<button>` no expone el estado (le falta `aria-pressed`, o `role="checkbox"` con `aria-checked`), así que un lector de pantalla no sabe qué está seleccionado. El estado no seleccionado solo cambia el borde y el check pasa a `text-transparent`, una diferencia sutil. Con una sola rutina válida el título dice "1 rutinas". Los items inválidos combinan `opacity-60` con `text-muted`, un doble atenuado de bajo contraste.
- **Propuesta:** Agregar `role="checkbox" aria-checked={selected.has(it.code)}`. Pluralizar: `${n} ${n === 1 ? "rutina" : "rutinas"}`. Para los inválidos, usar `text-muted` sin `opacity-60` y un ícono `AlertCircle`. Opcional: link "Elegir todas / ninguna" a la derecha del subtítulo.
- **Severidad:** Baja   ·   **Categoría:** accesibilidad

## Manifest PWA
**Caso de uso:** Define cómo se instala y lanza la app (ícono, splash, nombre) en Android/iOS.

### AUTH-21 · Ícono maskable transparente y sin margen de seguridad
- **Ubicación:** [manifest.ts:29](src/app/manifest.ts#L29)
- **Vista:** Ícono de la app en el launcher de Android y en el splash.
- **Acción:** Encontrar y abrir la app instalada.
- **Problema:** Se usa el mismo `icon-512.png` (RGBA con fondo transparente, lobo dorado) como `any` y como `maskable`. Un ícono maskable debe ser opaco y full-bleed, con el contenido dentro del 80% central. Transparente, el launcher lo rellena con un color arbitrario (a menudo blanco), y el dorado sobre blanco se ve lavado e inconsistente con el splash `#09090a`. Tampoco se declaran `lang: "es"`, `id`, ni `orientation: "portrait"` en una app pensada para mobile.
- **Propuesta:** Generar `icon-maskable-512.png` con fondo `#09090a` sólido y el lobo dentro de la zona segura (unos 320px centrales), y usarlo solo con `purpose: "maskable"`. Agregar `id: "/"`, `lang: "es-AR"`, `orientation: "portrait"`.
- **Severidad:** Baja   ·   **Categoría:** consistencia

---

# 2. Rutinas y catálogo de ejercicios

## Lista de rutinas (home tras login)
**Caso de uso:** Es la primera pantalla después del login. El usuario viene a elegir qué entrenar hoy, y a veces a crear, importar o compartir una rutina.

### RUT-01 · Un error de red se muestra como "Todavía no tenés rutinas"
- **Ubicación:** [page.tsx:305](src/app/(app)/rutinas/page.tsx#L305)
- **Vista:** Estado de carga y estado vacío de la lista.
- **Acción:** Abrir la app con mala conexión o con la sesión de Supabase vencida.
- **Problema:** Solo se lee `isLoading`. Si la query falla, `data` queda `undefined`, `hasRoutines` da `false` y se muestra el `EmptyState` "Todavía no tenés rutinas" con el CTA "Crear rutina". Un usuario con 10 rutinas cree que las perdió y puede terminar creando duplicados. Pasa lo mismo en el catálogo (subtítulo "0 en el catálogo" y grilla vacía, [ejercicios/page.tsx:28](src/app/(app)/ejercicios/page.tsx#L28)) y en el picker.
- **Propuesta:** Leer `isError`/`refetch` de `useRoutines()` y mostrar un estado de error propio, por ejemplo `EmptyState` con ícono `WifiOff`, título "No pudimos cargar tus rutinas", descripción "Revisá tu conexión" y un botón "Reintentar" que llame a `refetch()`. Mostrar el estado vacío solo cuando `data` sea `[]`.
- **Severidad:** Alta   ·   **Categoría:** estados

### RUT-02 · No hay una forma directa de empezar a entrenar desde la home
- **Ubicación:** [page.tsx:248](src/app/(app)/rutinas/page.tsx#L248)
- **Vista:** Grilla 2×2 de accesos: "Entrenar libre", "Catálogo", "Importar Excel", "Template Excel". Debajo, la lista de rutinas.
- **Acción:** Llegar al gimnasio y arrancar la rutina de siempre.
- **Problema:** Las cuatro cards tienen el mismo peso visual (`card p-3`, ícono `size-9`, `text-sm font-medium`). Dos acciones que se usan casi nunca (importar y bajar template) ocupan el primer viewport con la misma jerarquía que "Entrenar libre". Las cards de rutina ([page.tsx:354](src/app/(app)/rutinas/page.tsx#L354)) solo llevan al editor, así que entrenar con una rutina pide 2 taps y pasar por una pantalla de edición, con el riesgo de modificar algo sin querer. Nada indica cuál es la próxima rutina o la última que se hizo.
- **Propuesta:** Poner arriba un bloque principal "Seguir entrenando" con la rutina usada más recientemente (sacada de `useHistory`) y un `Button size="lg"` que diga "Empezar <nombre>". Agregar en cada card de rutina un botón de play (`size-11`, `aria-label="Empezar <nombre>"`) que llame a `useStartWorkout` directo. Mover "Importar Excel" y "Template Excel" a un menú de overflow (⋯) en el `PageHeader` o a una sección "Más opciones" al final de la lista.
- **Severidad:** Alta   ·   **Categoría:** jerarquía

### RUT-03 · Las cards de rutina no dicen qué tiene cada rutina
- **Ubicación:** [page.tsx:361](src/app/(app)/rutinas/page.tsx#L361)
- **Vista:** Card con ícono genérico `Dumbbell`, nombre y "Actualizada {fecha} · Compartida".
- **Acción:** Distinguir entre "Push A" y "Push B", o encontrar la rutina de piernas.
- **Problema:** El único dato secundario es la fecha de edición, que al usuario le importa poco. No se ve cantidad de ejercicios, músculos principales ni cuándo se entrenó por última vez. Además la lista se ordena por `updated_at` ([useRoutines.ts:27](src/hooks/useRoutines.ts#L27)), así que renombrar una rutina o cambiarle una serie la sube al primer lugar y el orden cambia sin que el usuario lo espere.
- **Propuesta:** Cambiar la línea secundaria por algo como "6 ejercicios · Pecho, Tríceps · Última vez hace 3 días". Ordenar por último uso (o permitir un orden manual) en vez de por `updated_at`. Mostrar "Compartida" como `Badge` y no como texto suelto.
- **Severidad:** Media   ·   **Categoría:** jerarquía

### RUT-04 · "Compartir" en el header en realidad abre un modo selección
- **Ubicación:** [page.tsx:231](src/app/(app)/rutinas/page.tsx#L231)
- **Vista:** Dos botones `size="sm"` en el header: "Compartir" (ícono `ListChecks`) y "Nueva".
- **Acción:** Compartir una rutina.
- **Problema:** El botón no comparte: convierte toda la lista en checkboxes, oculta los accesos rápidos y cambia el header por "Cancelar". Para compartir una sola rutina hay que entrar a modo selección, tildarla y confirmar, aunque el editor ya tiene su propio "Compartir". El ícono `ListChecks` no coincide con el label, y al tener la misma altura que "Nueva", el CTA de crear pierde protagonismo (tap target de 32 px, ver global).
- **Propuesta:** Renombrar a "Compartir varias" o pasarlo al menú de overflow junto con Importar y Template. Dejar "Nueva" como única acción visible del header, en `size="md"`. Si se mantiene el modo selección, arrancarlo con la rutina que se mantuvo presionada (long-press) ya tildada.
- **Severidad:** Baja   ·   **Categoría:** copy

### RUT-05 · Crear rutina: sin label, sin validación y con recarga completa de la página
- **Ubicación:** [page.tsx:90](src/app/(app)/rutinas/page.tsx#L90)
- **Vista:** Modal "Nueva rutina" con un solo `Input` (placeholder "Ej: Push día 1") y el botón "Crear".
- **Acción:** Crear una rutina.
- **Problema:** (1) El input no tiene `<label>` ni `aria-label`; el placeholder desaparece al escribir. (2) "Crear" está habilitado con el nombre vacío y tocarlo no hace nada (`if (!name.trim()) return`), sin ningún aviso. (3) `mutateAsync` no tiene `try/catch`: si falla, el modal queda abierto, el spinner se apaga y no aparece ningún mensaje. (4) `window.location.href` recarga toda la PWA, con pantalla en blanco y caché de React Query perdida, en vez de usar `router.push` como hace `doImport`.
- **Propuesta:** Agregar `<label>Nombre de la rutina</label>` (o `aria-label`) y `maxLength={60}`. Poner `disabled={!name.trim()}` en "Crear". Envolver la llamada en `try/catch` y mostrar `<p className="text-sm text-danger">No se pudo crear la rutina. Reintentá.</p>`. Reemplazar la recarga por `router.push(`/rutinas/${routine.id}`)`.
- **Severidad:** Media   ·   **Categoría:** formulario

### RUT-06 · Importar Excel: errores con `alert()`, sin nombre editable y con fallas silenciosas
- **Ubicación:** [page.tsx:202](src/app/(app)/rutinas/page.tsx#L202)
- **Vista:** Selector de archivo y modal "Importar rutina" con el resumen.
- **Acción:** Importar una rutina armada en Excel.
- **Problema:** Si el archivo no se puede leer, aparece un `alert()` nativo, que rompe la estética y en la PWA instalada muestra el dominio. El nombre de la rutina sale del nombre del archivo (por ejemplo "wolf-template-rutina (3)") y no se puede editar en la vista previa. `doImport` no tiene `try/catch`: si falla a mitad del loop, la rutina queda creada a medias ([useRoutines.ts:117](src/hooks/useRoutines.ts#L117)) y el usuario no recibe ningún aviso. Entre elegir el archivo y ver el modal tampoco hay indicador de carga.
- **Propuesta:** Mostrar el error dentro del mismo modal "Importar rutina" con texto `text-danger` en vez de `alert`. Agregar un `Input` editable "Nombre" en la vista previa, precargado con un nombre limpio. Envolver `doImport` en `try/catch` con un mensaje de error en línea. Mientras se lee el archivo, mostrar un `Spinner` en la card "Importar Excel".
- **Severidad:** Media   ·   **Categoría:** feedback

### RUT-07 · La importación pierde sin aviso la duración y la distancia
- **Ubicación:** [useRoutines.ts:134](src/hooks/useRoutines.ts#L134)
- **Vista:** La vista previa dice "Vas a crear X con N ejercicios y M series".
- **Acción:** Importar una rutina con ejercicios de cardio o isométricos (columnas `duracion_seg` y `distancia_m`).
- **Problema:** `handleFile` lee `target_duration_seconds` y `target_distance_m` ([page.tsx:188](src/app/(app)/rutinas/page.tsx#L188)), pero el insert de `routine_sets` solo guarda `target_reps` y `target_weight`. La vista previa confirma algo que después no se guarda, y el usuario recién lo nota en el editor, con los campos mm:ss y km vacíos.
- **Propuesta:** Agregar `target_duration_seconds` y `target_distance_m` al insert. Mientras eso no esté, al menos avisarlo en la vista previa.
- **Severidad:** Media   ·   **Categoría:** estados

### RUT-08 · El modo compartir no maneja errores
- **Ubicación:** [page.tsx:113](src/app/(app)/rutinas/page.tsx#L113)
- **Vista:** Barra fija "Compartir N" y modal con el link.
- **Acción:** Compartir varias rutinas.
- **Problema:** Si falla `ensureCodes.mutateAsync`, el botón deja de cargar y no pasa nada más. Además el botón muestra "Compartir" a secas cuando hay 0 seleccionadas (`selected.size || ""`) y queda `disabled`, sin explicar por qué.
- **Propuesta:** Mostrar el error en un toast o en texto `text-danger` arriba de la barra. Cambiar el label a "Elegí al menos una" con 0 seleccionadas y a "Compartir 2 rutinas" con 2 o más.
- **Severidad:** Baja   ·   **Categoría:** feedback

## Editor de rutina
**Caso de uso:** El usuario toca una rutina de la lista para editarla y, hoy, también para empezar a entrenarla (el CTA "Empezar entrenamiento" vive acá).

### RUT-09 · Si la carga falla, el spinner no termina nunca
- **Ubicación:** [page.tsx:75](src/app/(app)/rutinas/[id]/page.tsx#L75)
- **Vista:** Pantalla completa con un `Spinner`.
- **Acción:** Abrir una rutina sin conexión, con un id borrado o desde un link viejo.
- **Problema:** `if (isLoading || !data)` trata el error igual que la carga. Si falla la query (por ejemplo, una rutina eliminada en otro dispositivo, porque `.single()` falla), el usuario ve un spinner infinito sin salida, y en esa pantalla ni siquiera aparece el botón de volver.
- **Propuesta:** Separar los estados. Con `isError`, mostrar `EmptyState` con título "No encontramos esta rutina", botón "Volver a rutinas" y "Reintentar".
- **Severidad:** Alta   ·   **Categoría:** estados

### RUT-10 · "Eliminar" rutina pegado a "Copiar", con `confirm()` nativo y sin deshacer
- **Ubicación:** [page.tsx:137](src/app/(app)/rutinas/[id]/page.tsx#L137)
- **Vista:** Fila de 3 botones `size="sm"` con `gap-2` (8 px): Compartir · Copiar · Eliminar.
- **Acción:** Duplicar o compartir la rutina.
- **Problema:** La acción destructiva tiene la misma jerarquía y ubicación que las acciones de uso frecuente, a 8 px de "Copiar", con 32 px de alto (ver global). La confirmación es un `confirm("¿Eliminar esta rutina?")` del navegador, que no sigue el tema, no dice el nombre y en iOS PWA se ve como un diálogo del sistema. Si `del.mutateAsync` falla, no aparece ningún error.
- **Propuesta:** Pasar Compartir, Copiar y Eliminar a un menú de overflow (`MoreVertical`, `size-11`, `aria-label="Más acciones"`) en el header, con "Eliminar rutina" al final, separado y en `text-danger`. Confirmar con el `Modal` propio: "¿Eliminar «Push A»? Se borra el plan; tus entrenamientos registrados se mantienen", con botones "Cancelar" (secondary) y "Eliminar" (danger).
- **Severidad:** Alta   ·   **Categoría:** tap-target

### RUT-11 · Quitar un ejercicio es un ícono de 24 px, sin confirmación y sin deshacer
- **Ubicación:** [page.tsx:320](src/app/(app)/rutinas/[id]/page.tsx#L320)
- **Vista:** Header de cada card de ejercicio: ▲▼ apiladas, Reemplazar (`Repeat`) y Eliminar (`Trash2`).
- **Acción:** Reemplazar un ejercicio o reordenarlo.
- **Problema:** El tacho es `p-1` + `size-4`, unos 24×24 px, y está a 12 px (`gap-3`) del botón Reemplazar, del mismo tamaño y color (`text-muted`). Un toque borra el ejercicio con todas sus series planificadas (pesos y reps cargados a mano), sin confirmación ni "Deshacer". Tampoco hay update optimista ([useRoutines.ts:284](src/hooks/useRoutines.ts#L284)): la fila sigue visible hasta el refetch, y el usuario puede tocar de nuevo creyendo que no anduvo. El botón no tiene `aria-label`, así que un lector de pantalla anuncia solo "botón".
- **Propuesta:** Agrandar a `size-11 grid place-items-center` con `aria-label="Quitar ejercicio"`. Pasar Reemplazar y Quitar a un menú ⋯ por card, o al menos separarlos con `ml-2`. Usar update optimista con un toast "Ejercicio quitado · Deshacer" (5 s) que reinserte la fila y sus `routine_sets`.
- **Severidad:** Alta   ·   **Categoría:** tap-target

### RUT-12 · Flechas de reordenar de 20 px, sin label y con poco contraste deshabilitadas
- **Ubicación:** [page.tsx:297](src/app/(app)/rutinas/[id]/page.tsx#L297)
- **Vista:** Dos chevrons apilados (`p-0.5` + `size-4` ≈ 20×20 px cada uno) a la derecha del nombre.
- **Acción:** Mover un ejercicio un lugar arriba o abajo.
- **Problema:** Los dos targets suman unos 40 px de alto juntos, así que es muy fácil tocar ▼ cuando se quería ▲. No tienen `aria-label`. El estado deshabilitado (`disabled:opacity-30` sobre `text-muted`) casi no se ve. Mover un ejercicio de la posición 6 a la 1 lleva 5 taps precisos, y no hay ninguna confirmación visual del movimiento, como un highlight en la card movida. El update optimista sí está bien resuelto.
- **Propuesta:** Botones de `size-11` en horizontal o un drag handle (`GripVertical`) con `@dnd-kit/sortable`, que tiene soporte de teclado. Agregar `aria-label="Mover arriba"`/`"Mover abajo"` y anunciar la nueva posición con `aria-live`. Como alternativa barata, un modo "Reordenar" que esconda las series y muestre solo los nombres con flechas grandes.
- **Severidad:** Media   ·   **Categoría:** tap-target

### RUT-13 · El header del editor no tiene título ni un botón de volver accesible
- **Ubicación:** [page.tsx:123](src/app/(app)/rutinas/[id]/page.tsx#L123)
- **Vista:** Flecha `ArrowLeft size-5` y un `Input` con el nombre de la rutina.
- **Acción:** Volver a la lista o renombrar la rutina.
- **Problema:** La flecha es un `Link` de 20×20 px sin padding ni `aria-label`. El nombre de la rutina es un campo de formulario (`h-11 bg-surface-2 ring-1`) y no un título: la página no tiene `h1` y se ve distinta del `PageHeader` del resto de la app. El renombrado se guarda en `onBlur` sin ningún feedback, y si el usuario borra todo el texto, el input queda vacío visualmente mientras la base conserva el nombre viejo (`if (v && …)` no restaura `defaultValue`).
- **Propuesta:** Usar `Link` con `className="size-11 -ml-2 grid place-items-center"` y `aria-label="Volver a rutinas"`. Mostrar el nombre como `h1 text-2xl font-bold` con un botón `Pencil` para editar inline, o mantener el input con estilo de título (`bg-transparent ring-0 text-2xl font-bold focus:ring-2`) y `aria-label="Nombre de la rutina"`. Al hacer blur con el campo vacío, restaurar el nombre anterior. Mostrar "Guardado ✓" (`text-xs text-muted`) unos segundos después de cada cambio.
- **Severidad:** Media   ·   **Categoría:** navegación

### RUT-14 · Las series se guardan solas, pero no hay indicio de guardado ni aviso si falla
- **Ubicación:** [page.tsx:173](src/app/(app)/rutinas/[id]/page.tsx#L173)
- **Vista:** Inputs de peso, reps, km y mm:ss de cada serie.
- **Acción:** Planificar pesos y reps antes de entrenar.
- **Problema:** Cada `onBlur` dispara `ops.saveSets.mutate` sin `onError` ([useRoutines.ts:263](src/hooks/useRoutines.ts#L263)). Si se corta la red en el gimnasio, el usuario cree que guardó y en la próxima sesión ve el plan viejo. Como no hay ningún botón "Guardar" ni texto de estado, tampoco sabe que el guardado es automático. Además, `saveSets` hace upsert + delete + update en tres requests sin transacción.
- **Propuesta:** Mostrar un indicador por card o global ("Guardando…" → "Guardado") y, ante un error, un toast "No se guardó el cambio · Reintentar". Agregar un texto de ayuda única bajo el título: "Los cambios se guardan solos".
- **Severidad:** Media   ·   **Categoría:** feedback

### RUT-15 · Planificador de series: inputs de 36 px, quitar serie de 28 px y textos de 11 px
- **Ubicación:** [page.tsx:458](src/app/(app)/rutinas/[id]/page.tsx#L458)
- **Vista:** Tabla Serie / Peso (kg) / Reps / ✕, con la pista "últ. 60 kg × 8" y el aviso "fuera del rango de tu objetivo".
- **Acción:** Cargar el peso de cada serie con el pulgar y quitar una serie sobrante.
- **Problema:** Los inputs usan `h-9` (36 px), por debajo de los 44 px del `Input` base. El ✕ de quitar serie mide `w-7` (28 px) de ancho y queda pegado al input de reps (`gap-2`), así que tocar el borde derecho del campo puede borrar la serie. Quitar una serie tampoco pide confirmación ni deja deshacer. Los encabezados `text-[11px] uppercase` y las pistas `text-[11px]` (incluido el aviso en `text-warning`) quedan por debajo del mínimo legible de 12 px. El aviso de rango puede ocupar dos líneas en un 360 px, centrado bajo una sola columna.
- **Propuesta:** Usar inputs `h-11` (con `gap-1.5` alcanza el ancho). Hacer el ✕ `size-11` con `-mr-2`, o pasar el borrado de serie a un swipe o long-press. Subir los textos a `text-xs` (12 px). Mostrar el aviso fuera de rango como un `Badge` de warning en la fila, o una sola vez por ejercicio ("2 series fuera de tu rango 6–12").
- **Severidad:** Media   ·   **Categoría:** tap-target

### RUT-16 · En una rutina vacía, el CTA "Agregar ejercicio" queda fuera del estado vacío y con peso secundario
- **Ubicación:** [page.tsx:158](src/app/(app)/rutinas/[id]/page.tsx#L158)
- **Vista:** Card `p-8` con el texto "Agregá ejercicios a esta rutina." y, debajo, un `Button variant="secondary"` "Agregar ejercicio".
- **Acción:** Primer uso después de crear la rutina.
- **Problema:** Recién creada la rutina, la única acción posible es agregar ejercicios, pero el botón es `secondary` (gris) y está separado del mensaje. El estado vacío no usa el `EmptyState` del sistema, a diferencia de la lista ([rutinas/page.tsx:310](src/app/(app)/rutinas/page.tsx#L310)). Con ejercicios cargados, "Agregar ejercicio" queda al final de una lista larga, justo detrás del CTA fijo "Empezar entrenamiento" (`fixed bottom-20`).
- **Propuesta:** Usar `EmptyState` con ícono, título "Rutina vacía", descripción "Sumá los ejercicios que vas a hacer" y `Button` primary "Agregar ejercicio" adentro. Con contenido, dejar el botón secondary.
- **Severidad:** Baja   ·   **Categoría:** consistencia

### RUT-17 · "Copiar" es ambiguo y además marca la rutina como "Compartida"
- **Ubicación:** [page.tsx:105](src/app/(app)/rutinas/[id]/page.tsx#L105)
- **Vista:** Botón "Copiar" (ícono `Copy`) al lado de "Compartir".
- **Acción:** Duplicar la rutina para hacer una variante.
- **Problema:** "Copiar" al lado de "Compartir" se lee como "copiar link", y es el mismo ícono `Copy` que usa el botón de copiar link del modal ([page.tsx:232](src/app/(app)/rutinas/[id]/page.tsx#L232)). En realidad duplica la rutina, y para hacerlo genera un `share_code` público: la rutina original pasa a mostrarse como "Compartida" en la lista sin que el usuario la haya compartido. Si falla, `catch { setCopying(false) }` no muestra ningún mensaje. Al terminar, navega a la copia, que tiene un nombre casi idéntico, sin avisar.
- **Propuesta:** Renombrar a "Duplicar" con ícono `CopyPlus`. Hacer la copia con un RPC propio que no publique un `share_code`, o limpiarlo después si antes no existía. Al terminar, mostrar un toast "Creamos «Push A (copia)»". Mostrar un error en línea si falla.
- **Severidad:** Media   ·   **Categoría:** copy

### RUT-18 · Los dos modales de compartir se comportan distinto
- **Ubicación:** [page.tsx:218](src/app/(app)/rutinas/[id]/page.tsx#L218)
- **Vista:** Modal "Compartir rutina" del editor, comparado con el de la lista ([rutinas/page.tsx:407](src/app/(app)/rutinas/page.tsx#L407)).
- **Acción:** Compartir una rutina por WhatsApp.
- **Problema:** En la lista el link se copia solo al abrir el modal y el input selecciona el texto al recibir el foco. En el editor hace falta un tap extra en "Copiar" y el input no tiene `onFocus={select}`, aunque el mensaje de error pide "Mantené presionado el link de arriba". Los textos de privacidad también difieren ("sin tus pesos" contra "Tus pesos y notas no se comparten"). Ninguno de los dos usa `navigator.share`, que en una PWA mobile es la forma natural de mandar algo por WhatsApp.
- **Propuesta:** Unificar en un único componente `ShareLinkModal`: botón primario "Compartir…" con `navigator.share` cuando esté disponible, "Copiar link" como secundario, el input con `onFocus={(e) => e.target.select()}` y un solo texto de privacidad.
- **Severidad:** Baja   ·   **Categoría:** consistencia

## Picker de ejercicios (bottom sheet)
**Caso de uso:** Desde el editor, el usuario toca "Agregar ejercicio" para buscar en el catálogo (~870) y sumar uno o varios ejercicios a la rutina.

### RUT-19 · El picker se cierra después de cada ejercicio y no confirma que se agregó
- **Ubicación:** [ExercisePickerModal.tsx:99](src/components/ExercisePickerModal.tsx#L99)
- **Vista:** Lista de resultados del picker.
- **Acción:** Armar una rutina nueva con 6–8 ejercicios.
- **Problema:** `onSelect(ex); onClose();` cierra la hoja en cada selección, así que armar una rutina lleva unos 8 ciclos de abrir → buscar → tocar. Al volver, el ejercicio no aparece enseguida porque `ops.add` no es optimista y espera el insert más el refetch. Ese hueco sin feedback invita a tocar "Agregar ejercicio" otra vez y agregarlo duplicado. Tampoco se marca qué ejercicios ya están en la rutina.
- **Propuesta:** En el editor, dejar el picker abierto y hacer la selección múltiple: tocar una fila la marca con un check y un `Badge` "En la rutina", y un footer sticky "Agregar 3 ejercicios" confirma todo junto. Si se mantiene la selección simple, usar update optimista en `add` y mostrar el toast "«Press banca» agregado".
- **Severidad:** Alta   ·   **Categoría:** feedback

### RUT-20 · La búsqueda no ignora tildes y corta a 80 resultados sin avisar
- **Ubicación:** [useExercises.ts:178](src/hooks/useExercises.ts#L178)
- **Vista:** Input "Buscar ejercicio…" y la lista filtrada.
- **Acción:** Buscar "biceps", "triceps" o "extension" desde el teclado del celular, que no pone tildes solo.
- **Problema:** `filterExercises` compara con `toLowerCase().includes(q)`, sin normalizar acentos. Si el nombre lleva tilde ("Extensión de tríceps"), escribir "extension" no lo encuentra. Tampoco hay búsqueda por palabras sueltas ni en otro orden ("banca press"). El picker corta a 80 resultados (`.slice(0, 80)`, [ExercisePickerModal.tsx:51](src/components/ExercisePickerModal.tsx#L51)) y el catálogo a 120 ([ejercicios/page.tsx:19](src/app/(app)/ejercicios/page.tsx#L19)), sin decir "Mostrando 80 de 340, afiná la búsqueda". Con "Todos" seleccionado, el usuario puede creer que el catálogo termina ahí.
- **Propuesta:** Normalizar los dos lados con `s.normalize("NFD").replace(/\p{Diacritic}/gu, "")` y separar la búsqueda en tokens que deban aparecer todos. Al final de la lista, cuando haya más resultados, mostrar `<p className="text-xs text-muted text-center">Mostrando 80 de {total}. Escribí para afinar.</p>`, o usar virtualización (`@tanstack/react-virtual`) para mostrar todo.
- **Severidad:** Media   ·   **Categoría:** estados

### RUT-21 · "Crear «texto buscado»" abre el formulario con el nombre vacío
- **Ubicación:** [CreateExerciseModal.tsx:30](src/components/CreateExerciseModal.tsx#L30)
- **Vista:** Estado sin resultados del picker: "No se encontraron ejercicios." y el botón "Crear “curl araña”".
- **Acción:** Crear el ejercicio que no encontró, desde el mismo botón.
- **Problema:** `useState(initialName)` solo lee el valor al montar, y `CreateExerciseModal` se monta junto con el picker, cuando `query` todavía es `""` ([ExercisePickerModal.tsx:145](src/components/ExercisePickerModal.tsx#L145)). El botón promete "Crear “curl araña”", pero el formulario abre con Nombre vacío y el usuario tiene que volver a escribirlo. Aparte, el picker no limpia `query` ni `muscle` al cerrarse, así que al reabrirlo para el siguiente ejercicio sigue filtrado por la búsqueda anterior.
- **Propuesta:** Sincronizar el nombre al abrir, ya sea con `key={open ? query : "closed"}` en `CreateExerciseModal` o con un efecto `if (open) setName(initialName)`. Resetear `query` y `muscle` en `onClose` del picker, o seleccionar el texto del input al reabrir.
- **Severidad:** Media   ·   **Categoría:** formulario

### RUT-22 · El estado sin resultados no ofrece limpiar los filtros
- **Ubicación:** [ExercisePickerModal.tsx:87](src/components/ExercisePickerModal.tsx#L87)
- **Vista:** "No se encontraron ejercicios." con búsqueda y filtro de músculo activos a la vez.
- **Acción:** Buscar "remo" con el chip "Pecho" todavía activo de antes.
- **Problema:** El mensaje no dice que hay un filtro de músculo aplicado ni ofrece quitarlo; la única salida que propone es crear un ejercicio nuevo, lo que lleva a duplicar ejercicios que ya existen en el catálogo. Además, ese botón "Crear" es `size="sm"` `secondary` (ver global).
- **Propuesta:** Copy contextual: "No hay resultados para «remo» en Pecho", con un botón "Buscar en todos los músculos" (`setMuscle("")`) primero y "Crear «remo»" después.
- **Severidad:** Baja   ·   **Categoría:** copy

## Crear ejercicio / Editar músculos
**Caso de uso:** El usuario no encuentra un ejercicio en el catálogo y lo crea desde el picker, o corrige los músculos de uno propio desde la ficha de detalle.

### RUT-23 · "Crear ejercicio" deshabilitado no dice qué falta, y los campos obligatorios no se distinguen
- **Ubicación:** [CreateExerciseModal.tsx:172](src/components/CreateExerciseModal.tsx#L172)
- **Vista:** Formulario largo en el bottom sheet: Nombre, Músculos principales, Músculos secundarios, Cómo se mide, Mecánica, Fuerza, Equipo, Imagen, Descripción. El botón está al final del scroll.
- **Acción:** Completar el formulario y crear el ejercicio.
- **Problema:** El botón tiene `disabled={!valid}`, así que nunca se ejecuta el `setError("Completá nombre, músculos principales, mecánica y fuerza.")` de `submit`: el usuario ve un botón gris al 50 % sin saber qué le falta. Solo Mecánica y Fuerza dicen "obligatorio"; Nombre (mínimo 2 caracteres) y Músculos principales no lo indican. El CTA no es sticky y queda debajo de unas 30 chips, fuera de la vista. Los `<label>` de `Field` ([MusclePicker.tsx:43](src/components/MusclePicker.tsx#L43)) no están asociados a ningún control (no tienen `htmlFor` ni envuelven el input). El input de imagen no tiene `type="url"` ni `inputMode="url"`.
- **Propuesta:** Dejar el botón habilitado y, al tocarlo, mostrar los errores en cada campo y hacer scroll al primero. Marcar los obligatorios con "*" o con el hint "obligatorio" de forma uniforme y los opcionales con "opcional". Hacer el botón sticky al pie de la hoja (`sticky bottom-0 bg-surface pt-3 -mx-4 px-4 border-t`). Asociar las etiquetas con `htmlFor`/`id`, o usar `role="group" aria-labelledby` en los grupos de chips. Agregar `type="url" inputMode="url"` al input de imagen.
- **Severidad:** Media   ·   **Categoría:** formulario

### RUT-24 · Chips de músculo/mecánica de unos 28 px y estado activo marcado solo con color
- **Ubicación:** [MusclePicker.tsx:17](src/components/MusclePicker.tsx#L17)
- **Vista:** Chips `px-3 py-1.5 text-xs` en filas con `gap-1.5`.
- **Acción:** Marcar Pecho como principal y Tríceps como secundario.
- **Problema:** Con 12 px de texto y `py-1.5`, cada chip mide unos 28 px de alto, con 6 px de separación entre filas: en una grilla densa de ~20 músculos es fácil tocar el de al lado. El estado activo solo se distingue por `bg-primary/15 ring-primary`, un tinte muy sutil (sobre todo en el tema claro, donde `primary/15` sobre `surface-2` contrasta poco), y no hay `aria-pressed`. Cuando se marca un músculo como principal, desaparece de la lista de secundarios ([MusclePicker.tsx:112](src/components/MusclePicker.tsx#L112)) y el resto de las chips se reacomoda bajo el dedo.
- **Propuesta:** Usar `min-h-11 px-3.5 text-sm` y `gap-2`. En el estado activo, agregar un ícono `Check size-3.5` y un fondo más fuerte (`bg-primary text-primary-fg`), más `aria-pressed={active}`. En secundarios, mostrar los primarios deshabilitados con la leyenda "(principal)" en vez de quitarlos, así el layout no salta.
- **Severidad:** Media   ·   **Categoría:** tap-target

### RUT-25 · Modales apilados: Escape cierra todos y el scroll del fondo se desbloquea
- **Ubicación:** [ExerciseDetailModal.tsx:108](src/components/ExerciseDetailModal.tsx#L108)
- **Vista:** Detalle de ejercicio → "Editar músculos" (otro `Modal` dentro del modal), y picker → "Crear ejercicio" (dos `Modal` abiertos a la vez, [ExercisePickerModal.tsx:145](src/components/ExercisePickerModal.tsx#L145)).
- **Acción:** Editar músculos y después cerrar solo esa hoja.
- **Problema:** Cada `Modal` agrega su propio listener de `keydown` y su `body.style.overflow`, así que Escape (o el botón atrás en algunas implementaciones) cierra las dos hojas de golpe, y al cerrar la de arriba el `cleanup` pone `overflow = ""` mientras la de abajo sigue abierta, con lo que el fondo vuelve a scrollear. Visualmente se apilan dos fondos `bg-black/60` y dos bottom sheets, y en "Editar músculos" el CTA "Guardar" usa texto propio ("Guardando…") en vez del `loading` del `Button`, a diferencia del resto ([EditMusclesModal.tsx:89](src/components/EditMusclesModal.tsx#L89)).
- **Propuesta:** Reemplazar el contenido de la hoja en vez de apilarla (vista interna con "‹ Volver" en el header del mismo `Modal`), o llevar un contador de modales abiertos en `Modal` para que solo el de arriba responda a Escape y se libere el scroll recién al cerrar el último. Usar `<Button loading={update.isPending}>Guardar</Button>`.
- **Severidad:** Baja   ·   **Categoría:** navegación

## Catálogo de ejercicios
**Caso de uso:** El usuario entra desde la card "Catálogo" de la home para explorar ejercicios y ver cómo se hacen. Esta pantalla no está en la TabBar (ver global).

### RUT-26 · El catálogo no tiene estado sin resultados, ni botón de volver, ni forma de crear o agregar
- **Ubicación:** [ejercicios/page.tsx:53](src/app/(app)/ejercicios/page.tsx#L53)
- **Vista:** Grilla 2 columnas de cards con imagen `h-28`, nombre `line-clamp-2` y badges.
- **Acción:** Buscar un ejercicio que no existe, o volver a Rutinas.
- **Problema:** Si el filtro no devuelve nada, la pantalla queda en blanco debajo de los chips, sin ningún mensaje (a diferencia del picker). No hay flecha de volver: el `PageHeader` no tiene `action` y la TabBar no marca ningún tab activo (ver global), así que el usuario depende del gesto atrás del sistema. Desde el catálogo tampoco se puede crear un ejercicio ni agregarlo a una rutina; la ficha de detalle es de solo lectura. El placeholder "Buscar…" es menos claro que el del picker ("Buscar ejercicio…").
- **Propuesta:** Agregar un `EmptyState` "Sin resultados para «x»" con "Limpiar filtros". Poner en el header un `Link` de volver (`size-11`, `aria-label="Volver"`) o un botón "Crear ejercicio" que abra `CreateExerciseModal`. En `ExerciseDetailModal`, opcionalmente, un botón "Agregar a rutina…". Unificar el placeholder en "Buscar ejercicio…".
- **Severidad:** Media   ·   **Categoría:** estados

---

# 3. Sesión de entrenamiento activa

> Auditoría estática. Ancho de referencia: 360 px → layout `px-4` (328) → card `p-3` (304) → SetRow `px-2` (**288 px útiles**). En la fila principal quedan fijos: nº `w-6` (24) + `×` (~7) + W/check/X `size-9` (3×36) + 6 `gap-2` (48) = 187 px → **~50 px por input** de kg y reps.


## Pantalla de sesión activa (estructura, cierre y estados)
**Caso de uso:** el usuario arrancó una rutina desde Rutinas/Hoy y queda "encerrado" en esta pantalla (TabBar oculta + `ActiveSessionGuard`) hasta finalizar o descartar. La usa decenas de veces por sesión, entre series, con una mano.

### ENT-01 · "Finalizar entrenamiento" cierra sin confirmar y sin revisar series pendientes
- **Ubicación:** [page.tsx:444](src/app/(app)/entrenar/[sessionId]/page.tsx#L444) · [page.tsx:172](src/app/(app)/entrenar/[sessionId]/page.tsx#L172)
- **Vista:** botón `size="lg"` (h-14) `variant="success"` fijo a `bottom-4`, ancho completo, siempre visible sobre la lista.
- **Acción:** scrollear hasta la última serie / "Agregar ejercicio" con el pulgar, o tocar Finalizar creyendo que pide confirmación.
- **Problema:** `onClick={finish}` escribe `ended_at` de inmediato: no hay diálogo, ni aviso de "te quedan 5 series sin completar", ni resumen previo. Es el blanco más grande de la pantalla y está justo en la zona del pulgar donde también terminan el scroll y el contenido inferior, así que el toque accidental es probable. Un cierre prematuro corta la sesión, dispara logros/ranking (`/api/rank/notify`) y navega a `/registro`; volver atrás no la reabre (el candado ya se soltó). El "Descartar" sí tiene confirmación ([page.tsx:484](src/app/(app)/entrenar/[sessionId]/page.tsx#L484)): la acción más frecuente y más irreversible en la práctica quedó sin protección.
- **Propuesta:** abrir un bottom sheet "¿Terminar el entreno?" con mini-resumen (duración, series completadas `X/Y`, tonelaje) y, si hay series sin tildar, el aviso "Te quedan N series sin completar: no se van a contar". Botones "Seguir entrenando" (secondary) y "Terminar" (success, h-12). Alternativa: mover Finalizar al header sticky (ver ENT-04) como en el handoff, sacándolo de la zona de scroll.
- **Severidad:** Alta   ·   **Categoría:** estados

### ENT-02 · Fallos de guardado silenciosos y sin manejo offline
- **Ubicación:** [useWorkoutMutations.ts:60](src/hooks/useWorkoutMutations.ts#L60) (idem L132, L156, L207, L300, L317) · [page.tsx:181](src/app/(app)/entrenar/[sessionId]/page.tsx#L181)
- **Vista:** el usuario carga 80 × 8, tilda la serie; todo se ve guardado (update optimista).
- **Acción:** seguir entrenando con señal mala (sótano del gimnasio) o con el token vencido.
- **Problema:** todas las mutaciones hacen `onError: rollback(ctx)` sin ningún mensaje: el valor tipeado o el tilde **desaparecen solos** (el `key={value}` del input remonta con el valor viejo) y el usuario no se entera hasta que lo ve en Registro, si lo ve. Sin red, TanStack (networkMode `online` por defecto, sin persistencia) deja las mutaciones en pausa en memoria sin indicador: si el SO mata la PWA entre series, se pierden. `finish()` usa `mutateAsync` sin `try/catch`: si falla, el botón deja de cargar y no pasa nada; offline queda con spinner indefinido. No hay ningún `MutationCache`/toast global en [providers.tsx](src/components/providers.tsx).
- **Propuesta:** (1) `MutationCache({ onError })` global con toast "No se pudo guardar · Reintentar" (con la acción de reintento). (2) Indicador discreto en el header: "Sin conexión · 3 cambios pendientes" usando `onlineManager`/`useMutationState`. (3) Persistir mutaciones pausadas (`@tanstack/query-async-storage-persister` + `resumePausedMutations`). (4) `try/catch` en `finish()` con mensaje "No pudimos cerrar el entreno. Revisá la conexión y probá de nuevo."
- **Severidad:** Alta   ·   **Categoría:** feedback

### ENT-03 · Error o sesión inexistente = spinner infinito
- **Ubicación:** [page.tsx:131](src/app/(app)/entrenar/[sessionId]/page.tsx#L131)
- **Vista:** `if (isLoading || !data) return <Spinner />`.
- **Acción:** abrir la sesión sin red, con un id borrado (descartada en otro dispositivo) o tras un fallo de la query.
- **Problema:** con `isError` la condición `!data` sigue siendo verdadera y se muestra el spinner para siempre. Peor: si el id sigue en `localStorage` (`ACTIVE_SESSION_KEY`), el candado redirige acá en cada navegación y el usuario queda atrapado en un spinner sin salida (la TabBar no se oculta, pero cualquier tab rebota a esta ruta).
- **Propuesta:** distinguir `isError`: `EmptyState` con "No pudimos cargar el entreno" + "Reintentar" (`refetch`) y, si el error es 404/PGRST116, "Este entreno ya no existe" + botón que haga `rememberActiveSession(null)` y vaya a `/rutinas`. Para la carga, un skeleton con la forma de las cards en lugar del spinner centrado.
- **Severidad:** Media   ·   **Categoría:** estados

### ENT-04 · Sin header sticky ni progreso de sesión; la parte superior la ocupa un formulario de fechas
- **Ubicación:** [page.tsx:266](src/app/(app)/entrenar/[sessionId]/page.tsx#L266) · [page.tsx:285](src/app/(app)/entrenar/[sessionId]/page.tsx#L285)
- **Vista:** arriba: flecha + `Input` editable con el nombre; debajo una card con "Duración" `text-lg` y dos `datetime-local` (`h-9`) de Inicio/Fin. Todo scrollea con el contenido.
- **Acción:** mirar de reojo cuánto lleva la sesión o cuánto le falta, a mitad del entreno.
- **Problema:** el handoff pide **header sticky** con nombre del día, cronómetro de sesión y "Terminar" (spec §5; prototipo `position:sticky` con "Día C · Empuje / 00:42 · 2 ejercicios"). La implementación pierde el reloj al primer scroll y no muestra progreso global (series hechas/total, ejercicio N de M). Además dedica ~130 px arriba a editar fechas, una tarea de corrección a posteriori, no de uso en vivo.
- **Propuesta:** header `sticky top-0 z-20 bg-bg/80 backdrop-blur border-b border-border` con: botón cerrar (44 px), nombre (`text-[15px] font-bold`, tap para renombrar), subtítulo `font-mono tabular-nums` "42:10 · 9/16 series", y "Terminar" (ENT-01). Mover Inicio/Fin a un menú "Editar horarios" o mostrarlos solo con la sesión finalizada.
- **Severidad:** Media   ·   **Categoría:** jerarquía

### ENT-05 · El campo "Fin" editable durante la sesión activa la cierra por la puerta de atrás
- **Ubicación:** [page.tsx:305](src/app/(app)/entrenar/[sessionId]/page.tsx#L305) · [page.tsx:156](src/app/(app)/entrenar/[sessionId]/page.tsx#L156)
- **Vista:** input `datetime-local` "Fin" vacío, visible y editable mientras se entrena.
- **Acción:** tocarlo por error o "para probar".
- **Problema:** `editTime("ended_at")` guarda `ended_at` sin pasar por `finish()`: la sesión pasa a "finalizada" (aparece el resumen, cambia el botón a "Ver registro") pero no se registran logros/PRs, no se notifica el ranking, no se limpia el descanso ni el cache `["active-session"]` (el candado puede seguir redirigiendo). Es un estado incoherente alcanzable con un toque.
- **Propuesta:** con `!ended`, ocultar "Fin" (o mostrarlo `disabled` con "—"); dejar solo "Inicio" editable (útil si se olvidó de arrancar) dentro del menú de ajustes de la sesión.
- **Severidad:** Media   ·   **Categoría:** estados

### ENT-06 · La flecha "atrás" en realidad descarta, y mide ~20 px
- **Ubicación:** [page.tsx:267](src/app/(app)/entrenar/[sessionId]/page.tsx#L267)
- **Vista:** `<button className="text-muted hover:text-fg">` con `ArrowLeft size-5`, sin padding.
- **Acción:** querer "salir un momento" a ver otra pantalla.
- **Problema:** el ícono universal de "volver" abre "Descartar entrenamiento" (acción destructiva). Aunque el modal confirma, el modelo mental es incorrecto (el usuario espera minimizar, no borrar) y el botón de confirmación es `variant="danger"` a la derecha, donde va el pulgar. El área táctil es solo el ícono (20×20 px), muy por debajo de 44 px, en un rincón difícil con una mano.
- **Propuesta:** reemplazar por `X` o por un menú `⋯` del header con "Descartar entreno" en rojo; tap target `size-11 grid place-items-center rounded-lg`. En el modal, poner "Seguir entrenando" como botón primario a ancho completo y "Descartar" como secundario/ghost danger debajo.
- **Severidad:** Media   ·   **Categoría:** navegación

### ENT-07 · Sesión olvidada abierta: el candado atrapa sin explicar y la duración se infla
- **Ubicación:** [ActiveSessionGuard.tsx:28](src/components/ActiveSessionGuard.tsx#L28) · [page.tsx:174](src/app/(app)/entrenar/[sessionId]/page.tsx#L174)
- **Vista:** el usuario cerró la PWA sin finalizar; al día siguiente abre la app (o toca una notificación de amigos) y aparece directo en el entreno de ayer, con "Duración 22:14:05".
- **Acción:** ir a Inicio o Ranking.
- **Problema:** `router.replace(target)` rebota en silencio, sin decir por qué. No hay detección de sesión vieja (sí la hay para el descanso con `REST_MAX_SECONDS`), y si el usuario toca "Finalizar" se guarda una duración de 22 h que contamina métricas. Tampoco puede consultar Registro/Progreso a mitad de entreno (ej. ver qué hizo la semana pasada en otro ejercicio).
- **Propuesta:** si `now - started_at` > ~4 h, mostrar al entrar un sheet "Tenés un entreno abierto desde ayer 19:30" con "Terminarlo ahora (usar última serie como fin)", "Seguir" y "Descartar". Para el candado, un banner/toast "Tenés un entreno en curso" en vez de redirigir sin aviso, o permitir navegar con un "mini-player" persistente "Entreno en curso · 32:10 · Volver".
- **Severidad:** Media   ·   **Categoría:** navegación

### ENT-08 · Tres capas flotantes apiladas tapan ~200 px de la lista (y la fila que se edita)
- **Ubicación:** [page.tsx:426](src/app/(app)/entrenar/[sessionId]/page.tsx#L426) · [page.tsx:444](src/app/(app)/entrenar/[sessionId]/page.tsx#L444) · [Stopwatch.tsx:23](src/components/Stopwatch.tsx#L23)
- **Vista:** Finalizar `bottom-4` h-14 (16–72 px), banner de descanso `bottom-20` (~80–144 px), FAB del cronómetro `bottom-36 right-4 size-14` (144–200 px). En un viewport de ~640 px es casi un tercio de la pantalla.
- **Acción:** cargar kg/reps en una serie que quedó en la mitad inferior; abrir el teclado.
- **Problema:** las tres capas tapan justo la zona de la serie siguiente, que es donde el usuario está trabajando; el FAB queda pegado al borde superior del banner (sin aire, z-30 vs z-40). En navegadores donde el layout viewport se achica con el teclado, Finalizar y el banner suben con él y tapan el input enfocado; nada hace `scrollIntoView` del campo. El `pb-24` de la página más el del layout compensan el final del scroll, pero no el solapamiento durante el uso.
- **Propuesta:** consolidar en una sola barra inferior: el descanso reemplaza temporalmente al CTA o se ubica en el header sticky (como en el prototipo, debajo del header). Eliminar el FAB (ENT-24). Ocultar las capas fijas mientras hay un input enfocado (`:has(input:focus)` o estado `focused`) y hacer `el.scrollIntoView({ block: "center" })` al enfocar.
- **Severidad:** Media   ·   **Categoría:** espaciado


## Card de ejercicio (`SessionExerciseCard`)
**Caso de uso:** cada ejercicio de la rutina es una card; el usuario la despliega para cargar sus series, y usa el menú ⋮ para mover, reemplazar o quitar.

### ENT-09 · Todo arranca plegado y nada indica qué ejercicio/serie toca ahora
- **Ubicación:** [SessionExerciseCard.tsx:78](src/components/SessionExerciseCard.tsx#L78) · [SessionExerciseCard.tsx:325](src/components/SessionExerciseCard.tsx#L325) · [SetRow.tsx:180](src/components/SetRow.tsx#L180)
- **Vista:** lista de cards iguales con nombre + badges; "2/4 series" es un `Badge` gris `text-xs` igual que el de músculo. Serie completada = `bg-success/10`.
- **Acción:** volver al teléfono tras el descanso y encontrar "dónde estaba".
- **Problema:** `useState(true)` pliega todas las cards: entre series hay que buscar y tocar el header de la card correcta, y al terminar un ejercicio hay que plegarla y abrir la siguiente a mano (2 taps extra por ejercicio). No hay estado "en curso" vs "pendiente" vs "terminado": una card 4/4 se ve igual que una 0/4. El verde al 10 % es casi invisible con brillo alto o en el tema claro. La serie siguiente no se resalta.
- **Propuesta:** abrir por defecto la primera card con series pendientes y, al completar la última serie, plegarla y desplegar la siguiente (con `scrollIntoView`). Estados visuales: terminada → check verde + nombre `text-muted` + borde `ring-success/40`; en curso → `ring-1 ring-primary`; serie siguiente → `ring-1 ring-primary/50` en la fila. Badge de progreso con color (`bg-success/15 text-success` al completar) o una barra de progreso fina bajo el nombre.
- **Severidad:** Alta   ·   **Categoría:** jerarquía

### ENT-10 · "Quitar del entreno" borra el ejercicio con todas sus series sin confirmar ni deshacer
- **Ubicación:** [SessionExerciseCard.tsx:384](src/components/SessionExerciseCard.tsx#L384) · [SessionExerciseCard.tsx:344](src/components/SessionExerciseCard.tsx#L344)
- **Vista:** menú ⋮ (`size-9`, sin `aria-label` ni `aria-expanded`) con 4 ítems `py-2 text-sm` (~36 px de alto); "Quitar del entreno" es el último, debajo de "Ver detalle".
- **Acción:** abrir "Ver detalle" con el pulgar y errarle por un ítem.
- **Problema:** `onRemove()` ejecuta `removeExercise` al instante: se pierden todas las series cargadas de ese ejercicio. Ítems de 36 px pegados entre sí y sin separador hacen fácil el error; no hay toast con "Deshacer". El dropdown `absolute top-10 w-48` también puede quedar cortado por las capas fijas inferiores en la última card.
- **Propuesta:** si el ejercicio tiene alguna serie con datos/completada, pedir confirmación ("Quitar Press banca y sus 3 series cargadas") o, mejor, borrar optimista con toast "Ejercicio quitado · Deshacer" (5 s) antes de llamar al server. Ítems de menú `min-h-11`, separador `border-t border-border` antes del destructivo. Idealmente el menú como bottom sheet (`Modal`) en mobile.
- **Severidad:** Alta   ·   **Categoría:** estados

### ENT-11 · Tildar la última serie autocompleta las anteriores sin aviso ni deshacer
- **Ubicación:** [SessionExerciseCard.tsx:219](src/components/SessionExerciseCard.tsx#L219)
- **Vista:** el usuario tilda la serie 4 de 4.
- **Acción:** tildar la última porque la hizo, habiéndose salteado la 2 o 3 (o tocar el check equivocado).
- **Problema:** el patrón está acordado en el handoff, pero se ejecuta en silencio: las series pendientes se marcan completas y, si estaban vacías, `adopt()` les copia los valores de la última vez. Resultado: series y tonelaje que no existieron, sin que el usuario lo note. Destildar la 4 no revierte las otras.
- **Propuesta:** mostrar un toast "Se completaron también las series 2 y 3 · Deshacer", o pedirlo explícitamente solo cuando hay series previas vacías. Animar brevemente las filas autocompletadas para que se vea el cambio.
- **Severidad:** Media   ·   **Categoría:** feedback

### ENT-12 · Nota del ejercicio y comentario de serie: dos conceptos confusos, la nota siempre ocupa espacio
- **Ubicación:** [SessionExerciseCard.tsx:426](src/components/SessionExerciseCard.tsx#L426) · [ExerciseNoteEditor.tsx:21](src/components/ExerciseNoteEditor.tsx#L21) · [SetRow.tsx:470](src/components/SetRow.tsx#L470)
- **Vista:** al final de cada card desplegada, `Textarea rows={2}` "Nota del ejercicio"; además, cada serie tiene un ícono 💬 que abre un input "Comentario…".
- **Acción:** anotar "banco a 30°" o "me molestó el hombro hoy".
- **Problema:** la nota es global (viaja entre rutinas y sesiones) pero nada lo dice: quien escribe "hoy me dolió" la verá en todas las sesiones futuras. Dos lugares para notas sin diferenciar su alcance. La textarea abierta suma ~70 px a cada card en vivo, y se guarda en `onBlur` sin feedback. El `<label>` no está asociado (`htmlFor`) a la textarea.
- **Propuesta:** plegar la nota en un chip "📝 Nota fija" que se expande al tocar, con copy "Nota fija · la vas a ver cada vez que hagas este ejercicio". Mostrar la nota existente como texto de solo lectura arriba de las series (es una indicación útil antes de empezar) y editar en tap. Mostrar "Guardado" breve tras el blur. Asociar `<label htmlFor>`/`id`.
- **Severidad:** Baja   ·   **Categoría:** copy


## Fila de serie (`SetRow`)
**Caso de uso:** el corazón del flujo: entre series el usuario carga kg y reps, marca RIR y tilda la serie, idealmente en menos de 5 segundos y sin mirar mucho.

### ENT-13 · Eliminar serie (X) pegado al check de completar, sin confirmación ni deshacer
- **Ubicación:** [SetRow.tsx:254](src/components/SetRow.tsx#L254) · [SetRow.tsx:266](src/components/SetRow.tsx#L266)
- **Vista:** al final de la fila: `W` | `✓` | `X`, los tres `size-9` (36 px) con `gap-2` (8 px). La X es `text-muted` sin fondo.
- **Acción:** tildar la serie con el pulgar, apurado y transpirado.
- **Problema:** la acción más frecuente (completar) y una destructiva irreversible (`deleteSet` inmediato) están a 8 px y con el mismo tamaño; el borde derecho es además la zona más cómoda del pulgar en diestros, donde cae la X. Un error borra la serie con sus datos sin forma de recuperarla. Ningún botón tiene `aria-label`.
- **Propuesta:** sacar la X de la fila: eliminar con swipe-left sobre la fila (revelando "Eliminar" rojo) o con long-press / menú de la serie. Si se mantiene visible, ponerla al principio (sobre el número de serie) o separarla ≥16 px, y siempre con toast "Serie eliminada · Deshacer". El check debe quedar como el elemento final y más grande (ENT-14).
- **Severidad:** Alta   ·   **Categoría:** tap-target

### ENT-14 · El check de completar y los inputs miden 36 px: chicos para el control principal
- **Ubicación:** [SetRow.tsx:257](src/components/SetRow.tsx#L257) · [SetRow.tsx:509](src/components/SetRow.tsx#L509) · [DurationField.tsx:70](src/components/DurationField.tsx#L70)
- **Vista:** check `size-9` con `Check size-4` sobre `bg-surface ring-1 ring-border text-muted`; inputs `h-9`, ~50 px de ancho a 360 px.
- **Acción:** tildar la serie o tocar el campo de kg, a veces con guantes.
- **Problema:** con 36 px, el control más usado de la app queda por debajo de 44 px (y del ideal ≥48 px para este contexto). En estado sin completar, el check es gris sobre gris: no invita al tap ni se distingue del botón W de al lado (mismo tamaño, mismo estilo). Los inputs de 36 px de alto obligan a apuntar con precisión.
- **Propuesta:** check `size-12` (48 px) `rounded-lg` con `ring-2 ring-success/50 text-success` en reposo y `bg-success text-bg` al completar; inputs `h-11`. Para liberar ancho: sacar la X (ENT-13) y el "×" separador (reemplazar por encabezados, ENT-18), y bajar W a `size-9` como control secundario. A 360 px, con `gap-1.5`: 24 (nº) + 2×~76 (inputs) + 36 (W) + 48 (✓) + 4×6 (gaps) ≈ 284 px, dentro de los 288 disponibles.
- **Severidad:** Alta   ·   **Categoría:** tap-target

### ENT-15 · RIR segmentado de 24 × 24 px con 4 px de separación
- **Ubicación:** [SetRow.tsx:287](src/components/SetRow.tsx#L287) · [SetRow.tsx:296](src/components/SetRow.tsx#L296)
- **Vista:** 6 botones `h-6 w-6 text-[11px]` con `gap-1`, a la derecha de la etiqueta "RIR / 1–3".
- **Acción:** marcar RIR 2 inmediatamente después de terminar una serie (pulso alto, mano temblando).
- **Problema:** 24 px es la mitad del mínimo recomendado y con 4 px de separación es muy fácil marcar 1 o 3 en lugar de 2 (dato que alimenta las sugerencias de carga y las "series efectivas"). Los números en 11 px bold son difíciles de leer a distancia de brazo. Usa solo un 60 % del ancho disponible: hay espacio para agrandarlos.
- **Propuesta:** segmented control a ancho completo: `grid grid-cols-6 gap-1.5 flex-1` con botones `h-10 text-sm font-bold rounded-md` (a 288 − 32 px de etiqueta ≈ 40 px por botón). Mantener los colores por zona y `aria-pressed`. Etiqueta "RIR" arriba o a la izquierda con el rango productivo debajo.
- **Severidad:** Alta   ·   **Categoría:** tap-target

### ENT-16 · Inputs numéricos: coma decimal, sin seleccionar al enfocar, sin "siguiente"
- **Ubicación:** [SetRow.tsx:497](src/components/SetRow.tsx#L497)
- **Vista:** `<input type="number" inputMode="decimal" step={2.5}>` para kg, reps y km; commit en `onBlur`.
- **Acción:** escribir 72,5 kg, corregir un 80 que vino de la última vez, pasar de kg a reps.
- **Problema:** (1) en locale es-AR el teclado decimal muestra ",": con `type="number"` un valor con coma puede llegar como `e.target.value === ""` y se guarda `null` sin aviso (y además el campo se vacía al remontar). (2) Al tocar un campo con valor, el cursor queda al final: hay que borrar a mano en vez de sobrescribir. (3) Sin `enterKeyHint="next"` ni avance de kg → reps → RIR: tras escribir el peso hay que cerrar el teclado y apuntar al siguiente campo de 50 px. (4) Reps usa `inputMode="decimal"` (debería ser `numeric`, sin separador). (5) Sin `min={0}`: se aceptan negativos. `step` no aporta nada en mobile.
- **Propuesta:** `type="text"` + `inputMode="decimal"` (kg/km) o `"numeric"` (reps) y parsear con `value.replace(",", ".")`, validando `Number.isFinite` y `>= 0` (si no es válido, ring danger + no guardar). `onFocus={(e) => e.currentTarget.select()}`. `enterKeyHint="next"` y en `onKeyDown` Enter → `focus()` del siguiente campo de la fila; en reps, `enterKeyHint="done"`.
- **Severidad:** Alta   ·   **Categoría:** formulario

### ENT-17 · El valor tipeado solo se guarda en `onBlur`: riesgo de pérdida al bloquear el teléfono
- **Ubicación:** [SetRow.tsx:504](src/components/SetRow.tsx#L504) · [SetRow.tsx:474](src/components/SetRow.tsx#L474)
- **Vista:** campo no controlado (`defaultValue`) que solo llama `onCommit` al perder el foco.
- **Acción:** tipear el peso y bloquear el teléfono / guardarlo en el bolsillo para hacer la serie.
- **Problema:** es un gesto típico en el gimnasio. No está garantizado que el `blur` del input se dispare al pasar la PWA a segundo plano o cuando el SO la mata, así que el valor se pierde y el usuario no lo nota hasta volver (o nunca, si al volver tilda y `adopt()` rellena con el ghost). Lo mismo pasa con el comentario de serie y la nota.
- **Propuesta:** guardar con debounce (~600 ms) en `onChange`, además del `onBlur`, y/o forzar el commit en `visibilitychange` (`document.hidden`) blureando `document.activeElement`. Guardar un borrador local por `set.id` para restaurarlo si la app se recarga.
- **Severidad:** Media   ·   **Categoría:** formulario

### ENT-18 · Sin encabezados de columna; el valor de "la última vez" se confunde con el real
- **Ubicación:** [SetRow.tsx:184](src/components/SetRow.tsx#L184) · [SetRow.tsx:192](src/components/SetRow.tsx#L192) · [SetRow.tsx:509](src/components/SetRow.tsx#L509)
- **Vista:** fila "1 [80] × [8] W ✓ X". Si hay ghost, el placeholder muestra "80"/"8" en vez de "kg"/"reps".
- **Acción:** leer de un vistazo qué cargó y qué tiene que levantar.
- **Problema:** el handoff incluye una fila de encabezados `# · Kg · Reps · RIR · W` sobre las series; acá no existe y, con ghost, los placeholders pierden la unidad: para ejercicios por tiempo/distancia ("1.2" ¿km?) es ambiguo. El placeholder no tiene estilo propio (el `Input` primitivo usa `placeholder:text-muted/60`, este no): el gris por defecto del navegador puede confundirse con un valor cargado, y eso importa porque tildar una serie vacía **adopta** el ghost.
- **Propuesta:** una fila de encabezados por card (`text-[11px] font-semibold text-muted uppercase`, alineada con los inputs) como en el prototipo. Placeholder `placeholder:text-muted/50 placeholder:font-normal` y valor real `font-semibold text-fg`, para que "lo cargado" y "lo sugerido" se diferencien a simple vista.
- **Severidad:** Media   ·   **Categoría:** jerarquía

### ENT-19 · Controles secundarios con tap targets de 16–32 px
- **Ubicación:** [SetRow.tsx:462](src/components/SetRow.tsx#L462) · [SetRow.tsx:451](src/components/SetRow.tsx#L451) · [SetRow.tsx:311](src/components/SetRow.tsx#L311) · [SetRow.tsx:331](src/components/SetRow.tsx#L331) · [SessionExerciseCard.tsx:417](src/components/SessionExerciseCard.tsx#L417)
- **Vista:** "Agregar bajada" (texto `text-xs` sin padding, ~16 px de alto), quitar bajada `size-7` (28 px), comentario `size-6` (24 px), chip ⓘ del plan `size-5` (20 px), "Agregar serie" `Button size="sm"` (32 px, ver global).
- **Acción:** agregar un dropset o una serie extra al vuelo.
- **Problema:** todos por debajo de 44 px, varios muy por debajo; el "Agregar bajada" de 16 px está justo debajo del RIR y encima de la siguiente fila, así que se toca sin querer al apuntar al RIR (y crea una bajada vacía). El quitar bajada (28 px) es destructivo y está al lado del input de reps.
- **Propuesta:** área táctil mínima de 44 px aun si lo visual es chico (`min-h-11 px-3` o pseudo-elemento `before:absolute before:-inset-2`). "Agregar serie" como `size="md"` con borde punteado `border border-dashed border-border`. Quitar bajada `size-10`.
- **Severidad:** Media   ·   **Categoría:** tap-target

### ENT-20 · Densidad: cada serie ocupa ~100 px por líneas que casi nunca se usan
- **Ubicación:** [SetRow.tsx:461](src/components/SetRow.tsx#L461) · [SetRow.tsx:275](src/components/SetRow.tsx#L275) · [SetRow.tsx:326](src/components/SetRow.tsx#L326)
- **Vista:** fila principal (36) + RIR (24) + línea de plan/consejo (~20) + "Agregar bajada" (~16) + paddings = ~100 px por serie; 4 series ≈ 400 px por ejercicio.
- **Acción:** ver de un vistazo todas las series del ejercicio en curso.
- **Problema:** "Agregar bajada" se repite en todas las filas (`showsDrops`), aunque el handoff dice que el botón "+ dropset" **agrega bajada a la última serie** (uno por ejercicio). Con un ejercicio desplegado ya no entran sus 4 series en pantalla junto con el banner de descanso, lo que obliga a scrollear en cada serie.
- **Propuesta:** un solo "+ bajada" por ejercicio (aplica a la última serie completada o en curso), o moverlo a un menú/long-press de la fila. Mostrar la línea de RIR solo en la serie en curso y en las completadas (en las pendientes futuras, ocultarla). Mantener plan/consejo en la misma línea del RIR cuando hay espacio.
- **Severidad:** Media   ·   **Categoría:** espaciado

### ENT-21 · Valores de carga en 14 px de peso normal y consejos en 11 px: poca legibilidad a distancia de brazo
- **Ubicación:** [SetRow.tsx:509](src/components/SetRow.tsx#L509) · [SetRow.tsx:185](src/components/SetRow.tsx#L185) · [SetRow.tsx:329](src/components/SetRow.tsx#L329)
- **Vista:** kg/reps `text-sm` (14 px, peso normal); número de serie `text-sm text-muted`; "bajá el peso / subí el peso" en `text-[11px]`.
- **Acción:** leer el peso a usar con el teléfono apoyado en el banco o en el piso.
- **Problema:** los números son el contenido principal de la pantalla y tienen el mismo cuerpo que una etiqueta; el prototipo los pide `14px/600` como mínimo. El consejo de carga, que es accionable para la próxima serie, va en 11 px en warning/danger (bajo contraste sobre `bg-surface-2` en tema claro). En iOS, los inputs de <16 px disparan zoom al enfocar (hoy lo frena `maximumScale: 1`, ver global).
- **Propuesta:** inputs `text-base font-semibold tabular-nums` (16 px); número de serie `text-sm font-semibold text-fg`; consejo `text-xs font-semibold` con ícono de 14 px.
- **Severidad:** Media   ·   **Categoría:** tipografía

### ENT-22 · Botones de la fila sin nombre accesible ni estado
- **Ubicación:** [SetRow.tsx:241](src/components/SetRow.tsx#L241) · [SetRow.tsx:254](src/components/SetRow.tsx#L254) · [SetRow.tsx:266](src/components/SetRow.tsx#L266) · [SetRow.tsx:292](src/components/SetRow.tsx#L292) · [SetRow.tsx:311](src/components/SetRow.tsx#L311) · [SetRow.tsx:497](src/components/SetRow.tsx#L497)
- **Vista:** check, X, comentario y quitar bajada solo con ícono; W con `title` (no se ve en touch); RIR con números sueltos; inputs sin label.
- **Acción:** usar lector de pantalla o tener un `title` que explique "W".
- **Problema:** un lector anuncia "botón, botón, botón"; el check no expone si la serie está completada (`aria-pressed`), el RIR no indica cuál está activo ni que es un grupo, los inputs no dicen "Peso serie 2" (el placeholder no es label). "W" (warmup, en inglés) no se entiende en una UI en español y `title` no aparece en mobile.
- **Propuesta:** check `aria-label={\`Completar serie ${n}\`}` + `aria-pressed={set.completed}`; X `aria-label="Eliminar serie N"`; W `aria-label="Calentamiento"` + `aria-pressed` (y considerar "C" o un ícono de llama con tooltip en el primer uso); RIR `role="radiogroup" aria-label="RIR"` con `role="radio" aria-checked`; inputs `aria-label="Peso (kg), serie N"` / `"Reps, serie N"`; comentario `aria-label="Comentario de la serie"`.
- **Severidad:** Media   ·   **Categoría:** accesibilidad


## Descanso y cronómetro
**Caso de uso:** al tildar una serie arranca un descanso automático en un banner flotante; aparte hay un cronómetro manual (FAB "Cron"). El usuario mira el tiempo entre series para saber cuándo arrancar la próxima.

### ENT-23 · Timer de descanso: cuenta hacia arriba sin objetivo ni aviso, CTA chico y ambiguo (desvío del diseño)
- **Ubicación:** [page.tsx:425](src/app/(app)/entrenar/[sessionId]/page.tsx#L425) · [page.tsx:436](src/app/(app)/entrenar/[sessionId]/page.tsx#L436) · [page.tsx:252](src/app/(app)/entrenar/[sessionId]/page.tsx#L252)
- **Vista:** banner "Descanso 01:42" (`font-mono text-lg`) con `Button size="sm"` "Comenzar".
- **Acción:** descansar, mirar de reojo si ya pasaron los 2 minutos, y arrancar la próxima serie.
- **Problema:** el handoff (spec §5) pide **cuenta regresiva con anillo de progreso**, objetivo por tipo de ejercicio (compuesto 2–3 min / aislamiento 1–2 min), "+30s" y "Saltar", y que **no arranque en warmups**. La implementación cuenta hacia arriba sin meta, sin aviso al llegar (ni vibración, ni sonido, ni cambio de color), arranca también al tildar un calentamiento (`onSetCompleted` no filtra `is_warmup`) y no hay forma de descartarlo sin guardarlo. "Comenzar" no dice qué comienza (es "arranqué la próxima serie") y es un botón de 32 px (ver global) para la acción que justifica todo el banner. El tiempo en 18 px mono es difícil de leer a distancia; el prototipo lo pide 20 px/800 en dorado.
- **Propuesta:** anillo de 44 px con `stroke-dashoffset` y cuenta regresiva `text-2xl font-extrabold text-primary tabular-nums`, subtítulo "Descanso · compuesto 2–3 min"; al llegar a 0, `navigator.vibrate([200,100,200])`, el banner pasa a `ring-success` y sigue contando en positivo ("+0:15"). Botones `h-11`: "+30 s" (secondary) y "Arrancar serie" (primary). No iniciar si la serie es warmup. Ubicarlo debajo del header sticky como en el prototipo (ver ENT-08).
- **Severidad:** Alta   ·   **Categoría:** feedback

### ENT-24 · Cronómetro manual duplicado del descanso, con controles sin etiqueta
- **Ubicación:** [Stopwatch.tsx:17](src/components/Stopwatch.tsx#L17) · [Stopwatch.tsx:34](src/components/Stopwatch.tsx#L34) · [Stopwatch.tsx:46](src/components/Stopwatch.tsx#L46)
- **Vista:** FAB redondo `size-14` con ícono de timer (o el tiempo en `text-xs` si corre); al abrirlo, play/pausa y reset `size-9` sin `aria-label` y un "Cerrar" `text-xs px-1`.
- **Acción:** medir el descanso.
- **Problema:** el propio comentario lo define como "útil para medir descansos entre series", lo mismo que el banner automático: dos relojes para la misma tarea, con estilos y ubicaciones distintas, confunden (¿cuál vale para el promedio de descanso? solo el banner). El FAB usa el mismo ícono `Timer` que el banner. "Cerrar" (~16 px de alto) y los botones sin nombre accesible. El tiempo dentro del FAB en `text-xs` mono sobre `bg-success` es ilegible a distancia.
- **Propuesta:** quitar el FAB de la sesión activa (el descanso automático lo cubre) o redefinirlo como "Cronómetro de serie" (para planchas/isométricos) con ícono distinto y solo en ejercicios por tiempo, integrado al `DurationField` ("▶ medir"). Si se mantiene: `aria-label="Iniciar/Pausar/Reiniciar cronómetro"`, "Cerrar" como botón `size-11` con ícono.
- **Severidad:** Media   ·   **Categoría:** consistencia


## Reemplazar ejercicio (`ReplaceExerciseModal`)
**Caso de uso:** la máquina está ocupada o rota; desde el ⋮ de la card el usuario elige un ejercicio alternativo, opcionalmente para todas las próximas veces de la rutina.

### ENT-25 · Reemplazo sin feedback ni estado vacío, y copy técnico
- **Ubicación:** [ReplaceExerciseModal.tsx:50](src/components/ReplaceExerciseModal.tsx#L50) · [ReplaceExerciseModal.tsx:74](src/components/ReplaceExerciseModal.tsx#L74) · [ReplaceExerciseModal.tsx:98](src/components/ReplaceExerciseModal.tsx#L98) · [useWorkoutMutations.ts:254](src/hooks/useWorkoutMutations.ts#L254)
- **Vista:** checkbox "Guardar para futuras iteraciones de esta rutina", buscador con `autoFocus`, chips de músculo y lista.
- **Acción:** buscar "polea" y tocar un resultado.
- **Problema:** (1) el tap reemplaza y cierra al instante, pero `replaceExercise` no es optimista: la card sigue mostrando el ejercicio viejo hasta el refetch y, si falla, no pasa nada visible. (2) Si la búsqueda no encuentra nada, la lista queda vacía sin mensaje. (3) "iteraciones" es jerga de programador. (4) `autoFocus` abre el teclado de entrada y tapa la mitad de la hoja, cuando el caso común es elegir de las sugerencias del mismo músculo, que ya vienen primero. (5) El checkbox queda arriba del buscador sticky y se va con el scroll; es fácil olvidar marcarlo antes de elegir.
- **Propuesta:** update optimista del `exercise_id` + toast "Cambiado por Remo en polea · Deshacer". Estado vacío "No encontramos “xyz”. Probá con otro nombre o sacá el filtro". Copy: "Usar este cambio las próximas veces que hagas esta rutina" / "Si no, aplica solo a hoy". Sin `autoFocus`; encabezado "Sugeridos para Pecho" con los del mismo músculo. Mover el toggle al pie de la hoja (sticky bottom) o preguntarlo después de elegir.
- **Severidad:** Baja   ·   **Categoría:** feedback


## Celebración de PR (`PrCelebrationModal`)
**Caso de uso:** al tocar Finalizar, si hubo un récord de e1RM, aparece un bottom sheet de celebración antes de ir a Registro.

### ENT-26 · La celebración se cierra con cualquier toque afuera y muestra un solo PR
- **Ubicación:** [PrCelebrationModal.tsx:26](src/components/PrCelebrationModal.tsx#L26) · [PrCelebrationModal.tsx:81](src/components/PrCelebrationModal.tsx#L81) · [page.tsx:210](src/app/(app)/entrenar/[sessionId]/page.tsx#L210)
- **Vista:** overlay propio (no usa `Modal`) con trofeo, "NUEVO RÉCORD", 3 stats y "Compartir con amigos"; debajo, "Seguir" `py-2 text-sm text-muted`.
- **Acción:** leer el logro con el teléfono en la mano tras la última serie.
- **Problema:** el backdrop ocupa la mitad superior y `onClick={onClose}` cierra **y navega** a `/registro`: un toque involuntario hace perder el momento sin forma de volver a verlo. Solo se muestra el mejor PR (`sort(...)[0]`): si hubo tres récords, dos se pierden en silencio. "Seguir" es ambiguo (¿seguir entrenando? lleva a Registro) y tiene poco peso visual. El salto de e1RM aparece dos veces ("(+5)" en el subtítulo y "+5 kg vs 1RM previo"), y "kg del mejor set" redondea (`Math.round(102.5)` → 103) mientras el título muestra 102,5 kg. Sin `role="dialog"`, `aria-modal`, foco inicial ni Escape. El fallback a portapapeles no avisa "Copiado".
- **Propuesta:** no cerrar con el backdrop (o pedir dos toques). Si hay varios PRs, mostrarlos en lista o con paginado "1 de 3". Botón secundario "Ver resumen" `Button variant="secondary" size="md" w-full`. Reemplazar el stat duplicado por "reps del mejor set" y usar `formatWeight` en todos los pesos. Reusar `Modal` (o agregar `role="dialog" aria-modal aria-labelledby`) y toast "Texto copiado" en el fallback.
- **Severidad:** Media   ·   **Categoría:** feedback

---

# 4. Registro y métricas

## Registro · estructura general y estados de la pantalla
**Caso de uso:** El usuario entra desde la TabBar ("Registro") para ver cómo viene la semana, revisar su progreso o buscar una sesión pasada. Es la pantalla con más contenido de la app (KPIs, plan, ~10 cards de métricas, historial).

### REG-01 · Un error de red se muestra como "Sin entrenamientos todavía"
- **Ubicación:** [page.tsx:922](src/app/(app)/registro/page.tsx#L922)
- **Vista:** Estado de error de `useHistory` (Supabase caído, sin señal en el gimnasio, token vencido).
- **Acción:** Abrir Registro para ver sus métricas.
- **Problema:** La página solo lee `{ data, isLoading }` ([page.tsx:178](src/app/(app)/registro/page.tsx#L178)); si la query falla, `data` queda `undefined`, `isLoading` es `false` y se renderiza el `EmptyState` "Sin entrenamientos todavía · Cuando completes una rutina vas a ver tus métricas acá". Un usuario con meses de historial cree que perdió todos sus datos. Además el botón de exportar desaparece (`!!data?.length`), así que no puede ni respaldar.
- **Propuesta:** Leer `isError`/`refetch` de `useHistory` y renderizar un estado propio: `EmptyState` con ícono `WifiOff`, título "No pudimos cargar tu historial", descripción "Revisá tu conexión. Tus datos están guardados." y `action={<Button onClick={() => refetch()}>Reintentar</Button>}`. Dejar el empty de primer uso solo para `isSuccess && data.length === 0`.
- **Severidad:** Alta   ·   **Categoría:** estados

### REG-02 · Siete KPIs y el plan semanal antes de cualquier sub-navegación; tres columnas en 360px
- **Ubicación:** [page.tsx:930-1045](src/app/(app)/registro/page.tsx#L930)
- **Vista:** Arriba de todo: grid 2 col (Días/Series efectivas) + grid **`grid-cols-3`** (Entrenos/Racha/Cumplimiento 30d) + grid 2 col (Promedio semanal/Duración) + card "Plan semanal".
- **Acción:** Ver de un vistazo "cómo vengo esta semana".
- **Problema:** Son 7 tiles que compiten al mismo peso visual (`text-xl font-bold` todos). Hay redundancia ("Días esta semana" y "Promedio semanal" muestran la misma métrica de frecuencia y hasta el mismo delta, ver REG-03). El grid de 3 columnas rompe la regla del handoff ("máx 2 columnas en cualquier grid"): en 360px cada card mide ≈102px con `p-3.5`, dejan ≈74px de contenido, así que "Cumplimiento 30d" (`text-xs`) se parte en dos líneas junto al botón "i" y las alturas de las tres cards no coinciden. La racha, que el spec pone primera ("racha + CTA"), queda en una celda chica de la segunda fila.
- **Propuesta:** Pasar a un bloque hero de 2 columnas: fila 1 = Racha (con llama) + Cumplimiento 30d; fila 2 = Días esta semana + Series efectivas con su delta. Mover "Entrenos totales", "Promedio semanal" y "Duración promedio" a una fila compacta de texto (`text-xs text-muted`, ej. "142 entrenos · 3,4/sem · 58 min promedio") o a "Más métricas". Ningún `grid-cols-3`.
- **Severidad:** Alta   ·   **Categoría:** jerarquía

### REG-03 · El delta de las cards de "esta semana" no compara esta semana
- **Ubicación:** [page.tsx:936](src/app/(app)/registro/page.tsx#L936), [page.tsx:952](src/app/(app)/registro/page.tsx#L952), [page.tsx:1029](src/app/(app)/registro/page.tsx#L1029), [metrics.ts:283](src/lib/metrics.ts#L283)
- **Vista:** Card "Días esta semana: 2 días" con un chip "▲ 50%" debajo; "Series efectivas 14 sets · hasta ahora" con "▼ 20%"; "Promedio semanal" con el mismo chip que "Días esta semana".
- **Acción:** Leer si esta semana viene mejor o peor que la anterior.
- **Problema:** `weeklyMetricStats.deltaPct` compara la **última semana terminada contra la anterior**, no la semana en curso. El chip se ve pegado al valor actual, así que se lee como "esta semana vs la pasada", que es justo lo que dice el spec ("↑ 8% vs sem previa"). El contexto solo está escondido en el modal "i". Encima, "Promedio semanal" usa el mismo `workoutStats.deltaPct` que "Días esta semana", con un texto de info distinto, y aparecen dos chips iguales con dos explicaciones diferentes. Además `DeltaChip` ([ui.tsx:276](src/components/ui.tsx#L276)) pinta 0% como "▲ 0%" verde, y `E1rmTrendCard` ([GoalMetrics.tsx:227](src/components/GoalMetrics.tsx#L227)) usa "+3%" sin flecha, lo que contradice la regla "flecha + %".
- **Propuesta:** O bien comparar la semana en curso con la anterior al mismo día de la semana ("vs. lun–mié pasado"), o mostrar el delta con un sufijo visible usando `deltaSuffix` ("▲ 50% sem. pasada vs. previa"). Sacar el delta de "Promedio semanal". En `DeltaChip`, `pct === 0` en `text-muted` con un ícono `Minus`. Usar `DeltaChip` también en `E1rmTrendCard`.
- **Severidad:** Alta   ·   **Categoría:** dataviz

### REG-04 · Sub-navegación "Entrenamiento / Cuerpo" enterrada y sin persistencia
- **Ubicación:** [page.tsx:1060](src/app/(app)/registro/page.tsx#L1060), [page.tsx:487](src/app/(app)/registro/page.tsx#L487)
- **Vista:** Segmented `Tabs` que aparece recién después de los 7 KPIs y la card de plan (≈700px de scroll en un teléfono de 360×740).
- **Acción:** Ir a registrar el peso del día o el sueño (el copy pide "registralos a diario").
- **Problema:** La acción diaria de cargar peso o sueño queda debajo del pliegue y detrás de un tab que no se ve al entrar. El estado (`useState("entreno")`), igual que `moreOpen`, `historyOpen` y `hardWindow`, se pierde al navegar a una sesión y volver, así que el usuario reabre todo cada vez. El tab no tiene `role="tablist"` ni `aria-selected` (ver global de Tabs).
- **Propuesta:** Subir los tabs justo debajo del `PageHeader` (sticky `top-0 z-10 bg-bg/90 backdrop-blur`), dejando los KPIs dentro de "Entrenamiento". Persistir `regView`/`moreOpen`/`historyOpen` en `searchParams` (`?vista=cuerpo`) o `sessionStorage` para que el back del detalle de sesión restaure el estado.
- **Severidad:** Media   ·   **Categoría:** navegación

### REG-05 · El orden de las cards "salta" cuando termina de cargar el perfil
- **Ubicación:** [page.tsx:1086](src/app/(app)/registro/page.tsx#L1086), [page.tsx:1117](src/app/(app)/registro/page.tsx#L1117)
- **Vista:** Primer render con `useHistory` resuelto pero `useTrainingProfile` aún en vuelo.
- **Acción:** Empezar a scrollear apenas aparece la pantalla.
- **Problema:** El spinner global solo espera a `useHistory`. Con `prefs` todavía `undefined`, `trainingProfile` es `null`: "Series efectivas por grupo" se renderiza abajo (rama "sin perfil") y, cuando llega el perfil hipertrofia, se muda arriba dentro de `GoalMetrics` y aparecen RirZone, Recency y Sparklines. El layout se reordena bajo el dedo (CLS) y el usuario pierde lo que estaba leyendo. Lo mismo pasa con "Logros" (`useAchievements`), que se inserta al medio más tarde.
- **Propuesta:** Incluir `prefs` en la condición de carga (`isLoading || prefsLoading`) o renderizar skeletons de altura fija (`<div className="card h-40 animate-pulse" />`) por slot hasta conocer el perfil. Reservar el lugar de "Logros".
- **Severidad:** Media   ·   **Categoría:** estados

### REG-06 · Sin objetivo elegido, la portada queda casi vacía y nada lo explica
- **Ubicación:** [GoalMetrics.tsx:95-132](src/components/GoalMetrics.tsx#L95)
- **Vista:** Usuario nuevo o sin `trainingProfile`: debajo de los tabs solo aparece "Listo para entrenar" (si hay datos), después Balance y Constancia.
- **Acción:** Encontrar métricas de progreso de fuerza (1RM, intensidad, RIR).
- **Problema:** Toda la portada depende del perfil (fuerza/hipertrofia/resistencia), pero no hay ningún indicador de qué perfil está mandando ni un CTA para elegirlo. El único acceso es el ícono `UserCog` de 32px del header, sin texto. El usuario no sabe que existe toda otra capa de métricas.
- **Propuesta:** Si `trainingProfile == null`, mostrar arriba de `GoalMetrics` una card: "Elegí tu objetivo para ver las métricas que importan" + `Button size="md"` "Elegir objetivo" → `/perfil`. Con perfil elegido, mostrar un chip chico bajo los tabs ("Objetivo: Hipertrofia · cambiar").
- **Severidad:** Media   ·   **Categoría:** estados

### REG-07 · El historial queda al fondo de un scroll muy largo y plegado
- **Ubicación:** [page.tsx:1228](src/app/(app)/registro/page.tsx#L1228)
- **Vista:** Header "Historial · N entrenos ▾", después de Balance, Constancia y el botón "Más métricas", cerrado por defecto y solo dentro del tab "Entrenamiento".
- **Acción:** Revisar o corregir la sesión de ayer (uno de los usos más frecuentes).
- **Problema:** Con perfil hipertrofia el usuario pasa 7 KPIs, el plan, "Listo para entrenar", Series por grupo, Proximidad al fallo, Días desde la última, Progresión (grilla de 12 sparklines), Logros, Balance y Constancia (más de 10 pantallas) para llegar a un toggle cerrado. El estado no persiste (REG-04). El header es un `<p className="text-sm font-medium">` sin card, y visualmente se confunde con texto suelto.
- **Propuesta:** Mostrar las últimas 3 sesiones como card "Últimos entrenos" cerca de arriba (después de los KPIs), con un link "Ver historial completo" a una sub-vista o a un tercer tab "Historial". Mantener la lista completa agrupada por mes ahí.
- **Severidad:** Media   ·   **Categoría:** jerarquía

### REG-08 · El texto de los modales "i" filtra notas internas de desarrollo
- **Ubicación:** [page.tsx:856-859](src/app/(app)/registro/page.tsx#L856), [GoalMetrics.tsx:165-169](src/components/GoalMetrics.tsx#L165)
- **Vista:** Modal de info de "Series efectivas por grupo" (≈25 líneas) y de "Listo para entrenar".
- **Acción:** Tocar "i" para entender qué es MEV/MAV/MRV o por qué se sugiere un músculo.
- **Problema:** El copy mezcla la explicación con un changelog: "Antes esta app mostraba uno por músculo con heurísticas de campo…", "Antes los pesos estaban al revés, o sea que la lista se ordenaba por la variable que menos incide", "El compuesto en sí sigue siendo una heurística de producto". El usuario no tiene contexto del "antes" y la explicación útil (qué hacer con el dato) queda enterrada bajo 4 párrafos de metodología. Siglas como MEV/MAV/MRV y e1RM aparecen en subtítulos y leyendas ("marcas MEV / MAV / MRV", "Bajo MEV", "MEV ✓") sin definición en la superficie.
- **Propuesta:** Estructurar cada info en 3 bloques: "Qué es" (1 línea), "Cómo leerlo" (qué hacer si está bajo, en rango o alto) y un `<details>` "Metodología y fuentes" con las refs. Borrar las frases "Antes…". En la leyenda, escribir la sigla completa la primera vez: "Bajo el mínimo (MEV)".
- **Severidad:** Media   ·   **Categoría:** copy

### REG-09 · Formato numérico inconsistente con es-AR y mezcla "sets"/"series"
- **Ubicación:** [format.ts:70](src/lib/format.ts#L70), [MuscleSetsBar.tsx:47](src/components/MuscleSetsBar.tsx#L47), [MuscleDonut.tsx:70](src/components/MuscleDonut.tsx#L70), [page.tsx:950](src/app/(app)/registro/page.tsx#L950), [page.tsx:1025](src/app/(app)/registro/page.tsx#L1025)
- **Vista:** Historial ("· 24.9 t"), barras ("12.5 sets"), tooltip del donut ("7.5 sets · 18%"), KPI "Promedio semanal 3.5 /sem", tooltip de volumen "24850 kg".
- **Acción:** Leer cifras.
- **Problema:** El spec pide números `es-AR` ("24.850"). `formatVolume` usa `toFixed(1)` (punto decimal), `toFixed(1).replace(/\.0$/,"")` repite el patrón en varios componentes y el tooltip de VolumeChart no separa miles. En es-AR "24.9" se lee como veinticuatro mil novecientos. La unidad salta entre "sets" (KPI, barras, donut) y "series" (historial, títulos de card) en la misma pantalla.
- **Propuesta:** Centralizar en `format.ts` un `fmtNum(n, decimals)` con `Intl.NumberFormat("es-AR", { maximumFractionDigits })` y usarlo en `formatVolume`, barras, donut, tooltips y Stat. Unificar la unidad a "series" (o "series/sem" donde aplique).
- **Severidad:** Media   ·   **Categoría:** consistencia

## Registro · Plan semanal
**Caso de uso:** El usuario define qué días se propone entrenar (base de racha y cumplimiento) y revisa en el calendario del mes qué días cumplió.

### REG-10 · La semana arranca en domingo en el plan y en lunes en el resto
- **Ubicación:** [page.tsx:77](src/app/(app)/registro/page.tsx#L77), [page.tsx:1519](src/app/(app)/registro/page.tsx#L1519), [ConsistencyHeatmap.tsx:9](src/components/ConsistencyHeatmap.tsx#L9)
- **Vista:** Fila de chips "D L M M J V S" del plan y calendario mensual (`leadingBlanks = getDay()`, domingo primero), contra el heatmap de Constancia "L M M J V S D".
- **Acción:** Tocar el día que quiere entrenar.
- **Problema:** Toda la lógica de semana (`weekStart`, racha, "semana en curso", "de acá al domingo") es lunes→domingo, pero el selector y el calendario muestran el domingo primero. En la misma pantalla el usuario ve dos órdenes distintos y el calendario parte visualmente la semana de la racha. Las etiquetas "M" y "M" (martes/miércoles) son ambiguas y los botones no tienen `aria-label` ni `aria-pressed`: un lector de pantalla anuncia "M, botón" dos veces.
- **Propuesta:** Reordenar `WEEKDAYS` a lunes primero (`[1,2,3,4,5,6,0]` mapeado a "L M X J V S D", con "X" para miércoles) y `leadingBlanks = (getDay() + 6) % 7`. Agregar `aria-label="Martes"` y `aria-pressed={active}` a cada chip.
- **Severidad:** Media   ·   **Categoría:** consistencia

### REG-11 · El calendario de cumplimiento codifica el estado solo con color y no tiene leyenda
- **Ubicación:** [page.tsx:1554-1590](src/app/(app)/registro/page.tsx#L1554)
- **Vista:** Plan semanal expandido: celdas `bg-success/20`, `bg-danger/20`, `ring-1 ring-success/50`, `ring-1 ring-primary/40` o `bg-surface-2`.
- **Acción:** Entender qué días falló o cumplió y qué significa cada estilo.
- **Problema:** Hay 5 estados (cumplido, fallado, entrenado sin plan, planeado futuro, sin plan) sin leyenda y sin texto. El único diferencial entre cumplido y fallado es el tono (en oscuro celeste `#38bdf8` contra rojo; en claro teal contra rojo rosado, al 20% de opacidad). Las celdas no tienen `aria-label`, así que para un lector de pantalla son solo números. Tampoco se indica que tocar una celda de semanas futuras edita el plan.
- **Propuesta:** Agregar debajo una leyenda (`text-xs text-muted`, chips de 10px): "Cumplido · Faltó · Extra · Planeado". Sumar un glifo redundante (✓ / ✕ chicos bajo el número, `size-2.5`) y `aria-label={\`${day}: ${estado}\`}`. Agregar un hint "Tocá un día de las próximas semanas para ajustar solo esa semana".
- **Severidad:** Media   ·   **Categoría:** accesibilidad

### REG-12 · Modal de confirmación en cada toque del plan, con tono culposo
- **Ubicación:** [page.tsx:1054](src/app/(app)/registro/page.tsx#L1054), [page.tsx:1372](src/app/(app)/registro/page.tsx#L1372)
- **Vista:** Bottom sheet "Solo te mentís a vos" cada vez que toca un chip de la semana actual.
- **Acción:** Armar su plan (ej. marcar 4 días seguidos).
- **Problema:** `onToggleToday` siempre pasa por `setPendingToggle`, también al agregar días y en el primer uso, cuando el plan está vacío. Armar un plan de 4 días son 8 toques y 4 modales. El título juzga al usuario aunque esté subiendo la meta. El confirm solo tiene sentido al bajar la exigencia de una semana ya empezada.
- **Propuesta:** Pedir confirmación solo cuando se **quita** un día de la semana en curso y el plan no estaba vacío. Para el resto, aplicar directo y dar feedback inline ("Plan: 4 días ✓"). Cambiar el título a algo neutro: "¿Cambiar la meta de esta semana?".
- **Severidad:** Baja   ·   **Categoría:** feedback

## Registro · Cards de métricas (Entrenamiento)
**Caso de uso:** El usuario revisa semanalmente su volumen efectivo, balance y constancia para decidir qué ajustar en su rutina.

### REG-13 · "Balance de patrones": empuje y tirón con dos dorados casi iguales; "aislamiento" invisible
- **Ubicación:** [PatternBalance.tsx:82](src/components/PatternBalance.tsx#L82), [PatternBalance.tsx:92](src/components/PatternBalance.tsx#L92), [chart-theme.ts:35](src/lib/chart-theme.ts#L35)
- **Vista:** Barra dividida Empuje/Tirón (`c.accent` `#e8c468` contra `c.primary` `#cda548`) y Compuesto/Aislamiento (`c.accent` contra `c.neutral`).
- **Acción:** Ver dónde termina empuje y empieza tirón.
- **Problema:** En el tema oscuro los dos dorados tienen un contraste de **1,38:1** entre sí y la división no se percibe, menos con daltonismo. `neutral` (`#3a3833`) sobre la pista `surface-2` (`#1c1c1a`) da 1,46:1, y en el tema claro `#d9c3bf` sobre `#f3e0da` da ≈1,2:1: el segmento "Aislamiento" se confunde con la parte vacía de la barra. Los labels de texto repiten el problema (`text-accent` contra `text-primary`).
- **Propuesta:** Usar dos colores de familias distintas por token (ej. `c.series[0]` dorado y `c.series[1]` azul `#7bb0d1`), separar segmentos con un gap de 2px (`gap-0.5` en el flex) y dar al neutral un valor con ≥3:1 contra `surface-2` (oscuro ≈`#6b6860`, claro ≈`#b79a95`). Los labels en `text-fg` con un cuadradito de color al lado, en vez de texto coloreado.
- **Severidad:** Alta   ·   **Categoría:** dataviz

### REG-14 · Copy ambiguo e incorrecto en el veredicto del balance
- **Ubicación:** [PatternBalance.tsx:19-24](src/components/PatternBalance.tsx#L19)
- **Vista:** Texto central de la barra: "equilibrado", "sesgo al primero", "sesgo al segundo" o "sin datos".
- **Acción:** Entender si está desbalanceado y hacia qué lado.
- **Problema:** "sesgo al primero/segundo" obliga a mapear mentalmente izquierda/derecha. Si uno de los lados es 0 (ej. 100% empuje, 0% tirón, el peor desbalance posible) la función devuelve **"sin datos"**, justo cuando la alerta es más necesaria. Encima, en 360px los tres textos `text-[11.5px]` en un `justify-between` ("Compuesto 78%", "sesgo al primero", "Aislamiento 22%") se pegan o se parten.
- **Propuesta:** Devolver texto explícito: "Más empuje que tirón (×1,8)" / "Equilibrado" / "Sin tirón registrado". Moverlo a una línea propia debajo de la barra (`text-xs text-muted mt-1`), dejando arriba solo los dos labels.
- **Severidad:** Media   ·   **Categoría:** copy

### REG-15 · "Series efectivas por grupo": marcas sin rotular, header apretado y empty state con ventana equivocada
- **Ubicación:** [MuscleSetsBar.tsx:55](src/components/MuscleSetsBar.tsx#L55), [MuscleSetsBar.tsx:32](src/components/MuscleSetsBar.tsx#L32), [MuscleSetsBar.tsx:77](src/components/MuscleSetsBar.tsx#L77), [page.tsx:816](src/app/(app)/registro/page.tsx#L816)
- **Vista:** Barras `h-2.5` con tres ticks `w-px bg-fg/40` y leyenda "Bajo MEV / Óptimo / Sobre MRV" en `text-[10.5px]`. En el header, `Tabs` "7 días / 30 días" en `w-28`.
- **Acción:** Saber cuántas series le faltan para el mínimo de cada músculo.
- **Problema:** Los tres ticks son idénticos (1px, 40% de opacidad sobre una barra de 10px) y no se sabe cuál es MEV, MAV o MRV sin abrir el modal. Tampoco se muestra el número objetivo ("12 de 10"). El header pone el título `text-sm` y un subtítulo de ~60 caracteres al lado de un segmented de 112px: en 360px quedan ≈176px para el texto, el subtítulo ocupa 3 líneas y cada opción de tab mide ≈50px de ancho por ≈32px de alto (ver global). Con la ventana "7 días" y sin datos, el empty dice "en los últimos **30** días".
- **Propuesta:** Rotular las marcas una sola vez, arriba de la primera barra (`text-[11px] text-muted` "MEV 10 · MAV 16 · MRV 20" posicionado con el mismo `left`), o mostrar el valor a la derecha como "12 / 10 mín.". Mover los Tabs a una fila propia bajo el subtítulo (`w-full`) y acortar el subtítulo a "Series/semana · últimos 7 días". Interpolar la ventana en el empty state.
- **Severidad:** Media   ·   **Categoría:** dataviz

### REG-16 · Heatmap de Constancia: tooltip con unidad equivocada, inaccesible en touch y sin escala
- **Ubicación:** [ConsistencyHeatmap.tsx:41](src/components/ConsistencyHeatmap.tsx#L41)
- **Vista:** Grilla 12×7 de celdas ≈20px, etiquetas de día en `text-[9px]`.
- **Acción:** Ver qué día fue cada celda y cuánto entrenó.
- **Problema:** El `title` dice `"2025-10-14 · 18 kg"`, pero desde el cambio a series el valor es un **conteo de series**, no kg, así que muestra un dato falso. Además `title` no se dispara con touch en mobile, por lo que no hay forma de consultar una celda. No hay leyenda "menos → más" ni etiquetas de mes en el eje de semanas, y no se puede ubicar en el tiempo ninguna columna. Las etiquetas de 9px quedan por debajo del mínimo legible. No hay alternativa textual (`role="img"`/`aria-label`) para el gráfico.
- **Propuesta:** Corregir la unidad a "series". Hacer las celdas tocables (`button`) que muestren abajo un caption "Mar 14 oct · 18 series". Agregar una fila superior con el mes (`text-[11px]`) donde cambia y una leyenda de 5 cuadraditos "Menos ▢▢▢▢▢ Más". Envolver con `role="img" aria-label="Entrenaste 31 de los últimos 84 días"`. Subir los labels de día a `text-[11px]` mostrando solo L/X/V para que entren.
- **Severidad:** Media   ·   **Categoría:** dataviz

### REG-17 · Gráficos multi-línea sin leyenda (1RM de fuerza, circunferencias)
- **Ubicación:** [charts.tsx:110-150](src/components/charts.tsx#L110), [GoalMetrics.tsx:233](src/components/GoalMetrics.tsx#L233), [BodyProgress.tsx:207](src/components/BodyProgress.tsx#L207)
- **Vista:** "1RM estimado" (perfil fuerza, hasta 4 ejercicios) y "Circunferencias" (Brazo, Pecho, Cintura, Muslo), con 4 líneas de colores en 190px de alto.
- **Acción:** Saber qué línea es qué ejercicio o medida.
- **Problema:** `MultiLine` no renderiza leyenda: la única forma de identificar una serie es tocar y leer el tooltip, que en touch tapa el gráfico. En "1RM" solo se nombra el ejercicio top ("Sentadilla: +3%"). En Circunferencias, brazo (≈35cm) y pecho (≈100cm) comparten el eje Y y las variaciones de 1cm quedan planas. Los 4 colores (`#cda548 #7bb0d1 #8fbf7b #d19a6f`) se diferencian solo por tono: dorado contra naranja y verde contra azul se confunden con deuteranopía.
- **Propuesta:** Agregar una leyenda HTML debajo (chip de color + nombre + último valor + delta, `text-xs`, `grid grid-cols-2`) y que tocar un ítem resalte su línea (`strokeOpacity` 0.25 en las demás). Para Circunferencias, usar small multiples (una `MiniLine` de 80px por medida, `grid-cols-2`) o un selector de medida. Agregar un `strokeDasharray` distinto por serie como codificación redundante.
- **Severidad:** Alta   ·   **Categoría:** dataviz

### REG-18 · Las series semanales se ordenan mal al cruzar el año
- **Ubicación:** [charts.tsx:81-84](src/components/charts.tsx#L81)
- **Vista:** "1RM estimado" (MultiLine) y "Circunferencias" durante enero–marzo.
- **Acción:** Ver la tendencia de las últimas 12 semanas.
- **Problema:** `labelKey` ordena por `mes*100 + día` a partir de la etiqueta "d/m", sin año. Una serie que va de noviembre a enero pone "6/1" antes que "17/11" y la línea zigzaguea hacia atrás: el gráfico muestra un progreso falso durante un cuarto del año. En Circunferencias, mediciones de años distintos con el mismo d/m se fusionan en un solo punto.
- **Propuesta:** Pasar a `MultiLine` puntos con timestamp (`t: number`) y ordenar/alinear por `t`. Formatear la etiqueta solo en `XAxis tickFormatter`, agregando el año cuando el rango lo cruza ("dic 25 / ene 26").
- **Severidad:** Media   ·   **Categoría:** dataviz

### REG-19 · VolumeChart: ticks del eje Y redondeados que se repiten y no hay estado vacío
- **Ubicación:** [VolumeChart.tsx:43](src/components/VolumeChart.tsx#L43), [VolumeChart.tsx:48](src/components/VolumeChart.tsx#L48)
- **Vista:** "Volumen (tonelaje)" en "Más métricas", 10 semanas con labels "dd/mm".
- **Acción:** Comparar volumen semanal.
- **Problema:** `tickFormatter` hace `Math.round(v/1000)+"k"`: con un rango de 0–2.500 los ticks 500/1000/1500/2000/2500 salen "500, 1k, 2k, 2k, 3k" (duplicados y engañosos). "k" no es la unidad que usa el resto de la app ("t"). Un usuario nuevo ve un área plana en 0 durante 9 de las 10 semanas, sin ningún mensaje. En la vista "Anual" con un solo mes queda un único punto sin línea.
- **Propuesta:** Usar `formatVolume` o `Intl.NumberFormat("es-AR",{notation:"compact"})` en los ticks y `allowDecimals={false}`. Si hay menos de 2 períodos con datos, mostrar en su lugar "Necesitás al menos 2 semanas de entrenos para ver la tendencia". Tooltip con `fmtNum` (REG-09).
- **Severidad:** Baja   ·   **Categoría:** dataviz

### REG-20 · El donut de músculos usa una paleta fija de modo oscuro también en el tema claro
- **Ubicación:** [MuscleDonut.tsx:14-23](src/components/MuscleDonut.tsx#L14)
- **Vista:** Donut "Músculos entrenados" en el tema claro "girly".
- **Acción:** Distinguir porciones y matchearlas con la leyenda.
- **Problema:** `COLORS` y `OTHER_COLOR` están hardcodeados ("columna Dark" según el propio comentario) y no pasan por `useChartColors`, lo que contradice la regla del handoff de resolver los colores por tema. Sobre la superficie crema `#fdf6f0`, el amarillo `#c98500` da 2,87:1 y el aqua `#199e70` 3,18:1, en el límite del 3:1 que piden los elementos gráficos. Los marcadores de la leyenda son de `size-2.5` (10px). El `Tooltip` no recibe `labelStyle`/`itemStyle` del tema.
- **Propuesta:** Agregar `categorical: string[]` y `other` a `ChartColors` con una variante validada para fondo claro y consumirla en `MuscleDonut`. Subir los marcadores a `size-3` y mostrar en la leyenda también el valor ("Pecho 12 series · 24%").
- **Severidad:** Media   ·   **Categoría:** contraste

### REG-21 · Chips de estado en ámbar y teal sin contraste suficiente en el tema claro
- **Ubicación:** [GoalMetrics.tsx:460-468](src/components/GoalMetrics.tsx#L460), [GoalMetrics.tsx:362-366](src/components/GoalMetrics.tsx#L362), [page.tsx:996](src/app/(app)/registro/page.tsx#L996)
- **Vista:** Chips "Pecho · 3d" de "Días desde la última sesión", chips de "Proximidad al fallo" y valor de "Racha" en `text-warning`.
- **Acción:** Leer los chips de un vistazo.
- **Problema:** En el tema claro `text-warning` (`#cf8a3c`) sobre `bg-warning/15` y crema da ≈2,6:1, y `text-success` (`#4a9db0`) ≈2,9:1, los dos con `text-xs` (necesitan 4,5:1). La racha en `text-xl font-bold text-warning` tampoco llega al 3:1 de texto grande. Además el significado (verde ≤2d, ámbar ≤4d, rojo ≥5d) es solo cromático y no hay leyenda.
- **Propuesta:** Para texto sobre fondos tintados en el tema claro, usar variantes oscurecidas del token (`--color-warning-fg: #8f5a1c`, `--color-success-fg: #2c6c7b`) o `text-fg` con un punto de color (`size-2 rounded-full bg-warning`) delante del label. Agregar una línea de leyenda "Verde: ≤2 días · Ámbar: 3–4 · Rojo: 5+".
- **Severidad:** Media   ·   **Categoría:** contraste

### REG-22 · "Listo para entrenar": barra sin valor, "hace 0d" y "MEV ✓" críptico
- **Ubicación:** [GoalMetrics.tsx:177-193](src/components/GoalMetrics.tsx#L177)
- **Vista:** Top 3 músculos con "hace Nd" y una barra `w-24 h-2 bg-primary` o el texto "MEV ✓".
- **Acción:** Decidir qué entrenar hoy.
- **Problema:** La barra representa el "rezago de volumen" pero no tiene label ni valor visible: el porcentaje solo está en un `title` (inaccesible en touch). No se entiende si más barra es mejor o peor. "hace 0d" se muestra si lo entrenó hoy, y "d" es una abreviatura que no se usa en el resto de la app. "MEV ✓" es sigla más glifo, contra la regla de "íconos lucide, sin emoji".
- **Propuesta:** Reemplazar la barra por texto accionable: "Faltan 6 series para el mínimo" / "Mínimo cubierto" (con ícono `Check` de lucide). Formatear la recencia como "hoy", "ayer" o "hace 3 días".
- **Severidad:** Baja   ·   **Categoría:** copy

## Registro · Cuerpo (peso, sueño, medidas)
**Caso de uso:** El usuario registra a diario su peso y horas de sueño y sigue la tendencia de composición corporal.

### REG-23 · El color de la tasa de peso juzga "bueno/malo" sin mirar el objetivo
- **Ubicación:** [BodyProgress.tsx:62-70](src/components/BodyProgress.tsx#L62)
- **Vista:** "82,4 kg **+0,3%/sem**" en rojo (`text-danger`) cuando el peso sube y en verde cuando baja.
- **Acción:** Saber si va bien.
- **Problema:** Subir de peso pinta `text-danger` siempre, también para alguien con objetivo hipertrofia en volumen, que lo busca. El copy del tab dice "igual para todos los objetivos", pero la semántica del color no lo es. También usa "+" en vez de flecha (spec: flecha + %).
- **Propuesta:** Mostrar la tasa en `text-fg` neutro con `DeltaChip`-like de flecha, o colorear según el objetivo (hipertrofia: +0,25–0,5%/sem = success; pérdida de grasa: −0,5–1% = success). Agregar un caption "Ritmo recomendado para tu objetivo: …".
- **Severidad:** Media   ·   **Categoría:** dataviz

### REG-24 · Inputs de peso y sueño solo con placeholder y sin feedback
- **Ubicación:** [BodyProgress.tsx:86-111](src/components/BodyProgress.tsx#L86), [BodyProgress.tsx:164-186](src/components/BodyProgress.tsx#L164)
- **Vista:** `input` `h-9` con placeholder "Peso hoy (kg)" / "Horas anoche" + `Button size="sm"` "Registrar".
- **Acción:** Cargar el peso de hoy.
- **Problema:** No hay `<label>` ni `aria-label`: al tipear, el placeholder desaparece y no queda contexto. El input mide 36px y el botón 32px (ver global). Sueño no valida rango (acepta "0" o "30"). Al registrar se limpia el input sin confirmar (ni toast ni "Registrado hoy: 82,4 kg") y si la mutación falla no se muestra error: el usuario cree que guardó. No se informa si ya cargó hoy (¿sobrescribe?).
- **Propuesta:** Usar un `<label className="sr-only">` o un label visible `text-xs`, `h-11` en input y botón (`size="md"`), validar sueño en 0–16 h y mostrar `log.isError` en `text-xs text-danger`. Tras el éxito, reemplazar el input por "Hoy: 82,4 kg · editar".
- **Severidad:** Media   ·   **Categoría:** formulario

### REG-25 · Barras de sueño sin eje de fechas ni valores
- **Ubicación:** [BodyProgress.tsx:142-159](src/components/BodyProgress.tsx#L142)
- **Vista:** 14 barras `bg-primary/70` en `h-28` con una línea punteada de 7 h.
- **Acción:** Ver qué noche durmió poco.
- **Problema:** No hay etiquetas de día ni de valor, la línea de 7 h no está rotulada y los valores solo están en `title` (no funciona en touch). Las noches sin registro no se distinguen de 0 h. No hay alternativa textual.
- **Propuesta:** Agregar debajo labels de día (`text-[11px]`, solo L/X/V o cada 2 días), un label "7 h" al costado de la línea punteada, y pintar en `bg-warning` las barras < 7 h. Para días sin dato, un placeholder punteado (`border border-dashed`). Agregar `role="img" aria-label="Promedio 6,8 h; 4 noches bajo 7 h"`.
- **Severidad:** Baja   ·   **Categoría:** dataviz

## Registro · Historial y exportación
**Caso de uso:** El usuario busca una sesión pasada para revisarla o borrarla, o exporta sus datos a Excel para analizarlos (con una IA).

### REG-26 · Botón de borrar anidado dentro del link de la fila, con target de 32px
- **Ubicación:** [page.tsx:1255-1279](src/app/(app)/registro/page.tsx#L1255)
- **Vista:** Fila de historial: `Link.card` que contiene un `<button className="size-8">` con `Trash2` y un chevron.
- **Acción:** Abrir la sesión o borrarla.
- **Problema:** Un `<button>` dentro de un `<a>` es HTML inválido (contenido interactivo anidado): los lectores de pantalla anuncian el link con el botón adentro y el foco por teclado es confuso. El tacho de 32px queda pegado al chevron y al área tocable del link, y es fácil abrir el borrado cuando se quería entrar (o al revés). Hay confirmación, pero tocar mal es frecuente. El metadato `text-[11px]` encadena 4 datos ("14 oct · 18 series · 4.2 t · 52:10"), donde "52:10" se puede leer como hora.
- **Propuesta:** Sacar el borrado de la fila: moverlo al detalle de la sesión (`/entrenar/[id]`) o a un menú `MoreVertical` de 44px fuera del `<Link>` (fila como `div` con `Link` + botón hermanos). Formatear la duración como "52 min".
- **Severidad:** Media   ·   **Categoría:** accesibilidad

### REG-27 · Borrar una sesión que falla no muestra nada y el éxito tampoco confirma
- **Ubicación:** [page.tsx:1327-1330](src/app/(app)/registro/page.tsx#L1327)
- **Vista:** Modal "Eliminar entrenamiento" → botón "Eliminar".
- **Acción:** Confirmar el borrado.
- **Problema:** `await deleteSession.mutateAsync(...)` no tiene `try/catch`: si Supabase devuelve error, la promesa rechaza, `setPendingDelete(null)` no se ejecuta, el modal queda abierto con el spinner apagado y sin ningún mensaje (unhandled rejection). En el éxito la fila desaparece sin toast ni opción de deshacer.
- **Propuesta:** Envolver en `try/catch`, mostrar `deleteSession.isError` dentro del modal (`text-xs text-danger` "No se pudo eliminar. Probá de nuevo.") y cerrar solo en el éxito. Agregar un toast "Entrenamiento eliminado".
- **Severidad:** Media   ·   **Categoría:** feedback

### REG-28 · Exportar Excel no da feedback de progreso, error ni rango vacío
- **Ubicación:** [page.tsx:607-620](src/app/(app)/registro/page.tsx#L607), [page.tsx:1449-1461](src/app/(app)/registro/page.tsx#L1449)
- **Vista:** Bottom sheet "Exportar Excel" con 4 presets y un rango personalizado con dos `input type="date"`.
- **Acción:** Tocar "Últimos 7 días" para descargar.
- **Problema:** `setExportOpen(false)` cierra el sheet **antes** de generar el archivo y el error solo va a `console.error`: si falla (o tarda por el import dinámico del xlsx) el usuario no ve nada. Un rango sin sesiones descarga igual un Excel vacío sin avisar. Los inputs de fecha no tienen `<label>`/`aria-label` (solo el texto "a" entre ellos), miden `h-9` y no se valida que "desde" sea ≤ "hasta". El ícono de exportar en el header es solo `Download` en un `Button sm` (ver global), sin texto.
- **Propuesta:** Mantener el sheet abierto con `loading` en el preset tocado y cerrar al completar con un toast "Descargado wolf-7d.xlsx (12 sesiones)". Mostrar el error inline. Deshabilitar el preset o avisar "No hay sesiones en este período" si `sessions.length === 0`. Agregar labels "Desde"/"Hasta", `h-11`, `max={to}` / `min={from}`.
- **Severidad:** Media   ·   **Categoría:** feedback

---

# 5. Social, ranking y perfil

## Navegación transversal: cómo se llega a Perfil, Amigos y Ajustes
**Caso de uso:** El usuario quiere invitar a un amigo, editar su perfil, cambiar el tema, gestionar notificaciones o cerrar sesión. Ninguna de esas pantallas está en la TabBar (Rutinas, Registro, Ranking).

### SOC-01 · Ajustes fragmentados en tres pantallas y escondidos detrás de íconos
- **Ubicación:** [FriendsPanel.tsx:105](src/components/FriendsPanel.tsx#L105), [scoreboard/page.tsx:165](src/app/(app)/scoreboard/page.tsx#L165), [registro/page.tsx:903](src/app/(app)/registro/page.tsx#L903), [perfil/page.tsx:211](src/app/(app)/perfil/page.tsx#L211)
- **Vista:** Perfil solo es accesible por (a) un ícono `UserCog` ghost `size="sm"` (32px, ver global) en el header de Registro, (b) el botón "Mi perfil" dentro del modal Amigos, que se abre con un ícono `Users` sin texto de `size-9` (36px) en el header de Ranking, o (c) tocando tu propia fila del ranking. El tema está en Perfil, las notificaciones en el header de Ranking y "Salir" en el modal de Amigos.
- **Acción:** Buscar "Cerrar sesión" o "Notificaciones" donde esperaría encontrarlos: en Perfil.
- **Problema:** Perfil no tiene ni logout ni notificaciones, y Amigos (la función social central) es un ícono sin texto de 36px. Buscar el logout lleva a Ranking → ícono Users → modal → abajo de la lista. El handoff (`Entreno.dc.html`, Perfil) muestra lo contrario: una fila "Ranking y amigos" y una fila "Notificaciones · Activas" dentro de Perfil, y Perfil en la nav. Así, las funciones solo se descubren si el usuario ya sabe que existen.
- **Propuesta:** Convertir Perfil en el hub de cuenta, con secciones "Cuenta" (datos), "Social" (fila `Amigos` → panel, con contador), "Preferencias" (Apariencia, Notificaciones) y "Sesión" (Cerrar sesión, `variant="danger"` ghost, al final). Sacar "Salir" de `FriendsPanel`. En Ranking, reemplazar el ícono Users por un botón con texto (`<Users/> Amigos (n)`, `h-11`). Evaluar sumar Perfil a la TabBar o poner un avatar en el header de todas las tabs.
- **Severidad:** Alta   ·   **Categoría:** navegación

### SOC-02 · Botón "volver" sin etiqueta, diminuto y con destino fijo a /scoreboard
- **Ubicación:** [amigos/[id]/page.tsx:111](src/app/(app)/amigos/[id]/page.tsx#L111), [perfil/page.tsx:113](src/app/(app)/perfil/page.tsx#L113), [perfil/page.tsx:99](src/app/(app)/perfil/page.tsx#L99)
- **Vista:** Flecha `ArrowLeft size-5` dentro de un `<button>` sin padding ni `aria-label` (área de toque de unos 20×20px). El header usa `h1 text-xl` en vez del `PageHeader` (`text-2xl`) del resto.
- **Acción:** Volver a la pantalla anterior, o guardar el perfil.
- **Problema:** (1) El área de toque es la mitad del mínimo de 44px y el lector de pantalla anuncia solo "botón". (2) `router.push("/scoreboard")` ignora el origen: si llegaste a Perfil desde Registro, "volver" te manda a Ranking. Además, `push` reinicia los filtros de Ranking (son `useState` locales: tablero, período y ejercicio elegido se pierden). (3) "Guardar" en Perfil también redirige a /scoreboard sin feedback de éxito.
- **Propuesta:** Un `BackHeader` compartido con `<button aria-label="Volver" className="size-11 -ml-2 grid place-items-center rounded-md">` que use `router.back()`, con fallback a `/scoreboard` si `history.length <= 1`. Mismo tamaño de título que `PageHeader`. Después de guardar, quedarse en Perfil y mostrar "Guardado ✓" en el botón (como hace `MeasurementsForm`). Persistir los filtros del ranking en la URL (`?board=&period=&ex=`).
- **Severidad:** Media   ·   **Categoría:** navegación

## Ranking (`/scoreboard`)
**Caso de uso:** Tab principal social. El usuario entra a ver en qué puesto está esta semana frente a sus amigos y si subió o bajó.

### SOC-03 · Hasta cinco filas de controles antes del primer resultado
- **Ubicación:** [scoreboard/page.tsx:192-282](src/app/(app)/scoreboard/page.tsx#L192)
- **Vista:** Header (título, subtítulo y 2 botones) → tarjeta "Tu puesto" → Tabs de tablero con scroll (5 opciones) → Tabs de período + botón filtros → panel de filtros (Tabs de sexo + toggle de objetivo) → en 1RM, fila de ejercicio + Tabs `kg/÷peso` → caption.
- **Acción:** Mirar el ranking.
- **Problema:** En 1RM con los filtros abiertos hay unos 6 grupos de controles apilados (aprox. 330px) y en un teléfono de 640px de alto la primera fila queda por debajo de la mitad de la pantalla. Además, "Fuerza rel." y "1RM ÷peso" son casi el mismo concepto con dos controles distintos. Los tabs de tablero usan `overflow-x-auto no-scrollbar` y no indican que hay más opciones: con el prefijo "★", "Reps" puede quedar cortado a 360px. Cuando el panel está cerrado, nada resume qué filtros están activos (solo se tiñe el ícono).
- **Propuesta:** Dejar visibles solo tablero y período. Pasar sexo, "mi objetivo" y `kg/÷peso` a un bottom sheet "Filtros" que se abre con un botón con badge de cantidad ("Filtros · 2"), y mostrar los filtros activos como chips descartables debajo de los tabs. Unificar "Fuerza rel." con el modo ÷peso de 1RM. Agregar un fade-mask a la derecha del scroll de tabs (`mask-image: linear-gradient(...)`).
- **Severidad:** Alta   ·   **Categoría:** jerarquía

### SOC-04 · Sin amigos, el ranking te muestra primero con medalla de oro y sin invitación a invitar
- **Ubicación:** [scoreboard/page.tsx:296-305](src/app/(app)/scoreboard/page.tsx#L296)
- **Vista:** El usuario nuevo sin amigos que entrenó ve una lista de una sola fila: "Vos", con `Medal text-accent` y borde `ring-accent/40`. El empty state ("Sumá amigos y entrená…") solo aparece si `rows` está vacío, es decir, si ni siquiera vos tenés datos, y no trae botón.
- **Acción:** Entender para qué sirve la pantalla y cómo sumar amigos.
- **Problema:** El estado "sin amigos" no está contemplado: se ve una competencia de uno contra nadie y el único camino para invitar es el ícono Users de 36px del header (SOC-01). Es el momento de mayor abandono de la función social.
- **Propuesta:** Si `friends.length === 0`, mostrar arriba de la lista (o en su lugar) una tarjeta CTA: "Invitá a tus amigos para competir" con `<Button className="w-full"><UserPlus/> Invitar amigo</Button>` que dispare el flujo de invitación directamente. Pasar el mismo `action` al `EmptyState` de "Sin datos todavía".
- **Severidad:** Alta   ·   **Categoría:** estados

### SOC-05 · Tu fila apenas se destaca y la tarjeta "Tu puesto" no da contexto
- **Ubicación:** [scoreboard/page.tsx:178-189](src/app/(app)/scoreboard/page.tsx#L178), [scoreboard/page.tsx:318](src/app/(app)/scoreboard/page.tsx#L318)
- **Vista:** Tu fila solo cambia con `bg-primary/5` (un 5% de dorado, casi invisible en el tema oscuro y en el claro). La tarjeta "Tu puesto" muestra `3º` y una abreviatura "Hip", sin total, sin valor y sin distancia al siguiente. Si tu valor es 0, la tarjeta desaparece sin explicación.
- **Acción:** Encontrarse rápido en la lista y saber cuánto falta para subir.
- **Problema:** El handoff pide `border rgba(205,165,72,.4)`, avatar dorado y nombre y valor en `gold` para la fila propia. Acá cuesta ubicarse con más de 6 filas. "Tu puesto" ocupa una tarjeta entera para un solo número sin información útil.
- **Propuesta:** En la fila propia, aplicar `ring-1 ring-primary/40 bg-primary/10` y `text-primary` en nombre y valor. En la tarjeta, mostrar "3º de 8 · 12 sets · a 2 sets de Meli". Con valor 0: "Todavía no sumaste esta semana. Entrená para entrar al ranking".
- **Severidad:** Media   ·   **Categoría:** jerarquía

### SOC-06 · Empates: puestos y medallas distintos para el mismo valor
- **Ubicación:** [scoreboard/page.tsx:146](src/app/(app)/scoreboard/page.tsx#L146), [scoreboard/page.tsx:322-334](src/app/(app)/scoreboard/page.tsx#L322)
- **Vista:** El puesto y la medalla salen del índice del array (`i < 3`, `myIndex + 1`). Dos usuarios con "3 días" en Constancia (la métrica de enteros, donde los empates son lo normal) reciben oro y plata.
- **Acción:** Comparar el puesto con un amigo que entrenó lo mismo.
- **Problema:** Un orden arbitrario (el de la RPC) se presenta como resultado y el movimiento ▲▼ también se calcula por índice, así que hay subidas y bajadas falsas entre empatados. Eso genera sensación de injusticia en una función competitiva.
- **Propuesta:** Calcular el puesto como "competition ranking" (1, 1, 3): `rank = rows.findIndex(r => r.value === row.value) + 1`. Usar `rank` para la medalla, para "Tu puesto" y para `move` en `useScoreboard`. Mostrar "=" o "Empate" en "Tu puesto" cuando corresponda.
- **Severidad:** Media   ·   **Categoría:** jerarquía

### SOC-07 · Fila sobrecargada, sin avatar y con columnas desalineadas
- **Ubicación:** [scoreboard/page.tsx:321-351](src/app/(app)/scoreboard/page.tsx#L321), [scoreboard/page.tsx:374-378](src/app/(app)/scoreboard/page.tsx#L374)
- **Vista:** Fila `p-3.5 gap-3` con puesto (`w-7`), nombre, badge de objetivo `text-[10px]` ("Fue", "Hip", "Res", "Grasa"), `MoveChip` (`w-7`), valor y chevron.
- **Acción:** Leer de un vistazo quién va dónde.
- **Problema:** (1) `MoveChip` no se renderiza cuando `move == null` (sin actividad previa), pero sí cuando es 0 ("—"), así que la columna de valores queda corrida entre filas. (2) Las abreviaturas de objetivo son crípticas y el texto de 10px ilegible (ver global). (3) No hay avatar, cuando `FriendsPanel` usa `size-10` con inicial y el handoff pide un avatar de 34px: dos representaciones de la misma persona. (4) La plata usa `text-muted`, el mismo color que los números de puesto normales, y el bronce usa `text-amber-700` fuera de los tokens.
- **Propuesta:** Reservar siempre el slot del delta (`<span className="w-7 shrink-0"/>` vacío). Ordenar como en el handoff: puesto, delta, avatar `size-8`, nombre (con el objetivo como subtítulo `text-xs text-muted` completo: "Hipertrofia") y valor. Agregar tokens `--color-medal-silver` y `--color-medal-bronze` para ambos temas.
- **Severidad:** Media   ·   **Categoría:** consistencia

### SOC-08 · El movimiento ▲▼ solo se comunica por color y `title`
- **Ubicación:** [scoreboard/page.tsx:382-391](src/app/(app)/scoreboard/page.tsx#L382), [scoreboard/page.tsx:162](src/app/(app)/scoreboard/page.tsx#L162)
- **Vista:** Chip verde o rojo con flecha y número. La explicación está en `title` y en el subtítulo "▲▼ vs el período anterior".
- **Acción:** Entender qué significa "▲2".
- **Problema:** `title` no existe en táctil ni lo leen bien los lectores de pantalla (lucide marca el SVG `aria-hidden`, así que se anuncia solo "2"). La leyenda con símbolos en el subtítulo del header es ruido visual y hace que el subtítulo se parta en 2-3 líneas junto a los dos botones de acción.
- **Propuesta:** `aria-label={up ? \`Subió ${move} puestos\` : \`Bajó ${n} puestos\`}` en el chip y `<span className="sr-only">`. Subtítulo: "Competí con tus amigos". Mover la leyenda al caption de abajo: "▲▼ = puestos vs la semana pasada".
- **Severidad:** Baja   ·   **Categoría:** accesibilidad

### SOC-09 · Toggle "Solo mi objetivo" sin semántica de switch
- **Ubicación:** [scoreboard/page.tsx:237-252](src/app/(app)/scoreboard/page.tsx#L237), [scoreboard/page.tsx:212-223](src/app/(app)/scoreboard/page.tsx#L212)
- **Vista:** Un `<button>` con una pastilla "On/Off" `text-xs` y la etiqueta "Solo mi objetivo (Hip)". El botón de filtros es un ícono `size-9` sin `aria-expanded`.
- **Acción:** Activar el filtro y saber si quedó activo.
- **Problema:** Sin `role="switch"` ni `aria-checked`, el estado no se anuncia. La pastilla "On/Off" en inglés rompe con el copy en español. El botón de filtros no informa si el panel está abierto. Los Tabs (sexo, período, tema) tampoco exponen el seleccionado (`aria-pressed` o `role="radio"`), algo que en esta pantalla afecta a 4 grupos.
- **Propuesta:** Un componente `Switch` en `ui.tsx` (`role="switch" aria-checked`, pista `w-11 h-6` con thumb) y la fila entera `min-h-11`. `aria-expanded={filtersOpen}` en el botón de filtros. En `Tabs`: `role="radiogroup"` con `role="radio" aria-checked` por opción.
- **Severidad:** Media   ·   **Categoría:** accesibilidad

### SOC-10 · Estado de error sin explicación ni reintento, y spinner que hace saltar el layout
- **Ubicación:** [scoreboard/page.tsx:290-295](src/app/(app)/scoreboard/page.tsx#L290), [loading.tsx:4-8](src/app/(app)/loading.tsx#L4)
- **Vista:** Error: `EmptyState title="No se pudo cargar el ranking"`, sin descripción ni botón. Carga: `Spinner` centrado en `py-16` cada vez que cambiás tablero, período o filtro (cada combinación es una query nueva). `loading.tsx` es un spinner genérico `py-24` para todas las rutas.
- **Acción:** Cambiar entre "Semana" y "Mes", o recuperarse de un corte de red en el gimnasio.
- **Problema:** No hay forma de reintentar salvo recargar. Con cada filtro la lista desaparece y vuelve, y la altura salta. Un skeleton con la forma de las filas comunica mejor qué viene y evita el salto.
- **Propuesta:** `EmptyState description="Revisá tu conexión." action={<Button variant="secondary" onClick={() => refetch()}>Reintentar</Button>}`. Usar `placeholderData: keepPreviousData` en `useScoreboard` (con opacidad atenuada mientras `isFetching`) y para la primera carga 5 filas skeleton `h-[60px] rounded-lg bg-surface-2 animate-pulse`. Aplicar el mismo patrón en `loading.tsx` (skeleton de header y tarjetas).
- **Severidad:** Media   ·   **Categoría:** estados

### SOC-11 · Tocar tu propia fila abre el formulario de edición
- **Ubicación:** [scoreboard/page.tsx:314](src/app/(app)/scoreboard/page.tsx#L314)
- **Vista:** Todas las filas tienen chevron. La de "Vos" lleva a `/perfil` (formulario de nombre, sexo, altura…) y la de un amigo a su comparativa.
- **Acción:** Tocar "Vos" esperando ver tus números.
- **Problema:** El mismo gesto lleva a destinos de naturaleza distinta (estadísticas contra formulario). Es un salto de contexto inesperado y además te deja con un "volver" que va siempre a /scoreboard (SOC-02).
- **Propuesta:** Que la fila propia no sea link (sin chevron) o que lleve a Registro (tus métricas). Si se mantiene, agregar una pista visual distinta (ícono `UserCog` en vez del chevron).
- **Severidad:** Baja   ·   **Categoría:** navegación

## Amigos (modal en Ranking, `FriendsPanel`)
**Caso de uso:** Desde el ícono Users del Ranking, el usuario invita a un amigo con un link, ve su lista de amigos o elimina a alguien. Hoy también es donde está "Mi perfil" y "Salir".

### SOC-12 · Botón "eliminar amigo" de 24px, sin etiqueta y anidado dentro del link
- **Ubicación:** [FriendsPanel.tsx:83-97](src/components/FriendsPanel.tsx#L83)
- **Vista:** Ícono `UserMinus size-4` con `p-1` (unos 24×24px), `text-muted`, a la derecha de cada fila, que es entera un `<Link>`.
- **Acción:** Eliminar a un amigo, o abrir su perfil tocando la fila.
- **Problema:** (1) El área de toque es muy chica y está pegada a la de la fila: tocar cerca del borde abre el perfil, o al revés abre el `confirm`. (2) Sin `aria-label`, el lector anuncia "botón" dentro de un link: es contenido interactivo anidado (`<button>` dentro de `<a>`), HTML inválido. (3) Usa `confirm()` nativo, que no sigue el estilo de la app. La mutación no tiene estado de carga ni feedback de error: si falla, el amigo sigue en la lista sin aviso.
- **Propuesta:** Sacar la acción destructiva de la fila: mover "Eliminar amigo" al perfil del amigo (al final, `Button variant="danger" ghost`) o a un menú `⋯` de `size-11` con `aria-label="Opciones de {nombre}"`. Confirmar con `Modal center`: "¿Eliminar a Meli? Van a dejar de verse en el ranking." [Cancelar] [Eliminar]. Mostrar un toast de error si falla.
- **Severidad:** Alta   ·   **Categoría:** tap-target

### SOC-13 · Invitar sin Web Share API, con fallo silencioso y feedback de copiado que no se reinicia
- **Ubicación:** [FriendsPanel.tsx:34-39](src/components/FriendsPanel.tsx#L34), [FriendsPanel.tsx:124-134](src/components/FriendsPanel.tsx#L124)
- **Vista:** "Invitar amigo" genera el código y abre otro modal con un `Input readOnly` (URL truncada) y el botón "Copiar", que pasa a "Copiado ✓".
- **Acción:** Mandarle el link a un amigo por WhatsApp.
- **Problema:** En mobile, la acción natural es la hoja de compartir del sistema (`navigator.share`), y hoy son 4 pasos: copiar, salir de la app, abrir WhatsApp y pegar. Si `createInvite` falla, `mutateAsync` rechaza sin catch: el botón deja de cargar y no pasa nada. Si `copyToClipboard` devuelve `false`, no hay mensaje (el botón queda en "Copiar"). "Copiado" nunca vuelve a "Copiar".
- **Propuesta:** Botón primario "Compartir link" que llame a `navigator.share({ title: "WOLF", text: "Sumate a competir conmigo en WOLF", url })` cuando `navigator.share` exista, y "Copiar" como secundario. En error: `<p role="alert" className="text-sm text-danger">No se pudo generar el link. Probá de nuevo.</p>`. Si la copia falla: "No se pudo copiar. Mantené apretado el link para copiarlo" (y `onFocus={e => e.target.select()}` en el Input). Volver a "Copiar" a los 2s. Poner `aria-live="polite"` en el estado.
- **Severidad:** Alta   ·   **Categoría:** feedback

### SOC-14 · Modal de invitación anidado dentro del modal de Amigos
- **Ubicación:** [FriendsPanel.tsx:115-135](src/components/FriendsPanel.tsx#L115), [ui.tsx:143-152](src/components/ui.tsx#L143)
- **Vista:** El `Modal` "Invitá a un amigo" se renderiza dentro del `Modal` "Amigos" (sin portal), los dos `fixed z-50` con su propio fondo `bg-black/60`.
- **Acción:** Cerrar la invitación con Escape o con la X y seguir en la lista de amigos.
- **Problema:** Cada `Modal` registra su listener de `keydown` en `document`, así que Escape cierra los dos a la vez. Al cerrar el interno, su cleanup pone `document.body.style.overflow = ""` mientras el externo sigue abierto, y la página de fondo vuelve a scrollear. Los fondos superpuestos oscurecen el doble. Dos hojas apiladas para un flujo de un paso agregan complejidad.
- **Propuesta:** Mostrar el link de invitación dentro del mismo panel, reemplazando el botón "Invitar amigo" por una tarjeta inline con [Compartir] [Copiar] y "Vence en 30 días". O, si se mantiene el modal, usar un contador de bloqueo de scroll y cortar la propagación del Escape en el modal superior.
- **Severidad:** Media   ·   **Categoría:** consistencia

### SOC-15 · Un error al cargar amigos se ve como "Todavía no tenés amigos"
- **Ubicación:** [FriendsPanel.tsx:57-67](src/components/FriendsPanel.tsx#L57)
- **Vista:** `useFriends` se desestructura solo con `{ data, isLoading }`. Si la query falla, `!data?.length` es verdadero y se muestra el empty state.
- **Acción:** Abrir Amigos sin conexión.
- **Problema:** El usuario cree que perdió a sus amigos o que la invitación no se aceptó. Lo mismo pasa en el ranking: sin `friends`, los badges de objetivo desaparecen sin aviso.
- **Propuesta:** Manejar `isError`: `EmptyState title="No se pudieron cargar tus amigos" action={<Button variant="secondary" onClick={refetch}>Reintentar</Button>}`.
- **Severidad:** Media   ·   **Categoría:** estados

## Perfil de un amigo (`/amigos/[id]`)
**Caso de uso:** Desde una fila del ranking o de la lista de amigos, el usuario compara sus números con los de un amigo (head-to-head, ejercicios en común, récords).

### SOC-16 · Spinner infinito ante error o amigo inexistente
- **Ubicación:** [amigos/[id]/page.tsx:132-136](src/app/(app)/amigos/[id]/page.tsx#L132), [amigos/[id]/page.tsx:117-119](src/app/(app)/amigos/[id]/page.tsx#L117)
- **Vista:** La condición `isLoading || !mine || !theirs` muestra el `Spinner`. Si `friend_metrics` falla (red, RLS porque ya no son amigos, id inválido de un link viejo), `theirs` queda `undefined` para siempre. El título muestra "…".
- **Acción:** Abrir el perfil de alguien que lo eliminó de amigos, o entrar sin señal.
- **Problema:** La carga nunca termina: no hay mensaje, ni reintento, ni salida clara (el botón volver es de 20px, SOC-02). Cuando falla `useCommonExercises`, la sección dice "Todavía no entrenaron el mismo ejercicio", que es falso.
- **Propuesta:** Tomar `isError` de las tres queries. Con `friend === null`: `EmptyState title="Este perfil no está disponible" description="Puede que ya no sean amigos." action={<Link href="/scoreboard">Volver al ranking</Link>}`. Con error de red: un "Reintentar". Mientras carga, un skeleton de la tarjeta VS (7 filas `h-9`).
- **Severidad:** Alta   ·   **Categoría:** estados

### SOC-17 · Etiquetas centrales de 11px en mayúsculas que comprimen los valores
- **Ubicación:** [amigos/[id]/page.tsx:77-82](src/app/(app)/amigos/[id]/page.tsx#L77), [amigos/[id]/page.tsx:210-218](src/app/(app)/amigos/[id]/page.tsx#L210)
- **Vista:** Grilla `grid-cols-[1fr_auto_1fr]` con la etiqueta en `text-[11px] uppercase tracking-wide truncate`. En "Ejercicios en común", la etiqueta es el nombre del ejercicio.
- **Acción:** Leer "PRESS BANCA INCLINADO CON MANCUERNAS · 80 kg vs 75 kg".
- **Problema:** La columna `auto` crece con nombres largos y deja sin espacio los valores laterales, que se truncan (`truncate` en `Side`). El nombre en mayúsculas de 11px es difícil de leer y el `truncate` del centro casi nunca actúa porque `auto` no tiene límite. Los números, que son lo importante, pierden espacio frente a la etiqueta.
- **Propuesta:** Para ejercicios, poner el nombre en una línea propia (`text-sm font-medium`) y debajo la fila `Vos 80 kg | 75 kg Meli`. Para métricas, limitar la columna: `grid-cols-[1fr_minmax(0,6.5rem)_1fr]` y etiqueta `text-xs` en caja normal.
- **Severidad:** Media   ·   **Categoría:** tipografía

### SOC-18 · Inconsistencias de formato y de período por defecto frente al ranking
- **Ubicación:** [amigos/[id]/page.tsx:90](src/app/(app)/amigos/[id]/page.tsx#L90), [amigos/[id]/page.tsx:240](src/app/(app)/amigos/[id]/page.tsx#L240), [amigos/[id]/page.tsx:164](src/app/(app)/amigos/[id]/page.tsx#L164)
- **Vista:** Ranking arranca en "Semana" y el perfil del amigo en "Mes". Los récords se muestran como `{pr.orm} kg` crudo, mientras "Ejercicios en común" usa `formatWeight`. Frecuencia dice `"3 d"` y en el ranking dice "3 días". La sección de récords anida un `EmptyState` (que ya es `card py-12`) dentro de otra `card p-4`.
- **Acción:** Pasar del ranking semanal al perfil de un amigo para entender por qué te pasó.
- **Problema:** El usuario ve números distintos a los que tocó (otra ventana de tiempo) sin darse cuenta. Los decimales sin formatear ("102.5 kg" contra "102,5 kg") y las unidades abreviadas son poco consistentes. La tarjeta dentro de tarjeta suma 96px de aire para "Sin récords".
- **Propuesta:** Heredar el período del ranking (por query param `?period=week`). Usar `formatWeight` y "días" en todos lados. En el vacío de récords, un `<p className="text-sm text-muted">Sin récords en este período.</p>` como en "Ejercicios en común".
- **Severidad:** Baja   ·   **Categoría:** consistencia

## Mi perfil (`/perfil`)
**Caso de uso:** El usuario corrige su nombre, sexo, objetivo, altura y peso, carga medidas corporales o cambia el tema. Llega desde el ícono de Registro, el modal de Amigos o su fila del ranking.

### SOC-19 · Formulario sin labels asociados, con carga a pantalla completa y riesgo de sobrescribir datos
- **Ubicación:** [perfil/page.tsx:45-55](src/app/(app)/perfil/page.tsx#L45), [perfil/page.tsx:102-108](src/app/(app)/perfil/page.tsx#L102), [perfil/page.tsx:124-133](src/app/(app)/perfil/page.tsx#L124)
- **Vista:** Los `<label className="text-sm text-muted">` no tienen `htmlFor` y los `Input` no tienen `id`. "Sexo" y "Perfil de entrenamiento" son grupos de botones bajo un `<label>` (no `fieldset/legend`). La carga usa `<main className="min-h-dvh grid place-items-center">` dentro del layout (con `pt-5 pb-24` y la TabBar), distinto del `loading.tsx` (`py-24`).
- **Acción:** Editar datos con lector de pantalla, o abrir Perfil con mala conexión.
- **Problema:** Los inputs se anuncian sin nombre y tocar el label no enfoca el campo. El spinner queda a media pantalla más el padding y salta al cargar. Si el `select` de `profiles` falla, el error no se lee, el formulario aparece vacío y al tocar "Guardar" se escriben `null` en sexo, altura y peso: pérdida silenciosa de datos. Altura y peso no validan rangos (acepta 0 o 1750). El toque repetido sobre un objetivo lo deselecciona (`null`) sin ningún aviso.
- **Propuesta:** `useId()` con `htmlFor`/`id`. `<fieldset><legend>` para los grupos. Spinner o skeleton con el mismo contenedor que `loading.tsx`. Si la lectura falla, mostrar un error con "Reintentar" y no renderizar el formulario. Validar `min`/`max` (altura 100-250, peso 30-300) con mensaje inline. Para objetivo, un `role="radiogroup"` sin deselección o una opción explícita "Sin objetivo".
- **Severidad:** Media   ·   **Categoría:** formulario

### SOC-20 · Dos botones "Guardar" con comportamientos distintos, y un error de medidas que no se muestra
- **Ubicación:** [perfil/page.tsx:205](src/app/(app)/perfil/page.tsx#L205), [perfil/page.tsx:282-294](src/app/(app)/perfil/page.tsx#L282), [perfil/page.tsx:327](src/app/(app)/perfil/page.tsx#L327)
- **Vista:** La primera card termina en "Guardar" primario, que guarda y te saca a /scoreboard. La segunda en "Guardar medida de hoy", también primario, que guarda y se queda con "Guardada ✓".
- **Acción:** Cargar el peso en la primera card y las medidas en la segunda.
- **Problema:** Si el usuario completa las medidas y después toca el primer "Guardar", sale de la pantalla y pierde lo escrito en medidas sin aviso. Dos CTA primarios iguales compiten. Si `add.mutateAsync` falla, la promesa rechaza sin catch y no aparece ningún mensaje. Las cards usan `p-6` cuando el resto de la app usa `p-3/p-4`.
- **Propuesta:** No redirigir al guardar el perfil (SOC-02). Poner el guardado de medidas como `variant="secondary"` o mover medidas a Registro, donde se consumen. Envolver en try/catch y mostrar `<p role="alert" className="text-sm text-danger">`. Unificar a `card p-4`.
- **Severidad:** Media   ·   **Categoría:** feedback

## Notificaciones (`NotificationToggle`, header de Ranking)
**Caso de uso:** El usuario quiere enterarse cuando un amigo lo pasa en el ranking. Toca "Notificar" en el header de Ranking y activa, prueba o desactiva las notificaciones.

### SOC-21 · Instrucciones para permisos bloqueados que no sirven en la PWA instalada, y un botón que desaparece donde no hay soporte
- **Ubicación:** [NotificationToggle.tsx:38](src/components/NotificationToggle.tsx#L38), [NotificationToggle.tsx:118-132](src/components/NotificationToggle.tsx#L118), [NotificationToggle.tsx:96-102](src/components/NotificationToggle.tsx#L96)
- **Vista:** Si el permiso está `denied`, el texto dice "Tocá el candado / ícono a la izquierda de la dirección del sitio". Si el navegador no soporta push (por ejemplo iOS Safari sin instalar en la pantalla de inicio), el componente devuelve `null`. El botón "Bloqueadas" usa `opacity-60`.
- **Acción:** Reactivar notificaciones desde la app instalada, o descubrir que existen en iPhone.
- **Problema:** En modo standalone no hay barra de direcciones ni candado, así que las instrucciones no se pueden seguir (en Android se hace desde Ajustes → Apps → WOLF → Notificaciones). En iOS el usuario nunca se entera de que, instalando la PWA, podría recibirlas. `opacity-60` sobre `text-muted` deja "Bloqueadas" por debajo de 3:1 en ambos temas. El botón usa solo `title` (no `aria-label`) y su texto "Notificar" es ambiguo.
- **Propuesta:** Detectar `matchMedia('(display-mode: standalone)')` y dar las instrucciones según plataforma. En `unsupported`, si es iOS sin instalar, mostrar "Instalá WOLF en tu pantalla de inicio para recibir avisos" en vez de ocultarlo. Sacar `opacity-60` y usar `text-warning` con `BellOff`. Copy del botón: "Avisos", con `aria-label="Notificaciones del ranking: {estado}"`. Mover el control a Perfil → Preferencias (SOC-01) y dejar en Ranking solo un indicador.
- **Severidad:** Media   ·   **Categoría:** estados

## Modal de novedades (`WhatsNewModal`)
**Caso de uso:** Al abrir la app después de una actualización notable aparece una hoja con lo nuevo. El usuario la lee y sigue.

### SOC-22 · Hoja sin altura máxima ni scroll, sin semántica de diálogo y sin forma de volver a verla
- **Ubicación:** [WhatsNewModal.tsx:75-81](src/components/WhatsNewModal.tsx#L75), [WhatsNewModal.tsx:65-70](src/components/WhatsNewModal.tsx#L65), [changelog.ts:26-35](src/lib/changelog.ts#L26)
- **Vista:** Contenedor `fixed inset-0 flex items-end` con una `card p-6 pb-8` sin `max-h` ni `overflow-y-auto`. La 0.3.0 tiene 8 ítems largos, y si el usuario se salteó versiones se juntan con los 5 de la 0.2.0 (13 ítems con su encabezado de versión).
- **Acción:** Leer las novedades en un teléfono de 640-700px de alto.
- **Problema:** Con unos 13 ítems de 2-3 líneas en `text-sm`, la hoja supera el alto de la pantalla y, al estar anclada abajo, lo que sobra se corta por arriba: el título "Qué hay de nuevo" y los primeros ítems quedan fuera de vista y no se pueden scrollear. No tiene `role="dialog"`, `aria-modal` ni `aria-labelledby`, no cierra con Escape, no bloquea el scroll del body y no respeta `env(safe-area-inset-bottom)`. Un toque accidental en el fondo lo marca como visto para siempre, y no hay ninguna entrada "Novedades" en Perfil para releerlo.
- **Propuesta:** Reusar `Modal` (que ya maneja `max-h-[85%]`, scroll, Escape y bloqueo de scroll) con el CTA "Entendido" en un footer fijo. Agregar `role="dialog" aria-modal="true" aria-labelledby`. Limitar a 3-4 ítems destacados por versión y poner un link "Ver todas las novedades" a una sección en Perfil que liste `CHANGELOG`. Que el toque en el fondo cierre sin marcar como visto, o pedir el cierre explícito.
- **Severidad:** Media   ·   **Categoría:** estados

---

# Seguimiento de la implementación (2026-11-04)

Implementado en la rama `ux/relevamiento`, en tres commits (ola 0+1: bugs y fundaciones; ola 2: pantallas; ola 3: cierre). **Estado:** ✅ aplicado · ◐ parcial (el motivo va en la celda) · ⏸ diferido.

Decisiones que se apartan de la propuesta original:
- **GLB-12:** success pasa al verde del handoff y se agrega un **Modo daltónico** (Perfil → Preferencias) que vuelve a celeste/teal.
- **ENT-24:** se eliminó el cronómetro flotante; el descanso automático cubre ese caso.
- **AUTH-14:** no se pide confirmación antes de aceptar una invitación (las vistas previas de los chats no ejecutan JS). Sí se avisa con un toast.
- **Migraciones nuevas, que hay que correr:** `0036_duplicate_routine.sql` y `0037_share_previews.sql`. El frontend funciona sin ellas (con fallback).

# Anexo · Índice de hallazgos

Para armar el backlog: copiar o filtrar por severidad, alcance o categoría. La columna **Estado** queda para el seguimiento.

| ID | Severidad | Alcance | Pantalla | Hallazgo | Categoría | Estado |
|---|---|---|---|---|---|---|
| GLB-01 | Alta | Sistema de diseño y navegación global | Sistema de diseño y navegación global | Tap targets por debajo de 44px en las primitivas | tap-target | ✅ |
| GLB-02 | Alta | Sistema de diseño y navegación global | Sistema de diseño y navegación global | Contraste insuficiente en el tema claro "girly" | contraste | ✅ |
| GLB-03 | Media | Sistema de diseño y navegación global | Sistema de diseño y navegación global | El zoom está bloqueado (`maximumScale: 1`) | accesibilidad | ✅ |
| GLB-04 | Media | Sistema de diseño y navegación global | Sistema de diseño y navegación global | Escala tipográfica con tamaños arbitrarios por debajo del mínimo legible | tipografía | ◐ Escala `text-2xs` y 0 `text-[Npx]`; sin regla de lint |
| GLB-05 | Alta | Sistema de diseño y navegación global | Sistema de diseño y navegación global | Navegación principal incompleta: Perfil y Ejercicios no tienen entrada fija | navegación | ✅ |
| GLB-06 | Media | Sistema de diseño y navegación global | Sistema de diseño y navegación global | El Modal no es un diálogo accesible | accesibilidad | ✅ |
| GLB-07 | Baja | Sistema de diseño y navegación global | Sistema de diseño y navegación global | No hay indicador de foco visible | accesibilidad | ✅ |
| GLB-08 | Media | Sistema de diseño y navegación global | Sistema de diseño y navegación global | Feedback del sistema con `alert()` / `confirm()` nativos y sin toasts | feedback | ✅ |
| GLB-09 | Baja | Sistema de diseño y navegación global | Sistema de diseño y navegación global | Encabezados de página inconsistentes | consistencia | ✅ |
| GLB-10 | Baja | Sistema de diseño y navegación global | Sistema de diseño y navegación global | Estados de carga con spinner genérico en lugar de skeletons | estados | ✅ |
| GLB-11 | Baja | Sistema de diseño y navegación global | Sistema de diseño y navegación global | Escala de radios y espaciado sin reglas claras | espaciado | ⏸ Diferido: cambio visual global de bajo valor |
| GLB-12 | Baja | Sistema de diseño y navegación global | Sistema de diseño y navegación global | Semántica de color "success" en azul y desalineada del handoff | consistencia | ✅ |
| GLB-13 | Baja | Sistema de diseño y navegación global | Sistema de diseño y navegación global | Tabs y TabBar sin semántica ARIA de navegación | accesibilidad | ✅ |
| GLB-14 | Alta | Sistema de diseño y navegación global | Sistema de diseño y navegación global | `Button` queda habilitado mientras está en `loading` si se le pasa `disabled` | feedback | ✅ |
| AUTH-01 | Alta | Auth, onboarding y páginas públicas | Login / Registro / Link mágico | Pantalla "Revisá tu mail" sin salida | estados | ✅ |
| AUTH-02 | Alta | Auth, onboarding y páginas públicas | Login / Registro / Link mágico | Campos sin label, sin autocomplete y placeholder casi invisible en tema girly | formulario | ✅ |
| AUTH-03 | Media | Auth, onboarding y páginas públicas | Login / Registro / Link mágico | Acciones secundarias: links de texto de 12px apilados y con tap target mínimo | tap-target | ✅ |
| AUTH-04 | Media | Auth, onboarding y páginas públicas | Login / Registro / Link mágico | El modo (entrar vs crear cuenta) solo se distingue por el texto del botón | jerarquía | ✅ |
| AUTH-05 | Alta | Auth, onboarding y páginas públicas | Login / Registro / Link mágico | Errores lejos del campo, sin anunciarse y a veces sin traducir | feedback | ✅ |
| AUTH-06 | Media | Auth, onboarding y páginas públicas | Login / Registro / Link mágico | "¿Olvidaste tu contraseña?" dispara el mail sin confirmar y sin feedback visible | feedback | ✅ |
| AUTH-07 | Baja | Auth, onboarding y páginas públicas | Login / Registro / Link mágico | Usuario ya logueado que entra a /login ve el formulario | navegación | ✅ |
| AUTH-08 | Media | Auth, onboarding y páginas públicas | Nueva contraseña (reset) | Reset sin validar la sesión, con errores en inglés y sin confirmación de éxito | estados | ✅ |
| AUTH-09 | Media | Auth, onboarding y páginas públicas | Onboarding (perfil inicial) | El onboarding descarta el destino original (invitación / rutina compartida) | navegación | ✅ |
| AUTH-10 | Media | Auth, onboarding y páginas públicas | Onboarding (perfil inicial) | Labels no asociados, grupo "Sexo" sin semántica y errores genéricos | formulario | ✅ |
| AUTH-11 | Baja | Auth, onboarding y páginas públicas | Onboarding (perfil inicial) | Se pide el sexo sin explicar para qué | copy | ✅ |
| AUTH-12 | Baja | Auth, onboarding y páginas públicas | Onboarding (perfil inicial) | Onboarding sin salida y con spinner que puede quedar colgado | navegación | ✅ |
| AUTH-13 | Media | Auth, onboarding y páginas públicas | Invitación de amistad | Invitación anónima y CTA que solo contempla a quien ya tiene cuenta | jerarquía | ✅ |
| AUTH-14 | Media | Auth, onboarding y páginas públicas | Invitación de amistad | La invitación se acepta sola, sin confirmar, y la aceptación diferida es invisible | feedback | ◐ Toast y limpieza del pendiente; sin confirmación previa (decisión: no frenar la conversión) |
| AUTH-15 | Baja | Auth, onboarding y páginas públicas | Invitación de amistad | "Ver amigos" lleva al Ranking, no a Amigos | consistencia | ✅ |
| AUTH-16 | Media | Auth, onboarding y páginas públicas | Rutina compartida (/r/[shareCode]) | Página pública sin identidad de marca, sin volver y con CTA al final de la lista | jerarquía | ✅ |
| AUTH-17 | Media | Auth, onboarding y páginas públicas | Rutina compartida (/r/[shareCode]) | Error al copiar con `alert()` nativo y "no encontrada" mezclado con fallo de red | feedback | ✅ |
| AUTH-18 | Alta | Auth, onboarding y páginas públicas | Paquete de rutinas compartidas (/r/bundle) | La importación puede duplicar rutinas y fallar en silencio | feedback | ✅ |
| AUTH-19 | Media | Auth, onboarding y páginas públicas | Paquete de rutinas compartidas (/r/bundle) | Barra fija inferior sin fondo ni safe area: el texto de ayuda se superpone a la lista | espaciado | ✅ |
| AUTH-20 | Baja | Auth, onboarding y páginas públicas | Paquete de rutinas compartidas (/r/bundle) | Items seleccionables sin semántica de checkbox y título sin plural correcto | accesibilidad | ✅ |
| AUTH-21 | Baja | Auth, onboarding y páginas públicas | Manifest PWA | Ícono maskable transparente y sin margen de seguridad | consistencia | ◐ `id`/`lang`/`orientation` en el manifest; falta el PNG maskable |
| RUT-01 | Alta | Rutinas y catálogo de ejercicios | Lista de rutinas (home tras login) | Un error de red se muestra como "Todavía no tenés rutinas" | estados | ✅ |
| RUT-02 | Alta | Rutinas y catálogo de ejercicios | Lista de rutinas (home tras login) | No hay una forma directa de empezar a entrenar desde la home | jerarquía | ✅ |
| RUT-03 | Media | Rutinas y catálogo de ejercicios | Lista de rutinas (home tras login) | Las cards de rutina no dicen qué tiene cada rutina | jerarquía | ◐ Línea "N ejercicios · músculos" y Badge; el orden por último uso queda diferido |
| RUT-04 | Baja | Rutinas y catálogo de ejercicios | Lista de rutinas (home tras login) | "Compartir" en el header en realidad abre un modo selección | copy | ✅ |
| RUT-05 | Media | Rutinas y catálogo de ejercicios | Lista de rutinas (home tras login) | Crear rutina: sin label, sin validación y con recarga completa de la página | formulario | ✅ |
| RUT-06 | Media | Rutinas y catálogo de ejercicios | Lista de rutinas (home tras login) | Importar Excel: errores con `alert()`, sin nombre editable y con fallas silenciosas | feedback | ✅ |
| RUT-07 | Media | Rutinas y catálogo de ejercicios | Lista de rutinas (home tras login) | La importación pierde sin aviso la duración y la distancia | estados | ✅ |
| RUT-08 | Baja | Rutinas y catálogo de ejercicios | Lista de rutinas (home tras login) | El modo compartir no maneja errores | feedback | ✅ |
| RUT-09 | Alta | Rutinas y catálogo de ejercicios | Editor de rutina | Si la carga falla, el spinner no termina nunca | estados | ✅ |
| RUT-10 | Alta | Rutinas y catálogo de ejercicios | Editor de rutina | "Eliminar" rutina pegado a "Copiar", con `confirm()` nativo y sin deshacer | tap-target | ✅ |
| RUT-11 | Alta | Rutinas y catálogo de ejercicios | Editor de rutina | Quitar un ejercicio es un ícono de 24 px, sin confirmación y sin deshacer | tap-target | ✅ |
| RUT-12 | Media | Rutinas y catálogo de ejercicios | Editor de rutina | Flechas de reordenar de 20 px, sin label y con poco contraste deshabilitadas | tap-target | ◐ Flechas de 44px con aria-label y highlight; sin drag & drop |
| RUT-13 | Media | Rutinas y catálogo de ejercicios | Editor de rutina | El header del editor no tiene título ni un botón de volver accesible | navegación | ✅ |
| RUT-14 | Media | Rutinas y catálogo de ejercicios | Editor de rutina | Las series se guardan solas, pero no hay indicio de guardado ni aviso si falla | feedback | ✅ |
| RUT-15 | Media | Rutinas y catálogo de ejercicios | Editor de rutina | Planificador de series: inputs de 36 px, quitar serie de 28 px y textos de 11 px | tap-target | ✅ |
| RUT-16 | Baja | Rutinas y catálogo de ejercicios | Editor de rutina | En una rutina vacía, el CTA "Agregar ejercicio" queda fuera del estado vacío y con peso secundario | consistencia | ✅ |
| RUT-17 | Media | Rutinas y catálogo de ejercicios | Editor de rutina | "Copiar" es ambiguo y además marca la rutina como "Compartida" | copy | ✅ |
| RUT-18 | Baja | Rutinas y catálogo de ejercicios | Editor de rutina | Los dos modales de compartir se comportan distinto | consistencia | ✅ |
| RUT-19 | Alta | Rutinas y catálogo de ejercicios | Picker de ejercicios (bottom sheet) | El picker se cierra después de cada ejercicio y no confirma que se agregó | feedback | ✅ |
| RUT-20 | Media | Rutinas y catálogo de ejercicios | Picker de ejercicios (bottom sheet) | La búsqueda no ignora tildes y corta a 80 resultados sin avisar | estados | ✅ |
| RUT-21 | Media | Rutinas y catálogo de ejercicios | Picker de ejercicios (bottom sheet) | "Crear «texto buscado»" abre el formulario con el nombre vacío | formulario | ✅ |
| RUT-22 | Baja | Rutinas y catálogo de ejercicios | Picker de ejercicios (bottom sheet) | El estado sin resultados no ofrece limpiar los filtros | copy | ✅ |
| RUT-23 | Media | Rutinas y catálogo de ejercicios | Crear ejercicio / Editar músculos | "Crear ejercicio" deshabilitado no dice qué falta, y los campos obligatorios no se distinguen | formulario | ✅ |
| RUT-24 | Media | Rutinas y catálogo de ejercicios | Crear ejercicio / Editar músculos | Chips de músculo/mecánica de unos 28 px y estado activo marcado solo con color | tap-target | ✅ |
| RUT-25 | Baja | Rutinas y catálogo de ejercicios | Crear ejercicio / Editar músculos | Modales apilados: Escape cierra todos y el scroll del fondo se desbloquea | navegación | ✅ |
| RUT-26 | Media | Rutinas y catálogo de ejercicios | Catálogo de ejercicios | El catálogo no tiene estado sin resultados, ni botón de volver, ni forma de crear o agregar | estados | ✅ |
| ENT-01 | Alta | Sesión de entrenamiento activa | Pantalla de sesión activa (estructura, cierre y estados) | "Finalizar entrenamiento" cierra sin confirmar y sin revisar series pendientes | estados | ✅ |
| ENT-02 | Alta | Sesión de entrenamiento activa | Pantalla de sesión activa (estructura, cierre y estados) | Fallos de guardado silenciosos y sin manejo offline | feedback | ◐ Toast global, indicador offline y try/catch en finish; sin persistir mutaciones offline |
| ENT-03 | Media | Sesión de entrenamiento activa | Pantalla de sesión activa (estructura, cierre y estados) | Error o sesión inexistente = spinner infinito | estados | ✅ |
| ENT-04 | Media | Sesión de entrenamiento activa | Pantalla de sesión activa (estructura, cierre y estados) | Sin header sticky ni progreso de sesión; la parte superior la ocupa un formulario de fechas | jerarquía | ✅ |
| ENT-05 | Media | Sesión de entrenamiento activa | Pantalla de sesión activa (estructura, cierre y estados) | El campo "Fin" editable durante la sesión activa la cierra por la puerta de atrás | estados | ✅ |
| ENT-06 | Media | Sesión de entrenamiento activa | Pantalla de sesión activa (estructura, cierre y estados) | La flecha "atrás" en realidad descarta, y mide ~20 px | navegación | ✅ |
| ENT-07 | Media | Sesión de entrenamiento activa | Pantalla de sesión activa (estructura, cierre y estados) | Sesión olvidada abierta: el candado atrapa sin explicar y la duración se infla | navegación | ◐ Hoja de sesión vieja (>4 h) y toast del candado; sin mini-player |
| ENT-08 | Media | Sesión de entrenamiento activa | Pantalla de sesión activa (estructura, cierre y estados) | Tres capas flotantes apiladas tapan ~200 px de la lista (y la fila que se edita) | espaciado | ✅ |
| ENT-09 | Alta | Sesión de entrenamiento activa | Card de ejercicio (`SessionExerciseCard`) | Todo arranca plegado y nada indica qué ejercicio/serie toca ahora | jerarquía | ✅ |
| ENT-10 | Alta | Sesión de entrenamiento activa | Card de ejercicio (`SessionExerciseCard`) | "Quitar del entreno" borra el ejercicio con todas sus series sin confirmar ni deshacer | estados | ✅ |
| ENT-11 | Media | Sesión de entrenamiento activa | Card de ejercicio (`SessionExerciseCard`) | Tildar la última serie autocompleta las anteriores sin aviso ni deshacer | feedback | ✅ |
| ENT-12 | Baja | Sesión de entrenamiento activa | Card de ejercicio (`SessionExerciseCard`) | Nota del ejercicio y comentario de serie: dos conceptos confusos, la nota siempre ocupa espacio | copy | ✅ |
| ENT-13 | Alta | Sesión de entrenamiento activa | Fila de serie (`SetRow`) | Eliminar serie (X) pegado al check de completar, sin confirmación ni deshacer | tap-target | ✅ (menú de serie + Deshacer en lugar de swipe) |
| ENT-14 | Alta | Sesión de entrenamiento activa | Fila de serie (`SetRow`) | El check de completar y los inputs miden 36 px: chicos para el control principal | tap-target | ✅ |
| ENT-15 | Alta | Sesión de entrenamiento activa | Fila de serie (`SetRow`) | RIR segmentado de 24 × 24 px con 4 px de separación | tap-target | ✅ |
| ENT-16 | Alta | Sesión de entrenamiento activa | Fila de serie (`SetRow`) | Inputs numéricos: coma decimal, sin seleccionar al enfocar, sin "siguiente" | formulario | ✅ |
| ENT-17 | Media | Sesión de entrenamiento activa | Fila de serie (`SetRow`) | El valor tipeado solo se guarda en `onBlur`: riesgo de pérdida al bloquear el teléfono | formulario | ✅ |
| ENT-18 | Media | Sesión de entrenamiento activa | Fila de serie (`SetRow`) | Sin encabezados de columna; el valor de "la última vez" se confunde con el real | jerarquía | ✅ |
| ENT-19 | Media | Sesión de entrenamiento activa | Fila de serie (`SetRow`) | Controles secundarios con tap targets de 16–32 px | tap-target | ✅ |
| ENT-20 | Media | Sesión de entrenamiento activa | Fila de serie (`SetRow`) | Densidad: cada serie ocupa ~100 px por líneas que casi nunca se usan | espaciado | ✅ |
| ENT-21 | Media | Sesión de entrenamiento activa | Fila de serie (`SetRow`) | Valores de carga en 14 px de peso normal y consejos en 11 px: poca legibilidad a distancia de brazo | tipografía | ✅ |
| ENT-22 | Media | Sesión de entrenamiento activa | Fila de serie (`SetRow`) | Botones de la fila sin nombre accesible ni estado | accesibilidad | ✅ |
| ENT-23 | Alta | Sesión de entrenamiento activa | Descanso y cronómetro | Timer de descanso: cuenta hacia arriba sin objetivo ni aviso, CTA chico y ambiguo (desvío del diseño) | feedback | ✅ |
| ENT-24 | Media | Sesión de entrenamiento activa | Descanso y cronómetro | Cronómetro manual duplicado del descanso, con controles sin etiqueta | consistencia | ✅ (cronómetro eliminado) |
| ENT-25 | Baja | Sesión de entrenamiento activa | Reemplazar ejercicio (`ReplaceExerciseModal`) | Reemplazo sin feedback ni estado vacío, y copy técnico | feedback | ✅ |
| ENT-26 | Media | Sesión de entrenamiento activa | Celebración de PR (`PrCelebrationModal`) | La celebración se cierra con cualquier toque afuera y muestra un solo PR | feedback | ✅ |
| REG-01 | Alta | Registro y métricas | Registro · estructura general y estados de la pantalla | Un error de red se muestra como "Sin entrenamientos todavía" | estados | ✅ |
| REG-02 | Alta | Registro y métricas | Registro · estructura general y estados de la pantalla | Siete KPIs y el plan semanal antes de cualquier sub-navegación; tres columnas en 360px | jerarquía | ✅ |
| REG-03 | Alta | Registro y métricas | Registro · estructura general y estados de la pantalla | El delta de las cards de "esta semana" no compara esta semana | dataviz | ✅ |
| REG-04 | Media | Registro y métricas | Registro · estructura general y estados de la pantalla | Sub-navegación "Entrenamiento / Cuerpo" enterrada y sin persistencia | navegación | ✅ |
| REG-05 | Media | Registro y métricas | Registro · estructura general y estados de la pantalla | El orden de las cards "salta" cuando termina de cargar el perfil | estados | ✅ |
| REG-06 | Media | Registro y métricas | Registro · estructura general y estados de la pantalla | Sin objetivo elegido, la portada queda casi vacía y nada lo explica | estados | ✅ |
| REG-07 | Media | Registro y métricas | Registro · estructura general y estados de la pantalla | El historial queda al fondo de un scroll muy largo y plegado | jerarquía | ✅ |
| REG-08 | Media | Registro y métricas | Registro · estructura general y estados de la pantalla | El texto de los modales "i" filtra notas internas de desarrollo | copy | ◐ Reestructurado en GoalMetrics, BodyProgress y Series por grupo; quedan otros "i" de Registro sin el formato de 3 bloques |
| REG-09 | Media | Registro y métricas | Registro · estructura general y estados de la pantalla | Formato numérico inconsistente con es-AR y mezcla "sets"/"series" | consistencia | ✅ |
| REG-10 | Media | Registro y métricas | Registro · Plan semanal | La semana arranca en domingo en el plan y en lunes en el resto | consistencia | ✅ |
| REG-11 | Media | Registro y métricas | Registro · Plan semanal | El calendario de cumplimiento codifica el estado solo con color y no tiene leyenda | accesibilidad | ✅ |
| REG-12 | Baja | Registro y métricas | Registro · Plan semanal | Modal de confirmación en cada toque del plan, con tono culposo | feedback | ✅ |
| REG-13 | Alta | Registro y métricas | Registro · Cards de métricas (Entrenamiento) | "Balance de patrones": empuje y tirón con dos dorados casi iguales; "aislamiento" invisible | dataviz | ✅ |
| REG-14 | Media | Registro y métricas | Registro · Cards de métricas (Entrenamiento) | Copy ambiguo e incorrecto en el veredicto del balance | copy | ✅ |
| REG-15 | Media | Registro y métricas | Registro · Cards de métricas (Entrenamiento) | "Series efectivas por grupo": marcas sin rotular, header apretado y empty state con ventana equivocada | dataviz | ✅ |
| REG-16 | Media | Registro y métricas | Registro · Cards de métricas (Entrenamiento) | Heatmap de Constancia: tooltip con unidad equivocada, inaccesible en touch y sin escala | dataviz | ◐ Unidad, celdas tocables, meses y leyenda; las celdas miden ~20px (12 columnas a 360px) |
| REG-17 | Alta | Registro y métricas | Registro · Cards de métricas (Entrenamiento) | Gráficos multi-línea sin leyenda (1RM de fuerza, circunferencias) | dataviz | ✅ |
| REG-18 | Media | Registro y métricas | Registro · Cards de métricas (Entrenamiento) | Las series semanales se ordenan mal al cruzar el año | dataviz | ✅ |
| REG-19 | Baja | Registro y métricas | Registro · Cards de métricas (Entrenamiento) | VolumeChart: ticks del eje Y redondeados que se repiten y no hay estado vacío | dataviz | ✅ |
| REG-20 | Media | Registro y métricas | Registro · Cards de métricas (Entrenamiento) | El donut de músculos usa una paleta fija de modo oscuro también en el tema claro | contraste | ✅ |
| REG-21 | Media | Registro y métricas | Registro · Cards de métricas (Entrenamiento) | Chips de estado en ámbar y teal sin contraste suficiente en el tema claro | contraste | ✅ |
| REG-22 | Baja | Registro y métricas | Registro · Cards de métricas (Entrenamiento) | "Listo para entrenar": barra sin valor, "hace 0d" y "MEV ✓" críptico | copy | ✅ |
| REG-23 | Media | Registro y métricas | Registro · Cuerpo (peso, sueño, medidas) | El color de la tasa de peso juzga "bueno/malo" sin mirar el objetivo | dataviz | ◐ Tasa neutra con flecha; sin color por objetivo |
| REG-24 | Media | Registro y métricas | Registro · Cuerpo (peso, sueño, medidas) | Inputs de peso y sueño solo con placeholder y sin feedback | formulario | ✅ |
| REG-25 | Baja | Registro y métricas | Registro · Cuerpo (peso, sueño, medidas) | Barras de sueño sin eje de fechas ni valores | dataviz | ✅ |
| REG-26 | Media | Registro y métricas | Registro · Historial y exportación | Botón de borrar anidado dentro del link de la fila, con target de 32px | accesibilidad | ✅ |
| REG-27 | Media | Registro y métricas | Registro · Historial y exportación | Borrar una sesión que falla no muestra nada y el éxito tampoco confirma | feedback | ✅ |
| REG-28 | Media | Registro y métricas | Registro · Historial y exportación | Exportar Excel no da feedback de progreso, error ni rango vacío | feedback | ✅ |
| SOC-01 | Alta | Social, ranking y perfil | Navegación transversal: cómo se llega a Perfil, Amigos y Ajustes | Ajustes fragmentados en tres pantallas y escondidos detrás de íconos | navegación | ✅ |
| SOC-02 | Media | Social, ranking y perfil | Navegación transversal: cómo se llega a Perfil, Amigos y Ajustes | Botón "volver" sin etiqueta, diminuto y con destino fijo a /scoreboard | navegación | ✅ |
| SOC-03 | Alta | Social, ranking y perfil | Ranking (`/scoreboard`) | Hasta cinco filas de controles antes del primer resultado | jerarquía | ◐ Hoja de filtros y chips; "Fuerza rel." y ÷peso siguen separados (son métricas distintas) |
| SOC-04 | Alta | Social, ranking y perfil | Ranking (`/scoreboard`) | Sin amigos, el ranking te muestra primero con medalla de oro y sin invitación a invitar | estados | ✅ |
| SOC-05 | Media | Social, ranking y perfil | Ranking (`/scoreboard`) | Tu fila apenas se destaca y la tarjeta "Tu puesto" no da contexto | jerarquía | ✅ |
| SOC-06 | Media | Social, ranking y perfil | Ranking (`/scoreboard`) | Empates: puestos y medallas distintos para el mismo valor | jerarquía | ✅ |
| SOC-07 | Media | Social, ranking y perfil | Ranking (`/scoreboard`) | Fila sobrecargada, sin avatar y con columnas desalineadas | consistencia | ✅ |
| SOC-08 | Baja | Social, ranking y perfil | Ranking (`/scoreboard`) | El movimiento ▲▼ solo se comunica por color y `title` | accesibilidad | ✅ |
| SOC-09 | Media | Social, ranking y perfil | Ranking (`/scoreboard`) | Toggle "Solo mi objetivo" sin semántica de switch | accesibilidad | ✅ |
| SOC-10 | Media | Social, ranking y perfil | Ranking (`/scoreboard`) | Estado de error sin explicación ni reintento, y spinner que hace saltar el layout | estados | ✅ |
| SOC-11 | Baja | Social, ranking y perfil | Ranking (`/scoreboard`) | Tocar tu propia fila abre el formulario de edición | navegación | ✅ |
| SOC-12 | Alta | Social, ranking y perfil | Amigos (modal en Ranking, `FriendsPanel`) | Botón "eliminar amigo" de 24px, sin etiqueta y anidado dentro del link | tap-target | ✅ |
| SOC-13 | Alta | Social, ranking y perfil | Amigos (modal en Ranking, `FriendsPanel`) | Invitar sin Web Share API, con fallo silencioso y feedback de copiado que no se reinicia | feedback | ✅ |
| SOC-14 | Media | Social, ranking y perfil | Amigos (modal en Ranking, `FriendsPanel`) | Modal de invitación anidado dentro del modal de Amigos | consistencia | ✅ |
| SOC-15 | Media | Social, ranking y perfil | Amigos (modal en Ranking, `FriendsPanel`) | Un error al cargar amigos se ve como "Todavía no tenés amigos" | estados | ✅ |
| SOC-16 | Alta | Social, ranking y perfil | Perfil de un amigo (`/amigos/[id]`) | Spinner infinito ante error o amigo inexistente | estados | ✅ |
| SOC-17 | Media | Social, ranking y perfil | Perfil de un amigo (`/amigos/[id]`) | Etiquetas centrales de 11px en mayúsculas que comprimen los valores | tipografía | ✅ |
| SOC-18 | Baja | Social, ranking y perfil | Perfil de un amigo (`/amigos/[id]`) | Inconsistencias de formato y de período por defecto frente al ranking | consistencia | ✅ |
| SOC-19 | Media | Social, ranking y perfil | Mi perfil (`/perfil`) | Formulario sin labels asociados, con carga a pantalla completa y riesgo de sobrescribir datos | formulario | ✅ |
| SOC-20 | Media | Social, ranking y perfil | Mi perfil (`/perfil`) | Dos botones "Guardar" con comportamientos distintos, y un error de medidas que no se muestra | feedback | ✅ |
| SOC-21 | Media | Social, ranking y perfil | Notificaciones (`NotificationToggle`, header de Ranking) | Instrucciones para permisos bloqueados que no sirven en la PWA instalada, y un botón que desaparece donde no hay soporte | estados | ✅ |
| SOC-22 | Media | Social, ranking y perfil | Modal de novedades (`WhatsNewModal`) | Hoja sin altura máxima ni scroll, sin semántica de diálogo y sin forma de volver a verla | estados | ◐ Reusa Modal y /novedades; el fondo no cierra (solo X o "Entendido") |
