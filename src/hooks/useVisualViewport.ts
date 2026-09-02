// SPDX-License-Identifier: AGPL-3.0-only
"use client";

import { useSyncExternalStore } from "react";

export interface ViewportBox {
  /** Alto de la zona realmente visible (px), ya descontado el teclado. */
  height: number;
  /** Desplazamiento de la zona visible dentro del layout viewport (px). */
  offsetTop: number;
}

/**
 * Caja visible real (visual viewport), para anclar overlays cuando se abre el
 * teclado virtual.
 *
 * En móvil el teclado NO achica el layout viewport: `position: fixed` con
 * `inset-0` sigue midiendo la pantalla entera, y `dvh` tampoco se entera — las
 * unidades de viewport contemplan la UI retráctil del navegador (barra de
 * direcciones), no el teclado, salvo que el meta viewport pida
 * `interactive-widget=resizes-content`. Por eso una hoja anclada abajo queda
 * atrás del teclado por más `dvh` que se le ponga.
 *
 * El visual viewport sí refleja el teclado, en Android (`resizes-visual`, el
 * default) y en iOS. Devuelve null en SSR o si el navegador no lo expone: ahí
 * el llamador se queda con el comportamiento por defecto.
 */
export function useVisualViewport(): ViewportBox | null {
  // Snapshot como string: useSyncExternalStore compara por identidad, así que
  // devolver un objeto nuevo en cada lectura sería un loop de renders.
  const snap = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
  if (!snap) return null;
  const [height, offsetTop] = snap.split(":").map(Number);
  return { height, offsetTop };
}

function subscribe(onChange: () => void): () => void {
  const vv = window.visualViewport;
  if (!vv) return () => {};
  vv.addEventListener("resize", onChange);
  vv.addEventListener("scroll", onChange);
  return () => {
    vv.removeEventListener("resize", onChange);
    vv.removeEventListener("scroll", onChange);
  };
}

function getSnapshot(): string {
  const vv = window.visualViewport;
  return vv ? `${Math.round(vv.height)}:${Math.round(vv.offsetTop)}` : "";
}

function getServerSnapshot(): string {
  return "";
}
