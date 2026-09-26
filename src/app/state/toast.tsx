import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { createPortal } from "react-dom";
import { AlertCircle, Check, X } from "lucide-react";
import { t } from "../i18n";
import { cn } from "../lib/cn";

type Tone = "neutral" | "reward" | "error";

export interface ToastInput {
  title: string;
  description?: string;
  tone?: Tone;
  /** Para avisos de recompensa: "+30" */
  tempos?: number;
  duration?: number;
}

interface ToastItem extends ToastInput {
  id: number;
}

const ToastContext = createContext<((toast: ToastInput) => void) | null>(null);

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const nextId = useRef(1);

  const dismiss = useCallback((id: number) => {
    setToasts((current) => current.filter((toast) => toast.id !== id));
  }, []);

  const push = useCallback((toast: ToastInput) => {
    const id = nextId.current++;
    setToasts((current) => [...current.slice(-2), { ...toast, id }]);
  }, []);

  return (
    <ToastContext.Provider value={push}>
      {children}
      {createPortal(
        <div
          aria-live="polite"
          className="pointer-events-none fixed inset-x-0 bottom-[calc(76px+env(safe-area-inset-bottom))] z-[60] flex flex-col items-center gap-2 px-4 lg:inset-x-auto lg:bottom-6 lg:right-6 lg:items-end"
        >
          {toasts.map((toast) => (
            <ToastView key={toast.id} toast={toast} onDismiss={() => dismiss(toast.id)} />
          ))}
        </div>,
        document.body
      )}
    </ToastContext.Provider>
  );
}

function ToastView({ toast, onDismiss }: { toast: ToastItem; onDismiss: () => void }) {
  const [paused, setPaused] = useState(false);
  const tone = toast.tone ?? "neutral";

  useEffect(() => {
    if (paused) return;
    const timeout = setTimeout(onDismiss, toast.duration ?? (tone === "error" ? 7000 : 4500));
    return () => clearTimeout(timeout);
  }, [paused, onDismiss, toast.duration, tone]);

  return (
    <div
      role={tone === "error" ? "alert" : "status"}
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      className="pointer-events-auto flex w-full max-w-sm animate-toast-in items-start gap-3 rounded-lg border border-line bg-panel py-3 pl-3 pr-2 shadow-pop"
    >
      {tone === "reward" && toast.tempos !== undefined ? (
        <span className="tabular mt-px inline-flex h-6 min-w-[44px] shrink-0 items-center justify-center rounded-md bg-tempo/15 px-1.5 text-sm font-semibold text-tempo-ink">
          +{toast.tempos}
        </span>
      ) : (
        <span
          className={cn(
            "mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-full",
            tone === "error" ? "bg-danger/10 text-danger" : "bg-success/10 text-success"
          )}
        >
          {tone === "error" ? (
            <AlertCircle className="size-3.5" />
          ) : (
            <Check className="size-3.5" strokeWidth={2.5} />
          )}
        </span>
      )}
      <div className="min-w-0 flex-1 pt-0.5">
        <p className="text-sm font-medium text-ink">{toast.title}</p>
        {toast.description && <p className="mt-0.5 text-sm text-ink-2">{toast.description}</p>}
      </div>
      <button
        type="button"
        onClick={onDismiss}
        aria-label={t("toast.dismiss")}
        className="flex size-7 shrink-0 items-center justify-center rounded text-ink-3 transition-colors hover:bg-hover hover:text-ink"
      >
        <X className="size-4" />
      </button>
    </div>
  );
}

export function useToast() {
  const context = useContext(ToastContext);
  if (!context) throw new Error("useToast debe usarse dentro de <ToastProvider>");
  return context;
}
