// SPDX-License-Identifier: AGPL-3.0-only
"use client";

import { Suspense, useState } from "react";
import Link from "next/link";
import {
  useParams,
  usePathname,
  useRouter,
  useSearchParams,
} from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { ArrowUp, ArrowDown } from "lucide-react";
import {
  PageHeader,
  Tabs,
  Button,
  ConfirmDialog,
  ErrorState,
  Skeleton,
  buttonClasses,
} from "@/components/ui";
import { VolumeChart, type ChartPoint } from "@/components/VolumeChart";
import { createClient } from "@/lib/supabase/client";
import {
  useFriendMetrics,
  useCommonExercises,
  useCurrentUserId,
} from "@/hooks/useFriendProfile";
import { useRemoveFriend } from "@/hooks/useFriends";
import { useExerciseMap } from "@/hooks/useExercises";
import { fmtNum, formatVolume, formatWeight, formatDuration } from "@/lib/format";
import { toast } from "@/lib/toast";
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

type Cmp = -1 | 0 | 1;

const cmpOf = (mine: number, theirs: number): Cmp =>
  mine === theirs ? 0 : mine > theirs ? 1 : -1;

/** Un lado del head-to-head: verde + ▲ si gana, rojo + ▼ si pierde. */
function Side({
  value,
  state,
  align,
}: {
  value: string;
  state: Cmp;
  align: "start" | "end";
}) {
  const Arrow = state === 1 ? ArrowUp : state === -1 ? ArrowDown : null;
  return (
    <div
      className={clsx(
        "flex items-center gap-1 font-semibold tabular-nums text-sm min-w-0",
        align === "end" ? "justify-end" : "justify-start",
        state === 1 ? "text-success" : state === -1 ? "text-danger" : "text-fg",
      )}
    >
      {align === "start" && Arrow && <Arrow className="size-3.5 shrink-0" aria-hidden />}
      <span className="truncate">{value}</span>
      {align === "end" && Arrow && <Arrow className="size-3.5 shrink-0" aria-hidden />}
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
  label: string;
  mine: number;
  theirs: number;
  format: (v: number) => string;
}) {
  const cmp = cmpOf(mine, theirs);
  return (
    // La columna central tiene tope: con `auto` una etiqueta larga le sacaba
    // el lugar a los valores.
    <div className="grid grid-cols-[1fr_minmax(0,6.5rem)_1fr] items-center gap-2 py-2 border-t border-border first:border-t-0">
      <Side value={format(mine)} state={cmp} align="end" />
      <span className="text-xs text-muted text-center">{label}</span>
      <Side value={format(theirs)} state={-cmp as Cmp} align="start" />
    </div>
  );
}

/** Ejercicio en común: el nombre en su propia línea y debajo "Vos 80 kg | 75 kg Meli". */
function ExerciseVsRow({
  name,
  friendName,
  mine,
  theirs,
}: {
  name: string;
  friendName: string;
  mine: number;
  theirs: number;
}) {
  const cmp = cmpOf(mine, theirs);
  return (
    <div className="py-2 border-t border-border first:border-t-0">
      <p className="text-sm font-medium">{name}</p>
      <div className="flex items-center justify-between gap-3 mt-0.5 text-sm">
        <span className="flex items-center gap-1.5 min-w-0">
          <span className="text-muted">Vos</span>
          <Side value={formatWeight(mine)} state={cmp} align="start" />
        </span>
        <span className="flex items-center gap-1.5 min-w-0 justify-end">
          <Side value={formatWeight(theirs)} state={-cmp as Cmp} align="end" />
          <span className="text-muted truncate max-w-[6rem]">{friendName}</span>
        </span>
      </div>
    </div>
  );
}

function days(v: number): string {
  return `${fmtNum(v, 0)} ${v === 1 ? "día" : "días"}`;
}

export default function FriendProfilePage() {
  // useSearchParams (período heredado del ranking) pide un Suspense.
  return (
    <Suspense fallback={<VsSkeleton />}>
      <FriendProfile />
    </Suspense>
  );
}

function VsSkeleton() {
  return (
    <div className="card p-4 flex flex-col gap-2 mt-4" aria-busy>
      {Array.from({ length: 7 }, (_, i) => (
        <Skeleton key={i} className="h-9" />
      ))}
    </div>
  );
}

