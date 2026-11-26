// SPDX-License-Identifier: AGPL-3.0-only
"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Dumbbell, LineChart, Trophy, User } from "lucide-react";
import { clsx } from "@/lib/clsx";

/**
 * `also` son las sub-rutas que pertenecen a cada tab: así, estando en el
 * perfil de un amigo o en Novedades, la barra sigue marcando dónde estás.
 */
const TABS = [
  { href: "/rutinas", label: "Rutinas", icon: Dumbbell, also: ["/ejercicios"] },
  { href: "/registro", label: "Registro", icon: LineChart, also: [] },
  { href: "/scoreboard", label: "Ranking", icon: Trophy, also: [] },
  {
    href: "/perfil",
    label: "Perfil",
    icon: User,
    also: ["/amigos", "/novedades"],
  },
];

function matches(pathname: string, base: string): boolean {
  return pathname === base || pathname.startsWith(base + "/");
}

export function TabBar() {
  const pathname = usePathname();

  return (
    <nav
      data-tabbar
      aria-label="Navegación principal"
      className="fixed bottom-0 inset-x-0 z-40 border-t border-border bg-surface/95 backdrop-blur"
    >
      <div className="mx-auto max-w-2xl flex">
        {TABS.map((tab) => {
          const active = [tab.href, ...tab.also].some((b) =>
            matches(pathname, b),
          );
          const Icon = tab.icon;
          return (
            <Link
              key={tab.href}
              href={tab.href}
              aria-current={active ? "page" : undefined}
              className={clsx(
                "flex-1 min-h-11 flex flex-col items-center justify-center gap-1 py-2.5 text-xs transition",
                "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-primary",
                active ? "text-primary" : "text-muted hover:text-fg",
              )}
            >
              <Icon className="size-5" strokeWidth={active ? 2.5 : 2} />
              {tab.label}
            </Link>
          );
        })}
      </div>
      <div style={{ height: "env(safe-area-inset-bottom)" }} />
    </nav>
  );
}
