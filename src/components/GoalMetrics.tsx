"use client";

import { Fragment, useMemo, type ReactNode } from "react";
import { SectionCard } from "@/components/ui";
import { MiniLine, MultiLine, Sparkline, StackedBar, HBars } from "@/components/charts";
import { Ref } from "@/components/PaperLink";
import { muscleEs } from "@/lib/i18n-exercise";
import { clsx } from "@/lib/clsx";
import type { TrainingProfile, BodyObjective, Exercise } from "@/lib/types";
import type { HistorySession } from "@/hooks/useHistory";
import {
  e1rmSeriesByExercise,
  intensityZones,
  heavyRirTrend,
  patternFrequency,
  rirBucketsByMuscle,
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
 * (fuerza/hipertrofia/resistencia) + modificador de OBJETIVO corporal (déficit).
 * Los cards `muscleSetsBar`, `constancia` y `retention` los construye registro y
 * los pasa como slots cuando el perfil/objetivo los promueve a portada — así no
 * se duplican en el "fijo abajo".
 */
export function GoalMetrics({
  trainingProfile,
  bodyObjective,
  sessions,
  exMap,
  muscleSetsBar,
  retention,
  constancia,
}: {
  trainingProfile: TrainingProfile | null;
  bodyObjective: BodyObjective | null;
  sessions: HistorySession[];
  exMap: Map<string, Exercise>;
  /** Series efectivas por grupo (MEV/MAV/MRV): a portada en Hipertrofia. */
  muscleSetsBar?: ReactNode;
  /** Retención de fuerza: a portada cuando el objetivo es déficit. */
  retention?: ReactNode;
  /** Constancia (adherencia): a portada cuando el objetivo es déficit. */
  constancia?: ReactNode;
}) {
  const m = useMemo(
    () => ({
      e1rm: e1rmSeriesByExercise(sessions, exMap, 12),
      intensity: intensityZones(sessions, 28),
      heavyRir: heavyRirTrend(sessions, 12),
      patterns: patternFrequency(sessions, exMap, 8),
      rirBuckets: rirBucketsByMuscle(sessions, exMap, 30),
      recency: daysSinceLastByMuscle(sessions, exMap),
      reps: repsPerSetWeekly(sessions, 12),
      density: sessionDensityWeekly(sessions, 12),
      maxReps: maxRepsTest(sessions, exMap, 6),
      rest: avgRestBetweenSets(sessions),
      ready: readinessByMuscle(sessions, exMap),
    }),
    [sessions, exMap],
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
      cards.push(<RestCard avgSec={m.rest.avgSec} band="2-5 min" />);
  } else if (trainingProfile === "hipertrofia") {
    // Series efectivas por grupo (MEV/MAV/MRV) es LA métrica del perfil → arriba.
    if (muscleSetsBar) cards.push(muscleSetsBar);
    if (m.rirBuckets.length) cards.push(<RirBucketsCard rows={m.rirBuckets} />);
    if (m.recency.length) cards.push(<RecencyCard rows={m.recency} />);
    if (m.e1rm.length) cards.push(<SparklineGridCard series={m.e1rm.slice(0, 12)} />);
  } else if (trainingProfile === "resistencia") {
    if (m.maxReps.length) cards.push(<MaxRepsCard rows={m.maxReps} />);
    if (m.reps.length) cards.push(<RepsCard data={m.reps} />);
    if (m.density.length) cards.push(<DensityCard data={m.density} />);
    if (m.rest.avgSec != null)
      cards.push(<RestCard avgSec={m.rest.avgSec} band="30-60 s" />);
  }

  // Modificador déficit (cualquier perfil): distingue perder grasa de músculo.
  if (bodyObjective === "deficit") {
    if (retention) cards.push(retention);
    if (constancia) cards.push(constancia);
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

function ReadyCard({ rows }: { rows: Readiness[] }) {
  return (
    <SectionCard
      title="Listo para entrenar"
      subtitle="Grupos descansados y con volumen bajo"
      info={
        <>
          Ranking propio de &ldquo;qué conviene entrenar hoy&rdquo; por grupo
          muscular. Combina dos señales en un puntaje:{"\n\n"}
          • <span className="text-fg">Recuperación</span> = días desde la última
          vez que lo entrenaste, escalado 0–1 (min(1, días/3): 3+ días = del
          todo recuperado).{"\n"}
          • <span className="text-fg">Rezago de volumen</span> = cuánto te falta
          para el MEV esta semana: (MEV − series efectivas de los últimos 7
          días) / MEV, 0–1. Es lo que muestra la barra.{"\n\n"}
          Puntaje = 0,6 × recuperación + 0,4 × rezago; se muestran los 3 más
          altos.{"\n\n"}
          Los insumos tienen respaldo — recuperación/frecuencia (<Ref id="11" />,{" "}
          <Ref id="12" />) y volumen medido por conteo de series vs MEV
          (<Ref id="1" />, <Ref id="7" />). El compuesto y los pesos 0,6/0,4 son
          una heurística de producto, no un resultado de paper.
        </>
      }
    >
      <ul className="flex flex-col gap-2.5">
        {rows.map((r) => (
          <li key={r.muscle} className="flex items-center gap-3">
            <span className="flex-1 font-medium">{muscleEs(r.muscle)}</span>
            <span className="text-xs text-muted shrink-0">hace {r.days}d</span>
            <div className="w-24 h-2 rounded bg-surface-2 overflow-hidden shrink-0">
              <div
                className="h-full bg-primary"
                style={{ width: `${Math.round(r.lag * 100)}%` }}
                title={`Rezago de volumen ${Math.round(r.lag * 100)}%`}
              />
            </div>
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
        <>
          1RM estimado (Epley) por semana. Normaliza el progreso aunque cambien
          las reps, cosa que el tonelaje no hace. <Ref id="3" />
        </>
      }
    >
      {top?.deltaPct != null && (
        <p className="text-sm mb-2">
          <span className="text-muted">{top.name}:</span>{" "}
          <span
            className={clsx(
              "font-semibold",
              top.deltaPct >= 0 ? "text-success" : "text-danger",
            )}
          >
            {top.deltaPct >= 0 ? "+" : ""}
            {top.deltaPct}%
          </span>{" "}
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
        <>
          Reparto de tus series según el peso ÷ tu 1RM estimado. Las cargas
          pesadas tienen ventaja clara para la fuerza medida por 1RM. <Ref id="4" />
        </>
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
      info="En fuerza la especificidad es por patrón de movimiento (sentadilla / bisagra / empuje / tirón), no por músculo. Sentadilla y bisagra se infieren del músculo primario; empuje/tirón, del tipo de fuerza del ejercicio."
    >
      <HBars rows={rows} unit="/sem" />
    </SectionCard>
  );
}

function HeavyRirCard({ data }: { data: { label: string; value: number }[] }) {
  return (
    <SectionCard
      title="RIR de series pesadas"
      subtitle="Promedio semanal · series >85% 1RM"
      info={
        <>
          Cuán cerca del fallo entrenás en las series pesadas. Los programas
          autorregulados por RIR dieron más fuerza que las cargas fijas por
          %1RM. <Ref id="6" />
        </>
      }
    >
      <MiniLine data={data} unit="RIR" />
    </SectionCard>
  );
}

function RirBucketsCard({
  rows,
}: {
  rows: ReturnType<typeof rirBucketsByMuscle>;
}) {
  return (
    <SectionCard
      title="Proximidad al fallo"
      subtitle="Reparto de series por RIR, por músculo · 30 días"
      info={
        <>
          Para hipertrofia la serie tiene que estar cerca del fallo (ventaja
          pequeña del fallo vs no-fallo). Las series con RIR 4+ inflan el conteo
          sin estimular. Ojo: se subpredicen las reps al fallo; mejora con
          experiencia. <Ref id="8" /> <Ref id="9" /> <Ref id="10" />
        </>
      }
    >
      <div className="flex flex-wrap gap-x-4 gap-y-1 mb-3 text-xs text-muted">
        <span className="inline-flex items-center gap-1.5">
          <span className="size-2 rounded-full bg-danger" />
          RIR 0-1
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span className="size-2 rounded-full bg-success" />
          RIR 2-3
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span className="size-2 rounded-full bg-muted" />
          RIR 4+
        </span>
      </div>
      <div className="flex flex-col gap-1.5">
        {rows.map((r) => {
          const total = r.total || 1;
          return (
            <div key={r.muscle} className="flex items-center gap-2">
              <span className="w-16 shrink-0 text-xs text-muted truncate">
                {muscleEs(r.muscle)}
              </span>
              <div className="flex-1 flex h-2 rounded-full overflow-hidden bg-surface-2">
                {r.b01 > 0 && (
                  <div
                    className="bg-danger"
                    style={{ width: `${(r.b01 / total) * 100}%` }}
                  />
                )}
                {r.b23 > 0 && (
                  <div
                    className="bg-success"
                    style={{ width: `${(r.b23 / total) * 100}%` }}
                  />
                )}
                {r.b4 > 0 && (
                  <div
                    className="bg-muted"
                    style={{ width: `${(r.b4 / total) * 100}%` }}
                  />
                )}
              </div>
            </div>
          );
        })}
      </div>
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
      info="En hipertrofia hay muchos ejercicios; una grilla de mini-gráficos deja ver de un vistazo cuáles progresan y cuáles están estancados."
    >
      <div className="grid grid-cols-2 gap-x-4 gap-y-3">
        {series.map((s) => (
          <div key={s.exId}>
            <div className="flex items-center justify-between gap-2">
              <p className="text-xs font-medium truncate">{s.name}</p>
              {s.deltaPct != null && (
                <span
                  className={clsx(
                    "text-[11px] font-semibold shrink-0",
                    s.deltaPct >= 0 ? "text-success" : "text-danger",
                  )}
                >
                  {s.deltaPct >= 0 ? "▲" : "▼"}
                  {Math.abs(s.deltaPct)}%
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
        <>
          Filtro de recuperación: cuántos días pasaron desde que entrenaste cada
          músculo. Un músculo cuenta como entrenado ese día si acumuló ≥2 sets
          efectivos, contando el trabajo compuesto (primario = 1 set, secundario
          = 0,5 c/u) — así el tríceps en un press cuenta, pero la participación
          incidental no.{"\n\n"}
          Con volumen igualado, la frecuencia por sí sola casi no cambia la
          hipertrofia — esto es para gestionar recuperación. <Ref id="11" />{" "}
          <Ref id="12" />
        </>
      }
    >
      <div className="flex flex-wrap gap-1.5">
        {rows.map((r) => (
          <span
            key={r.muscle}
            className={clsx(
              "inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs ring-1",
              r.days <= 3
                ? "bg-success/15 text-success ring-success/30"
                : r.days <= 6
                  ? "bg-warning/15 text-warning ring-warning/30"
                  : "bg-danger/15 text-danger ring-danger/30",
            )}
          >
            {muscleEs(r.muscle)} · {r.days}d
          </span>
        ))}
      </div>
    </SectionCard>
  );
}

function RepsCard({ data }: { data: { label: string; value: number }[] }) {
  return (
    <SectionCard
      title="Reps por serie"
      subtitle="Promedio semanal"
      info={
        <>
          Para resistencia muscular local, más repeticiones por serie tienen un
          efecto grande. <Ref id="14" />
        </>
      }
    >
      <MiniLine data={data} unit="reps" />
    </SectionCard>
  );
}

function DensityCard({ data }: { data: { label: string; value: number }[] }) {
  const last = data[data.length - 1]?.value;
  return (
    <SectionCard
      title="Densidad de sesión"
      subtitle="Reps por minuto · tendencia semanal"
      info="Acá el progreso es hacer el mismo trabajo en menos tiempo (más reps por minuto), no levantar más peso. Es el equivalente al 1RM del perfil de fuerza."
    >
      {last != null && (
        <p className="text-2xl font-bold tracking-tight mb-1">
          {last} <span className="text-sm text-muted font-medium">reps/min</span>
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
        <>
          El outcome de resistencia se mide completando el máximo de
          repeticiones con una carga submáxima. Sin un test periódico no hay
          métrica de resultado. <Ref id="13" />
        </>
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
                    delta > 0 ? "text-success" : delta < 0 ? "text-danger" : "text-muted",
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

function RestCard({ avgSec, band }: { avgSec: number; band: string }) {
  const min = Math.floor(avgSec / 60);
  const sec = avgSec % 60;
  return (
    <SectionCard
      title="Descanso medio entre series"
      subtitle={`Objetivo ${band}`}
      info={
        <>
          Medido con el cronómetro de descanso: arranca cuando tildás una serie
          y se detiene cuando empezás la siguiente. Promedia el descanso real de
          tus series (se ignoran huecos &gt; 10 min). <Ref id="5" />
        </>
      }
    >
      <p className="text-2xl font-bold tracking-tight">
        {min}:{String(sec).padStart(2, "0")}{" "}
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
      info="En un déficit, separa perder grasa de perder músculo: si el peso baja pero tu fuerza (1RM estimado del ejercicio más frecuente) se sostiene, vas bien. Una caída >10% sugiere un déficit muy agresivo o poca proteína."
    >
      {last != null && (
        <p className="text-2xl font-bold tracking-tight mb-1">
          {last}
          <span
            className={clsx(
              "text-sm font-semibold ml-2",
              last >= 100 ? "text-success" : last >= 90 ? "text-muted" : "text-danger",
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
