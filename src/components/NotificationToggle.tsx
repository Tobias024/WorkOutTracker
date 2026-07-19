"use client";

import { useEffect, useState } from "react";
import { Bell, BellOff } from "lucide-react";
import {
  enablePush,
  disablePush,
  getPushState,
  isSubscribed,
  type PushState,
} from "@/lib/push";
import { Modal, Button } from "@/components/ui";
import { clsx } from "@/lib/clsx";

const REASONS: Record<string, string> = {
  "missing-key": "No están configuradas en el servidor (falta la VAPID key).",
  "save-failed": "No se pudo guardar la suscripción. Probá de nuevo.",
  denied: "Bloqueaste las notificaciones en el navegador.",
  unsupported: "Este navegador no soporta notificaciones.",
};

/** Botón + modal para activar/probar/desactivar las notificaciones del ranking. */
export function NotificationToggle() {
  const [perm, setPerm] = useState<PushState | null>(null);
  const [subscribed, setSubscribed] = useState(false);
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  // Se lee después de montar: Notification/PushManager no existen en SSR.
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setPerm(getPushState());
    isSubscribed().then(setSubscribed);
  }, []);

  if (perm === null || perm === "unsupported") return null;

  const active = perm === "granted" && subscribed;
  const denied = perm === "denied";

  async function activate() {
    setBusy(true);
    setMsg(null);
    const res = await enablePush();
    setBusy(false);
    if (res.ok) {
      setPerm("granted");
      setSubscribed(true);
      setMsg("¡Notificaciones activadas!");
    } else if (res.reason === "denied") {
      setPerm("denied");
    } else {
      setMsg(REASONS[res.reason] ?? "No se pudieron activar. Probá de nuevo.");
    }
  }

  async function test() {
    setBusy(true);
    setMsg(null);
    try {
      const res = await fetch("/api/push/test", { method: "POST" });
      const data = (await res.json().catch(() => ({}))) as {
        sent?: number;
        error?: string;
      };
      setMsg(
        res.ok
          ? "Enviada ✓ Fijate que te haya llegado."
          : `No se pudo enviar: ${data.error ?? res.statusText}`,
      );
    } catch {
      setMsg("No se pudo enviar la prueba.");
    } finally {
      setBusy(false);
    }
  }

  async function deactivate() {
    setBusy(true);
    setMsg(null);
    await disablePush();
    setSubscribed(false);
    setBusy(false);
    setMsg("Notificaciones desactivadas.");
  }

  return (
    <>
      <button
        onClick={() => {
          setMsg(null);
          setOpen(true);
        }}
        title="Notificaciones del ranking"
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

      <Modal
        open={open}
        onClose={() => setOpen(false)}
        title="Notificaciones del ranking"
      >
        <div className="flex flex-col gap-3">
          {denied ? (
            <>
              <p className="text-sm text-muted">
                Bloqueaste las notificaciones para este sitio, así que no se
                pueden reactivar desde acá. Para volver a permitirlas:
              </p>
              <ol className="text-sm text-muted list-decimal pl-5 space-y-1">
                <li>
                  Tocá el candado / ícono a la izquierda de la dirección del
                  sitio.
                </li>
                <li>
                  Entrá a <span className="text-fg">Notificaciones</span> (o
                  Permisos del sitio) y ponelo en{" "}
                  <span className="text-fg">Permitir</span>.
                </li>
                <li>Recargá la página y activá de nuevo.</li>
              </ol>
            </>
          ) : active ? (
            <>
              <p className="text-sm text-muted">
                Están activadas. Te avisamos cuando un amigo te pasa en el
                ranking.
              </p>
              <div className="flex gap-2">
                <Button
                  variant="secondary"
                  className="flex-1"
                  loading={busy}
                  onClick={test}
                >
                  Enviar prueba
                </Button>
                <Button
                  variant="ghost"
                  className="flex-1"
                  loading={busy}
                  onClick={deactivate}
                >
                  Desactivar
                </Button>
              </div>
            </>
          ) : (
            <>
              <p className="text-sm text-muted">
                Activá las notificaciones para enterarte cuando un amigo te pasa
                en el ranking.
              </p>
              <Button loading={busy} onClick={activate}>
                Activar notificaciones
              </Button>
            </>
          )}

          {msg && <p className="text-sm text-fg">{msg}</p>}
        </div>
      </Modal>
    </>
  );
}
