"use client";

import { createContext, useCallback, useContext, useEffect, useRef, useState } from "react";
import { X, CheckCircle2, AlertTriangle, Info } from "lucide-react";
import { cn } from "@/lib/utils";

type ToastType = "success" | "error" | "info";
type ToastAction = { label: string; onClick: () => void };
type ToastOptions = { action?: ToastAction; duration?: number };
type Toast = { id: number; message: string; type: ToastType; action?: ToastAction; duration: number; leaving?: boolean };

type ToastFn = (message: string, type?: ToastType, opts?: ToastOptions) => void;
const ToastContext = createContext<{ toast: ToastFn }>({ toast: () => {} });

export const useToast = () => useContext(ToastContext);

const MAX_VISIBLE = 4;
let nextId = 1;

/**
 * Toasts with an optional action ("Deshacer", "Reintentar"), pause on hover,
 * enter/exit animation and a cap on how many stack at once.
 */
export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const remove = useCallback((id: number) => {
    setToasts((prev) => prev.map((t) => (t.id === id ? { ...t, leaving: true } : t)));
    setTimeout(() => setToasts((prev) => prev.filter((t) => t.id !== id)), 180);
  }, []);

  const toast = useCallback<ToastFn>((message, type = "info", opts = {}) => {
    const id = nextId++;
    const duration = opts.duration ?? (opts.action ? 6000 : type === "error" ? 6000 : type === "success" ? 3000 : 4000);
    setToasts((prev) => [...prev, { id, message, type, action: opts.action, duration }].slice(-MAX_VISIBLE));
  }, []);

  return (
    <ToastContext.Provider value={{ toast }}>
      {children}
      <div
        aria-live="polite"
        className="pointer-events-none fixed inset-x-4 bottom-20 z-[100] flex flex-col items-center gap-2 sm:inset-x-auto sm:bottom-4 sm:right-4 sm:items-end lg:bottom-4"
      >
        {toasts.map((t) => (
          <ToastItem key={t.id} toast={t} onClose={() => remove(t.id)} />
        ))}
      </div>
    </ToastContext.Provider>
  );
}

const ICON = { success: CheckCircle2, error: AlertTriangle, info: Info };
const ACCENT = { success: "text-success", error: "text-destructive", info: "text-info" };

function ToastItem({ toast: t, onClose }: { toast: Toast; onClose: () => void }) {
  const remaining = useRef(t.duration);
  const startedAt = useRef(Date.now());
  const timer = useRef<ReturnType<typeof setTimeout>>();

  const start = useCallback(() => {
    startedAt.current = Date.now();
    timer.current = setTimeout(onClose, remaining.current);
  }, [onClose]);
  const pause = () => {
    clearTimeout(timer.current);
    remaining.current -= Date.now() - startedAt.current;
  };

  useEffect(() => {
    start();
    return () => clearTimeout(timer.current);
  }, [start]);

  const Icon = ICON[t.type];
  return (
    <div
      role={t.type === "error" ? "alert" : "status"}
      onMouseEnter={pause}
      onMouseLeave={start}
      className={cn(
        "pointer-events-auto flex w-full max-w-sm items-start gap-3 rounded-xl border border-border bg-card px-4 py-3 text-sm text-card-foreground shadow-lg",
        t.leaving
          ? "animate-out fade-out-0 slide-out-to-right-4 duration-150"
          : "animate-in fade-in-0 slide-in-from-bottom-2 duration-200",
      )}
    >
      <Icon className={cn("mt-0.5 h-4 w-4 shrink-0", ACCENT[t.type])} aria-hidden />
      <p className="flex-1 leading-snug">{t.message}</p>
      {t.action && (
        <button
          onClick={() => {
            t.action?.onClick();
            onClose();
          }}
          className="shrink-0 rounded-md px-2 py-0.5 text-sm font-semibold text-primary hover:bg-primary/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          {t.action.label}
        </button>
      )}
      <button
        onClick={onClose}
        aria-label="Cerrar aviso"
        className="-mr-1 shrink-0 rounded-md p-1 text-muted-foreground hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        <X className="h-3.5 w-3.5" />
      </button>
    </div>
  );
}
