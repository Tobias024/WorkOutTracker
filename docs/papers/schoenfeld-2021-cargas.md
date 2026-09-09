<!-- SPDX-License-Identifier: AGPL-3.0-only -->
# Schoenfeld et al. — Loading Recommendations (continuo de repeticiones)

Ref `"4"` · *Sports* 2021 · <https://pmc.ncbi.nlm.nih.gov/articles/PMC7927075/>
· <https://doi.org/10.3390/sports9020032>

Reexamen del "continuo de repeticiones" clásico (fuerza 1-5 / hipertrofia 6-12 /
resistencia 15+).

## Lo que mide

Qué rango de repeticiones y qué cargas producen cada adaptación.

## Números que usa la app

- **Hipertrofia: ~5 a ~30 reps producen resultados equivalentes** con volumen
  igualado y series cerca del fallo. Los límites duros entre zonas se reemplazan
  por espectros superpuestos.
- **Carga mínima útil: ~30 % de 1RM.**
- **Fuerza: requiere cargas altas** (≥ ~60 % 1RM); es la adaptación más
  dependiente de la carga.

De acá sale el **rango de reps por objetivo** en `goal-params.ts`:

| | piso (`hardSetMinReps`) | techo (`repRangeMax`) |
|---|---|---|
| fuerza | 1 (la moneda de volumen son las series, no las reps — ref `"7"`) | 6 |
| hipertrofia | 5 | 30 |
| resistencia | 12 | sin techo |

**El techo de fuerza (6) es una lectura práctica, no un número del paper.** Sale
de traducir el "≥60 % de 1RM" (y el ≥80 % donde la carga rinde más) a
repeticiones. El paper no escribe "6".

El techo sólo lo usa la sugerencia de carga (`loadAdvice`), **no** `isHardSet`:
una serie de 35 reps sigue contando como volumen efectivo, lo que dice el techo
es que la carga quedó liviana para el objetivo.

## Lo que NO dice

- **No dice que haya que quedarse en 8-12.** Una serie de 6 reps está dentro del
  rango efectivo para hipertrofia; marcarla como "peso demasiado alto" sería
  contradecir este mismo paper.
- **No dice que menos de 5 reps no sirva.** Dice que hay menos evidencia ahí y
  que la eficiencia por serie parece menor. El piso de 5 es donde la app deja de
  contar la serie como volumen efectivo, no una afirmación de que no pase nada.
- **No dice dónde está el techo de cada objetivo.** Los 30 de hipertrofia salen
  del extremo del rango que el paper sí examina; el 6 de fuerza es una
  traducción del porcentaje de 1RM. Ninguno de los dos es una prescripción
  textual.
- No habla de series por semana. Para eso, fichas `"1"` y `"16"`.
