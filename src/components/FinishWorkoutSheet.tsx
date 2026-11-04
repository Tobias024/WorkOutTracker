// SPDX-License-Identifier: AGPL-3.0-only
"use client";

import { Button, Modal } from "@/components/ui";
import { formatClock, formatVolume } from "@/lib/format";

/** Confirmación de "Terminar": mini-resumen y aviso de series sin completar. */
export function FinishWorkoutSheet({
  open,
  durationSeconds,
  doneSets,
  totalSets,
  tonnage,
  loading,
  error,
  onCancel,
  onConfirm,
}: {
  open: boolean;
  durationSeconds: number;
  doneSets: number;
  totalSets: number;
  tonnage: number;
  loading?: boolean;
  error?: string | null;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  const pending = totalSets - doneSets;
  return (
    <Modal
      open={open}
      onClose={onCancel}
      title="¿Terminar el entreno?"
      dismissible={!loading}
      footer={
        <div className="flex gap-3">
          <Button
            variant="secondary"
            className="flex-1"
            onClick={onCancel}
            disabled={loading}
          >
            Seguir entrenando
          </Button>
          <Button
            variant="success"
            className="flex-1"
            onClick={onConfirm}
            loading={loading}
          >
            Terminar
          </Button>
        </div>
      }
    >
      <div className="flex flex-col gap-3">
        <div className="grid grid-cols-3 gap-2 text-center">
          <div>
            <p className="font-mono text-base font-bold tabular-nums">
              {formatClock(durationSeconds)}
            </p>
            <p className="text-xs text-muted">Duración</p>
          </div>
          <div>
            <p className="text-base font-bold tabular-nums">
              {doneSets}/{totalSets}
            </p>
            <p className="text-xs text-muted">Series</p>
          </div>
          <div>
            <p className="text-base font-bold tabular-nums">
              {formatVolume(tonnage)}
            </p>
            <p className="text-xs text-muted">Tonelaje</p>
          </div>
        </div>
        {pending > 0 && (
          <p className="text-sm text-warning-fg">
            Te quedan {pending} {pending === 1 ? "serie" : "series"} sin
            completar: no se van a contar.
          </p>
        )}
        {error && (
          <p role="alert" className="text-sm text-danger">
            {error}
          </p>
        )}
      </div>
    </Modal>
  );
}
