<!-- SPDX-License-Identifier: AGPL-3.0-only -->
# Robinson et al. — Proximidad al fallo

Ref `"19"` · Robinson, Pelland, Remmert, Refalo, Jukic, Steele, Zourdos ·
*Sports Medicine* 54:2069-2087, 2024 · <https://doi.org/10.1007/s40279-024-02069-2>

Serie de meta-regresiones sobre 55 estudios.

## Lo que mide

Relación entre las **repeticiones en reserva (RIR)** y las ganancias de
hipertrofia y de fuerza.

## Números que usa la app

- **Hipertrofia: la ganancia mejora cuanto más cerca del fallo.** Pendiente
  negativa, con intervalo que excluye el nulo.
- **Fuerza: la pendiente del RIR dio NULA.** Las ganancias son parecidas en un
  rango amplio de RIR.

De acá sale la asimetría de `GOAL_PARAMS`:

| | rirTooCloseBelow | rirProductiveMax | hardSetMaxRir |
|---|---|---|---|
| hipertrofia | null (no penaliza el fallo) | 3 | 3 |
| fuerza | 2 (fallo = fatiga sin rédito) | 4 | 4 |
| resistencia | 1 | 4 | 4 |

También sostiene el aviso "subí el peso o las reps" cuando el RIR supera
`hardSetMaxRir`: en hipertrofia una serie con RIR 4 no suma volumen efectivo.

## Lo que NO dice

- **No dice que haya que ir siempre al fallo.** Refalo 2023 (ref `"8"`) muestra
  que llegar al fallo real no agrega hipertrofia respecto a dejar reps en
  reserva. Lo que Robinson sostiene es la dirección de la pendiente, no que el
  óptimo sea RIR 0.
- Para fuerza NO dice que el RIR alto sea mejor: dice que es indiferente.
