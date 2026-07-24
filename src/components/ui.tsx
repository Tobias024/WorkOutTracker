"use client";

import { Loader2, X, ArrowUp, ArrowDown, Info } from "lucide-react";
import { clsx } from "@/lib/clsx";
import { useEffect, useState } from "react";

export function Button({
  variant = "primary",
  size = "md",
  className,
  loading,
  children,
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: "primary" | "secondary" | "ghost" | "danger" | "success";
  size?: "sm" | "md" | "lg";
  loading?: boolean;
}) {
  const variants: Record<string, string> = {
    primary: "bg-primary text-primary-fg hover:opacity-90",
    secondary: "bg-surface-2 text-fg hover:bg-border",
    ghost: "bg-transparent text-muted hover:text-fg hover:bg-surface-2",
    danger: "bg-danger/15 text-danger hover:bg-danger/25",
    success: "bg-success/15 text-success hover:bg-success/25",
  };
  const sizes: Record<string, string> = {
    sm: "h-8 px-3 text-sm rounded",
    md: "h-11 px-4 text-sm rounded-md",
    lg: "h-14 px-6 text-base rounded-lg",
  };
  return (
    <button
      className={clsx(
        "inline-flex items-center justify-center gap-2 font-medium transition disabled:opacity-50 disabled:pointer-events-none",
        variants[variant],
        sizes[size],
        className,
      )}
      disabled={loading || props.disabled}
      {...props}
    >
      {loading && <Loader2 className="size-4 animate-spin" />}
      {children}
    </button>
  );
}

export function Input({
  className,
  ...props
}: React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      className={clsx(
        "h-11 w-full rounded-md bg-surface-2 px-3 text-fg placeholder:text-muted/60 outline-none ring-1 ring-border focus:ring-2 focus:ring-primary transition",
        className,
      )}
      {...props}
    />
  );
}

export function Textarea({
  className,
  ...props
}: React.TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return (
    <textarea
      className={clsx(
        "w-full rounded-md bg-surface-2 px-3 py-2 text-fg placeholder:text-muted/60 outline-none ring-1 ring-border focus:ring-2 focus:ring-primary transition",
        className,
      )}
      {...props}
    />
  );
}

export function Spinner({ className }: { className?: string }) {
  return <Loader2 className={clsx("size-5 animate-spin text-muted", className)} />;
}

export function PageHeader({
  title,
  subtitle,
  action,
}: {
  title: string;
  subtitle?: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="flex items-start justify-between gap-4 mb-5">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">{title}</h1>
        {subtitle && <p className="text-sm text-muted mt-0.5">{subtitle}</p>}
      </div>
      {action}
    </div>
  );
}

export function EmptyState({
  icon,
  title,
  description,
  action,
}: {
  icon?: React.ReactNode;
  title: string;
  description?: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="card flex flex-col items-center text-center gap-3 py-12 px-6">
      {icon && <div className="text-muted">{icon}</div>}
      <div>
        <p className="font-semibold">{title}</p>
        {description && <p className="text-sm text-muted mt-1">{description}</p>}
      </div>
      {action}
    </div>
  );
}

export function Modal({
  open,
  onClose,
  title,
  children,
  center,
}: {
  open: boolean;
  onClose: () => void;
  title?: string;
  children: React.ReactNode;
  /** Centrado (diálogo) en vez de hoja pegada abajo. Para tooltips de info. */
  center?: boolean;
}) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    document.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [open, onClose]);

  if (!open) return null;
  return (
    <div
      className={clsx(
        "fixed inset-0 z-50 flex justify-center bg-black/60 backdrop-blur-sm",
        center ? "items-center p-4" : "items-end sm:items-center",
      )}
      onClick={onClose}
    >
      <div
        className={clsx(
          "card max-h-[85vh] flex flex-col",
          center
            ? "w-full max-w-md rounded-lg"
            : "w-full sm:max-w-lg rounded-b-none sm:rounded-lg",
        )}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between p-4 border-b border-border">
          <h2 className="font-semibold">{title}</h2>
          <button onClick={onClose} className="text-muted hover:text-fg">
            <X className="size-5" />
          </button>
        </div>
        <div className="overflow-y-auto p-4">{children}</div>
      </div>
    </div>
  );
}

export function Badge({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <span
      className={clsx(
        "inline-flex items-center rounded-md bg-surface-2 px-2.5 py-0.5 text-xs text-muted ring-1 ring-border",
        className,
      )}
    >
      {children}
    </span>
  );
}

