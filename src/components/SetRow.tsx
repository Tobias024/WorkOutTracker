// SPDX-License-Identifier: AGPL-3.0-only
"use client";

import { useState } from "react";
import { ArrowDown, ArrowUp, Check, MessageSquare, Plus, X } from "lucide-react";
import { clsx } from "@/lib/clsx";
import { formatClock, formatPace, formatWeight, parseClock } from "@/lib/format";
import { rirOf } from "@/lib/metrics";
import { repDeviation, rirProductiveLabel, rirZone } from "@/lib/goal-params";
import type {
  MetricKind,
  SetDrop,
  TrainingProfile,
  WorkoutSet,
} from "@/lib/types";

const RIR_OPTS = [0, 1, 2, 3, 4, 5];

/** Plan de la serie: snapshot de la rutina, guardado al arrancar la sesión. */
export interface PlannedSet {
  reps: number | null;
  weight: number | null;
  duration_seconds: number | null;
  distance_m: number | null;
}

/** Ring de la caja del peso según cuánto se desvían las reps del plan. */
const DEVIATION_RING: Record<"ok" | "off" | "far", string> = {
  ok: "ring-1 ring-success/50",
  off: "ring-2 ring-warning",
  far: "ring-2 ring-danger",
};

export function SetRow({
  set,
  ghost,
  planned,
  profile,
  kind = "reps_weight",
  onChange,
  onDelete,
  onStart,
}: {
  set: WorkoutSet;
  /** Peso/reps + bajadas de la última vez (placeholder tenue si el campo está vacío). */
  ghost?: {
    weight: number | null;
    reps: number | null;
    drops?: SetDrop[] | null;
    duration_seconds?: number | null;
    distance_m?: number | null;
  } | null;
  /** Lo que la rutina pedía para esta serie. Queda visible toda la sesión. */
  planned?: PlannedSet | null;
  /** Objetivo del usuario: decide zonas de RIR y tolerancia de reps. */
  profile?: TrainingProfile | null;
  /** Cómo se mide este ejercicio; decide qué campos se piden. */
  kind?: MetricKind;
  onChange: (patch: Partial<WorkoutSet>) => void;
  onDelete: () => void;
  /**
   * Empezó a cargarse esta serie (foco en peso/reps): es la señal de que el
   * descanso anterior terminó. Sólo se pasa en series sin tildar.
   */
  onStart?: () => void;
}) {
  const [showComment, setShowComment] = useState(!!set.comment);

  const drops: SetDrop[] =
    set.drops && set.drops.length > 0
      ? set.drops
      : [{ reps: set.reps, weight: set.weight }];

  const rir = rirOf(set);

  const showsLoad = kind === "reps_weight" || kind === "time_load";
  const showsReps = kind === "reps_weight";
  const showsDuration = kind !== "reps_weight";
  const showsDistance = kind === "distance_time";
  // Las bajadas son un recurso de series con carga y reps; en tiempo o
  // distancia no significan nada.
  const showsDrops = kind === "reps_weight";
  const pace = showsDistance
    ? formatPace(set.duration_seconds, set.distance_m)
    : null;

  // Desvío de reps vs. plan. Sólo se evalúa con reps ya cargadas (o la serie
  // tildada): si no, cada fila vacía arrancaría pintada de ámbar. Los warmups
  // quedan afuera porque no tienen plan que cumplir.
  const deviation =
    !set.is_warmup && showsReps && (set.completed || drops[0].reps != null)
      ? repDeviation(drops[0].reps, planned?.reps ?? null, profile)
      : null;

  // El plan se muestra en el chip ⓘ, y como placeholder sólo si nunca hiciste
  // el ejercicio (sin ghost): ahí es la mejor pista gris disponible.
  const hint = {
    weight: ghost?.weight ?? planned?.weight ?? null,
    reps: ghost?.reps ?? planned?.reps ?? null,
    duration_seconds:
      ghost?.duration_seconds ?? planned?.duration_seconds ?? null,
    distance_m: ghost?.distance_m ?? planned?.distance_m ?? null,
  };

  const plannedLabel = planned
    ? [
        planned.weight != null ? formatWeight(planned.weight) : null,
        planned.reps != null ? `${planned.reps} reps` : null,
        planned.duration_seconds != null
          ? formatClock(planned.duration_seconds)
          : null,
        planned.distance_m != null ? `${planned.distance_m / 1000} km` : null,
      ]
        .filter(Boolean)
        .join(" × ")
    : "";

  function commitDrops(next: SetDrop[]) {
    const first = next[0] ?? { reps: null, weight: null };
    onChange({
      drops: next.length > 1 ? next : null,
      weight: first.weight,
      reps: first.reps,
    });
  }

  function updateDrop(index: number, patch: Partial<SetDrop>) {
    commitDrops(drops.map((d, i) => (i === index ? { ...d, ...patch } : d)));
  }

  function addDrop() {
    commitDrops([...drops, { reps: null, weight: null }]);
  }

  function removeDrop(index: number) {
    commitDrops(drops.filter((_, i) => i !== index));
  }

  function setRir(v: number | null) {
    // Guarda en la columna rpe (rpe = 10 − rir); toggle si se re-toca el mismo.
    onChange({ rpe: v == null ? null : 10 - v });
  }

  return (
    <div
      className={clsx(
        "rounded-md px-2 py-1.5 transition",
        set.completed ? "bg-success/10" : "bg-surface-2",
        set.is_warmup && "opacity-60",
      )}
    >
      <div className="flex items-center gap-2">
        <span className="w-6 text-center text-sm text-muted font-medium">
          {set.set_number}
        </span>

        {showsLoad && (
          <NumberField
            value={drops[0].weight}
            placeholder={hint.weight != null ? String(hint.weight) : "kg"}
            step={2.5}
            // El color va en la caja del PESO aunque lo dispare el desvío de
            // reps: la corrección que se sugiere es sobre la carga.
            ring={deviation ? DEVIATION_RING[deviation.level] : undefined}
            onCommit={(v) => updateDrop(0, { weight: v })}
            onFocus={onStart}
          />
        )}
        {showsLoad && showsReps && <span className="text-muted text-xs">×</span>}
        {showsReps && (
          <NumberField
            value={drops[0].reps}
            placeholder={hint.reps != null ? String(hint.reps) : "reps"}
            step={1}
            onCommit={(v) => updateDrop(0, { reps: v })}
            onFocus={onStart}
          />
        )}
        {showsDistance && (
          <NumberField
            value={set.distance_m == null ? null : set.distance_m / 1000}
            placeholder={
              hint.distance_m != null ? String(hint.distance_m / 1000) : "km"
            }
            step={0.1}
            onCommit={(v) =>
              onChange({ distance_m: v == null ? null : Math.round(v * 1000) })
            }
            onFocus={onStart}
          />
        )}
        {showsLoad && showsDuration && (
          <span className="text-muted text-xs">×</span>
        )}
        {showsDuration && (
          <ClockField
            value={set.duration_seconds}
            placeholder={
              hint.duration_seconds != null
                ? formatClock(hint.duration_seconds)
                : "mm:ss"
            }
            onCommit={(v) => onChange({ duration_seconds: v })}
            onFocus={onStart}
          />
        )}

        <button
          onClick={() => onChange({ is_warmup: !set.is_warmup })}
          title="Calentamiento (no cuenta)"
          className={clsx(
            "size-9 grid place-items-center rounded shrink-0 text-xs font-bold transition",
            set.is_warmup
              ? "bg-warning/20 text-warning ring-1 ring-warning/40"
              : "bg-surface ring-1 ring-border text-muted hover:text-fg",
          )}
        >
          W
        </button>

        <button
          onClick={() => onChange({ completed: !set.completed })}
          className={clsx(
            "size-9 grid place-items-center rounded shrink-0 transition",
            set.completed
              ? "bg-success text-bg"
              : "bg-surface ring-1 ring-border text-muted hover:text-fg",
          )}
        >
          <Check className="size-4" />
        </button>

        <button
          onClick={onDelete}
          className="size-9 grid place-items-center rounded shrink-0 text-muted hover:text-danger"
        >
          <X className="size-4" />
        </button>
      </div>

      {/* RIR segmentado (oculto en warmups, que no llevan proximidad al fallo) */}
      {!set.is_warmup && (
        <div className="flex items-center gap-2 mt-1.5 pl-8">
          <span className="text-muted text-xs shrink-0">RIR</span>
          <div className="flex gap-1">
            {RIR_OPTS.map((v) => {
              const active = rir === v;
              const zone = rirZone(v, profile);
              return (
                <button
                  key={v}
                  onClick={() => setRir(active ? null : v)}
                  className={clsx(
                    "h-6 w-6 rounded text-[11px] font-bold transition",
                    active &&
                      "text-bg ring-2 scale-110 shadow-sm",
                    active && zone === "danger" && "bg-danger ring-danger",
                    active && zone === "success" && "bg-success ring-success",
                    active && zone === "muted" && "bg-muted ring-muted",
                    !active &&
                      "bg-surface text-muted ring-1 ring-border hover:text-fg",
                  )}
                >
                  {v === 5 ? "5+" : v}
                </button>
              );
            })}
          </div>
          <button
            onClick={() => setShowComment((s) => !s)}
            className={clsx(
              "size-6 grid place-items-center rounded shrink-0 ml-auto",
              set.comment ? "text-accent" : "text-muted hover:text-fg",
            )}
          >
            <MessageSquare className="size-3.5" />
          </button>
        </div>
      )}

      {/* Plan de la serie. Es un chip fijo, no un placeholder: el placeholder
          desaparece al primer tecleo y era justamente lo que hacía perder la
          referencia apenas empezabas el ejercicio. */}
      {!set.is_warmup && plannedLabel && (
        <div className="flex items-center gap-1.5 mt-1 pl-8 text-[11px] tabular-nums">
          <span className="text-muted">
            ⓘ plan {plannedLabel}
            {showsReps && ` · RIR ${rirProductiveLabel(profile)}`}
          </span>
          {deviation?.direction && (
            <span
              className={clsx(
                "flex items-center gap-0.5 font-medium",
                deviation.level === "far" ? "text-danger" : "text-warning",
              )}
            >
              {deviation.direction === "under" ? (
                <>
                  <ArrowDown className="size-3" /> bajá el peso
                </>
              ) : (
                <>
                  <ArrowUp className="size-3" /> subí el peso
                </>
              )}
            </span>
          )}
        </div>
      )}

      {pace && (
        <div className="mt-1 pl-8 text-xs text-muted">Ritmo {pace}</div>
      )}

      {showsDrops && drops.slice(1).map((d, i) => {
        const gd = ghost?.drops?.[i + 1];
        return (
        <div key={i + 1} className="flex items-center gap-2 mt-1.5 pl-8">
          <span className="text-muted text-xs shrink-0">+ bajada</span>
          <NumberField
            value={d.weight}
            placeholder={gd?.weight != null ? String(gd.weight) : "kg"}
            step={2.5}
            onCommit={(v) => updateDrop(i + 1, { weight: v })}
            onFocus={onStart}
          />
          <span className="text-muted text-xs">×</span>
          <NumberField
            value={d.reps}
            placeholder={gd?.reps != null ? String(gd.reps) : "reps"}
            step={1}
            onCommit={(v) => updateDrop(i + 1, { reps: v })}
            onFocus={onStart}
          />
          <button
            onClick={() => removeDrop(i + 1)}
            className="size-7 grid place-items-center rounded shrink-0 text-muted hover:text-danger"
          >
            <X className="size-3.5" />
          </button>
        </div>
        );
      })}

      {showsDrops && (
        <button
          onClick={addDrop}
          className="flex items-center gap-1 mt-1.5 ml-8 text-xs text-muted hover:text-fg"
        >
          <Plus className="size-3.5" /> Agregar bajada
        </button>
      )}

      {showComment && (
        <input
          defaultValue={set.comment ?? ""}
          placeholder="Comentario…"
          onBlur={(e) => onChange({ comment: e.target.value || null })}
          className="mt-1.5 w-full rounded bg-surface px-2.5 py-1.5 text-sm outline-none ring-1 ring-border focus:ring-primary"
        />
      )}
    </div>
  );
}

