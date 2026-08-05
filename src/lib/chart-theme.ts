"use client";

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

const classic: ChartColors = {
  axis: "#9c9a92",
  primary: "#cda548",
  accent: "#e8c468",
  neutral: "#3a3833",
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
  axis: "#9a6f79",
  primary: "#b25c7d",
  accent: "#d98c6a",
  neutral: "#d9c3bf",
  series: ["#b25c7d", "#d98c6a", "#8a9a6b", "#c98fb0"],
  tip: {
    background: "#fdf6f0",
    border: "1px solid #e6c9c6",
    borderRadius: 8,
    color: "#4a2b39",
    fontSize: 12,
  },
  tipLabel: "#9a6f79",
};

/** Devuelve la paleta de gráficos del tema activo. */
export function useChartColors(): ChartColors {
  const { theme } = useTheme();
  return theme === "girly" ? girly : classic;
}
