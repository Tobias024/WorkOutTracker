"use client";

import { Suspense, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Button, Input } from "@/components/ui";

const AUTH_ERROR_ES: Record<string, string> = {
  "Invalid login credentials": "Mail o contraseña incorrectos.",
  "User already registered": "Ya existe una cuenta con ese mail. Iniciá sesión.",
  "Password should be at least 6 characters.":
    "La contraseña tiene que tener al menos 6 caracteres.",
  "Email rate limit exceeded":
    "Se enviaron demasiados mails a esta dirección. Esperá unos minutos y volvé a intentar.",
  "email rate limit exceeded":
    "Se enviaron demasiados mails a esta dirección. Esperá unos minutos y volvé a intentar.",
};

function translateError(message: string) {
  if (AUTH_ERROR_ES[message]) return AUTH_ERROR_ES[message];
  if (/rate limit exceeded/i.test(message)) {
    return "Se enviaron demasiados mails a esta dirección. Esperá unos minutos y volvé a intentar.";
  }
  const cooldown = message.match(/after (\d+) seconds/i);
  if (cooldown) {
    return `Por seguridad, esperá ${cooldown[1]} segundos antes de volver a pedir el mail.`;
  }
  return message;
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
    "password" | "signup" | "magic" | "reset" | null
  >(null);
  const rawError = params.get("error");
  const [error, setError] = useState<string | null>(
    rawError ? translateError(rawError) : null,
  );

  // Para los redirects de auth usamos siempre el dominio donde está parado el
  // usuario (no NEXT_PUBLIC_SITE_URL): así el link de vuelta matchea el dominio
  // real aunque esa env var quede mal seteada.
  const siteUrl =
    typeof window !== "undefined" ? window.location.origin : "";

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

  async function sendPasswordReset() {
    if (!email) {
      setError("Escribí tu mail primero.");
      return;
    }
    setLoading("reset");
    setError(null);
    const supabase = createClient();
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${siteUrl}/auth/callback?next=${encodeURIComponent("/auth/reset-password")}`,
    });
    setLoading(null);
    if (error) setError(translateError(error.message));
    else setSent(true);
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

  return (
    <main className="min-h-dvh flex flex-col items-center justify-center px-6">
      <div className="w-full max-w-sm">
        <div className="flex flex-col items-center gap-3 mb-8">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/logo.png"
            alt="WorkOut Tracker"
            width={64}
            height={64}
            className="size-16"
          />
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
                {!isSignup && (
                  <button
                    type="button"
                    onClick={sendPasswordReset}
                    disabled={loading === "reset"}
                    className="text-xs text-muted hover:text-fg text-center disabled:opacity-50"
                  >
                    ¿Olvidaste tu contraseña?
                  </button>
                )}
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