function NumberField({
  value,
  placeholder,
  step,
  ring,
  onCommit,
  onFocus,
}: {
  value: number | null;
  placeholder: string;
  step: number;
  /** Ring de estado (desvío vs. plan). Por defecto, el borde neutro. */
  ring?: string;
  onCommit: (v: number | null) => void;
  onFocus?: () => void;
}) {
  return (
    <input
      type="number"
      inputMode="decimal"
      step={step}
      defaultValue={value ?? ""}
      key={value ?? "empty"}
      placeholder={placeholder}
      onFocus={onFocus}
      onBlur={(e) => {
        const v = e.target.value === "" ? null : Number(e.target.value);
        if (v !== value) onCommit(v);
      }}
      className={clsx(
        "h-9 flex-1 min-w-0 rounded bg-surface px-2 text-center text-sm outline-none focus:ring-primary",
        ring ?? "ring-1 ring-border",
      )}
    />
  );
}

/**
 * Campo de duración en mm:ss. Mismo contrato que `NumberField` (no controlado,
 * `key` para remontar cuando cambia el valor de afuera, commit en blur) para no
 * romper el patrón del resto de la fila. `type="text"` con `inputMode="numeric"`
 * porque un `type="number"` no acepta los dos puntos.
 */
function ClockField({
  value,
  placeholder,
  onCommit,
  onFocus,
}: {
  value: number | null;
  placeholder: string;
  onCommit: (v: number | null) => void;
  onFocus?: () => void;
}) {
  return (
    <input
      type="text"
      inputMode="numeric"
      defaultValue={value == null ? "" : formatClock(value)}
      key={value ?? "empty"}
      placeholder={placeholder}
      onFocus={onFocus}
      onBlur={(e) => {
        const v = parseClock(e.target.value);
        if (v !== value) onCommit(v);
      }}
      className="h-9 flex-1 min-w-0 rounded bg-surface px-2 text-center text-sm outline-none ring-1 ring-border focus:ring-primary"
    />
  );
}
