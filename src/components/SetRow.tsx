// SPDX-License-Identifier: AGPL-3.0-only
"use client";

import { useEffect, useRef, useState, type Ref } from "react";
import {
  ArrowDown,
  ArrowRight,
  ArrowUp,
  Check,
  Info,
  MessageSquare,
  Plus,
  Trash2,
  X,
} from "lucide-react";
import { clsx } from "@/lib/clsx";
import { formatClock, formatPace, formatWeight } from "@/lib/format";
import { DurationField, focusNextInRow } from "@/components/DurationField";
import { IconButton, Modal } from "@/components/ui";
import { rirOf } from "@/lib/metrics";
import {
  goalParams,
  loadAdvice,
  repRangeLabel,
  rirProductiveLabel,
  rirZone,
} from "@/lib/goal-params";
import type {
  MetricKind,
  SetDrop,
  TrainingProfile,
  WorkoutSet,
} from "@/lib/types";

const RIR_OPTS = [0, 1, 2, 3, 4, 5];

/** Plan de la serie: snapshot de la rutina, guardado al arrancar la sesión. */
export interface PlannedSet {
  reps: number | null;
  weight: number | null;
  duration_seconds: number | null;
  distance_m: number | null;
}

/** Ring de la caja según la magnitud de la sugerencia de carga. */
const RING: Record<"ok" | "off" | "far", string> = {
  ok: "ring-1 ring-success/50",
  off: "ring-2 ring-warning",
  far: "ring-2 ring-danger",
};

/**
 * Encabezados de columna, alineados con las de SetRow (mismos anchos y gaps).
 * Uno por card: así los inputs no necesitan "kg"/"reps" como placeholder.
 */
export function SetRowHeader({ kind }: { kind: MetricKind }) {
  const cols: string[] =
    kind === "reps_weight"
      ? ["Kg", "Reps"]
      : kind === "time_load"
        ? ["Kg", "Tiempo"]
        : kind === "distance_time"
          ? ["Km", "Tiempo"]
          : ["Tiempo"];
  const cls = "text-2xs font-semibold uppercase text-muted";
  return (
    <div className="flex items-center gap-1.5 px-2" aria-hidden="true">
      <span className={clsx(cls, "w-6 text-center")}>#</span>
      {cols.map((c) => (
        <span key={c} className={clsx(cls, "min-w-0 flex-1 text-center")}>
          {c}
        </span>
      ))}
      <span className={clsx(cls, "w-9 text-center")}>W</span>
      <span className={clsx(cls, "w-12 text-center")}>✓</span>
    </div>
  );
}

