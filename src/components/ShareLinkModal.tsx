// SPDX-License-Identifier: AGPL-3.0-only
"use client";

import { useState } from "react";
import { Copy, Share2 } from "lucide-react";
import { Modal, Input, Button } from "@/components/ui";
import { copyToClipboard } from "@/lib/clipboard";
import { toast } from "@/lib/toast";
import { clsx } from "@/lib/clsx";

const DEFAULT_PRIVACY = "Se comparte la estructura. Tus pesos y notas no se comparten.";

/**
 * Modal único para compartir un link (una rutina o varias). Donde existe
 * `navigator.share` el primario abre la hoja nativa (WhatsApp, etc.); "Copiar
 * link" queda siempre como alternativa.
 */
export function ShareLinkModal({
  open,
  onClose,
  url,
  title,
  privacyNote = DEFAULT_PRIVACY,
}: {
  open: boolean;
  onClose: () => void;
  url: string;
  title: string;
  privacyNote?: string;
}) {
  const [copyFailed, setCopyFailed] = useState(false);
  // Solo se evalúa con el modal abierto (portal en cliente), no en el SSR.
  const canShare = open && typeof navigator !== "undefined" && "share" in navigator;

  async function nativeShare() {
    try {
      await navigator.share({ title, url });
    } catch {
      // Cancelar la hoja nativa tira AbortError: no es un error para el usuario.
    }
  }

  async function copy() {
    const ok = await copyToClipboard(url);
    setCopyFailed(!ok);
    if (ok) toast("Link copiado");
  }

  function close() {
    setCopyFailed(false);
    onClose();
  }

  return (
    <Modal open={open} onClose={close} title={title}>
      <div className="flex flex-col gap-3">
        <Input
          readOnly
          aria-label="Link para compartir"
          value={url}
          onFocus={(e) => e.target.select()}
        />
        {canShare && (
          <Button onClick={nativeShare}>
            <Share2 className="size-4" /> Compartir…
          </Button>
        )}
        <Button variant={canShare ? "secondary" : "primary"} onClick={copy}>
          <Copy className="size-4" /> Copiar link
        </Button>
        {copyFailed && (
          <p role="alert" className="text-xs text-muted">
            No se pudo copiar automáticamente. Mantené presionado el link de
            arriba para copiarlo a mano.
          </p>
        )}
        <p className="text-xs text-muted text-center">{privacyNote}</p>
      </div>
    </Modal>
  );
}

/** Fila de un menú ⋯ que se abre como hoja (Modal). */
export function SheetMenuItem({
  icon,
  danger,
  children,
  ...props
}: {
  icon: React.ReactNode;
  danger?: boolean;
  children: React.ReactNode;
} & Omit<React.ButtonHTMLAttributes<HTMLButtonElement>, "className">) {
  return (
    <button
      type="button"
      className={clsx(
        "flex min-h-12 w-full items-center gap-3 rounded-md px-2 text-left text-base transition hover:bg-surface-2 disabled:opacity-50",
        danger ? "text-danger" : "text-fg",
      )}
      {...props}
    >
      <span className={danger ? "" : "text-muted"}>{icon}</span>
      {children}
    </button>
  );
}

