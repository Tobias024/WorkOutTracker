// SPDX-License-Identifier: AGPL-3.0-only
import { redirect } from "next/navigation";

// El proxy ya redirige a /login si no hay sesión ("/" no es pública).
export default function Home() {
  redirect("/rutinas");
}
