// SPDX-License-Identifier: AGPL-3.0-only
/**
 * Punto de entrada ÚNICO para cargar los gráficos con next/dynamic. Todos los
 * `import()` dinámicos de gráficos apuntan acá: si cada uno apuntara a su
 * propio módulo (charts, VolumeChart, MuscleDonut), el bundler genera un chunk
 * por módulo y recharts (~340 KB) queda duplicado en cada uno.
 */
export * from "@/components/charts";
export { VolumeChart } from "@/components/VolumeChart";
export { MuscleDonut } from "@/components/MuscleDonut";
