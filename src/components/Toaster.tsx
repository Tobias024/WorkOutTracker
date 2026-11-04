// SPDX-License-Identifier: AGPL-3.0-only
"use client";

import { AlertCircle, CheckCircle2, X } from "lucide-react";
import { dismissToast, useToastStore, type ToastItem } from "@/lib/toast";

function ToastView({ t }: { t: ToastItem }) {
  return (
    <div
      className="toast-in pointer-events-auto card shadow-lg px-4 py-3 text-sm flex items-center gap-3"
    >
      {t.tone === "success" && (
        <CheckCircle2 className="size-5 shrink-0 text-success" aria-hidden />
      )}
      {t.tone === "danger" && (
        <AlertCircle className="size-5 shrink-0 text-danger" aria-hidden />
      )}
      <span className="flex-1 min-w-0">{t.message}</span>
      {t.action && (
        <button
          type="button"
          className="min-h-11 px-2 font-semibold text-primary"
          onClick={() => {
            t.action?.onClick();
            dismissToast(t.id);
          }}
        >
          {t.action.label}
        </button>
      )}
      <button
        type="button"
        aria-label="Cerrar aviso"
        className="size-11 grid place-items-center shrink-0 -mr-2 text-muted"
        onClick={() => dismissToast(t.id)}
      >
        <X className="size-4" aria-hidden />
      </button>
    </div>
  );
}

export function Toaster() {
  const toasts = useToastStore((s) => s.toasts);
  return (
    <div
      role="status"
      aria-live="polite"
      className="fixed inset-x-0 z-[60] px-4 pointer-events-none"
      style={{ bottom: "calc(5.5rem + env(safe-area-inset-bottom))" }}
    >
      <div className="max-w-md mx-auto flex flex-col gap-2">
        {toasts.map((t) => (
          <ToastView key={t.id} t={t} />
        ))}
      </div>
    </div>
  );
}
