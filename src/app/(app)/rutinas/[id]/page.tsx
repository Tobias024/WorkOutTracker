// SPDX-License-Identifier: AGPL-3.0-only
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
  Repeat,
  X,
} from "lucide-react";
import { Button, Input, Spinner, Badge, Modal } from "@/components/ui";
import { createClient } from "@/lib/supabase/client";
import { copyToClipboard } from "@/lib/clipboard";
import { ExerciseImage } from "@/components/ExerciseImage";
import { ExercisePickerModal } from "@/components/ExercisePickerModal";
import { ExerciseDetailModal } from "@/components/ExerciseDetailModal";
import { ExerciseNoteEditor } from "@/components/ExerciseNoteEditor";
import { ReplaceExerciseModal } from "@/components/ReplaceExerciseModal";
import { formatClock, parseClock } from "@/lib/format";
import type { MetricKind } from "@/lib/types";
import {
  useRoutine,
  useUpdateRoutine,
  useRoutineExerciseOps,
  useDeleteRoutine,
  useShareRoutine,
  type RoutineExerciseWithSets,
  type SetPlan,
} from "@/hooks/useRoutines";
import {
  useStartWorkout,
  useLastExerciseLogs,
  type LastExerciseLog,
} from "@/hooks/useWorkout";
import { useExerciseNote } from "@/hooks/useExerciseNotes";
import { useExerciseMap } from "@/hooks/useExercises";
import { muscleEs } from "@/lib/i18n-exercise";
import type { Exercise } from "@/lib/types";

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
  // Último peso/reps por ejercicio (sesión terminada más reciente). Solo se
  // muestra como referencia: no pisa el plan de la rutina.
  const { data: lastLogs } = useLastExerciseLogs(
    (data?.exercises ?? []).map((r) => r.exercise_id),
  );

  const [picker, setPicker] = useState(false);
  const [shareModal, setShareModal] = useState<string | null>(null);
  const [copyState, setCopyState] = useState<"idle" | "ok" | "fail">("idle");
  const [copying, setCopying] = useState(false);

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

  async function handleCopy() {
    setCopying(true);
    try {
      // Copia = compartir a uno mismo: aseguramos share_code e importamos.
      const code = await share.mutateAsync(routine);
      const supabase = createClient();
      const { data: newId, error } = await supabase.rpc("import_routine", {
        p_share_code: code,
      });
      if (error) throw error;
      router.push(`/rutinas/${newId}`);
    } catch {
      setCopying(false);
    }
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
        <Button variant="secondary" size="sm" onClick={handleCopy} loading={copying}>
          <Copy className="size-4" /> Copiar
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
              last={lastLogs?.get(rex.exercise_id)}
              isFirst={i === 0}
              isLast={i === exercises.length - 1}
              onSaveSets={(plans) =>
                ops.saveSets.mutate({ rexId: rex.id, plans })
              }
              onRemove={() => ops.remove.mutate(rex.id)}
              onReplace={(newEx) =>
                ops.replace.mutate({ id: rex.id, exerciseId: newEx.id })
              }
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
  last,
  isFirst,
  isLast,
  onSaveSets,
  onRemove,
  onReplace,
  onMoveUp,
  onMoveDown,
}: {
  rex: RoutineExerciseWithSets;
  exercise?: Exercise;
  last?: LastExerciseLog;
  isFirst: boolean;
  isLast: boolean;
  onSaveSets: (plans: SetPlan[]) => void;
  onRemove: () => void;
  onReplace: (newExercise: Exercise) => void;
  onMoveUp: () => void;
  onMoveDown: () => void;
}) {
  const [detail, setDetail] = useState(false);
  const [replace, setReplace] = useState(false);
  const { data: note } = useExerciseNote(rex.exercise_id);

  return (
    <li className="card p-3">
      <div className="flex items-center gap-3">
        <button
          onClick={() => setDetail(true)}
          className="flex items-center gap-3 min-w-0 flex-1 text-left"
        >
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
        </button>
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
        <button
          onClick={() => setReplace(true)}
          aria-label="Reemplazar ejercicio"
          className="text-muted hover:text-fg p-1"
        >
          <Repeat className="size-4" />
        </button>
        <button onClick={onRemove} className="text-muted hover:text-danger p-1">
          <Trash2 className="size-4" />
        </button>
      </div>

      <SetPlanner
        sets={rex.sets}
        kind={exercise?.metric_kind ?? "reps_weight"}
        last={last}
        onSave={onSaveSets}
      />

      <ExerciseNoteEditor exerciseId={rex.exercise_id} initial={note ?? ""} />

      <ExerciseDetailModal
        exercise={detail ? exercise ?? null : null}
        onClose={() => setDetail(false)}
      />
      <ReplaceExerciseModal
        open={replace}
        onClose={() => setReplace(false)}
        currentName={exercise?.name ?? ""}
        currentMuscle={exercise?.primary_muscles[0]}
        canSaveForFuture={false}
        onReplace={(newEx) => {
          onReplace(newEx);
          setReplace(false);
        }}
      />
    </li>
  );
}

