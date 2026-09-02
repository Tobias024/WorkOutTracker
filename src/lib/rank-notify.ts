// SPDX-License-Identifier: AGPL-3.0-only
import webpush from "web-push";
import { createAdminClient } from "@/lib/supabase/admin";

// Lógica compartida: detecta a quién superaron en el ranking semanal y le manda
// el push. La usan el cron diario (respaldo) y el disparo al terminar un
// entrenamiento (event-driven).
export async function runRankCheck(): Promise<{
  overtakes: number;
  sent: number;
}> {
  const publicKey = process.env.VAPID_PUBLIC_KEY;
  const privateKey = process.env.VAPID_PRIVATE_KEY;
  if (!publicKey || !privateKey) {
    throw new Error("Faltan las VAPID keys");
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
  if (error) throw new Error(error.message);

  let sent = 0;
  for (const o of overtakes ?? []) {
    const { data: subs } = await supabase
      .from("push_subscriptions")
      .select("*")
      .eq("user_id", o.user_id);

    const payload = JSON.stringify(
      o.kind === "gained"
        ? {
            title: "¡Subiste en el ranking! 💪",
            body: `Estás ${o.new_rank}º en series esta semana${
              o.other_name ? ` — pasaste a ${o.other_name}` : ""
            }.`,
            url: "/scoreboard",
          }
        : {
            title: "Te pasaron en el ranking 🏋️",
            body: `${o.other_name ?? "Alguien"} te superó en series esta semana. ¡A recuperar el puesto!`,
            url: "/scoreboard",
          },
    );

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

  return { overtakes: overtakes?.length ?? 0, sent };
}

// Manda una notificación de PRUEBA al propio usuario. Sirve para validar toda
// la cadena (suscripción + service worker + VAPID) sin depender del ranking.
export async function sendTestPush(userId: string): Promise<{ sent: number }> {
  const publicKey = process.env.VAPID_PUBLIC_KEY;
  const privateKey = process.env.VAPID_PRIVATE_KEY;
  if (!publicKey || !privateKey) {
    throw new Error("Faltan las VAPID keys en el servidor");
  }
  webpush.setVapidDetails(
    process.env.VAPID_SUBJECT ?? "mailto:admin@example.com",
    publicKey,
    privateKey,
  );

  const supabase = createAdminClient();
  const { data: subs } = await supabase
    .from("push_subscriptions")
    .select("*")
    .eq("user_id", userId);

  if (!subs || subs.length === 0) {
    throw new Error("No hay ninguna suscripción guardada para tu usuario");
  }

  const payload = JSON.stringify({
    title: "Notificación de prueba 🔔",
    body: "¡Listo! Las notificaciones funcionan.",
    url: "/scoreboard",
  });

  let sent = 0;
  for (const s of subs) {
    try {
      await webpush.sendNotification(
        { endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } },
        payload,
      );
      sent++;
    } catch (e) {
      const status = (e as { statusCode?: number })?.statusCode;
      if (status === 404 || status === 410) {
        await supabase
          .from("push_subscriptions")
          .delete()
          .eq("endpoint", s.endpoint);
      }
    }
  }

  if (sent === 0) {
    throw new Error(
      "La suscripción existe pero el envío falló (revisá las VAPID keys del server)",
    );
  }
  return { sent };
}
