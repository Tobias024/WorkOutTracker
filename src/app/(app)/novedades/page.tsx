// SPDX-License-Identifier: AGPL-3.0-only
import { PageHeader } from "@/components/ui";
import { CHANGELOG } from "@/lib/changelog";

/** Fecha ISO (YYYY-MM-DD) a "4 de noviembre de 2026"; mediodía para no correr el día por huso. */
function longDate(iso: string): string {
  return new Date(`${iso}T12:00:00`).toLocaleDateString("es-AR", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

/** Historial completo de novedades (el popup sólo muestra las últimas). */
export default function NovedadesPage() {
  return (
    <div>
      <PageHeader
        title="Novedades"
        subtitle="Todo lo que fue cambiando en WOLF"
        back="/perfil"
      />
      <div className="flex flex-col gap-4">
        {CHANGELOG.map((r) => (
          <section key={r.version} className="card p-4">
            <div className="flex items-baseline justify-between gap-3 mb-2">
              <h2 className="font-semibold">v{r.version}</h2>
              <time dateTime={r.date} className="text-xs text-muted">
                {longDate(r.date)}
              </time>
            </div>
            <ul className="flex flex-col gap-2">
              {r.items.map((item) => (
                <li key={item} className="flex gap-2 text-sm">
                  <span className="text-primary shrink-0">·</span>
                  <span>{item}</span>
                </li>
              ))}
            </ul>
          </section>
        ))}
      </div>
    </div>
  );
}
