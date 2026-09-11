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

const AUTH_TOKEN_KEY = "revmarks_auth_token";
const AUTH_UNLOCKED_KEY = "revmarks_auth_unlocked";

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
    try {
      const localToken = localStorage.getItem(AUTH_TOKEN_KEY);
      let cookieToken: string | null = null;
      if (typeof document !== "undefined") {
        const match = document.cookie.match(/(?:^|;\s*)revmarks_auth=([^;]+)/);
        cookieToken = match ? decodeURIComponent(match[1]) : null;
      }

      const existingToken = localToken || cookieToken;

      if (existingToken) {
        // Device already unlocked - immediately authenticate without blocking
        setStatus("authenticated");
        if (localToken && !cookieToken) {
          document.cookie = `revmarks_auth=${encodeURIComponent(
            localToken
          )}; path=/; max-age=31536000; SameSite=Lax`;
        } else if (cookieToken && !localToken) {
          localStorage.setItem(AUTH_TOKEN_KEY, cookieToken);
          localStorage.setItem(AUTH_UNLOCKED_KEY, "true");
        }

        // Background check: if online, verify that password has not been changed on server
        if (navigator.onLine) {
          fetch("/api/auth/verify", {
            headers: { Authorization: `Bearer ${existingToken}` },
          })
            .then((res) => res.json())
            .then((data) => {
              if (data && data.authenticated === false) {
                // Server password was modified — revoke access on this device
                localStorage.removeItem(AUTH_TOKEN_KEY);
                localStorage.removeItem(AUTH_UNLOCKED_KEY);
                document.cookie = "revmarks_auth=; Max-Age=0; path=/;";
                setStatus("locked");
                setError("Server access password was updated. Please enter the new password.");
              }
            })
            .catch(() => {
              // Ignore network drops; keep offline access valid
            });
        }
      } else {
        setStatus("locked");
      }
    } catch {
      setStatus("locked");
    }
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

      if (res.ok && data.success && data.token) {
        // Save to localStorage & cookie for 1 year so user is not prompted again
        try {
          localStorage.setItem(AUTH_TOKEN_KEY, data.token);
          localStorage.setItem(AUTH_UNLOCKED_KEY, "true");
          document.cookie = `revmarks_auth=${encodeURIComponent(
            data.token
          )}; path=/; max-age=31536000; SameSite=Lax`;
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
      localStorage.removeItem(AUTH_TOKEN_KEY);
      localStorage.removeItem(AUTH_UNLOCKED_KEY);
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
