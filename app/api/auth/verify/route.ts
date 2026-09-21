import crypto from "crypto";
import { NextRequest, NextResponse } from "next/server";
import {
  AUTH_COOKIE,
  AUTH_COOKIE_MAX_AGE,
  AppPasswordNotSetError,
  determineRole,
  getExpectedRoleToken,
  hasCustomRolePasswords,
  verifyRoleToken,
} from "@/lib/auth";

export const dynamic = "force-dynamic";
// timingSafeEqual is Node-only. middleware.ts checks the same token on the Edge
// runtime through lib/auth's Web Crypto path.
export const runtime = "nodejs";

/**
 * The cookie is marked `secure` outside development. `npm run dev` binds
 * 0.0.0.0 so a phone on the LAN can reach it over plain http, and a secure
 * cookie is silently dropped there — the password would appear to be accepted
 * and every API call would then 401. Vercel is https, so production is always
 * secure.
 */
const SECURE_COOKIE = process.env.NODE_ENV === "production";

/** Failed attempts allowed from one address before it is made to wait. */
const MAX_ATTEMPTS = 10;
/** Failures older than this no longer count towards the limit. */
const ATTEMPT_WINDOW_MS = 15 * 60_000;
/** How long an address sits out once it trips the limit. */
const LOCKOUT_MS = 15 * 60_000;

interface AttemptRecord {
  count: number;
  firstAt: number;
  blockedUntil: number;
}

/**
 * Deliberately in-process: one shared password guarded by a few markers does
 * not warrant a rate-limit table, and a serverless instance recycling only
 * resets a counter that costs an attacker a new connection anyway. It turns a
 * fast online guessing loop into a slow one, which is all it is for.
 */
const attempts = new Map<string, AttemptRecord>();

function clientKey(req: NextRequest): string {
  const forwarded = req.headers.get("x-forwarded-for");
  if (forwarded) return forwarded.split(",")[0].trim();
  return req.headers.get("x-real-ip") ?? "unknown";
}

/** Keeps the map from growing without bound on a long-lived instance. */
function prune(now: number) {
  if (attempts.size < 500) return;
  for (const [key, rec] of attempts) {
    if (rec.blockedUntil < now && now - rec.firstAt > ATTEMPT_WINDOW_MS) {
      attempts.delete(key);
    }
  }
}

/** Seconds the caller must wait, or 0 if they may try now. */
function retryAfter(key: string, now: number): number {
  const rec = attempts.get(key);
  if (!rec || rec.blockedUntil <= now) return 0;
  return Math.ceil((rec.blockedUntil - now) / 1000);
}

function recordFailure(key: string, now: number) {
  const rec = attempts.get(key);
  if (!rec || now - rec.firstAt > ATTEMPT_WINDOW_MS) {
    attempts.set(key, { count: 1, firstAt: now, blockedUntil: 0 });
    return;
  }
  rec.count += 1;
  if (rec.count >= MAX_ATTEMPTS) {
    rec.blockedUntil = now + LOCKOUT_MS;
    rec.count = 0;
    rec.firstAt = now;
  }
}

/**
 * Constant-time comparison of two strings of any length. `timingSafeEqual`
 * throws unless both buffers are the same size, and the sizes here are the two
 * passwords — so both are hashed first and the fixed-width digests compared.
 */
function timingSafeEqualStrings(a: string, b: string): boolean {
  const ha = crypto.createHash("sha256").update(a, "utf8").digest();
  const hb = crypto.createHash("sha256").update(b, "utf8").digest();
  return crypto.timingSafeEqual(ha, hb);
}

/** Is the cookie this device already holds still valid? */
export async function GET(req: NextRequest) {
  try {
    const token =
      req.cookies.get(AUTH_COOKIE)?.value ||
      req.headers.get("x-role-token") ||
      req.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
    const auth = await verifyRoleToken(token);
    return NextResponse.json({
      authenticated: auth.valid,
      role: auth.role,
      hasCustomPassword: hasCustomRolePasswords(),
    });
  } catch (err) {
    if (err instanceof AppPasswordNotSetError) {
      return NextResponse.json(
        { authenticated: false, role: null, hasCustomPassword: false, error: err.message },
        { status: 500 }
      );
    }
    return NextResponse.json(
      { authenticated: false, role: null, hasCustomPassword: false, error: "Authentication error" },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  const now = Date.now();
  const key = clientKey(req);

  try {
    prune(now);

    const wait = retryAfter(key, now);
    if (wait > 0) {
      return NextResponse.json(
        {
          success: false,
          error: `Too many incorrect attempts. Try again in ${Math.ceil(
            wait / 60
          )} minute(s).`,
        },
        { status: 429, headers: { "Retry-After": String(wait) } }
      );
    }

    const body = await req.json().catch(() => ({}));
    const submitted = typeof body.password === "string" ? body.password.trim() : "";

    if (!hasCustomRolePasswords()) {
      return NextResponse.json(
        {
          success: false,
          error:
            "No password has been configured in environment variables. Please set ADMIN_PASSWORD or MARKER_PASSWORD.",
        },
        { status: 503 }
      );
    }

    const role = determineRole(submitted);

    if (!role) {
      recordFailure(key, now);
      return NextResponse.json(
        { success: false, error: "Incorrect password. Please try again." },
        { status: 401 }
      );
    }

    attempts.delete(key);

    const roleToken = await getExpectedRoleToken(role);
    const response = NextResponse.json({ success: true, role, token: roleToken });
    response.cookies.set(AUTH_COOKIE, roleToken, {
      path: "/",
      maxAge: AUTH_COOKIE_MAX_AGE,
      sameSite: SECURE_COOKIE ? "none" : "lax",
      httpOnly: true,
      secure: SECURE_COOKIE,
    });
    return response;
  } catch (err) {
    if (err instanceof AppPasswordNotSetError) {
      return NextResponse.json({ success: false, error: err.message }, { status: 500 });
    }
    return NextResponse.json(
      { success: false, error: "Authentication error" },
      { status: 500 }
    );
  }
}

export async function DELETE() {
  const response = NextResponse.json({ success: true });
  // Overwrite with the same attributes it was set with, so the browser matches
  // and clears it rather than leaving a second cookie behind.
  response.cookies.set(AUTH_COOKIE, "", {
    path: "/",
    maxAge: 0,
    sameSite: "lax",
    httpOnly: true,
    secure: SECURE_COOKIE,
  });
  return response;
}
