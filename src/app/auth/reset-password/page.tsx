// SPDX-License-Identifier: AGPL-3.0-only
"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { KeyRound, LinkIcon } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { translateError } from "@/lib/auth-errors";
import { toast } from "@/lib/toast";
import { Button, Field, Spinner, buttonClasses } from "@/components/ui";
import { PasswordInput } from "@/components/PasswordInput";

export default function ResetPasswordPage() {
  const router = useRouter();
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // null = verificando; false = el link venció, se abrió en otro dispositivo, etc.
  const [hasSession, setHasSession] = useState<boolean | null>(null);

  // Sin sesión no hay a quién cambiarle la contraseña: se avisa antes de que
  // el usuario complete el formulario para nada.
  useEffect(() => {
    (async () => {
      const supabase = createClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();
      setHasSession(!!user);
    })();
  }, []);

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    const supabase = createClient();
    const { error } = await supabase.auth.updateUser({ password });
    setLoading(false);
    if (error) {
      setError(translateError(error.message));
      return;
    }
    toast("Listo, actualizamos tu contraseña", { tone: "success" });
    router.replace("/rutinas");
  }

  if (hasSession === null) {
    return (
      <main className="min-h-dvh grid place-items-center">
        <Spinner />
      </main>
    );
  }

  if (!hasSession) {
    return (
      <main className="min-h-dvh flex flex-col items-center justify-center px-6">
        <div className="w-full max-w-sm card p-8 text-center flex flex-col items-center gap-3">
          <div className="size-14 rounded-lg bg-primary/15 grid place-items-center">
            <LinkIcon className="size-7 text-primary" />
          </div>
          <h1 className="text-xl font-bold">El link venció o ya se usó</h1>
          <p className="text-sm text-muted">
            Pedí uno nuevo para elegir tu contraseña.
          </p>
          <Link href="/login" className={buttonClasses({ className: "w-full mt-2" })}>
            Pedir otro link
          </Link>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-dvh flex flex-col items-center justify-center px-6">
      <div className="w-full max-w-sm">
        <div className="flex flex-col items-center gap-3 mb-8">
          <div className="size-14 rounded-lg bg-primary/15 grid place-items-center">
            <KeyRound className="size-7 text-primary" />
          </div>
          <div className="text-center">
            <h1 className="text-2xl font-bold">Nueva contraseña</h1>
            <p className="text-sm text-muted mt-1">
              Elegí una contraseña nueva para tu cuenta.
            </p>
          </div>
        </div>

        <form onSubmit={save} className="card p-6 flex flex-col gap-3">
          <Field label="Contraseña nueva" hint="Mínimo 6 caracteres">
            <PasswordInput
              required
              minLength={6}
              autoFocus
              autoComplete="new-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </Field>
          <Button type="submit" loading={loading}>
            Guardar contraseña
          </Button>
          {error && (
            <p role="alert" className="text-sm text-danger text-center">
              {error}
            </p>
          )}
        </form>
      </div>
    </main>
  );
}
