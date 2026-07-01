"use client";

import { useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import {
  ArrowLeft,
  Plus,
  Share2,
  Trash2,
  ChevronUp,
  ChevronDown,
  Play,
  Check,
  Copy,
  X,
} from "lucide-react";
import { Button, Input, Spinner, Badge, Modal } from "@/components/ui";
import { copyToClipboard } from "@/lib/clipboard";
import { ExerciseImage } from "@/components/ExerciseImage";
import { ExercisePickerModal } from "@/components/ExercisePickerModal";
import {
  useRoutine,
  useUpdateRoutine,
  useRoutineExerciseOps,
  useDeleteRoutine,
  useShareRoutine,
  type RoutineExerciseWithSets,
  type SetPlan,
} from "@/hooks/useRoutines";
import { useStartWorkout } from "@/hooks/useWorkout";
import { useExerciseMap } from "@/hooks/useExercises";
import { muscleEs } from "@/lib/i18n-exercise";

export default function RoutineEditorPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const { data, isLoading } = useRoutine(id);
  const exMap = useExerciseMap();
  const updateRoutine = useUpdateRoutine(id);
  const ops = useRoutineExerciseOps(id);
  const del = useDeleteRoutine();
  const share = useShareRoutine();
  const start = useStartWorkout();

  const [picker, setPicker] = useState(false);
  const [shareModal, setShareModal] = useState<string | null>(null);
  const [copyState, setCopyState] = useState<"idle" | "ok" | "fail">("idle");

  if (isLoading || !data) {
    return (
      <div className="grid place-items-center py-16">
        <Spinner />
      </div>
    );
  }

  const { routine, exercises } = data;

  async function handleShare() {
    const code = await share.mutateAsync(routine);
    const base =
      process.env.NEXT_PUBLIC_SITE_URL ?? window.location.origin;
    setCopyState("idle");
    setShareModal(`${base}/r/${code}`);
  }

  async function handleCopyShare() {
    if (!shareModal) return;
    const ok = await copyToClipboard(shareModal);
    setCopyState(ok ? "ok" : "fail");
  }

  async function handleStart() {
    if (!exercises.length) return;
    const sessionId = await start.mutateAsync(id);
    router.push(`/entrenar/${sessionId}`);
  }

  return (
    <div className="pb-20">
      <div className="flex items-center gap-2 mb-4">
        <Link href="/rutinas" className="text-muted hover:text-fg">
          <ArrowLeft className="size-5" />
        </Link>
        <Input
          defaultValue={routine.name}
          onBlur={(e) => {
            const v = e.target.value.trim();
            if (v && v !== routine.name) updateRoutine.mutate({ name: v });
          }}
          className="font-semibold"
        />
      </div>

      <div className="flex gap-2 mb-4">
        <Button variant="secondary" size="sm" onClick={handleShare} loading={share.isPending}>
          <Share2 className="size-4" /> Compartir
        </Button>
        <Button
          variant="danger"
          size="sm"
          onClick={async () => {
            if (confirm("¿Eliminar esta rutina?")) {
              await del.mutateAsync(id);
              router.push("/rutinas");
            }
          }}
        >
          <Trash2 className="size-4" /> Eliminar
        </Button>
      </div>

      {exercises.length === 0 ? (
        <div className="card p-8 text-center text-muted text-sm mb-4">
          Agregá ejercicios a esta rutina.
        </div>
      ) : (
        <ul className="flex flex-col gap-2.5 mb-4">
          {exercises.map((rex, i) => (
            <RoutineExerciseRow
              key={rex.id}
              rex={rex}
              exercise={exMap.get(rex.exercise_id)}
              isFirst={i === 0}
              isLast={i === exercises.length - 1}
              onSaveSets={(plans) =>
                ops.saveSets.mutate({ rexId: rex.id, plans })
              }
              onRemove={() => ops.remove.mutate(rex.id)}
              onMoveUp={() => ops.swap.mutate({ a: rex, b: exercises[i - 1] })}
              onMoveDown={() => ops.swap.mutate({ a: rex, b: exercises[i + 1] })}
            />
          ))}
        </ul>
      )}

      <Button
        variant="secondary"
        className="w-full"
        onClick={() => setPicker(true)}
      >
        <Plus className="size-4" /> Agregar ejercicio
      </Button>

      {exercises.length > 0 && (
        <div className="fixed bottom-20 inset-x-0 px-4">
          <div className="mx-auto max-w-2xl">
            <Button
              size="lg"
              className="w-full shadow-lg"
              onClick={handleStart}
              loading={start.isPending}
            >
              <Play className="size-5" /> Empezar entrenamiento
            </Button>
          </div>
        </div>
      )}

      <ExercisePickerModal
        open={picker}
        onClose={() => setPicker(false)}
        onSelect={(ex) =>
          ops.add.mutate({ exerciseId: ex.id, position: exercises.length })
        }
      />

      <Modal
        open={!!shareModal}
        onClose={() => setShareModal(null)}
        title="Compartir rutina"
      >
        <p className="text-sm text-muted mb-3">
          Cualquiera con este link puede copiar tu rutina (sin tus pesos).
        </p>
        <div className="flex gap-2">
          <Input readOnly value={shareModal ?? ""} />
          <Button onClick={handleCopyShare}>
            {copyState === "ok" ? (
              <Check className="size-4" />
            ) : (
              <Copy className="size-4" />
            )}
            {copyState === "ok" ? "Copiado" : "Copiar"}
          </Button>
        </div>
        {copyState === "fail" && (
          <p className="text-xs text-muted mt-2">
            No se pudo copiar automáticamente. Mantené presionado el link de
            arriba para copiarlo a mano.
          </p>
        )}
      </Modal>
    </div>
  );
}

