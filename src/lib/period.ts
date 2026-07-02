export type Period = "week" | "month" | "all";

/** Fecha ISO de inicio para un período relativo a ahora. */
export function sinceFor(period: Period): string {
  const now = Date.now();
  if (period === "week") return new Date(now - 7 * 86400000).toISOString();
  if (period === "month") return new Date(now - 30 * 86400000).toISOString();
  return new Date("1970-01-01").toISOString();
}
