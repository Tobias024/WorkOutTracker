// SPDX-License-Identifier: AGPL-3.0-only
"use client";

import { useEffect, useState } from "react";
import { Sparkles } from "lucide-react";
import { Button } from "@/components/ui";
import {
  CURRENT_VERSION,
  SEEN_VERSION_KEY,
  releasesSince,
  type Release,
} from "@/lib/changelog";

/**
 * Popup de novedades al abrir la app después de una actualización.
 *
 * Tres reglas para que no sea molesto, que es el riesgo real de esta clase de
 * feature:
 *  1. MUDO LA PRIMERA VEZ: sin versión guardada (usuario nuevo, navegador
 *     nuevo, storage limpio) se guarda la actual y no se muestra nada. Nadie
 *     recibe un changelog de cosas que nunca le faltaron.
 *  2. Sólo releases marcados `notable`. Los arreglos chicos no interrumpen.
 *  3. Si se saltearon versiones, se juntan en un solo popup.
 *
 * Se monta en (app)/layout.tsx junto a ActiveSessionGuard y
 * PendingInviteHandler, que son este mismo patrón: componente sin UI propia
 * que a veces muestra algo.
 */
export function WhatsNewModal() {
  const [pending, setPending] = useState<Release[]>([]);

  useEffect(() => {
    let seen: string | null = null;
    try {
      seen = localStorage.getItem(SEEN_VERSION_KEY);
    } catch {
      // localStorage no disponible (modo privado): sin memoria no hay forma de
      // saber qué vio, y mostrarlo en cada carga sería exactamente la molestia
      // que queremos evitar. Mejor no mostrar nada.
      return;
    }
    if (seen == null) {
      // Primera vez: sólo marcamos dónde está parado.
      try {
        localStorage.setItem(SEEN_VERSION_KEY, CURRENT_VERSION);
      } catch {}
      return;
    }
    const releases = releasesSince(seen);
    // El estado tiene que salir de un efecto y no de un initializer de
    // useState: el servidor no ve localStorage, así que decidir en el primer
    // render devolvería null en el server y el modal en el cliente → mismatch
    // de hidratación. Es un render extra, una sola vez al abrir la app.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (releases.length > 0) setPending(releases);
    else if (seen !== CURRENT_VERSION) {
      // Al día en lo notable, pero la versión guardada quedó vieja: se sincroniza
      // en silencio para no re-evaluar en cada carga.
      try {
        localStorage.setItem(SEEN_VERSION_KEY, CURRENT_VERSION);
      } catch {}
    }
  }, []);

  function dismiss() {
    try {
      localStorage.setItem(SEEN_VERSION_KEY, CURRENT_VERSION);
    } catch {}
    setPending([]);
  }

  if (pending.length === 0) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/65 backdrop-blur-sm"
      onClick={dismiss}
    >
      <div
        className="card w-full sm:max-w-lg rounded-t-3xl rounded-b-none p-6 pb-8"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center gap-3 mb-4">
          <div className="size-11 rounded-full bg-primary/15 grid place-items-center shrink-0">
            <Sparkles className="size-5 text-primary" />
          </div>
          <div className="min-w-0">
            <p className="text-xs font-bold tracking-[0.12em] text-primary">
              NOVEDADES
            </p>
            <h2 className="text-lg font-extrabold tracking-tight">
              Qué hay de nuevo
            </h2>
          </div>
        </div>

        {pending.map((r) => (
          <div key={r.version} className="mb-4 last:mb-0">
            {pending.length > 1 && (
              <p className="text-xs text-muted mb-1.5">v{r.version}</p>
            )}
            <ul className="flex flex-col gap-2">
              {r.items.map((item) => (
                <li key={item} className="flex gap-2 text-sm">
                  <span className="text-primary shrink-0">·</span>
                  <span>{item}</span>
                </li>
              ))}
            </ul>
          </div>
        ))}

        <Button className="mt-5 w-full" onClick={dismiss}>
          Entendido
        </Button>
      </div>
    </div>
  );
}
