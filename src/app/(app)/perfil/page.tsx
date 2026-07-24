"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, Dumbbell, TrendingUp, Timer, TrendingDown } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { Button, Input, Spinner } from "@/components/ui";
import { bmi, bmiCategory } from "@/lib/metrics";
import { clsx } from "@/lib/clsx";
import type { Sex, Goal } from "@/lib/types";

const GOALS: { value: Goal; label: string; icon: typeof Dumbbell }[] = [
  { value: "fuerza", label: "Fuerza", icon: Dumbbell },
  { value: "hipertrofia", label: "Hipertrofia", icon: TrendingUp },
  { value: "resistencia", label: "Resistencia", icon: Timer },
  { value: "perdida_grasa", label: "Pérdida de grasa", icon: TrendingDown },
];

export default function PerfilPage() {
  const router = useRouter();
  const supabase = createClient();
  const [displayName, setDisplayName] = useState("");
  const [sex, setSex] = useState<Sex | null>(null);
  const [goal, setGoal] = useState<Goal | null>(null);
  const [heightCm, setHeightCm] = useState("");
  const [weightKg, setWeightKg] = useState("");
  const [loading, setLoading] = useState(false);
  const [checking, setChecking] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) {
        router.replace("/login");
        return;
      }
      const { data } = await supabase
        .from("profiles")
        .select("display_name, sex, goal, height_cm, weight_kg")
        .eq("id", user.id)
        .maybeSingle();
      setDisplayName(data?.display_name ?? "");
      setSex(data?.sex ?? null);
      setGoal((data?.goal as Goal | null) ?? null);
      setHeightCm(data?.height_cm != null ? String(data.height_cm) : "");
      setWeightKg(data?.weight_kg != null ? String(data.weight_kg) : "");
      setChecking(false);
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const heightNum = heightCm ? Number(heightCm) : null;
  const weightNum = weightKg ? Number(weightKg) : null;
  const currentBmi =
    heightNum && weightNum ? bmi(heightNum, weightNum) : null;

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    const name = displayName.trim();
    if (name.length < 2) {
      setError("Escribí tu nombre.");
      return;
    }
    setLoading(true);
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return;

    const { error } = await supabase
      .from("profiles")
      .update({
        display_name: name,
        sex,
        goal,
        height_cm: heightNum,
        weight_kg: weightNum,
      })
      .eq("id", user.id);

    setLoading(false);
    if (error) {
      setError(error.message);
      return;
    }
    router.push("/scoreboard");
  }

  if (checking) {
    return (
      <main className="min-h-dvh grid place-items-center">
        <Spinner />
      </main>
    );
  }

  return (
    <div>
      <div className="flex items-center gap-2 mb-4">
        <button
          onClick={() => router.push("/scoreboard")}
          className="text-muted hover:text-fg"
        >
          <ArrowLeft className="size-5" />
        </button>
        <h1 className="text-xl font-bold">Mi perfil</h1>
      </div>

      <form onSubmit={save} className="card p-6 flex flex-col gap-4">
        <div className="flex flex-col gap-2">
          <label className="text-sm text-muted">Nombre</label>
          <Input
            placeholder="Tu nombre"
            value={displayName}
            onChange={(e) => setDisplayName(e.target.value)}
          />
        </div>

        <div className="flex flex-col gap-2">
          <label className="text-sm text-muted">Sexo</label>
          <div className="grid grid-cols-2 gap-3">
            <SexButton
              symbol="♂"
              label="Masculino"
              active={sex === "male"}
              onClick={() => setSex("male")}
            />
            <SexButton
              symbol="♀"
              label="Femenino"
              active={sex === "female"}
              onClick={() => setSex("female")}
            />
          </div>
        </div>

        <div className="flex flex-col gap-2">
          <label className="text-sm text-muted">Objetivo</label>
          <p className="text-xs text-muted -mt-1">
            Cambia qué métricas se muestran primero en Registro.
          </p>
          <div className="grid grid-cols-2 gap-3">
            {GOALS.map((g) => (
              <GoalButton
                key={g.value}
                icon={g.icon}
                label={g.label}
                active={goal === g.value}
                onClick={() => setGoal(goal === g.value ? null : g.value)}
              />
            ))}
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div className="flex flex-col gap-2">
            <label className="text-sm text-muted">Altura (cm)</label>
            <Input
              type="number"
              inputMode="decimal"
              placeholder="175"
              value={heightCm}
              onChange={(e) => setHeightCm(e.target.value)}
            />
          </div>
          <div className="flex flex-col gap-2">
            <label className="text-sm text-muted">Peso (kg)</label>
            <Input
              type="number"
              inputMode="decimal"
              placeholder="70"
              value={weightKg}
              onChange={(e) => setWeightKg(e.target.value)}
            />
          </div>
        </div>

        {currentBmi && (
          <div className="card bg-surface-2 p-3 text-center">
            <p className="text-xs text-muted">Índice de masa corporal</p>
            <p className="text-lg font-semibold">
              {currentBmi.toFixed(1)}{" "}
              <span className="text-sm text-muted font-normal">
                ({bmiCategory(currentBmi)})
              </span>
            </p>
          </div>
        )}

        <Button type="submit" loading={loading} className="mt-1">
          Guardar
        </Button>
        {error && <p className="text-sm text-danger">{error}</p>}
      </form>
    </div>
  );
}

function GoalButton({
  icon: Icon,
  label,
  active,
  onClick,
}: {
  icon: typeof Dumbbell;
  label: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={clsx(
        "flex items-center gap-2.5 rounded-lg px-3 py-3 ring-1 transition text-left",
        active
          ? "bg-primary/15 ring-primary text-fg"
          : "bg-surface-2 ring-border text-muted hover:text-fg",
      )}
    >
      <Icon className={clsx("size-5 shrink-0", active && "text-primary")} />
      <span className="text-sm font-medium">{label}</span>
    </button>
  );
}

function SexButton({
  symbol,
  label,
  active,
  onClick,
}: {
  symbol: string;
  label: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={clsx(
        "flex flex-col items-center justify-center gap-1 rounded-lg py-4 ring-1 transition",
        active
          ? "bg-primary/15 ring-primary text-fg"
          : "bg-surface-2 ring-border text-muted hover:text-fg",
      )}
    >
      <span
        className={clsx(
          "text-3xl leading-none",
          active ? "text-primary" : "text-muted",
        )}
      >
        {symbol}
      </span>
      <span className="text-sm font-medium">{label}</span>
    </button>
  );
}