function FriendProfile() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const periodParam = searchParams.get("period");
  // El ranking arranca en "Semana": se hereda para que los números coincidan.
  const period: Period =
    periodParam === "month" || periodParam === "all" ? periodParam : "week";

  function changePeriod(p: Period) {
    const next = new URLSearchParams(searchParams.toString());
    next.set("period", p);
    router.replace(`${pathname}?${next.toString()}`, { scroll: false });
  }

  const [confirmOpen, setConfirmOpen] = useState(false);
  const [removeError, setRemoveError] = useState<string | null>(null);
  const removeFriend = useRemoveFriend();

  const friendQ = useFriendInfo(id);
  const friend = friendQ.data;
  const meIdQ = useCurrentUserId();
  const meId = meIdQ.data;
  const mineQ = useFriendMetrics(meId ?? undefined, period);
  const theirsQ = useFriendMetrics(id, period);
  const commonQ = useCommonExercises(id);
  const exMap = useExerciseMap();

  const mine = mineQ.data;
  const theirs = theirsQ.data;
  const name = friend?.display_name ?? friend?.username ?? "";

  const chart: ChartPoint[] =
    theirs?.weekly_volume.map((w) => ({
      label: new Date(w.week).toLocaleDateString("es-AR", {
        day: "2-digit",
        month: "2-digit",
      }),
      value: Math.round(w.volume),
    })) ?? [];

  async function remove() {
    setRemoveError(null);
    try {
      await removeFriend.mutateAsync(id);
      toast(`Eliminaste a ${name} de tus amigos`);
      router.push("/scoreboard");
    } catch {
      setRemoveError("No se pudo eliminar. Probá de nuevo.");
    }
  }

  const header = (
    <PageHeader
      title={name || "Perfil"}
      back={() =>
        window.history.length > 1 ? router.back() : router.push("/scoreboard")
      }
    />
  );

  // Perfil inexistente o ya sin acceso (dejaron de ser amigos, link viejo).
  if (friendQ.data === null) {
    return (
      <div>
        {header}
        <div className="card flex flex-col items-center text-center gap-3 py-12 px-6">
          <div>
            <p className="font-semibold">Este perfil no está disponible</p>
            <p className="text-sm text-muted mt-1">
              Puede que ya no sean amigos.
            </p>
          </div>
          <Link href="/scoreboard" className={buttonClasses({ variant: "secondary" })}>
            Volver al ranking
          </Link>
        </div>
      </div>
    );
  }

  const hasError =
    friendQ.isError ||
    meIdQ.isError ||
    meId === null ||
    mineQ.isError ||
    theirsQ.isError;
  const loading = !hasError && (!friend || !mine || !theirs);

  function retry() {
    void friendQ.refetch();
    void meIdQ.refetch();
    void mineQ.refetch();
    void theirsQ.refetch();
  }

  return (
    <div>
      {header}

      <Tabs
        ariaLabel="Período"
        value={period}
        onChange={changePeriod}
        options={[
          { value: "week", label: "Semana" },
          { value: "month", label: "Mes" },
          { value: "all", label: "Todo" },
        ]}
      />

      {hasError ? (
        <div className="mt-4 flex flex-col gap-3">
          <ErrorState
            title="No se pudo cargar el perfil"
            onRetry={retry}
            retrying={mineQ.isFetching || theirsQ.isFetching}
          />
          <Link
            href="/scoreboard"
            className={buttonClasses({ variant: "ghost", className: "w-full" })}
          >
            Volver al ranking
          </Link>
        </div>
      ) : loading || !mine || !theirs ? (
        <VsSkeleton />
      ) : (
        <div className="flex flex-col gap-5 mt-4">
          <div className="card p-4">
            <div className="grid grid-cols-[1fr_minmax(0,6.5rem)_1fr] items-center gap-2 mb-2">
              <span className="text-right font-semibold text-primary truncate">
                Vos
              </span>
              <span className="text-xs text-muted text-center">vs</span>
              <span className="font-semibold truncate">{name}</span>
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
              format={(v) => fmtNum(v, 0)}
            />
            <VsRow
              label="Frecuencia"
              mine={mine.frequency_days}
              theirs={theirs.frequency_days}
              format={days}
            />
            <VsRow
              label="Series"
              mine={mine.hard_sets}
              theirs={theirs.hard_sets}
              format={(v) => `${fmtNum(v, 0)} ${v === 1 ? "serie" : "series"}`}
            />
            <VsRow
              label="Reps"
              mine={mine.total_reps}
              theirs={theirs.total_reps}
              format={(v) => fmtNum(v, 0)}
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
              format={(v) => fmtNum(v, 0)}
            />
          </div>

          {chart.length > 0 && (
            <div className="card p-4">
              <p className="text-sm font-medium mb-2">Volumen semanal de {name}</p>
              <VolumeChart data={chart} />
            </div>
          )}

          <div className="card p-4">
            <p className="text-sm font-medium mb-1">Ejercicios en común</p>
            <p className="text-xs text-muted mb-2">Mejor 1RM estimado</p>
            {commonQ.isError && !commonQ.data ? (
              <div className="flex items-center justify-between gap-3">
                <p role="alert" className="text-sm text-danger">
                  No se pudieron cargar los ejercicios en común.
                </p>
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() => void commonQ.refetch()}
                  loading={commonQ.isFetching}
                >
                  Reintentar
                </Button>
              </div>
            ) : !commonQ.data ? (
              <Skeleton className="h-9" />
            ) : commonQ.data.length === 0 ? (
              <p className="text-sm text-muted">
                Todavía no entrenaron el mismo ejercicio.
              </p>
            ) : (
              <div className="flex flex-col">
                {commonQ.data.map((c) => (
                  <ExerciseVsRow
                    key={c.exercise_id}
                    name={exMap.get(c.exercise_id)?.name ?? "—"}
                    friendName={name}
                    mine={c.my_orm}
                    theirs={c.friend_orm}
                  />
                ))}
              </div>
            )}
          </div>

          <div className="card p-4">
            <p className="text-sm font-medium mb-3">Récords de {name}</p>
            {!theirs.top_prs.length ? (
              <p className="text-sm text-muted">Sin récords en este período.</p>
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
                      {formatWeight(pr.orm)}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      )}

      {friend && (
        <div className="mt-8">
          <Button
            variant="danger"
            className="w-full"
            onClick={() => {
              setRemoveError(null);
              setConfirmOpen(true);
            }}
          >
            Eliminar de amigos
          </Button>
        </div>
      )}

      <ConfirmDialog
        open={confirmOpen}
        title={`¿Eliminar a ${name}?`}
        description="Van a dejar de verse en el ranking."
        confirmLabel="Eliminar"
        loading={removeFriend.isPending}
        error={removeError}
        onConfirm={remove}
        onCancel={() => setConfirmOpen(false)}
      />
    </div>
  );
}
