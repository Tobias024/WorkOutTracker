// SPDX-License-Identifier: AGPL-3.0-only
"use client";

import { useMemo, useState } from "react";
import dynamic from "next/dynamic";
import { ArrowDown, ArrowUp, Minus } from "lucide-react";
import { SectionCard, Button, Field } from "@/components/ui";
import { Ref } from "@/components/PaperLink";

// recharts se carga recién cuando hay un gráfico para mostrar.
const MiniLine = dynamic(
  () => import("@/components/charts-entry").then((m) => m.MiniLine),
  { ssr: false, loading: () => <div className="h-[170px] animate-pulse rounded-lg bg-surface-2" /> },
);
const MiniLineSmall = dynamic(
  () => import("@/components/charts-entry").then((m) => m.MiniLine),
  { ssr: false, loading: () => <div className="h-[80px] animate-pulse rounded-lg bg-surface-2" /> },
);
import { dateKey } from "@/lib/metrics";
import { clsx } from "@/lib/clsx";
import { fmtNum } from "@/lib/format";
import type { HistorySession } from "@/hooks/useHistory";
import {
  useSleep,
  useLogSleep,
  useMeasurements,
  useBodyWeight,
  useLogBodyWeight,
} from "@/hooks/useBodyData";
import {
  sleepSeries,
  measurementSeries,
  bodyWeightTrend,
} from "@/lib/metrics-goal";

/**
 * "Avances corporales": peso, sueño y medidas. Igual para todos los objetivos
 * (no depende del goal), separado de las métricas de entrenamiento.
 */
export function BodyProgress({ sessions }: { sessions: HistorySession[] }) {
  return (
    <div className="flex flex-col gap-5">
      <WeightCard sessions={sessions} />
      <SleepCard />
      <MeasurementsCard />
    </div>
  );
}

const INPUT_CLS =
  "h-11 w-full min-w-0 rounded bg-surface-2 px-3 text-base outline-none ring-1 ring-border focus:ring-primary aria-[invalid=true]:ring-danger";

const DAY_INITIAL = ["D", "L", "M", "X", "J", "V", "S"];

