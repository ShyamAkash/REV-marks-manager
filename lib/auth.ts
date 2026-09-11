/**
 * Shared auth primitives for the one-password gate.
 *
 * Written against Web Crypto rather than Node's `crypto` module so the exact
 * same token derivation runs in both runtimes: the `/api/auth/verify` route
 * (Node) and `middleware.ts` (Edge, where `node:crypto` does not exist). The
 * password comparison itself lives in the route, which is Node-only and uses
 * `crypto.timingSafeEqual`.
 *
 * There is no default password. An unset `APP_PASSWORD` is a misconfigured
 * deployment, not a reason to fall back to something guessable, so every entry
 * point throws and the API answers 500 with the reason.
 */

/** The cookie the browser sends back; httpOnly, so page scripts never see it. */
export const AUTH_COOKIE = "revmarks_auth";

/** One year, matching the cookie's Max-Age. */
export const AUTH_COOKIE_MAX_AGE = 31536000;

const TOKEN_HMAC_KEY = "revmarks_auth_secret_key_v1";

export class AppPasswordNotSetError extends Error {
  constructor() {
    super(
      "APP_PASSWORD is not set. RevMarks cannot verify anyone until it is configured."
    );
    this.name = "AppPasswordNotSetError";
  }
}

export function getAppPassword(): string {
  const envPassword = process.env.APP_PASSWORD;
  if (typeof envPassword === "string" && envPassword.trim().length > 0) {
    return envPassword.trim();
  }
  throw new AppPasswordNotSetError();
}

/**
 * Memoised per password, so the HMAC is derived once per runtime instance
 * rather than on every request. Keyed on the password itself, so rotating
 * `APP_PASSWORD` recomputes instead of serving a stale token.
 */
let cached: { password: string; token: string } | null = null;

export async function getExpectedToken(): Promise<string> {
  const password = getAppPassword();
  if (cached && cached.password === password) return cached.token;

  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(TOKEN_HMAC_KEY),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
  const signature = await crypto.subtle.sign("HMAC", key, encoder.encode(password));
  const token = Array.from(new Uint8Array(signature))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");

  cached = { password, token };
  return token;
}

/**
 * Length-independent comparison of two strings. `timingSafeEqual` is not
 * available on the Edge runtime, so the token check uses this instead; the
 * length difference still leaks, which for a fixed-length hex digest tells an
 * attacker nothing they did not already know.
 */
export function constantTimeEqual(a: string, b: string): boolean {
  let diff = a.length ^ b.length;
  const len = Math.max(a.length, b.length);
  for (let i = 0; i < len; i++) {
    diff |= (a.charCodeAt(i) || 0) ^ (b.charCodeAt(i) || 0);
  }
  return diff === 0;
}

/** Throws `AppPasswordNotSetError` when the deployment has no password set. */
export async function verifyToken(
  token: string | null | undefined
): Promise<boolean> {
  if (!token || typeof token !== "string") return false;
  return constantTimeEqual(token, await getExpectedToken());
}
