import { NextRequest, NextResponse } from "next/server";
import { AUTH_COOKIE, verifyRoleToken } from "@/lib/auth";
import {
  endActiveSession,
  getActiveSessions,
  upsertActiveSession,
} from "@/lib/activeSessions";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const auth = await verifyRoleToken(req.cookies.get(AUTH_COOKIE)?.value);
  if (!auth.valid || auth.role !== "admin") {
    return NextResponse.json(
      { error: "Only administrators can view active sessions." },
      { status: 403 }
    );
  }

  const sessions = getActiveSessions();
  return NextResponse.json({ sessions });
}

export async function POST(req: NextRequest) {
  const auth = await verifyRoleToken(req.cookies.get(AUTH_COOKIE)?.value);
  if (!auth.valid) {
    return NextResponse.json({ error: "Not authorised." }, { status: 401 });
  }

  const body = await req.json().catch(() => ({}));
  const { id, staffName, town, revId, revNo, marksCount } = body;

  if (!id || !staffName || !town || !revId) {
    return NextResponse.json(
      { error: "Missing required session parameters (id, staffName, town, revId)." },
      { status: 400 }
    );
  }

  const session = upsertActiveSession({
    id: String(id),
    staffName: String(staffName),
    town: String(town),
    revId: String(revId),
    revNo: revNo ? String(revNo) : undefined,
    marksCount: typeof marksCount === "number" ? marksCount : undefined,
  });

  return NextResponse.json({ success: true, session });
}

export async function DELETE(req: NextRequest) {
  const auth = await verifyRoleToken(req.cookies.get(AUTH_COOKIE)?.value);
  if (!auth.valid) {
    return NextResponse.json({ error: "Not authorised." }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const id = searchParams.get("id");

  if (!id) {
    return NextResponse.json(
      { error: "Missing session id parameter." },
      { status: 400 }
    );
  }

  const ended = endActiveSession(id);
  return NextResponse.json({ success: true, ended });
}
