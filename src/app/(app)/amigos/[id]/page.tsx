"use client";

import { useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { ArrowLeft, ArrowUp, ArrowDown } from "lucide-react";
import { Spinner, Tabs, EmptyState } from "@/components/ui";
import { VolumeChart, type ChartPoint } from "@/components/VolumeChart";
import { createClient } from "@/lib/supabase/client";
import {
  useFriendMetrics,
  useCommonExercises,
  useCurrentUserId,
} from "@/hooks/useFriendProfile";
import { useExerciseMap } from "@/hooks/useExercises";
import { formatVolume, formatWeight, formatDuration } from "@/lib/format";
import { clsx } from "@/lib/clsx";
import type { Period } from "@/lib/period";

function useFriendInfo(friendId: string) {
  return useQuery({
    queryKey: ["profile", friendId],
    queryFn: async () => {
      const supabase = createClient();
      const { data, error } = await supabase
        .from("profiles")
        .select("id, username, display_name")
        .eq("id", friendId)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  });
}

/** Un lado del head-to-head: verde + ▲ si gana, rojo + ▼ si pierde. */
function Side({
  value,
  state,
  align,
}: {
  value: string;
  state: -1 | 0 | 1;
  align: "start" | "end";
}) {
  const Arrow = state === 1 ? ArrowUp : state === -1 ? ArrowDown : null;
  return (
    <div
      className={clsx(
        "flex items-center gap-1 font-semibold tabular-nums text-sm",
        align === "end" ? "justify-end" : "justify-start",
        state === 1 ? "text-success" : state === -1 ? "text-danger" : "text-fg",
      )}
    >
      {align === "start" && Arrow && <Arrow className="size-3.5 shrink-0" />}
      <span className="truncate">{value}</span>
      {align === "end" && Arrow && <Arrow className="size-3.5 shrink-0" />}
    </div>
  );
}

/** Fila de comparación head-to-head (vos a la izquierda, el amigo a la derecha). */
function VsRow({
  label,
  mine,
  theirs,
  format,
}: {
  label: React.ReactNode;
  mine: number;
  theirs: number;
  format: (v: number) => string;
}) {
  const cmp: -1 | 0 | 1 = mine === theirs ? 0 : mine > theirs ? 1 : -1;
  return (
    <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-2 py-2 border-t border-border first:border-t-0">
      <Side value={format(mine)} state={cmp} align="end" />
      <span className="text-[11px] uppercase tracking-wide text-muted text-center px-1 truncate">
        {label}
      </span>
      <Side value={format(theirs)} state={(-cmp) as -1 | 0 | 1} align="start" />
    </div>
  );
}

export default function FriendProfilePage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const [period, setPeriod] = useState<Period>("month");

  const { data: friend } = useFriendInfo(id);
  const { data: meId } = useCurrentUserId();
  const { data: mine } = useFriendMetrics(meId ?? undefined, period);
  const { data: theirs, isLoading } = useFriendMetrics(id, period);
  const { data: common } = useCommonExercises(id);
  const exMap = useExerciseMap();

  const chart: ChartPoint[] =
    theirs?.weekly_volume.map((w) => ({
      label: new Date(w.week).toLocaleDateString("es-AR", {
        day: "2-digit",
        month: "2-digit",
      }),
      value: Math.round(w.volume),
    })) ?? [];

  return (
    <div>
      <div className="flex items-center gap-2 mb-4">
        <button
          onClick={() => router.push("/scoreboard")}
          className="text-muted hover:text-fg"
        >
          <ArrowLeft className="size-5" />
        </button>
        <h1 className="text-xl font-bold truncate">
          {friend?.display_name ?? friend?.username ?? "…"}
        </h1>
      </div>

      <Tabs
        value={period}
        onChange={setPeriod}
        options={[
          { value: "week", label: "Semana" },
          { value: "month", label: "Mes" },
          { value: "all", label: "Todo" },
        ]}
      />

      {isLoading || !mine || !theirs ? (
        <div className="grid place-items-center py-16">
          <Spinner />
        </div>
      ) : (
        <div className="flex flex-col gap-5 mt-4">
          <div className="card p-4">
            <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-2 mb-2">
              <span className="text-right font-semibold text-primary truncate">
                Vos
              </span>
              <span className="text-xs text-muted">vs</span>
              <span className="font-semibold truncate">
                {friend?.display_name ?? friend?.username}
              </span>
            </div>
            <VsRow
              label="Volumen"
              mine={mine.total_volume}
              theirs={theirs.total_volume}
              format={formatVolume}
            />
            <VsRow
              label="Entrenos"
              mine={mine.session_count}
              theirs={theirs.session_count}
              format={(v) => String(v)}
            />
            <VsRow
              label="Frecuencia"
              mine={mine.frequency_days}
              theirs={theirs.frequency_days}
              format={(v) => `${v} d`}
            />
            <VsRow
              label="Series"
              mine={mine.hard_sets}
              theirs={theirs.hard_sets}
              format={(v) => `${v} sets`}
            />
            <VsRow
              label="Reps"
              mine={mine.total_reps}
              theirs={theirs.total_reps}
              format={(v) => String(v)}
            />
            <VsRow
              label="Duración"
              mine={mine.avg_duration}
              theirs={theirs.avg_duration}
              format={formatDuration}
            />
            <VsRow
              label="Ejercicios"
              mine={mine.distinct_exercises}
              theirs={theirs.distinct_exercises}
              format={(v) => String(v)}
            />
          </div>

          {chart.length > 0 && (
            <div className="card p-4">
              <p className="text-sm font-medium mb-2">
                Volumen semanal de {friend?.display_name ?? friend?.username}
              </p>
              <VolumeChart data={chart} />
            </div>
          )}

          <div className="card p-4">
            <p className="text-sm font-medium mb-1">Ejercicios en común</p>
            <p className="text-xs text-muted mb-2">Mejor 1RM estimado</p>
            {!common?.length ? (
              <p className="text-sm text-muted">
                Todavía no entrenaron el mismo ejercicio.
              </p>
            ) : (
              <div className="flex flex-col">
                {common.map((c) => (
                  <VsRow
                    key={c.exercise_id}
                    label={exMap.get(c.exercise_id)?.name ?? "—"}
                    mine={c.my_orm}
                    theirs={c.friend_orm}
                    format={(v) => formatWeight(v)}
                  />
                ))}
              </div>
            )}
          </div>

          <div className="card p-4">
            <p className="text-sm font-medium mb-3">
              Récords de {friend?.display_name ?? friend?.username}
            </p>
            {!theirs.top_prs.length ? (
              <EmptyState title="Sin récords en este período" />
            ) : (
              <ul className="flex flex-col gap-2">
                {theirs.top_prs.map((pr) => (
                  <li
                    key={pr.exercise_id}
                    className="flex items-center justify-between text-sm"
                  >
                    <span className="truncate mr-2">
                      {exMap.get(pr.exercise_id)?.name ?? "—"}
                    </span>
                    <span className="text-accent font-medium shrink-0">
                      {pr.orm} kg
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
