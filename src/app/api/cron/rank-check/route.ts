import { NextResponse } from "next/server";
import webpush from "web-push";
import { createAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

// Cron: detecta a quién superaron en el ranking semanal y le manda un push.
// Lo dispara Vercel Cron (ver vercel.json), que agrega el header
// Authorization: Bearer <CRON_SECRET> automáticamente si CRON_SECRET está seteada.
export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (secret) {
    const auth = request.headers.get("authorization");
    if (auth !== `Bearer ${secret}`) {
      return new NextResponse("Unauthorized", { status: 401 });
    }
  }

  const publicKey = process.env.VAPID_PUBLIC_KEY;
  const privateKey = process.env.VAPID_PRIVATE_KEY;
  if (!publicKey || !privateKey) {
    return NextResponse.json(
      { error: "Faltan las VAPID keys" },
      { status: 500 },
    );
  }
  webpush.setVapidDetails(
    process.env.VAPID_SUBJECT ?? "mailto:admin@example.com",
    publicKey,
    privateKey,
  );

  const supabase = createAdminClient();
  const { data: overtakes, error } = await supabase.rpc(
    "detect_rank_overtakes",
  );
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  let sent = 0;
  for (const o of overtakes ?? []) {
    const { data: subs } = await supabase
      .from("push_subscriptions")
      .select("*")
      .eq("user_id", o.user_id);

    const payload = JSON.stringify({
      title: "Te pasaron en el ranking 🏋️",
      body: `${o.by_name ?? "Alguien"} te superó en volumen esta semana. ¡A recuperar el puesto!`,
      url: "/scoreboard",
    });

    for (const s of subs ?? []) {
      try {
        await webpush.sendNotification(
          { endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } },
          payload,
        );
        sent++;
      } catch (e) {
        const status = (e as { statusCode?: number })?.statusCode;
        // 404/410 => suscripción muerta: la limpiamos.
        if (status === 404 || status === 410) {
          await supabase
            .from("push_subscriptions")
            .delete()
            .eq("endpoint", s.endpoint);
        }
      }
    }
  }

  return NextResponse.json({ overtakes: overtakes?.length ?? 0, sent });
}
