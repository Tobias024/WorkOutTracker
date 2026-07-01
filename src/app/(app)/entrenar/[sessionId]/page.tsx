"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { ArrowLeft, Plus, Flag, Clock } from "lucide-react";
import { Button, Input, Spinner } from "@/components/ui";
import { ExercisePickerModal } from "@/components/ExercisePickerModal";
import { SessionExerciseCard } from "@/components/SessionExerciseCard";
import { StopwatchFab } from "@/components/Stopwatch";
import { useWorkoutSession } from "@/hooks/useWorkout";
import { useSessionMutations } from "@/hooks/useWorkoutMutations";
import { useExerciseMap } from "@/hooks/useExercises";
import { formatClock } from "@/lib/format";

function toLocalInput(iso: string | null): string {
  if (!iso) return "";
  const d = new Date(iso);
  const off = d.getTimezoneOffset();
  return new Date(d.getTime() - off * 60000).toISOString().slice(0, 16);
}

export default function WorkoutPage() {
  const { sessionId } = useParams<{ sessionId: string }>();
  const router = useRouter();
  const { data, isLoading } = useWorkoutSession(sessionId);
  const exMap = useExerciseMap();
  const m = useSessionMutations(sessionId);
  const [picker, setPicker] = useState(false);
  const [now, setNow] = useState(0);

  const ended = !!data?.session.ended_at;

  useEffect(() => {
    const tick = () => setNow(Date.now());
    tick();
    if (ended) return;
    const t = setInterval(tick, 1000);
    return () => clearInterval(t);
  }, [ended]);

  if (isLoading || !data) {
    return (
      <div className="grid place-items-center py-16">
        <Spinner />
      </div>
    );
  }

  const { session, exercises } = data;

  const elapsed = session.started_at
    ? ended && session.duration_seconds != null
      ? session.duration_seconds
      : Math.floor(
          ((ended && session.ended_at
            ? new Date(session.ended_at).getTime()
            : now) -
            new Date(session.started_at).getTime()) /
            1000,
        )
    : 0;

  async function finish() {
    const endIso = new Date().toISOString();
    const duration = session.started_at
      ? Math.floor(
          (new Date(endIso).getTime() -
            new Date(session.started_at).getTime()) /
            1000,
        )
      : null;
    await m.updateSession.mutateAsync({
      ended_at: endIso,
      duration_seconds: duration,
    });
    router.push("/registro");
  }

  return (
    <div className="pb-24">
      <div className="flex items-center gap-2 mb-3">
        <button
          onClick={() => router.push("/rutinas")}
          className="text-muted hover:text-fg"
        >
          <ArrowLeft className="size-5" />
        </button>
        <Input
          defaultValue={session.name}
          onBlur={(e) => {
            const v = e.target.value.trim();
            if (v && v !== session.name) m.updateSession.mutate({ name: v });
          }}
          className="font-semibold"
        />
      </div>

      {/* Tiempo de sesión */}
      <div className="card p-3 mb-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 text-muted text-sm">
            <Clock className="size-4" />
            Duración
          </div>
          <span className="font-mono text-lg tabular-nums">
            {formatClock(elapsed)}
          </span>
        </div>
        <div className="grid grid-cols-2 gap-2 mt-3">
          <label className="text-xs text-muted">
            Inicio
            <input
              type="datetime-local"
              defaultValue={toLocalInput(session.started_at)}
              onBlur={(e) =>
                m.updateSession.mutate({
                  started_at: e.target.value
                    ? new Date(e.target.value).toISOString()
                    : null,
                })
              }
              className="mt-1 h-9 w-full rounded bg-surface-2 px-2 text-sm text-fg outline-none ring-1 ring-border focus:ring-primary"
            />
          </label>
          <label className="text-xs text-muted">
            Fin
            <input
              type="datetime-local"
              defaultValue={toLocalInput(session.ended_at)}
              onBlur={(e) =>
                m.updateSession.mutate({
                  ended_at: e.target.value
                    ? new Date(e.target.value).toISOString()
                    : null,
                })
              }
              className="mt-1 h-9 w-full rounded bg-surface-2 px-2 text-sm text-fg outline-none ring-1 ring-border focus:ring-primary"
            />
          </label>
        </div>
      </div>

      <div className="flex flex-col gap-3">
        {exercises.map((we) => (
          <SessionExerciseCard
            key={we.id}
            we={we}
            exercise={exMap.get(we.exercise_id)}
            originalExercise={
              we.replaced_from_exercise_id
                ? exMap.get(we.replaced_from_exercise_id)
                : undefined
            }
            onUpdateSet={(id, patch) => m.updateSet.mutate({ id, patch })}
            onAddSet={() =>
              m.addSet.mutate({
                workoutExerciseId: we.id,
                setNumber: we.sets.length + 1,
                reps: we.sets.at(-1)?.reps ?? null,
                weight: we.sets.at(-1)?.weight ?? null,
              })
            }
            onDeleteSet={(id) => m.deleteSet.mutate(id)}
            onRemove={() => m.removeExercise.mutate(we.id)}
            onReplace={(newEx, saveForFuture) =>
              m.replaceExercise.mutate({
                workoutExerciseId: we.id,
                originalExerciseId: we.replaced_from_exercise_id ?? we.exercise_id,
                newExerciseId: newEx.id,
                routineExerciseId: we.routine_exercise_id,
                saveForFuture,
              })
            }
          />
        ))}
      </div>

      <Button
        variant="secondary"
        className="w-full mt-3"
        onClick={() => setPicker(true)}
      >
        <Plus className="size-4" /> Agregar ejercicio
      </Button>

      <div className="fixed bottom-20 inset-x-0 px-4">
        <div className="mx-auto max-w-2xl">
          <Button
            size="lg"
            variant={ended ? "secondary" : "success"}
            className="w-full shadow-lg"
            onClick={ended ? () => router.push("/registro") : finish}
            loading={m.updateSession.isPending}
          >
            <Flag className="size-5" />
            {ended ? "Ver registro" : "Finalizar entrenamiento"}
          </Button>
        </div>
      </div>

      <StopwatchFab />

      <ExercisePickerModal
        open={picker}
        onClose={() => setPicker(false)}
        onSelect={(ex) =>
          m.addExercise.mutate({
            exerciseId: ex.id,
            position: exercises.length,
          })
        }
      />
    </div>
  );
}
