"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { KeyRound } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { Button, Input } from "@/components/ui";

export default function ResetPasswordPage() {
  const router = useRouter();
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    const supabase = createClient();
    const { error } = await supabase.auth.updateUser({ password });
    setLoading(false);
    if (error) {
      setError(error.message);
      return;
    }
    router.replace("/rutinas");
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
          <Input
            type="password"
            required
            minLength={6}
            autoFocus
            placeholder="Contraseña nueva"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
          <Button type="submit" loading={loading}>
            Guardar
          </Button>
          {error && <p className="text-sm text-danger text-center">{error}</p>}
        </form>
      </div>
    </main>
  );
}
