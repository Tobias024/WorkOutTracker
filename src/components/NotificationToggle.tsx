// SPDX-License-Identifier: AGPL-3.0-only
"use client";

import { useEffect, useState, useSyncExternalStore } from "react";
import { Bell, BellOff, ChevronRight } from "lucide-react";
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

type Env = "ios-installed" | "ios-browser" | "android-installed" | "android-browser" | "other-installed" | "other-browser";

/**
 * Plataforma y si la PWA está instalada (standalone). Cambia las instrucciones
 * para un permiso bloqueado: instalada no hay barra de direcciones ni candado.
 * Devuelve un string primitivo para que useSyncExternalStore tenga un snapshot
 * estable; en el servidor es null (no hay navigator).
 */
function readEnv(): Env {
  const ua = navigator.userAgent;
  const nav = navigator as Navigator & { standalone?: boolean };
  const ios =
    /iPad|iPhone|iPod/.test(ua) ||
    (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
  const android = /Android/i.test(ua);
  const installed =
    window.matchMedia("(display-mode: standalone)").matches ||
    nav.standalone === true;
  const os = ios ? "ios" : android ? "android" : "other";
  return `${os}-${installed ? "installed" : "browser"}` as Env;
}
const noopSubscribe = () => () => {};

/** Instrucciones para reactivar un permiso bloqueado, según la plataforma. */
function DeniedHelp({ env }: { env: Env | null }) {
  if (env === "android-installed") {
    return (
      <ol className="text-sm text-muted list-decimal pl-5 space-y-1">
        <li>
          Abrí los <span className="text-fg">Ajustes</span> del teléfono y entrá a{" "}
          <span className="text-fg">Apps</span>.
        </li>
        <li>
          Elegí <span className="text-fg">WOLF</span> y después{" "}
          <span className="text-fg">Notificaciones</span>.
        </li>
        <li>Activalas y volvé a abrir WOLF.</li>
      </ol>
    );
  }
  if (env === "ios-installed") {
    return (
      <ol className="text-sm text-muted list-decimal pl-5 space-y-1">
        <li>
          Abrí los <span className="text-fg">Ajustes</span> del iPhone y entrá a{" "}
          <span className="text-fg">Notificaciones</span>.
        </li>
        <li>
          Buscá <span className="text-fg">WOLF</span> y activá{" "}
          <span className="text-fg">Permitir notificaciones</span>.
        </li>
        <li>Volvé a abrir WOLF.</li>
      </ol>
    );
  }
  return (
    <ol className="text-sm text-muted list-decimal pl-5 space-y-1">
      <li>
        Tocá el candado / ícono a la izquierda de la dirección del sitio.
      </li>
      <li>
        Entrá a <span className="text-fg">Notificaciones</span> (o Permisos del
        sitio) y ponelo en <span className="text-fg">Permitir</span>.
      </li>
      <li>Recargá la página y activá de nuevo.</li>
    </ol>
  );
}

/** Fila + modal para activar/probar/desactivar los avisos del ranking (vive en Perfil). */
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

  const env = useSyncExternalStore<Env | null>(noopSubscribe, readEnv, () => null);

  if (perm === null) return null;

  if (perm === "unsupported") {
    // iOS en Safari no soporta push hasta instalar la PWA: se lo decimos en
    // vez de esconder la opción.
    const text =
      env === "ios-browser"
        ? "Instalá WOLF en tu pantalla de inicio para recibir avisos."
        : "Este navegador no soporta avisos.";
    return (
      <div className="min-h-11 flex items-center gap-3 text-sm text-muted">
        <BellOff className="size-5 shrink-0" />
        <span>{text}</span>
      </div>
    );
  }

  const active = perm === "granted" && subscribed;
  const denied = perm === "denied";
  const stateLabel = active ? "Activados" : denied ? "Bloqueados" : "Desactivados";

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
        type="button"
        onClick={() => {
          setMsg(null);
          setOpen(true);
        }}
        aria-haspopup="dialog"
        aria-label={`Avisos del ranking: ${stateLabel}`}
        className="min-h-11 w-full flex items-center gap-3 text-left rounded-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
      >
        {denied ? (
          <BellOff className="size-5 shrink-0 text-warning-fg" />
        ) : (
          <Bell
            className={clsx("size-5 shrink-0", active ? "text-primary" : "text-muted")}
          />
        )}
        <span className="min-w-0 flex-1">
          <span className="block text-sm text-fg">Avisos del ranking</span>
          <span className="block text-xs text-muted">
            Te avisamos cuando un amigo te pasa
          </span>
        </span>
        <span
          className={clsx(
            "text-sm shrink-0",
            denied ? "text-warning-fg" : active ? "text-primary" : "text-muted",
          )}
        >
          {stateLabel}
        </span>
        <ChevronRight className="size-4 text-muted shrink-0" />
      </button>

      <Modal
        open={open}
        onClose={() => setOpen(false)}
        title="Avisos del ranking"
      >
        <div className="flex flex-col gap-3">
          {denied ? (
            <>
              <p className="text-sm text-muted">
                Bloqueaste las notificaciones para este sitio, así que no se
                pueden reactivar desde acá. Para volver a permitirlas:
              </p>
              <DeniedHelp env={env} />
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

          {msg && <p role="status" className="text-sm text-fg">{msg}</p>}
        </div>
      </Modal>
    </>
  );
}
