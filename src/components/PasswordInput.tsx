// SPDX-License-Identifier: AGPL-3.0-only
"use client";

import { useState } from "react";
import { Eye, EyeOff } from "lucide-react";
import { IconButton, Input } from "@/components/ui";

/**
 * Input de contraseña con toggle de ojo adentro. En mobile se escribe con
 * teclado chico y un typo te deja sin acceso: poder ver lo que tipeaste lo
 * evita. Reenvía todas las props (id, aria-*) para funcionar dentro de `Field`.
 */
export function PasswordInput(
  props: Omit<React.InputHTMLAttributes<HTMLInputElement>, "type">,
) {
  const [visible, setVisible] = useState(false);
  return (
    <div className="relative">
      <Input {...props} type={visible ? "text" : "password"} className="pr-11" />
      <IconButton
        label={visible ? "Ocultar contraseña" : "Mostrar contraseña"}
        aria-pressed={visible}
        onClick={() => setVisible((v) => !v)}
        className="absolute right-0 top-0"
      >
        {visible ? <EyeOff className="size-5" /> : <Eye className="size-5" />}
      </IconButton>
    </div>
  );
}
