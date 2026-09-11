"use client";

import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from "react";
import { Eye, EyeOff, Lock, ShieldCheck } from "lucide-react";
import { Button, Field } from "@/app/components/ui";

/**
 * "This device has been unlocked" - a hint, not a credential. The credential is
 * the httpOnly `revmarks_auth` cookie, which page scripts cannot read; it is
 * what middleware.ts checks on every /api/* request. This flag exists so the
 * app opens straight into Mark mode with no connection, where asking the server
 * is not an option.
 */
const AUTH_UNLOCKED_KEY = "revmarks_auth_unlocked";
/** The pre-httpOnly scheme kept the token itself here. Migrated away on mount. */
const LEGACY_TOKEN_KEY = "revmarks_auth_token";

interface AuthContextType {
  isAuthenticated: boolean;
  lockDevice: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType>({
  isAuthenticated: false,
  lockDevice: async () => {},
});

export function useAuth() {
  return useContext(AuthContext);
}

export function PasswordGate({ children }: { children: React.ReactNode }) {
  // "loading" = checking local storage/cookie
  // "locked" = needs password
  // "authenticated" = verified on this device
  const [status, setStatus] = useState<"loading" | "locked" | "authenticated">("loading");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Check saved device credentials on mount
  useEffect(() => {
    let cancelled = false;

    let unlocked = false;
    try {
      // The old scheme stored the token in localStorage and set the cookie from
      // JS. The cookie it left behind holds the same value the server issues, so
      // it still passes middleware - only the local bookkeeping moves.
      if (localStorage.getItem(LEGACY_TOKEN_KEY)) {
        localStorage.setItem(AUTH_UNLOCKED_KEY, "true");
        localStorage.removeItem(LEGACY_TOKEN_KEY);
      }
      unlocked = localStorage.getItem(AUTH_UNLOCKED_KEY) === "true";
    } catch {
      // localStorage unavailable (Safari private browsing): fall through to the
      // server check, and to the password screen if that cannot be reached.
    }

    // Show the app immediately rather than blocking on the network; the check
    // below revokes access if the password has since been changed.
    if (unlocked) {
      setStatus("authenticated");
    } else if (typeof navigator !== "undefined" && !navigator.onLine) {
      // Never unlocked here and no way to ask. Nothing to do but prompt.
      setStatus("locked");
      return;
    }

    // No Authorization header: the token is in an httpOnly cookie the browser
    // attaches itself, and the page can no longer read it.
    fetch("/api/auth/verify")
      .then((res) => res.json())
      .then((data) => {
        if (cancelled) return;
        if (data && data.authenticated) {
          try {
            localStorage.setItem(AUTH_UNLOCKED_KEY, "true");
          } catch {}
          setStatus("authenticated");
          return;
        }
        // Either this device was never unlocked, or APP_PASSWORD was changed
        // and the cookie it holds no longer matches.
        try {
          localStorage.removeItem(AUTH_UNLOCKED_KEY);
        } catch {}
        setStatus("locked");
        if (unlocked) {
          setError(
            "Server access password was updated. Please enter the new password."
          );
        }
      })
      .catch(() => {
        // Ignore network drops; keep offline access valid.
        if (!cancelled && !unlocked) setStatus("locked");
      });

    return () => {
      cancelled = true;
    };
  }, []);

  // Autofocus password input when locked
  useEffect(() => {
    if (status === "locked") {
      const t = setTimeout(() => {
        inputRef.current?.focus();
      }, 100);
      return () => clearTimeout(t);
    }
  }, [status]);

  const handleUnlock = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!password.trim()) {
      setError("Please enter the password");
      inputRef.current?.focus();
      return;
    }

    setSubmitting(true);
    setError(null);

    try {
      const res = await fetch("/api/auth/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password: password.trim() }),
      });

      const data = await res.json();

