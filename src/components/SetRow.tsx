"use client";

import { useState } from "react";
import { Check, MessageSquare, Plus, X } from "lucide-react";
import { clsx } from "@/lib/clsx";
import type { SetDrop, WorkoutSet } from "@/lib/types";

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

  return (
    <div
      className={clsx(
        "rounded-md px-2 py-1.5 transition",
        set.completed ? "bg-success/10" : "bg-surface-2",
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
          onClick={() => setShowComment((s) => !s)}
          className={clsx(
            "size-9 grid place-items-center rounded shrink-0",
            set.comment ? "text-accent" : "text-muted hover:text-fg",
          )}
        >
          <MessageSquare className="size-4" />
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
