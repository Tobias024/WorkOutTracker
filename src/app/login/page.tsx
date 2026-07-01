"use client";

import { Suspense, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Dumbbell } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { Button, Input } from "@/components/ui";

const AUTH_ERROR_ES: Record<string, string> = {
  "Invalid login credentials": "Mail o contraseña incorrectos.",
  "User already registered": "Ya existe una cuenta con ese mail. Iniciá sesión.",
  "Password should be at least 6 characters.":
    "La contraseña tiene que tener al menos 6 caracteres.",
};

function translateError(message: string) {
  return AUTH_ERROR_ES[message] ?? message;
}

function LoginForm() {
  const params = useSearchParams();
  const router = useRouter();
  const next = params.get("next") ?? "/rutinas";
  const [mode, setMode] = useState<"password" | "magic">("password");
  const [isSignup, setIsSignup] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [sent, setSent] = useState(false);
  const [loading, setLoading] = useState<
    "password" | "signup" | "magic" | "google" | null
  >(null);
  const [error, setError] = useState<string | null>(params.get("error"));

  const siteUrl =
    process.env.NEXT_PUBLIC_SITE_URL ??
    (typeof window !== "undefined" ? window.location.origin : "");

  async function submitPassword(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    const supabase = createClient();

    if (isSignup) {
      setLoading("signup");
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          emailRedirectTo: `${siteUrl}/auth/callback?next=${encodeURIComponent(next)}`,
        },
      });
      setLoading(null);
      if (error) {
        setError(translateError(error.message));
        return;
      }
      if (data.session) {
        router.replace(next);
      } else {
        setSent(true);
      }
      return;
    }

    setLoading("password");
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    setLoading(null);
    if (error) {
      setError(translateError(error.message));
      return;
    }
    router.replace(next);
  }

  async function sendMagicLink(e: React.FormEvent) {
    e.preventDefault();
    setLoading("magic");
    setError(null);
    const supabase = createClient();
    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: {
        emailRedirectTo: `${siteUrl}/auth/callback?next=${encodeURIComponent(next)}`,
      },
    });
    setLoading(null);
    if (error) setError(translateError(error.message));
    else setSent(true);
  }

  async function signInGoogle() {
    setLoading("google");
    setError(null);
    const supabase = createClient();
    const { error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: `${siteUrl}/auth/callback?next=${encodeURIComponent(next)}`,
      },
    });
    if (error) {
      setLoading(null);
      setError(translateError(error.message));
    }
  }

  return (
    <main className="min-h-dvh flex flex-col items-center justify-center px-6">
      <div className="w-full max-w-sm">
        <div className="flex flex-col items-center gap-3 mb-8">
          <div className="size-14 rounded-lg bg-primary/15 grid place-items-center">
            <Dumbbell className="size-7 text-primary" />
          </div>
          <div className="text-center">
            <h1 className="text-2xl font-bold">WorkOut Tracker</h1>
            <p className="text-sm text-muted mt-1">
              Rutinas, registro y ranking con amigos.
            </p>
          </div>
        </div>

        {sent ? (
          <div className="card p-6 text-center">
            <p className="font-medium">Revisá tu mail ✉️</p>
            <p className="text-sm text-muted mt-2">
              Te enviamos un link a <strong>{email}</strong>.
            </p>
          </div>
        ) : (
          <div className="card p-6 flex flex-col gap-4">
            {mode === "password" ? (
              <form onSubmit={submitPassword} className="flex flex-col gap-3">
                <Input
                  type="email"
                  required
                  placeholder="tu@email.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                />
                <Input
                  type="password"
                  required
                  minLength={6}
                  placeholder="Contraseña"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                />
                <Button
                  type="submit"
                  loading={loading === "password" || loading === "signup"}
                >
                  {isSignup ? "Crear cuenta" : "Iniciar sesión"}
                </Button>
                <button
                  type="button"
                  onClick={() => {
                    setIsSignup((v) => !v);
                    setError(null);
                  }}
                  className="text-xs text-muted hover:text-fg text-center"
                >
                  {isSignup
                    ? "¿Ya tenés cuenta? Iniciá sesión"
                    : "¿No tenés cuenta? Creá una"}
                </button>
              </form>
            ) : (
              <form onSubmit={sendMagicLink} className="flex flex-col gap-3">
                <Input
                  type="email"
                  required
                  placeholder="tu@email.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                />
                <Button type="submit" loading={loading === "magic"}>
                  Enviar link de acceso
                </Button>
              </form>
            )}

            <button
              type="button"
              onClick={() => {
                setMode((m) => (m === "password" ? "magic" : "password"));
                setError(null);
              }}
              className="text-xs text-muted hover:text-fg text-center"
            >
              {mode === "password"
                ? "Prefiero un link mágico por mail"
                : "Prefiero usar contraseña"}
            </button>

            <div className="flex items-center gap-3 text-xs text-muted">
              <div className="h-px flex-1 bg-border" />o<div className="h-px flex-1 bg-border" />
            </div>

            <Button
              variant="secondary"
              onClick={signInGoogle}
              loading={loading === "google"}
            >
              Continuar con Google
            </Button>

            {error && <p className="text-sm text-danger text-center">{error}</p>}
          </div>
        )}
      </div>
    </main>
  );
}

export default function LoginPage() {
  return (
    <Suspense>
      <LoginForm />
    </Suspense>
  );
}