export function SetRow({
  set,
  ghost,
  planned,
  profile,
  kind = "reps_weight",
  isNext = false,
  onChange,
  onDelete,
}: {
  set: WorkoutSet;
  /** Peso/reps + bajadas de la última vez (placeholder tenue si el campo está vacío). */
  ghost?: {
    weight: number | null;
    reps: number | null;
    drops?: SetDrop[] | null;
    duration_seconds?: number | null;
    distance_m?: number | null;
  } | null;
  /** Lo que la rutina pedía para esta serie. Queda visible toda la sesión. */
  planned?: PlannedSet | null;
  /** Objetivo del usuario: decide zonas de RIR y tolerancia de reps. */
  profile?: TrainingProfile | null;
  /** Cómo se mide este ejercicio; decide qué campos se piden. */
  kind?: MetricKind;
  /** Es la próxima serie pendiente del ejercicio: se resalta y muestra el RIR. */
  isNext?: boolean;
  /**
   * Recibe el patch y la serie MÁS RECIENTE conocida por esta fila (ver
   * `latest` abajo), no la de las props. Devuelve el patch que efectivamente
   * se aplicó (puede sumar lo adoptado del ghost/plan), o `false` si lo
   * rechazó (p. ej. completar sin reps).
   */
  onChange: (
    patch: Partial<WorkoutSet>,
    latest: WorkoutSet,
  ) => Partial<WorkoutSet> | false | void;
  onDelete: () => void;
}) {
  const [showComment, setShowComment] = useState(!!set.comment);
  const [menu, setMenu] = useState(false);
  // El plan arranca oculto: es una referencia para consultar, no algo que
  // tenga que ocupar una linea fija debajo de cada serie.
  const [showPlan, setShowPlan] = useState(false);

  const n = set.set_number;

  // Última versión conocida de la serie, adelantada a las props. Un blur y un
  // tap seguidos (tipear reps y tocar ✓ o la X de una bajada sin cerrar el
  // teclado) corren antes de que el patch del blur vuelva como props: el
  // optimistic update espera a cancelQueries y React Query notifica con
  // setTimeout(0). Construir el segundo patch desde las props pisaba lo recién
  // tipeado con null — así se guardaban las bajadas con reps/peso vacíos.
  const latest = useRef(set);
  const seen = useRef(set);
  useEffect(() => {
    // Sólo se toman de las props los campos que CAMBIARON en ellas (cache,
    // rollback, refetch): un patch local que todavía no llegó no se pierde.
    const prev = seen.current;
    seen.current = set;
    if (prev === set) return;
    const next: Record<string, unknown> = { ...latest.current };
    for (const k of Object.keys(set) as (keyof WorkoutSet)[]) {
      if (set[k] !== prev[k]) next[k] = set[k];
    }
    latest.current = next as unknown as WorkoutSet;
  }, [set]);

  // Completar una serie de reps sin reps no se permite (no suma volumen ni
  // e1RM pero contaba como hecha): se marca el campo y se lo enfoca.
  const [needsReps, setNeedsReps] = useState(false);
  const repsInput = useRef<HTMLInputElement>(null);

  /** Manda el patch construido sobre `latest` y lo adelanta ahí mismo. */
  function emit(patch: Partial<WorkoutSet>): boolean {
    const applied = onChange(patch, latest.current);
    if (applied === false) return false;
    latest.current = { ...latest.current, ...(applied ?? patch) };
    return true;
  }

  const drops = dropsOf(set);

  const rir = rirOf(set);

  const showsLoad = kind === "reps_weight" || kind === "time_load";
  const showsReps = kind === "reps_weight";
  const showsDuration = kind !== "reps_weight";
  const showsDistance = kind === "distance_time";
  // Las bajadas son un recurso de series con carga y reps; en tiempo o
  // distancia no significan nada.
  const showsDrops = kind === "reps_weight";
  const pace = showsDistance
    ? formatPace(set.duration_seconds, set.distance_m)
    : null;

  // RIR y plan solo en la serie en curso y en las completadas: en las futuras
  // multiplicaban por 3 el alto de la lista sin aportar nada todavía.
  const showRir = !set.is_warmup && (isNext || set.completed);

  // Sugerencia de carga: cruza reps y RIR contra los rangos del objetivo. Sólo
  // se evalúa con reps ya cargadas (o la serie tildada): si no, cada fila vacía
  // arrancaría pintada. Los warmups quedan afuera: no tienen plan que cumplir.
  const advice =
    !set.is_warmup && showsReps && (set.completed || drops[0].reps != null)
      ? loadAdvice({
          reps: drops[0].reps,
          rir,
          planned: planned?.reps,
          hasDrops: drops.length > 1,
          profile,
        })
      : null;

  // El plan se muestra en el chip ⓘ, y como placeholder sólo si nunca hiciste
  // el ejercicio (sin ghost): ahí es la mejor pista gris disponible.
  const hint = {
    weight: ghost?.weight ?? planned?.weight ?? null,
    reps: ghost?.reps ?? planned?.reps ?? null,
    duration_seconds:
      ghost?.duration_seconds ?? planned?.duration_seconds ?? null,
    distance_m: ghost?.distance_m ?? planned?.distance_m ?? null,
  };

  // Matices del mensaje: por qué se sugiere bajar (la serie dejó de contar) y
  // si la sugerencia salió del RIR y no de las reps.
  const minReps = goalParams(profile).hardSetMinReps;
  const adviceSuffix = [
    advice?.belowFloor ? `menos de ${minReps} reps no suma` : null,
    advice?.byRir ? "por el RIR" : null,
  ]
    .filter(Boolean)
    .join(" · ");

  // Las REPS van primero: son lo que el plan fija de verdad. El peso planeado
  // es orientativo y se mueve solo a medida que progresás, así que leerlo como
  // el encabezado del plan invita a perseguir un número que ya envejeció.
  const plannedLabel = planned
    ? [
        planned.reps != null ? `${planned.reps} reps` : null,
        planned.duration_seconds != null
          ? formatClock(planned.duration_seconds)
          : null,
        planned.distance_m != null ? `${planned.distance_m / 1000} km` : null,
        planned.weight != null ? formatWeight(planned.weight) : null,
      ]
        .filter(Boolean)
        .join(" × ")
    : "";

  // Las bajadas se recalculan desde `latest`, nunca desde el `drops` del
  // render: es el array entero el que se reescribe en cada cambio.
  function commitDrops(next: SetDrop[]) {
    const first = next[0] ?? { reps: null, weight: null };
    emit({
      drops: next.length > 1 ? next : null,
      weight: first.weight,
      reps: first.reps,
    });
  }

  function updateDrop(index: number, patch: Partial<SetDrop>) {
    if (index === 0 && patch.reps != null) setNeedsReps(false);
    commitDrops(
      dropsOf(latest.current).map((d, i) =>
        i === index ? { ...d, ...patch } : d,
      ),
    );
  }

  function addDrop() {
    commitDrops([...dropsOf(latest.current), { reps: null, weight: null }]);
  }

  function removeDrop(index: number) {
    commitDrops(dropsOf(latest.current).filter((_, i) => i !== index));
  }

  function toggleCompleted() {
    const ok = emit({ completed: !latest.current.completed });
    setNeedsReps(!ok);
    if (!ok) repsInput.current?.focus();
  }

  function setRir(v: number | null) {
    // Guarda en la columna rpe (rpe = 10 − rir); toggle si se re-toca el mismo.
    emit({ rpe: v == null ? null : 10 - v });
  }

  // Una sola sugerencia por serie: la matriz ya resolvió el cruce de reps y
  // RIR, así que no hay dos mensajes que compitan.
  const adviceNode =
    advice && advice.action !== "ok" ? (
      <span
        className={clsx(
          "flex items-center gap-1 text-xs font-semibold",
          advice.level === "far" ? "text-danger" : "text-warning-fg",
        )}
      >
        {advice.action === "bajar" && (
          <>
            <ArrowDown className="size-3.5 shrink-0" /> bajá el peso
          </>
        )}
        {advice.action === "subir" && (
          <>
            <ArrowUp className="size-3.5 shrink-0" /> subí el peso
          </>
        )}
        {advice.action === "seguir" && (
          <>
            <ArrowRight className="size-3.5 shrink-0" /> el peso está bien:
            llegá a las reps
          </>
        )}
        {advice.action !== "seguir" && adviceSuffix && ` · ${adviceSuffix}`}
      </span>
    ) : null;

  const hasPlanLine =
    showRir &&
    (plannedLabel || showsReps) &&
    (plannedLabel || (advice && advice.action !== "ok"));

  const numLabel = (what: string) => `${what}, serie ${n}`;

  return (
    <div
      data-setrow
      className={clsx(
        "rounded-md px-2 py-1.5 transition",
        set.completed ? "bg-success/10" : "bg-surface-2",
        set.is_warmup && "opacity-60",
        isNext && !set.completed && "ring-1 ring-primary/50",
      )}
    >
      <div className="flex items-center gap-1.5">
        {/* El número abre el menú de la serie (bajada, comentario, eliminar):
            ahí cae menos el pulgar que sobre el check, y no queda pegado a él. */}
        <button
          type="button"
          onClick={() => setMenu(true)}
          aria-label={`Opciones de la serie ${n}`}
          className="relative grid h-11 w-6 shrink-0 place-items-center rounded-md text-sm font-semibold text-fg after:absolute after:-inset-x-2 after:inset-y-0 after:content-[''] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
        >
          {n}
        </button>

        {showsLoad && (
          <NumberField
            value={drops[0].weight}
            placeholder={hint.weight != null ? String(hint.weight) : ""}
            label={numLabel(showsReps ? "Peso (kg)" : "Carga (kg)")}
            inputMode="decimal"
            enterKeyHint="next"
            // El color va en la caja del PESO aunque lo dispare el RIR o las
            // reps: la corrección que se sugiere es sobre la carga. La excepción
            // es "seguir", donde el mensaje dice que el peso está bien.
            ring={
              advice && advice.action !== "seguir"
                ? RING[advice.level]
                : undefined
            }
            onCommit={(v) => updateDrop(0, { weight: v })}
          />
        )}
        {showsReps && (
          <NumberField
            value={drops[0].reps}
            placeholder={hint.reps != null ? String(hint.reps) : ""}
            label={numLabel("Reps")}
            inputMode="numeric"
            enterKeyHint="done"
            // Sólo cuando lo que falta son las reps y no la carga.
            ring={
              needsReps
                ? RING.far
                : advice?.action === "seguir"
                  ? RING.off
                  : undefined
            }
            inputRef={repsInput}
            onCommit={(v) => updateDrop(0, { reps: v })}
          />
        )}
        {showsDistance && (
          <NumberField
            value={set.distance_m == null ? null : set.distance_m / 1000}
            placeholder={
              hint.distance_m != null ? String(hint.distance_m / 1000) : ""
            }
            label={numLabel("Distancia (km)")}
            inputMode="decimal"
            enterKeyHint="next"
            onCommit={(v) =>
              emit({ distance_m: v == null ? null : Math.round(v * 1000) })
            }
          />
        )}
        {showsDuration && (
          <DurationField
            key={set.duration_seconds ?? "empty"}
            value={set.duration_seconds}
            placeholder={hint.duration_seconds}
            onCommit={(v) => emit({ duration_seconds: v })}
            size="lg"
            labelSuffix={`serie ${n}`}
            className="flex-1"
          />
        )}

        <button
          type="button"
          onClick={() => emit({ is_warmup: !latest.current.is_warmup })}
          aria-label="Calentamiento"
          aria-pressed={set.is_warmup}
          title="Calentamiento (no cuenta)"
          className={clsx(
            "relative size-9 grid place-items-center rounded-md shrink-0 text-xs font-bold transition after:absolute after:-inset-y-1 after:inset-x-0 after:content-[''] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary",
            set.is_warmup
              ? "bg-warning/20 text-warning-fg ring-1 ring-warning/40"
              : "bg-surface ring-1 ring-border text-muted hover:text-fg",
          )}
        >
          W
        </button>

        {/* Sin preventDefault en pointerdown: el commit de los inputs es en blur
            y depende de que el foco se suelte antes del click. */}
        <button
          type="button"
          onClick={toggleCompleted}
          aria-label={`Completar serie ${n}`}
          aria-pressed={set.completed}
          className={clsx(
            "size-12 grid place-items-center rounded-lg shrink-0 transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary",
            set.completed
              ? "bg-success text-bg"
              : "bg-surface ring-2 ring-success/50 text-success hover:bg-success/10",
          )}
        >
          <Check className="size-6" />
        </button>
      </div>

      {needsReps && (
        <p role="alert" className="mt-1 text-xs text-danger">
          Cargá las reps para completar la serie.
        </p>
      )}

      {/* RIR segmentado (oculto en warmups y en series futuras). */}
      {showRir && (
        <div className="mt-1.5 flex items-center gap-2">
          <span className="w-10 shrink-0 leading-tight">
            <span className="block text-sm font-semibold text-fg">RIR</span>
            <span className="block text-xs text-muted tabular-nums">
              {rirProductiveLabel(profile)}
            </span>
          </span>
          <div
            role="radiogroup"
            aria-label="RIR"
            className="grid flex-1 grid-cols-6 gap-1.5"
          >
            {RIR_OPTS.map((v) => {
              const active = rir === v;
              const zone = rirZone(v, profile);
              return (
                <button
                  key={v}
                  type="button"
                  role="radio"
                  aria-checked={active}
                  aria-label={v === 5 ? "RIR 5 o más" : `RIR ${v}`}
                  onClick={() => setRir(active ? null : v)}
                  className={clsx(
                    "h-10 rounded-md text-sm font-bold transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary",
                    active && "text-bg",
                    active && zone === "danger" && "bg-danger",
                    active && zone === "success" && "bg-success",
                    active && zone === "muted" && "bg-muted",
                    !active &&
                      "bg-surface text-muted ring-1 ring-border hover:text-fg",
                  )}
                >
                  {v === 5 ? "5+" : v}
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* Plan de la serie. Es un chip fijo, no un placeholder: el placeholder
          desaparece al primer tecleo y era justamente lo que hacía perder la
          referencia apenas empezabas el ejercicio. En 360px el RIR ocupa todo el
          ancho, así que el consejo va en la línea de abajo, junto al chip ⓘ. */}
      {hasPlanLine && (
        <div className="mt-1 text-xs tabular-nums">
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setShowPlan((v) => !v)}
              aria-expanded={showPlan}
              aria-label={showPlan ? "Ocultar el plan" : "Ver el plan"}
              className={clsx(
                "relative size-7 grid place-items-center rounded-full shrink-0 ring-1 transition after:absolute after:-inset-2 after:content-['']",
                showPlan
                  ? "bg-accent/15 text-accent ring-accent/40"
                  : "text-muted ring-border hover:text-fg",
              )}
            >
              <Info className="size-3.5" />
            </button>
            {!showPlan && adviceNode}
            {showPlan && (
              <span className="text-muted">
                {plannedLabel && `plan ${plannedLabel} · `}
                {showsReps &&
                  `reps ${repRangeLabel(profile)} · RIR ${rirProductiveLabel(profile)}`}
              </span>
            )}
          </div>

          {showPlan && adviceNode && <div className="mt-0.5">{adviceNode}</div>}
          {showPlan && showsReps && (
            <p className="mt-0.5 text-muted">
              La tolerancia (±{goalParams(profile).repTolerance}) es una
              heurística, no sale de un paper.
              {profile === "resistencia" &&
                " En series largas el RIR es una estimación gruesa."}
            </p>
          )}
          {showPlan && advice?.planOutOfRange && planned?.reps != null && (
            <p className="mt-0.5 text-warning-fg">
              El plan pide {planned.reps} reps; para tu objetivo el rango es{" "}
              {repRangeLabel(profile)}. Se usa el rango.
            </p>
          )}
        </div>
      )}

      {pace && <div className="mt-1 text-xs text-muted">Ritmo {pace}</div>}

      {showsDrops &&
        drops.slice(1).map((d, i) => {
          const gd = ghost?.drops?.[i + 1];
          return (
            <div key={i + 1} className="mt-1.5 flex items-center gap-1.5 pl-8">
              <span className="shrink-0 text-xs text-muted">+ bajada</span>
              <NumberField
                value={d.weight}
                placeholder={gd?.weight != null ? String(gd.weight) : ""}
                label={`Peso (kg) de la bajada ${i + 1}, serie ${n}`}
                inputMode="decimal"
                enterKeyHint="next"
                onCommit={(v) => updateDrop(i + 1, { weight: v })}
              />
              <NumberField
                value={d.reps}
                placeholder={gd?.reps != null ? String(gd.reps) : ""}
                label={`Reps de la bajada ${i + 1}, serie ${n}`}
                inputMode="numeric"
                enterKeyHint="done"
                onCommit={(v) => updateDrop(i + 1, { reps: v })}
              />
              <IconButton
                size="sm"
                label="Quitar bajada"
                onClick={() => removeDrop(i + 1)}
              >
                <X className="size-4" />
              </IconButton>
            </div>
          );
        })}

      {showComment && (
        <input
          defaultValue={set.comment ?? ""}
          autoFocus={!set.comment}
          aria-label={`Comentario, serie ${n}`}
          placeholder="Comentario…"
          onBlur={(e) => emit({ comment: e.target.value || null })}
          className="mt-1.5 h-11 w-full rounded-md bg-surface px-2.5 text-base outline-none ring-1 ring-border focus:ring-primary"
        />
      )}

      <Modal open={menu} onClose={() => setMenu(false)} title={`Serie ${n}`}>
        <div className="flex flex-col">
          {showsDrops && (
            <SetMenuItem
              icon={<Plus className="size-4" />}
              onClick={() => {
                setMenu(false);
                addDrop();
              }}
            >
              Agregar bajada
            </SetMenuItem>
          )}
          <SetMenuItem
            icon={<MessageSquare className="size-4" />}
            onClick={() => {
              setMenu(false);
              setShowComment(true);
            }}
          >
            {set.comment ? "Editar comentario" : "Comentario"}
          </SetMenuItem>
          <div className="mt-1 border-t border-border pt-1">
            <SetMenuItem
              danger
              icon={<Trash2 className="size-4" />}
              onClick={() => {
                setMenu(false);
                onDelete();
              }}
            >
              Eliminar serie
            </SetMenuItem>
          </div>
        </div>
      </Modal>
    </div>
  );
}

function SetMenuItem({
  icon,
  children,
  hint,
  danger,
  disabled,
  onClick,
}: {
  icon: React.ReactNode;
  children: React.ReactNode;
  hint?: string;
  danger?: boolean;
  disabled?: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={clsx(
        "flex min-h-11 w-full items-center gap-2.5 rounded-md px-3 text-left text-sm hover:bg-surface-2 disabled:pointer-events-none disabled:opacity-50",
        danger ? "text-danger" : "text-fg",
      )}
    >
      {icon}
      {children}
      {hint && <span className="ml-auto text-xs text-muted">{hint}</span>}
    </button>
  );
}

/** Bajadas de la serie, o el par base como única "bajada" si es simple. */
function dropsOf(s: WorkoutSet): SetDrop[] {
  return s.drops && s.drops.length > 0
    ? s.drops
    : [{ reps: s.reps, weight: s.weight }];
}

function NumberField({
  value,
  placeholder,
  label,
  inputMode,
  enterKeyHint,
  ring,
  inputRef,
  onCommit,
}: {
  value: number | null;
  placeholder: string;
  label: string;
  inputMode: "decimal" | "numeric";
  enterKeyHint: "next" | "done";
  /** Ring de estado (desvío vs. plan). Por defecto, el borde neutro. */
  ring?: string;
  inputRef?: Ref<HTMLInputElement>;
  onCommit: (v: number | null) => void;
}) {
  const [invalid, setInvalid] = useState(false);
  // type="text" y no "number": el teclado decimal de muchos teléfonos escribe
  // coma, que un input number rechaza como badInput. Se acepta "72,5".
  return (
    <input
      ref={inputRef}
      type="text"
      inputMode={inputMode}
      enterKeyHint={enterKeyHint}
      aria-label={label}
      aria-invalid={invalid || undefined}
      defaultValue={value ?? ""}
      key={value ?? "empty"}
      placeholder={placeholder}
      onFocus={(e) => {
        setInvalid(false);
        e.currentTarget.select();
      }}
      onKeyDown={(e) => {
        if (e.key !== "Enter") return;
        e.preventDefault();
        focusNextInRow(e.currentTarget);
      }}
      onBlur={(e) => {
        const raw = e.target.value.trim().replace(",", ".");
        const v = raw === "" ? null : Number(raw);
        // Inválido (texto, negativo): se restaura el valor previo sin borrar el
        // dato y no se commitea.
        if (v != null && (!Number.isFinite(v) || v < 0)) {
          e.currentTarget.value = value == null ? "" : String(value);
          setInvalid(true);
          return;
        }
        setInvalid(false);
        if (v !== value) onCommit(v);
      }}
      className={clsx(
        "h-11 flex-1 min-w-0 rounded-md bg-surface px-1 text-center text-base font-semibold tabular-nums text-fg outline-none placeholder:font-normal placeholder:text-muted/60 focus:ring-primary",
        invalid ? "ring-2 ring-danger" : (ring ?? "ring-1 ring-border"),
      )}
    />
  );
}
