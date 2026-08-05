"use client";

import { useEffect, useState } from "react";

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

/**
 * Preferencia de paleta, persistida en localStorage (por dispositivo, sin
 * backend). El estado inicial es "classic" para no romper la hidratación SSR;
 * tras montar se sincroniza con lo que el script inline ya aplicó al DOM.
 */
export function useTheme(): { theme: Theme; setTheme: (t: Theme) => void } {
  const [theme, setThemeState] = useState<Theme>("classic");

  useEffect(() => {
    setThemeState(readTheme());
  }, []);

  function setTheme(t: Theme) {
    setThemeState(t);
    try {
      localStorage.setItem(THEME_KEY, t);
    } catch {
      // localStorage no disponible (modo privado, etc.): igual aplicamos.
    }
    applyTheme(t);
  }

  return { theme, setTheme };
}
