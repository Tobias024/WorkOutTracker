<!-- SPDX-License-Identifier: AGPL-3.0-only -->
# Vigotsky et al. — El EMG no predice hipertrofia

Ref `"17"` · Vigotsky, Halperin, Trajano, Vieira · *Sports Medicine* 2022 ·
<https://doi.org/10.1007/s40279-021-01619-2>

Título completo: "Longing for a Longitudinal Proxy: Acutely Measured Surface EMG
Amplitude is not a Validated Predictor of Muscle Hypertrophy".

## Lo que dice

La amplitud del electromiograma de superficie, medida de forma aguda, **no es un
predictor validado** de la hipertrofia a largo plazo, y su fundamento
mecanicista es débil. Los estudios agudos que comparan la "potencia del
estímulo" entre ejercicios deben mirarse con escepticismo.

## Para qué lo usa la app

Es la razón de que `muscle-contributions.ts` use un peso **binario** (1.0 directo
/ 0.5 indirecto) y no un gradiente fino por ejercicio.

Versiones anteriores asignaban 0,2 / 0,3 / 0,4 / 0,5 según cuánto "parecía"
trabajar cada músculo en cada movimiento. Esa granularidad implica saber algo que
este paper dice que no se puede inferir del EMG. Además tenía un efecto perverso:
el peso curado a mano (0,3) quedaba POR DEBAJO del fallback genérico (0,35), así
que curar un ejercicio lo volvía más estricto que no curarlo.

## Lo que NO dice

- **No dice que el EMG no sirva para nada.** Sirve para saber si un músculo
  participa. Lo que no sostiene es graduar *cuánto* contribuye al crecimiento.
- No invalida la distinción directo/indirecto: esa viene de Pelland (ficha
  `"16"`), que la validó contra resultados de hipertrofia, no contra EMG.
