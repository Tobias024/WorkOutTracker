"use client";

import { useMemo } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { LineChart, ChevronRight, Dumbbell, Zap } from "lucide-react";
import { PageHeader, Spinner, EmptyState, Stat, Button } from "@/components/ui";
import { VolumeChart, type ChartPoint } from "@/components/VolumeChart";
import { useHistory, type HistorySession } from "@/hooks/useHistory";
import { useExerciseMap } from "@/hooks/useExercises";
import { useStartEmptyWorkout } from "@/hooks/useWorkout";
import { totalVolume, estimate1RM, weekStart } from "@/lib/metrics";
import { formatDate, formatDuration, formatVolume } from "@/lib/format";
import { muscleEs } from "@/lib/i18n-exercise";

function sessionVolume(s: HistorySession): number {
  return s.workout_exercises.reduce(
    (acc, we) => acc + totalVolume(we.workout_sets.filter((x) => x.completed)),
    0,
  );
}
function sessionSets(s: HistorySession): number {
  return s.workout_exercises.reduce(
    (acc, we) => acc + we.workout_sets.filter((x) => x.completed).length,
    0,
  );
}

export default function RegistroPage() {
  const { data, isLoading } = useHistory();
  const exMap = useExerciseMap();
  const router = useRouter();
  const startEmpty = useStartEmptyWorkout();

  const metrics = useMemo(() => {
    const sessions = data ?? [];
    const totalVol = sessions.reduce((a, s) => a + sessionVolume(s), 0);

    // Volumen por semana (últimas 8).
    const weekMap = new Map<number, number>();
    for (const s of sessions) {
      const wk = weekStart(new Date(s.created_at)).getTime();
      weekMap.set(wk, (weekMap.get(wk) ?? 0) + sessionVolume(s));
    }
    const now = new Date();
    const chart: ChartPoint[] = [];
    for (let i = 7; i >= 0; i--) {
      const wk = weekStart(new Date(now.getTime() - i * 7 * 86400000));
      chart.push({
        label: wk.toLocaleDateString("es-AR", { day: "2-digit", month: "2-digit" }),
        value: Math.round(weekMap.get(wk.getTime()) ?? 0),
      });
    }

    // Frecuencia esta semana.
    const thisWeek = weekStart(now).getTime();
    const freq = sessions.filter(
      (s) => weekStart(new Date(s.created_at)).getTime() === thisWeek,
    ).length;

    // Volumen por músculo (atribuido al primer músculo principal).
    const muscleVol = new Map<string, number>();
    for (const s of sessions) {
      for (const we of s.workout_exercises) {
        const ex = exMap.get(we.exercise_id);
        const m = ex?.primary_muscles[0];
        if (!m) continue;
        const v = totalVolume(we.workout_sets.filter((x) => x.completed));
        muscleVol.set(m, (muscleVol.get(m) ?? 0) + v);
      }
    }
    const byMuscle = [...muscleVol.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 6);
    const maxMuscle = byMuscle[0]?.[1] ?? 1;

    // Récords por ejercicio (mejor 1RM estimado).
    const prMap = new Map<string, { weight: number; orm: number }>();
    for (const s of sessions) {
      for (const we of s.workout_exercises) {
        for (const set of we.workout_sets) {
          if (!set.completed || !set.weight || !set.reps) continue;
          const orm = estimate1RM(set.weight, set.reps);
          const cur = prMap.get(we.exercise_id);
          if (!cur || orm > cur.orm) {
            prMap.set(we.exercise_id, { weight: set.weight, orm });
          }
        }
      }
    }
    const prs = [...prMap.entries()]
      .sort((a, b) => b[1].orm - a[1].orm)
      .slice(0, 6);

    return { totalVol, chart, freq, byMuscle, maxMuscle, prs, count: sessions.length };
  }, [data, exMap]);

  if (isLoading) {
    return (
      <div className="grid place-items-center py-16">
        <Spinner />
      </div>
    );
  }

  return (
    <div>
      <PageHeader
        title="Registro"
        subtitle="Tu progreso y métricas"
        action={
          <Button
            size="sm"
            variant="secondary"
            loading={startEmpty.isPending}
            onClick={async () => {
              const id = await startEmpty.mutateAsync();
              router.push(`/entrenar/${id}`);
            }}
          >
            <Zap className="size-4" /> Libre
          </Button>
        }
      />

      {!data?.length ? (
        <EmptyState
          icon={<LineChart className="size-8" />}
          title="Sin entrenamientos todavía"
          description="Cuando completes una rutina vas a ver tus métricas acá."
        />
      ) : (
        <div className="flex flex-col gap-5">
          <div className="grid grid-cols-3 gap-2.5">
            <Stat label="Entrenos" value={metrics.count} />
            <Stat label="Volumen total" value={formatVolume(metrics.totalVol)} />
            <Stat label="Esta semana" value={metrics.freq} />
          </div>

          <div className="card p-4">
            <p className="text-sm font-medium mb-2">Volumen semanal</p>
            <VolumeChart data={metrics.chart} />
          </div>

          {metrics.byMuscle.length > 0 && (
            <div className="card p-4">
              <p className="text-sm font-medium mb-3">Volumen por músculo</p>
              <div className="flex flex-col gap-2.5">
                {metrics.byMuscle.map(([m, v]) => (
                  <div key={m}>
                    <div className="flex justify-between text-xs mb-1">
                      <span>{muscleEs(m)}</span>
                      <span className="text-muted">{formatVolume(v)}</span>
                    </div>
                    <div className="h-2 rounded-full bg-surface-2 overflow-hidden">
                      <div
                        className="h-full bg-primary rounded-full"
                        style={{ width: `${(v / metrics.maxMuscle) * 100}%` }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {metrics.prs.length > 0 && (
            <div className="card p-4">
              <p className="text-sm font-medium mb-3">Récords (1RM estimado)</p>
              <ul className="flex flex-col gap-2">
                {metrics.prs.map(([exId, pr]) => (
                  <li
                    key={exId}
                    className="flex items-center justify-between text-sm"
                  >
                    <span className="truncate mr-2">
                      {exMap.get(exId)?.name ?? "—"}
                    </span>
                    <span className="text-accent font-medium shrink-0">
                      {pr.orm} kg
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          <div>
            <p className="text-sm font-medium mb-2">Historial</p>
            <ul className="flex flex-col gap-2">
              {data.map((s) => (
                <li key={s.id}>
                  <Link
                    href={`/entrenar/${s.id}`}
                    className="card flex items-center gap-3 p-3.5 hover:ring-1 hover:ring-primary transition"
                  >
                    <div className="size-10 rounded-md bg-surface-2 grid place-items-center">
                      <Dumbbell className="size-5 text-muted" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="font-medium truncate">{s.name}</p>
                      <p className="text-xs text-muted">
                        {formatDate(s.created_at)} · {sessionSets(s)} series ·{" "}
                        {formatVolume(sessionVolume(s))}
                        {s.duration_seconds
                          ? ` · ${formatDuration(s.duration_seconds)}`
                          : ""}
                      </p>
                    </div>
                    <ChevronRight className="size-5 text-muted" />
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        </div>
      )}
    </div>
  );
}
