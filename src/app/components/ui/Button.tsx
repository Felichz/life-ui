import { forwardRef, type ButtonHTMLAttributes } from "react";
import { Loader2 } from "lucide-react";
import { cn } from "../../lib/cn";

type Variant = "primary" | "secondary" | "ghost" | "danger" | "subtle";
type Size = "sm" | "md" | "lg";

const VARIANTS: Record<Variant, string> = {
  primary:
    "bg-accent-fill text-white shadow-xs hover:bg-accent-fill-hover active:bg-accent-fill-hover disabled:bg-accent-fill/45 disabled:text-white/80",
  secondary:
    "border border-line bg-panel text-ink shadow-xs hover:border-line-strong hover:bg-subtle active:bg-hover disabled:text-ink-3",
  ghost: "text-ink-2 hover:bg-hover hover:text-ink active:bg-hover disabled:text-ink-3",
  subtle: "bg-hover/70 text-ink hover:bg-hover active:bg-line/70 disabled:text-ink-3",
  danger: "bg-danger-fill text-white shadow-xs hover:bg-danger-fill/90 disabled:bg-danger-fill/45",
};

const SIZES: Record<Size, string> = {
  sm: "h-7 gap-1.5 rounded px-2.5 text-sm coarse:h-9",
  md: "h-8 gap-2 rounded px-3 text-sm coarse:h-10 coarse:px-3.5",
  lg: "h-10 gap-2 rounded-md px-4 text-md coarse:h-11",
};

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
  loading?: boolean;
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  {
    variant = "secondary",
    size = "md",
    loading = false,
    className,
    children,
    disabled,
    type = "button",
    ...props
  },
  ref
) {
  return (
    <button
      ref={ref}
      type={type}
      disabled={disabled || loading}
      className={cn(
        "inline-flex shrink-0 select-none items-center justify-center whitespace-nowrap font-medium transition-[background-color,border-color,color,box-shadow] duration-150 disabled:cursor-not-allowed [&_svg]:size-4 [&_svg]:shrink-0",
        VARIANTS[variant],
        SIZES[size],
        className
      )}
      {...props}
    >
      {loading && <Loader2 className="animate-spin" aria-hidden />}
      {children}
    </button>
  );
});

export interface IconButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  label: string;
  variant?: "ghost" | "secondary" | "primary";
  size?: "sm" | "md";
}

export const IconButton = forwardRef<HTMLButtonElement, IconButtonProps>(function IconButton(
  { label, variant = "ghost", size = "md", className, children, type = "button", ...props },
  ref
) {
  return (
    <button
      ref={ref}
      type={type}
      aria-label={label}
      className={cn(
        "inline-flex shrink-0 items-center justify-center rounded transition-colors duration-150 disabled:cursor-not-allowed disabled:opacity-45 [&_svg]:shrink-0",
        size === "sm"
          ? "size-7 coarse:size-9 [&_svg]:size-4"
          : "size-8 coarse:size-10 [&_svg]:size-[18px]",
        variant === "ghost" && "text-ink-2 hover:bg-hover hover:text-ink",
        variant === "secondary" &&
          "border border-line bg-panel text-ink-2 shadow-xs hover:bg-subtle hover:text-ink",
        variant === "primary" && "bg-accent-fill text-white shadow-xs hover:bg-accent-fill-hover",
        className
      )}
      {...props}
    >
      {children}
    </button>
  );
});
