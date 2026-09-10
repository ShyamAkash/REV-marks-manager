export type Tone = "ok" | "warn" | "danger" | "idle";

const TONES: Record<Tone, string> = {
  ok: "bg-ok",
  warn: "bg-warn",
  danger: "bg-danger",
  idle: "bg-faint",
};

export function StatusDot({
  tone,
  pulse = false,
}: {
  tone: Tone;
  pulse?: boolean;
}) {
  return (
    <span
      aria-hidden="true"
      className={[
        "inline-block h-2 w-2 shrink-0 rounded-full",
        TONES[tone],
        pulse ? "animate-pulse" : "",
      ].join(" ")}
    />
  );
}
