"use client";

import { useState } from "react";
import { Check, MessageSquare, Plus, X } from "lucide-react";
import { clsx } from "@/lib/clsx";
import { rirOf } from "@/lib/metrics";
import type { SetDrop, WorkoutSet } from "@/lib/types";

const RIR_OPTS = [0, 1, 2, 3, 4, 5];

/** Color de zona del RIR: 0–1 al fallo (danger), 2–3 productivo (success), 4–5+ lejos (muted). */
function rirZone(rir: number): "danger" | "success" | "muted" {
  if (rir <= 1) return "danger";
  if (rir <= 3) return "success";
  return "muted";
}

export function SetRow({
  set,
  onChange,
  onDelete,
}: {
  set: WorkoutSet;
  onChange: (patch: Partial<WorkoutSet>) => void;
  onDelete: () => void;
}) {
  const [showComment, setShowComment] = useState(!!set.comment);

  const drops: SetDrop[] =
    set.drops && set.drops.length > 0
      ? set.drops
      : [{ reps: set.reps, weight: set.weight }];

  const rir = rirOf(set);

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

        <NumberField
          value={drops[0].weight}
          placeholder="kg"
          step={2.5}
          onCommit={(v) => updateDrop(0, { weight: v })}
        />
        <span className="text-muted text-xs">×</span>
        <NumberField
          value={drops[0].reps}
          placeholder="reps"
          step={1}
          onCommit={(v) => updateDrop(0, { reps: v })}
        />

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
              const zone = rirZone(v);
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

      {drops.slice(1).map((d, i) => (
        <div key={i + 1} className="flex items-center gap-2 mt-1.5 pl-8">
          <span className="text-muted text-xs shrink-0">+ bajada</span>
          <NumberField
            value={d.weight}
            placeholder="kg"
            step={2.5}
            onCommit={(v) => updateDrop(i + 1, { weight: v })}
          />
          <span className="text-muted text-xs">×</span>
          <NumberField
            value={d.reps}
            placeholder="reps"
            step={1}
            onCommit={(v) => updateDrop(i + 1, { reps: v })}
          />
          <button
            onClick={() => removeDrop(i + 1)}
            className="size-7 grid place-items-center rounded shrink-0 text-muted hover:text-danger"
          >
            <X className="size-3.5" />
          </button>
        </div>
      ))}

      <button
        onClick={addDrop}
        className="flex items-center gap-1 mt-1.5 ml-8 text-xs text-muted hover:text-fg"
      >
        <Plus className="size-3.5" /> Agregar bajada
      </button>

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
  onCommit,
}: {
  value: number | null;
  placeholder: string;
  step: number;
  onCommit: (v: number | null) => void;
}) {
  return (
    <input
      type="number"
      inputMode="decimal"
      step={step}
      defaultValue={value ?? ""}
      key={value ?? "empty"}
      placeholder={placeholder}
      onBlur={(e) => {
        const v = e.target.value === "" ? null : Number(e.target.value);
        if (v !== value) onCommit(v);
      }}
      className="h-9 flex-1 min-w-0 rounded bg-surface px-2 text-center text-sm outline-none ring-1 ring-border focus:ring-primary"
    />
  );
}
