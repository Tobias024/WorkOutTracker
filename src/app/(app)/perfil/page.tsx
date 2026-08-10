"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, Dumbbell, TrendingUp, Timer } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { Button, Input, Spinner, Tabs } from "@/components/ui";
import { bmi, bmiCategory, dateKey } from "@/lib/metrics";
import { useAddMeasurement } from "@/hooks/useBodyData";
import { goalFromPrefs } from "@/hooks/useGoal";
import { useTheme, type Theme } from "@/hooks/useTheme";
import { clsx } from "@/lib/clsx";
import type { Sex, TrainingProfile } from "@/lib/types";

const PROFILES: { value: TrainingProfile; label: string; icon: typeof Dumbbell }[] = [
  { value: "fuerza", label: "Fuerza", icon: Dumbbell },
  { value: "hipertrofia", label: "Hipertrofia", icon: TrendingUp },
  { value: "resistencia", label: "Resistencia", icon: Timer },
];

export default function PerfilPage() {
  const router = useRouter();
  const qc = useQueryClient();
  const supabase = createClient();
  const [displayName, setDisplayName] = useState("");
  const [sex, setSex] = useState<Sex | null>(null);
  const [trainingProfile, setTrainingProfile] = useState<TrainingProfile | null>(null);
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
        .select("display_name, sex, training_profile, height_cm, weight_kg")
        .eq("id", user.id)
        .maybeSingle();
      setDisplayName(data?.display_name ?? "");
      setSex(data?.sex ?? null);
      setTrainingProfile((data?.training_profile as TrainingProfile | null) ?? null);
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
        training_profile: trainingProfile,
        // `goal` (deprecado) se mantiene sincronizado para el scoreboard.
        goal: goalFromPrefs({ trainingProfile }),
        height_cm: heightNum,
        weight_kg: weightNum,
      })
      .eq("id", user.id);

    setLoading(false);
    if (error) {
      setError(error.message);
      return;
    }
    qc.invalidateQueries({ queryKey: ["training-profile"] });
    qc.invalidateQueries({ queryKey: ["goal"] });
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
          <label className="text-sm text-muted">Perfil de entrenamiento</label>
          <p className="text-xs text-muted -mt-1">
            Cambia qué métricas de entrenamiento se priorizan en Registro.
          </p>
          <div className="grid grid-cols-3 gap-3">
            {PROFILES.map((g) => (
              <GoalButton
                key={g.value}
                icon={g.icon}
                label={g.label}
                active={trainingProfile === g.value}
                onClick={() =>
                  setTrainingProfile(trainingProfile === g.value ? null : g.value)
                }
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

      <MeasurementsForm />

      <ThemeSection />
    </div>
  );
}

/** Preferencia de paleta (local, por dispositivo). No pasa por Supabase. */
function ThemeSection() {
  const { theme, setTheme } = useTheme();
  return (
    <div className="card p-6 flex flex-col gap-3 mt-4">
      <div>
        <h2 className="font-semibold">Apariencia</h2>
        <p className="text-xs text-muted mt-0.5">
          Elegí la paleta de colores. Se guarda en este dispositivo.
        </p>
      </div>
      <Tabs<Theme>
        value={theme}
        onChange={setTheme}
        options={[
          { value: "classic", label: "Clásico" },
          { value: "girly", label: "Floral 🌺" },
        ]}
      />
    </div>
  );
}

function MeasurementsForm() {
  const add = useAddMeasurement();
  const [v, setV] = useState({ arm: "", chest: "", waist: "", thigh: "", bf: "" });
  const [saved, setSaved] = useState(false);
  const num = (x: string) => (x === "" ? null : Number(x));
  const empty =
    !v.arm && !v.chest && !v.waist && !v.thigh && !v.bf;

  async function save() {
    if (empty) return;
    await add.mutateAsync({
      measured_on: dateKey(new Date().toISOString()),
      arm_cm: num(v.arm),
      chest_cm: num(v.chest),
      waist_cm: num(v.waist),
      thigh_cm: num(v.thigh),
      bodyfat_pct: num(v.bf),
    });
    setV({ arm: "", chest: "", waist: "", thigh: "", bf: "" });
    setSaved(true);
  }

  const field = (key: keyof typeof v, label: string) => (
    <label className="flex flex-col gap-1 text-sm text-muted">
      {label}
      <Input
        type="number"
        inputMode="decimal"
        value={v[key]}
        onChange={(e) => {
          setV((s) => ({ ...s, [key]: e.target.value }));
          setSaved(false);
        }}
      />
    </label>
  );

  return (
    <div className="card p-6 flex flex-col gap-4 mt-4">
      <div>
        <h2 className="font-semibold">Medidas corporales</h2>
        <p className="text-xs text-muted mt-0.5">
          Cargalas cada tanto (mensual). Alimentan las métricas de circunferencias
          y cintura.
        </p>
      </div>
      <div className="grid grid-cols-2 gap-3">
        {field("arm", "Brazo (cm)")}
        {field("chest", "Pecho (cm)")}
        {field("waist", "Cintura (cm)")}
        {field("thigh", "Muslo (cm)")}
        {field("bf", "% graso")}
      </div>
      <Button onClick={save} loading={add.isPending} disabled={empty}>
        {saved ? "Guardada ✓" : "Guardar medida de hoy"}
      </Button>
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
        "flex flex-col items-center justify-center gap-1.5 rounded-lg px-2 py-3 ring-1 transition text-center",
        active
          ? "bg-primary/15 ring-primary text-fg"
          : "bg-surface-2 ring-border text-muted hover:text-fg",
      )}
    >
      <Icon className={clsx("size-5 shrink-0", active && "text-primary")} />
      <span className="text-[13px] font-medium leading-tight">{label}</span>
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
