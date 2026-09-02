// SPDX-License-Identifier: AGPL-3.0-only
import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { runRankCheck } from "@/lib/rank-notify";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

// Disparo principal (event-driven): lo llama la app cuando un usuario termina
// un entrenamiento. Como recién ahí cambió el volumen, es el momento exacto en
// que alguien pudo haber sido superado. Requiere sesión (evita disparos anónimos).
export async function POST() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return new NextResponse("Unauthorized", { status: 401 });

  try {
    const result = await runRankCheck();
    return NextResponse.json(result);
  } catch (e) {
    return NextResponse.json(
      { error: (e as Error).message },
      { status: 500 },
    );
  }
}
