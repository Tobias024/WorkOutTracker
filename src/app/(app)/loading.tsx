// SPDX-License-Identifier: AGPL-3.0-only
import { Skeleton } from "@/components/ui";

/**
 * Carga de cualquier tab: esqueleto con la forma real (header + cards) en vez
 * de un spinner centrado, para que el contenido no "salte" al llegar.
 */
export default function Loading() {
  return (
    <div aria-busy="true" aria-label="Cargando" className="flex flex-col gap-3">
      <div className="mb-2 flex flex-col gap-2">
        <Skeleton className="h-7 w-40" />
        <Skeleton className="h-4 w-56" />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <Skeleton className="h-24 rounded-lg" />
        <Skeleton className="h-24 rounded-lg" />
      </div>
      <Skeleton className="h-20 rounded-lg" />
      <Skeleton className="h-20 rounded-lg" />
      <Skeleton className="h-20 rounded-lg" />
    </div>
  );
}
