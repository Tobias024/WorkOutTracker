// SPDX-License-Identifier: AGPL-3.0-only
"use client";

import { useState } from "react";
import { Modal, Input, Textarea, Button } from "@/components/ui";
import {
  FORCE_ES,
  MECHANIC_ES,
  EQUIPMENT_ES,
  METRIC_KIND_ES,
} from "@/lib/i18n-exercise";
import { useCreateExercise } from "@/hooks/useExercises";
import { Chip, Field, MusclePicker } from "@/components/MusclePicker";
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

  const valid =
    name.trim().length >= 2 && primary.length > 0 && !!mechanic && !!force;

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
  }

  async function submit() {
    if (!valid) {
      setError("Completá nombre, músculos principales, mecánica y fuerza.");
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
    <Modal open={open} onClose={onClose} title="Crear ejercicio">
      <div className="flex flex-col gap-4">
        <Field label="Nombre">
          <Input
            placeholder="Ej: Curl inclinado con mancuernas"
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
        </Field>

        <MusclePicker
          primary={primary}
          secondary={secondary}
          onChange={(p, sec) => {
            setPrimary(p);
            setSecondary(sec);
          }}
        />

        <Field
          label="Cómo se mide"
          hint="define qué campos vas a cargar en cada serie"
        >
          <div className="flex flex-wrap gap-1.5">
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
