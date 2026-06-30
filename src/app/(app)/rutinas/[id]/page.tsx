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
} from "lucide-react";
import { Button, Input, Spinner, Badge, Modal } from "@/components/ui";
import { ExerciseImage } from "@/components/ExerciseImage";
import { ExercisePickerModal } from "@/components/ExercisePickerModal";
import {
  useRoutine,
  useUpdateRoutine,
  useRoutineExerciseOps,
  useDeleteRoutine,
  useShareRoutine,
} from "@/hooks/useRoutines";
import { useStartWorkout } from "@/hooks/useWorkout";
import { useExerciseMap } from "@/hooks/useExercises";
import { muscleEs } from "@/lib/i18n-exercise";
import type { RoutineExercise } from "@/lib/types";

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
    setShareModal(`${base}/r/${code}`);
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
              onUpdate={(patch) => ops.update.mutate({ id: rex.id, patch })}
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
          <Button
            onClick={() => {
              navigator.clipboard.writeText(shareModal ?? "");
            }}
          >
            <Check className="size-4" /> Copiar
          </Button>
        </div>
      </Modal>
    </div>
  );
}

function RoutineExerciseRow({
  rex,
  exercise,
  isFirst,
  isLast,
  onUpdate,
  onRemove,
  onMoveUp,
  onMoveDown,
}: {
  rex: RoutineExercise;
  exercise?: { name: string; images: string[]; primary_muscles: string[] };
  isFirst: boolean;
  isLast: boolean;
  onUpdate: (patch: Partial<RoutineExercise>) => void;
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
          className="size-12 rounded-lg shrink-0"
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

      <div className="flex items-center gap-3 mt-3 text-sm">
        <label className="flex items-center gap-1.5 text-muted">
          Series
          <Input
            type="number"
            min={1}
            defaultValue={rex.target_sets ?? 3}
            onBlur={(e) =>
              onUpdate({ target_sets: Number(e.target.value) || 1 })
            }
            className="h-9 w-16 text-center"
          />
        </label>
        <label className="flex items-center gap-1.5 text-muted">
          Reps
          <Input
            type="number"
            min={1}
            defaultValue={rex.target_reps ?? 10}
            onBlur={(e) =>
              onUpdate({ target_reps: Number(e.target.value) || 1 })
            }
            className="h-9 w-16 text-center"
          />
        </label>
      </div>
    </li>
  );
}
