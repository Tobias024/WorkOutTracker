"use client";

import { useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { ArrowLeft } from "lucide-react";
import { Spinner, Tabs, EmptyState } from "@/components/ui";
import { VolumeChart, type ChartPoint } from "@/components/VolumeChart";
import { createClient } from "@/lib/supabase/client";
import {
  useFriendMetrics,
  useCommonExercises,
  useCurrentUserId,
} from "@/hooks/useFriendProfile";
import { useExerciseMap } from "@/hooks/useExercises";
import { formatVolume, formatWeight } from "@/lib/format";
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

function CompareRow({
  label,
  mine,
  theirs,
  format,
}: {
  label: string;
  mine: number;
  theirs: number;
  format: (v: number) => string;
}) {
  const color =
    mine === theirs
      ? "text-fg"
      : mine > theirs
        ? "text-success"
        : "text-danger";
  return (
    <div className="flex items-center justify-between text-sm py-1.5">
      <span className="text-muted">{label}</span>
      <span className={clsx("font-semibold tabular-nums", color)}>
        {format(mine)}
      </span>
      <span className="font-semibold tabular-nums text-muted">
        {format(theirs)}
      </span>
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
          onClick={() => router.push("/amigos")}
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
            <div className="flex items-center justify-between text-xs text-muted mb-1 px-0">
              <span />
              <span>Vos</span>
              <span>{friend?.display_name ?? friend?.username}</span>
            </div>
            <CompareRow
              label="Volumen"
              mine={mine.total_volume}
              theirs={theirs.total_volume}
              format={formatVolume}
            />
            <CompareRow
              label="Entrenos"
              mine={mine.session_count}
              theirs={theirs.session_count}
              format={(v) => String(v)}
            />
            <CompareRow
              label="Frecuencia"
              mine={mine.frequency_days}
              theirs={theirs.frequency_days}
              format={(v) => `${v} días`}
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
            <p className="text-sm font-medium mb-3">Ejercicios en común</p>
            {!common?.length ? (
              <p className="text-sm text-muted">
                Todavía no entrenaron el mismo ejercicio.
              </p>
            ) : (
              <ul className="flex flex-col gap-2">
                {common.map((c) => (
                  <li key={c.exercise_id}>
                    <div className="flex items-center justify-between text-sm mb-0.5">
                      <span className="truncate mr-2">
                        {exMap.get(c.exercise_id)?.name ?? "—"}
                      </span>
                    </div>
                    <CompareRow
                      label=""
                      mine={c.my_orm}
                      theirs={c.friend_orm}
                      format={(v) => `${formatWeight(v)} (1RM)`}
                    />
                  </li>
                ))}
              </ul>
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
