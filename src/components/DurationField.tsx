// SPDX-License-Identifier: AGPL-3.0-only
"use client";

import { useState } from "react";
import { clsx } from "@/lib/clsx";

/**
 * Campo de duración: dos cajas numéricas con el `:` puesto por la UI.
 *
 * Antes era una sola caja que pedía "mm:ss" con `inputMode="numeric"`, y el
 * teclado numérico del teléfono NO tiene dos puntos — así que el formato que el
 * placeholder pedía era imposible de tipear. Lo que salía era un número suelto:
 * alguien que quería "1 minuto y medio" escribía `1.5` y se guardaban 2
 * segundos, sin un solo aviso.
 *
 * Por eso los dígitos se sanitizan en cada tecla (`\D` afuera): con dos campos
 * separados el `.` no tiene dónde entrar, y el formato deja de depender de qué
 * teclado muestre el sistema.
 *
 * Contrato igual al de los otros campos de la fila de serie: no controlado
 * (el padre remonta con `key` cuando el valor cambia desde afuera) y commit
 * cuando el foco sale del grupo — no de cada caja, para que pasar de minutos a
 * segundos no dispare un guardado a mitad de la edición.
 */
/**
 * Pasa el foco al siguiente input de la fila de serie (o suelta el foco si era
 * el último). Soltarlo dispara el commit en blur de cada campo.
 */
export function focusNextInRow(current: HTMLInputElement) {
  const row = current.closest("[data-setrow]");
  const inputs = row
    ? Array.from(row.querySelectorAll<HTMLInputElement>("input"))
    : [];
  const next = inputs[inputs.indexOf(current) + 1];
  if (next) next.focus();
  else current.blur();
}

export function DurationField({
  value,
  placeholder,
  onCommit,
  className,
  size = "md",
  labelSuffix,
}: {
  /** Segundos. */
  value: number | null;
  /** Segundos de referencia (la última vez o el plan). null = sin pista. */
  placeholder?: number | null;
  onCommit: (v: number | null) => void;
  className?: string;
  /** "lg": caja de 44px y texto de 16px, para la fila de serie al entrenar. */
  size?: "md" | "lg";
  /** Se agrega a los aria-label, ej. "serie 2". */
  labelSuffix?: string;
}) {
  const [mm, setMm] = useState(
    value == null ? "" : String(Math.floor(value / 60)),
  );
  const [ss, setSs] = useState(
    value == null ? "" : String(Math.floor(value % 60)).padStart(2, "0"),
  );

  const digits = (raw: string, max: number) =>
    raw.replace(/\D/g, "").slice(0, max);

  /** El foco salió de las DOS cajas: normaliza, arrastra el excedente y commitea. */
  function commit(e: React.FocusEvent<HTMLDivElement>) {
    if (e.currentTarget.contains(e.relatedTarget as Node | null)) return;
    if (mm === "" && ss === "") {
      if (value != null) onCommit(null);
      return;
    }
    // Escribir 90 en segundos es lo natural cuando pensás "un minuto y medio":
    // se acepta y se acomoda a 1:30 en vez de rechazarlo.
    const total = Number(mm || 0) * 60 + Number(ss || 0);
    setMm(String(Math.floor(total / 60)));
    setSs(String(total % 60).padStart(2, "0"));
    if (total !== value) onCommit(total);
  }

  const hintMin = placeholder == null ? "min" : String(Math.floor(placeholder / 60));
  const hintSec =
    placeholder == null
      ? "seg"
      : String(Math.floor(placeholder % 60)).padStart(2, "0");

  const box = clsx(
    "w-full min-w-0 rounded bg-surface px-1 text-center outline-none ring-1 ring-border focus:ring-primary tabular-nums",
    size === "lg"
      ? "h-11 text-base font-semibold text-fg placeholder:text-muted/60 placeholder:font-normal"
      : "h-9 text-sm",
  );
  const suffix = labelSuffix ? `, ${labelSuffix}` : "";
  const selectAll = (e: React.FocusEvent<HTMLInputElement>) =>
    e.currentTarget.select();
  const onEnter = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key !== "Enter") return;
    e.preventDefault();
    focusNextInRow(e.currentTarget);
  };

  return (
    <div
      onBlur={commit}
      className={clsx("flex items-center gap-1 min-w-0", className)}
    >
      <input
        type="text"
        inputMode="numeric"
        aria-label={`Minutos${suffix}`}
        enterKeyHint="next"
        onFocus={selectAll}
        onKeyDown={onEnter}
        value={mm}
        placeholder={hintMin}
        onChange={(e) => setMm(digits(e.target.value, 3))}
        className={box}
      />
      <span className="text-muted text-xs shrink-0">:</span>
      <input
        type="text"
        inputMode="numeric"
        aria-label={`Segundos${suffix}`}
        enterKeyHint="done"
        onFocus={selectAll}
        onKeyDown={onEnter}
        value={ss}
        placeholder={hintSec}
        onChange={(e) => setSs(digits(e.target.value, 2))}
        className={box}
      />
    </div>
  );
}
