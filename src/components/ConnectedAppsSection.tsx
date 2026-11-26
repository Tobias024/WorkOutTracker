// SPDX-License-Identifier: AGPL-3.0-only
"use client";

import { useState, useSyncExternalStore } from "react";
import { Check, Copy, Unplug } from "lucide-react";
import { ConfirmDialog, ErrorState, IconButton, Skeleton } from "@/components/ui";
import {
  useOAuthConnections,
  useRevokeOAuthConnection,
} from "@/hooks/useOAuthConnections";
import { copyToClipboard } from "@/lib/clipboard";
import { formatDate } from "@/lib/format";
import { toast } from "@/lib/toast";
import type { OAuthConnection } from "@/lib/types";

/** Origin del cliente sin romper la hidratación: el server renderiza "" y el
 *  cliente la URL real en el mismo pase (useSyncExternalStore), en vez de leer
 *  `window` durante el render (mismatch server/cliente). */
function useOrigin(): string {
  return useSyncExternalStore(
    () => () => {},
    () => window.location.origin,
    () => "",
  );
}

/**
 * "Conectar tu IA": reemplaza el export/import de .xlsx por un servidor MCP
 * remoto. El único paso manual para un usuario no técnico es pegar esta URL
 * en la config de conectores de su cliente de IA — el resto (login,
 * consentimiento, tokens) lo maneja el flujo de OAuth solo.
 */
export function ConnectedAppsSection() {
  const origin = useOrigin();
  const mcpUrl = origin ? `${origin}/mcp` : "";
  const [copied, setCopied] = useState(false);
  const connections = useOAuthConnections();
  const revoke = useRevokeOAuthConnection();
  const [pending, setPending] = useState<OAuthConnection | null>(null);
  const [revokeError, setRevokeError] = useState<string | null>(null);

  async function copyUrl() {
    if (await copyToClipboard(mcpUrl)) {
      setCopied(true);
      toast("Link copiado");
      setTimeout(() => setCopied(false), 2000);
    } else {
      toast("No se pudo copiar. Mantené apretado el link para copiarlo.", {
        tone: "danger",
      });
    }
  }

  async function confirmRevoke() {
    if (!pending) return;
    setRevokeError(null);
    try {
      await revoke.mutateAsync(pending.id);
      toast(`Desconectaste ${pending.client_name}`, { tone: "success" });
      setPending(null);
    } catch {
      setRevokeError("No se pudo desconectar. Probá de nuevo.");
    }
  }

  return (
    <section className="card p-4 flex flex-col gap-3">
      <div>
        <h2 className="font-semibold">Conectar tu IA</h2>
        <p className="text-xs text-muted mt-0.5">
          Pegá este link en los conectores de tu asistente (Claude, ChatGPT,
          etc.). Te va a pedir iniciar sesión en WOLF y confirmar el acceso;
          después va a poder ver tu catálogo y tu progreso, armar y editar tus
          rutinas y registrar tus entrenamientos por vos.
        </p>
      </div>

      <div className="flex items-center gap-2">
        <input
          readOnly
          value={mcpUrl}
          aria-label="Link para conectar tu IA"
          onFocus={(e) => e.currentTarget.select()}
          className="h-11 flex-1 min-w-0 rounded-md bg-surface-2 px-3 font-mono text-base text-fg outline-none ring-1 ring-border focus:ring-2 focus:ring-primary"
        />
        <IconButton
          label={copied ? "Link copiado" : "Copiar link"}
          tone={copied ? "primary" : "muted"}
          onClick={copyUrl}
          disabled={!mcpUrl}
        >
          {copied ? <Check className="size-5" /> : <Copy className="size-5" />}
        </IconButton>
      </div>

      {connections.isPending ? (
        <Skeleton className="h-14" />
      ) : connections.isError && !connections.data ? (
        <ErrorState
          title="No pudimos cargar tus conexiones"
          onRetry={() => connections.refetch()}
          retrying={connections.isFetching}
        />
      ) : connections.data && connections.data.length > 0 ? (
        <div className="flex flex-col gap-2">
          <p className="text-xs text-muted">Conectadas</p>
          {connections.data.map((c) => (
            <div
              key={c.id}
              className="flex items-center justify-between gap-2 rounded-md bg-surface-2 pl-3"
            >
              <div className="min-w-0 py-2">
                <p className="text-sm truncate">{c.client_name}</p>
                <p className="text-xs text-muted">
                  Desde {formatDate(c.created_at)}
                </p>
              </div>
              <IconButton
                label={`Desconectar ${c.client_name}`}
                tone="danger"
                onClick={() => {
                  setRevokeError(null);
                  setPending(c);
                }}
              >
                <Unplug className="size-5" />
              </IconButton>
            </div>
          ))}
        </div>
      ) : (
        <p className="text-xs text-muted">Todavía no conectaste ninguna IA.</p>
      )}

      <ConfirmDialog
        open={pending != null}
        title={`¿Desconectar ${pending?.client_name ?? ""}?`}
        description="Va a perder el acceso a tu cuenta de WOLF. Si la querés usar de nuevo, la volvés a conectar con el mismo link."
        confirmLabel="Desconectar"
        loading={revoke.isPending}
        error={revokeError}
        onConfirm={confirmRevoke}
        onCancel={() => setPending(null)}
      />
    </section>
  );
}