export function Stat({
  label,
  value,
  unit,
  delta,
  deltaSuffix,
  sub,
  secondary,
  info,
}: {
  label: string;
  value: React.ReactNode;
  unit?: string;
  delta?: number | null;
  deltaSuffix?: string;
  /** Texto chico justo debajo del número (ej. "hasta ahora"). */
  sub?: string;
  /** Línea secundaria al pie (ej. "últ. sem: 1,2 t"). */
  secondary?: string;
  info?: React.ReactNode;
}) {
  const [showInfo, setShowInfo] = useState(false);
  return (
    <div className="card p-3.5 rounded-lg">
      <div className="flex items-center gap-1">
        <p className="text-xs text-muted">{label}</p>
        {info && (
          <button
            onClick={() => setShowInfo(true)}
            className="text-muted hover:text-fg"
            aria-label="¿Qué significa?"
          >
            <Info className="size-3" />
          </button>
        )}
      </div>
      <p className="text-xl font-bold mt-1.5 tracking-tight leading-none">
        {value}
        {unit && <span className="text-xs text-muted font-medium ml-1">{unit}</span>}
      </p>
      {sub && <p className="text-[10px] text-muted mt-1">{sub}</p>}
      {delta != null && (
        <div className="mt-2">
          <DeltaChip pct={delta} suffix={deltaSuffix} />
        </div>
      )}
      {secondary && <p className="text-[10px] text-muted mt-1.5">{secondary}</p>}
      {info && (
        <Modal
          open={showInfo}
          onClose={() => setShowInfo(false)}
          title={label}
          center
        >
          <div className="text-sm text-muted whitespace-pre-line">{info}</div>
        </Modal>
      )}
    </div>
  );
}

/** Chip de variación: flecha + % redondeado, verde si sube, rojo si baja. */
export function DeltaChip({ pct, suffix }: { pct: number; suffix?: string }) {
  const up = pct >= 0;
  const Arrow = up ? ArrowUp : ArrowDown;
  return (
    <span
      className={clsx(
        "inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[11px] font-semibold",
        up ? "bg-success/15 text-success" : "bg-danger/15 text-danger",
      )}
    >
      <Arrow className="size-2.5" strokeWidth={3} />
      {Math.abs(Math.round(pct))}%{suffix ? ` ${suffix}` : ""}
    </span>
  );
}

/** Card de sección con header (título + subtítulo opcional). */
export function SectionCard({
  title,
  subtitle,
  action,
  info,
  children,
  className,
}: {
  title: string;
  subtitle?: string;
  action?: React.ReactNode;
  /** Si se pasa, muestra un botón "i" que abre un modal con esta explicación. */
  info?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
}) {
  const [showInfo, setShowInfo] = useState(false);
  return (
    <div className={clsx("card rounded-xl p-4", className)}>
      <div className="flex items-start justify-between gap-2 mb-3">
        <div>
          <div className="flex items-center gap-1.5">
            <p className="text-sm font-semibold">{title}</p>
            {info && (
              <button
                onClick={() => setShowInfo(true)}
                className="text-muted hover:text-fg"
                aria-label="¿Qué significa?"
              >
                <Info className="size-3.5" />
              </button>
            )}
          </div>
          {subtitle && <p className="text-xs text-muted mt-0.5">{subtitle}</p>}
        </div>
        {action}
      </div>
      {children}
      {info && (
        <Modal
          open={showInfo}
          onClose={() => setShowInfo(false)}
          title={title}
          center
        >
          <div className="text-sm text-muted whitespace-pre-line">{info}</div>
        </Modal>
      )}
    </div>
  );
}

/**
 * Filtro tipo tabs. `scroll` = fila scrolleable de ancho natural (muchas
 * opciones, ej. categorías); por defecto, segmented control de ancho igual
 * (pocas opciones fijas, ej. métrica/período).
 */
export function Tabs<T extends string>({
  value,
  onChange,
  options,
  scroll,
}: {
  value: T;
  onChange: (v: T) => void;
  options: { value: T; label: string }[];
  scroll?: boolean;
}) {
  return (
    <div
      className={clsx(
        "flex gap-1 rounded-md bg-surface-2 p-1",
        scroll ? "overflow-x-auto no-scrollbar" : "",
      )}
    >
      {options.map((opt) => (
        <button
          key={opt.value}
          onClick={() => onChange(opt.value)}
          className={clsx(
            "rounded py-1.5 text-sm font-medium transition whitespace-nowrap",
            scroll ? "px-3" : "flex-1",
            value === opt.value
              ? "bg-primary text-primary-fg"
              : "text-muted hover:text-fg",
          )}
        >
          {opt.label}
        </button>
      ))}
    </div>
  );
}
