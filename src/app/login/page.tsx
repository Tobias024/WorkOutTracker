"use client";

import { Suspense, useState } from "react";
import { useSearchParams } from "next/navigation";
import { Dumbbell } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { Button, Input } from "@/components/ui";

function LoginForm() {
  const params = useSearchParams();
  const next = params.get("next") ?? "/rutinas";
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);
  const [loading, setLoading] = useState<"email" | "google" | null>(null);
  const [error, setError] = useState<string | null>(null);

  const siteUrl =
    process.env.NEXT_PUBLIC_SITE_URL ??
    (typeof window !== "undefined" ? window.location.origin : "");

  async function sendMagicLink(e: React.FormEvent) {
    e.preventDefault();
    setLoading("email");
    setError(null);
    const supabase = createClient();
    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: {
        emailRedirectTo: `${siteUrl}/auth/callback?next=${encodeURIComponent(next)}`,
      },
    });
    setLoading(null);
    if (error) setError(error.message);
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
      setError(error.message);
    }
  }

  return (
    <main className="min-h-dvh flex flex-col items-center justify-center px-6">
      <div className="w-full max-w-sm">
        <div className="flex flex-col items-center gap-3 mb-8">
          <div className="size-14 rounded-2xl bg-primary/15 grid place-items-center">
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
              Te enviamos un link de acceso a <strong>{email}</strong>.
            </p>
          </div>
        ) : (
          <div className="card p-6 flex flex-col gap-4">
            <form onSubmit={sendMagicLink} className="flex flex-col gap-3">
              <Input
                type="email"
                required
                placeholder="tu@email.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
              <Button type="submit" loading={loading === "email"}>
                Enviar link de acceso
              </Button>
            </form>

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
