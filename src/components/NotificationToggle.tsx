"use client";

import { useEffect, useState } from "react";
import { Bell, BellOff } from "lucide-react";
import { enablePush, getPushState, type PushState } from "@/lib/push";
import { clsx } from "@/lib/clsx";

/** Botón para activar las notificaciones push del ranking. */
export function NotificationToggle() {
  const [state, setState] = useState<PushState | null>(null);
  const [loading, setLoading] = useState(false);

  // Se lee después de montar: Notification/PushManager no existen en SSR, y
  // así evitamos un mismatch de hidratación.
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setState(getPushState());
  }, []);

  if (state === null || state === "unsupported") return null;

  async function activate() {
    setLoading(true);
    const res = await enablePush();
    setLoading(false);
    if (res.ok) {
      setState("granted");
    } else if (res.reason === "denied") {
      setState("denied");
    } else if (res.reason === "missing-key") {
      alert("Las notificaciones no están configuradas en el servidor todavía.");
    } else {
      alert("No se pudieron activar las notificaciones. Probá de nuevo.");
    }
  }

  const active = state === "granted";
  const denied = state === "denied";

  return (
    <button
      onClick={active ? undefined : denied ? undefined : activate}
      disabled={loading || active || denied}
      title={
        active
          ? "Notificaciones activadas"
          : denied
            ? "Bloqueaste las notificaciones en el navegador"
            : "Activar notificaciones del ranking"
      }
      className={clsx(
        "inline-flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-sm font-medium ring-1 transition",
        active
          ? "text-primary ring-primary/40 bg-primary/10"
          : denied
            ? "text-muted ring-border opacity-60"
            : "text-muted ring-border hover:text-fg",
      )}
    >
      {denied ? <BellOff className="size-4" /> : <Bell className="size-4" />}
      <span>{active ? "Activadas" : denied ? "Bloqueadas" : "Notificar"}</span>
    </button>
  );
}
