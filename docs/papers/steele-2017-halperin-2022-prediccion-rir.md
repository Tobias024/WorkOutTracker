<!-- SPDX-License-Identifier: AGPL-3.0-only -->
# Steele 2017 · Halperin 2022 — Qué tan bien se predice el RIR

Refs `"9"` y `"10"`. Ficha conjunta porque sostienen la misma decisión.

- Steele et al. 2017 · *PeerJ* · <https://peerj.com/articles/4105/>
- Halperin et al. 2022 · *Sports Medicine* ·
  <https://doi.org/10.1007/s40279-021-01559-x> (revisión de alcance + meta-análisis)

## Lo que miden

La exactitud con la que una persona estima cuántas repeticiones le quedaban
antes del fallo.

## Números que usa la app

- **El error es sistemático y tiene una dirección: se SUBESTIMA.** La gente dice
  que le quedaban menos reps de las que realmente le quedaban. Steele: quienes
  tienen experiencia se equivocan por ~1-2 reps; sin experiencia, ~4-5.
- **La precisión mejora cerca del fallo** y con series cortas. Halperin no
  encuentra diferencias de exactitud cuando la serie baja de ~12 reps
  (cargas por encima de ~70 % de 1RM); más lejos del fallo, peor.

De acá salen dos decisiones:

1. **Quién manda en la diagonal conflictiva** de `loadAdvice` (reps por debajo
   del objetivo + RIR por encima). Como el error va hacia la subestimación, un
   RIR alto reportado es real *como mínimo*: si el usuario dice que le quedaban
   4, le quedaban 4 o más. Entonces la carga **sí permitía** las repeticiones y
   el usuario paró antes. No es un problema de carga → la app responde
   "el peso está bien: llegá a las reps" en vez de sugerir bajarlo.
2. **El RIR nunca escala la magnitud a `far`** cuando es la única señal
   (`byRir`), y en **resistencia** el ⓘ aclara que en series largas el RIR es una
   estimación gruesa: es el rango donde estos dos papers muestran la peor
   precisión.

## Lo que NO dice

- **No dice que un RIR bajo reportado sea falso.** El sesgo va en la otra
  dirección: el RIR real tiende a ser *más alto* que el declarado. Por eso la
  app no descuenta ni corrige el valor que el usuario carga — sólo lo usa con
  menos peso cuando es la única señal.
- **No dice que el RIR no sirva.** Dice que es ruidoso lejos del fallo y que
  mejora con experiencia. Sigue siendo la base de la autorregulación (ref `"6"`).
- No habla de adaptaciones. Cuánta hipertrofia o fuerza produce cada RIR es
  ref `"19"`.
