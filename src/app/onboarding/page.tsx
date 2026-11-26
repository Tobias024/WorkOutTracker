// SPDX-License-Identifier: AGPL-3.0-only
"use client";

import { Suspense, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { nanoid } from "nanoid";
import { createClient } from "@/lib/supabase/client";
import { safeNext } from "@/lib/safe-next";
import { Button, Field, FieldGroup, Input, Spinner } from "@/components/ui";
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
  // useSearchParams exige Suspense en el árbol.
  return (
    <Suspense>
      <OnboardingForm />
    </Suspense>
  );
}

function OnboardingForm() {
  const router = useRouter();
  // Destino original (invitación, rutina compartida) que el onboarding interrumpió.
  const dest = safeNext(useSearchParams().get("next"));
  const supabase = createClient();
  const [displayName, setDisplayName] = useState("");
  const [sex, setSex] = useState<Sex | null>(null);
  const [loading, setLoading] = useState(false);
  const [checking, setChecking] = useState(true);
  const [email, setEmail] = useState("");
  const [errors, setErrors] = useState<{
    name?: string;
    sex?: string;
    form?: string;
  }>({});

  useEffect(() => {
    (async () => {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      const user = session?.user;
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
        router.replace(dest);
        return;
      }
      setEmail(user.email ?? "");
      setDisplayName(data?.display_name ?? "");
      setChecking(false);
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function signOut() {
    await supabase.auth.signOut();
    router.replace("/login");
  }

  async function save(e: React.FormEvent) {
    e.preventDefault();
    const name = displayName.trim();
    const next: typeof errors = {};
    if (name.length < 2) next.name = "Tu nombre tiene que tener al menos 2 letras.";
    if (!sex) next.sex = "Elegí una categoría para el ranking.";
    setErrors(next);
    if (next.name || next.sex) return;

    setLoading(true);
    const {
      data: { session },
    } = await supabase.auth.getSession();
    const user = session?.user;
    if (!user) {
      // Sin sesión no se puede guardar: se vuelve al login en vez de dejar el
      // botón girando para siempre.
      setLoading(false);
      router.replace("/login");
      return;
    }

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
        // El nuevo JWT trae app_metadata.onboarded; si falla, el layout tiene
        // fallback a profiles.
        try {
          await supabase.auth.refreshSession();
        } catch {
          // ignorar
        }
        router.replace(dest);
        return;
      }
      lastError = error;
      if (error.code !== "23505") break;
    }

    setLoading(false);
    // Nunca el mensaje crudo de Postgres (inglés y técnico).
    setErrors({
      form: lastError
        ? "No pudimos guardar tu perfil. Probá de nuevo."
        : undefined,
    });
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
          <Field label="Nombre" error={errors.name}>
            <Input
              placeholder="Tu nombre"
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              autoComplete="given-name"
              maxLength={30}
              autoFocus
            />
          </Field>

          <FieldGroup
            label="Categoría del ranking"
            hint="Lo usamos para separar el ranking por categoría. Podés cambiarlo en tu perfil."
            error={errors.sex}
          >
            <div role="radiogroup" className="grid grid-cols-2 gap-3">
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
          </FieldGroup>

          <Button type="submit" loading={loading} className="mt-1">
            Empezar
          </Button>
          {errors.form && (
            <p role="alert" className="text-sm text-danger">
              {errors.form}
            </p>
          )}
        </form>
        <Button
          variant="ghost"
          className="w-full mt-3 h-auto min-h-11 py-2 whitespace-normal break-all"
          onClick={signOut}
        >
          No soy {email} · Cerrar sesión
        </Button>
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
      role="radio"
      aria-checked={active}
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
