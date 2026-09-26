import {
  forwardRef,
  useId,
  type InputHTMLAttributes,
  type ReactNode,
  type TextareaHTMLAttributes,
} from "react";
import { Minus, Plus } from "lucide-react";
import { cn } from "../../lib/cn";

const control =
  "w-full rounded border border-line bg-panel px-2.5 text-base text-ink shadow-xs outline-none transition-[border-color,box-shadow] duration-150 placeholder:text-ink-3 hover:border-line-strong focus:border-accent focus:ring-[3px] focus:ring-accent/20 disabled:cursor-not-allowed disabled:bg-subtle disabled:text-ink-3 aria-[invalid=true]:border-danger aria-[invalid=true]:focus:ring-danger/20";

export const Input = forwardRef<HTMLInputElement, InputHTMLAttributes<HTMLInputElement>>(
  function Input({ className, ...props }, ref) {
    return <input ref={ref} className={cn(control, "h-9 coarse:h-11", className)} {...props} />;
  }
);

export const Textarea = forwardRef<
  HTMLTextAreaElement,
  TextareaHTMLAttributes<HTMLTextAreaElement>
>(function Textarea({ className, ...props }, ref) {
  return (
    <textarea
      ref={ref}
      className={cn(control, "min-h-[72px] resize-y py-2 leading-5", className)}
      {...props}
    />
  );
});

interface FieldProps {
  label: ReactNode;
  hint?: ReactNode;
  error?: string | null;
  className?: string;
  children: (id: string, describedBy: string | undefined) => ReactNode;
}

/** Etiqueta + control + ayuda/error, con los ids enlazados para lectores de pantalla. */
export function Field({ label, hint, error, className, children }: FieldProps) {
  const id = useId();
  const messageId = `${id}-message`;
  const hasMessage = Boolean(error || hint);
  return (
    <div className={cn("flex flex-col gap-1.5", className)}>
      <label htmlFor={id} className="text-sm font-medium text-ink">
        {label}
      </label>
      {children(id, hasMessage ? messageId : undefined)}
      {error ? (
        <p id={messageId} className="text-sm text-danger">
          {error}
        </p>
      ) : hint ? (
        <p id={messageId} className="text-sm text-ink-2">
          {hint}
        </p>
      ) : null}
    </div>
  );
}

interface MinutesInputProps {
  id?: string;
  value: number | "";
  onChange: (value: number | "") => void;
  min?: number;
  max?: number;
  step?: number;
  invalid?: boolean;
  describedBy?: string;
  "aria-label"?: string;
}

/** Número de minutos con botones −/+ (cómodos en táctil) y sufijo "min". */
export function MinutesInput({
  id,
  value,
  onChange,
  min = 1,
  max = 1440,
  step = 5,
  invalid,
  describedBy,
  ...aria
}: MinutesInputProps) {
  const numeric = value === "" ? 0 : value;
  const nudge = (delta: number) => {
    const base = delta > 0 ? Math.floor(numeric / step) * step : Math.ceil(numeric / step) * step;
    const next = base === numeric ? numeric + delta : delta > 0 ? base + step : base - step;
    onChange(Math.min(max, Math.max(min, next)));
  };
  return (
    <div
      className={cn(
        "flex h-9 items-stretch overflow-hidden rounded border border-line bg-panel shadow-xs transition-[border-color,box-shadow] focus-within:border-accent focus-within:ring-[3px] focus-within:ring-accent/20 hover:border-line-strong coarse:h-11",
        invalid && "border-danger focus-within:border-danger focus-within:ring-danger/20"
      )}
    >
      <button
        type="button"
        tabIndex={-1}
        aria-hidden
        onClick={() => nudge(-step)}
        className="flex w-8 items-center justify-center text-ink-3 transition-colors hover:bg-hover hover:text-ink coarse:w-11"
      >
        <Minus className="size-3.5" />
      </button>
      <div className="flex flex-1 items-center justify-center gap-1">
        <input
          id={id}
          type="number"
          inputMode="numeric"
          min={min}
          max={max}
          value={value}
          aria-invalid={invalid || undefined}
          aria-describedby={describedBy}
          aria-label={aria["aria-label"]}
          onChange={(event) => {
            const raw = event.target.value;
            if (raw === "") return onChange("");
            const parsed = Math.round(Number(raw));
            if (!Number.isNaN(parsed)) onChange(parsed);
          }}
          className="tabular w-12 bg-transparent text-right text-base font-medium text-ink outline-none"
        />
        <span className="text-sm text-ink-3">min</span>
      </div>
      <button
        type="button"
        tabIndex={-1}
        aria-hidden
        onClick={() => nudge(step)}
        className="flex w-8 items-center justify-center text-ink-3 transition-colors hover:bg-hover hover:text-ink coarse:w-11"
      >
        <Plus className="size-3.5" />
      </button>
    </div>
  );
}
