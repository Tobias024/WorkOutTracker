// SPDX-License-Identifier: AGPL-3.0-only
"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Button, Modal } from "@/components/ui";
import {
  CURRENT_VERSION,
  SEEN_VERSION_KEY,
  releasesSince,
  type Release,
} from "@/lib/changelog";

/** Ítems por versión en el popup; el resto se lee en /novedades. */
const MAX_ITEMS = 4;

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

  return (
    <Modal
      open={pending.length > 0}
      onClose={dismiss}
      title="Qué hay de nuevo"
      // Tocar el fondo (o Escape) no la cierra: un toque accidental no tiene
      // que marcarla como vista. Sólo la X y "Entendido" la dan por leída.
      // Modal no distingue el origen del cierre, así que se bloquean ambos.
      dismissible={false}
      footer={
        <Button className="w-full" onClick={dismiss}>
          Entendido
        </Button>
      }
    >
      {pending.map((r) => (
        <div key={r.version} className="mb-4 last:mb-0">
          {pending.length > 1 && (
            <p className="text-xs text-muted mb-1.5">v{r.version}</p>
          )}
          <ul className="flex flex-col gap-2">
            {r.items.slice(0, MAX_ITEMS).map((item) => (
              <li key={item} className="flex gap-2 text-sm">
                <span className="text-primary shrink-0">·</span>
                <span>{item}</span>
              </li>
            ))}
          </ul>
        </div>
      ))}
      <Link
        href="/novedades"
        onClick={dismiss}
        className="mt-4 inline-flex min-h-11 items-center text-sm font-medium text-primary underline-offset-2 hover:underline"
      >
        Ver todas las novedades
      </Link>
    </Modal>
  );
}
