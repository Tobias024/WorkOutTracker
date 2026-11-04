// SPDX-License-Identifier: AGPL-3.0-only
import { create } from "zustand";

export type ToastTone = "default" | "success" | "danger";
export interface ToastAction {
  label: string;
  onClick: () => void;
}
export interface ToastOptions {
  tone?: ToastTone;
  action?: ToastAction;
  /** ms, default 4000; 0 = sticky */
  duration?: number;
  /** mismo id reemplaza el toast existente (dedupe) */
  id?: string;
}
export interface ToastItem {
  id: string;
  message: string;
  tone: ToastTone;
  action?: ToastAction;
  duration: number;
}

const MAX_VISIBLE = 3;

interface ToastState {
  toasts: ToastItem[];
}

export const useToastStore = create<ToastState>(() => ({ toasts: [] }));

const timers = new Map<string, ReturnType<typeof setTimeout>>();
let seq = 0;

function clearTimer(id: string) {
  const t = timers.get(id);
  if (t) clearTimeout(t);
  timers.delete(id);
}

export function dismissToast(id: string): void {
  clearTimer(id);
  useToastStore.setState((s) => ({
    toasts: s.toasts.filter((t) => t.id !== id),
  }));
}

export function toast(message: string, opts: ToastOptions = {}): string {
  const id = opts.id ?? `t${++seq}`;
  const item: ToastItem = {
    id,
    message,
    tone: opts.tone ?? "default",
    action: opts.action,
    duration: opts.duration ?? 4000,
  };
  clearTimer(id);
  const existing = useToastStore.getState().toasts;
  // Mismo id: reemplaza en el lugar; si no, agrega abajo (el más nuevo).
  const next = existing.some((t) => t.id === id)
    ? existing.map((t) => (t.id === id ? item : t))
    : [...existing, item];
  const dropped = next.slice(0, Math.max(0, next.length - MAX_VISIBLE));
  dropped.forEach((t) => clearTimer(t.id));
  useToastStore.setState({ toasts: next.slice(-MAX_VISIBLE) });
  if (item.duration > 0 && typeof window !== "undefined") {
    timers.set(
      id,
      setTimeout(() => dismissToast(id), item.duration),
    );
  }
  return id;
}

// ---- undoable -------------------------------------------------------------

interface Pending {
  commit: () => unknown;
  done: boolean;
  toastId: string;
}
const pending = new Set<Pending>();
let flushBound = false;

function run(p: Pending): Promise<unknown> {
  if (p.done) return Promise.resolve();
  p.done = true;
  pending.delete(p);
  clearTimer(`${p.toastId}:commit`);
  dismissToast(p.toastId);
  try {
    const r = p.commit();
    if (r && typeof (r as Promise<unknown>).catch === "function") {
      return (r as Promise<unknown>).catch(() => {});
    }
  } catch {
    // el caller maneja sus errores (ej. mutationCache.onError)
  }
  return Promise.resolve();
}

function flushAll() {
  void flushUndoables();
}

/**
 * Ejecuta YA todos los `undoable` pendientes y espera sus commits (si
 * devuelven promesa). Usarlo antes de una acción que depende del estado del
 * servidor, ej. terminar el entreno con un ejercicio recién quitado: si no,
 * sus series contarían en los logros/ranking.
 */
export function flushUndoables(): Promise<void> {
  return Promise.all([...pending].map(run)).then(() => undefined);
}

function bindFlush() {
  if (flushBound || typeof window === "undefined") return;
  flushBound = true;
  window.addEventListener("pagehide", flushAll);
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "hidden") flushAll();
  });
}

/**
 * El caller ya aplicó el cambio en la UI (ej. ocultó la fila). Muestra
 * "Deshacer" durante `ms`; si se toca → undo() y nunca commit; si vence (o la
 * app pasa a segundo plano) → commit() una sola vez.
 */
export function undoable(opts: {
  message: string;
  commit: () => unknown;
  undo?: () => void;
  ms?: number;
  undoLabel?: string;
}): void {
  bindFlush();
  const toastId = `undo${++seq}`;
  const p: Pending = { commit: opts.commit, done: false, toastId };
  pending.add(p);
  const ms = opts.ms ?? 5000;
  toast(opts.message, {
    id: toastId,
    duration: 0, // el vencimiento lo maneja el timer de commit
    action: {
      label: opts.undoLabel ?? "Deshacer",
      onClick: () => {
        if (p.done) return;
        p.done = true;
        pending.delete(p);
        clearTimer(`${toastId}:commit`);
        dismissToast(toastId);
        opts.undo?.();
      },
    },
  });
  timers.set(`${toastId}:commit`, setTimeout(() => run(p), ms));
}
