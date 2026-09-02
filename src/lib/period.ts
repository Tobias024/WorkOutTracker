// SPDX-License-Identifier: AGPL-3.0-only
import { weekStart } from "@/lib/metrics";

export type Period = "week" | "month" | "all";

/**
 * Zona horaria del dispositivo (IANA, ej. "America/Argentina/Buenos_Aires").
 * Se manda a las RPC para que agrupen las sesiones por día LOCAL: agrupar en
 * UTC contaba un entreno de noche en UTC-3 como del día siguiente.
 */
export function localTimeZone(): string {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";
  } catch {
    return "UTC";
  }
}

/** Inicio del mes calendario en curso (00:00 local). */
function monthStart(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), 1);
}

/**
 * Fecha ISO de inicio de un período. Son períodos CALENDARIO (la semana arranca
 * el lunes, el mes el día 1), no ventanas corridas: así "Semana" en el ranking
 * cuenta los mismos días que "Días esta semana" en Registro.
 */
export function sinceFor(period: Period): string {
  const now = new Date();
  if (period === "week") return weekStart(now).toISOString();
  if (period === "month") return monthStart(now).toISOString();
  return new Date("1970-01-01").toISOString();
}

/**
 * Período calendario anterior (semana o mes previo completo) para comparar el
 * ranking contra el período previo y mostrar movimiento. Devuelve null para
 * "all" (no hay período anterior con sentido).
 */
export function prevRangeFor(
  period: Period,
): { since: string; until: string } | null {
  if (period === "all") return null;
  const now = new Date();
  if (period === "week") {
    const curStart = weekStart(now);
    const prevStart = new Date(curStart);
    prevStart.setDate(prevStart.getDate() - 7);
    return { since: prevStart.toISOString(), until: curStart.toISOString() };
  }
  const curStart = monthStart(now);
  const prevStart = new Date(
    curStart.getFullYear(),
    curStart.getMonth() - 1,
    1,
  );
  return { since: prevStart.toISOString(), until: curStart.toISOString() };
}
