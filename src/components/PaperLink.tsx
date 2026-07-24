"use client";

import { openExternal } from "@/lib/external";
import { REFERENCES } from "@/lib/references";

/** Cita de paper clickeable: abre el link con confirmación previa. */
export function PaperLink({ label, url }: { label: string; url: string }) {
  return (
    <button
      type="button"
      onClick={() => openExternal(url)}
      className="text-primary underline underline-offset-2"
    >
      {label}
    </button>
  );
}

/** Cita clickeable con el nombre del paper, resuelta desde REFERENCES. */
export function Ref({ id }: { id: keyof typeof REFERENCES | string }) {
  const r = REFERENCES[id as string];
  if (!r) return null;
  return <PaperLink label={r.short} url={r.url} />;
}
