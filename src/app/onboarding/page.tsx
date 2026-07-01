"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { nanoid } from "nanoid";
import { createClient } from "@/lib/supabase/client";
import { Button, Input, Spinner } from "@/components/ui";
import { clsx } from "@/lib/clsx";

type Sex = "male" | "female";

/** Genera un handle único a partir del nombre (oculto para el usuario). */
function makeUsername(name: string): string {
  const base =
    name
      .toLowerCase()
      .normalize("NFD")
      .replace(/[̀-ͯ]/g, "")
      .replace(/[^a-z0-9]/g, "")
      .slice(0, 12) || "atleta";
  return `${base}_${nanoid(6).toLowerCase().replace(/[^a-z0-9]/g, "")}`;
}

export default function OnboardingPage() {
  const router = useRouter();
  const supabase = createClient();
  const [displayName, setDisplayName] = useState("");
  const [sex, setSex] = useState<Sex | null>(null);
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
        .select("username, display_name")
        .eq("id", user.id)
        .maybeSingle();
      if (data?.username) {
        router.replace("/rutinas");
        return;
      }
      setDisplayName(data?.display_name ?? "");
      setChecking(false);
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    const name = displayName.trim();
    if (name.length < 2) {
      setError("Escribí tu nombre.");
      return;
    }
    if (!sex) {
      setError("Elegí una opción.");
      return;
    }
    setLoading(true);
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return;

    // Reintenta si el username autogenerado colisiona (muy improbable).
    let lastError: { code?: string; message: string } | null = null;
    for (let i = 0; i < 3; i++) {
      const { error } = await supabase.from("profiles").upsert({
        id: user.id,
        username: makeUsername(name),
        display_name: name,
        sex,
      });
      if (!error) {
        router.replace("/rutinas");
        return;
      }
      lastError = error;
      if (error.code !== "23505") break;
    }

    setLoading(false);
    setError(lastError?.message ?? "No se pudo guardar. Probá de nuevo.");
  }

  if (checking) {
    return (
      <main className="min-h-dvh grid place-items-center">
        <Spinner />
      </main>
    );
  }

  return (
    <main className="min-h-dvh flex flex-col items-center justify-center px-6">
      <div className="w-full max-w-sm">
        <h1 className="text-2xl font-bold mb-1">¿Cómo te llamás?</h1>
        <p className="text-sm text-muted mb-6">
          Así te van a ver tus amigos en el ranking.
        </p>
        <form onSubmit={save} className="card p-6 flex flex-col gap-4">
          <div className="flex flex-col gap-2">
            <label className="text-sm text-muted">Nombre</label>
            <Input
              placeholder="Tu nombre"
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              autoFocus
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

          <Button type="submit" loading={loading} className="mt-1">
            Empezar
          </Button>
          {error && <p className="text-sm text-danger">{error}</p>}
        </form>
      </div>
    </main>
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
