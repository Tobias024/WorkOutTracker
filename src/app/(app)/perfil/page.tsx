// SPDX-License-Identifier: AGPL-3.0-only
"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useQueryClient } from "@tanstack/react-query";
import { ChevronRight, Sparkles, Users } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import {
  Button,
  ConfirmDialog,
  ErrorState,
  Field,
  FieldGroup,
  Input,
  Modal,
  Skeleton,
  Switch,
  Tabs,
} from "@/components/ui";
import { FriendsPanel } from "@/components/FriendsPanel";
import { NotificationToggle } from "@/components/NotificationToggle";
import { bmi, bmiCategory, dateKey } from "@/lib/metrics";
import { fmtNum } from "@/lib/format";
import { CURRENT_VERSION } from "@/lib/changelog";
import { useAddMeasurement } from "@/hooks/useBodyData";
import { useFriends } from "@/hooks/useFriends";
import { useColorblind } from "@/hooks/useColorblind";
import { goalFromPrefs } from "@/hooks/useGoal";
import { useTheme, type Theme } from "@/hooks/useTheme";
import { clsx } from "@/lib/clsx";
import type { Sex, TrainingProfile } from "@/lib/types";

const PROFILES: { value: TrainingProfile | null; label: string }[] = [
  { value: "fuerza", label: "Fuerza" },
  { value: "hipertrofia", label: "Hipertrofia" },
  { value: "resistencia", label: "Resistencia" },
  { value: null, label: "Sin objetivo" },
];

const HEIGHT_RANGE = { min: 100, max: 250 };
const WEIGHT_RANGE = { min: 30, max: 300 };

/** Error de rango sólo si hay valor: vacío es válido (el dato es opcional). */
function rangeError(
  raw: string,
  { min, max }: { min: number; max: number },
  unit: string,
): string | null {
  if (raw === "") return null;
  const n = Number(raw);
  if (!Number.isFinite(n) || n < min || n > max)
    return `Ingresá un valor entre ${min} y ${max} ${unit}.`;
  return null;
}

