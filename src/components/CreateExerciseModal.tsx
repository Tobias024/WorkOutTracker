"use client";

import { useState } from "react";
import { Modal, Input, Textarea, Button } from "@/components/ui";
import {
  MUSCLE_FILTERS,
  MUSCLES_ES,
  FORCE_ES,
  MECHANIC_ES,
  EQUIPMENT_ES,
} from "@/lib/i18n-exercise";
import { useCreateExercise } from "@/hooks/useExercises";
import { clsx } from "@/lib/clsx";
import type { Exercise } from "@/lib/types";

function Chip({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={clsx(
        "px-3 py-1.5 rounded-full text-xs ring-1 transition",
        active
          ? "bg-primary/15 ring-primary text-fg"
          : "bg-surface-2 ring-border text-muted hover:text-fg",
      )}
    >
      {children}
    </button>
  );
}

function Field({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-1.5">
      <label className="text-sm text-muted">
        {label}
        {hint && <span className="text-xs"> · {hint}</span>}
      </label>
      {children}
    </div>
  );
}

/** Crea un ejercicio custom con los campos que alimentan los cálculos
 *  (obligatorios: nombre, músculo principal, mecánica, fuerza). */
export function CreateExerciseModal({
  open,
  onClose,
  onCreated,
  initialName = "",
}: {
  open: boolean;
  onClose: () => void;
  onCreated: (ex: Exercise) => void;
  initialName?: string;
}) {
  const create = useCreateExercise();
  const [name, setName] = useState(initialName);
  const [primary, setPrimary] = useState("");
  const [secondary, setSecondary] = useState<string[]>([]);
  const [mechanic, setMechanic] = useState("");
  const [force, setForce] = useState("");
  const [equipment, setEquipment] = useState("");
  const [imageUrl, setImageUrl] = useState("");
  const [description, setDescription] = useState("");
  const [error, setError] = useState<string | null>(null);

  const valid = name.trim().length >= 2 && !!primary && !!mechanic && !!force;

  function reset() {
    setName("");
    setPrimary("");
    setSecondary([]);
    setMechanic("");
    setForce("");
    setEquipment("");
    setImageUrl("");
    setDescription("");
    setError(null);
  }

  async function submit() {
    if (!valid) {
      setError("Completá nombre, músculo principal, mecánica y fuerza.");
      return;
    }
    try {
      const ex = await create.mutateAsync({
        name,
        primary_muscles: [primary],
        secondary_muscles: secondary.filter((m) => m !== primary),
        mechanic,
        force,
        equipment: equipment || null,
        imageUrl: imageUrl.trim() || null,
        description: description.trim() || null,
      });
      reset();
      onCreated(ex);
    } catch {
      setError("No se pudo crear el ejercicio. Reintentá.");
    }
  }

  const toggleSecondary = (m: string) =>
    setSecondary((s) => (s.includes(m) ? s.filter((x) => x !== m) : [...s, m]));

  return (
    <Modal open={open} onClose={onClose} title="Crear ejercicio">
      <div className="flex flex-col gap-4">
        <Field label="Nombre">
          <Input
            placeholder="Ej: Curl inclinado con mancuernas"
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
        </Field>

        <Field label="Músculo principal" hint="obligatorio">
          <div className="flex flex-wrap gap-1.5">
            {MUSCLE_FILTERS.map((m) => (
              <Chip key={m} active={primary === m} onClick={() => setPrimary(m)}>
                {MUSCLES_ES[m]}
              </Chip>
            ))}
          </div>
        </Field>

        <Field label="Músculos secundarios" hint="opcional">
          <div className="flex flex-wrap gap-1.5">
            {MUSCLE_FILTERS.filter((m) => m !== primary).map((m) => (
              <Chip
                key={m}
                active={secondary.includes(m)}
                onClick={() => toggleSecondary(m)}
              >
                {MUSCLES_ES[m]}
              </Chip>
            ))}
          </div>
        </Field>

        <div className="grid grid-cols-2 gap-4">
          <Field label="Mecánica" hint="obligatorio">
            <div className="flex flex-wrap gap-1.5">
              {Object.entries(MECHANIC_ES).map(([k, v]) => (
                <Chip key={k} active={mechanic === k} onClick={() => setMechanic(k)}>
                  {v}
                </Chip>
              ))}
            </div>
          </Field>
          <Field label="Fuerza" hint="obligatorio">
            <div className="flex flex-wrap gap-1.5">
              {Object.entries(FORCE_ES).map(([k, v]) => (
                <Chip key={k} active={force === k} onClick={() => setForce(k)}>
                  {v}
                </Chip>
              ))}
            </div>
          </Field>
        </div>

        <Field label="Equipo" hint="opcional">
          <div className="flex flex-wrap gap-1.5">
            {Object.entries(EQUIPMENT_ES).map(([k, v]) => (
              <Chip
                key={k}
                active={equipment === k}
                onClick={() => setEquipment(equipment === k ? "" : k)}
              >
                {v}
              </Chip>
            ))}
          </div>
        </Field>

        <Field label="Imagen (URL)" hint="opcional">
          <Input
            placeholder="https://…"
            value={imageUrl}
            onChange={(e) => setImageUrl(e.target.value)}
          />
        </Field>

        <Field label="Descripción / notas" hint="opcional">
          <Textarea
            rows={2}
            placeholder="Ej: banco a 30°, agarre neutro…"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
          />
        </Field>

        {error && <p className="text-sm text-danger">{error}</p>}

        <Button onClick={submit} loading={create.isPending} disabled={!valid}>
          Crear ejercicio
        </Button>
      </div>
    </Modal>
  );
}
