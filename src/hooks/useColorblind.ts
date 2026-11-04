// SPDX-License-Identifier: AGPL-3.0-only
"use client";

import { useCallback, useSyncExternalStore } from "react";

export const CB_KEY = "wot-cb";
const CB_EVENT = "wot-cb-change";

/** Activa/desactiva el modo daltónico (data-cb en <html>) y lo persiste. */
export function applyColorblind(on: boolean): void {
  if (typeof document === "undefined") return;
  if (on) document.documentElement.dataset.cb = "1";
  else delete document.documentElement.dataset.cb;
  try {
    if (on) localStorage.setItem(CB_KEY, "1");
    else localStorage.removeItem(CB_KEY);
  } catch {
    // storage no disponible: el atributo igual aplica en esta sesión
  }
  window.dispatchEvent(new Event(CB_EVENT));
}

function subscribe(cb: () => void) {
  window.addEventListener(CB_EVENT, cb);
  window.addEventListener("storage", cb);
  return () => {
    window.removeEventListener(CB_EVENT, cb);
    window.removeEventListener("storage", cb);
  };
}

const getSnapshot = () => document.documentElement.dataset.cb === "1";
const getServerSnapshot = () => false;

export function useColorblind(): {
  colorblind: boolean;
  setColorblind: (v: boolean) => void;
} {
  const colorblind = useSyncExternalStore(
    subscribe,
    getSnapshot,
    getServerSnapshot,
  );
  const setColorblind = useCallback((v: boolean) => applyColorblind(v), []);
  return { colorblind, setColorblind };
}
