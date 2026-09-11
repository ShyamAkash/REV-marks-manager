import { NextRequest, NextResponse } from "next/server";
import { AUTH_COOKIE, AppPasswordNotSetError, verifyToken } from "@/lib/auth";

/**
 * Every `/api/*` request must carry a valid `revmarks_auth` cookie.
 *
 * `PasswordGate` hides the UI; this is what actually keeps the data behind the
 * password. The cookie is httpOnly and set by POST /api/auth/verify, and the
 * browser attaches it to same-origin fetches and to top-level navigations (the
 * xlsx export and the rank PDF are opened with `window.location.href`) without
 * the app doing anything.
 *
 * /api/auth/verify is the one exception — it is how a device gets a cookie in
 * the first place, and how the gate asks whether the one it has is still good.
 */
export const config = {
  matcher: "/api/:path*",
};

const PUBLIC_API_PATHS = ["/api/auth/verify"];

function isPublic(pathname: string): boolean {
  return PUBLIC_API_PATHS.some(
    (p) => pathname === p || pathname.startsWith(`${p}/`)
  );
}

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;
  if (isPublic(pathname)) return NextResponse.next();

  try {
    if (await verifyToken(req.cookies.get(AUTH_COOKIE)?.value)) {
      return NextResponse.next();
    }
  } catch (err) {
    // A deployment with no APP_PASSWORD cannot authenticate anyone. Say so
    // rather than answering 401, which would send the marker to a password
    // screen that no password can get past.
    if (err instanceof AppPasswordNotSetError) {
      return NextResponse.json({ error: err.message }, { status: 500 });
    }
    throw err;
  }

  // The offline queue leaves anything that does not come back ok queued, so a
  // marker who has been locked out keeps their marks and they upload once the
  // device is unlocked again.
  return NextResponse.json(
    { error: "Not authorised. Unlock RevMarks on this device and try again." },
    { status: 401 }
  );
}
