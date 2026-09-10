"use client";

import {
  ReactNode,
  createContext,
  useCallback,
  useContext,
  useMemo,
  useRef,
  useState,
} from "react";

type Tone = "ok" | "warn" | "danger";

interface ToastState {
  id: number;
  message: string;
  tone: Tone;
}

const ToastContext = createContext<
  ((message: string, tone?: Tone) => void) | null
>(null);

const TONE_STYLES: Record<Tone, string> = {
  ok: "border-ok/40 bg-ok/15 text-paper",
  warn: "border-warn/40 bg-warn/15 text-paper",
  danger: "border-danger/40 bg-danger/15 text-paper",
};

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toast, setToast] = useState<ToastState | null>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const nextId = useRef(0);

  const show = useCallback((message: string, tone: Tone = "ok") => {
    if (timerRef.current) clearTimeout(timerRef.current);
    nextId.current += 1;
    setToast({ id: nextId.current, message, tone });
    timerRef.current = setTimeout(() => setToast(null), 2400);
  }, []);

  const value = useMemo(() => show, [show]);

  return (
    <ToastContext.Provider value={value}>
      {children}
      <div
        aria-live="polite"
        className="pointer-events-none fixed inset-x-0 bottom-[calc(64px+env(safe-area-inset-bottom))] z-[60] flex justify-center px-4"
      >
        {toast && (
          <div
            key={toast.id}
            className={[
              "animate-fade-in rounded-control border px-4 py-2.5 text-label shadow-lg",
              TONE_STYLES[toast.tone],
            ].join(" ")}
          >
            {toast.message}
          </div>
        )}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast() {
  const ctx = useContext(ToastContext);
  if (!ctx) {
    throw new Error("useToast must be used inside <ToastProvider>");
  }
  return ctx;
}
