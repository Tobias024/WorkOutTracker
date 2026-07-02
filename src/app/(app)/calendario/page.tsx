"use client";

import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { PageHeader, Spinner, Stat } from "@/components/ui";
import { createClient } from "@/lib/supabase/client";
import { useCompliance } from "@/hooks/useCompliance";
import { dateKey } from "@/lib/metrics";
import { clsx } from "@/lib/clsx";

function useScheduledWeekdays() {
  return useQuery({
    queryKey: ["routine-schedule", "all"],
    queryFn: async (): Promise<Set<number>> => {
      const supabase = createClient();
      const { data, error } = await supabase
        .from("routine_schedule")
        .select("weekday");
      if (error) throw error;
      return new Set((data ?? []).map((r) => r.weekday));
    },
  });
}

function useSessionDaysInRange(from: Date, to: Date) {
  const fromKey = dateKey(from.toISOString());
  const toKey = dateKey(to.toISOString());
  return useQuery({
    queryKey: ["session-days", fromKey, toKey],
    queryFn: async (): Promise<Set<string>> => {
      const supabase = createClient();
      const { data, error } = await supabase
        .from("workout_sessions")
        .select("created_at")
        .gte("created_at", from.toISOString())
        .lte("created_at", to.toISOString());
      if (error) throw error;
      return new Set((data ?? []).map((s) => dateKey(s.created_at)));
    },
  });
}

export default function CalendarioPage() {
  const now = useMemo(() => new Date(), []);
  const monthStart = useMemo(
    () => new Date(now.getFullYear(), now.getMonth(), 1),
    [now],
  );
  const monthEnd = useMemo(
    () => new Date(now.getFullYear(), now.getMonth() + 1, 0),
    [now],
  );

  const { data: pct, isLoading: loadingPct } = useCompliance(
    monthStart,
    monthEnd,
  );
  const { data: scheduled, isLoading: loadingScheduled } =
    useScheduledWeekdays();
  const { data: sessionDays, isLoading: loadingDays } = useSessionDaysInRange(
    monthStart,
    monthEnd,
  );

  const isLoading = loadingPct || loadingScheduled || loadingDays;

  const days = useMemo(() => {
    const total = monthEnd.getDate();
    const todayKey = dateKey(now.toISOString());
    const list: {
      date: Date;
      planned: boolean;
      completed: boolean;
      isPast: boolean;
    }[] = [];
    for (let d = 1; d <= total; d++) {
      const date = new Date(now.getFullYear(), now.getMonth(), d);
      const planned = scheduled?.has(date.getDay()) ?? false;
      const completed = sessionDays?.has(dateKey(date.toISOString())) ?? false;
      const isPast = dateKey(date.toISOString()) <= todayKey;
      list.push({ date, planned, completed, isPast });
    }
    return list;
  }, [now, monthEnd, scheduled, sessionDays]);

  const leadingBlanks = monthStart.getDay(); // domingo=0

  return (
    <div>
      <PageHeader title="Calendario" subtitle="Tu plan semanal" />

      {isLoading ? (
        <div className="grid place-items-center py-16">
          <Spinner />
        </div>
      ) : (
        <div className="flex flex-col gap-4">
          <Stat
            label="Cumplimiento este mes"
            value={`${pct?.pct ?? 0}%`}
          />

          <div className="card p-4">
            <div className="grid grid-cols-7 gap-1.5 text-center text-xs text-muted mb-2">
              {["D", "L", "M", "M", "J", "V", "S"].map((d, i) => (
                <span key={i}>{d}</span>
              ))}
            </div>
            <div className="grid grid-cols-7 gap-1.5">
              {Array.from({ length: leadingBlanks }).map((_, i) => (
                <div key={`blank-${i}`} />
              ))}
              {days.map(({ date, planned, completed, isPast }) => (
                <div
                  key={date.toISOString()}
                  className={clsx(
                    "aspect-square rounded-md grid place-items-center text-xs font-medium",
                    !planned && "bg-surface-2 text-muted",
                    planned && completed && "bg-success/20 text-success",
                    planned && !completed && isPast && "bg-danger/20 text-danger",
                    planned && !completed && !isPast && "ring-1 ring-primary/40 text-fg",
                  )}
                >
                  {date.getDate()}
                </div>
              ))}
            </div>
            <div className="flex items-center gap-4 mt-3 text-xs text-muted">
              <span className="flex items-center gap-1.5">
                <span className="size-2.5 rounded-sm bg-success/40" /> Cumplido
              </span>
              <span className="flex items-center gap-1.5">
                <span className="size-2.5 rounded-sm bg-danger/40" /> Planificado
              </span>
              <span className="flex items-center gap-1.5">
                <span className="size-2.5 rounded-sm bg-surface-2" /> Sin plan
              </span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
