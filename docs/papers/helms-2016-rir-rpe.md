<!-- SPDX-License-Identifier: AGPL-3.0-only -->
# Helms et al. — Escala RPE basada en repeticiones en reserva

Ref `"21"` · Helms, Cronin, Storey, Zourdos · *Strength and Conditioning Journal*
38(4):42-49, 2016 · <https://pmc.ncbi.nlm.nih.gov/articles/PMC4961270/>

Artículo metodológico: cómo aplicar una escala de RPE anclada en RIR para
prescribir y autorregular la carga.

## Lo que propone

Prescribir la serie como **"N reps @ RIR X"** en vez de como un porcentaje de
1RM, y dejar que el resultado de la serie ajuste la carga.

## Números que usa la app

La regla base de la matriz de `loadAdvice` en `goal-params.ts`. Los autores
describen prescribir un RIR objetivo "en todas las series" de modo que el
levantador sepa **reducir la intensidad si no logra completar las repeticiones**,
o **aumentarla si completa las series con más RIR del prescrito**.

Eso es literalmente dos de las tres filas de la matriz:

| reps | RIR | acción |
|---|---|---|
| por debajo del objetivo | — | bajar la carga |
| en el objetivo | por encima del objetivo | subir la carga |

También sostiene el aviso de **resistencia**: la escala "debería usarse
principalmente" para series cerca del fallo (RPE 7-10), y **no es apropiada**
lejos del fallo o por debajo del 80 % de 1RM, por la incapacidad de estimar el
RIR a esa distancia. Todas las series de resistencia local caen ahí.

## Lo que NO dice

- **No da porcentajes de ajuste.** No dice "si te sobró 1 RIR, subí 2,5 %". La
  app tampoco los inventa: sugiere la dirección, no la magnitud del cambio.
- **No resuelve el caso donde reps y RIR fallan a la vez.** El artículo asume que
  el levantador llega a las reps; el cuadrante "me faltaron reps pero paré lejos
  del fallo" no está tratado. Eso lo decide la app apoyada en las refs `"9"` y
  `"10"` — ver `steele-2017-halperin-2022-prediccion-rir.md`.
- No es un estudio de intervención: no compara adaptaciones. Para eso, refs
  `"19"` (proximidad al fallo) y `"4"` (cargas).
