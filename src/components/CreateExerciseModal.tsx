// SPDX-License-Identifier: AGPL-3.0-only
"use client";

import { useRef, useState } from "react";
import { Modal, Input, Textarea, Button, Field, FieldGroup } from "@/components/ui";
import {
  FORCE_ES,
  MECHANIC_ES,
  EQUIPMENT_ES,
  METRIC_KIND_ES,
} from "@/lib/i18n-exercise";
import { useCreateExercise } from "@/hooks/useExercises";
import { Chip, MusclePicker } from "@/components/MusclePicker";
import { METRIC_KINDS, type Exercise, type MetricKind } from "@/lib/types";

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
  const [metricKind, setMetricKind] = useState<MetricKind>("reps_weight");
  const [primary, setPrimary] = useState<string[]>([]);
  const [secondary, setSecondary] = useState<string[]>([]);
  const [mechanic, setMechanic] = useState("");
  const [force, setForce] = useState("");
  const [equipment, setEquipment] = useState("");
  const [imageUrl, setImageUrl] = useState("");
  const [description, setDescription] = useState("");
  const [error, setError] = useState<string | null>(null);
  // Errores por campo; se calculan al tocar "Crear ejercicio", no antes.
  const [errors, setErrors] = useState<Partial<
    Record<"name" | "primary" | "mechanic" | "force", string>
  >>({});
  const bodyRef = useRef<HTMLDivElement>(null);

  function validate() {
    const e: typeof errors = {};
    if (name.trim().length < 2) e.name = "Poné un nombre de al menos 2 letras.";
    if (primary.length === 0) e.primary = "Elegí al menos un músculo principal.";
    if (!mechanic) e.mechanic = "Elegí la mecánica.";
    if (!force) e.force = "Elegí el tipo de fuerza.";
    return e;
  }

  function reset() {
    setMetricKind("reps_weight");
    setName("");
    setPrimary([]);
    setSecondary([]);
    setMechanic("");
    setForce("");
    setEquipment("");
    setImageUrl("");
    setDescription("");
    setError(null);
    setErrors({});
  }

  async function submit() {
    const e = validate();
    setErrors(e);
    setError(null);
    const first = (["name", "primary", "mechanic", "force"] as const).find(
      (k) => e[k],
    );
    if (first) {
      // Se llega al primer error aunque esté fuera de pantalla.
      bodyRef.current
        ?.querySelector(`[data-field="${first}"]`)
        ?.scrollIntoView({ block: "center", behavior: "smooth" });
      return;
    }
    try {
      const ex = await create.mutateAsync({
        name,
        metric_kind: metricKind,
        primary_muscles: primary,
        secondary_muscles: secondary.filter((m) => !primary.includes(m)),
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

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Crear ejercicio"
      footer={
        <div className="flex flex-col gap-2">
          {error && (
            <p role="alert" className="text-sm text-danger">
              {error}
            </p>
          )}
          <Button size="lg" onClick={submit} loading={create.isPending}>
            Crear ejercicio
          </Button>
        </div>
      }
    >
      <div ref={bodyRef} className="flex flex-col gap-5">
        <div data-field="name">
          <Field label="Nombre" required error={errors.name}>
            <Input
              placeholder="Ej: Curl inclinado con mancuernas"
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          </Field>
        </div>

        <div data-field="primary" className="flex flex-col gap-5">
          <MusclePicker
            primary={primary}
            secondary={secondary}
            primaryError={errors.primary}
            onChange={(p, sec) => {
              setPrimary(p);
              setSecondary(sec);
            }}
          />
        </div>

        <FieldGroup
          label="Cómo se mide"
          hint="define qué campos vas a cargar en cada serie"
        >
          <div className="flex flex-wrap gap-2">
            {METRIC_KINDS.map((k) => (
              <Chip
                key={k}
                active={metricKind === k}
                onClick={() => setMetricKind(k)}
              >
                {METRIC_KIND_ES[k]}
              </Chip>
            ))}
          </div>
        </FieldGroup>

        <div data-field="mechanic">
          <FieldGroup label="Mecánica" required error={errors.mechanic}>
            <div className="flex flex-wrap gap-2">
              {Object.entries(MECHANIC_ES).map(([k, v]) => (
                <Chip key={k} active={mechanic === k} onClick={() => setMechanic(k)}>
                  {v}
                </Chip>
              ))}
            </div>
          </FieldGroup>
        </div>
        <div data-field="force">
          <FieldGroup label="Fuerza" required error={errors.force}>
            <div className="flex flex-wrap gap-2">
              {Object.entries(FORCE_ES).map(([k, v]) => (
                <Chip key={k} active={force === k} onClick={() => setForce(k)}>
                  {v}
                </Chip>
              ))}
            </div>
          </FieldGroup>
        </div>

        <FieldGroup label="Equipo" optional>
          <div className="flex flex-wrap gap-2">
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
        </FieldGroup>

        <Field label="Imagen (URL)" optional>
          <Input
            type="url"
            inputMode="url"
            placeholder="https://…"
            value={imageUrl}
            onChange={(e) => setImageUrl(e.target.value)}
          />
        </Field>

        <Field label="Descripción / notas" optional>
          <Textarea
            rows={2}
            placeholder="Ej: banco a 30°, agarre neutro…"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
          />
        </Field>
      </div>
    </Modal>
  );
}
