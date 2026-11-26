// SPDX-License-Identifier: AGPL-3.0-only
"use client";

import { useState } from "react";
import { Trophy, Share2 } from "lucide-react";
import { Button, Modal } from "@/components/ui";
import { fmtNum, formatWeight } from "@/lib/format";
import { toast } from "@/lib/toast";
import type { SessionPr } from "@/lib/types";

export interface PrInfo {
  name: string;
  /** Reps del mejor set que marcó el récord (null si no se pudo determinar). */
  reps: number | null;
}

/**
 * Celebración de récords de e1RM al terminar la sesión. No se cierra tocando
 * afuera (cerrar navega a Registro y perder el momento por un toque suelto es
 * peor que un botón de más). Con varios PRs se pagina "1 de N".
 */
export function PrCelebrationModal({
  prs,
  info,
  bodyWeightKg,
  onClose,
}: {
  prs: SessionPr[];
  info: (pr: SessionPr) => PrInfo;
  bodyWeightKg: number | null;
  onClose: () => void;
}) {
  if (prs.length === 0) return null;
  return (
    <PrContent
      prs={prs}
      info={info}
      bodyWeightKg={bodyWeightKg}
      onClose={onClose}
    />
  );
}

function PrContent({
  prs,
  info,
  bodyWeightKg,
  onClose,
}: {
  prs: SessionPr[];
  info: (pr: SessionPr) => PrInfo;
  bodyWeightKg: number | null;
  onClose: () => void;
}) {
  const [idx, setIdx] = useState(0);
  const pr = prs[idx];
  const { name, reps } = info(pr);
  const ratio = bodyWeightKg ? pr.orm / bodyWeightKg : null;
  const jump = pr.orm - pr.prev_orm;

  function share() {
    const text = `¡Nuevo récord en ${name}: ${formatWeight(pr.orm)} de 1RM estimado! 💪`;
    if (navigator.share) {
      navigator.share({ text }).catch(() => {});
    } else {
      navigator.clipboard
        ?.writeText(text)
        .then(() => toast("Texto copiado"))
        .catch(() => {});
    }
  }

  return (
    <Modal
      open
      onClose={onClose}
      dismissible={false}
      hideClose
      title="Nuevo récord"
      footer={
        <div className="flex flex-col gap-2">
          <Button className="w-full" onClick={share}>
            <Share2 className="size-4" /> Compartir con amigos
          </Button>
          <Button variant="secondary" className="w-full" onClick={onClose}>
            Ver resumen
          </Button>
        </div>
      }
    >
      <div className="text-center">
        <div className="size-[74px] rounded-full bg-primary/15 grid place-items-center mx-auto mb-4">
          <Trophy className="size-9 text-primary" />
        </div>
        {prs.length > 1 && (
          <div className="mb-2 flex items-center justify-center gap-2 text-xs text-muted">
            <Button
              variant="ghost"
              size="sm"
              disabled={idx === 0}
              onClick={() => setIdx(idx - 1)}
            >
              Anterior
            </Button>
            <span className="tabular-nums">
              {idx + 1} de {prs.length}
            </span>
            <Button
              variant="ghost"
              size="sm"
              disabled={idx === prs.length - 1}
              onClick={() => setIdx(idx + 1)}
            >
              Siguiente
            </Button>
          </div>
        )}
        <h2 className="text-2xl font-extrabold tracking-tight">
          {name} · {formatWeight(pr.weight)}
        </h2>
        <p className="text-sm text-muted mt-1 mb-5">
          Tu 1RM estimado subió a{" "}
          <span className="text-success-fg font-semibold">
            {formatWeight(pr.orm)}
            {jump > 0 ? ` (+${formatWeight(jump)})` : ""}
          </span>
        </p>
        <div className="flex gap-4 justify-center mb-2">
          <div>
            <p className="text-xl font-extrabold">{formatWeight(pr.weight)}</p>
            <p className="text-xs text-muted mt-0.5">mejor set</p>
          </div>
          {reps != null && (
            <>
              <div className="w-px bg-border" />
              <div>
                <p className="text-xl font-extrabold text-primary">{reps}</p>
                <p className="text-xs text-muted mt-0.5">
                  {reps === 1 ? "rep del mejor set" : "reps del mejor set"}
                </p>
              </div>
            </>
          )}
          {ratio && (
            <>
              <div className="w-px bg-border" />
              <div>
                <p className="text-xl font-extrabold">
                  {fmtNum(ratio, 2)}×
                </p>
                <p className="text-xs text-muted mt-0.5">peso corporal</p>
              </div>
            </>
          )}
        </div>
      </div>
    </Modal>
  );
}
