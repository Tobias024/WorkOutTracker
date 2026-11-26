// SPDX-License-Identifier: AGPL-3.0-only
"use client";

import { useEffect, useMemo, useState, useSyncExternalStore } from "react";
import { useParams, useRouter } from "next/navigation";
import {
  onlineManager,
  useIsMutating,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";
import {
  ArrowLeft,
  Plus,
  Clock,
  MoreVertical,
  Pencil,
  Trash2,
  WifiOff,
} from "lucide-react";
import {
  Button,
  EmptyState,
  ErrorState,
  IconButton,
  Modal,
  Skeleton,
} from "@/components/ui";
import { ExercisePickerModal } from "@/components/ExercisePickerModal";
import { SessionExerciseCard } from "@/components/SessionExerciseCard";
import { PrCelebrationModal } from "@/components/PrCelebrationModal";
import { RestBanner } from "@/components/RestBanner";
import { ElapsedClock, useElapsedSeconds } from "@/components/ElapsedClock";
import { FinishWorkoutSheet } from "@/components/FinishWorkoutSheet";
import {
  useWorkoutSession,
  useLastExerciseLogs,
  useDeleteSession,
  rememberActiveSession,
  type FullSession,
} from "@/hooks/useWorkout";
import { useSessionMutations } from "@/hooks/useWorkoutMutations";
import { useExerciseMap } from "@/hooks/useExercises";
import { useBodyWeight } from "@/hooks/useBodyData";
import { useTrainingProfile } from "@/hooks/useGoal";
import { createClient } from "@/lib/supabase/client";
import { formatVolume, formatDuration } from "@/lib/format";
import {
  useRestStore,
  useRestHydrated,
  restTargetSeconds,
  REST_MAX_SECONDS,
} from "@/hooks/useRestTimer";
import {
  totalVolume,
  isCountableSet,
  isHardSet,
  sanitizeDrops,
} from "@/lib/metrics";
import { flushUndoables, undoable } from "@/lib/toast";
import { newId } from "@/lib/uuid";
import type { SessionPr } from "@/lib/types";

/** Sesión abierta hace más que esto al entrar = probablemente olvidada. */
const STALE_SESSION_MS = 4 * 3600 * 1000;

function toLocalInput(iso: string | null): string {
  if (!iso) return "";
  const d = new Date(iso);
  const off = d.getTimezoneOffset();
  return new Date(d.getTime() - off * 60000).toISOString().slice(0, 16);
}

/** Error de "no existe" de PostgREST (.single() sin filas). */
function isNotFound(err: unknown): boolean {
  if (!err || typeof err !== "object") return false;
  const e = err as { code?: string; message?: string };
  return e.code === "PGRST116" || /0 rows/i.test(e.message ?? "");
}

function SessionSkeleton() {
  return (
    <div aria-busy="true" aria-label="Cargando entreno" className="flex flex-col gap-3">
      <Skeleton className="h-12 w-full" />
      <Skeleton className="h-24 w-full" />
      <Skeleton className="h-24 w-full" />
      <Skeleton className="h-24 w-full" />
    </div>
  );
}

export default function WorkoutPage() {
  const { sessionId } = useParams<{ sessionId: string }>();
  const router = useRouter();
  const qc = useQueryClient();
  const query = useWorkoutSession(sessionId);

  // Nunca usar `!data` como "cargando": un error dejaba el spinner infinito y,
  // con el id en localStorage, el candado rebotaba al usuario acá sin salida.
  if (!query.data) {
    if (query.isError) {
      if (isNotFound(query.error)) {
        return (
          <EmptyState
            title="Este entreno ya no existe"
            description="Puede que lo hayas descartado desde otro dispositivo."
            action={
              <Button
                onClick={() => {
                  rememberActiveSession(null);
                  qc.setQueryData(["active-session"], null);
                  router.replace("/rutinas");
                }}
              >
                Ir a mis rutinas
              </Button>
            }
          />
        );
      }
      return (
        <ErrorState
          title="No pudimos cargar el entreno"
          onRetry={() => query.refetch()}
          retrying={query.isFetching}
        />
      );
    }
    return <SessionSkeleton />;
  }
  return <SessionView sessionId={sessionId} data={query.data} />;
}

function SessionView({
  sessionId,
  data,
}: {
  sessionId: string;
  data: FullSession;
}) {
  const router = useRouter();
  const qc = useQueryClient();
  // Último peso registrado (de "Registro") para la fuerza relativa del PR. La
  // rutina ya no pide peso: se registra solo en Registro.
  const { data: bwLogs } = useBodyWeight();
  const lastLoggedWeight = bwLogs?.length
    ? Number(bwLogs[bwLogs.length - 1].weight_kg)
    : null;
  const { data: lastLogs } = useLastExerciseLogs(
    data.exercises.map((e) => e.exercise_id),
    sessionId,
  );
  const exMap = useExerciseMap();
  const { data: prefs } = useTrainingProfile();
  const profile = prefs?.trainingProfile ?? null;
  const m = useSessionMutations(sessionId);
  const deleteSession = useDeleteSession();

  const { session } = data;
  const ended = !!session.ended_at;

  // Ejercicios quitados con "Deshacer" pendiente: se esconden del render y de
  // los conteos hasta que vence el toast y se ejecuta el borrado real.
  const [hiddenExercises, setHiddenExercises] = useState<Set<string>>(
    () => new Set(),
  );
  const exercises = useMemo(
    () => data.exercises.filter((e) => !hiddenExercises.has(e.id)),
    [data.exercises, hiddenExercises],
  );

  // Tonelaje de la sesión anterior de la misma rutina: solo se muestra en la
  // vista de sesión terminada, así que se pide recién ahí (RPC liviana).
  const routineId = session.routine_id;
  const { data: prevTonnage = null } = useQuery({
    queryKey: ["history", "prev-routine-sets", routineId, sessionId],
    enabled: ended && !!routineId,
    queryFn: async (): Promise<number | null> => {
      const { data, error } = await createClient().rpc(
        "previous_routine_session_sets",
        { p_routine_id: routineId as string, p_exclude: sessionId },
      );
      if (error) throw error;
      if (!data || data.length === 0) return null;
      return totalVolume(data.filter(isCountableSet));
    },
  });

  // Resumen de la sesión (para la vista de una sesión finalizada del historial):
  // tonelaje como carga externa + series efectivas + Δ vs la misma rutina.
  const summary = useMemo(() => {
    const sets = exercises.flatMap((e) => e.sets);
    const tonnage = totalVolume(sets.filter(isCountableSet));
    const hardSets = sets.filter((s) => isHardSet(s, profile)).length;
    return { tonnage, hardSets, prevTonnage };
  }, [exercises, prevTonnage, profile]);

  // Progreso: solo series de trabajo (los calentamientos no cuentan).
  const progress = useMemo(() => {
    const work = exercises.flatMap((e) => e.sets).filter((s) => !s.is_warmup);
    return { done: work.filter((s) => s.completed).length, total: work.length };
  }, [exercises]);

  const [picker, setPicker] = useState(false);
  const [prs, setPrs] = useState<SessionPr[]>([]);
  // #2 reordenar: id del ejercicio seleccionado para mover (null = sin mover).
  const [movingId, setMovingId] = useState<string | null>(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const [discardOpen, setDiscardOpen] = useState(false);
  const [finishOpen, setFinishOpen] = useState(false);
  const [finishError, setFinishError] = useState<string | null>(null);
  const [finishing, setFinishing] = useState(false);
  // Editar horario de inicio (solo en curso): borrador del datetime-local.
  const [startOpen, setStartOpen] = useState(false);
  const [startDraft, setStartDraft] = useState("");

  // Detección de sesión olvidada: se evalúa UNA vez al abrir (no a las 4 h de
  // un entreno largo y legítimo).
  const [staleAtOpen] = useState(
    () =>
      !ended &&
      !!session.started_at &&
      Date.now() - new Date(session.started_at).getTime() > STALE_SESSION_MS,
  );
  const [staleDismissed, setStaleDismissed] = useState(false);
  const staleOpen = staleAtOpen && !staleDismissed && !ended;

  // Acordeón de ejercicios: el estado vive acá para poder avanzar solo al
  // siguiente. Se calcula una vez al montar (esta vista solo monta con data).
  const [openIds, setOpenIds] = useState<Set<string>>(() => {
    if (ended) return new Set(data.exercises.map((e) => e.id));
    const first = data.exercises.find((e) =>
      e.sets.some((s) => !s.is_warmup && !s.completed),
    );
    return new Set(first ? [first.id] : []);
  });

  // Cronómetro de descanso: vive en un store persistido (ver useRestTimer).
  // Selectores (no el store entero) y sin suscribirse al reloj: el tick vive en
  // las hojas <RestBanner> / <ElapsedClock>. En handlers: useRestStore.getState().
  const restStartedAt = useRestStore((s) => s.startedAt);
  const restSetId = useRestStore((s) => s.setId);
  const restSessionId = useRestStore((s) => s.sessionId);
  const restHydrated = useRestHydrated();
  /** Hay un descanso corriendo y es de ESTA sesión. */
  const restOfThisSession =
    restStartedAt != null && restSetId != null && restSessionId === sessionId;

  // Indicador offline: cambios en pausa esperando red.
  const online = useSyncExternalStore(
    (cb) => onlineManager.subscribe(cb),
    () => onlineManager.isOnline(),
    () => true,
  );
  const pendingMutations = useIsMutating();

  // Descansos que hay que tirar al entrar: los de OTRA sesión (abrir una vieja
  // desde el historial no debe cerrarle la serie a la que está en curso) y los
  // que quedaron colgados más del tope — un "descanso" de ayer no es un
  // descanso, y guardarlo ensuciaría el promedio con un outlier gigante.
  useEffect(() => {
    if (restStartedAt == null) return;
    const stale = Date.now() - restStartedAt > REST_MAX_SECONDS * 1000;
    if (restSessionId !== sessionId || stale) useRestStore.getState().clear();
  }, [restStartedAt, restSessionId, sessionId]);

  // En un entrenamiento activo (cargado y sin finalizar) ocultamos la TabBar
  // inferior para aprovechar la pantalla. Al finalizar o salir, reaparece.
  useEffect(() => {
    if (ended) return;
    document.body.dataset.hideTabbar = "1";
    return () => {
      delete document.body.dataset.hideTabbar;
    };
  }, [ended]);

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

  /**
   * Bajadas vacías que quedaron de un "Agregar bajada" sin usar: se limpian
   * antes de cerrar, así no llegan al historial ni al ghost de la próxima.
   * Un fallo acá no bloquea el cierre (las métricas ya ignoran bajadas vacías).
   */
  async function cleanEmptyDrops() {
    const current = qc.getQueryData<FullSession>(["session", sessionId]);
    const dirty = (current?.exercises ?? [])
      .flatMap((ex) => ex.sets)
      .filter(
        (st) =>
          st.drops != null &&
          JSON.stringify(sanitizeDrops(st.drops)) !== JSON.stringify(st.drops),
      );
    await Promise.all(
      dirty.map((st) =>
        m.updateSet
          .mutateAsync({ id: st.id, patch: { drops: sanitizeDrops(st.drops) } })
          .catch((e) => console.warn("No se pudieron limpiar las bajadas:", e)),
      ),
    );
  }

  /**
   * Cierra la sesión. `endIso` permite fijar un fin distinto de "ahora" (sesión
   * olvidada). Devuelve false si no se pudo cerrar, para que el llamador deje
   * el sheet abierto con el error.
   */
  async function finish(endIso: string = new Date().toISOString()): Promise<boolean> {
    const duration = session.started_at
      ? Math.max(
          0,
          Math.floor(
            (new Date(endIso).getTime() -
              new Date(session.started_at).getTime()) /
              1000,
          ),
        )
      : null;
    setFinishing(true);
    setFinishError(null);
    try {
      // Borrados con "Deshacer" todavía pendientes se aplican antes de cerrar.
      await flushUndoables();
      await cleanEmptyDrops();
      await m.updateSession.mutateAsync({
        ended_at: endIso,
        duration_seconds: duration,
      });
    } catch {
      setFinishError(
        "No pudimos cerrar el entreno. Revisá la conexión y probá de nuevo.",
      );
      setFinishing(false);
      return false;
    }
    // Ya no es una sesión activa: soltamos el candado (ActiveSessionGuard) sin
    // esperar un refetch, para no rebotar al navegar a /registro.
    qc.setQueryData(["active-session"], null);
    rememberActiveSession(null);
    // La sesión se cerró: el descanso vivo ya no tiene serie siguiente que
    // medir. Sin esto quedaría persistido y reaparecería en la próxima.
    useRestStore.getState().clear();
    // Recién ahora cambió el ranking: dispara los avisos (subiste / te pasaron).
    // Fire-and-forget, pero logueamos el resultado/errores (antes se tragaban).
    fetch("/api/rank/notify", { method: "POST" })
      .then(async (r) => {
        const j = await r.json().catch(() => ({}));
        if (!r.ok) console.warn("rank/notify falló:", j);
        else console.info("rank/notify:", j);
      })
      .catch((e) => console.warn("rank/notify error:", e));

    // Logros: registra PRs/hitos de la sesión. Si hubo PR de e1RM, muestra el
    // modal de celebración antes de volver (la navegación ocurre al cerrarlo).
    try {
      const supabase = createClient();
      const { data: found } = await supabase.rpc("record_session_achievements", {
        p_session_id: sessionId,
      });
      qc.invalidateQueries({ queryKey: ["achievements"] });
      const best = (found ?? []).slice().sort((a, b) => b.orm - a.orm);
      if (best.length > 0) {
        setFinishOpen(false);
        setFinishing(false);
        setPrs(best);
        return true;
      }
    } catch {
      // no bloquear el cierre de la sesión por un fallo de logros
    }
    router.push("/registro");
    return true;
  }

  /** "Terminarlo ahora" de una sesión olvidada: fin = última serie completada. */
  async function finishStale() {
    const started = session.started_at
      ? new Date(session.started_at).getTime()
      : 0;
    const last = data.exercises
      .flatMap((e) => e.sets)
      .map((s) => (s.completed_at ? new Date(s.completed_at).getTime() : 0))
      .reduce((a, b) => Math.max(a, b), 0);
    // Sin series con hora: asumimos un entreno de 1 h en vez de inflar métricas.
    const endMs = last > started ? last : started + 3600 * 1000;
    setStaleDismissed(true);
    await finish(new Date(endMs).toISOString());
  }

  // Descartar borra la sesión (con reconfirmación) y libera el candado.
  async function discard() {
    await deleteSession.mutateAsync(sessionId);
    rememberActiveSession(null);
    qc.setQueryData(["active-session"], null);
    useRestStore.getState().clear();
    setDiscardOpen(false);
    router.replace("/rutinas");
  }

  // Cronómetro de descanso: guarda el descanso en la serie que lo arrancó.
  //
  // El descanso termina cuando ARRANCA la serie siguiente, no cuando se la
  // completa: cerrarlo al completarla metía la ejecución entera de esa serie
  // adentro del "descanso" (~20-45 s de sobreestimación sistemática, del mismo
  // orden que la banda objetivo de 30-60 s del perfil de resistencia).
  //
  // La ÚNICA señal de arranque es el botón "Arrancar serie" del banner. Antes
  // también lo cerraba el foco en cualquier campo de otra serie, y eso lo volvía
  // inservible: mirar el peso de un ejercicio de más abajo —o pifiarle a un
  // campo— daba el descanso por terminado. Nada fuera del botón lo interrumpe.
  //
  // Si la serie siguiente se tilda sin haber tocado el botón, el intervalo
  // medido está contaminado y se DESCARTA en vez de inflar el promedio.
  function saveRest(setId: string, sec: number) {
    if (sec > 0 && sec <= REST_MAX_SECONDS)
      m.updateSet.mutate({ id: setId, patch: { rest_seconds: sec } });
  }

  /** Se tildó una serie de trabajo: arranca su descanso (el previo se descarta). */
  function onSetCompleted(
    setId: string,
    info: { isWarmup: boolean; mechanic: string | null },
  ) {
    if (info.isWarmup) return;
    useRestStore.getState().start(sessionId, setId, restTargetSeconds(info.mechanic, profile));
  }

  /** Botón del banner: es la señal explícita de que arrancó la serie siguiente. */
  function stopRest() {
    const { setId, startedAt } = useRestStore.getState();
    if (!restOfThisSession || setId == null || startedAt == null) return;
    saveRest(setId, Math.round((Date.now() - startedAt) / 1000));
    useRestStore.getState().clear();
  }

  /** Mecánica del ejercicio de la serie en descanso, para el subtítulo. */
  const restMechanic = (() => {
    if (!restOfThisSession) return null;
    const we = data.exercises.find((e) => e.sets.some((s) => s.id === restSetId));
    return we ? (exMap.get(we.exercise_id)?.mechanic ?? null) : null;
  })();
  const restHint =
    restMechanic === "compound"
      ? "compuesto 2–3 min"
      : restMechanic === "isolation"
        ? "aislamiento 1–2 min"
        : null;

  /** Al completar un ejercicio, abre el próximo con series pendientes y baja a él. */
  function onExerciseCompleted(index: number) {
    const hasPending = (i: number) =>
      exercises[i].sets.some((s) => !s.is_warmup && !s.completed);
    let next: number | null = null;
    for (let k = 1; k < exercises.length; k++) {
      const i = (index + k) % exercises.length;
      if (hasPending(i)) {
        next = i;
        break;
      }
    }
    if (next == null) {
      setOpenIds(new Set());
      return;
    }
    const id = exercises[next].id;
    setOpenIds(new Set([id]));
    // Esperamos al re-render (la card anterior se pliega y mueve el layout).
    const smooth = !window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    setTimeout(() => {
      document
        .getElementById(`ex-${id}`)
        ?.scrollIntoView({ behavior: smooth ? "smooth" : "auto", block: "start" });
    }, 120);
  }

  function setExpanded(id: string, v: boolean) {
    setOpenIds((prev) => {
      // En curso es un acordeón; terminada se pueden abrir varias a la vez.
      if (!ended) return new Set(v ? [id] : []);
      const next = new Set(prev);
      if (v) next.add(id);
      else next.delete(id);
      return next;
    });
  }

  function removeExercise(we: FullSession["exercises"][number]) {
    const name = exMap.get(we.exercise_id)?.name ?? "ejercicio";
    const setHidden = (hide: boolean) =>
      setHiddenExercises((prev) => {
        const next = new Set(prev);
        if (hide) next.add(we.id);
        else next.delete(we.id);
        return next;
      });
    setHidden(true);
    undoable({
      message: `Quitaste «${name}»`,
      // Si el borrado falla, el rollback devuelve el ejercicio al cache: hay
      // que volver a mostrarlo, si no queda invisible pero vivo en la base.
      commit: () =>
        m.removeExercise.mutateAsync(we.id).catch((e) => {
          setHidden(false);
          throw e;
        }),
      undo: () => setHidden(false),
    });
  }

  /** Info para el modal de PR: nombre y reps del mejor set de ese peso. */
  function prInfo(pr: SessionPr) {
    const sets =
      data.exercises.find((e) => e.exercise_id === pr.exercise_id)?.sets ?? [];
    const reps = sets
      .filter((s) => s.completed && s.weight === pr.weight && s.reps != null)
      .reduce<number | null>((a, s) => Math.max(a ?? 0, s.reps ?? 0), null);
    return { name: exMap.get(pr.exercise_id)?.name ?? "Ejercicio", reps };
  }

  const subtitleSuffix = ` · ${progress.done}/${progress.total} series`;
  const showRest = restHydrated && restOfThisSession && !ended;

  return (
    <div className={ended ? "pb-24" : "pb-8"}>
      {/* Header sticky: nombre, progreso y Terminar; el descanso va pegado abajo. */}
      <div className="sticky top-0 z-20 -mx-4 -mt-5 px-4 pt-5 pb-2 bg-bg/85 backdrop-blur border-b border-border">
        <div className="flex items-center gap-2">
          {ended ? (
            <IconButton label="Volver" onClick={() => router.push("/rutinas")}>
              <ArrowLeft className="size-5" />
            </IconButton>
          ) : (
            <IconButton label="Más opciones" onClick={() => setMenuOpen(true)}>
              <MoreVertical className="size-5" />
            </IconButton>
          )}
          <div className="min-w-0 flex-1">
            <input
              aria-label="Nombre del entreno"
              defaultValue={session.name}
              onBlur={(e) => {
                const v = e.target.value.trim();
                if (v && v !== session.name) m.updateSession.mutate({ name: v });
              }}
              className="block w-full min-w-0 truncate rounded bg-transparent px-1 text-base font-bold text-fg outline-none focus:ring-1 focus:ring-primary"
            />
            <p className="px-1 font-mono tabular-nums text-xs text-muted">
              <ElapsedClock
                startedAt={session.started_at}
                endedAt={session.ended_at}
                durationSeconds={session.duration_seconds}
                suffix={subtitleSuffix}
              />
            </p>
          </div>
          {!ended && (
            <Button
              variant="success"
              size="sm"
              onClick={() => {
                setFinishError(null);
                setFinishOpen(true);
              }}
            >
              Terminar
            </Button>
          )}
        </div>
        {!ended && !online && (
          <p className="mt-1 flex items-center gap-1 px-1 text-xs text-warning-fg">
            <WifiOff className="size-3.5" aria-hidden />
            Sin conexión
            {pendingMutations > 0
              ? ` · ${pendingMutations} ${pendingMutations === 1 ? "cambio pendiente" : "cambios pendientes"}`
              : ""}
          </p>
        )}
        {!ended && online && pendingMutations > 0 && (
          <p className="mt-1 px-1 text-xs text-muted">Guardando…</p>
        )}
        {showRest && (
          <div className="mt-2">
            <RestBanner hint={restHint} onStart={stopRest} />
          </div>
        )}
      </div>

      {/* Horarios: solo con la sesión terminada. En curso, el inicio se edita
          desde el menú ⋯ y el fin lo fija finish(). */}
      {ended && (
        <div className="card p-3 my-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-muted text-sm">
              <Clock className="size-4" />
              Duración
            </div>
            <span className="font-mono text-lg tabular-nums">
              <ElapsedClock
                startedAt={session.started_at}
                endedAt={session.ended_at}
                durationSeconds={session.duration_seconds}
              />
            </span>
          </div>
          <div className="grid grid-cols-2 gap-2 mt-3">
            <label className="text-xs text-muted">
              Inicio
              <input
                type="datetime-local"
                defaultValue={toLocalInput(session.started_at)}
                onBlur={(e) => editTime("started_at", e.target.value)}
                className="mt-1 h-11 w-full rounded-md bg-surface-2 px-2 text-base text-fg outline-none ring-1 ring-border focus:ring-primary"
              />
            </label>
            <label className="text-xs text-muted">
              Fin
              <input
                type="datetime-local"
                defaultValue={toLocalInput(session.ended_at)}
                onBlur={(e) => editTime("ended_at", e.target.value)}
                className="mt-1 h-11 w-full rounded-md bg-surface-2 px-2 text-base text-fg outline-none ring-1 ring-border focus:ring-primary"
              />
            </label>
          </div>
        </div>
      )}

      {/* Resumen (solo al ver una sesión ya finalizada del historial). */}
      {ended && summary && (
        <div className="card p-3 mb-4">
          <div className="grid grid-cols-3 gap-2 text-center">
            <div>
              <p className="text-xs text-muted">Volumen (tonelaje)</p>
              <p className="text-base font-bold mt-0.5">
                {formatVolume(summary.tonnage)}
              </p>
              {summary.prevTonnage != null && summary.prevTonnage > 0 && (
                <p
                  className={`text-xs font-semibold ${
                    summary.tonnage >= summary.prevTonnage
                      ? "text-success-fg"
                      : "text-danger"
                  }`}
                >
                  {summary.tonnage >= summary.prevTonnage ? "+" : ""}
                  {Math.round(
                    ((summary.tonnage - summary.prevTonnage) /
                      summary.prevTonnage) *
                      100,
                  )}
                  % vs anterior
                </p>
              )}
            </div>
            <div>
              <p className="text-xs text-muted">Series efectivas</p>
              <p className="text-base font-bold mt-0.5">{summary.hardSets}</p>
            </div>
            <div>
              <p className="text-xs text-muted">Duración</p>
              <p className="text-base font-bold mt-0.5">
                {session.duration_seconds
                  ? formatDuration(session.duration_seconds)
                  : "—"}
              </p>
            </div>
          </div>
          <p className="text-xs text-muted mt-2 text-center">
            El tonelaje es carga externa (comparar la misma rutina en el tiempo),
            no un indicador de progreso.
          </p>
        </div>
      )}

      <div className="flex flex-col gap-3 mt-3">
        {exercises.map((we, i) => (
          // scroll-mt: deja libre el header sticky (+ banner de descanso) al
          // hacer scrollIntoView del próximo ejercicio.
          <div key={we.id} id={`ex-${we.id}`} className="scroll-mt-40">
            <SessionExerciseCard
              we={we}
              exercise={exMap.get(we.exercise_id)}
              lastLog={lastLogs?.get(we.exercise_id)}
              moving={movingId === we.id}
              moveMode={movingId !== null}
              isFirst={i === 0}
              isLast={i === exercises.length - 1}
              expanded={openIds.has(we.id)}
              onExpandedChange={(v) => setExpanded(we.id, v)}
              onSetCompleted={ended ? undefined : onSetCompleted}
              onExerciseCompleted={ended ? undefined : () => onExerciseCompleted(i)}
              onStartMove={() => setMovingId(we.id)}
              onEndMove={() => setMovingId(null)}
              onMove={(dir) => {
                const j = dir === "up" ? i - 1 : i + 1;
                if (j < 0 || j >= exercises.length) return;
                m.reorder.mutate({ a: we, b: exercises[j] });
              }}
              originalExercise={
                we.replaced_from_exercise_id
                  ? exMap.get(we.replaced_from_exercise_id)
                  : undefined
              }
              onUpdateSet={(id, patch) => m.updateSet.mutate({ id, patch })}
              onAddSet={() =>
                m.addSet.mutate({
                  id: newId(),
                  workoutExerciseId: we.id,
                  // max + 1 y no length + 1: con series borradas (o escondidas
                  // esperando el "Deshacer") el length repetiría un número.
                  setNumber:
                    Math.max(0, ...we.sets.map((s) => s.set_number)) + 1,
                  // Serie extra agregada a mano: no tiene plan contra el cual
                  // comparar, así que nace vacía y sin planned_*. El ghost de la
                  // última vez sigue apareciendo como placeholder.
                  reps: null,
                  weight: null,
                  durationSeconds: null,
                  distanceM: null,
                })
              }
              onDeleteSet={(id) => m.deleteSet.mutateAsync(id)}
              onRemove={() => removeExercise(we)}
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
          </div>
        ))}
      </div>

      <Button
        variant="secondary"
        className="w-full mt-3"
        onClick={() => setPicker(true)}
      >
        <Plus className="size-4" /> Agregar ejercicio
      </Button>

      {/* Única capa inferior: solo con la sesión terminada (en curso, Terminar
          vive en el header). */}
      {ended && (
        <div className="fixed inset-x-0 bottom-20 px-4">
          <div className="mx-auto max-w-2xl">
            <Button
              size="lg"
              variant="secondary"
              className="w-full shadow-lg"
              onClick={() => router.push("/registro")}
            >
              Ver registro
            </Button>
          </div>
        </div>
      )}

      <ExercisePickerModal
        open={picker}
        onClose={() => setPicker(false)}
        onSelect={(ex) =>
          m.addExercise.mutate({
            id: newId(),
            setIds: [newId(), newId(), newId()],
            exerciseId: ex.id,
            // Máximo + 1 sobre TODOS (incluidos los escondidos con "Deshacer"
            // pendiente): exercises.length repetía posiciones tras un borrado.
            position:
              Math.max(-1, ...data.exercises.map((e) => e.position)) + 1,
          })
        }
      />

      <LiveFinishSheet
        open={finishOpen}
        startedAt={session.started_at}
        doneSets={progress.done}
        totalSets={progress.total}
        tonnage={summary.tonnage}
        loading={finishing}
        error={finishError}
        onCancel={() => setFinishOpen(false)}
        onConfirm={() => void finish()}
      />

      <PrCelebrationModal
        prs={prs}
        info={prInfo}
        bodyWeightKg={lastLoggedWeight}
        onClose={() => {
          setPrs([]);
          router.push("/registro");
        }}
      />

      {/* Menú ⋯ */}
      <Modal open={menuOpen} onClose={() => setMenuOpen(false)} title="Más opciones">
        <div className="flex flex-col">
          <button
            type="button"
            className="flex min-h-12 items-center gap-3 rounded-lg px-2 text-left text-sm hover:bg-surface-2"
            onClick={() => {
              setMenuOpen(false);
              setStartDraft(toLocalInput(session.started_at));
              setStartOpen(true);
            }}
          >
            <Pencil className="size-4 text-muted" />
            Editar horario de inicio
          </button>
          <div className="my-2 border-t border-border" />
          <button
            type="button"
            className="flex min-h-12 items-center gap-3 rounded-lg px-2 text-left text-sm text-danger hover:bg-surface-2"
            onClick={() => {
              setMenuOpen(false);
              setDiscardOpen(true);
            }}
          >
            <Trash2 className="size-4" />
            Descartar entreno
          </button>
        </div>
      </Modal>

      <Modal
        open={startOpen}
        onClose={() => setStartOpen(false)}
        title="Horario de inicio"
        footer={
          <div className="flex gap-3">
            <Button
              variant="secondary"
              className="flex-1"
              onClick={() => setStartOpen(false)}
            >
              Cancelar
            </Button>
            <Button
              className="flex-1"
              disabled={!startDraft}
              onClick={() => {
                editTime("started_at", startDraft);
                setStartOpen(false);
              }}
            >
              Guardar
            </Button>
          </div>
        }
      >
        <label className="text-sm text-muted">
          Inicio
          <input
            type="datetime-local"
            value={startDraft}
            onChange={(e) => setStartDraft(e.target.value)}
            className="mt-1 h-11 w-full rounded bg-surface-2 px-2 text-base text-fg outline-none ring-1 ring-border focus:ring-primary"
          />
        </label>
      </Modal>

      <Modal
        open={discardOpen}
        onClose={() => setDiscardOpen(false)}
        title="Descartar entrenamiento"
        center
        dismissible={!deleteSession.isPending}
      >
        <p className="text-sm text-muted mb-4">
          Se va a eliminar esta sesión y todo lo que cargaste. No se puede
          deshacer. Si querés guardarlo, mejor tocá “Terminar”.
        </p>
        <div className="flex flex-col gap-2">
          <Button className="w-full" onClick={() => setDiscardOpen(false)}>
            Seguir entrenando
          </Button>
          <Button
            variant="ghost"
            className="w-full text-danger"
            loading={deleteSession.isPending}
            onClick={discard}
          >
            Descartar
          </Button>
        </div>
      </Modal>

      <Modal
        open={staleOpen}
        onClose={() => setStaleDismissed(true)}
        title={`Tenés un entreno abierto desde ${
          session.started_at
            ? new Date(session.started_at).toLocaleString("es-AR", {
                weekday: "long",
                hour: "2-digit",
                minute: "2-digit",
              })
            : "hace un rato"
        }`}
      >
        <p className="text-sm text-muted mb-4">
          Si ya terminaste, lo cerramos con la hora de tu última serie para no
          inflar la duración.
        </p>
        <div className="flex flex-col gap-2">
          <Button
            variant="success"
            className="w-full"
            loading={finishing}
            onClick={() => void finishStale()}
          >
            Terminarlo ahora
          </Button>
          <Button
            variant="secondary"
            className="w-full"
            onClick={() => setStaleDismissed(true)}
          >
            Seguir entrenando
          </Button>
          <Button
            variant="ghost"
            className="w-full text-danger"
            onClick={() => {
              setStaleDismissed(true);
              setDiscardOpen(true);
            }}
          >
            Descartar
          </Button>
        </div>
      </Modal>
    </div>
  );
}

/** Hoja de cierre con duración en vivo: el reloj solo corre mientras está abierta. */
function LiveFinishSheet({
  startedAt,
  ...props
}: { startedAt: string | null } & Omit<
  React.ComponentProps<typeof FinishWorkoutSheet>,
  "durationSeconds"
>) {
  const durationSeconds = useElapsedSeconds(startedAt, null, null, props.open);
  return <FinishWorkoutSheet {...props} durationSeconds={durationSeconds} />;
}