      if (res.ok && data.success) {
        // The server has already set the httpOnly cookie on this response. All
        // that is kept here is the flag that lets the app open offline next time.
        try {
          localStorage.setItem(AUTH_UNLOCKED_KEY, "true");
        } catch {
          // continue even if localStorage fails
        }
        setStatus("authenticated");
        setPassword("");
      } else {
        setError(data.error || "Incorrect password. Please try again.");
        inputRef.current?.focus();
        inputRef.current?.select();
      }
    } catch {
      setError("Unable to connect to server. Check your connection and try again.");
    } finally {
      setSubmitting(false);
    }
  };

  const lockDevice = useCallback(async () => {
    try {
      localStorage.removeItem(AUTH_UNLOCKED_KEY);
      localStorage.removeItem(LEGACY_TOKEN_KEY);
      // Only the server can clear the httpOnly cookie - that is what the DELETE
      // below is for. This assignment clears a leftover JS-set one from the
      // previous scheme.
      document.cookie = "revmarks_auth=; Max-Age=0; path=/;";
      await fetch("/api/auth/verify", { method: "DELETE" }).catch(() => {});
    } catch {
      // ignore
    }
    setPassword("");
    setError(null);
    setStatus("locked");
  }, []);

  if (status === "loading") {
    return (
      <div className="flex min-h-dvh items-center justify-center bg-ink text-paper">
        <div className="flex flex-col items-center gap-3">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-brand border-t-transparent" />
          <span className="text-label text-dim">Checking device authorization...</span>
        </div>
      </div>
    );
  }

  if (status === "locked") {
    return (
      <div className="flex min-h-dvh flex-col items-center justify-center bg-ink px-4 py-8 text-paper">
        <div className="w-full max-w-sm rounded-card border border-line bg-surface p-6 shadow-card">
          <div className="mb-6 flex flex-col items-center text-center">
            <div className="mb-3 flex h-14 w-14 items-center justify-center rounded-full border border-line bg-surface-2 text-brand">
              <Lock className="h-6 w-6 text-brand" />
            </div>
            <h1 className="text-title font-semibold text-paper">RevMarks Access</h1>
            <p className="mt-1 text-label text-dim">
              Enter the access password to use RevMarks on this device.
            </p>
          </div>

          <form onSubmit={handleUnlock} className="flex flex-col gap-4">
            <div className="relative flex flex-col">
              <Field
                ref={inputRef}
                id="app-device-password-input"
                label="Access Password"
                type={showPassword ? "text" : "password"}
                placeholder="Enter password"
                value={password}
                autoComplete="current-password"
                enterKeyHint="done"
                disabled={submitting}
                onChange={(e) => {
                  setPassword(e.target.value);
                  if (error) setError(null);
                }}
              />
              <button
                type="button"
                id="toggle-password-visibility-btn"
                onClick={() => setShowPassword((prev) => !prev)}
                className="absolute right-3 top-[34px] p-1 text-dim hover:text-paper focus:outline-none"
                tabIndex={-1}
                aria-label={showPassword ? "Hide password" : "Show password"}
              >
                {showPassword ? (
                  <EyeOff className="h-4 w-4" />
                ) : (
                  <Eye className="h-4 w-4" />
                )}
              </button>
            </div>

            {error && (
              <div
                id="auth-error-message"
                className="rounded-control border border-warn/40 bg-warn/10 px-3 py-2 text-micro font-medium text-warn"
              >
                {error}
              </div>
            )}

            <Button
              id="unlock-device-submit-btn"
              type="submit"
              variant="primary"
              size="lg"
              fullWidth
              loading={submitting}
              disabled={submitting}
            >
              Unlock RevMarks
            </Button>

            <div className="mt-1 flex items-center justify-center gap-1.5 text-micro text-dim">
              <ShieldCheck className="h-3.5 w-3.5 text-brand" />
              <span>Password is remembered on this device</span>
            </div>
          </form>
        </div>
      </div>
    );
  }

  return (
    <AuthContext.Provider value={{ isAuthenticated: true, lockDevice }}>
      {children}
    </AuthContext.Provider>
  );
}
