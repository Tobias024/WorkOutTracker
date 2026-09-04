<!-- SPDX-License-Identifier: AGPL-3.0-only -->
# Pelland et al. — The Resistance Training Dose Response

Ref `"16"` · Pelland, Remmert, Robinson, Hinson, Zourdos · *Sports Medicine* 2026
· <https://doi.org/10.1007/s40279-025-02344-w> · preprint: <https://sportrxiv.org/index.php/server/preprint/view/460>

Meta-regresión multinivel. Hipertrofia: 67 estudios, 2058 participantes.
Fuerza: 66 estudios, 490 efectos, 2020 participantes.

## Lo que mide

Efecto del **volumen semanal** y de la **frecuencia** sobre hipertrofia y fuerza.

Clasificó cada serie como **directa** o **indirecta** según su especificidad al
músculo medido, y probó tres formas de contar las indirectas:

| Esquema | Peso de la indirecta |
|---|---|
| total | 1.0 |
| **fractional** | **0.5** |
| direct | 0 |

## Números que usa la app

- **Indirecta = 0.5.** La fraccional tuvo "la evidencia relativa más fuerte" y
  fue la usada en los análisis primarios. → `INDIRECT` en `muscle-contributions.ts`.
- **Rendimientos decrecientes ≈ 11 series fraccionales/semana** para hipertrofia.
  → corrobora `MAV` de hipertrofia.
- **Frecuencia: efecto despreciable sobre hipertrofia** con volumen igualado. El
  intervalo creíble de la pendiente incluye el cero (probabilidad posterior
  91,3%, IC cruza cero). Para **fuerza** sí hay efecto consistente.
  → pesos del score de "listo para entrenar" (`LAG_WEIGHT` 0.6 / `RECOVERY_WEIGHT` 0.4).
- **Fuerza: meseta funcional**, con rendimientos decrecientes "considerablemente
  más pronunciados" que hipertrofia. Pendiente marginal 0,21%/serie.
  → por qué los landmarks de fuerza son más bajos que los de hipertrofia.
- Hipertrofia: la curva **no se aplana**. Más volumen sigue rindiendo, con más
  costo de recuperación. → por qué el MRV NO es una cantidad medida.

## Lo que NO dice

- **El "~4 series" NO es un mínimo de entrenamiento.** Es el volumen donde la
  media marginal estimada supera el *smallest detectable effect size* (SDES):
  un piso de **detección estadística**. Por debajo hay crecimiento, solo que
  demasiado chico para medirlo con confianza en un meta-análisis.

  Este archivo existe en parte por este error: se usó ese 4 como MEV, lo que
  subestimaba el volumen necesario por más de la mitad. El MEV sale de las
  bandas de Schoenfeld 2017 (ficha `"1"`), no de acá.

- **No desagrega por músculo.** Agrupa todos. No respalda un MEV distinto para
  pecho que para glúteos.

- **No dice que la frecuencia sea inútil.** Dice que su efecto *independiente*
  sobre la hipertrofia, con volumen igualado, es despreciable. Entrenar más
  seguido sigue siendo una forma práctica de acumular volumen.
