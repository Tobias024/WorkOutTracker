// SPDX-License-Identifier: AGPL-3.0-only
"use client";

import { useSyncExternalStore } from "react";

export type Theme = "classic" | "girly";

export const THEME_KEY = "wot-theme";

/** Color de la barra del sistema (PWA) por tema — matchea --color-bg. */
const META_COLOR: Record<Theme, string> = {
  classic: "#09090b",
  girly: "#f6ebe1",
};

/** Aplica el tema al DOM: setea/quita data-theme y actualiza theme-color. */
export function applyTheme(theme: Theme) {
  const root = document.documentElement;
  if (theme === "girly") root.dataset.theme = "girly";
  else delete root.dataset.theme;

  const meta = document.querySelector('meta[name="theme-color"]');
  if (meta) meta.setAttribute("content", META_COLOR[theme]);
}

/** Lee el tema activo desde el DOM (lo dejó el script inline del layout). */
function readTheme(): Theme {
  if (typeof document !== "undefined" && document.documentElement.dataset.theme === "girly")
    return "girly";
  return "classic";
}

const THEME_EVENT = "wot-theme-change";

function subscribe(cb: () => void) {
  window.addEventListener(THEME_EVENT, cb);
  window.addEventListener("storage", cb);
  return () => {
    window.removeEventListener(THEME_EVENT, cb);
    window.removeEventListener("storage", cb);
  };
}

/**
 * Preferencia de paleta, persistida en localStorage (por dispositivo, sin
 * backend). La fuente de verdad es el DOM (`data-theme`, que el script inline
 * del layout aplica antes del primer paint): se lee con useSyncExternalStore,
 * con "classic" como snapshot del servidor para no romper la hidratación, y
 * sin el efecto + setState de antes (render en cascada al montar).
 */
export function useTheme(): { theme: Theme; setTheme: (t: Theme) => void } {
  const theme = useSyncExternalStore<Theme>(subscribe, readTheme, () => "classic");

  function setTheme(t: Theme) {
    try {
      localStorage.setItem(THEME_KEY, t);
    } catch {
      // localStorage no disponible (modo privado, etc.): igual aplicamos.
    }
    applyTheme(t);
    window.dispatchEvent(new Event(THEME_EVENT));
  }

  return { theme, setTheme };
}
