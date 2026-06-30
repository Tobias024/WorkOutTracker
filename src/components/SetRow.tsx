"use client";

import { useState } from "react";
import { Check, MessageSquare, X } from "lucide-react";
import { clsx } from "@/lib/clsx";
import type { WorkoutSet } from "@/lib/types";

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

  return (
    <div
      className={clsx(
        "rounded-xl px-2 py-1.5 transition",
        set.completed ? "bg-success/10" : "bg-surface-2",
      )}
    >
      <div className="flex items-center gap-2">
        <span className="w-6 text-center text-sm text-muted font-medium">
          {set.set_number}
        </span>

        <NumberField
          value={set.weight}
          placeholder="kg"
          step={2.5}
          onCommit={(v) => onChange({ weight: v })}
        />
        <span className="text-muted text-xs">×</span>
        <NumberField
          value={set.reps}
          placeholder="reps"
          step={1}
          onCommit={(v) => onChange({ reps: v })}
        />

        <button
          onClick={() => setShowComment((s) => !s)}
          className={clsx(
            "size-9 grid place-items-center rounded-lg shrink-0",
            set.comment ? "text-accent" : "text-muted hover:text-fg",
          )}
        >
          <MessageSquare className="size-4" />
        </button>

        <button
          onClick={() => onChange({ completed: !set.completed })}
          className={clsx(
            "size-9 grid place-items-center rounded-lg shrink-0 transition",
            set.completed
              ? "bg-success text-bg"
              : "bg-surface ring-1 ring-border text-muted hover:text-fg",
          )}
        >
          <Check className="size-4" />
        </button>

        <button
          onClick={onDelete}
          className="size-9 grid place-items-center rounded-lg shrink-0 text-muted hover:text-danger"
        >
          <X className="size-4" />
        </button>
      </div>

      {showComment && (
        <input
          defaultValue={set.comment ?? ""}
          placeholder="Comentario…"
          onBlur={(e) => onChange({ comment: e.target.value || null })}
          className="mt-1.5 w-full rounded-lg bg-surface px-2.5 py-1.5 text-sm outline-none ring-1 ring-border focus:ring-primary"
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
      className="h-9 flex-1 min-w-0 rounded-lg bg-surface px-2 text-center text-sm outline-none ring-1 ring-border focus:ring-primary"
    />
  );
}
