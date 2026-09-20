// SPDX-License-Identifier: AGPL-3.0-only
"use client";

import { MUSCLE_GROUPS, MUSCLES_ES } from "@/lib/i18n-exercise";
import { clsx } from "@/lib/clsx";

export function Chip({
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

export function Field({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: React.ReactNode;
}) {
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
}: {
  primary: string[];
  secondary: string[];
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
      <Field label="Músculos principales" hint="los que mueven el peso">
        <div className="flex flex-wrap gap-1.5">
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
      </Field>

      <Field
        label="Músculos secundarios"
        hint="participan; cuentan media serie"
      >
        <div className="flex flex-wrap gap-1.5">
          {MUSCLE_GROUPS.filter((m) => !primary.includes(m)).map((m) => (
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
    </>
  );
}
