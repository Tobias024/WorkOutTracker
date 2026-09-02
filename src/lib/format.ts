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

/**
 * Inverso de `formatClock` para los campos de carga. Acepta "mm:ss", "h:mm:ss"
 * y un número suelto, que se lee como SEGUNDOS (una plancha se piensa en
 * segundos; una corrida se escribe con ":"). Devuelve null si no se entiende.
 */
export function parseClock(raw: string): number | null {
  const t = raw.trim();
  if (!t) return null;
  if (!t.includes(":")) {
    const n = Number(t);
    return Number.isFinite(n) && n >= 0 ? Math.round(n) : null;
  }
  const parts = t.split(":").map((p) => Number(p.trim() || 0));
  if (parts.some((n) => !Number.isFinite(n) || n < 0)) return null;
  const [a, b, c] = parts;
  const total =
    parts.length === 2 ? a * 60 + b : parts.length === 3 ? a * 3600 + b * 60 + c : NaN;
  return Number.isFinite(total) ? Math.round(total) : null;
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

export function formatWeight(kg: number | null): string {
  if (kg == null) return "—";
  return `${Number.isInteger(kg) ? kg : kg.toFixed(1)} kg`;
}

export function formatVolume(kg: number): string {
  if (kg >= 1000) return `${(kg / 1000).toFixed(1)} t`;
  return `${Math.round(kg)} kg`;
}