export default function PerfilPage() {
  const router = useRouter();
  const qc = useQueryClient();
  const supabase = createClient();
  const [email, setEmail] = useState("");
  const [savedName, setSavedName] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [sex, setSex] = useState<Sex | null>(null);
  const [trainingProfile, setTrainingProfile] = useState<TrainingProfile | null>(null);
  const [heightCm, setHeightCm] = useState("");
  const [weightKg, setWeightKg] = useState("");
  const [loading, setLoading] = useState(false);
  const [saved, setSaved] = useState(false);
  const [checking, setChecking] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [loadError, setLoadError] = useState(false);

  const [friendsOpen, setFriendsOpen] = useState(false);
  const [logoutOpen, setLogoutOpen] = useState(false);
  const [loggingOut, setLoggingOut] = useState(false);
  const [logoutError, setLogoutError] = useState<string | null>(null);

  const friends = useFriends();

  async function loadProfile() {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      router.replace("/login");
      return;
    }
    setEmail(user.email ?? "");
    const { data, error } = await supabase
      .from("profiles")
      .select("display_name, sex, training_profile, height_cm, weight_kg")
      .eq("id", user.id)
      .maybeSingle();
    if (error) {
      // No mostramos el form vacío: guardar pisaría los datos con null.
      setLoadError(true);
      setChecking(false);
      return;
    }
    setDisplayName(data?.display_name ?? "");
    setSavedName(data?.display_name ?? "");
    setSex(data?.sex ?? null);
    setTrainingProfile((data?.training_profile as TrainingProfile | null) ?? null);
    setHeightCm(data?.height_cm != null ? String(data.height_cm) : "");
    setWeightKg(data?.weight_kg != null ? String(data.weight_kg) : "");
    setChecking(false);
  }

  useEffect(() => {
    (async () => {
      await loadProfile();
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const heightNum = heightCm ? Number(heightCm) : null;
  const weightNum = weightKg ? Number(weightKg) : null;
  const heightError = rangeError(heightCm, HEIGHT_RANGE, "cm");
  const weightError = rangeError(weightKg, WEIGHT_RANGE, "kg");
  const currentBmi =
    heightNum && weightNum && !heightError && !weightError
      ? bmi(heightNum, weightNum)
      : null;

  /** Cualquier cambio vuelve el botón a "Guardar". */
  function edit<T>(setter: (v: T) => void) {
    return (v: T) => {
      setter(v);
      setSaved(false);
    };
  }

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    const name = displayName.trim();
    if (name.length < 2) {
      setError("Escribí tu nombre.");
      return;
    }
    if (heightError || weightError) {
      setError("Revisá los datos marcados antes de guardar.");
      return;
    }
    setLoading(true);
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) {
        router.replace("/login");
        return;
      }

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

      if (error) {
        setError(error.message);
        return;
      }
      qc.invalidateQueries({ queryKey: ["training-profile"] });
      qc.invalidateQueries({ queryKey: ["goal"] });
      setSavedName(name);
      // Se queda en Perfil (ahora es un tab): confirma en el botón.
      setSaved(true);
    } catch {
      setError("No se pudo guardar. Probá de nuevo.");
    } finally {
      setLoading(false);
    }
  }

  async function logout() {
    setLogoutError(null);
    setLoggingOut(true);
    try {
      const { error } = await supabase.auth.signOut();
      if (error) throw error;
      // Recarga completa y no router.push: así no queda en memoria la caché
      // (rutinas, historial, amigos) del usuario que se fue, ni el candado
      // de sesión activa, si otra persona entra en el mismo teléfono.
      try {
        localStorage.removeItem("wot-active-session");
        localStorage.removeItem("wot-rest");
      } catch {}
      window.location.replace("/login");
    } catch {
      setLogoutError("No se pudo cerrar la sesión. Probá de nuevo.");
      setLoggingOut(false);
    }
  }

  if (checking) {
    return (
      <div className="flex flex-col gap-4" aria-busy>
        <Skeleton className="h-16" />
        <Skeleton className="h-72" />
        <Skeleton className="h-40" />
      </div>
    );
  }

  if (loadError) {
    return (
      <ErrorState
        title="No pudimos cargar tu perfil"
        description="Revisá tu conexión. No se cambió nada."
        onRetry={() => {
          setLoadError(false);
          setChecking(true);
          loadProfile();
        }}
      />
    );
  }

  const shownName = savedName || email.split("@")[0] || "Tu perfil";
  const friendCount = friends.data?.length;

  return (
    <div className="flex flex-col gap-4">
      {/* Cabecera de cuenta */}
      <div className="flex items-center gap-4">
        <div
          aria-hidden
          className="size-16 shrink-0 rounded-full bg-primary/15 grid place-items-center text-2xl font-bold text-primary uppercase"
        >
          {shownName.slice(0, 1)}
        </div>
        <div className="min-w-0">
          <h1 className="text-2xl font-bold tracking-tight truncate">{shownName}</h1>
          {email && <p className="text-sm text-muted truncate">{email}</p>}
        </div>
      </div>

      {/* Cuenta */}
      <form onSubmit={save} className="card p-4 flex flex-col gap-4" noValidate>
        <h2 className="font-semibold">Cuenta</h2>

        <Field label="Nombre">
          <Input
            placeholder="Tu nombre"
            autoComplete="name"
            value={displayName}
            onChange={(e) => edit(setDisplayName)(e.target.value)}
          />
        </Field>

        <FieldGroup label="Sexo">
          <div role="radiogroup" className="grid grid-cols-2 gap-3">
            <ChoiceButton
              name="sex"
              symbol="♂"
              label="Masculino"
              active={sex === "male"}
              onSelect={() => edit(setSex)("male")}
            />
            <ChoiceButton
              name="sex"
              symbol="♀"
              label="Femenino"
              active={sex === "female"}
              onSelect={() => edit(setSex)("female")}
            />
          </div>
        </FieldGroup>

        <FieldGroup
          label="Perfil de entrenamiento"
          hint="Cambia qué métricas de entrenamiento se priorizan en Registro."
        >
          <div role="radiogroup" className="grid grid-cols-2 gap-2">
            {PROFILES.map((g) => (
              <ChoiceButton
                key={g.label}
                name="training-profile"
                label={g.label}
                active={trainingProfile === g.value}
                onSelect={() => edit(setTrainingProfile)(g.value)}
              />
            ))}
          </div>
        </FieldGroup>

        <div className="grid grid-cols-2 gap-3">
          <Field label="Altura (cm)" error={heightError}>
            <Input
              type="number"
              inputMode="decimal"
              placeholder="175"
              min={HEIGHT_RANGE.min}
              max={HEIGHT_RANGE.max}
              value={heightCm}
              onChange={(e) => edit(setHeightCm)(e.target.value)}
            />
          </Field>
          <Field label="Peso (kg)" error={weightError}>
            <Input
              type="number"
              inputMode="decimal"
              placeholder="70"
              min={WEIGHT_RANGE.min}
              max={WEIGHT_RANGE.max}
              value={weightKg}
              onChange={(e) => edit(setWeightKg)(e.target.value)}
            />
          </Field>
        </div>

        {currentBmi && (
          <div className="rounded-md bg-surface-2 p-3 text-center">
            <p className="text-xs text-muted">Índice de masa corporal</p>
            <p className="text-lg font-semibold">
              {fmtNum(currentBmi, 1)}{" "}
              <span className="text-sm text-muted font-normal">
                ({bmiCategory(currentBmi)})
              </span>
            </p>
          </div>
        )}

        <Button type="submit" loading={loading}>
          {saved ? "Guardado ✓" : "Guardar"}
        </Button>
        {error && (
          <p role="alert" className="text-sm text-danger">
            {error}
          </p>
        )}
      </form>

      <MeasurementsForm />

      {/* Social */}
      <section className="card p-4">
        <h2 className="font-semibold mb-1">Social</h2>
        <button
          type="button"
          onClick={() => setFriendsOpen(true)}
          aria-haspopup="dialog"
          className="min-h-11 w-full flex items-center gap-3 text-left rounded-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
        >
          <Users className="size-5 text-muted shrink-0" />
          <span className="flex-1 text-sm">Amigos</span>
          {friendCount != null && (
            <span className="text-sm text-muted tabular-nums">{friendCount}</span>
          )}
          <ChevronRight className="size-4 text-muted shrink-0" />
        </button>
      </section>

      {/* Preferencias */}
      <section className="card p-4 flex flex-col gap-4">
        <h2 className="font-semibold">Preferencias</h2>
        <ThemeSection />
        <ColorblindSwitch />
        <NotificationToggle />
      </section>

      {/* Novedades */}
      <section className="card p-4">
        <h2 className="font-semibold mb-1">Novedades</h2>
        <Link
          href="/novedades"
          className="min-h-11 flex items-center gap-3 rounded-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
        >
          <Sparkles className="size-5 text-muted shrink-0" />
          <span className="flex-1 text-sm">Qué hay de nuevo</span>
          <span className="text-sm text-muted">v{CURRENT_VERSION}</span>
          <ChevronRight className="size-4 text-muted shrink-0" />
        </Link>
      </section>

      {/* Sesión */}
      <section className="card p-4">
        <h2 className="font-semibold mb-2">Sesión</h2>
        <Button
          variant="ghost"
          className="w-full text-danger hover:text-danger"
          onClick={() => {
            setLogoutError(null);
            setLogoutOpen(true);
          }}
        >
          Cerrar sesión
        </Button>
      </section>

      <SourceNotice />

      <Modal open={friendsOpen} onClose={() => setFriendsOpen(false)} title="Amigos">
        <FriendsPanel />
      </Modal>

      <ConfirmDialog
        open={logoutOpen}
        title="¿Cerrar sesión?"
        description="Vas a tener que volver a ingresar para usar WOLF."
        confirmLabel="Cerrar sesión"
        loading={loggingOut}
        error={logoutError}
        onConfirm={logout}
        onCancel={() => setLogoutOpen(false)}
      />
    </div>
  );
}

