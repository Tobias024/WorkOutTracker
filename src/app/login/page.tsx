// SPDX-License-Identifier: AGPL-3.0-only
"use client";

import { Suspense, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { safeNext } from "@/lib/safe-next";
import { translateError } from "@/lib/auth-errors";
import { createClient } from "@/lib/supabase/client";
import { Button, Field, Input, Tabs } from "@/components/ui";
import { PasswordInput } from "@/components/PasswordInput";

type View = "signin" | "signup" | "magic" | "forgot";
type Sent = "magic" | "signup" | "reset" | null;

const EMAIL_ID = "login-email";

/** Props comunes del campo de mail (teclado de mail, sin autocorrección). */
const EMAIL_PROPS = {
  id: EMAIL_ID,
  type: "email",
  autoComplete: "email",
  autoCapitalize: "none",
  autoCorrect: "off",
  inputMode: "email",
  placeholder: "tu@email.com",
} as const;

const SENT_COPY: Record<Exclude<Sent, null>, string> = {
  signup: "Confirmá tu cuenta desde el mail que te mandamos a",
  magic: "Te mandamos un link para entrar a",
  reset: "Te mandamos un link para cambiar tu contraseña a",
};

function LoginForm() {
  const params = useSearchParams();
  const router = useRouter();
  const next = safeNext(params.get("next"));
  const [view, setView] = useState<View>(
    params.get("mode") === "signup" ? "signup" : "signin",
  );
  const isSignup = view === "signup";
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [sent, setSent] = useState<Sent>(null);
  const [loading, setLoading] = useState<
    "password" | "signup" | "magic" | "reset" | "resend" | null
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

  function changeView(v: View) {
    setView(v);
    setError(null);
  }

  function focusEmail() {
    document.getElementById(EMAIL_ID)?.focus();
  }

  /** Manda el mail según el motivo. Devuelve el error ya traducido o null. */
  async function sendMail(kind: Exclude<Sent, null>): Promise<string | null> {
    const supabase = createClient();
    const callback = `${siteUrl}/auth/callback?next=${encodeURIComponent(next)}`;
    if (kind === "magic") {
      const { error } = await supabase.auth.signInWithOtp({
        email,
        options: { emailRedirectTo: callback },
      });
      return error ? translateError(error.message) : null;
    }
    if (kind === "signup") {
      const { error } = await supabase.auth.resend({
        type: "signup",
        email,
        options: { emailRedirectTo: callback },
      });
      return error ? translateError(error.message) : null;
    }
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${siteUrl}/auth/callback?next=${encodeURIComponent("/auth/reset-password")}`,
    });
    return error ? translateError(error.message) : null;
  }

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
        setSent("signup");
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

  async function submitReset(e: React.FormEvent) {
    e.preventDefault();
    if (!email.trim()) {
      setError("Escribí tu mail primero.");
      focusEmail();
      return;
    }
    setLoading("reset");
    setError(null);
    const err = await sendMail("reset");
    setLoading(null);
    if (err) setError(err);
    else setSent("reset");
  }

  async function sendMagicLink(e: React.FormEvent) {
    e.preventDefault();
    setLoading("magic");
    setError(null);
    const err = await sendMail("magic");
    setLoading(null);
    if (err) setError(err);
    else setSent("magic");
  }

  async function resend() {
    if (!sent) return;
    setLoading("resend");
    setError(null);
    const err = await sendMail(sent);
    setLoading(null);
    if (err) setError(err);
  }

  function useOtherEmail() {
    setSent(null);
    setError(null);
  }

  const titles: Record<View, { h: string; sub: string }> = {
    signin: { h: "Iniciá sesión", sub: "Entrá con tu mail y tu contraseña." },
    signup: {
      h: "Creá tu cuenta",
      sub: "Es gratis y lleva un minuto.",
    },
    magic: {
      h: "Entrá con un link por mail",
      sub: "Te mandamos un link para entrar sin contraseña.",
    },
    forgot: {
      h: "Recuperar contraseña",
      sub: "Te mandamos un link para elegir una contraseña nueva.",
    },
  };

  const errorNode = error && (
    <p role="alert" className="text-sm text-danger text-center">
      {error}
    </p>
  );

  return (
    <main className="min-h-dvh flex flex-col items-center justify-center px-6">
      <div className="w-full max-w-sm">
        <div className="flex flex-col items-center gap-3 mb-8">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/logo.png"
            alt="WOLF"
            width={72}
            height={72}
            className="size-20"
          />
          <div className="text-center">
            <h1 className="text-2xl font-bold tracking-wide">WOLF</h1>
            <p className="text-sm text-muted mt-1">
              <span className="text-primary font-semibold">W</span>ork
              <span className="text-primary font-semibold">O</span>ut,{" "}
              <span className="text-primary font-semibold">L</span>ogs &amp;{" "}
              <span className="text-primary font-semibold">F</span>riends
            </p>
            <p className="text-xs text-muted mt-1">
              Rutinas, registro y ranking con amigos.
            </p>
          </div>
        </div>
        {sent ? (
          <div className="card p-6 text-center flex flex-col gap-3">
            <p className="font-medium">Revisá tu mail ✉️</p>
            <p className="text-sm text-muted">
              {SENT_COPY[sent]} <strong className="text-fg break-all">{email}</strong>.
            </p>
            <p className="text-sm text-muted">Si no lo ves, revisá spam.</p>
            <Button
              variant="secondary"
              loading={loading === "resend"}
              onClick={resend}
            >
              Reenviar mail
            </Button>
            {errorNode}
            <Button variant="ghost" onClick={useOtherEmail}>
              Usar otro mail
            </Button>
          </div>
        ) : (
          <div className="flex flex-col gap-4">
            {view !== "forgot" && (
              <Tabs
                ariaLabel="Entrar o crear cuenta"
                value={isSignup ? "signup" : "signin"}
                onChange={(v) => changeView(v)}
                options={[
                  { value: "signin", label: "Entrar" },
                  { value: "signup", label: "Crear cuenta" },
                ]}
              />
            )}
            <div className="card p-6 flex flex-col gap-4">
              <div>
                <h2 className="text-lg font-semibold">{titles[view].h}</h2>
                <p className="text-sm text-muted mt-1">{titles[view].sub}</p>
              </div>

              {(view === "signin" || view === "signup") && (
                <form onSubmit={submitPassword} className="flex flex-col gap-3">
                  <Field label="Mail">
                    <Input
                      {...EMAIL_PROPS}
                      required
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                    />
                  </Field>
                  <Field
                    label="Contraseña"
                    hint={isSignup ? "Mínimo 6 caracteres" : undefined}
                  >
                    <PasswordInput
                      required
                      minLength={6}
                      autoComplete={isSignup ? "new-password" : "current-password"}
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                    />
                  </Field>
                  {!isSignup && (
                    <div className="flex justify-end -mt-1">
                      <button
                        type="button"
                        onClick={() => changeView("forgot")}
                        className="min-h-11 px-2 text-sm text-muted hover:text-fg"
                      >
                        ¿Olvidaste tu contraseña?
                      </button>
                    </div>
                  )}
                  <Button
                    type="submit"
                    loading={loading === "password" || loading === "signup"}
                  >
                    {isSignup ? "Crear cuenta" : "Iniciar sesión"}
                  </Button>
                  {errorNode}
                </form>
              )}

              {view === "magic" && (
                <form onSubmit={sendMagicLink} className="flex flex-col gap-3">
                  <Field label="Mail">
                    <Input
                      {...EMAIL_PROPS}
                      required
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                    />
                  </Field>
                  <Button type="submit" loading={loading === "magic"}>
                    Enviar link de acceso
                  </Button>
                  {errorNode}
                </form>
              )}

              {view === "forgot" && (
                <form onSubmit={submitReset} noValidate className="flex flex-col gap-3">
                  <Field label="Mail">
                    <Input
                      {...EMAIL_PROPS}
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                    />
                  </Field>
                  <Button type="submit" loading={loading === "reset"}>
                    Mandarme el link
                  </Button>
                  {errorNode}
                  <Button
                    type="button"
                    variant="ghost"
                    onClick={() => changeView("signin")}
                  >
                    Volver
                  </Button>
                </form>
              )}

              {(view === "signin" || view === "signup" || view === "magic") && (
                <>
                  <div className="flex items-center gap-3 text-xs text-muted">
                    <span className="h-px flex-1 bg-border" />o
                    <span className="h-px flex-1 bg-border" />
                  </div>
                  <Button
                    type="button"
                    variant="secondary"
                    onClick={() =>
                      changeView(view === "magic" ? "signin" : "magic")
                    }
                  >
                    {view === "magic"
                      ? "Usar contraseña"
                      : "Entrar con un link por mail"}
                  </Button>
                </>
              )}
            </div>
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
