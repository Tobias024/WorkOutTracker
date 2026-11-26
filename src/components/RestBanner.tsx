// SPDX-License-Identifier: AGPL-3.0-only
"use client";

import { RestTimer } from "@/components/RestTimer";
import {
  REST_DEFAULT_SECONDS,
  useRestSeconds,
  useRestStore,
} from "@/hooks/useRestTimer";

/** Banner de descanso: suscrito al reloj acá, no en la pantalla de entreno. */
export function RestBanner({
  hint,
  onStart,
}: {
  hint: string | null;
  onStart: () => void;
}) {
  const elapsed = useRestSeconds();
  const startedAt = useRestStore((s) => s.startedAt);
  const targetSeconds = useRestStore((s) => s.targetSeconds);
  return (
    <RestTimer
      elapsed={elapsed}
      startedAt={startedAt ?? 0}
      targetSeconds={targetSeconds ?? REST_DEFAULT_SECONDS}
      hint={hint}
      onAdd={(sec) => useRestStore.getState().addTarget(sec)}
      onStart={onStart}
    />
  );
}
