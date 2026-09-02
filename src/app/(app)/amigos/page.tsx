// SPDX-License-Identifier: AGPL-3.0-only
import { redirect } from "next/navigation";

// La vista de Amigos se fusionó dentro de Ranking (tab "Amigos"). Se deja este
// redirect para no romper links/bookmarks viejos a /amigos.
export default function AmigosPage() {
  redirect("/scoreboard");
}
