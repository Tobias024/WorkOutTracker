// SPDX-License-Identifier: AGPL-3.0-only
"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { Users, UserPlus, Copy, Check, Share2, ChevronRight } from "lucide-react";
import { Button, Input, Skeleton, EmptyState, ErrorState } from "@/components/ui";
import { useFriends, useCreateInvite } from "@/hooks/useFriends";
import { copyToClipboard } from "@/lib/clipboard";

/**
 * Invitación inline: un botón que genera el link y, ya generado, lo muestra con
 * [Compartir] [Copiar]. Va dentro del mismo panel (sin un modal anidado) y se
 * reusa en el CTA del Ranking cuando todavía no hay amigos.
 *
 * El vencimiento de 30 días sale de `create_invite` (migración 0001/0003).
 */
export function InviteCard() {
  const createInvite = useCreateInvite();
  const [url, setUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  // Evita un setState después de desmontar si el timeout del "Copiado" sigue vivo.
  useEffect(() => () => clearTimeout(timer.current), []);

  async function invite() {
    setError(null);
    try {
      const code = await createInvite.mutateAsync();
      const base = process.env.NEXT_PUBLIC_SITE_URL ?? window.location.origin;
      setUrl(`${base}/invite/${code}`);
      setCopied(false);
    } catch {
      setError("No se pudo generar el link. Probá de nuevo.");
    }
  }

  async function share() {
    if (!url) return;
    setError(null);
    try {
      await navigator.share({
        title: "WOLF",
        text: "Sumate a competir conmigo en WOLF",
        url,
      });
    } catch (e) {
      // Cerrar la hoja de compartir no es un error.
      if (e instanceof DOMException && e.name === "AbortError") return;
      setError("No se pudo compartir. Probá con Copiar.");
    }
  }

  async function copy() {
    if (!url) return;
    setError(null);
    const ok = await copyToClipboard(url);
    if (!ok) {
      setError("No se pudo copiar. Mantené apretado el link para copiarlo.");
      return;
    }
    setCopied(true);
    clearTimeout(timer.current);
    timer.current = setTimeout(() => setCopied(false), 2000);
  }

  if (!url) {
    return (
      <div>
        <Button
          className="w-full"
          onClick={invite}
          loading={createInvite.isPending}
        >
          <UserPlus className="size-4" /> Invitar amigo
        </Button>
        {error && (
          <p role="alert" className="text-sm text-danger mt-2">
            {error}
          </p>
        )}
      </div>
    );
  }

  const canShare = typeof navigator !== "undefined" && "share" in navigator;

  return (
    <div className="card p-4 flex flex-col gap-3">
      <p className="text-sm text-muted">
        Compartí este link. Cuando lo abran y acepten, van a quedar conectados.
        Vence en 30 días.
      </p>
      <Input
        readOnly
        value={url}
        aria-label="Link de invitación"
        onFocus={(e) => e.target.select()}
      />
      <div className="flex gap-2">
        {canShare && (
          <Button className="flex-1" onClick={share}>
            <Share2 className="size-4" /> Compartir link
          </Button>
        )}
        <Button
          variant={canShare ? "secondary" : "primary"}
          className="flex-1"
          onClick={copy}
        >
          {copied ? <Check className="size-4" /> : <Copy className="size-4" />}
          {copied ? "Copiado ✓" : "Copiar"}
        </Button>
      </div>
      <div aria-live="polite">
        {error && (
          <p role="alert" className="text-sm text-danger">
            {error}
          </p>
        )}
        <span className="sr-only">{copied ? "Link copiado" : ""}</span>
      </div>
    </div>
  );
}

/** Panel de amigos (modal en Ranking y en Perfil): invitar y listar. */
export function FriendsPanel() {
  const friends = useFriends();
  const { data, isPending, isError } = friends;

  return (
    <div className="flex flex-col gap-4">
      <InviteCard />

      {data ? (
        data.length === 0 ? (
          <EmptyState
            icon={<Users className="size-8" />}
            title="Todavía no tenés amigos"
            description="Invitá a alguien con un link para competir en el ranking."
          />
        ) : (
          <ul className="flex flex-col gap-2">
            {data.map((f) => (
              <li key={f.id}>
                <Link
                  href={`/amigos/${f.id}`}
                  className="card flex items-center gap-3 p-3 min-h-14 hover:ring-1 hover:ring-primary transition"
                >
                  <div className="size-10 rounded-full bg-primary/15 grid place-items-center text-primary font-semibold uppercase shrink-0">
                    {(f.display_name ?? f.username ?? "?").slice(0, 1)}
                  </div>
                  <p className="min-w-0 flex-1 font-medium truncate">
                    {f.display_name ?? f.username}
                  </p>
                  <ChevronRight className="size-4 text-muted shrink-0" />
                </Link>
              </li>
            ))}
          </ul>
        )
      ) : isError ? (
        <ErrorState
          title="No se pudieron cargar tus amigos"
          onRetry={() => void friends.refetch()}
          retrying={friends.isFetching}
        />
      ) : isPending ? (
        <div className="flex flex-col gap-2">
          <Skeleton className="h-14" />
          <Skeleton className="h-14" />
        </div>
      ) : null}
    </div>
  );
}
