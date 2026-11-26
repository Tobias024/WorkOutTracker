// SPDX-License-Identifier: AGPL-3.0-only
"use client";

import { Check } from "lucide-react";
import { FieldGroup } from "@/components/ui";
import { MUSCLE_GROUPS, MUSCLES_ES } from "@/lib/i18n-exercise";
import { clsx } from "@/lib/clsx";

export function Chip({
  active,
  onClick,
  disabled,
  children,
}: {
  active: boolean;
  onClick: () => void;
  /** Visible pero no tocable (ej. un músculo que ya es principal). */
  disabled?: boolean;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-pressed={active}
      className={clsx(
        "inline-flex min-h-11 items-center gap-2 rounded-full px-3.5 text-sm ring-1 transition disabled:opacity-50",
        active
          ? "bg-primary text-primary-fg ring-primary"
          : "bg-surface-2 ring-border text-muted hover:text-fg",
      )}
    >
      {active && <Check className="size-3.5" aria-hidden />}
      {children}
    </button>
  );
}

/**
 * Elige los músculos de un ejercicio. Lo comparten crear y editar, porque son
 * el mismo dato y los dos escriben en las mismas columnas.
 *
 * Admite VARIOS primarios a propósito. Antes era uno solo, y eso obligaba a un
 * compuesto a acreditarle el 100 % del volumen a un músculo: un press de banca
 * tenía que elegir entre pecho y tríceps. El modelo de contribución ya soporta
 * varios directos (1.0 cada uno) — lo que faltaba era poder cargarlos.
 *
 * El vocabulario es el de GRUPOS-APP, así que las tres cabezas del deltoides se
 * eligen a mano. Es lo que evita que la app tenga que adivinarlas del nombre:
 * ver `MUSCLE_GROUPS`.
 */
export function MusclePicker({
  primary,
  secondary,
  onChange,
  primaryError,
}: {
  primary: string[];
  secondary: string[];
  /** Error de validación de los principales (lo muestra el formulario padre). */
  primaryError?: string | null;
  onChange: (primary: string[], secondary: string[]) => void;
}) {
  const togglePrimary = (m: string) => {
    const next = primary.includes(m)
      ? primary.filter((x) => x !== m)
      : [...primary, m];
    // Un músculo no puede ser directo e indirecto a la vez: al promoverlo, se
    // va de la otra lista.
    onChange(next, secondary.filter((x) => !next.includes(x)));
  };

  const toggleSecondary = (m: string) =>
    onChange(
      primary,
      secondary.includes(m)
        ? secondary.filter((x) => x !== m)
        : [...secondary, m],
    );

  return (
    <>
      <FieldGroup
        label="Músculos principales"
        hint="los que mueven el peso"
        required
        error={primaryError}
      >
        <div className="flex flex-wrap gap-2">
          {MUSCLE_GROUPS.map((m) => (
            <Chip
              key={m}
              active={primary.includes(m)}
              onClick={() => togglePrimary(m)}
            >
              {MUSCLES_ES[m]}
            </Chip>
          ))}
        </div>
      </FieldGroup>

      <FieldGroup
        label="Músculos secundarios"
        hint="participan; cuentan media serie"
        optional
      >
        <div className="flex flex-wrap gap-2">
          {/* Los principales quedan visibles pero deshabilitados: si
              desaparecían, la lista cambiaba de tamaño al tocar arriba. */}
          {MUSCLE_GROUPS.map((m) => {
            const isPrimary = primary.includes(m);
            return (
              <Chip
                key={m}
                active={!isPrimary && secondary.includes(m)}
                disabled={isPrimary}
                onClick={() => toggleSecondary(m)}
              >
                {MUSCLES_ES[m]}
                {isPrimary && " (principal)"}
              </Chip>
            );
          })}
        </div>
      </FieldGroup>
    </>
  );
}
