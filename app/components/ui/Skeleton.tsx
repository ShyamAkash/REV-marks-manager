export function Skeleton({ className = "" }: { className?: string }) {
  return (
    <div
      aria-hidden="true"
      className={["animate-pulse rounded-control bg-surface-2", className].join(" ")}
    />
  );
}
