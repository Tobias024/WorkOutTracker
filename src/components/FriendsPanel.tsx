// SPDX-License-Identifier: AGPL-3.0-only
"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  Users,
  UserPlus,
  Copy,
  Check,
  LogOut,
  UserMinus,
  UserCog,
} from "lucide-react";
import { Button, Spinner, EmptyState, Modal, Input } from "@/components/ui";
import {
  useFriends,
  useCreateInvite,
  useRemoveFriend,
} from "@/hooks/useFriends";
import { createClient } from "@/lib/supabase/client";
import { copyToClipboard } from "@/lib/clipboard";

/** Panel de amigos (vive dentro de Ranking): invitar, listar, quitar + perfil/salir. */
export function FriendsPanel() {
  const { data, isLoading } = useFriends();
  const createInvite = useCreateInvite();
  const removeFriend = useRemoveFriend();
  const router = useRouter();
  const [inviteUrl, setInviteUrl] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  async function invite() {
    const code = await createInvite.mutateAsync();
    const base = process.env.NEXT_PUBLIC_SITE_URL ?? window.location.origin;
    setInviteUrl(`${base}/invite/${code}`);
    setCopied(false);
  }

  async function logout() {
    if (!confirm("¿Cerrar sesión?")) return;
    await createClient().auth.signOut();
    router.push("/login");
  }

  return (
    <div>
      <Button
        className="w-full mb-4"
        onClick={invite}
        loading={createInvite.isPending}
      >
        <UserPlus className="size-4" /> Invitar amigo
      </Button>

      {isLoading ? (
        <div className="grid place-items-center py-16">
          <Spinner />
        </div>
      ) : !data?.length ? (
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
                className="card flex items-center gap-3 p-3.5 hover:ring-1 hover:ring-primary transition"
              >
                <div className="size-10 rounded-full bg-primary/15 grid place-items-center text-primary font-semibold uppercase">
                  {(f.display_name ?? f.username ?? "?").slice(0, 1)}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="font-medium truncate">
                    {f.display_name ?? f.username}
                  </p>
                </div>
                <button
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    if (
                      confirm(
                        `¿Eliminar a ${f.display_name ?? f.username} de tus amigos?`,
                      )
                    )
                      removeFriend.mutate(f.id);
                  }}
                  className="text-muted hover:text-danger p-1"
                >
                  <UserMinus className="size-4" />
                </button>
              </Link>
            </li>
          ))}
        </ul>
      )}

      <div className="flex gap-2 mt-6">
        <Link href="/perfil" className="flex-1">
          <Button variant="secondary" className="w-full">
            <UserCog className="size-4" /> Mi perfil
          </Button>
        </Link>
        <Button variant="ghost" onClick={logout}>
          <LogOut className="size-4" /> Salir
        </Button>
      </div>

      <Modal
        open={!!inviteUrl}
        onClose={() => setInviteUrl(null)}
        title="Invitá a un amigo"
      >
        <p className="text-sm text-muted mb-3">
          Compartí este link. Cuando lo abran y acepten, van a quedar conectados.
          Vence en 30 días.
        </p>
        <div className="flex gap-2">
          <Input readOnly value={inviteUrl ?? ""} />
          <Button
            onClick={async () => {
              if (inviteUrl) setCopied(await copyToClipboard(inviteUrl));
            }}
          >
            {copied ? <Check className="size-4" /> : <Copy className="size-4" />}
            {copied ? "Copiado" : "Copiar"}
          </Button>
        </div>
      </Modal>
    </div>
  );
}
