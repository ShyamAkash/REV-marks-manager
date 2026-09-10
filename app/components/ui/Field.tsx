"use client";

import { InputHTMLAttributes, forwardRef, useId } from "react";

export interface FieldProps
  extends Omit<InputHTMLAttributes<HTMLInputElement>, "size"> {
  label: string;
  /** Right-aligned hint beside the label, e.g. "/50" for a max mark. */
  hint?: string;
  /** When set the field renders in a warning state and the message shows below. */
  error?: string;
  size?: "md" | "lg";
}

export const Field = forwardRef<HTMLInputElement, FieldProps>(function Field(
  { label, hint, error, size = "md", className = "", id, ...rest },
  ref
) {
  const autoId = useId();
  const inputId = id ?? autoId;
  const errorId = `${inputId}-error`;

  return (
    <div className="flex w-full flex-col">
      <div className="flex items-baseline justify-between gap-2">
        <label htmlFor={inputId} className="field-label">
          {label}
        </label>
        {hint && <span className="num text-micro text-dim">{hint}</span>}
      </div>
      <input
        ref={ref}
        id={inputId}
        aria-invalid={error ? true : undefined}
        aria-describedby={error ? errorId : undefined}
        className={[
          "field",
          size === "lg" ? "field-lg" : "",
          error ? "!border-warn bg-warn/10 text-warn" : "",
          className,
        ].join(" ")}
        {...rest}
      />
      {error && (
        <span id={errorId} className="mt-1 text-micro font-medium text-warn">
          {error}
        </span>
      )}
    </div>
  );
});
