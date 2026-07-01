"use client";

import { useState } from "react";
import Link from "next/link";
import { Dumbbell, Plus, ChevronRight, Library } from "lucide-react";
import {
  PageHeader,
  Button,
  Input,
  Spinner,
  EmptyState,
  Modal,
} from "@/components/ui";
import { useRoutines, useCreateRoutine } from "@/hooks/useRoutines";
import { formatDate } from "@/lib/format";

export default function RoutinesPage() {
  const { data, isLoading } = useRoutines();
  const create = useCreateRoutine();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) return;
    const routine = await create.mutateAsync(name.trim());
    setOpen(false);
    setName("");
    window.location.href = `/rutinas/${routine.id}`;
  }

  return (
    <div>
      <PageHeader
        title="Rutinas"
        subtitle="Tus planes de entrenamiento"
        action={
          <Button size="sm" onClick={() => setOpen(true)}>
            <Plus className="size-4" /> Nueva
          </Button>
        }
      />

      <Link
        href="/ejercicios"
        className="card flex items-center gap-3 p-3 mb-4 hover:ring-1 hover:ring-primary transition"
      >
        <div className="size-9 rounded bg-surface-2 grid place-items-center">
          <Library className="size-5 text-muted" />
        </div>
        <span className="text-sm font-medium flex-1">Explorar catálogo de ejercicios</span>
        <ChevronRight className="size-4 text-muted" />
      </Link>

      {isLoading ? (
        <div className="grid place-items-center py-16">
          <Spinner />
        </div>
      ) : !data?.length ? (
        <EmptyState
          icon={<Dumbbell className="size-8" />}
          title="Todavía no tenés rutinas"
          description="Creá tu primera rutina y agregale ejercicios."
          action={
            <Button onClick={() => setOpen(true)}>
              <Plus className="size-4" /> Crear rutina
            </Button>
          }
        />
      ) : (
        <ul className="flex flex-col gap-2.5">
          {data.map((r) => (
            <li key={r.id}>
              <Link
                href={`/rutinas/${r.id}`}
                className="card flex items-center gap-3 p-4 hover:ring-1 hover:ring-primary transition"
              >
                <div className="size-10 rounded-md bg-primary/15 grid place-items-center">
                  <Dumbbell className="size-5 text-primary" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="font-semibold truncate">{r.name}</p>
                  <p className="text-xs text-muted">
                    Actualizada {formatDate(r.updated_at)}
                    {r.share_code && " · Compartida"}
                  </p>
                </div>
                <ChevronRight className="size-5 text-muted" />
              </Link>
            </li>
          ))}
        </ul>
      )}

      <Modal open={open} onClose={() => setOpen(false)} title="Nueva rutina">
        <form onSubmit={handleCreate} className="flex flex-col gap-3">
          <Input
            autoFocus
            placeholder="Ej: Push día 1"
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
          <Button type="submit" loading={create.isPending}>
            Crear
          </Button>
        </form>
      </Modal>
    </div>
  );
}
