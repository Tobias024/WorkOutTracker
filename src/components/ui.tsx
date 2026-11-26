// SPDX-License-Identifier: AGPL-3.0-only
"use client";

import {
  Loader2,
  X,
  ArrowUp,
  ArrowDown,
  Info,
  Minus,
  ChevronLeft,
  WifiOff,
} from "lucide-react";
import Link from "next/link";
import { createPortal } from "react-dom";
import {
  cloneElement,
  useEffect,
  useId,
  useRef,
  useState,
  useSyncExternalStore,
  type ButtonHTMLAttributes,
  type ReactElement,
  type ReactNode,
} from "react";
import { clsx } from "@/lib/clsx";
import { useVisualViewport } from "@/hooks/useVisualViewport";

// Anillo de foco compartido por todos los controles: sin esto el foco por
// teclado era invisible (los botones no tenían ningún estilo de focus).
const FOCUS_RING =
  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-bg";

type ButtonVariant = "primary" | "secondary" | "ghost" | "danger" | "success";
type ButtonSize = "sm" | "md" | "lg";

const BUTTON_VARIANTS: Record<ButtonVariant, string> = {
  primary: "bg-primary text-primary-fg hover:opacity-90",
  secondary: "bg-surface-2 text-fg hover:bg-border",
  ghost: "bg-transparent text-muted hover:text-fg hover:bg-surface-2",
  danger: "bg-danger/15 text-danger hover:bg-danger/25",
  success: "bg-success/15 text-success hover:bg-success/25",
};

const BUTTON_SIZES: Record<ButtonSize, string> = {
  // h-9 visual + pseudo-elemento invisible de 4px arriba/abajo = 44px táctiles.
  sm: "h-9 px-3 text-sm rounded-md relative after:absolute after:inset-x-0 after:-inset-y-1 after:content-['']",
  md: "h-11 px-4 text-sm rounded-md",
  lg: "h-14 px-6 text-base rounded-lg",
};

/** Clases de Button, para dar el mismo aspecto a un `<Link>` o `<a>`. */
export function buttonClasses({
  variant = "primary",
  size = "md",
  className,
}: {
  variant?: ButtonVariant;
  size?: ButtonSize;
  className?: string;
} = {}): string {
  return clsx(
    "inline-flex items-center justify-center gap-2 font-medium transition disabled:opacity-50 disabled:pointer-events-none",
    FOCUS_RING,
    BUTTON_VARIANTS[variant],
    BUTTON_SIZES[size],
    className,
  );
}

export function Button({
  variant = "primary",
  size = "md",
  className,
  loading,
  disabled,
  children,
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: ButtonVariant;
  size?: ButtonSize;
  loading?: boolean;
}) {
  return (
    <button
      className={buttonClasses({ variant, size, className })}
      {...props}
      // Después del spread: si `disabled` viniera en props pisaría a `loading`
      // y el botón seguiría aceptando toques con el spinner (envíos dobles).
      disabled={loading || disabled}
      aria-busy={loading || undefined}
    >
      {loading && <Loader2 className="size-4 animate-spin" />}
      {children}
    </button>
  );
}

type IconButtonSize = "sm" | "md" | "lg";
type IconButtonTone = "muted" | "fg" | "danger" | "primary";

const ICON_SIZES: Record<IconButtonSize, string> = {
  // Visual 36px + 4px de área invisible por lado = 44px táctiles.
  sm: "size-9 relative after:absolute after:-inset-1 after:content-['']",
  md: "size-11",
  lg: "size-12",
};

const ICON_TONES: Record<IconButtonTone, string> = {
  muted: "text-muted hover:text-fg",
  fg: "text-fg",
  danger: "text-danger",
  primary: "text-primary",
};

