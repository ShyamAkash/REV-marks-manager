import { NextRequest, NextResponse } from "next/server";
import { AUTH_COOKIE, AppPasswordNotSetError, verifyRoleToken } from "@/lib/auth";

/**
 * Route protection and role-based access control.
 *
 * Admins have access to Mark, Manage, Active Sessions, and administrative APIs.
 * Paper markers have access strictly to the Mark tab and marking APIs.
 */
export const config = {
  matcher: [
    "/api/:path*",
    "/manage",
    "/manage/:path*",
    "/sessions",
    "/sessions/:path*",
  ],
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
    const auth = await verifyRoleToken(req.cookies.get(AUTH_COOKIE)?.value);

    const isApi = pathname.startsWith("/api/");

    // If unauthenticated:
    if (!auth.valid || !auth.role) {
      if (isApi) {
        return NextResponse.json(
          { error: "Not authorised. Unlock RevMarks on this device and try again." },
          { status: 401 }
        );
      }
      // For page navigation, redirect to home page where PasswordGate handles unlock
      return NextResponse.redirect(new URL("/", req.url));
    }

    // Role-based restrictions:
    // Paper markers are ONLY allowed on the Mark tab ("/") and marking APIs.
    if (auth.role === "marker") {
      // 1. Disallow /manage and /sessions pages
      if (pathname.startsWith("/manage") || pathname.startsWith("/sessions")) {
        return NextResponse.redirect(new URL("/", req.url));
      }

      // 2. Disallow admin-only API routes
      if (
        (pathname.startsWith("/api/revs") && req.method !== "GET") ||
        pathname.startsWith("/api/records/export") ||
        pathname.startsWith("/api/rank") ||
        (pathname === "/api/sessions" && req.method === "GET")
      ) {
        return NextResponse.json(
          { error: "Forbidden. Administrative privileges required." },
          { status: 403 }
        );
      }
    }

    return NextResponse.next();
  } catch (err) {
    if (err instanceof AppPasswordNotSetError) {
      if (pathname.startsWith("/api/")) {
        return NextResponse.json({ error: err.message }, { status: 500 });
      }
      return NextResponse.next();
    }
    throw err;
  }
}
