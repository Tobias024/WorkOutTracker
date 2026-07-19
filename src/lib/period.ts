export type Period = "week" | "month" | "all";

/** Fecha ISO de inicio para un período relativo a ahora. */
export function sinceFor(period: Period): string {
  const now = Date.now();
  if (period === "week") return new Date(now - 7 * 86400000).toISOString();
  if (period === "month") return new Date(now - 30 * 86400000).toISOString();
  return new Date("1970-01-01").toISOString();
}

/**
 * Ventana anterior (del mismo largo, terminando donde arranca la actual) para
 * comparar el ranking contra el período previo y mostrar movimiento. Devuelve
 * null para "all" (no hay período anterior con sentido).
 */
export function prevRangeFor(
  period: Period,
): { since: string; until: string } | null {
  if (period === "all") return null;
  const days = period === "week" ? 7 : 30;
  const now = Date.now();
  return {
    since: new Date(now - 2 * days * 86400000).toISOString(),
    until: new Date(now - days * 86400000).toISOString(),
  };
}
