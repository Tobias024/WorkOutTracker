// SPDX-License-Identifier: AGPL-3.0-only
"use client";

import { useEffect, useState } from "react";
import { formatClock } from "@/lib/format";

/**
 * Segundos transcurridos de una sesión. Con la sesión terminada es un valor
 * fijo (sin intervalo); en curso se actualiza cada 1 s. El tick vive acá para
 * que solo se re-renderice esta hoja y no la pantalla entera.
 */
export function useElapsedSeconds(
  startedAt: string | null,
  endedAt: string | null,
  durationSeconds: number | null,
  active = true,
): number {
  const ended = !!endedAt;
  const [now, setNow] = useState(0);
  useEffect(() => {
    if (!active) return;
    const tick = () => setNow(Date.now());
    tick();
    if (ended) return;
    const t = setInterval(tick, 1000);
    return () => clearInterval(t);
  }, [ended, active]);

  if (!startedAt) return 0;
  if (ended && durationSeconds != null) return durationSeconds;
  return Math.max(
    0,
    Math.floor(
      ((ended && endedAt ? new Date(endedAt).getTime() : now) -
        new Date(startedAt).getTime()) /
        1000,
    ),
  );
}

export function ElapsedClock({
  startedAt,
  endedAt,
  durationSeconds,
  suffix = "",
}: {
  startedAt: string | null;
  endedAt: string | null;
  durationSeconds: number | null;
  suffix?: string;
}) {
  const elapsed = useElapsedSeconds(startedAt, endedAt, durationSeconds);
  return (
    <>
      {formatClock(elapsed)}
      {suffix}
    </>
  );
}
