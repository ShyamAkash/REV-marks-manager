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
export type UserRole = "admin" | "marker";

/** The cookie the browser sends back; httpOnly, so page scripts never see it. */
export const AUTH_COOKIE = "revmarks_auth";

/** One year, matching the cookie's Max-Age. */
export const AUTH_COOKIE_MAX_AGE = 31536000;

const TOKEN_HMAC_KEY = "revmarks_auth_secret_key_v2";

export class AppPasswordNotSetError extends Error {
  constructor() {
    super(
      "Role passwords are not set. RevMarks cannot verify anyone until configured."
    );
    this.name = "AppPasswordNotSetError";
  }
}

export function hasCustomRolePasswords(): boolean {
  return Boolean(
    process.env.ADMIN_PASSWORD ||
      process.env.MARKER_PASSWORD ||
      process.env.APP_PASSWORD ||
      process.env.ADMIN_PASSWORD_1 ||
      process.env.MARKER_PASSWORD_1
  );
}

export function getAdminPassword(): string {
  return (
    process.env.ADMIN_PASSWORD?.trim() ||
    process.env.APP_PASSWORD?.trim() ||
    process.env.ADMIN_PASSWORD_1?.trim() ||
    ""
  );
}

export function getMarkerPassword(): string {
  return (
    process.env.MARKER_PASSWORD?.trim() ||
    process.env.MARKER_PASSWORD_1?.trim() ||
    ""
  );
}

export function getAdminPasswords(): string[] {
  const pw = getAdminPassword();
  return pw ? [pw] : [];
}

export function getMarkerPasswords(): string[] {
  const pw = getMarkerPassword();
  return pw ? [pw] : [];
}

/** Legacy helper */
export function getAppPassword(): string {
  return getAdminPassword();
}

export function determineRole(submittedPassword: string): UserRole | null {
  const trimmed = submittedPassword.trim();
  if (!trimmed) return null;

  const adminPw = getAdminPassword();
  if (adminPw && constantTimeEqual(trimmed, adminPw)) {
    return "admin";
  }

  const markerPw = getMarkerPassword();
  if (markerPw && constantTimeEqual(trimmed, markerPw)) {
    return "marker";
  }

  return null;
}

const roleTokenCache = new Map<string, string>();

export async function getExpectedRoleToken(role: UserRole): Promise<string> {
  const secretComponent =
    role === "admin" ? getAdminPassword() : getMarkerPassword();

  if (!secretComponent) {
    throw new AppPasswordNotSetError();
  }

  const cacheKey = `${role}:${secretComponent}`;
  if (roleTokenCache.has(cacheKey)) {
    return roleTokenCache.get(cacheKey)!;
  }

  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(TOKEN_HMAC_KEY),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
  const signature = await crypto.subtle.sign(
    "HMAC",
    key,
    encoder.encode(`${role}:${secretComponent}`)
  );
  const sigHex = Array.from(new Uint8Array(signature))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");

  const fullToken = `${role}.${sigHex}`;
  roleTokenCache.set(cacheKey, fullToken);
  return fullToken;
}

export async function getExpectedToken(): Promise<string> {
  return getExpectedRoleToken("admin");
}

/**
 * Length-independent comparison of two strings.
 */
export function constantTimeEqual(a: string, b: string): boolean {
  let diff = a.length ^ b.length;
  const len = Math.max(a.length, b.length);
  for (let i = 0; i < len; i++) {
    diff |= (a.charCodeAt(i) || 0) ^ (b.charCodeAt(i) || 0);
  }
  return diff === 0;
}

export interface VerifiedAuth {
  valid: boolean;
  role: UserRole | null;
}

export async function verifyRoleToken(
  token: string | null | undefined
): Promise<VerifiedAuth> {
  if (!token || typeof token !== "string") {
    return { valid: false, role: null };
  }

  const adminPw = getAdminPassword();
  const markerPw = getMarkerPassword();

  // Format: role.sigHex
  if (adminPw && token.startsWith("admin.")) {
    try {
      const expected = await getExpectedRoleToken("admin");
      if (constantTimeEqual(token, expected)) {
        return { valid: true, role: "admin" };
      }
    } catch {
      // Env var not set
    }
  } else if (markerPw && token.startsWith("marker.")) {
    try {
      const expected = await getExpectedRoleToken("marker");
      if (constantTimeEqual(token, expected)) {
        return { valid: true, role: "marker" };
      }
    } catch {
      // Env var not set
    }
  }

  // Backwards compatibility with legacy token
  if (adminPw) {
    try {
      const legacyAdminToken = await getExpectedToken();
      if (constantTimeEqual(token, legacyAdminToken)) {
        return { valid: true, role: "admin" };
      }
    } catch {
      // Env var not set
    }
  }

  return { valid: false, role: null };
}

/** Backwards-compatible verifyToken returns true if valid for any role */
export async function verifyToken(
  token: string | null | undefined
): Promise<boolean> {
  const result = await verifyRoleToken(token);
  return result.valid;
}
