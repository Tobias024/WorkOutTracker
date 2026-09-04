<!-- SPDX-License-Identifier: AGPL-3.0-only -->
# Schoenfeld, Ogborn & Krieger — Volumen semanal e hipertrofia

Ref `"1"` · *Journal of Sports Sciences* 2017 · <https://pubmed.ncbi.nlm.nih.gov/27433992/>

Revisión sistemática y meta-análisis con dosis-respuesta. 15 estudios en el
modelo de dosis-respuesta, 21 ensayos controlados en el análisis por bandas.

## Lo que mide

Relación entre **series semanales POR GRUPO MUSCULAR** y ganancia de masa.

## Números que usa la app

| Series/semana | Hipertrofia |
|---|---|
| menos de 9 | 5,4 % |
| 10 a 19 | 6,6 % |
| 20 o más | 9,8 % |

Relación lineal de ~0,37 % de ganancia por serie semanal adicional.

De acá salen los landmarks de hipertrofia en `goal-params.ts`:

- **MEV 10** — piso de la banda productiva.
- **MAV 16** — centro de la banda 10-19.
- **MRV 20** — inicio de la banda de alto volumen.

## Lo que NO dice

- **No dice que pasarse de 20 sea malo.** Al revés: 20+ es la banda que MÁS
  rinde. Lo que sube es el costo de recuperación. Por eso el MRV en la app está
  descrito como bandera de fatiga y no como error.
- **No desagrega por músculo.** Las bandas son generales.
- Es anterior a la distinción directa/indirecta de Pelland (ficha `"16"`), así
  que su unidad de conteo no es exactamente la serie fraccional que calcula la
  app. Es la mejor referencia disponible por grupo muscular, pero la traducción
  de unidades es aproximada.
