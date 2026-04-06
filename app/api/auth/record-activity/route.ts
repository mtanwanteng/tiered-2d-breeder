import { NextRequest, NextResponse } from "next/server";
import { auth } from "../../../auth";
import { db } from "../../../../src/db";
import { user } from "../../../../src/db/schema";
import { eq, sql } from "drizzle-orm";
import { getPostHogClient } from "../../../../src/lib/posthog-server";

export async function POST(req: NextRequest) {
  const session = await auth.api.getSession({ headers: req.headers });
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { anonId } = (await req.json()) as { anonId?: string };
  const now = new Date();

  await db
    .update(user)
    .set({
      // COALESCE keeps the existing anonId if already set — write-once
      ...(anonId ? { anonId: sql`COALESCE(${user.anonId}, ${anonId})` } : {}),
      lastActiveAt: now,
      updatedAt: now,
    })
    .where(eq(user.id, session.user.id));

  const ph = getPostHogClient();
  ph.capture({ distinctId: session.user.id, event: 'session_started' });
  await ph.shutdown();

  return NextResponse.json({ ok: true });
}
