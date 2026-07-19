"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, Plus, Flag, Clock } from "lucide-react";
import { Button, Input, Spinner } from "@/components/ui";
import { ExercisePickerModal } from "@/components/ExercisePickerModal";
import { SessionExerciseCard } from "@/components/SessionExerciseCard";
import { StopwatchFab } from "@/components/Stopwatch";
import { PrCelebrationModal } from "@/components/PrCelebrationModal";
import {
  useWorkoutSession,
  useLastBodyWeight,
  useLastExerciseLogs,
} from "@/hooks/useWorkout";
import { useSessionMutations } from "@/hooks/useWorkoutMutations";
import { useExerciseMap } from "@/hooks/useExercises";
import { createClient } from "@/lib/supabase/client";
import { formatClock } from "@/lib/format";
import type { SessionPr } from "@/lib/types";

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
  const { data: lastBw } = useLastBodyWeight();
  const { data: lastLogs } = useLastExerciseLogs(
    (data?.exercises ?? []).map((e) => e.exercise_id),
    sessionId,
  );
  const exMap = useExerciseMap();
  const m = useSessionMutations(sessionId);
  const qc = useQueryClient();
  const [picker, setPicker] = useState(false);
  const [now, setNow] = useState(0);
  const [prModal, setPrModal] = useState<SessionPr | null>(null);

  const ended = !!data?.session.ended_at;

  useEffect(() => {
    const tick = () => setNow(Date.now());
    tick();
    if (ended) return;
    const t = setInterval(tick, 1000);
    return () => clearInterval(t);
  }, [ended]);

  // En un entrenamiento activo (cargado y sin finalizar) ocultamos la TabBar
  // inferior para aprovechar la pantalla. Al finalizar o salir, reaparece.
  useEffect(() => {
    if (!data || ended) return;
    document.body.dataset.hideTabbar = "1";
    return () => {
      delete document.body.dataset.hideTabbar;
    };
  }, [data, ended]);

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

  // Editar inicio/fin a mano: además de guardar la fecha, recalcula la duración
  // si quedan ambos extremos (si no, finish() nunca corrió y la duración vieja
  // quedaría desactualizada en Registro).
  function editTime(field: "started_at" | "ended_at", value: string) {
    const iso = value ? new Date(value).toISOString() : null;
    const started = field === "started_at" ? iso : session.started_at;
    const endedAt = field === "ended_at" ? iso : session.ended_at;
    const duration =
      started && endedAt
        ? Math.max(
            0,
            Math.floor(
              (new Date(endedAt).getTime() - new Date(started).getTime()) / 1000,
            ),
          )
        : session.duration_seconds;
    m.updateSession.mutate({ [field]: iso, duration_seconds: duration });
  }

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
    // Recién ahora cambió el volumen: avisamos si superaste a algún amigo en el
    // ranking. Fire-and-forget: no bloquea la navegación ni importa si falla.
    fetch("/api/rank/notify", { method: "POST" }).catch(() => {});

    // Logros: registra PRs/hitos de la sesión. Si hubo PR de e1RM, muestra el
    // modal de celebración antes de volver (la navegación ocurre al cerrarlo).
    try {
      const supabase = createClient();
      const { data: prs } = await supabase.rpc("record_session_achievements", {
        p_session_id: sessionId,
      });
      qc.invalidateQueries({ queryKey: ["achievements"] });
      const best = (prs ?? [])
        .slice()
        .sort((a, b) => b.orm - a.orm)[0];
      if (best) {
        setPrModal(best);
        return;
      }
    } catch {
      // no bloquear el cierre de la sesión por un fallo de logros
    }
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
              onBlur={(e) => editTime("started_at", e.target.value)}
              className="mt-1 h-9 w-full rounded bg-surface-2 px-2 text-sm text-fg outline-none ring-1 ring-border focus:ring-primary"
            />
          </label>
          <label className="text-xs text-muted">
            Fin
            <input
              type="datetime-local"
              defaultValue={toLocalInput(session.ended_at)}
              onBlur={(e) => editTime("ended_at", e.target.value)}
              className="mt-1 h-9 w-full rounded bg-surface-2 px-2 text-sm text-fg outline-none ring-1 ring-border focus:ring-primary"
            />
          </label>
        </div>
        <label className="text-xs text-muted block mt-2">
          Peso corporal (kg)
          <input
            type="number"
            inputMode="decimal"
            step={0.1}
            key={session.body_weight_kg ?? lastBw ?? "bw"}
            defaultValue={session.body_weight_kg ?? lastBw ?? ""}
            placeholder="opcional"
            onBlur={(e) => {
              const v = e.target.value === "" ? null : Number(e.target.value);
              if (v !== session.body_weight_kg)
                m.updateSession.mutate({ body_weight_kg: v });
            }}
            className="mt-1 h-9 w-full rounded bg-surface-2 px-2 text-sm text-fg outline-none ring-1 ring-border focus:ring-primary"
          />
        </label>
      </div>

      <div className="flex flex-col gap-3">
        {exercises.map((we) => (
          <SessionExerciseCard
            key={we.id}
            we={we}
            exercise={exMap.get(we.exercise_id)}
            lastLog={lastLogs?.get(we.exercise_id)}
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

      <div className={`fixed inset-x-0 px-4 ${ended ? "bottom-20" : "bottom-4"}`}>
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

      <PrCelebrationModal
        pr={prModal}
        exerciseName={
          prModal ? exMap.get(prModal.exercise_id)?.name ?? "Ejercicio" : ""
        }
        bodyWeightKg={session.body_weight_kg}
        onClose={() => {
          setPrModal(null);
          router.push("/registro");
        }}
      />
    </div>
  );
}
