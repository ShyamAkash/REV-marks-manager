import { NextRequest, NextResponse } from "next/server";
import { getAppPassword, getExpectedToken, verifyToken } from "@/lib/auth";

export async function GET(req: NextRequest) {
  const cookieToken = req.cookies.get("revmarks_auth")?.value;
  const headerToken = req.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
  const token = headerToken || cookieToken;

  const authenticated = verifyToken(token);
  return NextResponse.json({ authenticated });
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    const submitted = typeof body.password === "string" ? body.password.trim() : "";
    const expected = getAppPassword();

    if (!submitted || submitted !== expected) {
      return NextResponse.json(
        { success: false, error: "Incorrect password. Please try again." },
        { status: 401 }
      );
    }

    const token = getExpectedToken();
    const response = NextResponse.json({ success: true, token });

    // Store cookie for 1 year so user is not prompted again on the same device
    response.cookies.set("revmarks_auth", token, {
      path: "/",
      maxAge: 31536000,
      sameSite: "lax",
      httpOnly: false,
    });

    return response;
  } catch (err) {
    return NextResponse.json(
      { success: false, error: "Authentication error" },
      { status: 500 }
    );
  }
}

export async function DELETE() {
  const response = NextResponse.json({ success: true });
  response.cookies.delete("revmarks_auth");
  return response;
}
