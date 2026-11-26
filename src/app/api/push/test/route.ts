// SPDX-License-Identifier: AGPL-3.0-only
import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { sendTestPush } from "@/lib/rank-notify";

export const dynamic = "force-dynamic";
export const maxDuration = 30;

// Manda una notificación de prueba al usuario autenticado (valida el canal).
export async function POST() {
  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  const userId = data?.claims?.sub;
  if (!userId) return new NextResponse("Unauthorized", { status: 401 });

  try {
    const result = await sendTestPush(userId);
    return NextResponse.json(result);
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}