function RoutineExerciseRow({
  rex,
  exercise,
  isFirst,
  isLast,
  onSaveSets,
  onRemove,
  onMoveUp,
  onMoveDown,
}: {
  rex: RoutineExerciseWithSets;
  exercise?: { name: string; images: string[]; primary_muscles: string[] };
  isFirst: boolean;
  isLast: boolean;
  onSaveSets: (plans: SetPlan[]) => void;
  onRemove: () => void;
  onMoveUp: () => void;
  onMoveDown: () => void;
}) {
  return (
    <li className="card p-3">
      <div className="flex items-center gap-3">
        <ExerciseImage
          src={exercise?.images[0]}
          alt={exercise?.name ?? ""}
          className="size-12 rounded shrink-0"
        />
        <div className="min-w-0 flex-1">
          <p className="font-medium truncate">{exercise?.name ?? "…"}</p>
          {exercise?.primary_muscles[0] && (
            <Badge>{muscleEs(exercise.primary_muscles[0])}</Badge>
          )}
        </div>
        <div className="flex flex-col">
          <button
            disabled={isFirst}
            onClick={onMoveUp}
            className="text-muted hover:text-fg disabled:opacity-30 p-0.5"
          >
            <ChevronUp className="size-4" />
          </button>
          <button
            disabled={isLast}
            onClick={onMoveDown}
            className="text-muted hover:text-fg disabled:opacity-30 p-0.5"
          >
            <ChevronDown className="size-4" />
          </button>
        </div>
        <button onClick={onRemove} className="text-muted hover:text-danger p-1">
          <Trash2 className="size-4" />
        </button>
      </div>

      <SetPlanner sets={rex.sets} onSave={onSaveSets} />
    </li>
  );
}

/** Editor de series planeadas: reps + peso por serie, para planear la progresión. */
function SetPlanner({
  sets,
  onSave,
}: {
  sets: { target_reps: number | null; target_weight: number | null }[];
  onSave: (plans: SetPlan[]) => void;
}) {
  const [rows, setRows] = useState<SetPlan[]>(
    sets.length
      ? sets.map((s) => ({
          target_reps: s.target_reps,
          target_weight: s.target_weight,
        }))
      : [{ target_reps: 10, target_weight: null }],
  );

  function updateRow(i: number, patch: Partial<SetPlan>) {
    setRows((rs) => rs.map((r, idx) => (idx === i ? { ...r, ...patch } : r)));
  }

  function addRow() {
    setRows((rs) => {
      const last = rs[rs.length - 1];
      const next = [
        ...rs,
        {
          target_reps: last?.target_reps ?? 10,
          target_weight: last?.target_weight ?? null,
        },
      ];
      onSave(next);
      return next;
    });
  }

  function removeRow(i: number) {
    setRows((rs) => {
      if (rs.length <= 1) return rs;
      const next = rs.filter((_, idx) => idx !== i);
      onSave(next);
      return next;
    });
  }

  return (
    <div className="mt-3 flex flex-col gap-1.5">
      <div className="flex items-center gap-2 px-1 text-[11px] uppercase tracking-wide text-muted">
        <span className="w-8">Serie</span>
        <span className="flex-1 text-center">Reps</span>
        <span className="flex-1 text-center">Peso (kg)</span>
        <span className="w-7" />
      </div>
      {rows.map((r, i) => (
        <div key={i} className="flex items-center gap-2">
          <span className="w-8 text-center text-sm text-muted tabular-nums">
            {i + 1}
          </span>
          <Input
            type="number"
            inputMode="numeric"
            min={0}
            placeholder="—"
            value={r.target_reps ?? ""}
            onChange={(e) =>
              updateRow(i, {
                target_reps:
                  e.target.value === "" ? null : Number(e.target.value),
              })
            }
            onBlur={() => onSave(rows)}
            className="h-9 flex-1 text-center"
          />
          <Input
            type="number"
            inputMode="decimal"
            min={0}
            step="0.5"
            placeholder="—"
            value={r.target_weight ?? ""}
            onChange={(e) =>
              updateRow(i, {
                target_weight:
                  e.target.value === "" ? null : Number(e.target.value),
              })
            }
            onBlur={() => onSave(rows)}
            className="h-9 flex-1 text-center"
          />
          <button
            onClick={() => removeRow(i)}
            disabled={rows.length <= 1}
            className="w-7 text-muted hover:text-danger disabled:opacity-30"
            aria-label="Quitar serie"
          >
            <X className="size-4 mx-auto" />
          </button>
        </div>
      ))}
      <button
        type="button"
        onClick={addRow}
        className="mt-1 flex items-center justify-center gap-1.5 rounded-md py-2 text-sm font-medium text-muted ring-1 ring-border hover:text-fg"
      >
        <Plus className="size-4" /> Agregar serie
      </button>
    </div>
  );
}
