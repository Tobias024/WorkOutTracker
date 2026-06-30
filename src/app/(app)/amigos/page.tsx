"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Users, UserPlus, Copy, Check, LogOut, UserMinus } from "lucide-react";
import {
  PageHeader,
  Button,
  Spinner,
  EmptyState,
  Modal,
  Input,
} from "@/components/ui";
import { useFriends, useCreateInvite, useRemoveFriend } from "@/hooks/useFriends";
import { createClient } from "@/lib/supabase/client";

export default function AmigosPage() {
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
    await createClient().auth.signOut();
    router.push("/login");
  }

  return (
    <div>
      <PageHeader
        title="Amigos"
        subtitle="Competí y compartí rutinas"
        action={
          <Button size="sm" variant="ghost" onClick={logout}>
            <LogOut className="size-4" /> Salir
          </Button>
        }
      />

      <Button className="w-full mb-4" onClick={invite} loading={createInvite.isPending}>
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
            <li
              key={f.id}
              className="card flex items-center gap-3 p-3.5"
            >
              <div className="size-10 rounded-full bg-primary/15 grid place-items-center text-primary font-semibold uppercase">
                {(f.display_name ?? f.username ?? "?").slice(0, 1)}
              </div>
              <div className="min-w-0 flex-1">
                <p className="font-medium truncate">
                  {f.display_name ?? f.username}
                </p>
                <p className="text-xs text-muted">@{f.username}</p>
              </div>
              <button
                onClick={() => {
                  if (confirm(`¿Eliminar a ${f.username} de tus amigos?`))
                    removeFriend.mutate(f.id);
                }}
                className="text-muted hover:text-danger p-1"
              >
                <UserMinus className="size-4" />
              </button>
            </li>
          ))}
        </ul>
      )}

      <Modal
        open={!!inviteUrl}
        onClose={() => setInviteUrl(null)}
        title="Invitá a un amigo"
      >
        <p className="text-sm text-muted mb-3">
          Compartí este link. Cuando lo abran y acepten, van a quedar
          conectados. Vence en 30 días.
        </p>
        <div className="flex gap-2">
          <Input readOnly value={inviteUrl ?? ""} />
          <Button
            onClick={() => {
              navigator.clipboard.writeText(inviteUrl ?? "");
              setCopied(true);
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
