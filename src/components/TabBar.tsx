"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Dumbbell, LineChart, Trophy } from "lucide-react";
import { clsx } from "@/lib/clsx";

const TABS = [
  { href: "/rutinas", label: "Rutinas", icon: Dumbbell },
  { href: "/registro", label: "Registro", icon: LineChart },
  { href: "/scoreboard", label: "Ranking", icon: Trophy },
];

export function TabBar() {
  const pathname = usePathname();

  return (
    <nav
      data-tabbar
      className="fixed bottom-0 inset-x-0 z-40 border-t border-border bg-surface/95 backdrop-blur"
    >
      <div className="mx-auto max-w-2xl flex">
        {TABS.map((tab) => {
          const active =
            pathname === tab.href || pathname.startsWith(tab.href + "/");
          const Icon = tab.icon;
          return (
            <Link
              key={tab.href}
              href={tab.href}
              className={clsx(
                "flex-1 flex flex-col items-center gap-1 py-2.5 text-xs transition",
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