/** Editor de series planeadas: reps + peso por serie, para planear la progresión. */
function SetPlanner({
  sets,
  kind,
  last,
  onSave,
}: {
  sets: {
    target_reps: number | null;
    target_weight: number | null;
    target_duration_seconds?: number | null;
    target_distance_m?: number | null;
  }[];
  /** Mismo criterio que SetRow: el tipo del ejercicio decide qué se planifica. */
  kind: MetricKind;
  last?: LastExerciseLog;
  onSave: (plans: SetPlan[]) => void;
}) {
  const showsLoad = kind === "reps_weight" || kind === "time_load";
  const showsReps = kind === "reps_weight";
  const showsDuration = kind !== "reps_weight";
  const showsDistance = kind === "distance_time";
  const [rows, setRows] = useState<SetPlan[]>(
    sets.length
      ? sets.map((s) => ({
          target_reps: s.target_reps,
          target_weight: s.target_weight,
          target_duration_seconds: s.target_duration_seconds ?? null,
          target_distance_m: s.target_distance_m ?? null,
        }))
      : [
          {
            target_reps: showsReps ? 10 : null,
            target_weight: null,
            target_duration_seconds: null,
            target_distance_m: null,
          },
        ],
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
          target_reps: last?.target_reps ?? (showsReps ? 10 : null),
          target_weight: last?.target_weight ?? null,
          target_duration_seconds: last?.target_duration_seconds ?? null,
          target_distance_m: last?.target_distance_m ?? null,
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

  /** Peso/reps de la última vez para esta serie (por número de serie; si esa
   *  serie no existe en el registro anterior, cae a la última que sí). */
  function lastFor(setNumber: number) {
    if (!last || last.sets.length === 0) return null;
    const s =
      last.sets.find((x) => x.set_number === setNumber) ??
      last.sets[last.sets.length - 1];
    if (!s || (s.weight == null && s.reps == null)) return null;
    const w = s.weight != null ? `${s.weight} kg` : "—";
    const r = s.reps != null ? ` × ${s.reps}` : "";
    return `últ. ${w}${r}`;
  }

  return (
    <div className="mt-3 flex flex-col gap-1.5">
      <div className="flex items-center gap-2 px-1 text-[11px] uppercase tracking-wide text-muted">
        <span className="w-8">Serie</span>
        {showsReps && <span className="flex-1 text-center">Reps</span>}
        {showsDistance && <span className="flex-1 text-center">km</span>}
        {showsDuration && <span className="flex-1 text-center">mm:ss</span>}
        {showsLoad && <span className="flex-1 text-center">Peso (kg)</span>}
        <span className="w-7" />
      </div>
      {rows.map((r, i) => {
        const hint = lastFor(i + 1);
        return (
          <div key={i}>
            <div className="flex items-center gap-2">
              <span className="w-8 text-center text-sm text-muted tabular-nums">
                {i + 1}
              </span>
              {showsReps && (
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
              )}
              {showsDistance && (
                <Input
                  type="number"
                  inputMode="decimal"
                  min={0}
                  step="0.1"
                  placeholder="—"
                  value={
                    r.target_distance_m == null ? "" : r.target_distance_m / 1000
                  }
                  onChange={(e) =>
                    updateRow(i, {
                      target_distance_m:
                        e.target.value === ""
                          ? null
                          : Math.round(Number(e.target.value) * 1000),
                    })
                  }
                  onBlur={() => onSave(rows)}
                  className="h-9 flex-1 text-center"
                />
              )}
              {showsDuration && (
                <Input
                  type="text"
                  inputMode="numeric"
                  placeholder="mm:ss"
                  defaultValue={
                    r.target_duration_seconds == null
                      ? ""
                      : formatClock(r.target_duration_seconds)
                  }
                  key={r.target_duration_seconds ?? "empty"}
                  onBlur={(e) => {
                    updateRow(i, {
                      target_duration_seconds: parseClock(e.target.value),
                    });
                    onSave(rows);
                  }}
                  className="h-9 flex-1 text-center"
                />
              )}
              {showsLoad && (
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
              )}
              <button
                onClick={() => removeRow(i)}
                disabled={rows.length <= 1}
                className="w-7 text-muted hover:text-danger disabled:opacity-30"
                aria-label="Quitar serie"
              >
                <X className="size-4 mx-auto" />
              </button>
            </div>
            {hint && (
              <div className="flex gap-2 mt-0.5">
                <span className="w-8" />
                <span className="flex-1 text-center text-[11px] text-muted tabular-nums">
                  {hint}
                </span>
                <span className="w-7" />
              </div>
            )}
          </div>
        );
      })}
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
