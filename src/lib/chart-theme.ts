// SPDX-License-Identifier: AGPL-3.0-only
"use client";

import { useColorblind } from "@/hooks/useColorblind";
import { useTheme } from "@/hooks/useTheme";

/**
 * Paleta para gráficos recharts. recharts necesita strings de color literales
 * (var() no resuelve en atributos SVG), así que en vez de leer los tokens CSS
 * elegimos la paleta según el tema activo.
 */
export interface ChartColors {
  axis: string;
  primary: string;
  accent: string;
  /** Neutral apagado (ej. lado "Aislamiento" del balance de patrones). */
  neutral: string;
  /** 7 colores distinguibles (≥3:1 vs surface) para donas/categorías. */
  categorical: string[];
  /** Color de la porción "Otros". */
  other: string;
  /** Colores por serie para líneas múltiples. */
  series: string[];
  /** Estilo del tooltip (contentStyle de recharts). */
  tip: {
    background: string;
    border: string;
    borderRadius: number;
    color: string;
    fontSize: number;
  };
  /** Color del label del tooltip (labelStyle). */
  tipLabel: string;
}

export const CLASSIC_CAT = [
  "#cda548",
  "#7bb0d1",
  "#6fc29b",
  "#d19a6f",
  "#b08fd1",
  "#e07a8c",
  "#9c9a92",
];
export const GIRLY_CAT = [
  "#86395a",
  "#c4693f",
  "#2a7048",
  "#3d7fa8",
  "#8a6bb0",
  "#a8681f",
  "#8c7a78",
];
/** Okabe-Ito-like, sin verde (modo daltónico). Todas ≥3:1 vs su surface. */
export const CLASSIC_CAT_CB = [
  "#cda548",
  "#56b4e9",
  "#d55e00",
  "#cc79a7",
  "#b08fd1",
  "#f0e442",
  "#9c9a92",
];
export const GIRLY_CAT_CB = [
  "#86395a",
  "#0072b2",
  "#c24f00",
  "#7a5ca8",
  "#8c6d00",
  "#b3367a",
  "#8c7a78",
];

const classic: ChartColors = {
  axis: "#9c9a92",
  primary: "#cda548",
  accent: "#e8c468",
  neutral: "#6b6860",
  categorical: CLASSIC_CAT,
  other: "#9c9a92",
  series: ["#cda548", "#7bb0d1", "#8fbf7b", "#d19a6f"],
  tip: {
    background: "#1c1c1a",
    border: "1px solid #2e2c27",
    borderRadius: 8,
    color: "#f2f1ed",
    fontSize: 12,
  },
  tipLabel: "#9c9a92",
};

const girly: ChartColors = {
  axis: "#7d5562",
  primary: "#86395a",
  accent: "#d98c6a",
  neutral: "#917974",
  categorical: GIRLY_CAT,
  other: "#8c7a78",
  // Familias distintas (malva / azul / verde / naranja): con dos rosados
  // contiguos la barra empuje/tirón no se distinguía. Todos ≥3:1 vs surface.
  series: ["#86395a", "#3d7fa8", "#2a7048", "#c4693f"],
  tip: {
    background: "#fdf6f0",
    border: "1px solid #e6c9c6",
    borderRadius: 8,
    color: "#4a2b39",
    fontSize: 12,
  },
  tipLabel: "#7d5562",
};

/** Devuelve la paleta de gráficos del tema activo. */
export function useChartColors(): ChartColors {
  const { theme } = useTheme();
  const { colorblind } = useColorblind();
  const isGirly = theme === "girly";
  const base = isGirly ? girly : classic;
  if (!colorblind) return base;
  return {
    ...base,
    categorical: isGirly ? GIRLY_CAT_CB : CLASSIC_CAT_CB,
    series: isGirly
      ? ["#86395a", "#c24f00", "#0072b2", "#b3367a"]
      : ["#cda548", "#56b4e9", "#cc79a7", "#d55e00"],
  };
}
