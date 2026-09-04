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

De acá sale `hardSetMinReps` en `goal-params.ts`: 5 para hipertrofia, 1 para
fuerza (donde la moneda de volumen son las series, no las reps — ref `"7"`),
12 para resistencia.

## Lo que NO dice

- **No dice que haya que quedarse en 8-12.** Una serie de 6 reps está dentro del
  rango efectivo para hipertrofia; marcarla como "peso demasiado alto" sería
  contradecir este mismo paper.
- **No dice que menos de 5 reps no sirva.** Dice que hay menos evidencia ahí y
  que la eficiencia por serie parece menor. El piso de 5 es donde la app deja de
  contar la serie como volumen efectivo, no una afirmación de que no pase nada.
- No habla de series por semana. Para eso, fichas `"1"` y `"16"`.