/** Clases de IconButton, para usarlas en un `<Link>`. */
export function iconButtonClasses({
  size = "md",
  tone = "muted",
  className,
}: {
  size?: IconButtonSize;
  tone?: IconButtonTone;
  className?: string;
} = {}): string {
  return clsx(
    "grid shrink-0 place-items-center rounded-md transition hover:bg-surface-2 disabled:opacity-50 disabled:pointer-events-none",
    FOCUS_RING,
    ICON_SIZES[size],
    ICON_TONES[tone],
    className,
  );
}

/** Botón de solo ícono. `label` es obligatorio: es su nombre accesible. */
export function IconButton({
  label,
  size = "md",
  tone = "muted",
  className,
  children,
  type = "button",
  ...props
}: Omit<ButtonHTMLAttributes<HTMLButtonElement>, "aria-label"> & {
  label: string;
  size?: IconButtonSize;
  tone?: IconButtonTone;
  className?: string;
  children: ReactNode;
}) {
  return (
    <button
      type={type}
      aria-label={label}
      className={iconButtonClasses({ size, tone, className })}
      {...props}
    >
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
        // text-base (16px): con menos, iOS Safari hace zoom al enfocar.
        "h-11 w-full rounded-md bg-surface-2 px-3 text-base text-fg placeholder:text-muted outline-none ring-1 ring-border focus:ring-2 focus:ring-primary transition",
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
        "w-full rounded-md bg-surface-2 px-3 py-2 text-base text-fg placeholder:text-muted outline-none ring-1 ring-border focus:ring-2 focus:ring-primary transition",
        className,
      )}
      {...props}
    />
  );
}

export function Spinner({ className }: { className?: string }) {
  return <Loader2 className={clsx("size-5 animate-spin text-muted", className)} />;
}

export function Skeleton({ className }: { className?: string }) {
  return (
    <div
      aria-hidden
      className={clsx("animate-pulse rounded-md bg-surface-2", className)}
    />
  );
}

