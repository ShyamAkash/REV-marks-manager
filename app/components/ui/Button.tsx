"use client";

import { ButtonHTMLAttributes, forwardRef } from "react";

type Variant = "primary" | "secondary" | "ghost" | "danger";
type Size = "sm" | "md" | "lg";

// Button labels use pure #ffffff on brand-deep = 4.67:1.
// paper (#f4f4f2) on brand would be 4.09:1 and fail WCAG AA.
const VARIANTS: Record<Variant, string> = {
  primary:
    "bg-brand-deep text-white hover:bg-brand disabled:bg-brand-dim disabled:text-faint",
  secondary:
    "bg-surface-2 text-paper border border-line hover:border-dim disabled:text-faint",
  ghost: "bg-transparent text-dim hover:text-paper disabled:text-faint",
  danger:
    "bg-transparent text-danger border border-danger/40 hover:bg-danger/10 disabled:text-faint",
};

const SIZES: Record<Size, string> = {
  sm: "min-h-[36px] px-3 text-label",
  md: "min-h-[48px] px-4 text-body",
  lg: "min-h-[56px] px-5 text-body",
};

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
  fullWidth?: boolean;
  loading?: boolean;
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  {
    variant = "primary",
    size = "md",
    fullWidth = false,
    loading = false,
    disabled,
    children,
    className = "",
    type = "button",
    ...rest
  },
  ref
) {
  return (
    <button
      ref={ref}
      type={type}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      className={[
        "inline-flex items-center justify-center gap-2 rounded-control font-semibold",
        "transition-colors disabled:cursor-not-allowed",
        VARIANTS[variant],
        SIZES[size],
        fullWidth ? "w-full" : "",
        className,
      ].join(" ")}
      {...rest}
    >
      {loading && (
        <span
          aria-hidden="true"
          className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent"
        />
      )}
      {children}
    </button>
  );
});
