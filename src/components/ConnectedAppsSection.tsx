// SPDX-License-Identifier: AGPL-3.0-only
"use client";

import { useState } from "react";
import { Check, Copy, Unplug } from "lucide-react";
import { Button, Spinner } from "@/components/ui";
import {
  useOAuthConnections,
  useRevokeOAuthConnection,
} from "@/hooks/useOAuthConnections";
import { formatDate } from "@/lib/format";

/**
 * "Conectar tu IA": reemplaza el export/import de .xlsx por un servidor MCP
 * remoto. El único paso manual para un usuario no técnico es pegar esta URL
 * en la config de conectores de su cliente de IA — el resto (login,
 * consentimiento, tokens) lo maneja el flujo de OAuth solo.
 */
export function ConnectedAppsSection() {
  const [copied, setCopied] = useState(false);
  const { data: connections, isLoading } = useOAuthConnections();
  const revoke = useRevokeOAuthConnection();

  const mcpUrl =
    typeof window !== "undefined" ? `${window.location.origin}/mcp` : "";

  async function copyUrl() {
    try {
      await navigator.clipboard.writeText(mcpUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Clipboard no disponible (http, permisos, etc.): no es crítico, el
      // usuario puede seleccionar el texto a mano.
    }
  }

  return (
    <div className="card p-6 flex flex-col gap-3 mt-4">
      <div>
        <h2 className="font-semibold">Conectar tu IA</h2>
        <p className="text-xs text-muted mt-0.5">
          Pegá esta URL en la sección de conectores/integraciones de tu
          asistente de IA (Claude, ChatGPT, etc.). Te va a pedir iniciar
          sesión en WOLF y confirmar el acceso — después tu IA va a poder ver
          tu catálogo y tu progreso, armar y editar tus rutinas, y registrar
          tus entrenamientos por vos.
        </p>
      </div>

      <div className="flex gap-2">
        <code className="flex-1 min-w-0 truncate rounded-lg bg-surface-2 px-3 py-2 text-xs">
          {mcpUrl}
        </code>
        <Button
          type="button"
          variant="secondary"
          size="sm"
          onClick={copyUrl}
          aria-label="Copiar URL"
        >
          {copied ? <Check className="size-4" /> : <Copy className="size-4" />}
        </Button>
      </div>

      {isLoading ? (
        <div className="flex justify-center py-2">
          <Spinner />
        </div>
      ) : connections && connections.length > 0 ? (
        <div className="flex flex-col gap-2 mt-1">
          <p className="text-xs text-muted">Conectado:</p>
          {connections.map((c) => (
            <div
              key={c.id}
              className="flex items-center justify-between gap-2 rounded-lg bg-surface-2 px-3 py-2"
            >
              <div className="min-w-0">
                <p className="text-sm truncate">{c.client_name}</p>
                <p className="text-xs text-muted">
                  Desde {formatDate(c.created_at)}
                </p>
              </div>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                loading={revoke.isPending}
                onClick={() => revoke.mutate(c.id)}
                aria-label="Desconectar"
              >
                <Unplug className="size-4" />
              </Button>
            </div>
          ))}
        </div>
      ) : null}
    </div>
  );
}
