"use client";

import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from "react";
import { Eye, EyeOff, Lock, ShieldAlert } from "lucide-react";
import { Button, Field } from "@/app/components/ui";

const AUTH_UNLOCKED_KEY = "revmarks_auth_unlocked";
const AUTH_ROLE_KEY = "revmarks_auth_role";
const AUTH_TOKEN_KEY = "revmarks_auth_token";

export type UserRole = "admin" | "marker";

export function getStoredAuthToken(): string | null {
  if (typeof window === "undefined") return null;
  try {
    return localStorage.getItem(AUTH_TOKEN_KEY);
  } catch {
    return null;
  }
}

export function getAuthHeaders(): Record<string, string> {
  const token = getStoredAuthToken();
  if (!token) return {};
  return {
    "x-role-token": token,
    Authorization: `Bearer ${token}`,
  };
}

interface AuthContextType {
  isAuthenticated: boolean;
  role: UserRole | null;
  lockDevice: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType>({
  isAuthenticated: false,
  role: null,
  lockDevice: async () => {},
});

export function useAuth() {
  return useContext(AuthContext);
}

export function PasswordGate({ children }: { children: React.ReactNode }) {
  const [status, setStatus] = useState<"loading" | "locked" | "authenticated">("loading");
  const [role, setRole] = useState<UserRole | null>(null);
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Check saved device credentials on mount
  useEffect(() => {
    let cancelled = false;

    let unlocked = false;
    let savedRole: UserRole | null = null;
    try {
      unlocked = localStorage.getItem(AUTH_UNLOCKED_KEY) === "true";
      const stored = localStorage.getItem(AUTH_ROLE_KEY);
      if (stored === "admin" || stored === "marker") {
        savedRole = stored;
      }
    } catch {
      // localStorage unavailable
    }

    if (unlocked) {
      if (savedRole) setRole(savedRole);
      setStatus("authenticated");
    } else if (typeof navigator !== "undefined" && !navigator.onLine) {
      setStatus("locked");
      return;
    }

    fetch("/api/auth/verify", { headers: getAuthHeaders() })
      .then((res) => res.json())
      .then((data) => {
        if (cancelled) return;
        if (data && data.authenticated) {
          const detectedRole: UserRole = data.role === "marker" ? "marker" : "admin";
          try {
            localStorage.setItem(AUTH_UNLOCKED_KEY, "true");
            localStorage.setItem(AUTH_ROLE_KEY, detectedRole);
            if (data.token) {
              localStorage.setItem(AUTH_TOKEN_KEY, data.token);
            }
          } catch {}
          setRole(detectedRole);
          setStatus("authenticated");
          return;
        }

        try {
          localStorage.removeItem(AUTH_UNLOCKED_KEY);
          localStorage.removeItem(AUTH_ROLE_KEY);
          localStorage.removeItem(AUTH_TOKEN_KEY);
        } catch {}
        setRole(null);
        setStatus("locked");
        if (unlocked) {
          setError("Password was updated. Please enter your password to continue.");
        }
      })
      .catch(() => {
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
        const assignedRole: UserRole = data.role === "marker" ? "marker" : "admin";
        try {
          localStorage.setItem(AUTH_UNLOCKED_KEY, "true");
          localStorage.setItem(AUTH_ROLE_KEY, assignedRole);
          if (data.token) {
            localStorage.setItem(AUTH_TOKEN_KEY, data.token);
          }
        } catch {}
        setRole(assignedRole);
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
      localStorage.removeItem(AUTH_ROLE_KEY);
      localStorage.removeItem(AUTH_TOKEN_KEY);
      document.cookie = "revmarks_auth=; Max-Age=0; path=/;";
      await fetch("/api/auth/verify", { method: "DELETE" }).catch(() => {});
    } catch {
      // ignore
    }
    setRole(null);
    setPassword("");
    setError(null);
    setStatus("locked");
  }, []);

  if (status === "loading") {
    return (
      <div className="flex min-h-dvh items-center justify-center bg-ink text-paper">
        <div className="flex flex-col items-center gap-3">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-brand border-t-transparent" />
          <span className="text-label text-dim">Checking authorization...</span>
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
            <h1 className="text-title font-semibold text-paper">RevMarks</h1>
            <p className="mt-1 text-label text-dim">
              Enter password to access RevMarks on this device.
            </p>
          </div>

          <form onSubmit={handleUnlock} className="flex flex-col gap-4">
            <div className="relative flex flex-col">
              <Field
                ref={inputRef}
                id="app-device-password-input"
                label="Password"
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
                className="flex items-center gap-2 rounded-control border border-warn/40 bg-warn/10 px-3 py-2 text-micro font-medium text-warn"
              >
                <ShieldAlert className="h-4 w-4 shrink-0" />
                <span>{error}</span>
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
              Unlock
            </Button>
          </form>
        </div>
      </div>
    );
  }

  return (
    <AuthContext.Provider
      value={{
        isAuthenticated: status === "authenticated",
        role,
        lockDevice,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}
