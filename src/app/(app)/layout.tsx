// SPDX-License-Identifier: AGPL-3.0-only
import { redirect } from "next/navigation";
import { headers } from "next/headers";
import { safeNext } from "@/lib/safe-next";
import { createClient } from "@/lib/supabase/server";
import { TabBar } from "@/components/TabBar";
import { ActiveSessionGuard } from "@/components/ActiveSessionGuard";
import { PendingInviteHandler } from "@/components/PendingInviteHandler";
import { WhatsNewModal } from "@/components/WhatsNewModal";

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  const { data: profile } = await supabase
    .from("profiles")
    .select("username")
    .eq("id", user.id)
    .maybeSingle();

  if (!profile?.username) {
    // Conserva el destino (lo setea el middleware) para volver después del
    // onboarding en vez de caer siempre en /rutinas.
    const from = safeNext((await headers()).get("x-pathname"), "");
    redirect(from ? `/onboarding?next=${encodeURIComponent(from)}` : "/onboarding");
  }

  return (
    <div className="mx-auto max-w-2xl px-4 pt-5 pb-24">
      <ActiveSessionGuard />
      <PendingInviteHandler />
      <WhatsNewModal />
      {children}
      <TabBar />
    </div>
  );
}