/**
 * Aviso de la AGPL §13 (cláusula de red): al ofrecer el programa a través de una
 * red hay que dar a sus usuarios acceso al fuente. Un link visible es la forma
 * estándar de cumplirlo en una webapp.
 */
function SourceNotice() {
  return (
    <p className="mt-2 text-center text-xs text-muted">
      Software libre bajo{" "}
      <a
        href="https://www.gnu.org/licenses/agpl-3.0.html"
        target="_blank"
        rel="noreferrer noopener"
        className="underline hover:text-fg"
      >
        AGPL-3.0
      </a>
      .{" "}
      <a
        href="https://github.com/Tobias024/WorkOutTracker"
        target="_blank"
        rel="noreferrer noopener"
        className="underline hover:text-fg"
      >
        Código fuente
      </a>
      .
    </p>
  );
}

/** Preferencia de paleta (local, por dispositivo). No pasa por Supabase. */
function ThemeSection() {
  const { theme, setTheme } = useTheme();
  return (
    <div>
      <p className="text-sm text-fg">Apariencia</p>
      <p className="text-xs text-muted mt-0.5 mb-2">
        Elegí la paleta de colores. Se guarda en este dispositivo.
      </p>
      <Tabs<Theme>
        ariaLabel="Apariencia"
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

function ColorblindSwitch() {
  const { colorblind, setColorblind } = useColorblind();
  return (
    <Switch
      checked={colorblind}
      onChange={setColorblind}
      label="Modo daltónico"
      description="Cambia el verde por celeste para distinguir mejor subidas y bajadas"
    />
  );
}

function MeasurementsForm() {
  const add = useAddMeasurement();
  const [v, setV] = useState({ arm: "", chest: "", waist: "", thigh: "", bf: "" });
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const num = (x: string) => (x === "" ? null : Number(x));
  const empty = !v.arm && !v.chest && !v.waist && !v.thigh && !v.bf;

  async function save() {
    if (empty) return;
    setError(null);
    try {
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
    } catch {
      setError("No se pudo guardar la medida. Probá de nuevo.");
    }
  }

  const field = (key: keyof typeof v, label: string) => (
    <Field label={label}>
      <Input
        type="number"
        inputMode="decimal"
        value={v[key]}
        onChange={(e) => {
          setV((s) => ({ ...s, [key]: e.target.value }));
          setSaved(false);
        }}
      />
    </Field>
  );

  return (
    <section className="card p-4 flex flex-col gap-4">
      <div>
        <h2 className="font-semibold">Medidas</h2>
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
      <Button
        variant="secondary"
        onClick={save}
        loading={add.isPending}
        disabled={empty}
      >
        {saved ? "Guardada ✓" : "Guardar medida de hoy"}
      </Button>
      {error && (
        <p role="alert" className="text-sm text-danger">
          {error}
        </p>
      )}
    </section>
  );
}

/**
 * Opción de un grupo de radios nativos: el input real va oculto (sr-only) y la
 * etiqueta hace de botón. Así el grupo hereda flechas y anuncio del lector.
 */
function ChoiceButton({
  name,
  symbol,
  label,
  active,
  onSelect,
}: {
  name: string;
  symbol?: string;
  label: string;
  active: boolean;
  onSelect: () => void;
}) {
  return (
    <label
      className={clsx(
        "min-h-11 flex cursor-pointer items-center justify-center gap-2 rounded-lg px-3 py-2.5 ring-1 transition text-center has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-primary",
        active
          ? "bg-primary/15 ring-primary text-fg"
          : "bg-surface-2 ring-border text-muted hover:text-fg",
      )}
    >
      <input
        type="radio"
        name={name}
        checked={active}
        onChange={onSelect}
        className="sr-only"
      />
      {symbol && (
        <span
          aria-hidden
          className={clsx("text-2xl leading-none", active ? "text-primary" : "text-muted")}
        >
          {symbol}
        </span>
      )}
      <span className="text-sm font-medium leading-tight">{label}</span>
    </label>
  );
}