export function PageHeader({
  title,
  subtitle,
  action,
  back,
}: {
  title: ReactNode;
  subtitle?: string;
  action?: ReactNode;
  /** Href (link) o callback (botón) para el botón "Volver" a la izquierda. */
  back?: string | (() => void);
}) {
  const chevron = <ChevronLeft className="size-5" />;
  return (
    <div className="flex items-start justify-between gap-4 mb-5">
      <div className="flex items-start gap-1 min-w-0">
        {typeof back === "string" ? (
          <Link
            href={back}
            aria-label="Volver"
            className={iconButtonClasses({ className: "-ml-2" })}
          >
            {chevron}
          </Link>
        ) : back ? (
          <IconButton label="Volver" onClick={back} className="-ml-2">
            {chevron}
          </IconButton>
        ) : null}
        <div className="min-w-0">
          <h1 className="text-2xl font-bold tracking-tight">{title}</h1>
          {subtitle && <p className="text-sm text-muted mt-0.5">{subtitle}</p>}
        </div>
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

export function ErrorState({
  title,
  description = "Revisá tu conexión y probá de nuevo.",
  onRetry,
  retrying,
}: {
  title: string;
  description?: string;
  onRetry?: () => void;
  retrying?: boolean;
}) {
  return (
    <div
      role="alert"
      className="card flex flex-col items-center text-center gap-3 py-12 px-6"
    >
      <div className="text-muted">
        <WifiOff className="size-8" />
      </div>
      <div>
        <p className="font-semibold">{title}</p>
        {description && <p className="text-sm text-muted mt-1">{description}</p>}
      </div>
      {onRetry && (
        <Button variant="secondary" onClick={onRetry} loading={retrying}>
          Reintentar
        </Button>
      )}
    </div>
  );
}

/** Forma mínima de un resultado de react-query (evita acoplar ui.tsx a la lib). */
export interface QueryLike<T> {
  data: T | undefined;
  isPending: boolean;
  isError: boolean;
  isFetching?: boolean;
  refetch: () => unknown;
}

/** Resuelve los 4 estados de una query: cargando, error, vacío y datos. */
export function QueryState<T>({
  query,
  loading,
  errorTitle = "No pudimos cargar los datos",
  errorDescription,
  isEmpty,
  empty,
  children,
}: {
  query: QueryLike<T>;
  loading?: ReactNode;
  errorTitle?: string;
  errorDescription?: string;
  isEmpty?: (data: T) => boolean;
  empty?: ReactNode;
  children: (data: T) => ReactNode;
}) {
  const { data } = query;
  // Si ya hay datos, se siguen mostrando aunque un refetch en segundo plano falle.
  if (data !== undefined) {
    return <>{isEmpty?.(data) && empty ? empty : children(data)}</>;
  }
  if (query.isError) {
    return (
      <ErrorState
        title={errorTitle}
        description={errorDescription}
        onRetry={() => void query.refetch()}
        retrying={query.isFetching}
      />
    );
  }
  return (
    <>
      {loading ?? (
        <div className="flex flex-col gap-3">
          <Skeleton className="h-20" />
          <Skeleton className="h-20" />
          <Skeleton className="h-20" />
        </div>
      )}
    </>
  );
}

/** Etiqueta + control + hint/error, con ids y aria conectados. */
export function Field({
  label,
  hint,
  error,
  optional,
  required,
  className,
  children,
}: {
  label: ReactNode;
  hint?: ReactNode;
  error?: string | null;
  optional?: boolean;
  required?: boolean;
  className?: string;
  children: ReactElement<{
    id?: string;
    "aria-describedby"?: string;
    "aria-invalid"?: boolean;
  }>;
}) {
  const uid = useId();
  const id = children.props.id ?? uid;
  const hintId = `${id}-hint`;
  const errorId = `${id}-error`;
  const describedBy =
    [hint ? hintId : null, error ? errorId : null].filter(Boolean).join(" ") ||
    undefined;
  return (
    <div className={clsx("flex flex-col gap-1.5", className)}>
      <label htmlFor={id} className="text-sm text-muted">
        {label}
        {optional && " (opcional)"}
        {required && " *"}
      </label>
      {cloneElement(children, {
        id,
        "aria-describedby": describedBy,
        "aria-invalid": !!error,
      })}
      {hint && (
        <p id={hintId} className="text-xs text-muted">
          {hint}
        </p>
      )}
      {error && (
        <p id={errorId} role="alert" className="text-xs text-danger">
          {error}
        </p>
      )}
    </div>
  );
}

/** Como Field, para grupos de radios/chips (fieldset + legend). */
export function FieldGroup({
  label,
  hint,
  error,
  optional,
  required,
  className,
  children,
}: {
  label: ReactNode;
  hint?: ReactNode;
  error?: string | null;
  optional?: boolean;
  required?: boolean;
  className?: string;
  children: ReactNode;
}) {
  const id = useId();
  const hintId = `${id}-hint`;
  const errorId = `${id}-error`;
  const describedBy =
    [hint ? hintId : null, error ? errorId : null].filter(Boolean).join(" ") ||
    undefined;
  return (
    <fieldset
      className={clsx("flex flex-col gap-1.5 min-w-0", className)}
      aria-describedby={describedBy}
      aria-invalid={!!error || undefined}
    >
      <legend className="text-sm text-muted mb-1.5">
        {label}
        {optional && " (opcional)"}
        {required && " *"}
      </legend>
      {children}
      {hint && (
        <p id={hintId} className="text-xs text-muted">
          {hint}
        </p>
      )}
      {error && (
        <p id={errorId} role="alert" className="text-xs text-danger">
          {error}
        </p>
      )}
    </fieldset>
  );
}

// ---------------------------------------------------------------- Modal

/** true recién en el cliente (evita tocar `document` durante SSR/hidratación). */
function useIsClient(): boolean {
  return useSyncExternalStore(
    () => () => {},
    () => true,
    () => false,
  );
}

// Pila de modales abiertos (ids, el último es el de arriba). Escape y el
// focus trap los atiende solo el tope; el scroll lock se cuenta por
// referencias para que cerrar un modal anidado no libere el body del de abajo.
const modalStack: string[] = [];

function pushModal(id: string) {
  if (modalStack.length === 0) document.body.style.overflow = "hidden";
  modalStack.push(id);
}

function popModal(id: string) {
  const i = modalStack.indexOf(id);
  if (i !== -1) modalStack.splice(i, 1);
  if (modalStack.length === 0) document.body.style.overflow = "";
}

const FOCUSABLE =
  'a[href], button:not([disabled]), input:not([disabled]):not([type="hidden"]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

export function Modal({
  open,
  onClose,
  title,
  children,
  center,
  dismissible = true,
  hideClose,
  footer,
}: {
  open: boolean;
  onClose: () => void;
  title?: string;
  children: React.ReactNode;
  /** Centrado (diálogo) en vez de hoja pegada abajo. Para tooltips de info. */
  center?: boolean;
  /** false: ni el fondo ni Escape cierran (ej. mientras se guarda). */
  dismissible?: boolean;
  /** Oculta la X de cierre. */
  hideClose?: boolean;
  /** Pie fijo, fuera del área scrolleable. */
  footer?: ReactNode;
}) {
  const vp = useVisualViewport();
  const isClient = useIsClient();
  const id = useId();
  const titleId = `${id}-title`;
  const cardRef = useRef<HTMLDivElement>(null);
  // Refs con lo último: así el efecto de abajo no se re-suscribe (ni pierde el
  // foco) cada vez que el padre pasa un onClose nuevo.
  const onCloseRef = useRef(onClose);
  const dismissibleRef = useRef(dismissible);
  useEffect(() => {
    onCloseRef.current = onClose;
    dismissibleRef.current = dismissible;
  });

  const active = open && isClient;
  useEffect(() => {
    if (!active) return;
    const card = cardRef.current;
    const previous = document.activeElement as HTMLElement | null;
    pushModal(id);

    // React resuelve `autoFocus` llamando .focus() en el commit (sin emitir el
    // atributo), antes de este efecto: si el foco ya está adentro, se respeta
    // (si no, le robaríamos el foco al buscador y se cerraría el teclado).
    if (!card?.contains(document.activeElement)) {
      const initial = card?.querySelector<HTMLElement>(
        "[autofocus], [data-autofocus]",
      );
      (initial ?? card)?.focus({ preventScroll: true });
    }

    const onKey = (e: KeyboardEvent) => {
      if (modalStack[modalStack.length - 1] !== id) return;
      if (e.key === "Escape") {
        if (dismissibleRef.current) onCloseRef.current();
        return;
      }
      if (e.key !== "Tab" || !card) return;
      const items = Array.from(card.querySelectorAll<HTMLElement>(FOCUSABLE));
      if (items.length === 0) {
        e.preventDefault();
        card.focus();
        return;
      }
      const first = items[0];
      const last = items[items.length - 1];
      const current = document.activeElement;
      if (!card.contains(current) || current === card) {
        e.preventDefault();
        (e.shiftKey ? last : first).focus();
      } else if (e.shiftKey && current === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && current === last) {
        e.preventDefault();
        first.focus();
      }
    };
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("keydown", onKey);
      popModal(id);
      if (previous?.isConnected) previous.focus();
    };
  }, [active, id]);

  if (!active) return null;
  // Portal al body: un modal anidado quedaba dentro del contenedor del padre,
  // y un ancestro con backdrop-filter pasa a ser el containing block de
  // `position: fixed`, recortándolo.
  return createPortal(
    <div
      className={clsx(
        "fixed inset-x-0 z-50 flex justify-center bg-black/60 backdrop-blur-sm",
        // Sin visualViewport (SSR o navegador viejo): pantalla completa, como antes.
        vp ? "" : "inset-y-0",
        center ? "items-center p-4" : "items-end sm:items-center",
      )}
      // La capa se ancla a la zona VISIBLE, no al layout viewport: con el
      // teclado abierto una hoja `items-end` sobre `inset-0` queda atrás del
      // teclado (el layout viewport no se achica). Se usa top/height y no
      // transform a propósito: transform crearía un containing block para
      // cualquier `position: fixed` que se meta adentro del modal.
      style={vp ? { top: vp.offsetTop, height: vp.height } : undefined}
      onClick={(e) => {
        if (dismissible && e.target === e.currentTarget) onClose();
      }}
    >
      <div
        ref={cardRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={title ? titleId : undefined}
        aria-label={title ? undefined : "Diálogo"}
        tabIndex={-1}
        className={clsx(
          // 85% de la capa (que ya es la zona visible), no 85dvh: dvh ignora
          // el teclado. El 15% libre es el área para cerrar tocando afuera.
          "card max-h-[85%] flex flex-col outline-none",
          center
            ? "w-full max-w-md rounded-lg"
            : "w-full sm:max-w-lg rounded-b-none sm:rounded-lg",
        )}
      >
        {!center && (
          <div
            aria-hidden
            className="mx-auto mt-2 h-1 w-10 shrink-0 rounded-full bg-border sm:hidden"
          />
        )}
        {(title || !hideClose) && (
          <div
            className={clsx(
              "flex items-center gap-2 px-4 py-2",
              title ? "justify-between border-b border-border" : "justify-end",
            )}
          >
            {title && (
              <h2 id={titleId} className="font-semibold">
                {title}
              </h2>
            )}
            {!hideClose && (
              <IconButton label="Cerrar" onClick={onClose} className="-mr-2">
                <X className="size-5" />
              </IconButton>
            )}
          </div>
        )}
        <div className="overflow-y-auto p-4">{children}</div>
        {footer && (
          <div className="shrink-0 border-t border-border p-4">{footer}</div>
        )}
      </div>
    </div>,
    document.body,
  );
}

export function ConfirmDialog({
  open,
  title,
  description,
  confirmLabel,
  cancelLabel = "Cancelar",
  tone = "danger",
  loading,
  error,
  onConfirm,
  onCancel,
}: {
  open: boolean;
  title: string;
  description?: ReactNode;
  confirmLabel: string;
  cancelLabel?: string;
  tone?: "danger" | "primary";
  loading?: boolean;
  error?: string | null;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  return (
    <Modal
      open={open}
      onClose={onCancel}
      title={title}
      center
      dismissible={!loading}
      footer={
        <div className="flex gap-3">
          <Button
            variant="secondary"
            className="flex-1"
            onClick={onCancel}
            disabled={loading}
          >
            {cancelLabel}
          </Button>
          <Button
            variant={tone}
            className="flex-1"
            onClick={onConfirm}
            loading={loading}
          >
            {confirmLabel}
          </Button>
        </div>
      }
    >
      <div className="flex flex-col gap-3">
        {description && <div className="text-sm text-muted">{description}</div>}
        {error && (
          <p role="alert" className="text-sm text-danger">
            {error}
          </p>
        )}
      </div>
    </Modal>
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
          <IconButton
            size="sm"
            label={`Qué significa ${label}`}
            onClick={() => setShowInfo(true)}
            className="-my-2"
          >
            <Info className="size-3" />
          </IconButton>
        )}
      </div>
      <p className="text-xl font-bold mt-1.5 tracking-tight leading-none">
        {value}
        {unit && <span className="text-xs text-muted font-medium ml-1">{unit}</span>}
      </p>
      {sub && <p className="text-2xs text-muted mt-1">{sub}</p>}
      {delta != null && (
        <div className="mt-2">
          <DeltaChip pct={delta} suffix={deltaSuffix} />
        </div>
      )}
      {secondary && <p className="text-2xs text-muted mt-1.5">{secondary}</p>}
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

/** Chip de variación: flecha + % redondeado, verde si sube, rojo si baja, neutro si no cambia. */
export function DeltaChip({ pct, suffix }: { pct: number; suffix?: string }) {
  const rounded = Math.round(pct);
  const flat = rounded === 0;
  const up = pct > 0;
  const Arrow = flat ? Minus : up ? ArrowUp : ArrowDown;
  return (
    <span
      className={clsx(
        "inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-2xs font-semibold",
        flat
          ? "bg-surface-2 text-muted"
          : up
            ? "bg-success/15 text-success"
            : "bg-danger/15 text-danger",
      )}
    >
      <Arrow className="size-2.5" strokeWidth={3} />
      {Math.abs(rounded)}%{suffix ? ` ${suffix}` : ""}
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
              <IconButton
                size="sm"
                label={`Qué significa ${title}`}
                onClick={() => setShowInfo(true)}
                className="-my-2"
              >
                <Info className="size-3.5" />
              </IconButton>
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
  ariaLabel,
  size = "md",
}: {
  value: T;
  onChange: (v: T) => void;
  options: { value: T; label: string }[];
  scroll?: boolean;
  ariaLabel?: string;
  size?: "sm" | "md";
}) {
  const refs = useRef<(HTMLButtonElement | null)[]>([]);

  // Roving tabindex: solo la opción elegida entra al orden de Tab; las
  // flechas mueven selección y foco, como un radiogroup nativo.
  const onKeyDown = (e: React.KeyboardEvent, index: number) => {
    if (e.key !== "ArrowRight" && e.key !== "ArrowLeft") return;
    e.preventDefault();
    const step = e.key === "ArrowRight" ? 1 : -1;
    const next = (index + step + options.length) % options.length;
    onChange(options[next].value);
    refs.current[next]?.focus();
  };

  return (
    <div
      role="radiogroup"
      aria-label={ariaLabel}
      className={clsx(
        "flex gap-1 rounded-md bg-surface-2 p-1",
        // Desvanece el borde derecho para sugerir que hay más opciones.
        scroll &&
          "overflow-x-auto no-scrollbar [mask-image:linear-gradient(to_right,black_85%,transparent)]",
      )}
    >
      {options.map((opt, i) => {
        const selected = value === opt.value;
        return (
          <button
            key={opt.value}
            ref={(el) => {
              refs.current[i] = el;
            }}
            type="button"
            role="radio"
            aria-checked={selected}
            tabIndex={selected ? 0 : -1}
            onClick={() => onChange(opt.value)}
            onKeyDown={(e) => onKeyDown(e, i)}
            className={clsx(
              "rounded text-sm font-medium transition whitespace-nowrap",
              FOCUS_RING,
              size === "sm" ? "min-h-9 py-1.5" : "min-h-10 py-2",
              scroll ? "px-3" : "flex-1",
              selected
                ? "bg-primary text-primary-fg"
                : "text-muted hover:text-fg",
            )}
          >
            {opt.label}
          </button>
        );
      })}
    </div>
  );
}

/** Interruptor de fila completa (toda la fila es el área táctil). */
export function Switch({
  checked,
  onChange,
  label,
  description,
  disabled,
  className,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  label: string;
  description?: string;
  disabled?: boolean;
  className?: string;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className={clsx(
        "min-h-11 w-full flex items-center justify-between gap-3 text-left rounded-md disabled:opacity-50 disabled:pointer-events-none",
        FOCUS_RING,
        className,
      )}
    >
      <span className="min-w-0">
        <span className="block text-sm text-fg">{label}</span>
        {description && (
          <span className="block text-xs text-muted">{description}</span>
        )}
      </span>
      <span
        aria-hidden
        className={clsx(
          "relative h-6 w-11 shrink-0 rounded-full transition-colors",
          checked ? "bg-primary" : "bg-border",
        )}
      >
        <span
          className={clsx(
            "absolute left-0.5 top-0.5 size-5 rounded-full bg-white shadow transition-transform",
            checked ? "translate-x-5" : "translate-x-0",
          )}
        />
      </span>
    </button>
  );
}
