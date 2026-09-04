<!-- SPDX-License-Identifier: AGPL-3.0-only -->
# Ralston et al. — Series semanales y ganancia de fuerza

Ref `"20"` · Ralston, Kilgore, Wyatt, Baker · *Sports Medicine* 47:2585-2601,
2017 · <https://doi.org/10.1007/s40279-017-0762-7> ·
<https://pmc.ncbi.nlm.nih.gov/articles/PMC5684266/>

Meta-análisis; 9 estudios elegibles de 6962 revisados.

## Lo que mide

Efecto del volumen semanal **por ejercicio** sobre la fuerza.

## Números que usa la app

| Banda | Series/semana por ejercicio | Tamaño de efecto |
|---|---|---|
| baja (LWS) | ≤ 5 | 0,82 |
| media (MWS) | 5-9 | — |
| alta (HWS) | ≥ 10 | 1,01 |

Diferencia alta vs baja: 0,18 (p = 0,003). La banda baja rinde claramente menos.
Los autores recomiendan la media para principiantes, y media o alta para
entrenados.

Da la **dirección** de los landmarks de fuerza en `goal-params.ts` (6/12/18).

## Lo que NO dice

- **Sus bandas son POR EJERCICIO, no por grupo muscular.** La app mide por grupo
  muscular, así que la traducción es aproximada. Los tres valores de fuerza en
  `GOAL_LANDMARKS` están **interpolados** entre este resultado y la banda de
  hipertrofia: son los menos firmes de la tabla, y el comentario del código lo
  dice.
- Solo 9 estudios. Los propios autores llaman "cautelosa" a su recomendación.
