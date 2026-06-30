"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Button, Input, Spinner } from "@/components/ui";

export default function OnboardingPage() {
  const router = useRouter();
  const supabase = createClient();
  const [username, setUsername] = useState("");
  const [displayName, setDisplayName] = useState("");
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
    const clean = username.trim().toLowerCase();
    if (!/^[a-z0-9_]{3,20}$/.test(clean)) {
      setError("Usá 3-20 caracteres: letras, números o guión bajo.");
      return;
    }
    setLoading(true);
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return;

    const { error } = await supabase
      .from("profiles")
      .update({ username: clean, display_name: displayName.trim() || clean })
      .eq("id", user.id);

    setLoading(false);
    if (error) {
      setError(
        error.code === "23505"
          ? "Ese nombre de usuario ya está tomado."
          : error.message,
      );
      return;
    }
    router.replace("/rutinas");
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
        <h1 className="text-2xl font-bold mb-1">Elegí tu usuario</h1>
        <p className="text-sm text-muted mb-6">
          Así te van a encontrar tus amigos en el ranking.
        </p>
        <form onSubmit={save} className="card p-6 flex flex-col gap-3">
          <label className="text-sm text-muted">Nombre de usuario</label>
          <Input
            placeholder="usuario"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            autoCapitalize="none"
          />
          <label className="text-sm text-muted mt-2">Nombre para mostrar</label>
          <Input
            placeholder="Tu nombre"
            value={displayName}
            onChange={(e) => setDisplayName(e.target.value)}
          />
          <Button type="submit" loading={loading} className="mt-2">
            Empezar
          </Button>
          {error && <p className="text-sm text-danger">{error}</p>}
        </form>
      </div>
    </main>
  );
}
