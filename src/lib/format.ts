// SPDX-License-Identifier: AGPL-3.0-only
// Helpers de formato (es-AR).

export function formatDate(iso: string | null): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("es-AR", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

export function formatDateTime(iso: string | null): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleString("es-AR", {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}

/** Segundos → "1h 23m 45s" / "23:45". */
export function formatDuration(totalSeconds: number | null): string {
  if (!totalSeconds || totalSeconds < 0) return "—";
  const h = Math.floor(totalSeconds / 3600);
  const m = Math.floor((totalSeconds % 3600) / 60);
  const s = Math.floor(totalSeconds % 60);
  if (h > 0) return `${h}h ${m}m`;
  return `${m}:${String(s).padStart(2, "0")}`;
}

/** Cronómetro mm:ss o hh:mm:ss. */
export function formatClock(totalSeconds: number): string {
  const h = Math.floor(totalSeconds / 3600);
  const m = Math.floor((totalSeconds % 3600) / 60);
  const s = Math.floor(totalSeconds % 60);
  const mm = String(m).padStart(2, "0");
  const ss = String(s).padStart(2, "0");
  return h > 0 ? `${h}:${mm}:${ss}` : `${mm}:${ss}`;
}


/** Metros → "5,2 km" (o "800 m" por debajo del kilómetro). */
export function formatDistance(meters: number | null): string {
  if (meters == null) return "—";
  if (meters < 1000) return `${Math.round(meters)} m`;
  return `${(meters / 1000).toFixed(2).replace(/\.?0+$/, "")} km`;
}

/** Ritmo min/km a partir de duración y distancia. null si falta alguno. */
export function formatPace(
  seconds: number | null,
  meters: number | null,
): string | null {
  if (!seconds || !meters) return null;
  const secPerKm = seconds / (meters / 1000);
  if (!Number.isFinite(secPerKm)) return null;
  const m = Math.floor(secPerKm / 60);
  const s = Math.round(secPerKm % 60);
  return `${m}:${String(s).padStart(2, "0")}/km`;
}

const NUM_FMT = new Map<number, Intl.NumberFormat>();

/** Número en formato es-AR: "24.850", "12,5". `decimals` = máximo de decimales
 *  (no rellena con ceros). Usar SIEMPRE esto y no `toFixed`: en es-AR "24.9" se
 *  lee como veinticuatro mil novecientos. */
export function fmtNum(n: number, decimals = 0): string {
  let f = NUM_FMT.get(decimals);
  if (!f) {
    f = new Intl.NumberFormat("es-AR", { maximumFractionDigits: decimals });
    NUM_FMT.set(decimals, f);
  }
  return f.format(n);
}

export function formatWeight(kg: number | null): string {
  if (kg == null) return "—";
  return `${fmtNum(kg, 1)} kg`;
}

export function formatVolume(kg: number): string {
  if (kg >= 1000) return `${fmtNum(kg / 1000, 1)} t`;
  return `${fmtNum(Math.round(kg))} kg`;
}

/** "1 serie" / "12,5 series": unidad concordada para conteos de series. */
export function fmtSeries(n: number, decimals = 1): string {
  return `${fmtNum(n, decimals)} ${n === 1 ? "serie" : "series"}`;
}

const COMPACT_FMT = new Intl.NumberFormat("es-AR", {
  notation: "compact",
  maximumFractionDigits: 1,
});

/** Número compacto para ticks de ejes: 2500 → "2,5 mil". Evita los ticks
 *  duplicados que salían de redondear a miles enteros. */
export function fmtCompact(n: number): string {
  return COMPACT_FMT.format(n);
}

/** Recencia en lenguaje natural: "hoy", "ayer", "hace 3 días". */
export function fmtDaysAgo(days: number): string {
  if (days <= 0) return "hoy";
  if (days === 1) return "ayer";
  return `hace ${days} días`;
}
