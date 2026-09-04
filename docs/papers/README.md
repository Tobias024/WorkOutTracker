<!-- SPDX-License-Identifier: AGPL-3.0-only -->
# Papers que sostienen los números de la app

Fichas de los estudios de los que sale cada umbral. **No son los papers**: son
notas estructuradas con los datos que la app usa. El texto completo de estos
artículos tiene copyright y este repo es público bajo AGPL, así que copiarlo acá
sería redistribuir material ajeno. Cada ficha lleva el DOI para ir a la fuente.

## Para qué sirve

Cuando haya que tocar un umbral, la pregunta no es "qué número queda bien" sino
"qué dice el paper y qué NO dice". Cada ficha tiene una sección
**Lo que NO dice**, que es donde estuvieron los errores hasta ahora.

## Índice

| # | Ficha | Qué número fija |
|---|---|---|
| 1 | [schoenfeld-2017-volumen.md](schoenfeld-2017-volumen.md) | MEV/MAV/MRV de hipertrofia (10/16/20) |
| 4 | [schoenfeld-2021-cargas.md](schoenfeld-2021-cargas.md) | Piso de 5 reps; rango 5-30 |
| 16 | [pelland-2026-dosis-respuesta.md](pelland-2026-dosis-respuesta.md) | Indirectas = 0.5; peso del rezago vs recuperación |
| 17 | [vigotsky-2022-emg.md](vigotsky-2022-emg.md) | Por qué NO hay gradiente fino por ejercicio |
| 19 | [robinson-2024-proximidad-fallo.md](robinson-2024-proximidad-fallo.md) | Zonas de RIR por objetivo |
| 20 | [ralston-2017-volumen-fuerza.md](ralston-2017-volumen-fuerza.md) | MEV/MAV/MRV de fuerza (6/12/18) |
| 18 | [macdougall-1995-spm.md](macdougall-1995-spm.md) | Umbrales de color de la recencia (2d/4d) |

Los IDs son los mismos de [`src/lib/references.ts`](../../src/lib/references.ts),
que es lo que se muestra en los tooltips ⓘ.

## Regla

Si tocás un número en [`src/lib/goal-params.ts`](../../src/lib/goal-params.ts),
actualizá la ficha correspondiente. Si el número no sale de ninguna ficha, el
comentario en el código tiene que decir explícitamente que es una interpolación
o una heurística — no dejarlo parecer medido.
