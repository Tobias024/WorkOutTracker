"use client";

import { Dumbbell } from "lucide-react";
import { useState } from "react";
import { clsx } from "@/lib/clsx";

/**
 * Imagen de ejercicio con fallback. Se usa <img> nativo porque las imágenes
 * vienen de raw.githubusercontent.com (no se optimizan con next/image).
 */
export function ExerciseImage({
  src,
  alt,
  className,
}: {
  src?: string;
  alt: string;
  className?: string;
}) {
  const [error, setError] = useState(false);

  if (!src || error) {
    return (
      <div
        className={clsx(
          "grid place-items-center bg-surface-2 text-muted",
          className,
        )}
      >
        <Dumbbell className="size-6" />
      </div>
    );
  }

  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={src}
      alt={alt}
      loading="lazy"
      onError={() => setError(true)}
      className={clsx("object-cover bg-white", className)}
    />
  );
}
