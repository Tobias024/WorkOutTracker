"use client";

import { useState } from "react";
import { SectionCard, Button } from "@/components/ui";
import { MiniLine, MultiLine } from "@/components/charts";
import { Ref } from "@/components/PaperLink";
import { dateKey } from "@/lib/metrics";
import { clsx } from "@/lib/clsx";
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

// ── Peso (registro diario, tipo Sueño) ───────────────────────────────────────

function WeightCard({ sessions }: { sessions: HistorySession[] }) {
  const { data: logs } = useBodyWeight();
  const log = useLogBodyWeight();
  const [kg, setKg] = useState("");
  const bw = bodyWeightTrend(logs ?? [], sessions, 120);
  const rate = bw.ratePctPerWeek;
  return (
    <SectionCard
      title="Peso corporal"
      subtitle="Registrá tu peso · media móvil 7 días"
      info="La línea es el promedio móvil de 7 días (los puntos tenues son las mediciones crudas, que tienen ruido de agua/glucógeno de ±1-2 kg). El número accionable es la tasa de cambio por semana, no el peso de un día. Registralo a diario, entrenes o no."
    >
      <p className="text-2xl font-bold tracking-tight mb-1">
        {bw.last != null ? `${bw.last} kg` : "—"}
        {rate != null && (
          <span
            className={clsx(
              "text-sm font-semibold ml-2",
              rate > 0.1 ? "text-danger" : rate < -0.1 ? "text-success" : "text-muted",
            )}
          >
            {rate > 0 ? "+" : ""}
            {rate}%/sem
          </span>
        )}
      </p>
      {bw.points.length >= 2 ? (
        <MiniLine data={bw.ma} faint={bw.points} unit="kg" />
      ) : (
        <p className="text-sm text-muted">
          Registrá tu peso unos días para ver la tendencia.
        </p>
      )}
      <div className="flex items-center gap-2 mt-3">
        <input
          type="number"
          inputMode="decimal"
          step={0.1}
          placeholder="Peso hoy (kg)"
          value={kg}
          onChange={(e) => setKg(e.target.value)}
          className="h-9 flex-1 min-w-0 rounded bg-surface-2 px-2 text-sm outline-none ring-1 ring-border focus:ring-primary"
        />
        <Button
          size="sm"
          loading={log.isPending}
          disabled={!kg}
          onClick={() => {
            log.mutate({
              weighedOn: dateKey(new Date().toISOString()),
              weightKg: Number(kg),
            });
            setKg("");
          }}
        >
          Registrar
        </Button>
      </div>
    </SectionCard>
  );
}

// ── Sueño (registro diario) ──────────────────────────────────────────────────

function SleepCard() {
  const { data: sleep } = useSleep();
  const log = useLogSleep();
  const [hours, setHours] = useState("");
  const s = sleepSeries(sleep ?? [], 14);
  const max = Math.max(9, ...s.points.map((p) => p.value));
  return (
    <SectionCard
      title="Sueño"
      subtitle="Últimas 2 semanas · objetivo 7 h"
      info={
        <>
          La restricción de sueño interfiere con las adaptaciones al
          entrenamiento. Barato de registrar, alto impacto. <Ref id="2" />
        </>
      }
    >
      {s.points.length > 0 ? (
        <div className="relative h-28 flex items-end gap-1">
          <div
            className="absolute inset-x-0 border-t border-dashed border-border"
            style={{ bottom: `${(7 / max) * 100}%` }}
          />
          {s.points.map((p, i) => (
            <div
              key={i}
              className="flex-1 h-full flex flex-col items-center justify-end"
            >
              <div
                className="w-full rounded-t bg-primary/70"
                style={{ height: `${(p.value / max) * 100}%` }}
                title={`${p.value} h`}
              />
            </div>
          ))}
        </div>
      ) : (
        <p className="text-sm text-muted">Todavía no registraste sueño.</p>
      )}
      <div className="flex items-center gap-2 mt-3">
        <input
          type="number"
          inputMode="decimal"
          step={0.5}
          placeholder="Horas anoche"
          value={hours}
          onChange={(e) => setHours(e.target.value)}
          className="h-9 flex-1 min-w-0 rounded bg-surface-2 px-2 text-sm outline-none ring-1 ring-border focus:ring-primary"
        />
        <Button
          size="sm"
          loading={log.isPending}
          disabled={!hours}
          onClick={() => {
            log.mutate({
              sleptOn: dateKey(new Date().toISOString()),
              hours: Number(hours),
            });
            setHours("");
          }}
        >
          Registrar
        </Button>
      </div>
      {s.avg != null && (
        <p className="text-xs text-muted mt-2">Promedio: {s.avg} h</p>
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
      info="Todo lo demás mide el estímulo; esto mide el resultado. La cintura desacopla el cambio de composición del de peso: puede bajar aunque la balanza no se mueva. Cargá tus medidas en Perfil (idealmente una vez por mes)."
    >
      {series.length > 0 ? (
        <MultiLine series={series} unit="cm" />
      ) : (
        <p className="text-sm text-muted">
          Cargá tus medidas en Perfil para ver la evolución.
        </p>
      )}
    </SectionCard>
  );
}
