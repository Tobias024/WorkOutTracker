// SPDX-License-Identifier: AGPL-3.0-only
import { NextResponse } from "next/server";
import { runRankCheck } from "@/lib/rank-notify";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

// Cron diario de respaldo: recalcula el ranking y avisa a quien superaron.
// El disparo principal es al terminar un entrenamiento (/api/rank/notify);
// esto es una red de seguridad por si ese disparo falla.
// Lo llama Vercel Cron (ver vercel.json), que agrega el header
// Authorization: Bearer <CRON_SECRET>. Falla cerrado: sin CRON_SECRET
// configurada el endpoint responde 500 en vez de quedar abierto.
export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret) {
    console.error("[rank-check] CRON_SECRET no configurado");
    return NextResponse.json(
      { error: "CRON_SECRET no configurado" },
      { status: 500 },
    );
  }
  const auth = request.headers.get("authorization");
  if (auth !== `Bearer ${secret}`) {
    return new NextResponse("Unauthorized", { status: 401 });
  }

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
