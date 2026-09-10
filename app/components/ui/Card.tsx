import { HTMLAttributes } from "react";

export interface CardProps extends HTMLAttributes<HTMLDivElement> {
  padded?: boolean;
}

export function Card({
  padded = true,
  className = "",
  children,
  ...rest
}: CardProps) {
  return (
    <div
      className={[
        "rounded-card border border-line bg-surface",
        padded ? "p-4" : "",
        className,
      ].join(" ")}
      {...rest}
    >
      {children}
    </div>
  );
}
