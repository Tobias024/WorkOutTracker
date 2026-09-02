// SPDX-License-Identifier: AGPL-3.0-only
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { TabBar } from "@/components/TabBar";
import { ActiveSessionGuard } from "@/components/ActiveSessionGuard";
import { PendingInviteHandler } from "@/components/PendingInviteHandler";

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

  if (!profile?.username) redirect("/onboarding");

  return (
    <div className="mx-auto max-w-2xl px-4 pt-5 pb-24">
      <ActiveSessionGuard />
      <PendingInviteHandler />
      {children}
      <TabBar />
    </div>
  );
}
