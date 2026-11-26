// SPDX-License-Identifier: AGPL-3.0-only
"use client";

import {
  Fragment,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import dynamic from "next/dynamic";
import { Check } from "lucide-react";
import { DeltaChip, SectionCard } from "@/components/ui";
import type { LinePoint } from "@/components/charts";
import { Ref } from "@/components/PaperLink";
import { muscleEs } from "@/lib/i18n-exercise";
import { fmtDaysAgo, fmtNum, formatClock } from "@/lib/format";
import { clsx } from "@/lib/clsx";
import type { TrainingProfile, Exercise } from "@/lib/types";
import { goalParams, rirProductiveLabel } from "@/lib/goal-params";
import type { HistorySession } from "@/hooks/useHistory";

// recharts se carga recién cuando hay un gráfico para mostrar.
const MiniLine = dynamic(
  () => import("@/components/charts-entry").then((m) => m.MiniLine),
  { ssr: false, loading: () => <div className="h-[170px] animate-pulse rounded-lg bg-surface-2" /> },
);
const MultiLine = dynamic(
  () => import("@/components/charts-entry").then((m) => m.MultiLine),
  { ssr: false, loading: () => <div className="h-[190px] animate-pulse rounded-lg bg-surface-2" /> },
);
const Sparkline = dynamic(
  () => import("@/components/charts-entry").then((m) => m.Sparkline),
  { ssr: false, loading: () => <div className="h-[34px] animate-pulse rounded bg-surface-2" /> },
);
const StackedBar = dynamic(
  () => import("@/components/charts-entry").then((m) => m.StackedBar),
  { ssr: false, loading: () => <div className="h-8 animate-pulse rounded-full bg-surface-2" /> },
);
const HBars = dynamic(
  () => import("@/components/charts-entry").then((m) => m.HBars),
  { ssr: false, loading: () => <div className="h-24 animate-pulse rounded-lg bg-surface-2" /> },
);
import {
  e1rmSeriesByExercise,
  intensityZones,
  heavyRirTrend,
  patternFrequency,
  rirZoneByMuscle,
  RIR_OUT_SHARE,
  RIR_MIN_RATED,
  type MuscleRirZone,
  daysSinceLastByMuscle,
  repsPerSetWeekly,
  sessionDensityWeekly,
  maxRepsTest,
  strengthRetentionIndex,
  avgRestBetweenSets,
  readinessByMuscle,
  type Readiness,
} from "@/lib/metrics-goal";

/**
 * Portada de métricas de ENTRENAMIENTO (100% 🏋️), ordenada por PERFIL
 * (fuerza/hipertrofia/resistencia). "Series efectivas por grupo" la construye
 * registro y la pasa como slot para promoverla a portada en Hipertrofia (así no
 * se duplica en el "fijo abajo").
 */
export function GoalMetrics({
  trainingProfile,
  sessions,
  exMap,
  muscleSetsBar,
}: {
  trainingProfile: TrainingProfile | null;
  sessions: HistorySession[];
  exMap: Map<string, Exercise>;
  /** Series efectivas por grupo (MEV/MAV/MRV): a portada en Hipertrofia. */
  muscleSetsBar?: ReactNode;
}) {
  // Las cards de recencia cuentan DÍAS. Antes tomaban `Date.now()` dentro del
  // useMemo, así que el número quedaba congelado en el momento del montaje: en
  // una PWA que queda abierta, "hace 2d" no avanzaba nunca. Se refresca al
  // volver a la pestaña y una vez por hora — alcanza para detectar el cambio de
  // fecha. Queda `undefined` en el primer render (las funciones tienen su propio
  // default) para no llamar a Date.now() durante el render.
  const [now, setNow] = useState<number | undefined>(undefined);
  useEffect(() => {
    const tick = () => setNow(Date.now());
    tick();
    const id = setInterval(tick, 60 * 60 * 1000);
    document.addEventListener("visibilitychange", tick);
    return () => {
      clearInterval(id);
      document.removeEventListener("visibilitychange", tick);
    };
  }, []);

  const m = useMemo(
    () => ({
      e1rm: e1rmSeriesByExercise(sessions, exMap, 12),
      intensity: intensityZones(sessions, 28),
      heavyRir: heavyRirTrend(sessions, 12),
      patterns: patternFrequency(sessions, exMap, 8),
      rirZones: rirZoneByMuscle(sessions, exMap, 30, trainingProfile),
      recency: daysSinceLastByMuscle(sessions, exMap, now),
      reps: repsPerSetWeekly(sessions, 12),
      density: sessionDensityWeekly(sessions, 12),
      maxReps: maxRepsTest(sessions, exMap, 6),
      rest: avgRestBetweenSets(sessions),
      ready: readinessByMuscle(sessions, exMap, now, trainingProfile),
    }),
    [sessions, exMap, now, trainingProfile],
  );

  const cards: ReactNode[] = [];

  // Base (todos los perfiles): listo para entrenar.
  if (m.ready.length) cards.push(<ReadyCard rows={m.ready} />);

  if (trainingProfile === "fuerza") {
    if (m.e1rm.length) cards.push(<E1rmTrendCard series={m.e1rm.slice(0, 4)} />);
    if (m.intensity.total) cards.push(<IntensityCard d={m.intensity} />);
    if (m.patterns.some((p) => p.value > 0))
      cards.push(<PatternCard rows={m.patterns} />);
    if (m.heavyRir.length) cards.push(<HeavyRirCard data={m.heavyRir} />);
    if (m.rest.avgSec != null)
      cards.push(
        <RestCard
          avgSec={m.rest.avgSec}
          band="2-5 min"
          samples={m.rest.samples}
        />,
      );
  } else if (trainingProfile === "hipertrofia") {
    // Series efectivas por grupo (MEV/MAV/MRV) es LA métrica del perfil → arriba.
    if (muscleSetsBar) cards.push(muscleSetsBar);
    if (m.rirZones.length)
      cards.push(<RirZoneCard rows={m.rirZones} profile={trainingProfile} />);
    if (m.recency.length) cards.push(<RecencyCard rows={m.recency} />);
    if (m.e1rm.length) cards.push(<SparklineGridCard series={m.e1rm.slice(0, 12)} />);
  } else if (trainingProfile === "resistencia") {
    if (m.maxReps.length) cards.push(<MaxRepsCard rows={m.maxReps} />);
    if (m.reps.length) cards.push(<RepsCard data={m.reps} />);
    if (m.density.length) cards.push(<DensityCard data={m.density} />);
    if (m.rest.avgSec != null)
      cards.push(
        <RestCard
          avgSec={m.rest.avgSec}
          band="30-60 s"
          samples={m.rest.samples}
        />,
      );
  }

  if (cards.length === 0) return null;
  return (
    <>
      {cards.map((c, i) => (
        <Fragment key={i}>{c}</Fragment>
      ))}
    </>
  );
}

// ── Cards ───────────────────────────────────────────────────────────────────

/** Estructura común de los textos de info: qué es / cómo leerlo / metodología
 *  (colapsada). Evita muros de texto en el modal. */
function Info({
  what,
  how,
  method,
}: {
  what: ReactNode;
  how: ReactNode;
  method?: ReactNode;
}) {
  return (
    <>
      <p className="font-semibold text-fg">Qué es</p>
      <p className="mb-3">{what}</p>
      <p className="font-semibold text-fg">Cómo leerlo</p>
      <p className="mb-3">{how}</p>
      {method && (
        <details>
          <summary className="cursor-pointer min-h-11 flex items-center text-fg font-medium">
            Metodología y fuentes
          </summary>
          <div className="pb-2">{method}</div>
        </details>
      )}
    </>
  );
}

function ReadyCard({ rows }: { rows: Readiness[] }) {
  return (
    <SectionCard
      title="Listo para entrenar"
      subtitle="Grupos descansados y con volumen bajo"
      info={
        <Info
          what="Un ranking de qué grupos musculares conviene entrenar hoy. Muestra los 3 con mejor puntaje."
          how={
            <>
              Cada fila dice hace cuánto entrenaste el grupo y cuántas series le
              faltan para llegar al MEV (volumen mínimo efectivo) de esta semana.
              &ldquo;Mínimo cubierto&rdquo; significa que ya llegaste.
            </>
          }
          method={
            <>
              Combina dos señales en un puntaje:{"\n\n"}
              • <span className="text-fg">Rezago de volumen</span> = (MEV − series
              efectivas de los últimos 7 días) / MEV, entre 0 y 1.{"\n"}
              • <span className="text-fg">Recuperación</span> = días desde la
              última vez que lo entrenaste, escalado entre 0 y 1 (min(1, días/3):
              3 o más días = del todo recuperado).{"\n\n"}
              Puntaje = 0,6 × rezago + 0,4 × recuperación.{"\n\n"}
              El rezago pesa más a propósito: con volumen igualado, la frecuencia
              por sí sola tiene un efecto despreciable sobre la hipertrofia (el
              intervalo creíble de su pendiente incluye el cero), mientras que el
              volumen tiene una relación dosis-respuesta clara. <Ref id="16" /> La
              recuperación funciona como desempate y evita sugerirte un grupo
              entrenado ayer.{"\n\n"}
              El compuesto en sí es una heurística de producto: lo respaldado son
              los insumos, no la forma de combinarlos.
            </>
          }
        />
      }
    >
      <ul className="flex flex-col gap-2.5">
        {rows.map((r) => (
          <li key={r.muscle} className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="font-medium">{muscleEs(r.muscle)}</p>
              <p className="text-xs text-muted">{fmtDaysAgo(r.days)}</p>
            </div>
            {r.missingSets > 0 ? (
              <span className="text-xs text-fg text-right shrink-0 pt-0.5">
                Faltan {fmtNum(r.missingSets)}{" "}
                {r.missingSets === 1 ? "serie" : "series"} para el mínimo
              </span>
            ) : (
              <span className="inline-flex items-center gap-1 text-xs font-medium text-success-fg shrink-0 pt-0.5">
                <Check className="size-3.5" aria-hidden />
                Mínimo cubierto
              </span>
            )}
          </li>
        ))}
      </ul>
    </SectionCard>
  );
}

function E1rmTrendCard({
  series,
}: {
  series: ReturnType<typeof e1rmSeriesByExercise>;
}) {
  const top = series[0];
  return (
    <SectionCard
      title="1RM estimado"
      subtitle={`Tus ${series.length} ejercicios más frecuentes · últimas 12 semanas`}
      info={
        <Info
          what="Tu repetición máxima (1RM) estimada por semana, para tus ejercicios más frecuentes."
          how="Una línea que sube es fuerza que sube, aunque hayas cambiado las repeticiones. Tocá un ejercicio de la leyenda para resaltar su línea."
          method={
            <>
              Se usa la fórmula de Epley sobre la mejor serie de cada semana.
              Normaliza el progreso aunque cambien las reps, cosa que el tonelaje
              no hace. <Ref id="3" />
            </>
          }
        />
      }
    >
      {top?.deltaPct != null && (
        <p className="flex items-center gap-2 text-sm mb-2">
          <span className="text-muted">{top.name}:</span>
          <DeltaChip pct={top.deltaPct} />
          <span className="text-muted text-xs">vs inicio</span>
        </p>
      )}
      <MultiLine series={series.map((s) => ({ name: s.name, points: s.series }))} unit="kg" />
    </SectionCard>
  );
}

function IntensityCard({
  d,
}: {
  d: ReturnType<typeof intensityZones>;
}) {
  return (
    <SectionCard
      title="Distribución de intensidad"
      subtitle="Series por zona de %1RM · últimos 28 días"
      info={
        <Info
          what="Cómo se reparten tus series según qué tan pesado es el peso respecto de tu 1RM (repetición máxima) estimado."
          how="Para ganar fuerza conviene tener una parte importante de series pesadas (más de 85% del 1RM)."
          method={
            <>
              Se calcula peso ÷ 1RM estimado. Las cargas pesadas tienen ventaja
              clara para la fuerza medida por 1RM. <Ref id="4" />
            </>
          }
        />
      }
    >
      <StackedBar
        segments={[
          { label: "Ligero <70%", value: d.light, className: "bg-muted" },
          { label: "Medio 70-85%", value: d.medium, className: "bg-primary/70" },
          { label: "Pesado >85%", value: d.heavy, className: "bg-success" },
        ]}
      />
    </SectionCard>
  );
}

function PatternCard({ rows }: { rows: { label: string; value: number }[] }) {
  return (
    <SectionCard
      title="Frecuencia por patrón"
      subtitle="Sesiones por semana · últimas 8 semanas"
      info={
        <Info
          what="Cuántas veces por semana entrenás cada patrón de movimiento: sentadilla, bisagra, empuje y tirón."
          how="En fuerza la especificidad es por patrón de movimiento, no por músculo. Buscá que ningún patrón quede muy por debajo de los demás."
          method="Sentadilla y bisagra se infieren del músculo primario del ejercicio; empuje y tirón, del tipo de fuerza."
        />
      }
    >
      <HBars rows={rows} unit="/sem" />
    </SectionCard>
  );
}

function HeavyRirCard({ data }: { data: LinePoint[] }) {
  return (
    <SectionCard
      title="RIR de series pesadas"
      subtitle="Promedio semanal · series >85% 1RM"
      info={
        <Info
          what="El RIR (repeticiones en reserva) promedio de tus series pesadas: cuántas reps te sobraban al terminar."
          how="Menos RIR es más cerca del fallo. Una línea estable indica que la intensidad de tus series pesadas es consistente."
          method={
            <>
              Los programas autorregulados por RIR dieron más fuerza que las
              cargas fijas por %1RM. <Ref id="6" />
            </>
          }
        />
      }
    >
      <MiniLine data={data} unit="RIR" />
    </SectionCard>
  );
}

/**
 * Músculos cuyo reparto de RIR se fue de la zona del objetivo.
 *
 * Reemplaza a la barra apilada por músculo, que para hipertrofia no podía
 * comunicar nada: con `rirTooCloseBelow` en null, todas las series en zona
 * daban ocho barras llenas e idénticas. Acá el caso bueno es un mensaje y el
 * caso malo es una lista corta de qué corregir — que es la única diferencia que
 * importaba ver.
 */
function RirZoneCard({
  rows,
  profile,
}: {
  rows: MuscleRirZone[];
  profile: TrainingProfile | null;
}) {
  const gp = goalParams(profile);
  const flagged = rows.filter(
    (r) => r.rated >= RIR_MIN_RATED && r.outPct >= RIR_OUT_SHARE,
  );
  const rated = rows.reduce((a, r) => a + r.rated, 0);
  const unrated = rows.reduce((a, r) => a + r.unrated, 0);
  const coverage = rated + unrated > 0 ? rated / (rated + unrated) : 0;
  const zone = rirProductiveLabel(profile);
  const n = (v: number) => fmtNum(v, 1);

  return (
    <SectionCard
      title="Proximidad al fallo"
      subtitle={`Zona RIR ${zone} · por músculo · 30 días`}
      info={
        <Info
          what="Qué músculos tienen muchas series fuera de la zona de RIR (repeticiones en reserva) que conviene a tu objetivo."
          how={
            <>
              Solo se listan los músculos con problema, no todos. Si no aparece
              ninguno, vas bien. Ámbar = series demasiado lejos del fallo; rojo =
              demasiado cerca.
            </>
          }
          method={
            <>
              La proximidad al fallo ideal depende del objetivo: la hipertrofia
              mejora cuanto más cerca del fallo, pero para fuerza las ganancias
              son iguales en un rango amplio de RIR, así que acercarse suma
              fatiga sin rédito. Las reps al fallo se subestiman; mejora con
              experiencia. <Ref id="19" /> <Ref id="8" /> <Ref id="9" />{" "}
              <Ref id="10" />
              {"\n\n"}
              Un músculo entra si al menos un tercio de sus series con RIR quedó
              fuera de zona, y solo con {RIR_MIN_RATED} series o más. Ese tercio
              es <span className="text-fg">una heurística de producto</span>: con
              3-4 series por sesión, una serie fuera de zona es ruido y un tercio
              del mes ya es un hábito. El piso de {RIR_MIN_RATED} series sí tiene
              origen: es el volumen por debajo del cual un efecto no se distingue
              del ruido. <Ref id="16" />
            </>
          }
        />
      }
    >
      {flagged.length === 0 ? (
        <p className="text-sm text-muted">
          {rated === 0
            ? "Todavía no cargaste el RIR de ninguna serie."
            : `Todos los músculos están dentro del RIR ${zone}.`}
        </p>
      ) : (
        <>
          <div className="flex flex-wrap gap-1.5">
            {flagged.map((r) => {
              const far = r.tooFar >= r.tooClose;
              return (
                <span
                  key={r.muscle}
                  className={clsx(
                    "inline-flex items-center gap-1.5 rounded-md px-2 py-1 text-xs text-fg ring-1",
                    far
                      ? "bg-warning/15 ring-warning/30"
                      : "bg-danger/15 ring-danger/30",
                  )}
                >
                  {/* El punto lleva el color; el texto queda en text-fg (contraste). */}
                  <span
                    aria-hidden
                    className={clsx(
                      "size-2 rounded-full shrink-0",
                      far ? "bg-warning" : "bg-danger",
                    )}
                  />
                  {muscleEs(r.muscle)} · {n(far ? r.tooFar : r.tooClose)} de{" "}
                  {n(r.rated)}{" "}
                  {far
                    ? `en RIR ${gp.rirProductiveMax + 1}+`
                    : "casi al fallo"}
                </span>
              );
            })}
          </div>
          <p className="mt-2 text-xs text-muted">
            Ámbar: lejos del fallo · Rojo: demasiado cerca del fallo
          </p>
        </>
      )}
      {/* Sin esto la card afirmaría "todo en zona" sobre tres series de cuarenta. */}
      {rated + unrated > 0 && (
        <p className="mt-3 text-xs text-muted">
          {Math.round(coverage * 100)}% de tus series tienen el RIR cargado.
        </p>
      )}
    </SectionCard>
  );
}


export function SparklineGridCard({
  series,
}: {
  series: ReturnType<typeof e1rmSeriesByExercise>;
}) {
  return (
    <SectionCard
      title="Progresión por ejercicio"
      subtitle="1RM estimado · últimas 12 semanas"
      info={
        <Info
          what="Un mini gráfico de 1RM (repetición máxima) estimado por ejercicio, con su variación desde el inicio de la ventana."
          how="En hipertrofia hay muchos ejercicios: la grilla deja ver de un vistazo cuáles progresan y cuáles están estancados."
        />
      }
    >
      <div className="grid grid-cols-2 gap-x-4 gap-y-3">
        {series.map((s) => (
          <div key={s.exId}>
            <div className="flex items-center justify-between gap-2">
              <p className="text-xs font-medium truncate">{s.name}</p>
              {s.deltaPct != null && (
                <span className="shrink-0">
                  <DeltaChip pct={s.deltaPct} />
                </span>
              )}
            </div>
            <Sparkline data={s.series} />
          </div>
        ))}
      </div>
    </SectionCard>
  );
}

function RecencyCard({
  rows,
}: {
  rows: ReturnType<typeof daysSinceLastByMuscle>;
}) {
  return (
    <SectionCard
      title="Días desde la última sesión"
      subtitle="Por grupo muscular"
      info={
        <Info
          what="Cuántos días pasaron desde que entrenaste cada músculo."
          how={
            <>
              Sirve para repartir el volumen y no olvidarte de un grupo, más que
              para medir recuperación. En gris, los grupos sin trabajo
              registrado.
            </>
          }
          method={
            <>
              Un músculo cuenta como entrenado ese día si acumuló al menos 1
              serie ponderada: se toman las series completadas (sin
              calentamiento, sin filtrar por RIR) y cada una cuenta 1 si el
              músculo es el motor principal del ejercicio y 0,5 si es secundario.
              Así dos series de un compuesto ya alcanzan el umbral, pero una
              participación suelta no.{"\n\n"}
              El 0,5 no es una estimación: es el único esquema de conteo que se
              puso a prueba contra los datos y ganó. <Ref id="16" /> Afinarlo más
              por ejercicio implicaría inferir reclutamiento por EMG
              (electromiografía), que no predice hipertrofia. <Ref id="17" />
              {"\n\n"}
              Con volumen igualado la frecuencia por sí sola casi no cambia la
              hipertrofia. <Ref id="16" /> <Ref id="11" />
            </>
          }
        />
      }
    >
      <div className="flex flex-wrap gap-1.5">
        {rows.map((r) => (
          <span
            key={r.muscle}
            className={clsx(
              "inline-flex items-center gap-1.5 rounded-md px-2 py-1 text-xs ring-1",
              r.days == null
                ? "bg-muted/10 text-muted ring-border"
                : clsx(
                    "text-fg",
                    r.days <= 2
                      ? "bg-success/15 ring-success/30"
                      : r.days <= 4
                        ? "bg-warning/15 ring-warning/30"
                        : "bg-danger/15 ring-danger/30",
                  ),
            )}
          >
            {r.days != null && (
              <span
                aria-hidden
                className={clsx(
                  "size-2 rounded-full shrink-0",
                  r.days <= 2
                    ? "bg-success"
                    : r.days <= 4
                      ? "bg-warning"
                      : "bg-danger",
                )}
              />
            )}
            {muscleEs(r.muscle)} ·{" "}
            {r.days == null
              ? "sin trabajo"
              : r.days === 0
                ? "hoy"
                : `${r.days} ${r.days === 1 ? "día" : "días"}`}
          </span>
        ))}
      </div>
      <p className="mt-2.5 text-xs text-muted">
        Verde: ≤2 días · Ámbar: 3–4 · Rojo: 5+
      </p>
    </SectionCard>
  );
}

function RepsCard({ data }: { data: LinePoint[] }) {
  return (
    <SectionCard
      title="Reps por serie"
      subtitle="Promedio semanal"
      info={
        <Info
          what="El promedio de repeticiones por serie en cada semana."
          how="En resistencia, una línea que sube indica que cada serie te rinde más repeticiones."
          method={
            <>
              Para resistencia muscular local, más repeticiones por serie tienen
              un efecto grande. <Ref id="14" />
            </>
          }
        />
      }
    >
      <MiniLine data={data} unit="reps" />
    </SectionCard>
  );
}

function DensityCard({ data }: { data: LinePoint[] }) {
  const last = data[data.length - 1]?.value;
  return (
    <SectionCard
      title="Densidad de sesión"
      subtitle="Reps por minuto · tendencia semanal"
      info={
        <Info
          what="Cuántas repeticiones hacés por minuto de sesión."
          how="Acá el progreso es hacer el mismo trabajo en menos tiempo (más reps por minuto), no levantar más peso. Es el equivalente al 1RM del perfil de fuerza."
        />
      }
    >
      {last != null && (
        <p className="text-2xl font-bold tracking-tight mb-1">
          {fmtNum(last, 1)}{" "}
          <span className="text-sm text-muted font-medium">reps/min</span>
        </p>
      )}
      <MiniLine data={data} unit="reps/min" />
    </SectionCard>
  );
}

function MaxRepsCard({
  rows,
}: {
  rows: ReturnType<typeof maxRepsTest>;
}) {
  return (
    <SectionCard
      title="Test de reps máximas"
      subtitle="Mejor serie · este mes vs el anterior"
      info={
        <Info
          what="Tu mejor serie (máximo de repeticiones) por ejercicio, este mes contra el anterior."
          how="Si el número nuevo es mayor que el anterior, tu resistencia mejoró."
          method={
            <>
              El resultado de resistencia se mide completando el máximo de
              repeticiones con una carga submáxima. Sin un test periódico no hay
              métrica de resultado. <Ref id="13" />
            </>
          }
        />
      }
    >
      <ul className="flex flex-col gap-2">
        {rows.map((r) => {
          const delta = r.current - r.previous;
          return (
            <li key={r.name} className="flex items-center gap-3 text-sm">
              <span className="flex-1 truncate">{r.name}</span>
              {r.previous > 0 && (
                <span className="text-muted text-xs tabular-nums">
                  {r.previous} →
                </span>
              )}
              <span className="font-semibold tabular-nums w-8 text-right">
                {r.current}
              </span>
              {r.previous > 0 && (
                <span
                  className={clsx(
                    "text-xs font-semibold w-8 text-right",
                    delta > 0
                      ? "text-success-fg"
                      : delta < 0
                        ? "text-danger"
                        : "text-muted",
                  )}
                >
                  {delta > 0 ? "+" : ""}
                  {delta}
                </span>
              )}
            </li>
          );
        })}
      </ul>
    </SectionCard>
  );
}

function RestCard({
  avgSec,
  band,
  samples,
}: {
  avgSec: number;
  band: string;
  samples: number;
}) {
  return (
    <SectionCard
      title="Descanso medio entre series"
      subtitle={`Referencia ${band} · ${samples} descansos medidos (30 días)`}
      info={
        <Info
          what="El tiempo promedio que descansás entre series, medido con el cronómetro de descanso."
          how="La banda de referencia es orientativa, no un objetivo: el descanso autoseleccionado rindió igual que uno fijo para hipertrofia. Tiene más sentido en fuerza que en hipertrofia."
          method={
            <>
              El cronómetro arranca cuando tildás una serie y se cierra
              únicamente cuando tocás{" "}
              <span className="text-fg">&ldquo;Comenzar&rdquo;</span> en el
              banner. Nada más lo interrumpe: ni cambiar de ejercicio, ni salir
              de la pantalla, ni cerrar la app.{"\n\n"}
              Si tildás la serie siguiente sin haber tocado el botón, ese
              descanso <span className="text-fg">no se guarda</span>: el intervalo
              incluiría la ejecución de la serie y sobreestimaría el descanso
              20-45 s. Por eso el promedio usa menos series de las que hiciste, y
              el subtítulo dice cuántas. Se ignoran huecos de más de 10 min.{" "}
              <Ref id="5" /> <Ref id="15" />
            </>
          }
        />
      }
    >
      <p className="text-2xl font-bold tracking-tight">
        {formatClock(avgSec)}{" "}
        <span className="text-sm text-muted font-medium">min</span>
      </p>
    </SectionCard>
  );
}

export function RetentionCard({
  r,
}: {
  r: ReturnType<typeof strengthRetentionIndex>;
}) {
  const last = r.series[r.series.length - 1]?.value;
  return (
    <SectionCard
      title="Retención de fuerza"
      subtitle={`${r.name} · índice base 100`}
      info={
        <Info
          what="Tu 1RM (repetición máxima) estimado del ejercicio más frecuente, en índice base 100 respecto del inicio."
          how="En un déficit calórico separa perder grasa de perder músculo: si el peso baja pero tu fuerza se sostiene, vas bien. Una caída de más de 10% sugiere un déficit muy agresivo o poca proteína."
        />
      }
    >
      {last != null && (
        <p className="text-2xl font-bold tracking-tight mb-1">
          {fmtNum(last, 1)}
          <span
            className={clsx(
              "text-sm font-semibold ml-2",
              last >= 100 ? "text-success-fg" : last >= 90 ? "text-muted" : "text-danger",
            )}
          >
            {last >= 90 ? "OK" : "Ojo"}
          </span>
        </p>
      )}
      <MiniLine data={r.series} />
    </SectionCard>
  );
}