function localKey(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

// ── Peso (registro diario, tipo Sueño) ───────────────────────────────────────

function WeightCard({ sessions }: { sessions: HistorySession[] }) {
  const { data: logs } = useBodyWeight();
  const log = useLogBodyWeight();
  const [kg, setKg] = useState("");
  const [editing, setEditing] = useState(false);
  const bw = useMemo(() => bodyWeightTrend(logs ?? [], sessions, 120), [logs, sessions]);
  const rate = bw.ratePctPerWeek;
  const weightKg = kg === "" ? null : Number(kg.replace(",", "."));
  const validWeight = weightKg != null && weightKg >= 25 && weightKg <= 400;
  const todayKey = dateKey(new Date().toISOString());
  const todayLog = (logs ?? []).find((l) => l.weighed_on === todayKey);
  const showForm = !todayLog || editing;
  // La tasa va neutra: subir de peso es bueno o malo según el objetivo, y este
  // componente no recibe el perfil. Solo informa dirección y magnitud.
  const RateIcon = rate == null ? null : rate > 0.1 ? ArrowUp : rate < -0.1 ? ArrowDown : Minus;
  return (
    <SectionCard
      title="Peso corporal"
      subtitle="Registrá tu peso · media móvil 7 días"
      info={
        <>
          <p className="font-semibold text-fg">Qué es</p>
          <p className="mb-3">
            La línea es el promedio móvil de 7 días; los puntos tenues son las
            mediciones crudas, que tienen ruido de agua y glucógeno de ±1-2 kg.
          </p>
          <p className="font-semibold text-fg">Cómo leerlo</p>
          <p className="mb-3">
            El número accionable es la tasa de cambio por semana, no el peso de
            un día. Registralo a diario, entrenes o no.
          </p>
          <details>
            <summary className="cursor-pointer min-h-11 flex items-center text-fg font-medium">
              Metodología y fuentes
            </summary>
            <p className="pb-2">
              La tasa es la pendiente (mínimos cuadrados) de la línea de promedio
              móvil sobre los últimos 28 días, expresada como % del nivel actual
              por semana. No se muestra tasa si hay menos de 4 mediciones en esos
              28 días o menos de 10 días entre la primera y la última: con menos
              que eso la pendiente es ruido.
            </p>
          </details>
        </>
      }
    >
      <p className="text-2xl font-bold tracking-tight mb-1">
        {bw.last != null ? `${fmtNum(bw.last, 1)} kg` : "—"}
        {rate != null && RateIcon && (
          <span className="inline-flex items-center gap-0.5 text-sm font-semibold ml-2 text-fg">
            <RateIcon className="size-3.5" strokeWidth={3} aria-hidden />
            {fmtNum(Math.abs(rate), 2)} %/sem
          </span>
        )}
      </p>
      {bw.points.length >= 2 ? (
        <MiniLine
          data={bw.ma}
          faint={bw.points}
          unit="kg"
          domain={["dataMin - 1", "dataMax + 1"]}
        />
      ) : (
        <p className="text-sm text-muted">
          Registrá tu peso unos días para ver la tendencia.
        </p>
      )}
      {showForm ? (
        <form
          className="mt-3"
          onSubmit={(e) => {
            e.preventDefault();
            if (weightKg == null || !validWeight) return;
            log.mutate(
              { weighedOn: todayKey, weightKg },
              {
                // Recién al confirmarse se limpia: si falla, el valor sigue ahí.
                onSuccess: () => {
                  setKg("");
                  setEditing(false);
                },
              },
            );
          }}
        >
          <div className="flex items-end gap-2">
            <Field
              label="Peso de hoy (kg)"
              className="flex-1 min-w-0"
              error={
                kg !== "" && !validWeight ? "Ingresá un peso entre 25 y 400 kg." : null
              }
            >
              <input
                type="number"
                inputMode="decimal"
                step={0.1}
                min={25}
                max={400}
                placeholder="Ej: 82,4"
                value={kg}
                onChange={(e) => setKg(e.target.value)}
                className={INPUT_CLS}
              />
            </Field>
            <Button
              type="submit"
              size="md"
              loading={log.isPending}
              disabled={!validWeight}
            >
              Registrar
            </Button>
          </div>
          {log.isError && (
            <p role="alert" className="text-xs text-danger mt-1.5">
              No se pudo guardar el peso. Probá de nuevo.
            </p>
          )}
        </form>
      ) : (
        <div className="flex items-center justify-between gap-2 mt-3 text-sm">
          <span>Hoy: {fmtNum(Number(todayLog.weight_kg), 1)} kg</span>
          <Button
            variant="ghost"
            size="md"
            onClick={() => {
              setKg(String(todayLog.weight_kg));
              setEditing(true);
            }}
          >
            Editar
          </Button>
        </div>
      )}
    </SectionCard>
  );
}

// ── Sueño (registro diario) ──────────────────────────────────────────────────

const SLEEP_DAYS = 14;
const SLEEP_GOAL = 7;

function SleepCard() {
  const { data: sleep } = useSleep();
  const log = useLogSleep();
  const [hours, setHours] = useState("");
  const [editing, setEditing] = useState(false);
  const rows = sleep ?? [];
  const s = sleepSeries(rows, SLEEP_DAYS);
  const max = Math.max(9, ...rows.map((r) => r.hours));
  const h = hours === "" ? null : Number(hours.replace(",", "."));
  const validHours = h != null && Number.isFinite(h) && h >= 0 && h <= 16;
  const now = new Date();
  const todayKey = localKey(now);
  const todayLog = rows.find((r) => r.slept_on === todayKey);
  const showForm = !todayLog || editing;

  // Calendario completo de 14 días: los días sin dato son un hueco explícito,
  // no una barra de 0 h.
  const byDay = new Map(rows.map((r) => [r.slept_on, r.hours]));
  const days = Array.from({ length: SLEEP_DAYS }, (_, i) => {
    const d = new Date(now);
    d.setDate(d.getDate() - (SLEEP_DAYS - 1 - i));
    return { key: localKey(d), initial: DAY_INITIAL[d.getDay()], hours: byDay.get(localKey(d)) };
  });
  const logged = days.filter((d) => d.hours != null);
  const under = logged.filter((d) => (d.hours as number) < SLEEP_GOAL).length;
  const summary =
    s.avg != null
      ? `Promedio ${fmtNum(s.avg, 1)} h; ${under} ${under === 1 ? "noche" : "noches"} bajo ${SLEEP_GOAL} h`
      : "Sin noches registradas";

  return (
    <SectionCard
      title="Sueño"
      subtitle={`Últimas 2 semanas · objetivo ${SLEEP_GOAL} h`}
      info={
        <>
          <p className="font-semibold text-fg">Qué es</p>
          <p className="mb-3">
            Las horas que dormiste cada noche en las últimas 2 semanas. Las
            barras ámbar son noches por debajo de {SLEEP_GOAL} h; los huecos
            punteados son días sin registro.
          </p>
          <p className="font-semibold text-fg">Cómo leerlo</p>
          <p className="mb-3">
            Importa el patrón, no una noche suelta: varias barras ámbar seguidas
            son la señal para priorizar el descanso.
          </p>
          <details>
            <summary className="cursor-pointer min-h-11 flex items-center text-fg font-medium">
              Metodología y fuentes
            </summary>
            <p className="pb-2">
              La restricción de sueño interfiere con las adaptaciones al
              entrenamiento. Es barato de registrar y de alto impacto.{" "}
              <Ref id="2" />
            </p>
          </details>
        </>
      }
    >
      {logged.length > 0 ? (
        <div role="img" aria-label={summary}>
          <div className="relative h-28 flex items-end gap-1">
            <div
              className="absolute inset-x-0 border-t border-dashed border-border"
              style={{ bottom: `${(SLEEP_GOAL / max) * 100}%` }}
            >
              <span className="absolute right-0 -top-4 bg-surface px-0.5 text-2xs text-muted">
                {SLEEP_GOAL} h
              </span>
            </div>
            {days.map((d) => (
              <div
                key={d.key}
                className="flex-1 h-full flex flex-col items-center justify-end"
              >
                {d.hours != null ? (
                  <div
                    className={clsx(
                      "w-full rounded-t",
                      d.hours < SLEEP_GOAL ? "bg-warning" : "bg-primary/70",
                    )}
                    style={{ height: `${(d.hours / max) * 100}%` }}
                  />
                ) : (
                  <div className="w-full h-3 rounded-t border border-dashed border-border" />
                )}
              </div>
            ))}
          </div>
          <div className="flex gap-1 mt-1" aria-hidden>
            {days.map((d) => (
              <span key={d.key} className="flex-1 text-center text-2xs text-muted">
                {d.initial}
              </span>
            ))}
          </div>
        </div>
      ) : (
        <p className="text-sm text-muted">Todavía no registraste sueño.</p>
      )}
      {s.avg != null && (
        <p className="text-xs text-muted mt-2">Promedio: {fmtNum(s.avg, 1)} h</p>
      )}
      {showForm ? (
        <form
          className="mt-3"
          onSubmit={(e) => {
            e.preventDefault();
            if (h == null || !validHours) return;
            log.mutate(
              { sleptOn: todayKey, hours: h },
              {
                onSuccess: () => {
                  setHours("");
                  setEditing(false);
                },
              },
            );
          }}
        >
          <div className="flex items-end gap-2">
            <Field
              label="Horas dormidas anoche"
              className="flex-1 min-w-0"
              error={
                hours !== "" && !validHours ? "Ingresá entre 0 y 16 horas." : null
              }
            >
              <input
                type="number"
                inputMode="decimal"
                step={0.5}
                min={0}
                max={16}
                placeholder="Ej: 7,5"
                value={hours}
                onChange={(e) => setHours(e.target.value)}
                className={INPUT_CLS}
              />
            </Field>
            <Button
              type="submit"
              size="md"
              loading={log.isPending}
              disabled={!validHours}
            >
              Registrar
            </Button>
          </div>
          {log.isError && (
            <p role="alert" className="text-xs text-danger mt-1.5">
              No se pudo guardar el sueño. Probá de nuevo.
            </p>
          )}
        </form>
      ) : (
        <div className="flex items-center justify-between gap-2 mt-3 text-sm">
          <span>Hoy: {fmtNum(todayLog.hours, 1)} h</span>
          <Button
            variant="ghost"
            size="md"
            onClick={() => {
              setHours(String(todayLog.hours));
              setEditing(true);
            }}
          >
            Editar
          </Button>
        </div>
      )}
    </SectionCard>
  );
}

// ── Medidas (circunferencias; se cargan en Perfil) ───────────────────────────

function MeasurementsCard() {
  const { data: measurements } = useMeasurements();
  const series = measurementSeries(measurements ?? []);
  return (
    <SectionCard
      title="Circunferencias"
      subtitle="cm · por medición"
      info={
        <>
          <p className="font-semibold text-fg">Qué es</p>
          <p className="mb-3">
            Una mini gráfica por medida (brazo, pecho, cintura, muslo), cada una
            con su propia escala.
          </p>
          <p className="font-semibold text-fg">Cómo leerlo</p>
          <p className="mb-3">
            Todo lo demás mide el estímulo; esto mide el resultado. La cintura
            desacopla el cambio de composición del de peso: puede bajar aunque la
            balanza no se mueva. Cargá tus medidas en Perfil, idealmente una vez
            por mes.
          </p>
        </>
      }
    >
      {series.length > 0 ? (
        // Small multiples: brazo (~35 cm) y pecho (~100 cm) en un mismo eje
        // aplastarían las variaciones de 1 cm.
        <div className="grid grid-cols-2 gap-x-4 gap-y-3">
          {series.map((s) => {
            const last = s.points[s.points.length - 1]?.value;
            return (
              <div key={s.name} className="min-w-0">
                <p className="text-xs text-muted truncate">{s.name}</p>
                <p className="text-sm font-semibold tabular-nums">
                  {last != null ? `${fmtNum(last, 1)} cm` : "—"}
                </p>
                {s.points.length >= 2 ? (
                  <MiniLineSmall
                    data={s.points}
                    height={80}
                    unit="cm"
                    compact
                    domain={["dataMin - 1", "dataMax + 1"]}
                  />
                ) : (
                  <p className="text-xs text-muted mt-1">Una sola medición</p>
                )}
              </div>
            );
          })}
        </div>
      ) : (
        <p className="text-sm text-muted">
          Cargá tus medidas en Perfil para ver la evolución.
        </p>
      )}
    </SectionCard>
  );
}
