"use client";

import { Trophy, Share2 } from "lucide-react";
import { Button } from "@/components/ui";
import { formatWeight } from "@/lib/format";
import type { SessionPr } from "@/lib/types";

/** Bottom sheet de celebración al romper un récord de e1RM al terminar la sesión. */
export function PrCelebrationModal({
  pr,
  exerciseName,
  bodyWeightKg,
  onClose,
}: {
  pr: SessionPr | null;
  exerciseName: string;
  bodyWeightKg: number | null;
  onClose: () => void;
}) {
  if (!pr) return null;
  const jump = Math.round(pr.orm - pr.prev_orm);
  const ratio = bodyWeightKg ? pr.orm / bodyWeightKg : null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/65 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="card w-full sm:max-w-lg rounded-t-3xl rounded-b-none text-center p-6 pb-8"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="size-[74px] rounded-full bg-primary/15 grid place-items-center mx-auto mb-4">
          <Trophy className="size-9 text-primary" />
        </div>
        <p className="text-xs font-bold tracking-[0.12em] text-primary">
          NUEVO RÉCORD
        </p>
        <h2 className="text-2xl font-extrabold mt-2 tracking-tight">
          {exerciseName} · {formatWeight(pr.weight)}
        </h2>
        <p className="text-sm text-muted mt-1 mb-5">
          Tu 1RM estimado subió a{" "}
          <span className="text-success font-semibold">
            {Math.round(pr.orm)} kg{jump > 0 ? ` (+${jump})` : ""}
          </span>
        </p>
        <div className="flex gap-4 justify-center mb-6">
          <div>
            <p className="text-xl font-extrabold">{Math.round(pr.weight)}</p>
            <p className="text-[10.5px] text-muted mt-0.5">kg del mejor set</p>
          </div>
          <div className="w-px bg-border" />
          <div>
            <p className="text-xl font-extrabold text-primary">
              +{Math.round(pr.orm - pr.prev_orm)}
            </p>
            <p className="text-[10.5px] text-muted mt-0.5">kg vs 1RM previo</p>
          </div>
          {ratio && (
            <>
              <div className="w-px bg-border" />
              <div>
                <p className="text-xl font-extrabold">{ratio.toFixed(2)}×</p>
                <p className="text-[10.5px] text-muted mt-0.5">peso corporal</p>
              </div>
            </>
          )}
        </div>
        <Button
          className="w-full"
          onClick={() => {
            const text = `¡Nuevo récord en ${exerciseName}: ${Math.round(pr.orm)} kg de 1RM estimado! 💪`;
            if (navigator.share) navigator.share({ text }).catch(() => {});
            else navigator.clipboard?.writeText(text).catch(() => {});
          }}
        >
          <Share2 className="size-4" /> Compartir con amigos
        </Button>
        <button
          onClick={onClose}
          className="w-full mt-2 py-2 text-sm font-semibold text-muted hover:text-fg"
        >
          Seguir
        </button>
      </div>
    </div>
  );
}
